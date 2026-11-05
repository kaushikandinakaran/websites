#!/usr/bin/env python3
"""Download CC0 assets from Poly Haven into showcase/assets/polyhaven/ and log the credit.

Usage (run from anywhere):
  python showcase/tools/fetch_polyhaven.py model  brass_diya_lantern [1k|2k]   # glTF + textures
  python showcase/tools/fetch_polyhaven.py hdri   brown_photostudio_02 [1k|2k] # .hdr lighting map
  python showcase/tools/fetch_polyhaven.py texture brown_leather [1k|2k]       # diffuse + normal(GL) + ARM jpgs
  python showcase/tools/fetch_polyhaven.py pano   warm_restaurant_night         # REAL 360-degree PHOTO as web-weight JPGs (8k + 4k) + a 1k .hdr for lighting

Files land in:   showcase/assets/polyhaven/{models|hdri|textures}/<id>/
Credit log:      showcase/assets/polyhaven/CREDITS.md   (appended once per asset)
Licence:         all Poly Haven assets are CC0 (https://polyhaven.com/license), no attribution needed, but we log it.

Serve them from a site as:  ../../assets/polyhaven/models/<id>/<id>_1k.gltf  (the .gltf references its .bin and textures/ by relative path).
Keep the page weight in mind: a 1k model is about 1-3 MB, a 1k HDRI about 1.5 MB, a 1k texture set about 1-2 MB.
"""
import json, os, sys, urllib.request

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'polyhaven'))
UA = {'User-Agent': 'website-studio-showcase'}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(dest, 'wb') as f:
        f.write(r.read())


def log_credit(kind, asset_id):
    os.makedirs(ROOT, exist_ok=True)
    path = os.path.join(ROOT, 'CREDITS.md')
    header = '# Poly Haven assets used (CC0)\n\nAll CC0 1.0, https://polyhaven.com/license. Credit is optional; kept for the record.\n\n'
    existing = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
    marker = f'`{asset_id}`'
    if marker in existing:
        return
    info = get_json(f'https://api.polyhaven.com/info/{asset_id}')
    authors = ', '.join(info.get('authors', {}).keys()) or 'unknown'
    line = f"- {kind} {marker}: {info.get('name', asset_id)}, by {authors}, https://polyhaven.com/a/{asset_id}\n"
    # append-only so several people downloading at once cannot overwrite each other's lines
    with open(path, 'a', encoding='utf-8') as f:
        if not existing:
            f.write(header)
        f.write(line)


def fetch_model(asset_id, res):
    files = get_json(f'https://api.polyhaven.com/files/{asset_id}')['gltf'][res]['gltf']
    out = os.path.join(ROOT, 'models', asset_id)
    gltf_name = f'{asset_id}_{res}.gltf'
    download(files['url'], os.path.join(out, gltf_name))
    for rel, meta in files.get('include', {}).items():
        download(meta['url'], os.path.join(out, rel))
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    return out, total


def fetch_hdri(asset_id, res):
    meta = get_json(f'https://api.polyhaven.com/files/{asset_id}')['hdri'][res]['hdr']
    out = os.path.join(ROOT, 'hdri', asset_id)
    download(meta['url'], os.path.join(out, f'{asset_id}_{res}.hdr'))
    return out, os.path.getsize(os.path.join(out, f'{asset_id}_{res}.hdr'))


def fetch_texture(asset_id, res):
    data = get_json(f'https://api.polyhaven.com/files/{asset_id}')
    out = os.path.join(ROOT, 'textures', asset_id)
    for key, suffix in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('arm', 'arm')):
        if key in data and res in data[key] and 'jpg' in data[key][res]:
            download(data[key][res]['jpg']['url'], os.path.join(out, f'{asset_id}_{suffix}_{res}.jpg'))
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) if os.path.isdir(out) else 0
    return out, total


def fetch_pano(asset_id, res):
    """Download the full-resolution tonemapped 360 photo (tens of MB), then write web-weight equirectangular
    JPGs: <id>_8k.jpg (desktop, about 3-6 MB), <id>_4k.jpg (phones, about 1 MB), plus the 1k .hdr for image-based lighting.
    Needs Pillow (system python has it)."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    data = get_json(f'https://api.polyhaven.com/files/{asset_id}')
    out = os.path.join(ROOT, 'pano', asset_id)
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, '_full.jpg')
    download(data['tonemapped']['url'], tmp)
    im = Image.open(tmp).convert('RGB')
    for w, q in ((8192, 82), (4096, 80)):
        im.resize((w, w // 2), Image.LANCZOS).save(os.path.join(out, f'{asset_id}_{w // 1024}k.jpg'), 'JPEG', quality=q, optimize=True, progressive=True)
    im.close(); os.remove(tmp)
    hdr = data['hdri']['1k']['hdr']
    download(hdr['url'], os.path.join(out, f'{asset_id}_1k.hdr'))
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    return out, total


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('model', 'hdri', 'texture', 'pano'):
        print(__doc__)
        sys.exit(2)
    kind, asset_id = sys.argv[1], sys.argv[2]
    res = sys.argv[3] if len(sys.argv) > 3 else '1k'
    out, total = {'model': fetch_model, 'hdri': fetch_hdri, 'texture': fetch_texture, 'pano': fetch_pano}[kind](asset_id, res)
    log_credit(kind, asset_id)
    print(f'ok {kind} {asset_id} {res}: {total/1024:.0f} KB -> {out}')


if __name__ == '__main__':
    main()
