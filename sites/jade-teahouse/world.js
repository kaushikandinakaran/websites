// Jade Teahouse - the procedural parts of the tea room: room shell, moon window with bamboo beyond,
// paper lanterns, the bamboo steamer and dumplings, steam, the tea stream and the tea in the cup.
// Real Poly Haven models (screen, table, tea set, chandelier, vase) are loaded in scene.js.
import * as THREE from 'three';

const { clamp, smoothstep } = THREE.MathUtils;
export const ROOM = { backZ: -2.1, leftX: -2.9, rightX: 3.3, frontZ: 5.2, ceilY: 3.0 };
export const MOON = { x: 0.78, y: 1.34, r: 0.78 };

/* ------------------------------------------------------------------ small helpers */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// soft round shadow texture for contact shadows under objects
let shadowTex = null;
export function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.45, 'rgba(0,0,0,.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
export function contactShadow(w, d, opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

const NOISE_GLSL = /* glsl */`
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
`;

/* ------------------------------------------------------------------ room shell */
// Fake ambient occlusion and stain from the world position, patched into a standard material once
// (corners, the floor border, the top of the walls). `body` sets `float ao` from `vec3 wp`.
function patchAO(mat, body) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAoW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAoW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAoW;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n{ vec3 wp = vAoW; float ao = 1.0; ${body} diffuseColor.rgb *= ao; }`);
  };
  mat.customProgramCacheKey = () => 'ao:' + body;
  return mat;
}
const f3 = (v) => v.toFixed(3);

// phones: bamboo slats drawn on a canvas instead of the 0.68 MB photo texture
export function slatTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  const R = rng(23), n = 40, w = S / n;
  g.fillStyle = '#2a1a0f'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const tone = 0.75 + R() * 0.4, x = i * w;
    const grd = g.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, `rgb(${60 * tone | 0},${36 * tone | 0},${20 * tone | 0})`);
    grd.addColorStop(0.45, `rgb(${150 * tone | 0},${96 * tone | 0},${52 * tone | 0})`);
    grd.addColorStop(1, `rgb(${58 * tone | 0},${34 * tone | 0},${18 * tone | 0})`);
    g.fillStyle = grd; g.fillRect(x + 0.6, 0, w - 1.2, S);
    for (let y = R() * 160; y < S; y += 150 + R() * 90) { g.fillStyle = 'rgba(30,16,8,.55)'; g.fillRect(x + 0.6, y, w - 1.2, 3); g.fillStyle = 'rgba(200,150,90,.25)'; g.fillRect(x + 0.6, y + 3, w - 1.2, 2); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// rice paper lit from behind: fibres, slight mottling, brighter toward the middle where the lamp is
let paperTex = null;
function paperTexture() {
  if (paperTex) return paperTex;
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), R = rng(41);
  const grd = g.createRadialGradient(S / 2, S * 0.55, 10, S / 2, S / 2, S * 0.72);
  grd.addColorStop(0, '#fff1d6'); grd.addColorStop(0.6, '#e9b877'); grd.addColorStop(1, '#a8652c');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    g.strokeStyle = `rgba(${R() > 0.5 ? '120,70,30' : '255,240,210'},${0.05 + R() * 0.1})`; g.lineWidth = 0.5 + R() * 0.8;
    const x = R() * S, y = R() * S, a = R() * Math.PI, l = 6 + R() * 22;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  paperTex = new THREE.CanvasTexture(c); paperTex.colorSpace = THREE.SRGBColorSpace;
  return paperTex;
}
// a soft warm pool of light thrown on a wall by a lamp (additive, no extra light source)
let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 60, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,190,120,1)'); grd.addColorStop(0.35, 'rgba(255,150,80,.45)'); grd.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c); poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

// T = { floor: {map, normalMap, mapSide}, bamboo: {map, normalMap} | slat: texture, plaster: {map, normalMap} }
// (any may be missing: the room still builds)
export function buildRoom(T, track) {
  const g = new THREE.Group();
  g.name = 'room';
  const L = ROOM.leftX, Rx = ROOM.rightX, B = ROOM.backZ, F = ROOM.frontZ, H = ROOM.ceilY;

  // floor: old wood planks, slightly waxed so it catches the lantern glow; a darker stained border with a
  // thin pale inlay runs round the room, and the planks darken into the corners
  const floorMat = track(new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.55, metalness: 0 }));
  floorMat.userData.envScale = 0.5;
  if (T.floor) {
    floorMat.map = T.floor.map; floorMat.normalMap = T.floor.normalMap || null;
    floorMat.normalScale = new THREE.Vector2(0.8, 0.8);
  }
  patchAO(floorMat, `float dW = min(min(wp.x - (${f3(L)}), ${f3(Rx)} - wp.x), min(wp.z - (${f3(B)}), ${f3(F)} - wp.z));
    float band = 1.0 - smoothstep(0.34, 0.35, dW);
    float inlay = smoothstep(0.35, 0.356, dW) * (1.0 - smoothstep(0.376, 0.382, dW));
    ao = mix(1.0, 0.36, band) * (1.0 + 0.55 * inlay) * mix(0.5, 1.0, smoothstep(0.0, 0.28, dW));`);
  const floorW = ROOM.rightX - ROOM.leftX, floorD = ROOM.frontZ - ROOM.backZ;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.leftX + ROOM.rightX) / 2, 0, (ROOM.backZ + ROOM.frontZ) / 2);
  floor.receiveShadow = true;
  floor.userData.uvRepeat = [floorW / 2.2, floorD / 2.2];
  g.add(floor);

  // back wall: bamboo slats with a round moon window cut through it
  const W = floorW; // H (ceiling height) is already declared above
  const shape = new THREE.Shape();
  shape.moveTo(ROOM.leftX, 0); shape.lineTo(ROOM.rightX, 0); shape.lineTo(ROOM.rightX, H); shape.lineTo(ROOM.leftX, H); shape.lineTo(ROOM.leftX, 0);
  const hole = new THREE.Path();
  hole.absarc(MOON.x, MOON.y, MOON.r, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const wallGeo = new THREE.ShapeGeometry(shape, 64);
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0x8c7a62, roughness: 0.8 }));
  if (T.bamboo) { wallMat.map = T.bamboo.map; wallMat.normalMap = T.bamboo.normalMap || null; }
  else if (T.slat) { wallMat.map = T.slat; wallMat.color.set(0xa08a70); }
  patchAO(wallMat, `float dc = min(wp.x - (${f3(L)}), ${f3(Rx)} - wp.x);
    ao = mix(0.5, 1.0, smoothstep(0.0, 0.6, dc)) * mix(0.62, 1.0, smoothstep(0.0, 0.5, ${f3(H)} - wp.y));`);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.z = ROOM.backZ;
  wall.receiveShadow = true;
  g.add(wall);

  // dark lacquer skirting and top rail on the back wall
  const lacquer = track(new THREE.MeshPhysicalMaterial({ color: 0x1a0d08, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }));
  const railMat = track(new THREE.MeshStandardMaterial({ color: 0x1c100a, roughness: 0.62 }));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.05), railMat);
  rail.position.set((ROOM.leftX + ROOM.rightX) / 2, 0.08, ROOM.backZ + 0.025);
  const rail2 = rail.clone(); rail2.position.y = H - 0.18; rail2.scale.y = 1.4;
  g.add(rail, rail2);

  // moon window frame: a deep lacquered ring through the wall plus a slim front lip
  const ringDepth = 0.22;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(MOON.r, MOON.r, ringDepth, 96, 1, true), lacquer);
  ring.material = lacquer; ring.rotation.x = Math.PI / 2;
  ring.position.set(MOON.x, MOON.y, ROOM.backZ - ringDepth / 2 + 0.01);
  const ringIn = new THREE.Mesh(new THREE.CylinderGeometry(MOON.r - 0.002, MOON.r - 0.002, ringDepth, 96, 1, true), track(new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.55, side: THREE.BackSide })));
  ringIn.rotation.x = Math.PI / 2; ringIn.position.copy(ring.position);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(MOON.r + 0.03, 0.035, 12, 120), lacquer);
  lip.position.set(MOON.x, MOON.y, ROOM.backZ + 0.02);
  g.add(ring, ringIn, lip);

  // side walls: warm lime plaster above a timber wainscot (vertical boards, the floor texture turned upright)
  const WAIN = 0.95, midZ = (B + F) / 2;
  const plasterMat = track(new THREE.MeshStandardMaterial({ color: 0x9a7a5c, roughness: 0.92 }));
  if (T.plaster) {
    plasterMat.map = T.plaster.map; plasterMat.normalMap = T.plaster.normalMap || null;
    plasterMat.normalScale = new THREE.Vector2(1.4, 1.4);
  }
  patchAO(plasterMat, `float dc = min(wp.z - (${f3(B)}), ${f3(F)} - wp.z);
    ao = mix(0.5, 1.0, smoothstep(0.0, 0.6, dc)) * mix(0.55, 1.0, smoothstep(0.0, 0.55, ${f3(H)} - wp.y)) * mix(0.8, 1.0, smoothstep(0.0, 0.25, wp.y - ${f3(WAIN)}));`);
  const plasterGeo = new THREE.PlaneGeometry(floorD, H - WAIN);
  // timber boards standing upright: the floor photo turned 90 degrees, at the floor's plank scale
  const timber = (rx, ry) => {
    const m = track(new THREE.MeshStandardMaterial({ color: 0x4e3626, roughness: 0.5 }));
    if (T.floor) { const t = T.floor.map.clone(); t.rotation = Math.PI / 2; t.repeat.set(rx, ry); t.needsUpdate = true; m.map = t; }
    return patchAO(m, `float dc = min(min(wp.z - (${f3(B)}), ${f3(F)} - wp.z), min(wp.x - (${f3(L)}), ${f3(Rx)} - wp.x));
      ao = mix(0.55, 1.0, smoothstep(0.0, 0.5, dc)) * mix(0.6, 1.0, smoothstep(0.0, 0.18, wp.y));`);
  };
  const timberMat = timber(WAIN / 2.3, floorD / 2.6);
  const wainGeo = new THREE.PlaneGeometry(floorD, WAIN);
  [[L, Math.PI / 2], [Rx, -Math.PI / 2]].forEach(([x, ry]) => {
    const up = new THREE.Mesh(plasterGeo, plasterMat); up.rotation.y = ry; up.position.set(x, WAIN + (H - WAIN) / 2, midZ);
    const lo = new THREE.Mesh(wainGeo, timberMat); lo.rotation.y = ry; lo.position.set(x, WAIN / 2, midZ);
    g.add(up, lo);
  });
  // a low timber dado under the moon window on the back wall
  const backWain = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.46), timber(0.46 / 2.3, W / 2.6));
  backWain.position.set((L + Rx) / 2, 0.23, B + 0.012);
  g.add(backWain);

  // trim: dado rails, skirting, panel stiles, lattice bars and lamp frames, all one instanced dark-lacquer mesh
  const trims = [];
  const box = (x, y, z, sx, sy, sz) => trims.push([x, y, z, sx, sy, sz]);
  [[L, 1], [Rx, -1]].forEach(([x, s]) => {
    box(x + s * 0.02, WAIN, midZ, 0.04, 0.06, floorD);         // dado rail
    box(x + s * 0.014, 0.07, midZ, 0.028, 0.14, floorD);       // skirting
    for (let z = B + 0.4; z < F - 0.2; z += 0.78) box(x + s * 0.01, WAIN / 2 + 0.03, z, 0.02, WAIN - 0.2, 0.05); // stiles
  });
  box((L + Rx) / 2, 0.47, B + 0.03, W, 0.05, 0.04);            // back dado rail

  // lattice windows on the side walls, backlit rice paper behind a double-line grid
  const paper = new THREE.MeshBasicMaterial({ map: paperTexture(), color: new THREE.Color(1.0, 0.72, 0.45), fog: true });
  const LAT = [[L, 1, 0.25], [L, 1, 2.75], [Rx, -1, 0.25], [Rx, -1, 2.75]];
  const lw = 1.05, lh = 1.22, ly = 1.78;
  LAT.forEach(([x, s, z]) => {
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), paper);
    pp.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; pp.position.set(x + s * 0.008, ly, z);
    g.add(pp);
    const fx = x + s * 0.035;
    box(fx, ly + lh / 2 + 0.035, z, 0.07, 0.07, lw + 0.14); box(fx, ly - lh / 2 - 0.035, z, 0.07, 0.07, lw + 0.14);
    box(fx, ly, z - lw / 2 - 0.035, 0.07, lh, 0.07); box(fx, ly, z + lw / 2 + 0.035, 0.07, lh, 0.07);
    const bx = x + s * 0.026, sp = 0.15;
    for (let k = -3; k <= 3; k++) { if (k === 0) continue; const zz = z + k * sp - Math.sign(k) * sp / 2; [-0.013, 0.013].forEach((o) => box(bx, ly, zz + o, 0.02, lh, 0.014)); }
    for (let k = -4; k <= 4; k++) { const yy = ly + k * sp; if (Math.abs(yy - ly) > lh / 2 - 0.05) continue; [-0.013, 0.013].forEach((o) => box(bx, yy + o, z, 0.02, 0.014, lw)); }
  });

  // wall sconces: small paper box lamps with a warm pool of light on the plaster around them
  const lampBody = new THREE.BoxGeometry(0.15, 0.26, 0.15);
  const pool = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  [[L, 1, 1.5], [L, 1, 4.1], [Rx, -1, 1.5], [Rx, -1, 4.1]].forEach(([x, s, z]) => {
    const cx = x + s * 0.11;
    const lamp = new THREE.Mesh(lampBody, paper); lamp.position.set(cx, 1.72, z); g.add(lamp);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => box(cx + a * 0.077, 1.72, z + b * 0.077, 0.014, 0.3, 0.014));
    box(cx, 1.72 + 0.15, z, 0.18, 0.02, 0.18); box(cx, 1.72 - 0.15, z, 0.18, 0.02, 0.18);
    box(x + s * 0.06, 1.72, z, 0.12, 0.03, 0.03); // bracket
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), pool);
    pl.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; pl.position.set(x + s * 0.004, 1.78, z); pl.renderOrder = 2;
    g.add(pl);
  });

  // ceiling: dark timber boards, heavy beams across the room and light rafters running front to back
  const ceilMat = track(new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.8 }));
  if (T.floor) { ceilMat.map = T.floor.map; ceilMat.normalMap = T.floor.normalMap || null; }
  patchAO(ceilMat, `float dc = min(min(wp.z - (${f3(B)}), ${f3(F)} - wp.z), min(wp.x - (${f3(L)}), ${f3(Rx)} - wp.x));
    ao = mix(0.45, 1.0, smoothstep(0.0, 0.7, dc));`);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, floorD), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(floor.position.x, H, floor.position.z);
  g.add(ceil);
  const beamMat = track(new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 0.6 }));
  if (T.floor) { beamMat.map = T.floor.map; beamMat.normalMap = T.floor.normalMap || null; }
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(W, 0.2, 0.16), beamMat, 6);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) { m4.makeTranslation(floor.position.x, H - 0.1, B + 0.6 + i * 1.15); beams.setMatrixAt(i, m4); }
  const nRaf = Math.floor(W / 0.5);
  const rafters = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, floorD), beamMat, nRaf);
  for (let i = 0; i < nRaf; i++) { m4.makeTranslation(L + 0.25 + i * 0.5, H - 0.035, midZ); rafters.setMatrixAt(i, m4); }
  g.add(beams, rafters);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e120b, roughness: 0.7 }); trimMat.userData.envScale = 0.4; track(trimMat);
  const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trimMat, trims.length);
  const tp = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
  trims.forEach(([x, y, z, sx, sy, sz], i) => { tp.set(x, y, z); ts.set(sx, sy, sz); m4.compose(tp, tq, ts); trim.setMatrixAt(i, m4); });
  g.add(trim);

  g.userData.sideTable = new THREE.Vector3(-1.15, 0, ROOM.backZ + 0.55);
  return g;
}

/* ------------------------------------------------------------------ beyond the moon window: jade mist and bamboo */
export function buildGarden(tier) {
  const g = new THREE.Group();
  g.name = 'garden';
  const U = { uTime: { value: 0 }, uGlow: { value: 1 } };
  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.4),
    new THREE.ShaderMaterial({
      uniforms: U, depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: NOISE_GLSL + /* glsl */`
        uniform float uTime, uGlow; varying vec2 vUv;
        void main(){
          vec3 deep = vec3(0.010, 0.040, 0.036);
          vec3 jade = vec3(0.20, 0.42, 0.34);
          vec3 pale = vec3(0.55, 0.70, 0.58);
          float y = vUv.y;
          float m = fbm(vec2(vUv.x * 3.0 + uTime * 0.01, y * 2.0 - uTime * 0.004));
          vec3 col = mix(pale, jade, smoothstep(0.08, 0.55, y));
          col = mix(col, deep, smoothstep(0.45, 1.0, y));
          col *= 0.75 + 0.5 * m;
          // the far grove, out of focus: soft blurred culms and leaf masses dissolving into the mist
          float bam = 0.0;
          for (int k = 0; k < 11; k++) {
            float fk = float(k);
            float xk = 0.12 + 0.76 * fract(sin(fk * 12.9898 + 3.1) * 43758.5453);
            float wk = 0.004 + 0.006 * fract(sin(fk * 7.13) * 917.3);
            float lean = (fract(sin(fk * 3.7) * 311.7) - 0.5) * 0.05;
            float d = abs(vUv.x - xk - lean * y);
            bam = max(bam, (1.0 - smoothstep(wk, wk + 0.018, d)) * (0.3 + 0.35 * fract(xk * 7.0)));
          }
          float can = smoothstep(0.5, 0.78, fbm(vUv * vec2(7.0, 5.0) + vec2(3.0, uTime * 0.003))) * smoothstep(0.35, 0.7, y);
          col = mix(col, col * vec3(0.5, 0.66, 0.58), max(bam, can * 0.55));
          col *= uGlow;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  mist.position.set(MOON.x, MOON.y + 0.1, ROOM.backZ - 1.25);
  g.add(mist);
  // a drifting veil of mist between the near and the far culms, heavier near the ground: depth layers
  const veil = (z, w, h, amt, seed) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uGlow: U.uGlow }, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: NOISE_GLSL + /* glsl */`
        uniform float uTime, uGlow; varying vec2 vUv;
        void main(){
          float n = fbm(vec2(vUv.x * 2.6 + uTime * 0.012 + ${seed.toFixed(1)}, vUv.y * 1.8));
          float a = (0.25 + 0.75 * n) * mix(1.0, 0.35, smoothstep(0.1, 0.9, vUv.y)) * ${amt.toFixed(2)};
          a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          gl_FragColor = vec4(vec3(0.46, 0.62, 0.53) * uGlow, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    m.position.set(MOON.x, MOON.y, z); m.renderOrder = 1;
    return m;
  };
  g.add(veil(ROOM.backZ - 0.62, 3.6, 2.6, 0.42, 1), veil(ROOM.backZ - 0.98, 3.9, 2.9, 0.38, 7));

  // bamboo culms with nodes, and drooping leaf sprays; colour fades into the mist with distance
  const R = rng(7);
  const count = tier === 'low' ? 8 : 12;
  const culmGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  culmGeo.translate(0, 0.5, 0);
  const culmMat = new THREE.ShaderMaterial({
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vC; varying float vY; varying float vX;
      void main(){
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #else
          vC = vec3(0.1);
        #endif
        vY = wp.y; vX = normal.x;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vY; varying float vX;
      void main(){
        float node = smoothstep(0.035, 0.0, abs(fract(vY * 2.6) - 0.5) - 0.465);
        vec3 c = vC * (0.85 + 0.3 * vX) * (1.0 - 0.35 * node);
        c = mix(c, vec3(0.42, 0.58, 0.48), smoothstep(1.3, 0.2, vY) * 0.35);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const culms = new THREE.InstancedMesh(culmGeo, culmMat, count);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.45, 0.13, 1, 0); leafShape.quadraticCurveTo(0.45, -0.07, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
  const leafN = tier === 'low' ? 90 : 180;
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide }), leafN);
  const near = new THREE.Color(0.02, 0.045, 0.032), far = new THREE.Color(0.3, 0.46, 0.38);
  const c = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const culmData = [];
  for (let i = 0; i < count; i++) {
    const depth = (i + R() * 0.8) / count;
    const x = MOON.x - 1.05 + R() * 2.1;
    const z = ROOM.backZ - 0.35 - depth * 0.9;
    const r = 0.016 + (1 - depth) * 0.016 + R() * 0.006;
    const lean = (R() - 0.5) * 0.1;
    p.set(x, -0.2, z); e.set(0, 0, lean); q.setFromEuler(e); s.set(r, 3.6, r);
    m4.compose(p, q, s); culms.setMatrixAt(i, m4);
    c.copy(near).lerp(far, Math.pow(depth, 0.9) * 0.8); culms.setColorAt(i, c);
    culmData.push({ x, z, depth, lean });
  }
  let li = 0;
  while (li < leafN) {
    const t = culmData[(R() * count) | 0];
    const y = 1.3 + R() * 1.4;
    const bx = t.x - Math.sin(t.lean) * (y + 0.2), side = R() < 0.5 ? -1 : 1;
    const nLeaves = 4 + ((R() * 4) | 0);
    for (let k = 0; k < nLeaves && li < leafN; k++, li++) {
      p.set(bx + side * 0.01, y, t.z);
      const droop = -0.35 - R() * 0.75, spread = (k - nLeaves / 2) * 0.22;
      e.set((R() - 0.5) * 0.6, side < 0 ? Math.PI + spread * 0.4 : spread * 0.4, droop + spread * 0.25);
      q.setFromEuler(e);
      const L = 0.13 + R() * 0.09; s.set(L, L, L);
      m4.compose(p, q, s); leaves.setMatrixAt(li, m4);
      c.copy(near).lerp(far, Math.pow(t.depth, 0.9) * 0.8 + 0.04); leaves.setColorAt(li, c);
    }
  }
  g.add(culms, leaves);
  g.userData.U = U;
  return g;
}

/* ------------------------------------------------------------------ paper lanterns */
// [x, y, z, scale]: hung at different heights so a few always sit inside the frame
export const LANTERNS = [
  [-2.1, 2.12, -1.25, 1.0], [-0.95, 2.12, -1.25, 1.0], [2.35, 2.12, -1.25, 1.0],
  [-2.1, 2.12, 1.15, 1.0], [2.35, 2.12, 1.15, 1.0], [-2.1, 2.12, 3.4, 1.0], [2.35, 2.12, 3.4, 1.0],
];

/* a faint cone of light under the chandelier, with slow dust in it: the "lantern light" in the air */
export function buildLightCone(top, bottomY, radius, tier) {
  const g = new THREE.Group();
  const h = top.y - bottomY;
  const U = { uTime: { value: 0 }, uStrength: { value: 1 } };
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, radius, h, 48, 1, true),
    new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: /* glsl */`
        uniform float uStrength; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){
          float f = abs(dot(normalize(vN), normalize(vV)));
          float a = pow(f, 2.4) * smoothstep(0.25, 0.85, vY) * vY * 0.035 * uStrength;
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  cone.position.set(top.x, bottomY + h / 2, top.z);
  cone.renderOrder = 4;
  g.add(cone);
  // dust motes drifting in the cone
  const n = tier === 'low' ? 60 : 160;
  const R = rng(17), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const y = R(), r = Math.sqrt(R()) * (0.16 + (radius - 0.16) * (1 - y)) * 0.9, a = R() * Math.PI * 2;
    pos[i * 3] = top.x + Math.cos(a) * r; pos[i * 3 + 1] = bottomY + y * h; pos[i * 3 + 2] = top.z + Math.sin(a) * r; seed[i] = R();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime, uPx; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.13 + aSeed * 40.0) * 0.05; p.z += cos(uTime * 0.11 + aSeed * 30.0) * 0.05;
        p.y += sin(uTime * 0.07 + aSeed * 20.0) * 0.06;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uPx * 0.006 / -mv.z, 1.0, 3.0);
        vA = 0.25 + 0.75 * fract(aSeed * 7.3);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * (1.0 - d * 2.0) * vA * 0.16, 1.0); }',
  }));
  dust.frustumCulled = false;
  dust.renderOrder = 4;
  g.add(dust);
  g.userData = { U, dust };
  return g;
}
export function buildLanterns(tier) {
  const g = new THREE.Group();
  g.name = 'lanterns';
  const n = LANTERNS.length;
  // body: a slightly squashed paper globe; the paper sags a little between the 13 wire ribs
  const pts = [], NP = 78;
  for (let i = 0; i <= NP; i++) {
    const u = i / NP, a = -Math.PI / 2 + u * Math.PI;
    const sag = 0.986 + 0.014 * Math.abs(Math.sin(Math.PI * 13 * u));
    pts.push(new THREE.Vector2(Math.max(0.035, Math.cos(a) * 0.17 * sag), Math.sin(a) * 0.19));
  }
  const bodyGeo = new THREE.LatheGeometry(pts, 48);
  const U = { uTime: { value: 0 }, uPower: { value: 1 } };
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      attribute float aFlick;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vF;
      void main(){
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vN = normalize(mat3(modelMatrix) * normal);
        #endif
        vec4 wp = modelMatrix * p;
        vV = normalize(cameraPosition - wp.xyz);
        vUv = uv; vF = aFlick;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: NOISE_GLSL + /* glsl */`
      uniform float uTime, uPower;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vF;
      void main(){
        float facing = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        // light through paper: brightest where we look straight through the globe
        float glow = mix(0.22, 1.0, pow(facing, 1.6));
        // the bulb inside: a hot core a little below the middle, cooler toward the caps
        glow *= 0.6 + 0.6 * exp(-pow((vUv.y - 0.44) * 2.8, 2.0));
        // wire ribs: a thin dark line where the paper is glued over each wire, a soft shadow beside it
        float rp = fract(vUv.y * 13.0), rd = min(rp, 1.0 - rp);
        glow *= (1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.05, rd))) * mix(0.82, 1.0, smoothstep(0.05, 0.3, rd));
        // paper fibre and uneven thickness; a glued seam down one side
        float fib = fbm(vec2(vUv.x * 110.0, vUv.y * 30.0) + vF * 9.0);
        float blot = fbm(vUv * vec2(16.0, 7.0) + vF * 3.0);
        glow *= 0.84 + 0.2 * fib + 0.14 * (blot - 0.5);
        glow *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.006, abs(vUv.x - 0.25)));
        // paper is denser near the caps
        glow *= smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y) * 0.75 + 0.25;
        float fl = 1.0 + 0.05 * sin(uTime * 7.3 + vF * 13.0) + 0.03 * sin(uTime * 13.1 + vF * 5.0);
        // warm paper: deeper orange at the rim, a pale amber core (kept below white so ACES does not bleach it)
        vec3 col = mix(vec3(0.7, 0.16, 0.03), vec3(1.0, 0.46, 0.13), pow(facing, 2.0)) * glow * 0.95 * fl * uPower;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  const flick = new Float32Array(n);
  // dark lacquer caps, a tassel, and the cord up to the beam
  const capGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.035, 20);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x140a06, roughness: 0.4 });
  const caps = new THREE.InstancedMesh(capGeo, capMat, n * 2);
  const tasselGeo = new THREE.CylinderGeometry(0.004, 0.018, 0.16, 8);
  tasselGeo.translate(0, -0.08, 0);
  const tassels = new THREE.InstancedMesh(tasselGeo, new THREE.MeshStandardMaterial({ color: 0x6a1a10, roughness: 0.7 }), n);
  const cordGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 5);
  cordGeo.translate(0, 0.5, 0);
  const cords = new THREE.InstancedMesh(cordGeo, capMat, n);
  // thin wire hoops where the paper meets the lacquer caps
  const hoopGeo = new THREE.TorusGeometry(0.069, 0.0035, 6, 40); hoopGeo.rotateX(Math.PI / 2);
  const hoops = new THREE.InstancedMesh(hoopGeo, capMat, n * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  LANTERNS.forEach(([x, y, z, k], i) => {
    s.setScalar(k);
    p.set(x, y + 0.171 * k, z); m4.compose(p, q, s); hoops.setMatrixAt(i * 2, m4);
    p.set(x, y - 0.171 * k, z); m4.compose(p, q, s); hoops.setMatrixAt(i * 2 + 1, m4);
    p.set(x, y, z); m4.compose(p, q, s); body.setMatrixAt(i, m4);
    p.set(x, y + 0.19 * k, z); m4.compose(p, q, s); caps.setMatrixAt(i * 2, m4);
    p.set(x, y - 0.19 * k, z); m4.compose(p, q, s); caps.setMatrixAt(i * 2 + 1, m4);
    p.set(x, y - 0.2 * k, z); m4.compose(p, q, s); tassels.setMatrixAt(i, m4);
    p.set(x, y + 0.2 * k, z); s.set(1, ROOM.ceilY - (y + 0.2 * k), 1); m4.compose(p, q, s); cords.setMatrixAt(i, m4);
    flick[i] = i * 0.37;
  });
  bodyGeo.setAttribute('aFlick', new THREE.InstancedBufferAttribute(flick, 1));
  g.add(body, caps, tassels, cords, hoops);
  g.userData.U = U;
  g.userData.mats = [capMat, tassels.material];
  return g;
}

/* ------------------------------------------------------------------ steam (soft instanced billboards) */
export function buildSteam(count, opts) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const seed = new Float32Array(count * 4);
  const R = rng(opts.seed || 3);
  for (let i = 0; i < count; i++) {
    seed[i * 4] = R(); seed[i * 4 + 1] = (0.7 + R() * 0.6); seed[i * 4 + 2] = R(); seed[i * 4 + 3] = R();
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.instanceCount = count;
  const U = {
    uTime: { value: 0 }, uRate: { value: opts.rate || 0.22 }, uRise: { value: opts.rise || 0.3 }, uSpread: { value: opts.spread || 0.03 },
    uSize: { value: opts.size || 0.08 }, uDrift: { value: opts.drift || 0.02 }, uAmount: { value: 0 },
    uColor: { value: new THREE.Color(opts.color || 0xd8cfc2) }, uOpacity: { value: opts.opacity || 0.5 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uRate, uRise, uSpread, uSize, uDrift, uAmount;
      varying vec2 vUv; varying float vA; varying float vS;
      void main(){
        float life = fract(aSeed.x + uTime * uRate * aSeed.y);
        float ang = aSeed.w * 6.2831853;
        float r = uSpread * sqrt(aSeed.z);
        vec3 c = vec3(cos(ang) * r, 0.0, sin(ang) * r);
        c.xz *= 1.0 + life * 1.4;
        c.x += sin(life * 4.0 + aSeed.x * 20.0) * uDrift * life + uDrift * 0.6 * life * life;
        c.z += cos(life * 3.3 + aSeed.w * 17.0) * uDrift * life;
        c.y = uRise * life * (0.85 + 0.3 * aSeed.y);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        float s = uSize * (0.3 + 1.3 * life) * (0.7 + 0.6 * aSeed.z);
        float rot = aSeed.x * 6.2831853 + life * (aSeed.w - 0.5) * 2.0;
        float cr = cos(rot), sr = sin(rot);
        vec2 q = mat2(cr, sr, -sr, cr) * position.xy;
        mv.xy += q * s;
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.16, life) * (1.0 - smoothstep(0.4, 1.0, life)) * uAmount;
        vUv = uv; vS = aSeed.x;
      }`,
    fragmentShader: NOISE_GLSL + /* glsl */`
      uniform float uTime, uOpacity; uniform vec3 uColor;
      varying vec2 vUv; varying float vA; varying float vS;
      void main(){
        if (vA < 0.002) discard;
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float soft = 1.0 - smoothstep(0.05, 1.0, d);
        float n = fbm(vUv * 2.4 + vec2(vS * 13.0, vS * 7.0 - uTime * 0.16));
        float wisp = smoothstep(0.32, 0.82, n * 0.85 + soft * 0.35);
        float a = soft * soft * wisp * vA * uOpacity;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.U = U;
  return mesh;
}

/* steam columns: vertical, camera-facing ribbons of scrolling, domain-warped noise. They give the continuous
   curling filaments that real steam has, which round puffs alone cannot. */
export function buildSteamColumns(count, opts) {
  const g = new THREE.Group();
  const U = {
    uTime: { value: 0 }, uAmount: { value: 0 }, uOpacity: { value: opts.opacity || 0.5 },
    uColor: { value: new THREE.Color(opts.color || 0xd8cfc2) }, uSpeed: { value: opts.speed || 0.35 },
  };
  const geo = new THREE.PlaneGeometry(1, 1, 1, 12);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uSeed; varying vec2 vUv;
      void main(){
        // cylindrical billboard: keep the column upright, turn it to face the camera
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 sx = vec3(modelMatrix[0][0], modelMatrix[0][1], modelMatrix[0][2]);
        vec3 sy = vec3(modelMatrix[1][0], modelMatrix[1][1], modelMatrix[1][2]);
        float w = length(sx), h = length(sy);
        vec3 toCam = cameraPosition - c; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
        vec3 rightV = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        float y = position.y;
        // the column leans and sways as it rises
        float sway = sin(y * 3.1 + uTime * 0.7 + uSeed * 9.0) * 0.18 * y + sin(y * 7.0 - uTime * 1.1 + uSeed * 3.0) * 0.05 * y;
        vec3 wp = c + rightV * (position.x * w * (0.55 + y * 0.9) + sway * w) + vec3(0.0, 1.0, 0.0) * y * h;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: NOISE_GLSL + /* glsl */`
      uniform float uTime, uAmount, uOpacity, uSpeed, uSeed; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float y = vUv.y, x = vUv.x - 0.5;
        vec2 p = vec2(x * 2.6, y * 2.2 - uTime * uSpeed) + uSeed * 17.0;
        vec2 warp = vec2(fbm(p * 1.3 + vec2(0.0, uTime * 0.05)), fbm(p * 1.3 + 5.2));
        float n = fbm(p * 2.0 + warp * 1.6);
        float strands = smoothstep(0.3, 0.9, n) * (0.55 + 0.45 * smoothstep(0.45, 0.75, n));
        float edge = 1.0 - smoothstep(0.05, 0.5, abs(x + (warp.x - 0.5) * 0.35 * y));
        edge *= edge;
        float vert = smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.35, 1.0, y));
        float a = strands * edge * vert * uAmount * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const R = rng(opts.seed || 21);
  for (let i = 0; i < count; i++) {
    const m = mat.clone();
    m.uniforms = { ...U, uSeed: { value: R() } };
    const col = new THREE.Mesh(geo, m);
    const a = (i / count) * Math.PI * 2 + R();
    const r = (opts.spread || 0.03) * (0.2 + R() * 0.8);
    col.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    col.scale.set((opts.width || 0.06) * (0.7 + R() * 0.6), (opts.rise || 0.3) * (0.75 + R() * 0.5), 1);
    col.frustumCulled = false;
    col.renderOrder = 6;
    g.add(col);
  }
  g.userData.U = U;
  return g;
}

