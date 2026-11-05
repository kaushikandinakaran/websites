/* World: sky, street, the sushi stall, torii, noren, lanterns, blossom trees, moon.
   Everything is procedural. Art direction: night, glossy lacquer toy. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export function rng(seed) { // mulberry32: same scene every load
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* Give the event loop a turn so scroll, menu and the pause button keep answering during the build. */
export const yieldTask = () => new Promise((r) => {
  if (window.scheduler && typeof window.scheduler.yield === 'function') window.scheduler.yield().then(r);
  else setTimeout(r, 0);
});

/* Bake a finished, static group into one mesh per material (many meshes -> a few draw calls).
   Only plain meshes: instanced meshes must not be passed in (they would lose their instances). */
const KEEP = new Set(['position', 'normal', 'uv']);
export function mergeStatic(obj) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const by = new Map();
  obj.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    Object.keys(g.attributes).forEach((k) => { if (!KEEP.has(k)) g.deleteAttribute(k); });
    g.clearGroups();
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  obj.clear();
  by.forEach((gs, mat) => {
    const m = new THREE.Mesh(mergeGeometries(gs), mat);
    if (mat.transparent) m.renderOrder = 2; // contact-shadow blobs
    obj.add(m);
    gs.forEach((g) => g.dispose());
  });
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

export function woodTex(base, grain, seed = 3, w = 512, h = 256) {
  const R = rng(seed);
  return canvasTex(w, h, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const y = R() * h;
      g.strokeStyle = `rgba(${grain},${(R() * 0.2 + 0.05).toFixed(2)})`; g.lineWidth = R() * 2.2 + 0.4;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (R() - 0.5) * 1.5);
      g.stroke();
    }
  });
}

export function radialTex(stops, size = 128) {
  return canvasTex(size, size, (g) => {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, c]) => r.addColorStop(o, c));
    g.fillStyle = r; g.fillRect(0, 0, size, size);
  });
}

