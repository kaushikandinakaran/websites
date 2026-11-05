// Olive & Sea - the terrace. Real Poly Haven assets (CC0) carry the realism: furniture, ceramics, lemons, a plant,
// terracotta tiles and plaster, lit by a real Venice sunset HDRI. Built in code: the walls, the laid table
// (plates, glasses, candle, linen, cutlery, olives), the string lights and the dusk sky grade.
// All units are metres. The terrace looks toward local -Z (the sun and the sea).
import * as THREE from 'three';

const PH = '../../assets/polyhaven/';
export const ASSETS = {
  // venice_sunset (CC0), prefiltered offline into three's CubeUV layout (see assets/CREDITS.txt)
  env256: 'assets/env-venice-sunset-pmrem256.hdr',
  env128: 'assets/env-venice-sunset-pmrem128.hdr',
  floor: PH + 'textures/brown_floor_tiles/brown_floor_tiles_',
  plaster: PH + 'textures/beige_wall_001/beige_wall_001_',
  set: PH + 'models/outdoor_table_chair_set_01/outdoor_table_chair_set_01_1k.gltf',
  chair: PH + 'models/painted_wooden_chair_01/painted_wooden_chair_01_1k.gltf',
  plant: PH + 'models/potted_plant_02/potted_plant_02_1k.gltf',
  jug: PH + 'models/ceramic_vase_04/ceramic_vase_04_1k.gltf',
  vase: PH + 'models/ceramic_vase_01/ceramic_vase_01_1k.gltf',
  lemon: PH + 'models/lemon/lemon_1k.gltf',
  lime: PH + 'models/food_lime_01/food_lime_01_1k.gltf',
};

// Sun in the HDRI: column u = 0.5996 of the equirect, 3.5 degrees above the horizon.
export const SUN_U = 0.5996;
// three maps an equirect column u to the world direction (cos p, 0, sin p) with p = (u - 0.5) * 2 PI.
const SUN_PHI = (SUN_U - 0.5) * Math.PI * 2;
export const SUN_AZ = new THREE.Vector3(Math.cos(SUN_PHI), 0, Math.sin(SUN_PHI)).normalize();
// the terrace group turns so that its local -Z points at the sun
export const WORLD_ROT = Math.atan2(-SUN_AZ.x, -SUN_AZ.z);

const V2 = THREE.Vector2;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