/* ------------------------------------------------------------------ bamboo steamer + dumplings */
// height field -> tangent-space normal map (canvas, linear)
function normalFromHeight(h, W, Hh, strength, wrapX = true, wrapY = true) {
  const c = makeCanvas(W, Hh), g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const at = (x, y) => {
    if (wrapX) x = (x + W) % W; else x = Math.min(W - 1, Math.max(0, x));
    if (wrapY) y = (y + Hh) % Hh; else y = Math.min(Hh - 1, Math.max(0, y));
    return h[y * W + x];
  };
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = wrapX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = wrapY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}

/* woven bamboo for the lid top: a 2/2 twill of narrow split-bamboo strips, each strip with its own tone,
   fibres along it, a rounded cross-section and dips where it passes under its neighbour */
function weaveTextures() {
  const S = 256, n = 16, w = S / n;
  const R = rng(11);
  const tone = Array.from({ length: n * 2 }, () => 0.78 + R() * 0.32);
  const fib = Array.from({ length: S }, () => R());
  const h = new Float32Array(S * S);
  const c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / w), j = Math.floor(y / w);
    const fx = (x % w) / w, fy = (y % w) / w;
    const horizTop = ((i + j) & 3) < 2;
    const across = horizTop ? fy : fx, along = horizTop ? fx : fy;
    const strip = horizTop ? j : n + i;
    const edge = Math.min(across, 1 - across);
    const gap = edge < 0.07;
    // rounded strip, lower toward the cell ends where it dives under the crossing strip
    let hh = gap ? 0.05 : 0.45 + 0.4 * Math.sqrt(Math.sin(Math.PI * across)) * (0.78 + 0.22 * Math.sin(Math.PI * along));
    const f = fib[(horizTop ? y : x) % S], fibre = 0.9 + 0.16 * f + 0.05 * Math.sin((horizTop ? x : y) * 0.9 + strip);
    hh += (f - 0.5) * 0.06;
    h[y * S + x] = hh;
    const k = gap ? 0.28 : tone[strip] * fibre * (0.62 + 0.42 * hh);
    const p = (y * S + x) * 4;
    d[p] = Math.min(255, 182 * k); d[p + 1] = Math.min(255, 140 * k); d[p + 2] = Math.min(255, 86 * k); d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const normal = normalFromHeight(h, S, S, 2.2);
  return { map, normal };
}
/* the bent bamboo band of a steamer: pale fibrous outer skin, darker rattan lashing near both rims, and the
   overlap seam where the band is joined. Returns colour and normal maps. */
