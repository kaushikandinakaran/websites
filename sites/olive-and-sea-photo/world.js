// Olive & Sea (photo edition) - the places and the props.
// The scenery is real 360-degree photographs (Poly Haven, CC0). Each photographed place gets its own three.js
// scene: the photo on a ground-projected sphere (the photo's floor becomes a real plane at y = 0, the photo's
// camera sits at y = eye), its own image-based light (baked offline from the same place's HDR), one key light
// set to the photo's brightest light direction, real scanned props, and shadow catchers.
// Units are metres. Directions follow three's equirect convention: column u of the photo looks along
// (cos p, 0, sin p) with p = (u - 0.5) * 2 PI.
import * as THREE from 'three';

const PH = '../../assets/polyhaven/';
export const MODELS = {
  set: PH + 'models/outdoor_table_chair_set_01/outdoor_table_chair_set_01_1k.gltf',
  jug: PH + 'models/ceramic_vase_04/ceramic_vase_04_1k.gltf',
  vase: PH + 'models/ceramic_vase_01/ceramic_vase_01_1k.gltf',
  lemon: PH + 'models/lemon/lemon_1k.gltf',
  lime: PH + 'models/food_lime_01/food_lime_01_1k.gltf',
};

export const uDir = (u, elDeg = 0, out = new THREE.Vector3()) => {
  const p = (u - 0.5) * Math.PI * 2, e = THREE.MathUtils.degToRad(elDeg);
  return out.set(Math.cos(p) * Math.cos(e), Math.sin(e), Math.sin(p) * Math.cos(e));
};

// eye: camera height of the photograph; R: radius of the projection sphere (where the floor meets the "walls");
// key: the photo's main light (u, elevation, colour, intensity, shadow softness); envI: image light strength;
// grade: per-place white balance applied to the whole frame (photo and props together).
export const PLACES = [
  { // a covered wooden deck by the sea, midday: light pours in from the open sides
    key: 'deck',
    pano: { hi: 'assets/pano-sundowner-deck-6k.jpg', lo: 'assets/pano-sundowner-deck-4k.jpg' }, // power socket painted out
    env: 'assets/env-sundowner-deck-pmrem128.hdr',
    eye: 1.3, R: 9,
    light: { u: 0.33, el: 16, color: 0xfff0dc, i: 0.9, soft: 14 },
    envI: 0.9, wood: { desat: 0.82, tint: [0.62, 0.64, 0.68] }, // weathered grey to match the deck's own furniture
    shadow: 0x15120f, shadowO: 0.6,
    grade: [1.0, 0.99, 0.97],
  },
  { // golden hour on a stone waterfront, the sun about to touch the sea
    key: 'venice',
    pano: { hi: 'assets/pano-venice-sunset-6k.jpg', lo: PH + 'pano/venice_sunset/venice_sunset_4k.jpg' },
    env: 'assets/env-venice-sunset-pmrem128.hdr',
    eye: 1.62, R: 60,
    light: { u: 0.5996, el: 3.4, color: 0xffb46e, i: 5.0, soft: 3 },
    rim: { el: 24, color: 0xffb070, i: 2.6 }, // the low sun skimming the tops of things from behind
    envI: 0.2, wood: { desat: 0.45, tint: [0.85, 0.78, 0.72] },
    bounce: [0x5d6c90, 0x8a6a52, 0.35], // cool sky fill toward the camera, a little warm stone bounce
    shadow: 0x1a2236, shadowO: 0.62,
    grade: [1.0, 1.0, 1.0],
  },
  { // after sunset on a sea-front promenade
    key: 'fire',
    pano: { hi: 'assets/pano-sky-on-fire-6k.jpg', lo: PH + 'pano/the_sky_is_on_fire/the_sky_is_on_fire_4k.jpg' },
    env: null,
    eye: 1.6, R: 60,
    light: null,
    envI: 0,
    grade: [1.0, 1.0, 1.0],
  },
];

/* ------------------------------------------------------------------ the photo as the world */
// A big inward-facing sphere. Each fragment's view ray is intersected with the floor plane (y = 0) and the
// projection sphere around the photo's camera point, then the photo is sampled in the direction of that hit
// from the photo's camera point: the floor stays a floor when the camera moves a little.
// The photo is a finished, display-referred image; the final pass applies a film shoulder to everything
// (linear up to 0.6, then a soft exponential roll-off to white), so the photo is written here through the
// inverse of that curve and comes out exactly as photographed, while the 3D props get a camera-like roll-off.
export function makePanoMesh() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null }, eye: { value: 1.6 }, R: { value: 30 },
      uFocus: { value: 3 }, uBlur: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float eye, R, uFocus, uBlur; varying vec3 vW;
      void main(){
        vec3 C = cameraPosition, d = normalize(vW - C), O = vec3(0.0, eye, 0.0);
        vec3 oc = C - O; float b = dot(oc, d); float c = dot(oc, oc) - R * R;
        float t = -b + sqrt(max(b * b - c, 0.0));
        if (d.y < -1e-4) t = min(t, -C.y / d.y);
        vec3 dir = normalize(C + d * t - O);
        vec2 uv = vec2(atan(dir.z, dir.x) * 0.15915494 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        dx.x -= floor(dx.x + 0.5); dy.x -= floor(dy.x + 0.5); // no mip seam where u wraps
        float k = 1.0 + uBlur * smoothstep(uFocus * 1.25, uFocus * 4.0, t);
        vec3 L = textureGrad(map, uv, dx * k, dy * k).rgb;
        L = min(L, vec3(0.996));
        vec3 X = mix(L, 0.6 - 0.4 * log(1.0 - (L - 0.6) / 0.4), step(0.6, L)); // inverse of the final film shoulder
        gl_FragColor = vec4(X, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), mat);
  m.renderOrder = -100; m.frustumCulled = false;
  return m;
}