/* ------------------------------------------------------------------ small helpers */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb, rep) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}
// height canvas -> tangent-space normal map (tileable)
function normalFromHeight(hc, strength) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x - 1, y) - H(x + 1, y)) * strength, dy = (H(x, y - 1) - H(x, y + 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}
// linen weave: fine threads in both directions
function linenMaps() {
  const n = 128, hc = canvas(n, n), g = hc.getContext('2d', { willReadFrequently: true }), img = g.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = Math.sin((x / n) * Math.PI * 2 * 32) * 0.5 + 0.5, b = Math.sin((y / n) * Math.PI * 2 * 32) * 0.5 + 0.5;
    const v = ((x >> 2) + (y >> 2)) % 2 ? a : b;
    const k = 100 + v * 70 + (rand() - 0.5) * 30, i = (y * n + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(normalFromHeight(hc, 1.6), false);
}
// painted planks or louvres for the blue door and shutters
function paintedWoodMaps(w, h, slats, horizontal) {
  const hc = canvas(w, h), g = hc.getContext('2d', { willReadFrequently: true }), cc = canvas(w, h), c2 = cc.getContext('2d');
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
  c2.fillStyle = '#2d6796'; c2.fillRect(0, 0, w, h);
  const L = horizontal ? h : w, step = L / slats;
  for (let k = 0; k < slats; k++) {
    const a = k * step;
    // each slat: a soft bevel and a dark groove; louvres tilt (gradient across the slat)
    const gr = horizontal ? g.createLinearGradient(0, a, 0, a + step) : g.createLinearGradient(a, 0, a + step, 0);
    gr.addColorStop(0, '#3a3a3a'); gr.addColorStop(0.08, '#9a9a9a'); gr.addColorStop(horizontal ? 0.85 : 0.5, horizontal ? '#c8c8c8' : '#a0a0a0'); gr.addColorStop(0.94, '#8a8a8a'); gr.addColorStop(1, '#303030');
    g.fillStyle = gr;
    if (horizontal) g.fillRect(0, a, w, step); else g.fillRect(a, 0, step, h);
    const tone = 0.92 + rand() * 0.12;
    c2.fillStyle = `rgba(${Math.round(42 * tone)},${Math.round(98 * tone)},${Math.round(146 * tone)},1)`;
    if (horizontal) c2.fillRect(0, a + 1, w, step - 2); else c2.fillRect(a + 1, 0, step - 2, h);
    c2.fillStyle = 'rgba(10,20,30,.55)';
    if (horizontal) c2.fillRect(0, a + step - 1.5, w, 1.5); else c2.fillRect(a + step - 1.5, 0, 1.5, h);
  }
  // grain and worn paint
  for (let i = 0; i < (w * h) / 160; i++) {
    const x = rand() * w, y = rand() * h, len = 6 + rand() * 30;
    c2.fillStyle = `rgba(${rand() < 0.5 ? '230,225,210' : '20,40,60'},${0.04 + rand() * 0.08})`;
    if (horizontal) c2.fillRect(x, y, len, 1); else c2.fillRect(x, y, 1, len);
  }
  for (let i = 0; i < 24; i++) { // chipped paint patches show pale wood
    const x = rand() * w, y = rand() * h, r = 1 + rand() * 4;
    c2.fillStyle = 'rgba(196,176,140,.7)'; c2.beginPath(); c2.ellipse(x, y, r * 1.8, r, 0, 0, 7); c2.fill();
  }
  return { map: tex(cc, true), normalMap: tex(normalFromHeight(hc, 3.0), false) };
}
// box with UVs in world units (u,v = metres / size), so a tiled texture keeps its scale on every face
function worldBox(w, h, d, size) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (nx > 0.5) uv.setXY(i, z / size, y / size);
    else if (ny > 0.5) uv.setXY(i, x / size, z / size);
    else uv.setXY(i, x / size, y / size);
  }
  return g;
}
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new V2(r, y)), seg);
// vertex colours by profile index (glaze bands on plates and bowls)
function bandColors(geo, nPts, colorAt) {
  const count = geo.attributes.position.count, col = new Float32Array(count * 3), c = new THREE.Color();
  for (let i = 0; i < count; i++) { colorAt(i % nPts, c); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function blobTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function glowTexture() {
  const c = canvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ dusk grade (GLSL), shared by the sky dome */
export const DUSK_GLSL = /* glsl */`
uniform float uDusk; uniform float uNight; uniform vec3 uSunDir;
vec3 duskTint(vec3 d) {
  vec3 sd = normalize(uSunDir);
  vec3 sh = normalize(vec3(sd.x, 0.0, sd.z));
  float h = d.y;
  float hy = abs(h);                         // the sea mirrors the sky
  vec3 dh = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
  float toward = max(dot(dh, sh), 0.0);
  toward *= toward;
  vec3 top = vec3(0.12, 0.16, 0.36);
  vec3 band = mix(vec3(0.46, 0.33, 0.48), vec3(1.0, 0.5, 0.28), toward);
  float bw = exp(-hy * 7.0);
  vec3 dusk = mix(top, band, bw);
  // the sun has set: divide out a model of the (blurred) sun glow so no hot spot or dark ring is left
  float ang = acos(clamp(dot(d, sd), -1.0, 1.0));
  float glow = 300.0 * exp(-ang * ang / 0.0009) + 22.0 * exp(-ang * ang / 0.004) + 2.5 * exp(-ang * ang / 0.03) + 0.5 * exp(-ang * ang / 0.2);
  dusk /= 1.0 + glow;
  if (h < 0.0) dusk *= vec3(0.55, 0.6, 0.72);// darker water
  vec3 golden = mix(vec3(0.97, 0.88, 0.74), vec3(0.92, 0.9, 0.95), smoothstep(0.05, 0.6, hy)); // warm haze low, clear high
  vec3 t = mix(golden, dusk, uDusk);
  return t * mix(1.0, 0.42, uNight);
}`;

/* ------------------------------------------------------------------ the world */
export function createWorld(ctx) {
  const { tier, maxAniso } = ctx;
  const hi = tier === 'high', low = tier === 'low';
  const group = new THREE.Group();
  group.rotation.y = WORLD_ROT;
  const mats = new Set(); // every lit material, for the dusk env scale
  const track = (m) => { if (m && (m.isMeshStandardMaterial)) { m.userData.env0 = m.envMapIntensity ?? 1; mats.add(m); } return m; };
  const shadowy = (o, cast = true, recv = true) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = cast && !low; c.receiveShadow = recv && !low; } }); return o; };

  const blobTex = blobTexture();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: low ? 0.55 : 0.38, color: 0x2a1408, polygonOffset: true, polygonOffsetFactor: -2 });
  function blob(x, y, z, sx, sz, op) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), op != null ? blobMat.clone() : blobMat);
    if (op != null) m.material.opacity = op;
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.002, z); m.scale.set(sx, sz, 1); m.renderOrder = 1;
    group.add(m); return m;
  }

  /* ---------- materials that wait for their textures */
  const floorMat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(1.3, 0.86, 0.62), roughness: 0.85 }));
  const plasterMat = track(new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.92 }));
  const capMat = track(new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.88 }));

  /* ---------- floor: terracotta tiles */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 14), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0.6, 0, 1.5);
  floor.receiveShadow = !low;
  group.add(floor);

  /* ---------- whitewashed walls: front and right parapet, the house on the left */
  const P = 1.6; // plaster texture covers 1.6 m
  const parapet = new THREE.Mesh(worldBox(9.9, 0.95, 0.34, P), plasterMat); parapet.position.set(0.7, 0.475, -4.58);
  const parapetR = new THREE.Mesh(worldBox(0.34, 0.95, 13.2, P), plasterMat); parapetR.position.set(5.48, 0.475, 1.9);
  const cap = new THREE.Mesh(worldBox(9.9, 0.07, 0.44, P), capMat); cap.position.set(0.7, 0.985, -4.58);
  const capR = new THREE.Mesh(worldBox(0.44, 0.07, 13.2, P), capMat); capR.position.set(5.48, 0.985, 1.9);
  const house = new THREE.Mesh(worldBox(0.5, 3.4, 13.4, P), plasterMat); house.position.set(-4.45, 1.7, 1.95);
  const cornice = new THREE.Mesh(worldBox(0.68, 0.12, 13.4, P), capMat); cornice.position.set(-4.36, 3.42, 1.95);
  const plinth = new THREE.Mesh(worldBox(0.06, 0.18, 13.4, P), track(new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.9 }))); plinth.position.set(-4.18, 0.09, 1.95);
  [parapet, parapetR, cap, capR, house, cornice, plinth].forEach((m) => { m.castShadow = !low; m.receiveShadow = !low; group.add(m); });

  /* ---------- blue door and louvred shutters on the house wall (face at x = -4.2) */
  const doorMaps = paintedWoodMaps(128, 256, 7, false);
  const shutterMaps = paintedWoodMaps(128, 256, 22, true);
  const doorMat = track(new THREE.MeshStandardMaterial({ map: doorMaps.map, normalMap: doorMaps.normalMap, roughness: 0.62 }));
  const shutterMat = track(new THREE.MeshStandardMaterial({ map: shutterMaps.map, normalMap: shutterMaps.normalMap, roughness: 0.6 }));
  const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x245b86, roughness: 0.55 }));
  const recessMat = track(new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.9 }));
  function addOpening(z, y0, w, h, kind) {
    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), recessMat); recess.position.set(-4.195, y0 + h / 2, z); group.add(recess);
    const fT = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, w + 0.14), frameMat); fT.position.set(-4.17, y0 + h + 0.035, z);
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.07, h + 0.07, 0.07), frameMat); fL.position.set(-4.17, y0 + h / 2, z - w / 2 - 0.035);
    const fR = fL.clone(); fR.position.z = z + w / 2 + 0.035;
    [fT, fL, fR].forEach((m) => { m.castShadow = !low; group.add(m); });
    if (kind === 'door') {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, w), doorMat); leaf.position.set(-4.19, y0 + h / 2, z); leaf.receiveShadow = !low; group.add(leaf);
      const step = new THREE.Mesh(worldBox(0.34, 0.08, w + 0.4, P), capMat); step.position.set(-4.05, 0.04, z); step.receiveShadow = !low; step.castShadow = !low; group.add(step);
    } else {
      const sill = new THREE.Mesh(worldBox(0.16, 0.05, w + 0.22, P), capMat); sill.position.set(-4.13, y0 - 0.025, z); sill.castShadow = !low; group.add(sill);
      // two shutter leaves, the far one half open
      const lw = w / 2;
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, lw), shutterMat); a.position.set(-4.17, y0 + h / 2, z - lw / 2); group.add(a);
      const hinge = new THREE.Group(); hinge.position.set(-4.17, y0 + h / 2, z + w / 2 + 0.03); hinge.rotation.y = -1.25;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, lw), shutterMat); b.position.set(0, 0, -lw / 2); hinge.add(b); group.add(hinge);
      [a, b].forEach((m) => { m.castShadow = !low; m.receiveShadow = !low; });
    }
  }
  addOpening(1.1, 0, 1.0, 2.15, 'door');
  addOpening(-2.1, 1.05, 1.0, 1.25, 'window');
  addOpening(3.9, 1.05, 1.0, 1.25, 'window');

  /* ---------- linen, ceramics, glass, metal (built in code) */
  const linenNormal = linenMaps(); linenNormal.anisotropy = maxAniso;
  const linenMat = track(new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.92, normalMap: linenNormal, normalScale: new V2(0.6, 0.6), side: THREE.DoubleSide }));
  linenNormal.repeat.set(3, 3);
  const glazeMat = track(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: low ? 0 : 0.7, clearcoatRoughness: 0.12 }));
  // clear glass without a transmission pass: black body, additive blend, so only reflections and highlights show
  const glassMat = track(new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const silverMat = track(new THREE.MeshStandardMaterial({ color: 0xd8d6d2, metalness: 1, roughness: 0.22 }));
  const waxMat = track(new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.55, emissive: 0xff8a3a, emissiveIntensity: 0 }));
  const woodPostMat = track(new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.75 }));
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.6 }); track(wireMat);

  const PLATE = [[0, 0.004], [0.07, 0.004], [0.075, 0], [0.085, 0], [0.09, 0.005], [0.11, 0.012], [0.127, 0.02], [0.132, 0.022], [0.131, 0.025], [0.126, 0.024], [0.108, 0.016], [0.09, 0.0115], [0.075, 0.0098], [0, 0.0098]];
  const plateGeo = bandColors(lathe(PLATE, 72), PLATE.length, (j, c) => {
    if (j >= 6 && j <= 9) c.setRGB(0.06, 0.2, 0.46); else if (j === 5 || j === 10) c.setRGB(0.86, 0.85, 0.82); else c.setRGB(0.9, 0.89, 0.86);
  });
  const BOWL = [[0, 0], [0.058, 0], [0.064, 0.004], [0.062, 0.009], [0.088, 0.021], [0.122, 0.045], [0.146, 0.066], [0.151, 0.071], [0.147, 0.073], [0.141, 0.067], [0.117, 0.046], [0.08, 0.024], [0.04, 0.016], [0, 0.014]];
  const bowlGeo = bandColors(lathe(BOWL, 72), BOWL.length, (j, c) => {
    if (j <= 5) c.setRGB(0.5, 0.2, 0.1); else if (j <= 8) c.setRGB(0.05, 0.16, 0.4); else c.setRGB(0.86, 0.8, 0.66);
  });
  const SMALL = [[0, 0], [0.03, 0], [0.033, 0.003], [0.05, 0.016], [0.06, 0.03], [0.062, 0.033], [0.058, 0.032], [0.048, 0.02], [0.03, 0.009], [0, 0.007]];
  const smallBowlGeo = bandColors(lathe(SMALL, 48), SMALL.length, (j, c) => { if (j === 4 || j === 5 || j === 6) c.setRGB(0.06, 0.2, 0.46); else c.setRGB(0.9, 0.88, 0.84); });
  const GOUT = [[0, 0], [0.036, 0], [0.037, 0.002], [0.032, 0.004], [0.006, 0.008], [0.0035, 0.015], [0.003, 0.085], [0.006, 0.095], [0.02, 0.105], [0.036, 0.125], [0.043, 0.15], [0.042, 0.178], [0.036, 0.204]];
  const GIN = GOUT.slice(7).map(([r, y]) => [Math.max(0.001, r - 0.0016), y + 0.001]).reverse();
  const glassGeo = lathe(GOUT.concat(GIN, [[0, 0.096]]), 48);
  const HURR = [[0, 0], [0.046, 0], [0.047, 0.004], [0.046, 0.15], [0.044, 0.152], [0.0445, 0.006], [0, 0.006]];
  const hurricaneGeo = lathe(HURR, 48);
  const RB = ctx.RoundedBoxGeometry;
  const knifeGeo = RB ? new RB(0.016, 0.004, 0.21, 2, 0.002) : new THREE.BoxGeometry(0.016, 0.004, 0.21);
  const forkGeo = RB ? new RB(0.021, 0.004, 0.19, 2, 0.002) : new THREE.BoxGeometry(0.021, 0.004, 0.19);
  const napkinGeo = RB ? new RB(0.11, 0.007, 0.17, 2, 0.0025) : new THREE.BoxGeometry(0.11, 0.007, 0.17);

  function runnerGeo(len, w, half, drop) { // a linen runner lying across the table, ends falling over the edges
    const seg = 60, g = new THREE.PlaneGeometry(len + drop * 2, w, seg, 1); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), ax = Math.abs(x);
      if (ax > half) { const k = ax - half, r = 0.012; const ang = Math.min(k / r, Math.PI / 2); const xx = half + Math.sin(ang) * r + Math.max(0, k - r * Math.PI / 2) * 0.06; const yy = -(1 - Math.cos(ang)) * r - Math.max(0, k - r * Math.PI / 2); p.setXYZ(i, Math.sign(x) * xx, yy, p.getZ(i)); }
    }
    g.computeVertexNormals();
    return g;
  }

  /* ---------- table anchors (filled when the furniture arrives) */
  const TOP = 0.726; // table-top height of the Poly Haven folding table
  const tableA = new THREE.Group(); tableA.position.set(0.55, 0, -2.75); tableA.rotation.y = 0.12; group.add(tableA); // dinner
  const tableB = new THREE.Group(); tableB.position.set(-1.85, 0, -0.25); tableB.rotation.y = 0.42; group.add(tableB); // lemons
  const tableC = new THREE.Group(); tableC.position.set(2.05, 0, 2.75); tableC.rotation.y = -0.25; group.add(tableC);

  // the laid table (procedural, present from the start)
  const laid = new THREE.Group(); laid.position.y = TOP; tableA.add(laid);
  const runner = new THREE.Mesh(runnerGeo(0.66, 0.3, 0.335, 0.07), linenMat); runner.position.y = 0.0015; runner.receiveShadow = !low; laid.add(runner);
  [-1, 1].forEach((s) => {
    const plate = new THREE.Mesh(plateGeo, glazeMat); plate.position.set(s * 0.18, 0.004, 0); plate.castShadow = !low; plate.receiveShadow = !low; laid.add(plate);
    const nap = new THREE.Mesh(napkinGeo, linenMat); nap.position.set(s * 0.18, 0.014, 0); nap.rotation.y = s * 0.5 + 0.1; nap.scale.set(0.8, 1, 0.7); nap.castShadow = !low; laid.add(nap);
    const knife = new THREE.Mesh(knifeGeo, silverMat); knife.position.set(s * 0.18, 0.005, s * 0.15); knife.rotation.y = Math.PI / 2; knife.castShadow = !low; laid.add(knife);
    const fork = new THREE.Mesh(forkGeo, silverMat); fork.position.set(s * 0.18, 0.005, -s * 0.15); fork.rotation.y = Math.PI / 2; fork.castShadow = !low; laid.add(fork);
    const glass = new THREE.Mesh(glassGeo, glassMat); glass.position.set(s * 0.1, 0, -s * 0.2); glass.renderOrder = 3; laid.add(glass);
  });
  const smallBowl = new THREE.Mesh(smallBowlGeo, glazeMat); smallBowl.position.set(-0.02, 0.0015, -0.13); smallBowl.castShadow = !low; laid.add(smallBowl);
  // olives (instanced, glossy)
  const oliveGeo = new THREE.SphereGeometry(1, 14, 10); oliveGeo.scale(0.0105, 0.0105, 0.0145);
  const oliveMat = track(new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: low ? 0 : 1, clearcoatRoughness: 0.18 }));
  const olives = new THREE.InstancedMesh(oliveGeo, oliveMat, 14);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color();
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = i < 9 ? 0.03 * Math.sqrt((i + 0.5) / 9) : 0.016 * Math.sqrt(i - 8);
    const y = i < 9 ? 0.017 + 0.003 * (1 - r / 0.03) : 0.031;
    e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * r - 0.02, y, Math.sin(a) * r - 0.13), q, new THREE.Vector3(1, 1, 1));
    olives.setMatrixAt(i, m4);
    olives.setColorAt(i, rand() < 0.6 ? cc.setRGB(0.05, 0.03, 0.04) : cc.setRGB(0.2, 0.22, 0.06));
  }
  olives.castShadow = !low; laid.add(olives);
  // candle in a glass hurricane
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.075, 28), waxMat); candle.position.set(0.0, 0.0435, 0.12); laid.add(candle);
  const hurricane = new THREE.Mesh(hurricaneGeo, glassMat); hurricane.position.set(0, 0, 0.12); hurricane.renderOrder = 3; laid.add(hurricane);
  const flameMat = new THREE.SpriteMaterial({ map: flameTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = new THREE.Sprite(flameMat); flame.position.set(0, 0.096, 0.12); flame.scale.set(0.012, 0.03, 1); laid.add(flame);
  const candleLight = new THREE.PointLight(0xff9a4a, 0, 3.5, 2); candleLight.position.set(0, 0.12, 0.12); laid.add(candleLight);

  // the lemons table: a glazed bowl waiting for the fruit
  const lemonsAt = new THREE.Group(); lemonsAt.position.set(0.02, TOP, 0.02); tableB.add(lemonsAt);
  const bowl = new THREE.Mesh(bowlGeo, glazeMat); bowl.castShadow = !low; bowl.receiveShadow = !low; lemonsAt.add(bowl);
  const glassB = new THREE.Mesh(glassGeo, glassMat); glassB.position.set(-0.2, 0, 0.12); glassB.renderOrder = 3; lemonsAt.add(glassB);
  // table C keeps a single glass and napkin
  const cAt = new THREE.Group(); cAt.position.y = TOP; tableC.add(cAt);
  const glassC = new THREE.Mesh(glassGeo, glassMat); glassC.position.set(0.12, 0, -0.08); glassC.renderOrder = 3; cAt.add(glassC);
  const nap3 = new THREE.Mesh(napkinGeo, linenMat); nap3.position.set(-0.1, 0.007, 0.06); nap3.rotation.y = -0.4; cAt.add(nap3);

  /* ---------- string lights over the terrace */
  const strands = [];
  const zs = [-3.85, -1.45, 1.05, 3.55];
  zs.forEach((z, k) => strands.push({ a: new THREE.Vector3(-4.12, 2.98, z), b: new THREE.Vector3(5.42, 2.78, z + 0.7), sag: 0.42 + 0.05 * (k % 2) }));
  const at = (s, st, out) => out.copy(st.a).lerp(st.b, s).add(new THREE.Vector3(0, -st.sag * 4 * s * (1 - s), 0));
  const wires = [];
  const bulbs = [];
  const tmp = new THREE.Vector3();
  strands.forEach((st, k) => {
    const z = zs[k];
    const pts = []; for (let i = 0; i <= 40; i++) pts.push(at(i / 40, st, new THREE.Vector3()));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.005, 5, false), wireMat); wires.push(tube); group.add(tube);
    const len = st.a.distanceTo(st.b), n = Math.floor(len / 0.5);
    for (let i = 1; i < n; i++) {
      at(i / n, st, tmp);
      // lights come on strand by strand, from the house outward to the sea wall
      bulbs.push({ p: tmp.clone(), th: 2.98 + k * 0.055 + (i / n) * 0.07 + rand() * 0.02, on: 0 });
    }
    // a post on the parapet for each strand
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.86, 10), woodPostMat); post.position.set(5.42, 1.02 + 0.93, z + 0.7); post.castShadow = !low; group.add(post);
  });
  const NB = bulbs.length;
  const socketGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.07, 8); socketGeo.translate(0, -0.035, 0);
  const sockets = new THREE.InstancedMesh(socketGeo, wireMat, NB);
  const bulbGeo = new THREE.SphereGeometry(0.026, 14, 10); bulbGeo.translate(0, -0.095, 0);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  const bulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, NB);
  const glowGeo = new THREE.BufferGeometry();
  const gpos = new Float32Array(NB * 3), gon = new Float32Array(NB);
  bulbs.forEach((b, i) => {
    m4.makeTranslation(b.p.x, b.p.y, b.p.z);
    sockets.setMatrixAt(i, m4); bulbMesh.setMatrixAt(i, m4);
    bulbMesh.setColorAt(i, cc.setRGB(0.32, 0.3, 0.27));
    gpos.set([b.p.x, b.p.y - 0.095, b.p.z], i * 3);
  });
  glowGeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  const glowAttr = new THREE.BufferAttribute(gon, 1); glowAttr.setUsage(THREE.DynamicDrawUsage); glowGeo.setAttribute('aOn', glowAttr);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: glowTexture() }, uScale: { value: 400 }, uSize: { value: 0.34 }, uColor: { value: new THREE.Color(1.0, 0.72, 0.38) } },
    vertexShader: /* glsl */`attribute float aOn; varying float vOn; uniform float uScale; uniform float uSize;
      void main(){ vOn = aOn; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aOn > 0.001 ? uSize * uScale / -mv.z : 0.0; }`,
    fragmentShader: /* glsl */`uniform sampler2D uMap; uniform vec3 uColor; varying float vOn;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a * vOn; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glows = new THREE.Points(glowGeo, glowMat); glows.frustumCulled = false; glows.renderOrder = 5;
  group.add(sockets, bulbMesh, glows);

  // real light from the strings: a few warm point lights (never added or removed later: shader keys stay stable)
  const nPL = hi ? 3 : low ? 1 : 2;
  const PL = [[0.6, 2.45, -2.6], [-1.8, 2.5, -0.2], [2.6, 2.45, 1.3]].slice(0, nPL).map(([x, y, z]) => { const l = new THREE.PointLight(0xffb165, 0, 7, 2); l.position.set(x, y, z); group.add(l); return l; });

  /* ---------- blob shadows (contact grounding the shadow map misses; the only shadows on phones) */
  const blobs = [];
  blobs.push(blob(0.55, 0, -2.75, 1.1, 1.1, low ? 0.5 : 0.3), blob(-1.85, 0, -0.25, 1.6, 1.6, low ? 0.5 : 0.3), blob(2.05, 0, 2.75, 1.6, 1.6, low ? 0.5 : 0.3));

  /* ---------- asset placement (called as each asset arrives) */
  const placed = {};
  function prepGLTF(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { track(m); ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => { if (m[k]) m[k].anisotropy = maxAniso; }); });
    });
    return shadowy(root);
  }
  // material set-up a late prop needs before its programs are compiled (idempotent; the add* calls repeat it)
  function prep(gltfScene, key) {
    prepGLTF(gltfScene);
    if (key === 'plant') gltfScene.traverse((o) => { if (o.isMesh && o.material.alphaTest > 0) o.material.alphaTest = 0.5; });
    return gltfScene;
  }
  function addSet(gltfScene, full) {
    const src = prepGLTF(gltfScene);
    const table = src.getObjectByName('outdoor_table_chair_set_01_table');
    // the model's table is off-centre: centre it on its group origin
    const off = new THREE.Vector3(0.08, 0, -0.071);
    [tableB, tableC].forEach((g, i) => {
      const s = src.clone(true); s.position.copy(off); g.add(s);
      if (i === 1) s.rotation.y = 0.0;
    });
    if (full) { const s = src.clone(true); s.position.copy(off); tableA.add(s); } // phones: no extra chair download
    else if (table) { const t = table.clone(true); t.position.copy(off); tableA.add(t); }
    placed.set = true;
  }
  function addChairs(gltfScene) {
    const src = prepGLTF(gltfScene);
    src.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.setRGB(0.2, 0.42, 0.68); track(o.material); } });
    const c1 = src.clone(true); c1.position.set(0.56, 0, 0.04); c1.rotation.y = -Math.PI / 2 + 0.12; tableA.add(c1);
    const c2 = src.clone(true); c2.position.set(-0.6, 0, -0.06); c2.rotation.y = Math.PI / 2 - 0.2; tableA.add(c2);
    placed.chair = true;
  }
  function addPlant(gltfScene) {
    const src = prepGLTF(gltfScene);
    src.traverse((o) => { if (o.isMesh && o.material.alphaTest > 0) { o.material.alphaTest = 0.5; } });
    const p1 = src.clone(true); p1.position.set(-3.72, 0, -3.95); p1.rotation.y = 0.6; p1.scale.setScalar(1.45); group.add(p1);
    const p2 = src.clone(true); p2.position.set(-3.82, 0, 2.2); p2.rotation.y = 2.2; p2.scale.setScalar(1.15); group.add(p2);
    blobs.push(blob(-3.72, 0, -3.95, 1.1, 1.1, 0.4), blob(-3.82, 0, 2.2, 0.9, 0.9, 0.4));
    placed.plant = true;
  }
  function addJug(gltfScene) {
    const src = prepGLTF(gltfScene);
    const j1 = src.clone(true); j1.position.set(-0.2, 0, -0.26); j1.rotation.y = 2.4; lemonsAt.add(j1);
    const j3 = src.clone(true); j3.position.set(-2.6, 1.02, -4.55); j3.rotation.y = 1.0; j3.scale.setScalar(1.3); group.add(j3);
    placed.jug = true;
  }
  function addVase(gltfScene) {
    const src = prepGLTF(gltfScene);
    const v1 = src.clone(true); v1.position.set(2.15, 1.02, -4.55); v1.rotation.y = 0.4; v1.scale.setScalar(1.25); group.add(v1);
    const v2 = src.clone(true); v2.position.set(5.48, 1.02, -2.2); v2.rotation.y = -1.1; group.add(v2);
    placed.vase = true;
  }
  // lemons lying in the bowl and on the table (the lemon model stands on its long Y axis, centred at its middle)
  const LEMONS = [
    [0.045, 0.052, 0.022, 1.5, 0.3, 0.2], [-0.046, 0.054, 0.034, 1.45, 2.1, -0.2], [0.004, 0.05, -0.05, 1.62, -0.8, 0.1],
    [0.01, 0.094, 0.006, 1.3, 1.0, 0.4], [0.2, 0.036, -0.06, 1.57, 2.6, 0.0],
  ];
  function addLemons(gltfScene) {
    const src = prepGLTF(gltfScene);
    LEMONS.forEach(([x, y, z, rz, ry, rx]) => {
      const l = src.clone(true); l.position.set(x, y, z); l.rotation.set(rx, ry, rz, 'YXZ'); lemonsAt.add(l);
    });
    const l2 = src.clone(true); l2.position.set(0.12, 0.036, -0.12); l2.rotation.set(0, 0.6, 1.57, 'YXZ'); laid.add(l2);
    placed.lemon = true;
  }
  function addLimes(gltfScene) {
    const src = prepGLTF(gltfScene);
    const a = src.clone(true); a.position.set(-0.035, 0.075, -0.035); a.rotation.set(0.5, 0.4, 0.9); lemonsAt.add(a);
    const b = src.clone(true); b.position.set(0.15, 0, 0.02); b.rotation.set(0, 1.4, 0); lemonsAt.add(b);
    placed.lime = true;
  }

  function applyFloor(t) { // { map, normalMap, arm }
    const rep = [13 / 1.8, 14 / 1.8];
    Object.values(t).forEach((x) => { if (!x) return; x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(rep[0], rep[1]); x.anisotropy = maxAniso; });
    if (t.map) { t.map.colorSpace = THREE.SRGBColorSpace; floorMat.map = t.map; }
    if (t.normalMap) floorMat.normalMap = t.normalMap;
    if (t.arm) { floorMat.aoMap = t.arm; floorMat.roughnessMap = t.arm; floorMat.metalnessMap = t.arm; floorMat.roughness = 1; floorMat.metalness = 1; floorMat.aoMapIntensity = 0.8; }
    floorMat.needsUpdate = true;
  }
  function applyPlaster(t) {
    [plasterMat, capMat].forEach((m) => {
      if (t.map) { m.map = t.map; m.color.set(0xffffff); }
      if (t.normalMap) { m.normalMap = t.normalMap; m.normalScale = new V2(1.2, 1.2); }
      if (t.arm) { m.roughnessMap = t.arm; m.roughness = 1; m.aoMap = t.arm; m.aoMapIntensity = 0.6; }
      m.needsUpdate = true;
    });
    Object.values(t).forEach((x) => { if (!x) return; x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = maxAniso; });
  }

  /* ---------- per-frame state */
  const onC = new THREE.Color();
  let lastLights = -1;
  function update(s) { // s: { t, dusk, lightsT, time, flicker, envScale }
    // string lights: each bulb fades on at its own threshold, with a short warm-up flicker
    let sum = 0, changed = false;
    for (let i = 0; i < NB; i++) {
      const b = bulbs[i];
      let on = THREE.MathUtils.smoothstep(s.t, b.th, b.th + 0.03);
      if (on > 0 && on < 1 && s.flicker) on *= 0.75 + 0.25 * Math.sin(s.time * 37 + i * 3.1);
      sum += on;
      if (Math.abs(on - b.on) > 0.002) { b.on = on; changed = true; }
    }
    if (changed || lastLights < 0) {
      for (let i = 0; i < NB; i++) {
        const on = bulbs[i].on;
        bulbMesh.setColorAt(i, onC.setRGB(lerp(0.32, 5.5, on), lerp(0.3, 2.9, on), lerp(0.27, 0.95, on)));
        gon[i] = on;
      }
      bulbMesh.instanceColor.needsUpdate = true; glowAttr.needsUpdate = true;
    }
    lastLights = sum / NB;
    const L = lastLights;
    PL.forEach((l) => { l.intensity = 2.6 * L; });
    const fl = s.flicker ? 1 + 0.08 * Math.sin(s.time * 13.3) + 0.05 * Math.sin(s.time * 27.1 + 1.3) + 0.03 * Math.sin(s.time * 51.7) : 1;
    candleLight.intensity = lerp(0.05, 0.55, s.dusk) * fl;
    flame.scale.set(0.012, 0.03 * (0.94 + 0.06 * fl), 1);
    flameMat.opacity = lerp(0.6, 1, s.dusk);
    waxMat.emissiveIntensity = 0.12 * s.dusk * fl;
    mats.forEach((m) => { m.envMapIntensity = m.userData.env0 * s.envScale; });
    glowMat.uniforms.uScale.value = s.pxScale;
  }

  return {
    group, mats, bulbs, update, track,
    applyFloor, applyPlaster, prep, addSet, addChairs, addPlant, addJug, addVase, addLemons, addLimes, placed,
    lightsLevel: () => lastLights,
    worldBox,
  };
}

function flameTexture() {
  const c = canvas(32, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 44, 1, 16, 40, 30);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.25, 'rgba(255,214,140,.95)'); gr.addColorStop(0.55, 'rgba(255,140,50,.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(16, 2); g.bezierCurveTo(30, 30, 28, 60, 16, 62); g.bezierCurveTo(4, 60, 2, 30, 16, 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
