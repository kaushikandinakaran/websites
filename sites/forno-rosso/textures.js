// Forno Rosso - procedural canvas textures (no image files, nothing downloaded).
import * as THREE from 'three';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAT = (() => {
  const r = rng(7);
  const a = new Float32Array(256 * 256);
  for (let i = 0; i < a.length; i++) a[i] = r();
  return a;
})();
function vnoise(x, y, per) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = (((xi % per) + per) % per) & 255, x1 = ((((xi + 1) % per) + per) % per) & 255;
  const y0 = ((((yi % per) + per) % per) & 255) << 8, y1 = ((((yi + 1) % per) + per) % per & 255) << 8;
  const a = LAT[y0 + x0], b = LAT[y0 + x1], c = LAT[y1 + x0], d = LAT[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, per, oct = 4) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    s += vnoise(x * (1 << o), y * (1 << o), per * (1 << o)) * amp;
    tot += amp;
    amp *= 0.5;
  }
  return s / tot;
}

/* Texture size scale: 1 on desktop, 0.5 on the low (phone) tier. Set before generating. */
let Q = 1;
export function setQuality(low) { Q = low ? 0.5 : 1; }

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { srgb = true, repeat = [1, 1], aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function shade(r, g, b, k) {
  return `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;
}

/** Soft grey noise: the "thumb-pressed clay" bump used on every clay material. */
export function clayBump(size = Math.round(256 * Q)) {
  const [c, x] = cv(size, size);
  const img = x.createImageData(size, size);
  const f = 8;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const n = fbm((i / size) * f, (j / size) * f, f, 4);
    const fine = vnoise((i / size) * 64, (j / size) * 64, 64);
    const v = Math.max(0, Math.min(1, n * 0.8 + fine * 0.2));
    const k = (j * size + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = (v * 255) | 0;
    img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return toTex(c, { srgb: false });
}

/** Terracotta bricks. Returns { map, bump }. tile = 4 bricks x 8 rows. */
export function bricks(hue = [186, 84, 48]) {
  const W = 512, H = 512, rows = 8, per = 4;
  const bw = W / per, bh = H / rows, gap = 5;
  const r = rng(11);
  const [c, x] = cv(W, H);
  const [cb, xb] = cv(W, H);
  x.fillStyle = '#ead8bd'; x.fillRect(0, 0, W, H);
  xb.fillStyle = '#000'; xb.fillRect(0, 0, W, H);
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * (bw / 2);
    for (let i = -1; i < per + 1; i++) {
      const k = 0.82 + r() * 0.36;
      const px = i * bw + off + gap / 2, py = j * bh + gap / 2;
      x.fillStyle = shade(hue[0], hue[1], hue[2], k);
      x.beginPath(); x.roundRect(px, py, bw - gap, bh - gap, 9); x.fill();
      xb.fillStyle = '#fff';
      xb.beginPath(); xb.roundRect(px, py, bw - gap, bh - gap, 9); xb.fill();
      // soft inner highlight on the top edge: handmade clay feel
      const g = x.createLinearGradient(0, py, 0, py + bh);
      g.addColorStop(0, 'rgba(255,225,190,.22)'); g.addColorStop(0.5, 'rgba(255,225,190,0)'); g.addColorStop(1, 'rgba(60,15,5,.2)');
      x.fillStyle = g; x.beginPath(); x.roundRect(px, py, bw - gap, bh - gap, 9); x.fill();
    }
  }
  for (let n = 0; n < 1400; n++) {
    x.fillStyle = `rgba(${r() > 0.5 ? '255,235,210' : '70,25,10'},${0.04 + r() * 0.06})`;
    x.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 3);
  }
  return { map: toTex(c), bump: toTex(cb, { srgb: false }) };
}

/** Mottled terracotta plaster wall: shallow arch niches + flour-white dado band. 12.6 x 8.4 units. */
export function wall() {
  const W = Math.round(768 * Q), H = Math.round(512 * Q), k = W / 1536;
  const [c, x] = cv(W, H);
  const r = rng(5);
  const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const n = fbm((i / W) * 6, (j / H) * 4, 6, 4);
    const k = 0.9 + n * 0.22;
    const q = (j * W + i) * 4;
    img.data[q] = 206 * k; img.data[q + 1] = 118 * k; img.data[q + 2] = 78 * k; img.data[q + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const unit = W / 12.6;
  const nicheW = 2.6 * unit, nicheH = 4.2 * unit;
  const baseY = H - 1.3 * unit; // above the dado
  for (let n = 0; n < 3; n++) {
    const cx = (n + 0.5) * (W / 3);
    const x0 = cx - nicheW / 2, y0 = baseY - nicheH + nicheW / 2;
    const path = () => {
      x.beginPath();
      x.moveTo(x0, baseY - 1.0 * unit);
      x.lineTo(x0, y0);
      x.arc(cx, y0, nicheW / 2, Math.PI, 0);
      x.lineTo(x0 + nicheW, baseY - 1.0 * unit);
      x.closePath();
    };
    path();
    const g = x.createLinearGradient(0, y0 - nicheW / 2, 0, baseY);
    g.addColorStop(0, '#9c4a2c'); g.addColorStop(0.45, '#d4896a'); g.addColorStop(1, '#e8b48f');
    x.fillStyle = g; x.fill();
    x.lineWidth = Math.max(1, 9 * k); x.strokeStyle = 'rgba(255,226,196,.55)'; x.stroke();
    x.lineWidth = Math.max(1, 3 * k); x.strokeStyle = 'rgba(70,25,10,.4)'; path(); x.stroke();
    // little ledge
    x.fillStyle = '#f1dcc0'; x.beginPath(); x.roundRect(x0 - 12 * k, baseY - 1.0 * unit, nicheW + 24 * k, 16 * k, 6 * k); x.fill();
  }
  // dado band (flour white tile)
  const dy = H - 1.3 * unit;
  x.fillStyle = '#f6ead8'; x.fillRect(0, dy, W, H - dy);
  x.strokeStyle = 'rgba(120,60,30,.18)'; x.lineWidth = Math.max(1, 2 * k);
  const tile = unit * 0.5;
  for (let i = 0; i < W; i += tile) { x.beginPath(); x.moveTo(i, dy); x.lineTo(i, H); x.stroke(); }
  for (let j = dy; j < H; j += tile) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  x.fillStyle = '#b8431f'; x.fillRect(0, dy - 10 * k, W, 10 * k);
  for (let n = 0; n < 600; n++) {
    x.fillStyle = `rgba(${r() > 0.5 ? '255,230,200' : '90,30,12'},${0.03 + r() * 0.05})`;
    x.fillRect(r() * W, r() * H, (2 + r() * 6) * k, (2 + r() * 5) * k);
  }
  return toTex(c);
}

/** Terracotta floor tiles, 2x2 tile repeat unit. */
export function floorTiles() {
  const S = 512, r = rng(3);
  const [c, x] = cv(S, S);
  x.fillStyle = '#d9b99a'; x.fillRect(0, 0, S, S);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const k = 0.86 + r() * 0.26;
    x.fillStyle = shade(190, 96, 60, k);
    x.beginPath(); x.roundRect(i * 256 + 5, j * 256 + 5, 246, 246, 14); x.fill();
  }
  for (let n = 0; n < 2000; n++) {
    x.fillStyle = `rgba(${r() > 0.5 ? '255,220,190' : '70,25,10'},${0.04 + r() * 0.05})`;
    x.fillRect(r() * S, r() * S, 2 + r() * 5, 2 + r() * 4);
  }
  return toTex(c);
}

/** Pale marble work top with a dusting of flour. */
export function marble() {
  const S = Math.round(512 * Q), r = rng(21);
  const [c, x] = cv(S, S);
  const img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = fbm((i / S) * 4, (j / S) * 4, 4, 5);
    const vein = Math.abs(Math.sin((i / S) * 9 + n * 7));
    const v = 0.93 + n * 0.07 - Math.pow(1 - vein, 14) * 0.07;
    const q = (j * S + i) * 4;
    img.data[q] = 246 * v; img.data[q + 1] = 238 * v; img.data[q + 2] = 226 * v; img.data[q + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let n = 0; n < 1300; n++) {
    x.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.3})`;
    const s = 1 + r() * 2;
    x.fillRect(r() * S, r() * S, s, s);
  }
  return toTex(c);
}