/* ------------------------------------------------------------------ shadows that sit in the photo */
let blobTex = null;
function getBlobTex() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
// soft ambient-occlusion pool under an object (the contact darkening real photos always have)
function blob(w, d, o, color = 0x000000) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
    color, map: getBlobTex(), transparent: true, opacity: o, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
function catcher(w, d, color, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ color, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.renderOrder = 2;
  return m;
}

/* ------------------------------------------------------------------ weathered wood */
// the scanned teak is warm and saturated; repaint its colour map toward the photo's weathered, cooler wood
function weather(tex, { desat, tint }) {
  const img = tex.image; if (!img || !img.width) return tex;
  const n = Math.min(1024, img.width), c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
  const id = g.getImageData(0, 0, n, n), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    d[i] = Math.min(255, (l + (d[i] - l) * (1 - desat)) * tint[0]);
    d[i + 1] = Math.min(255, (l + (d[i + 1] - l) * (1 - desat)) * tint[1]);
    d[i + 2] = Math.min(255, (l + (d[i + 2] - l) * (1 - desat)) * tint[2]);
  }
  g.putImageData(id, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.flipY = tex.flipY; out.colorSpace = THREE.SRGBColorSpace; out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  out.anisotropy = tex.anisotropy; out.channel = tex.channel;
  return out;
}