/* Warm reflections for the lacquer: a tiny emissive "room" baked once with PMREM. */
export function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x07040a);
  const add = (hex, k, w, h, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  add(0xffb36b, 7, 7, 1.6, [0, 6, 2]);
  add(0xffb36b, 5, 7, 1.6, [0, 6, -4]);
  add(0xff5a36, 4, 3, 3, [-6, 2, 0]);
  add(0xffd9a0, 3, 8, 1, [0, 3, -7]);
  add(0x7f90ff, 1.1, 7, 7, [6, 6, -6]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  s.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt; // caller owns it: keep to dispose, and rebuild after a context restore
}

/* Layout constants shared with food.js and the camera path. */
export const L = {
  counterX: 0, counterTop: 1.05, zStart: 3.2, zEnd: -28,
  stallCX: 0.35, stallHalf: 3.2, stallFront: 4.0,
  toriiZ: 9.5,
  moon: new THREE.Vector3(7, 17, -76),
};

export async function buildWorld({ tier = 2 } = {}) {
  const group = new THREE.Group();
  const lowEnd = tier < 2;
  const zLen = L.zStart - L.zEnd;
  const zMid = (L.zStart + L.zEnd) / 2;

  /* ----- Materials ----- */
  const lite = tier === 0; // phones: standard materials instead of clearcoat physical
  const PM = (o) => {
    if (!lite) return new THREE.MeshPhysicalMaterial(o);
    const { clearcoat, clearcoatRoughness, ...rest } = o;
    return new THREE.MeshStandardMaterial(rest);
  };
  const lacquer = PM({ color: 0x120a0c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4 });
  const shu = PM({ color: 0xc8321b, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2, emissive: 0x240602 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b45a, roughness: 0.32, metalness: 0.9, envMapIntensity: 1.6 });
  const hinokiTex = woodTex('#d4b68a', '110,70,35', 7);
  hinokiTex.wrapS = hinokiTex.wrapT = THREE.RepeatWrapping; hinokiTex.repeat.set(1, 9);
  // a 0.12 clearcoat on matte wood never read on screen: plain standard material (one shader fewer)
  const hinoki = new THREE.MeshStandardMaterial({ map: hinokiTex, roughness: 0.55, envMapIntensity: 0.6, color: 0xb8a890 });
  const floorTex = woodTex('#2a1a12', '10,5,2', 9);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 12);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0xb0a098, roughness: 0.7, envMapIntensity: 0.12 });

  await yieldTask();

  /* ----- Sky dome ----- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x070516) }, mid: { value: new THREE.Color(0x1a0f2c) }, hor: { value: new THREE.Color(0x2c1224) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: ['uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;','void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.22,h)); c = mix(c, top, smoothstep(0.18,0.75,h)); gl_FragColor = vec4(c,1.0);','#include <tonemapping_fragment>','#include <colorspace_fragment>','}'].join('\n'),
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  group.add(sky);

  /* ----- Stars ----- */
  const R = rng(11);
  const starN = lowEnd ? 160 : 380;
  const sp = new Float32Array(starN * 3), ssz = new Float32Array(starN), sph = new Float32Array(starN);
  for (let i = 0; i < starN; i++) {
    const a = R() * Math.PI * 2, e = 0.12 + R() * 1.2, r = 380;
    sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    ssz[i] = 1.2 + R() * 2.2; sph[i] = R() * 6.28;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(ssz, 1));
  starGeo.setAttribute('aPh', new THREE.BufferAttribute(sph, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    vertexShader: 'attribute float aSize; attribute float aPh; uniform float uT; uniform float uPx; varying float vA; void main(){ vA = 0.55 + 0.45*sin(uT*1.3+aPh); gl_PointSize = aSize*uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(vec3(1.0,0.93,0.85)*a, a); }',
  });
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; stars.renderOrder = -9;
  group.add(stars);

  /* ----- Moon + halo ----- */
  const moonTex = canvasTex(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w * 0.42, h * 0.4, 8, w / 2, h / 2, w / 2);
    r.addColorStop(0, '#fffaf0'); r.addColorStop(1, '#eed9b2');
    g.fillStyle = r; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 6.2832); g.fill();
    const Rm = rng(5);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(190,160,120,${(0.06 + Rm() * 0.08).toFixed(2)})`; g.beginPath(); g.arc(w * (0.25 + Rm() * 0.5), h * (0.25 + Rm() * 0.5), 10 + Rm() * 26, 0, 6.2832); g.fill(); }
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.5, 1.42, 1.25), fog: false, transparent: true, depthWrite: false }));
  moon.position.copy(L.moon); moon.renderOrder = -7;
  const haloTex = radialTex([[0, 'rgba(205,214,255,.5)'], [0.2, 'rgba(190,200,255,.28)'], [0.5, 'rgba(180,195,255,.09)'], [1, 'rgba(180,195,255,0)']], 512);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(L.moon).add(new THREE.Vector3(0, 0, -0.5)); halo.renderOrder = -8;
  group.add(moon, halo);

  /* ----- Ground ----- */
  const stoneTex = canvasTex(256, 256, (g, w, h) => {
    const Rs = rng(21);
    g.fillStyle = '#1d1519'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 18 + Rs() * 14;
      g.fillStyle = `rgb(${v + 8},${v + 2},${v + 6})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }, { repeat: [70, 70] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.04 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -30);
  group.add(ground);

  /* ----- Stall: floor, counter, wall, roof ----- */
  const stall = new THREE.Group(); group.add(stall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.3, zLen + 0.8), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(L.stallCX, 0.03, zMid); stall.add(floor);

  const topTex = hinokiTex;
  const counterTop = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.08, zLen, 3, 0.025), hinoki);
  counterTop.position.set(0, 1.01, zMid); stall.add(counterTop);
  const counterBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.97, zLen), lacquer);
  counterBody.position.set(0, 0.485, zMid); stall.add(counterBody);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, zLen), shu);
  band.position.set(0.505, 0.8, zMid); stall.add(band);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, zLen), gold);
  kick.position.set(0.505, 0.06, zMid); stall.add(kick);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, zLen), gold);
  inlay.position.set(0.502, 0.94, zMid); stall.add(inlay);

  // Back wall: wainscot + glowing shoji + bottle shelf
  const wallX = -2.78;
  const wain = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, zLen + 0.8), lacquer);
  wain.position.set(wallX, 0.45, zMid); stall.add(wain);
  const shojiTex = canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9a46a'); gr.addColorStop(0.5, '#ffd8a0'); gr.addColorStop(1, '#f0b878');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a140c'; g.lineWidth = 5;
    g.strokeRect(2, 2, w - 4, h - 4);
    g.lineWidth = 3;
    [h / 3, (2 * h) / 3].forEach((y) => { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  }, { repeat: [zLen / 1.15, 1] });
  const shoji = new THREE.Mesh(new THREE.PlaneGeometry(zLen + 0.8, 2.1), new THREE.MeshBasicMaterial({ map: shojiTex, color: new THREE.Color(0.62, 0.47, 0.34) }));
  shoji.rotation.y = Math.PI / 2; shoji.position.set(wallX + 0.06, 1.95, zMid); stall.add(shoji);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, zLen), lacquer);
  shelf.position.set(-2.58, 1.12, zMid); stall.add(shelf);

  const bottleProfile = [[0, 0], [0.05, 0], [0.056, 0.02], [0.056, 0.2], [0.04, 0.27], [0.019, 0.31], [0.019, 0.38], [0.024, 0.39], [0, 0.39]].map(([r, y]) => new THREE.Vector2(r, y));
  const bottleN = lowEnd ? 16 : 28;
  const bottles = new THREE.InstancedMesh(new THREE.LatheGeometry(bottleProfile, 14), PM({ color: 0xffffff, roughness: 0.15, clearcoat: 1, envMapIntensity: 1.6 }), bottleN);
  const bR = rng(33), bc = [0x0d0a0b, 0x112a1c, 0x2a0f10, 0xc8321b, 0x0d0a0b], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < bottleN; i++) {
    const z = L.zStart - 0.4 - (i / bottleN) * (zLen - 0.8) - bR() * 0.3;
    const k = 0.85 + bR() * 0.35;
    m4.compose(v3.set(-2.58, 1.145, z), q, sc.set(k, k * (0.9 + bR() * 0.3), k));
    bottles.setMatrixAt(i, m4); bottles.setColorAt(i, new THREE.Color(bc[i % bc.length]));
  }
  stall.add(bottles);

  // Roof, fascia, rafters, posts
  const roofW = L.stallHalf * 2 + 0.2;
  const roofLen = L.stallFront - L.zEnd + 0.3, roofZ = (L.stallFront + L.zEnd) / 2 + 0.15;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.24, roofLen), lacquer);
  roof.position.set(L.stallCX, 3.03, roofZ); stall.add(roof);
  const fasciaF = new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.1, 0.2, 0.08), shu); fasciaF.position.set(L.stallCX, 2.86, L.stallFront + 0.08); stall.add(fasciaF);
  [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, roofLen), shu); f.position.set(L.stallCX + s * (roofW / 2), 2.86, roofZ); stall.add(f); });
  const gold2 = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.02, 0.02), gold); gold2.position.set(L.stallCX, 2.755, L.stallFront + 0.12); stall.add(gold2);
  const rafG = new THREE.BoxGeometry(roofW - 0.2, 0.1, 0.13);
  const rafN = 11;
  const rafters = new THREE.InstancedMesh(rafG, lacquer, rafN);
  for (let i = 0; i < rafN; i++) { m4.compose(v3.set(L.stallCX, 2.85, 1.8 - i * 2.7), q, sc.set(1, 1, 1)); rafters.setMatrixAt(i, m4); }
  stall.add(rafters);
  const postG = new THREE.CylinderGeometry(0.075, 0.085, 2.9, 12);
  [[L.stallCX - L.stallHalf + 0.1, L.stallFront], [L.stallCX + L.stallHalf - 0.1, L.stallFront], [L.stallCX + L.stallHalf - 0.1, L.zEnd + 0.4], [L.stallCX + L.stallHalf - 0.1, -12]].forEach(([x, z]) => {
    const p = new THREE.Mesh(postG, lacquer); p.position.set(x, 1.45, z); stall.add(p);
  });

  // Stools (instanced)
  const stoolN = Math.floor(zLen / 2.35);
  const seatG = new THREE.CylinderGeometry(0.2, 0.19, 0.07, 20);
  const seats = new THREE.InstancedMesh(seatG, shu, stoolN);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 8), gold, stoolN);
  const bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16), lacquer, stoolN);
  for (let i = 0; i < stoolN; i++) {
    const z = 1.6 - i * 2.35;
    seats.setMatrixAt(i, m4.compose(v3.set(1.4, 0.66, z), q, sc.set(1, 1, 1)));
    stems.setMatrixAt(i, m4.compose(v3.set(1.4, 0.33, z), q, sc.set(1, 1, 1)));
    bases.setMatrixAt(i, m4.compose(v3.set(1.4, 0.03, z), q, sc.set(1, 1, 1)));
  }
  stall.add(seats, stems, bases);

  await yieldTask();

  /* ----- Torii + noren ----- */
  const torii = new THREE.Group(); group.add(torii);
  const tz = L.toriiZ, tcx = L.stallCX;
  const postGeo = new THREE.CylinderGeometry(0.17, 0.21, 4.7, 20);
  [-2.6, 2.6].forEach((dx) => {
    const p = new THREE.Mesh(postGeo, shu); p.position.set(tcx + dx, 2.35, tz); torii.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.32, 20), lacquer); b.position.set(tcx + dx, 0.16, tz); torii.add(b);
  });
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.28, 0.46), lacquer); kasagi.position.set(tcx, 5.0, tz); torii.add(kasagi);
  [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.28, 0.46), lacquer); e.position.set(tcx + s * 3.15, 5.13, tz); e.rotation.z = s * 0.1; torii.add(e); });
  const shima = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.14, 0.4), shu); shima.position.set(tcx, 4.78, tz); torii.add(shima);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.22, 0.24), shu); nuki.position.set(tcx, 3.95, tz); torii.add(nuki);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.14), lacquer); plaque.position.set(tcx, 4.4, tz); torii.add(plaque);
  const plaqueTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.54, 0.16), gold); plaqueTrim.position.set(tcx, 4.4, tz - 0.005); plaqueTrim.scale.set(1, 1, 0.9); torii.add(plaqueTrim);
  const plaqueIn = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.17), lacquer); plaqueIn.position.set(tcx, 4.4, tz - 0.005); torii.add(plaqueIn);

  // Noren: six cloth panels, split in the middle, that sweep aside as the camera arrives.
  const norenTex = canvasTex(256, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9c2515'); gr.addColorStop(1, '#c8321b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(246,236,216,.96)'; // five-petal blossom mark
    const cx = w / 2, cy = h * 0.5;
    for (let i = 0; i < 5; i++) {
      g.save(); g.translate(cx, cy); g.rotate((i * 2 * Math.PI) / 5);
      g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(30, -30, 26, -78, 7, -92); g.lineTo(0, -80); g.lineTo(-7, -92); g.bezierCurveTo(-26, -78, -30, -30, 0, -4); g.fill(); g.restore();
    }
    g.fillStyle = '#c8321b'; g.beginPath(); g.arc(cx, cy, 9, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 10, w, 10);
  });
  const norenPlain = canvasTex(256, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9c2515'); gr.addColorStop(1, '#c8321b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.14)'; for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 10, w, 10);
  });
  const norenN = 6, nW = 0.97, nH = 1.28;
  const norenMats = [new THREE.MeshStandardMaterial({ map: norenTex, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x3a0a04, emissiveMap: norenTex, emissiveIntensity: 0.55 }),
    new THREE.MeshStandardMaterial({ map: norenPlain, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x3a0a04, emissiveMap: norenPlain, emissiveIntensity: 0.55 })];
  const nors = [];
  const hang = new THREE.Group(); hang.position.set(0, 0, L.stallFront + 0.02); stall.add(hang);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, roofW - 0.4, 8), gold); rod.rotation.z = Math.PI / 2; rod.position.set(L.stallCX, 2.8, 0); hang.add(rod);
  for (let i = 0; i < norenN; i++) {
    const geo = new THREE.PlaneGeometry(nW, nH, 6, 8); geo.translate(0, -nH / 2, 0);
    // Two centre panels carry the blossom mark; the rest are plain cloth.
    const mark = i === 2 || i === 3;
    const mesh = new THREE.Mesh(geo, norenMats[mark ? 0 : 1]);
    const x0 = L.stallCX + (i - (norenN - 1) / 2) * (nW + 0.02);
    mesh.position.set(x0, 2.78, 0);
    // The blossom is split across two panels: shift UVs so each shows half.
    if (mark) { const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.5 + (i === 3 ? 0.5 : 0)); }
    hang.add(mesh);
    nors.push({ mesh, x0, base: geo.attributes.position.array.slice(), side: x0 < L.stallCX ? -1 : 1, i });
  }

  // Static pieces of the stall and the torii: one mesh per material instead of ~35 meshes.
  const fixed = new THREE.Group();
  stall.children.filter((o) => o.isMesh && !o.isInstancedMesh).forEach((o) => fixed.add(o));
  stall.add(fixed); mergeStatic(fixed);
  mergeStatic(torii);
  await yieldTask();

  /* ----- Lanterns (instanced, ignite as the camera approaches) ----- */
  const lanternProfile = [[0.07, 0.0], [0.17, 0.02], [0.245, 0.11], [0.275, 0.26], [0.245, 0.41], [0.17, 0.5], [0.07, 0.52]].map(([r, y]) => new THREE.Vector2(r, y));
  const ribTex = canvasTex(32, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(70,10,0,.55)';
    for (let i = 0; i <= 14; i++) g.fillRect(0, (i / 14) * h - 1.5, w, 3);
  });
  const lanternDefs = [];
  // street lanterns on poles (always lit)
  [[-3.5, 11.8], [-3.5, 6.6], [5.2, 11.8], [5.2, 6.6]].forEach(([x, z]) => lanternDefs.push({ p: [x, 2.7, z], s: 1.35, c: 'shu', always: true, pole: true }));
  // lanterns under the torii flanking the way in
  lanternDefs.push({ p: [L.stallCX - 1.9, 3.3, L.toriiZ], s: 1.0, c: 'shu', always: true, hang: 3.84 });
  lanternDefs.push({ p: [L.stallCX + 1.9, 3.3, L.toriiZ], s: 1.0, c: 'shu', always: true, hang: 3.84 });
  // lantern path leading out to the garden and the moon
  [[-3.6, -35], [3.8, -35], [-3.6, -42], [3.8, -42], [-3.6, -50], [3.8, -50]].forEach(([x, z]) => lanternDefs.push({ p: [x, 2.5, z], s: 1.3, c: 'gold', always: true, pole: true }));
  // row inside the stall
  const rowN = Math.floor(zLen / 2.7);
  for (let i = 0; i < rowN; i++) lanternDefs.push({ p: [0.85, 2.33, 1.8 - i * 2.7], s: 0.9, c: i % 3 === 1 ? 'gold' : 'shu', always: false });
  const lanN = lanternDefs.length;
  const lanBody = new THREE.InstancedMesh(new THREE.LatheGeometry(lanternProfile, 20), new THREE.MeshBasicMaterial({ map: ribTex, color: 0xffffff, side: THREE.DoubleSide }), lanN);
  const capG = new THREE.CylinderGeometry(0.075, 0.075, 0.045, 12);
  const lanCapT = new THREE.InstancedMesh(capG, lacquer, lanN), lanCapB = new THREE.InstancedMesh(capG, lacquer, lanN);
  const cordPts = [];
  const poleGeos = [];
  lanternDefs.forEach((d, i) => {
    const [x, y, z] = d.p; const s = d.s;
    // body hangs with its bottom at (y - 0.26*s*?)... centre height = 0.26*s
    m4.compose(v3.set(x, y - 0.26 * s, z), q, sc.set(s, s, s)); lanBody.setMatrixAt(i, m4);
    m4.compose(v3.set(x, y + 0.282 * s, z), q, sc.set(s, s, s)); lanCapT.setMatrixAt(i, m4);
    m4.compose(v3.set(x, y - 0.282 * s, z), q, sc.set(s, s, s)); lanCapB.setMatrixAt(i, m4);
    d.center = new THREE.Vector3(x, y - 0.0, z);
    d.ph = i * 1.7;
    const topY = y + 0.31 * s;
    if (d.pole) { // pole + arm
      const off = x < 0 ? -0.62 : 0.62, px = x + off;
      const pole = new THREE.CylinderGeometry(0.05, 0.065, y + 0.8, 8); pole.translate(px, (y + 0.8) / 2, z); poleGeos.push(pole);
      const arm = new THREE.BoxGeometry(Math.abs(off) + 0.06, 0.05, 0.05); arm.translate(x + off / 2, y + 0.55, z); poleGeos.push(arm);
      cordPts.push(x, y + 0.55, z, x, topY, z);
    } else {
      cordPts.push(x, topY, z, x, d.hang || 2.9, z);
    }
  });
  group.add(lanBody, lanCapT, lanCapB);
  const poles = new THREE.Mesh(mergeGeometries(poleGeos), lacquer); group.add(poles);
  const cordGeo = new THREE.BufferGeometry(); cordGeo.setAttribute('position', new THREE.Float32BufferAttribute(cordPts, 3));
  group.add(new THREE.LineSegments(cordGeo, new THREE.LineBasicMaterial({ color: 0x24110f })));
  lanBody.frustumCulled = false;
  const lanColors = { shu: new THREE.Color(1.0, 0.2, 0.08), gold: new THREE.Color(0.9, 0.42, 0.1) };

  // Halo billboards (additive glow, one instanced draw)
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {},
    vertexShader: 'varying vec2 vUv; varying vec3 vCol; void main(){ vUv = uv; vCol = instanceColor; float sz = length(instanceMatrix[0].xyz); vec4 c = modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0); gl_Position = projectionMatrix*(c + vec4(position.xy*sz,0.0,0.0)); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vCol; void main(){ float d = length(vUv-0.5)*2.0; float a = exp(-d*d*4.0)*0.9 + exp(-d*d*14.0)*0.6; gl_FragColor = vec4(vCol*a, a); }',
  });
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), haloMat, lanN);
  halos.frustumCulled = false; halos.renderOrder = 5;
  group.add(halos);

  // Light pools on floor and street
  const poolTex = radialTex([[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']], 128);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), lanN);
  pools.frustumCulled = false; pools.renderOrder = 1;
  lanternDefs.forEach((d, i) => {
    const r = d.pole ? 5.5 : 3.4;
    m4.compose(v3.set(d.center.x, d.pole ? 0.025 : 0.06, d.center.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), sc.set(r, r, 1));
    pools.setMatrixAt(i, m4);
  });
  group.add(pools);
  const tmpC = new THREE.Color();

  await yieldTask();

  /* ----- Blossom trees (instanced blobs, toy low-poly) ----- */
  const treeSpots = [[-8, 12, 1.1], [9.5, 8, 1.0], [-9.5, -4, 1.2], [11, -12, 1.1], [-10, -22, 1.0], [14, -30, 1.2], [-13, -44, 1.3], [14, -50, 1.2], [-15, -34, 1.4], [15, -22, 1.3], [-13, 24, 1.2], [14, 21, 1.2], [-12, -66, 1.6], [-14, -8, 1.0], [-13.5, -36, 1.3], [13, -42, 1.2], [-16, -52, 1.5], [18, -58, 1.4]];
  const blobPer = lowEnd ? 14 : 24;
  const blobs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.7, emissive: 0xd8708f, emissiveIntensity: 0.34 }), treeSpots.length * blobPer);
  const trunkG = (() => {
    const parts = [];
    const t = new THREE.CylinderGeometry(0.22, 0.42, 5.6, 7); t.translate(0, 2.8, 0); parts.push(t);
    [[1.4, 5.2, 0.4, 0.9], [-1.5, 5.6, -0.2, -0.9], [0.2, 5.9, 1.5, 0.3]].forEach(([x, y, z, r]) => {
      const b = new THREE.CylinderGeometry(0.08, 0.2, 2.4, 6); b.rotateZ(-r); b.rotateY(z); b.translate(x * 0.55, y - 0.3, z * 0.45); parts.push(b);
    });
    return mergeGeometries(parts);
  })();
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x1a0f10, roughness: 0.9 }), treeSpots.length);
  const Rt = rng(77), palette = [0xf7b8c8, 0xffd0da, 0xee9bb2, 0xffe6ea, 0xf9c2cf].map((h) => new THREE.Color(h));
  treeSpots.forEach(([x, z, s], ti) => {
    const ry = Rt() * 6.28;
    trunks.setMatrixAt(ti, m4.compose(v3.set(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), sc.set(s, s, s)));
    for (let b = 0; b < blobPer; b++) {
      const a = Rt() * 6.28, rr = Math.sqrt(Rt()) * 3.2 * s;
      const bx = x + Math.cos(a) * rr, bz = z + Math.sin(a) * rr, by = (6.1 + (Rt() - 0.3) * 2.0) * s;
      const k = (0.9 + Rt() * 1.0) * s;
      blobs.setMatrixAt(ti * blobPer + b, m4.compose(v3.set(bx, by, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Rt() * 3, Rt() * 3, 0)), sc.set(k, k * 0.8, k)));
      blobs.setColorAt(ti * blobPer + b, palette[(Rt() * palette.length) | 0]);
    }
  });
  group.add(trunks, blobs);

  /* ----- Update ----- */
  const camZ = { v: 15 };
  function update(st) {
    const t = st.t, u = st.u;
    camZ.v = st.camPos.z;
    // sky follows the camera so it never parallaxes
    sky.position.copy(st.camPos); stars.position.copy(st.camPos);
    starMat.uniforms.uT.value = t; starMat.uniforms.uPx.value = st.pixelRatio;
    // noren sweeps aside
    const part = ss(0.1, 0.62, u);
    for (const n of nors) {
      const outer = L.stallCX + n.side * (roofW / 2 - 0.25);
      const x = lerp(n.x0, outer + (n.x0 - outer) * 0.16, part);
      n.mesh.position.x = x;
      n.mesh.scale.x = lerp(1, 0.2, part);
      // gentle sway of the hem, stronger when the camera is pushing through
      const arr = n.mesh.geometry.attributes.position.array;
      const amp = 0.035 + (1 - Math.abs(part - 0.5) * 2) * 0.09;
      for (let k = 0; k < arr.length; k += 3) {
        const s = clamp01(-n.base[k + 1] / nH);
        arr[k + 2] = n.base[k + 2] + Math.sin(t * 1.5 + n.base[k] * 2.2 + n.i) * amp * s * s + Math.sin(n.base[k + 1] * 5 + n.i) * 0.02 * part;
      }
      n.mesh.geometry.attributes.position.needsUpdate = true;
    }
    // lantern ignition: row lights up ahead of the camera
    for (let i = 0; i < lanN; i++) {
      const d = lanternDefs[i];
      let lit = 1;
      if (!d.always) { const ahead = Math.max(0, st.camPos.z - d.center.z); lit = 1 - ss(13, 19, ahead); if (st.reduce) lit = Math.max(lit, 0); }
      const fl = 1 + Math.sin(t * 3.1 + d.ph) * 0.04 + Math.sin(t * 7.3 + d.ph * 2.0) * 0.025;
      const k = 0.08 + lit * 1.05 * fl;
      tmpC.copy(lanColors[d.c]).multiplyScalar(k);
      lanBody.setColorAt(i, tmpC);
      tmpC.copy(lanColors[d.c]).multiplyScalar(lit * 0.34 * fl * (d.pole ? 1.1 : 1));
      halos.setColorAt(i, tmpC);
      const hs = (d.pole ? 3.0 : 2.0) * (0.6 + 0.4 * lit);
      m4.compose(v3.copy(d.center), q, sc.set(hs, hs, hs));
      halos.setMatrixAt(i, m4);
      tmpC.copy(lanColors[d.c]).multiplyScalar(lit * 0.3);
      pools.setColorAt(i, tmpC);
    }
    lanBody.instanceColor.needsUpdate = true; halos.instanceColor.needsUpdate = true; halos.instanceMatrix.needsUpdate = true; pools.instanceColor.needsUpdate = true;
  }

  return { group, update, lanternCenters: lanternDefs.map((d) => d.center) };
}