/** Warm wood grain. */
export function wood(base = [208, 160, 108]) {
  const W = Math.round(256 * Q), H = Math.round(128 * Q), r = rng(9);
  const [c, x] = cv(W, H);
  const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const n = fbm((i / W) * 2, (j / H) * 12, 2, 4);
    const ring = 0.5 + 0.5 * Math.sin((j / H) * 140 + n * 9 + (i / W) * 2);
    const k = 0.86 + 0.14 * ring + (n - 0.5) * 0.14;
    const q = (j * W + i) * 4;
    img.data[q] = base[0] * k; img.data[q + 1] = base[1] * k; img.data[q + 2] = base[2] * k; img.data[q + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let n = 0; n < 40; n++) {
    x.strokeStyle = `rgba(80,40,15,${0.06 + r() * 0.1})`; x.lineWidth = 1 + r() * 1.5;
    x.beginPath(); const y0 = r() * H; x.moveTo(0, y0);
    x.bezierCurveTo(W * 0.3, y0 + (r() - 0.5) * 14, W * 0.6, y0 + (r() - 0.5) * 14, W, y0 + (r() - 0.5) * 10); x.stroke();
  }
  return toTex(c);
}

/** Tomato sauce spiral (top cap of the sauce disc). */
export function sauce() {
  const S = 512, r = rng(31);
  const [c, x] = cv(S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#d8402a'); g.addColorStop(1, '#b52a17');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) {
    x.strokeStyle = pass === 0 ? 'rgba(255,120,80,.34)' : pass === 1 ? 'rgba(110,15,6,.30)' : 'rgba(255,150,100,.18)';
    x.lineWidth = pass === 0 ? 26 : pass === 1 ? 14 : 6;
    x.beginPath();
    for (let a = 0; a < Math.PI * 9; a += 0.05) {
      const rad = 14 + a * 9.2 + (pass - 1) * 9 + Math.sin(a * 3 + pass) * 3;
      const px = S / 2 + Math.cos(a + pass * 0.6) * rad, py = S / 2 + Math.sin(a + pass * 0.6) * rad;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  }
  for (let n = 0; n < 700; n++) {
    x.fillStyle = `rgba(${r() > 0.5 ? '255,150,110' : '90,10,5'},${0.07 + r() * 0.1})`;
    x.beginPath(); x.arc(r() * S, r() * S, 1 + r() * 3.5, 0, 7); x.fill();
  }
  return toTex(c);
}

/** Soft round shadow blob used for contact shadows under props. */
export function blob() {
  const [c, x] = cv(128, 128);
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(0.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Round lit-up bulb halo (used for the string lights). */
export function glow() {
  const [c, x] = cv(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { rng, vnoise, hex };

const idle = () => new Promise((r) => setTimeout(r, 0));
/** Builds every texture one at a time, yielding to the browser in between so the page stays responsive. */
export async function makeTextures(low) {
  setQuality(low);
  const out = {};
  const steps = [
    ['bump', () => clayBump()], ['blob', blob], ['floor', floorTiles], ['wall', wall], ['marble', marble],
    ['domeBr', () => bricks([188, 86, 50])], ['inBr', () => bricks([150, 62, 34])], ['ringBr', () => bricks([204, 104, 62])],
    ['wood', () => wood()], ['sauce', sauce],
  ];
  for (const [k, fn] of steps) { out[k] = fn(); await idle(); }
  return out;
}