/* ------------------------------------------------------------------ a place */
export function makePlace(def, { tier, maxAniso }) {
  const low = tier === 'low';
  const scene = new THREE.Scene();
  const pano = makePanoMesh();
  pano.material.uniforms.eye.value = def.eye; pano.material.uniforms.R.value = def.R;
  scene.add(pano);
  const props = new THREE.Group(); scene.add(props);
  let sun = null;
  if (def.light) {
    sun = new THREE.DirectionalLight(def.light.color, def.light.i);
    sun.castShadow = !low;
    if (!low) {
      const sz = tier === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(sz, sz);
      Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 30 });
      sun.shadow.radius = def.light.soft; sun.shadow.blurSamples = 16; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    }
    scene.add(sun, sun.target);
  }
  if (def.rim) { const r = new THREE.DirectionalLight(def.rim.color, def.rim.i); r.position.copy(uDir(def.light.u, def.rim.el)).multiplyScalar(10); scene.add(r); }
  if (def.bounce) scene.add(new THREE.HemisphereLight(def.bounce[0], def.bounce[1], def.bounce[2]));
  const place = { def, scene, pano, props, sun, tex: null, glt: null, gen: 0, envTex: null, ready: false, loading: null, want: false, blob: null, propsAdded: false, shadowDirty: true, fade: 1 };

  const prepModel = (root, envI) => {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !low; o.receiveShadow = false;
      const m = o.material = o.material.clone();
      m.envMapIntensity = envI;
      m.transparent = true; m.depthWrite = true; // so the dissolve can fade props without a program switch
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; });
    });
    return root;
  };
  // the table: the model's table is off-centre; centre it on the group origin
  const OFF = new THREE.Vector3(0.08, 0, -0.071), TOP = 0.726;
  function addTableSet(M, at, { chairs, rotY }) {
    const g = new THREE.Group(); g.position.copy(at); g.rotation.y = rotY;
    if (M.set) {
      const s = prepModel(M.set.clone(true), def.envI); s.position.copy(OFF);
      if (!chairs) ['outdoor_table_chair_set_01_chair_01', 'outdoor_table_chair_set_01_chair_02'].forEach((n) => { const c = s.getObjectByName(n); if (c) c.visible = false; });
      s.traverse((o) => { if (o.isMesh) { o.receiveShadow = !low; if (def.wood && o.material.map) o.material.map = weather(o.material.map, def.wood); } });
      g.add(s);
    }
    g.add(blob(chairs ? 2.0 : 1.25, chairs ? 2.0 : 1.25, low ? 0.55 : 0.42));
    const top = new THREE.Group(); top.position.y = TOP; g.add(top);
    return { g, top };
  }
  // citrus peel is waxy, not wet: a rougher floor under the scanned roughness, and a contact pool under each fruit
  const matte = (root, min) => root.traverse((o) => { if (o.isMesh) { o.material.roughness = 1; o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
 roughnessFactor = max(roughnessFactor, ${min.toFixed(2)});`); }; o.material.customProgramCacheKey = () => 'matte' + min; } }) || root;
  function lemonsOn(M, top, list) {
    if (!M.lemon) return;
    const src = matte(prepModel(M.lemon.clone(true), def.envI * 1.2), 0.62);
    list.forEach(([x, z, ry, rx]) => { const l = src.clone(true); l.position.set(x, 0.034, z); l.rotation.set(rx || 0, ry, Math.PI / 2, 'YXZ'); top.add(l); const b = blob(0.13, 0.1, 0.55); b.position.set(x, 0.0015, z); b.rotation.z = ry; top.add(b); });
  }
  function limesOn(M, top, list) {
    if (!M.lime) return;
    const src = prepModel(M.lime.clone(true), def.envI * 1.1); matte(src, 0.6);
    list.forEach(([x, z, ry, tilt]) => { const l = src.clone(true); l.position.set(x, tilt ? 0.03 : 0, z); l.rotation.set(tilt || 0, ry, tilt ? 1.5 : 0); top.add(l); const b = blob(0.1, 0.1, 0.55); b.position.set(x, 0.0015, z); top.add(b); });
  }
  function ceramic(M, key, parent, x, z, ry, s = 1) {
    if (!M[key]) return;
    const v = prepModel(M[key].clone(true), def.envI); v.position.set(x, 0, z); v.rotation.y = ry; v.scale.setScalar(s); parent.add(v);
    const b = blob(0.3 * s, 0.3 * s, 0.6); b.position.set(x, 0.0012, z); parent.add(b);
  }

  // props arrive as one prepared group per place (built off-scene, compiled, then added)
  place.buildProps = (M) => {
    const out = new THREE.Group();
    let focus = null;
    if (def.key === 'deck') {
      // a small table set on the deck, close to the camera, the open side and the sea behind it
      const at = uDir(0.365, 0).multiplyScalar(1.15);
      const { g, top } = addTableSet(M, at, { chairs: false, rotY: 0.5 });
      ceramic(M, 'jug', g, -0.5, 0.18, 2.2); // the jug stands on the deck beside the table
      lemonsOn(M, top, [[0.02, 0.06, 0.3], [0.1, 0.1, 2.1, 0.2], [-0.05, 0.14, -0.8], [0.13, -0.01, 1.2, -0.15]]);
      limesOn(M, top, [[-0.1, 0.03, 0.4], [0.06, 0.19, 1.4, 0.4]]);
      out.add(g); focus = at.clone().setY(TOP);
      if (low) { // phones draw no shadow maps: a baked soft shadow cast away from the open side
        const away = uDir(def.light.u + 0.5, 0), L = 1.4;
        const sh = blob(0.9, L, 0.32, def.shadow); sh.position.copy(at).addScaledVector(away, L / 2 - 0.25).setY(0.001);
        sh.rotation.set(-Math.PI / 2, 0, Math.atan2(away.x, away.z)); out.add(sh);
      }
      if (sun) {
        const c = catcher(4, 4, def.shadow, def.shadowO); c.position.set(at.x, 0.002, at.z); out.add(c);
        sun.target.position.copy(at); sun.position.copy(at).add(uDir(def.light.u, def.light.el).multiplyScalar(10));
      }
    } else if (def.key === 'venice') {
      // a table laid at the water's edge, the low sun behind it
      const at = uDir(0.5, 0).multiplyScalar(1.8);
      const { g, top } = addTableSet(M, at, { chairs: true, rotY: 0.9 });
      ceramic(M, 'jug', top, 0.08, -0.1, 1.1);
      lemonsOn(M, top, [[0.06, 0.05, 0.6], [0.13, 0.1, 2.4, 0.2], [0.02, 0.13, -0.5]]);
      limesOn(M, top, [[-0.05, 0.12, 0.2]]);
      ceramic(M, 'vase', top, -0.2, -0.16, 2.4, 0.55);
      out.add(g); focus = at.clone().setY(TOP);
      if (low) { // no shadow maps on phones: a baked long shadow running from the table away from the sun
        const away = uDir(def.light.u + 0.5, 0), L = 3.2;
        const sh = blob(0.75, L, 0.4, def.shadow); sh.position.copy(at).addScaledVector(away, L / 2 - 0.2).setY(0.001);
        sh.rotation.set(-Math.PI / 2, 0, Math.atan2(away.x, away.z)); out.add(sh);
      }
      if (sun) {
        const c = catcher(8, 8, def.shadow, def.shadowO); c.position.set(at.x, 0.002, at.z); out.add(c);
        sun.target.position.copy(at); sun.position.copy(at).add(uDir(def.light.u, def.light.el).multiplyScalar(14));
        // a long, low sun: widen the shadow box toward the camera
        Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 1.4, bottom: -1.4, near: 1, far: 40 });
        sun.shadow.camera.updateProjectionMatrix();
      }
    }
    place.focus = focus;
    return out;
  };
  return place;
}