function bandTextures() {
  const W = 512, Hh = 64, R = rng(5);
  const row = Array.from({ length: Hh }, () => R());
  const h = new Float32Array(W * Hh);
  const c = makeCanvas(W, Hh), g = c.getContext('2d'), img = g.createImageData(W, Hh), d = img.data;
  const lash = (y) => (y >= 4 && y < 12) || (y >= 52 && y < 60);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const seam = x < 23 ? 1 : 0;
    let hh = 0.5 + (row[y] - 0.5) * 0.12 + 0.03 * Math.sin(x * 0.05 + y * 0.7);
    let r = 196, gg = 158, b = 108, k = 0.9 + row[y] * 0.18;
    if (lash(y)) { // rattan wraps: raised bands with a groove between turns
      const t = (x % 6) / 6;
      hh = 0.75 + 0.2 * Math.sin(Math.PI * t) - (t < 0.12 ? 0.3 : 0);
      r = 120; gg = 84; b = 46; k = 0.72 + 0.35 * Math.sin(Math.PI * t);
    } else if (seam) { hh += 0.18; k *= 0.92; }
    if (x === 23) { hh -= 0.25; k *= 0.55; }
    if (y < 3 || y > Hh - 4) { k *= 0.55; } // darker, worn rim edges
    k *= 1 - 0.18 * Math.max(0, Math.sin(x * 0.013 + 2.0)) * (0.5 + row[(y + 7) % Hh]); // uneven tone along the band
    h[y * W + x] = hh;
    const p = (y * W + x) * 4;
    d[p] = Math.min(255, r * k); d[p + 1] = Math.min(255, gg * k); d[p + 2] = Math.min(255, b * k); d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  const normal = normalFromHeight(h, W, Hh, 3.0, true, false);
  return { map, normal };
}
// bent bamboo is never perfectly round: scale each vertex's radius by a gentle function of its angle
function wobble(geo, amp, phase = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + amp * (Math.sin(2 * a + phase) * 0.6 + Math.sin(3 * a + 1.3 + phase) * 0.4);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function dumplingGeometry(seed) {
  // a pleated crescent: a sphere stretched, flattened underneath, bent, and pinched into a pleated ridge on top.
  // Pleats are uneven (count, depth and spacing vary per dumpling); the skin colour carries the filling showing
  // through the thin belly, paler thicker pleats, and a few faint golden spots where it touched the liner
  const R = rng(seed);
  const nP = 7 + Math.floor(R() * 3);
  const amp = Array.from({ length: nP + 1 }, () => 0.65 + R() * 0.7);
  const bend = 0.26 + R() * 0.12, tilt = (R() - 0.5) * 0.12;
  const geo = new THREE.SphereGeometry(1, 72, 40);
  const p = geo.attributes.position, v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  const skin = new THREE.Color(0xf0e7d8), fill = new THREE.Color(0xd99a7e), crest = new THREE.Color(0xfaf4ea), gold = new THREE.Color(0xd2a46a), c = new THREE.Color();
  const s1 = R() * 10, s2 = R() * 10, s3 = R() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    const yo = y;
    if (y < 0) y *= 0.42; // sits flat on the liner
    const top = Math.max(0, y);
    z *= 1 - 0.6 * top * top; // pinch toward a seam
    y += top * top * 0.32 * (1 - Math.abs(x)); // seam ridge
    // folded pleats fanning down one side of the seam, each its own depth
    const u = (x + 1) / 2 * nP, k = Math.min(nP, Math.floor(u));
    const fold = Math.sin(Math.PI * u + 0.25 * Math.sin(u * 2.1 + s1)) * amp[k];
    const pleat = fold * 0.13 * smoothstep(top, 0.3, 0.9) * (z > 0 ? 1 : 0.35);
    y += pleat * 0.6; z += Math.abs(pleat) * 0.5 * Math.sign(z);
    z += bend * x * x; // crescent bend
    y += tilt * x * top;
    p.setXYZ(i, x * 1.15, y * 0.82, z * 0.8);
    const inner = (1 - Math.abs(x)) * (1 - smoothstep(top, 0.15, 0.7)) * 0.62;
    c.copy(skin).lerp(fill, inner);
    c.lerp(crest, clamp(pleat * 4.0, 0, 1) * 0.6 + smoothstep(top, 0.55, 0.95) * 0.25);
    const blob = Math.sin(v.x * 5.3 + s1) * Math.sin(v.y * 4.1 + s2) * Math.sin(v.z * 6.7 + s3);
    const spot = smoothstep(blob, 0.55, 0.85) * (yo < 0.1 ? 1 : 0.25);
    c.lerp(gold, spot * 0.55);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildSteamer(track) {
  const R = 0.105, Hb = 0.072;
  const root = new THREE.Group(); root.name = 'steamer';
  const band = bandTextures();
  const bandMat = track(new THREE.MeshStandardMaterial({ map: band.map, normalMap: band.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.58, color: 0xf2e6d4 }));
  const bandIn = track(new THREE.MeshStandardMaterial({ map: band.map, roughness: 0.72, color: 0x9a8668, side: THREE.BackSide }));
  const wall = new THREE.Mesh(wobble(new THREE.CylinderGeometry(R, R, Hb, 72, 1, true), 0.012), bandMat);
  wall.position.y = Hb / 2; wall.castShadow = true; wall.receiveShadow = true;
  const wallIn = new THREE.Mesh(wobble(new THREE.CylinderGeometry(R - 0.006, R - 0.006, Hb, 72, 1, true), 0.012), bandIn);
  wallIn.position.y = Hb / 2;
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0x4e331b, roughness: 0.5 }));
  const torus = (r, tube) => { const t = new THREE.TorusGeometry(r, tube, 8, 72); t.rotateX(Math.PI / 2); return wobble(t, 0.012); };
  const rimT = new THREE.Mesh(torus(R - 0.002, 0.005), rimMat);
  rimT.position.y = Hb;
  const rimB = new THREE.Mesh(torus(R - 0.002, 0.0045), rimMat); rimB.position.y = 0.004;
  // slatted floor and a parchment liner with steam holes
  const slats = new THREE.Mesh(new THREE.CircleGeometry(R - 0.006, 48), track(new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.7 })));
  slats.rotation.x = -Math.PI / 2; slats.position.y = 0.012;
  const linerC = makeCanvas(256, 256), lg = linerC.getContext('2d');
  lg.fillStyle = '#b9a98c'; lg.fillRect(0, 0, 256, 256);
  const LR = rng(8);
  for (let i = 0; i < 160; i++) { lg.fillStyle = `rgba(${LR() > 0.5 ? '150,128,92' : '214,200,170'},.18)`; lg.beginPath(); lg.arc(LR() * 256, LR() * 256, 2 + LR() * 10, 0, Math.PI * 2); lg.fill(); }
  lg.fillStyle = 'rgba(120,96,60,.55)';
  for (let a = 0; a < 6; a++) for (let r = 1; r <= 3; r++) {
    const ang = a / 6 * Math.PI * 2 + r * 0.4, rr = r * 34;
    lg.beginPath(); lg.arc(128 + Math.cos(ang) * rr, 128 + Math.sin(ang) * rr, 4, 0, Math.PI * 2); lg.fill();
  }
  const linerTex = new THREE.CanvasTexture(linerC); linerTex.colorSpace = THREE.SRGBColorSpace;
  const liner = new THREE.Mesh(new THREE.CircleGeometry(R - 0.012, 48), track(new THREE.MeshStandardMaterial({ map: linerTex, roughness: 0.85 })));
  liner.rotation.x = -Math.PI / 2; liner.position.y = 0.0135;
  root.add(wall, wallIn, rimT, rimB, slats, liner);

  // dumplings: thin wheat-starch skins, a moist sheen, the filling faintly showing through
  const dMat = track(new THREE.MeshPhysicalMaterial({
    color: 0xe6dccb, vertexColors: true, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.5, sheenColor: new THREE.Color(0xfff3e4), sheenRoughness: 0.35,
    emissive: new THREE.Color(0x5a2a18), emissiveIntensity: 0.1,
  }));
  const dumplings = new THREE.Group();
  const spots = [[0.044, 0.024, 0.5, 1.0], [-0.038, 0.034, 2.5, 0.95], [0.006, -0.047, -1.3, 1.04], [-0.05, -0.022, 4.1, 0.9]];
  spots.forEach(([x, z, ry, k], i) => {
    const d = new THREE.Mesh(dumplingGeometry(13 + i * 7), dMat);
    d.scale.set(0.029 * k, 0.027 * k, 0.027 * k);
    d.position.set(x, 0.0135 + 0.027 * k * 0.42 * 0.82, z); d.rotation.set(0, ry, (i - 1.5) * 0.04);
    d.castShadow = true; d.receiveShadow = true;
    dumplings.add(d);
  });
  root.add(dumplings);

  // lid: woven dome (top-down projected weave so the strips stay straight across it) with a band rim
  const weave = weaveTextures();
  const lidMat = track(new THREE.MeshStandardMaterial({ map: weave.map, normalMap: weave.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.66, side: THREE.DoubleSide })); // the lathe faces inward: draw both sides
  const lid = new THREE.Group(); lid.name = 'lid';
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2((R + 0.004) * Math.cos(t * Math.PI / 2) + 0.0001, 0.026 * Math.sin(t * Math.PI / 2))); }
  prof.reverse();
  const domeGeo = new THREE.LatheGeometry(prof, 72);
  { const pp = domeGeo.attributes.position, uv = domeGeo.attributes.uv; for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) * 4.2 + 0.5, pp.getZ(i) * 4.2 + 0.5); }
  wobble(domeGeo, 0.012);
  const dome = new THREE.Mesh(domeGeo, lidMat);
  dome.position.y = 0.03; dome.castShadow = true;
  const lidBand = new THREE.Mesh(wobble(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.032, 72, 1, true), 0.012), bandMat);
  lidBand.position.y = 0.016; lidBand.castShadow = true;
  const lidBandIn = new THREE.Mesh(wobble(new THREE.CylinderGeometry(R + 0.001, R + 0.001, 0.032, 72, 1, true), 0.012), bandIn);
  lidBandIn.position.y = 0.016;
  const lidRim = new THREE.Mesh(torus(R + 0.007, 0.0045), rimMat);
  lidRim.position.y = 0.031;
  const lidRimB = new THREE.Mesh(torus(R + 0.0065, 0.0035), rimMat);
  lidRimB.position.y = 0.002;
  lid.add(dome, lidBand, lidBandIn, lidRim, lidRimB);
  lid.position.y = Hb - 0.012;
  root.add(lid);
  root.userData = { lid, dumplings, lidY: lid.position.y, R, Hb };
  return root;
}

/* ------------------------------------------------------------------ tea: liquid in the cup and the pouring stream */
export function buildTea(track) {
  const liquidMat = track(new THREE.MeshPhysicalMaterial({ color: 0x6b3a0e, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0 }));
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 48), liquidMat);
  liquid.rotation.x = -Math.PI / 2;
  liquid.visible = false;
  const streamMat = track(new THREE.MeshPhysicalMaterial({ color: 0x9a5418, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.88, emissive: new THREE.Color(0x2a1204), emissiveIntensity: 0.6 }));
  const sg = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  sg.translate(0, -0.5, 0); // pivot at the top (the spout)
  const stream = new THREE.Mesh(sg, streamMat);
  stream.visible = false;
  return { liquid, stream };
}

export function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => {
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].dispose(); });
      m.dispose();
    });
  });
}
export { clamp, smoothstep };
