// Forno Rosso - the 3D kitchen. Everything is procedural clay: lathe, extrude, instancing, canvas textures.
// buildWorld() returns { scene, update(J, t, camera), setScale(px), dispose }.
// J is the journey value (0..5): the section index + progress through that section.
import * as THREE from 'three';
import * as TX from './textures.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const range = (J, a, b) => clamp01((J - a) / (b - a));
const eoc = (t) => 1 - Math.pow(1 - t, 3);
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* Where things live (world units, counter top is y = 0) */
export const LAYOUT = { pizzaZ: 5, ovenZ: -7.2, insidePizza: new THREE.Vector3(0.6, 0, -9.1), boardZ: -4.3 };

/* Mood keys: time of day, from bright kitchen to fire-lit night. */
const C = (h) => new THREE.Color(h);
const MOODS = [
  { J: 0.0, bg: C('#f6dcbc'), fog: C('#f2d2ad'), fd: 0.017, hemiS: C('#fff3e2'), hemiG: C('#d29a72'), hemi: 1.35, key: 2.3, keyC: C('#fff0d8'), exp: 1.0, bloom: 0.12, bulb: 0.95, glowOut: 0.2 },
  { J: 1.6, bg: C('#f0c795'), fog: C('#e9bd8a'), fd: 0.02, hemiS: C('#ffe9cd'), hemiG: C('#c58760'), hemi: 1.25, key: 2.1, keyC: C('#ffe0b8'), exp: 1.0, bloom: 0.15, bulb: 1.1, glowOut: 0.45 },
  { J: 2.25, bg: C('#8a4430'), fog: C('#7b3a28'), fd: 0.026, hemiS: C('#ffb98a'), hemiG: C('#74331f'), hemi: 0.8, key: 1.1, keyC: C('#ffb070'), exp: 1.05, bloom: 0.4, bulb: 1.6, glowOut: 1.0 },
  { J: 2.65, bg: C('#210e08'), fog: C('#2e130b'), fd: 0.03, hemiS: C('#ff9a60'), hemiG: C('#3a170c'), hemi: 0.3, key: 0.2, keyC: C('#ff9a55'), exp: 1.05, bloom: 0.5, bulb: 2.0, glowOut: 1.2 },
  { J: 2.95, bg: C('#210e08'), fog: C('#2e130b'), fd: 0.03, hemiS: C('#ff9a60'), hemiG: C('#3a170c'), hemi: 0.3, key: 0.2, keyC: C('#ff9a55'), exp: 1.05, bloom: 0.5, bulb: 2.0, glowOut: 1.2 },
  { J: 3.4, bg: C('#1c0f16'), fog: C('#2a1210'), fd: 0.024, hemiS: C('#cf8f80'), hemiG: C('#34170f'), hemi: 0.7, key: 1.1, keyC: C('#ffcfa8'), exp: 1.12, bloom: 0.55, bulb: 2.0, glowOut: 1.2 },
  { J: 5.0, bg: C('#1c0f16'), fog: C('#2a1210'), fd: 0.022, hemiS: C('#d79584'), hemiG: C('#34170f'), hemi: 0.75, key: 1.2, keyC: C('#ffcfa8'), exp: 1.12, bloom: 0.55, bulb: 2.2, glowOut: 1.15 },
];
const moodTmp = { bg: new THREE.Color(), fog: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), keyC: new THREE.Color(), fd: 0, hemi: 0, key: 0, exp: 1, bloom: 0, bulb: 0, glowOut: 0 };
function moodAt(J) {
  let i = 0;
  while (i < MOODS.length - 2 && J > MOODS[i + 1].J) i++;
  const a = MOODS[i], b = MOODS[i + 1];
  const k = clamp01((J - a.J) / (b.J - a.J));
  const s = k * k * (3 - 2 * k);
  moodTmp.bg.lerpColors(a.bg, b.bg, s); moodTmp.fog.lerpColors(a.fog, b.fog, s);
  moodTmp.hemiS.lerpColors(a.hemiS, b.hemiS, s); moodTmp.hemiG.lerpColors(a.hemiG, b.hemiG, s);
  moodTmp.keyC.lerpColors(a.keyC, b.keyC, s);
  moodTmp.fd = lerp(a.fd, b.fd, s); moodTmp.hemi = lerp(a.hemi, b.hemi, s); moodTmp.key = lerp(a.key, b.key, s); moodTmp.exp = lerp(a.exp, b.exp, s);
  moodTmp.bloom = lerp(a.bloom, b.bloom, s); moodTmp.bulb = lerp(a.bulb, b.bulb, s); moodTmp.glowOut = lerp(a.glowOut, b.glowOut, s);
  return moodTmp;
}

export function pizzaPose(J) {
  const glide = eio(range(J, 2.2, 2.66)), pull = eio(range(J, 2.93, 3.25));
  const zi = lerp(LAYOUT.pizzaZ, LAYOUT.insidePizza.z, glide);
  return { x: LAYOUT.insidePizza.x * sstep(-7.9, -9.1, zi) * (1 - pull), z: lerp(zi, LAYOUT.boardZ, pull) };
}

// async: it yields to the page between parts, so no single task blocks scrolling for long
const nextTask = () => new Promise((r) => setTimeout(r, 0));
export async function buildWorld({ tier = 'high', shadows = true, tex } = {}) {
  const low = tier === 'low';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6dcbc');
  scene.fog = new THREE.FogExp2('#f2d2ad', 0.017);

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const bump = track(tex.bump);
  bump.repeat.set(3, 3);
  const blobTex = track(tex.blob);

  const clay = (color, o = {}) => track(new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.84, metalness: 0, bumpMap: o.nobump ? null : bump, bumpScale: o.bump ?? 1.4,
    map: o.map || null, emissive: o.emissive || 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side || THREE.FrontSide,
    vertexColors: !!o.vc,
  }));
  const mesh = (g, m, parent, cast = true, recv = false) => {
    const me = new THREE.Mesh(g, m);
    me.castShadow = cast && shadows; me.receiveShadow = recv && shadows;
    if (parent) parent.add(me);
    return me;
  };
  const G = (g) => track(g);

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0xfff3e2, 0xd29a72, 1.3);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.3);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 40;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
  }
  scene.add(key); scene.add(key.target);
  const fireIn = new THREE.PointLight(0xff7424, 60, 16, 2);
  fireIn.position.set(-2.0, 1.5, -9.7);
  scene.add(fireIn);
  const fireOut = new THREE.PointLight(0xff8a3a, 12, 18, 2);
  fireOut.position.set(0, 1.6, -4.6);
  scene.add(fireOut);

  /* ---------------- room: floor, walls, counter ---------------- */
  const room = new THREE.Group(); scene.add(room);
  const floorTex = track(tex.floor); floorTex.repeat.set(6.5, 14);
  const floor = mesh(G(new THREE.PlaneGeometry(15.4, 36)), clay(0xffffff, { map: floorTex, nobump: true, rough: 0.9 }), room, false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.9, 0);
  const wallTex = track(tex.wall); wallTex.repeat.set(3, 1);
  const wallMat = clay(0xffffff, { map: wallTex, nobump: true, rough: 0.95 });
  const wl = mesh(G(new THREE.PlaneGeometry(37.8, 8.4)), wallMat, room, false, true);
  wl.rotation.y = Math.PI / 2; wl.position.set(-7.7, 3.3, 3.1);
  const wr = mesh(wl.geometry, wallMat, room, false, true);
  wr.rotation.y = -Math.PI / 2; wr.position.set(7.7, 3.3, 3.1);
  const backTex = wallTex.clone(); backTex.repeat.set(1.2, 1); backTex.needsUpdate = true; track(backTex);
  const wb = mesh(G(new THREE.PlaneGeometry(15.4, 8.4)), clay(0xffffff, { map: backTex, nobump: true, rough: 0.95 }), room, false, true);
  wb.position.set(0, 3.3, -15.6);

  // counter
  const marbleTex = track(tex.marble); marbleTex.repeat.set(1, 3.4);
  const topMat = clay(0xffffff, { map: marbleTex, rough: 0.55, bump: 0.35 });
  const plaster = clay('#f1dcc0', { rough: 0.9, bump: 0.6 });
  const counterTop = mesh(G(new THREE.BoxGeometry(6.2, 0.16, 21)), [plaster, plaster, topMat, plaster, plaster, plaster], room, false, true);
  counterTop.position.set(0, -0.08, 2.5);
  const counterBody = mesh(G(new THREE.BoxGeometry(5.8, 0.8, 20.6)), clay('#d99a72', { rough: 0.9 }), room, false, true);
  counterBody.position.set(0, -0.56, 2.5);
  const trim = mesh(G(new THREE.BoxGeometry(6.4, 0.07, 21.2)), clay('#b8431f', { rough: 0.8 }), room, false, true);
  trim.position.set(0, -0.19, 2.5);

  /* ---------------- the oven ---------------- */
  const oven = new THREE.Group(); scene.add(oven);
  const OZ = LAYOUT.ovenZ;
  const br = tex.domeBr; track(br.map); track(br.bump);
  br.map.repeat.set(6.3, 4); br.bump.repeat.set(6.3, 4);
  const domeMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: br.map, bumpMap: br.bump, bumpScale: 2.2, roughness: 0.82 }));
  const dome = mesh(G(new THREE.SphereGeometry(5, 64, 32, Math.PI, Math.PI, 0, Math.PI / 2)), domeMat, oven, false, true);
  dome.position.set(0, 0, OZ - 0.2);
  // inner chamber: it glows
  const brIn = tex.inBr; track(brIn.map); track(brIn.bump);
  brIn.map.repeat.set(4, 2.6); brIn.bump.repeat.set(4, 2.6);
  const innerMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: brIn.map, bumpMap: brIn.bump, bumpScale: 2, roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0.32 }));
  const inner = mesh(G(new THREE.SphereGeometry(3.6, 48, 24, Math.PI, Math.PI, 0, Math.PI / 2)), innerMat, oven, false, false);
  inner.position.set(0, 0, OZ - 0.2);
  const ovenFloor = mesh(G(new THREE.CircleGeometry(3.6, 48, Math.PI, Math.PI)), clay('#8a5236', { rough: 0.9, emissive: new THREE.Color('#ff4a0c'), ei: 0.35 }), oven, false, false);
  ovenFloor.rotation.x = -Math.PI / 2; ovenFloor.position.set(0, 0.02, OZ - 0.2);
  ovenFloor.rotation.z = 0;
  // facade: half disc with an arched mouth
  const fs = new THREE.Shape();
  fs.moveTo(-5, 0); fs.lineTo(-1.75, 0); fs.lineTo(-1.75, 0.95); fs.absarc(0, 0.95, 1.75, Math.PI, 0, true); fs.lineTo(1.75, 0); fs.lineTo(5, 0);
  fs.absarc(0, 0, 5, 0, Math.PI, false); fs.closePath();
  const facadeG = G(new THREE.ExtrudeGeometry(fs, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 40 }));
    const facMat = track(new THREE.MeshStandardMaterial({ color: '#f2d9b8', roughness: 0.85, bumpMap: bump, bumpScale: 0.45 }));
  const facade = mesh(facadeG, facMat, oven, true, true);
  facade.position.set(0, 0, OZ - 0.5);
  // brick arch ring
  const rs = new THREE.Shape();
  rs.moveTo(-2.3, 0); rs.lineTo(-2.3, 0.95); rs.absarc(0, 0.95, 2.3, Math.PI, 0, true); rs.lineTo(2.3, 0); rs.lineTo(1.75, 0); rs.lineTo(1.75, 0.95);
  rs.absarc(0, 0.95, 1.75, 0, Math.PI, false); rs.lineTo(-1.75, 0); rs.closePath();
  const ringG = G(new THREE.ExtrudeGeometry(rs, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 40 }));
  const ringBr = tex.ringBr; track(ringBr.map); track(ringBr.bump);
  ringBr.map.repeat.set(0.5, 0.5); ringBr.bump.repeat.set(0.5, 0.5);
  const ringMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: ringBr.map, bumpMap: ringBr.bump, bumpScale: 2, roughness: 0.8 }));
  const ring = mesh(ringG, ringMat, oven, true, true);
  ring.position.set(0, 0, OZ);
  // keystone + lintel shelf
  const key1 = mesh(G(new THREE.BoxGeometry(0.55, 0.7, 0.7)), clay('#f6e6cf'), oven, true, true);
  key1.position.set(0, 0.95 + 2.3 + 0.05, OZ + 0.32);
  // stone sill in front of the mouth
  const sill = mesh(G(new THREE.BoxGeometry(4.2, 0.1, 0.5)), clay('#d9c3a5', { rough: 0.7 }), oven, true, true);
  sill.position.set(0, 0.0, OZ + 0.5);
  // chimney
  const chim = mesh(G(new THREE.CylinderGeometry(0.55, 0.78, 3.4, 28)), clay('#e6c9a4'), oven, true, false);
  chim.position.set(0, 5.6, OZ - 1.6);
  const chimCap = mesh(G(new THREE.CylinderGeometry(0.85, 0.85, 0.28, 28)), clay('#b8431f'), oven, true, false);
  chimCap.position.set(0, 7.35, OZ - 1.6);
  const chimTop = mesh(G(new THREE.TorusGeometry(0.6, 0.12, 12, 28)), clay('#8f2f14'), oven, true, false);
  chimTop.rotation.x = Math.PI / 2; chimTop.position.set(0, 7.5, OZ - 1.6);
  // plinth
  const plinth = mesh(G(new THREE.BoxGeometry(10.8, 0.9, 7.6)), clay('#d99a72', { rough: 0.9 }), room, false, true);
  plinth.position.set(0, -0.45, OZ - 3.9 + 0.0);
  const plinthTop = mesh(G(new THREE.BoxGeometry(10.9, 0.08, 7.7)), clay('#e6cfae', { rough: 0.8 }), room, false, true);
  plinthTop.position.set(0, -0.04, OZ - 3.9);
  // firewood stacked beside the oven (instanced logs)
  const logG = G(new THREE.CylinderGeometry(0.19, 0.19, 1.5, 12));
  const logCount = 15;
  const logs = new THREE.InstancedMesh(logG, clay('#a56a3a', { rough: 0.9 }), logCount);
  logs.castShadow = shadows;
  const d = new THREE.Object3D();
  let li = 0;
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 6 - row && li < logCount; k++) {
      d.position.set(-6.2 + (k + row * 0.5) * 0.4, -0.9 + 0.2 + row * 0.34, OZ + 3.4 + (hash(li) - 0.5) * 0.1);
      d.rotation.set(Math.PI / 2, 0, 0); d.scale.setScalar(1); d.updateMatrix();
      logs.setMatrixAt(li++, d.matrix);
    }
  }
  logs.count = li;
  scene.add(logs);

  /* ---------------- fire inside ---------------- */
  const fire = new THREE.Group(); fire.position.set(-2.1, 0.02, -10.2); scene.add(fire);
  const logMat = clay('#3a2016', { rough: 0.95, emissive: new THREE.Color('#ff4a08'), ei: 0.5 });
  [[0.0, 0.0, 0.5, 0.15, 1.9], [0.35, 0.1, -0.7, -0.25, 1.7], [-0.3, -0.35, 0.25, 0.5, 1.6]].forEach(([x, z, rz, ry, len], i) => {
    const l = mesh(G(new THREE.CylinderGeometry(0.17, 0.2, len, 10)), logMat, fire, false, false);
    l.rotation.set(Math.PI / 2 - 0.2 * (i - 1), ry, rz * 0.4); l.position.set(x * 0.8, 0.28, z);
  });
  const coalG = G(new THREE.IcosahedronGeometry(0.12, 1));
  const coalMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.45, 0.1) }));
  const coals = new THREE.InstancedMesh(coalG, coalMat, 16);
  for (let i = 0; i < 16; i++) {
    const a = hash(i + 3) * 6.28, rr = 0.2 + hash(i + 9) * 1.1;
    d.position.set(Math.cos(a) * rr, 0.08, Math.sin(a) * rr * 0.8); d.rotation.set(0, a, 0); d.scale.set(1.2, 0.6, 1); d.updateMatrix();
    coals.setMatrixAt(i, d.matrix);
  }
  fire.add(coals);
  const flameFrag = `
    varying vec2 vUv; uniform float uTime, uAmp, uSeed;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += n(p)*a; p *= 2.03; a *= .5; } return s; }
    void main(){
      float t = uTime * 1.25 + uSeed * 10.;
      float y = vUv.y;
      float turb = fbm(vec2(vUv.x * 3. + uSeed * 7., y * 2.4 - t * 1.4));
      float cx = (vUv.x - .5) * 2.;
      cx += (turb - .5) * 1.25 * y;
      float w = mix(1.0, 0.0, pow(y, .8));
      float dd = abs(cx) / max(w, .001);
      float yy = y + (turb - .5) * .3;
      float body = smoothstep(1., .3, dd) * smoothstep(1., .12, yy) * smoothstep(0., .06, y);
      float core = smoothstep(.7, .0, dd) * smoothstep(.8, .0, yy);
      vec3 col = mix(vec3(1., .22, .02), vec3(1., .6, .1), core);
      col = mix(col, vec3(1., .88, .5), core * core * core * .6);
      float a = body * uAmp * 0.75;
      gl_FragColor = vec4(col * 1.05, a);
    }`;
  const flames = [];
  const flameDefs = [[0, 0, 1.25, 1.9, 0.1], [-0.5, 0.2, 0.8, 1.25, 0.5], [0.5, -0.15, 0.9, 1.4, 0.9], [0.1, 0.4, 0.7, 1.0, 0.3]];
  flameDefs.forEach(([x, z, w, h, seed]) => {
    const m = track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uAmp: { value: 1 }, uSeed: { value: seed } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: flameFrag,
    }));
    const g = G(new THREE.PlaneGeometry(w, h)); g.translate(0, h / 2, 0);
    const f = new THREE.Mesh(g, m); f.position.set(x, 0.18, z); f.renderOrder = 5;
    fire.add(f); flames.push(f);
  });

  await nextTask();
  /* ---------------- particles (flour dust, embers, chimney sparks) ---------------- */
  const pxScale = { value: 1000 };
  function makeParticles({ count, spawn, size, rise, drift, speed, colA, colB, additive = true }) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      spawn(i, v); pos.set([v.x, v.y, v.z], i * 3);
      seed.set([hash(i * 1.7 + 1), hash(i * 2.3 + 5), hash(i * 3.1 + 9), hash(i * 4.9 + 2)], i * 4);
    }
    const g = G(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uScale: pxScale, uSize: { value: size }, uRise: { value: rise }, uDrift: { value: drift },
        uSpeed: { value: speed }, uFade: { value: 1 }, uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) },
      },
      vertexShader: `attribute vec4 aSeed; uniform float uTime, uScale, uSize, uRise, uDrift, uSpeed, uFade; varying float vA;
        void main(){
          float life = fract(aSeed.x + uTime * uSpeed * (0.6 + aSeed.y * 0.8));
          vec3 p = position;
          p.y += life * uRise * (0.55 + aSeed.z * 0.9);
          p.x += (sin(uTime * 0.9 + aSeed.x * 37.) * 0.5 + uDrift * (aSeed.w - .35)) * life;
          p.z += cos(uTime * 0.7 + aSeed.y * 29.) * 0.5 * life;
          float tw = 0.65 + 0.35 * sin(uTime * (5. + aSeed.z * 9.) + aSeed.x * 50.);
          vA = smoothstep(0., .08, life) * (1. - life) * tw * uFade;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = max(1.5, uSize * (0.5 + aSeed.w * 0.9) * uScale / (-mv.z) * (1. - life * .45));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColA, uColB; varying float vA;
        void main(){ float dd = length(gl_PointCoord - .5); float a = smoothstep(.5, .06, dd); gl_FragColor = vec4(mix(uColA, uColB, dd * 2.), a * vA); }`,
    }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    return pts;
  }
  const flour = makeParticles({
    count: low ? 70 : 200, size: 0.04, rise: 3.2, drift: 0.8, speed: 0.025, colA: '#fffaf0', colB: '#f3e5cf', additive: false,
    spawn: (i, v) => v.set((hash(i) - 0.5) * 6, 0.05 + hash(i + 7) * 0.5, 1 + hash(i + 3) * 9),
  });
  const embersIn = makeParticles({
    count: low ? 60 : 150, size: 0.035, rise: 2.6, drift: 1.2, speed: 0.2, colA: '#ffd890', colB: '#ff5a10',
    spawn: (i, v) => v.set(-2.0 + (hash(i) - 0.5) * 1.6, 0.3 + hash(i + 7) * 0.5, -9.9 + (hash(i + 3) - 0.5) * 1.2),
  });
  const sparks = makeParticles({
    count: low ? 50 : 130, size: 0.05, rise: 7, drift: 4.5, speed: 0.07, colA: '#ffe3a8', colB: '#ff6414',
    spawn: (i, v) => v.set((hash(i) - 0.5) * 0.7, 7.6, OZ - 1.6 + (hash(i + 3) - 0.5) * 0.7),
  });
  const ambient = makeParticles({
    count: low ? 40 : 110, size: 0.04, rise: 3.5, drift: 2, speed: 0.04, colA: '#ffe2b0', colB: '#ff8a2a',
    spawn: (i, v) => v.set((hash(i) - 0.5) * 12, 0.5 + hash(i + 7) * 2.5, -8 + hash(i + 3) * 18),
  });

  /* ---------------- string lights ---------------- */
  const bulbG = G(new THREE.SphereGeometry(low ? 0.1 : 0.075, 10, 8));
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6) }));
  const strands = [{ z: 9, y: 4.6 }, { z: 3.5, y: 4.9 }, { z: -2, y: 5.0 }, { z: -6.5, y: 5.2 }];
  const bulbPts = [];
  const wireMat = track(new THREE.LineBasicMaterial({ color: 0x2a1a14 }));
  strands.forEach((s, si) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, x = lerp(-7.5, 7.5, u);
      pts.push(new THREE.Vector3(x, s.y - 1.05 * Math.sin(u * Math.PI) + (si % 2) * 0.1, s.z));
    }
    scene.add(new THREE.Line(G(new THREE.BufferGeometry().setFromPoints(pts)), wireMat));
    for (let i = 1; i < 28; i += 2) bulbPts.push(pts[i]);
  });
  // long strands along each side
  [-5.6, 5.6].forEach((x) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push(new THREE.Vector3(x, 4.5 - 0.5 * Math.sin(u * Math.PI * 4), lerp(12, -6, u))); }
    scene.add(new THREE.Line(G(new THREE.BufferGeometry().setFromPoints(pts)), wireMat));
    for (let i = 1; i < 30; i += 2) bulbPts.push(pts[i]);
  });
  const bulbs = new THREE.InstancedMesh(bulbG, bulbMat, bulbPts.length);
  bulbPts.forEach((p, i) => { d.position.copy(p); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); bulbs.setMatrixAt(i, d.matrix); });
  scene.add(bulbs);

  await nextTask();
  /* ---------------- props on the counter ---------------- */
  const props = new THREE.Group(); scene.add(props);
  const blob = (x, z, r, op = 0.3, parent = props, y = 0.004) => {
    const m = new THREE.Mesh(G(new THREE.PlaneGeometry(r * 2, r * 2)), track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: op, depthWrite: false, color: 0x3a1408 })));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  };

  // tomato bowl
  const bowlPts = [[0, 0], [0.34, 0], [0.55, 0.08], [0.72, 0.3], [0.78, 0.5], [0.72, 0.52], [0.66, 0.34], [0.5, 0.17], [0.3, 0.1], [0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = mesh(G(new THREE.LatheGeometry(bowlPts, 40)), clay('#c78b52', { side: THREE.DoubleSide }), props, true, true);
  bowl.position.set(-2.15, 0, LAYOUT.pizzaZ - 0.9);
  const tomMat = clay('#d4381f', { rough: 0.55, bump: 0.8 });
  const tomG = G(new THREE.SphereGeometry(0.25, 20, 14)); tomG.scale(1, 0.86, 1);
  const calyxG = G(new THREE.CylinderGeometry(0.05, 0.1, 0.06, 6));
  const calyxM = clay('#4f8a2e');
  [[-0.2, 0.3, 0.1], [0.2, 0.32, -0.1], [0.0, 0.3, 0.28], [0.05, 0.56, 0.0], [-0.1, 0.3, -0.3]].forEach(([x, y, z], i) => {
    const t = mesh(tomG, tomMat, bowl, true, true); t.position.set(x, y + 0.04, z); t.rotation.y = i;
    const c = mesh(calyxG, calyxM, t, false, false); c.position.set(0, 0.2, 0);
  });
  blob(-2.15, LAYOUT.pizzaZ - 0.9, 1.05, 0.33);

  // flour mound
  const moundPts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; moundPts.push(new THREE.Vector2(Math.cos(a) * 0.95 + 0.0001, Math.pow(Math.sin(a), 1.2) * 0.55)); }
  const mound = mesh(G(new THREE.LatheGeometry(moundPts, 36)), clay('#fffaf0', { rough: 0.95, bump: 1.0 }), props, true, true);
  mound.position.set(2.45, 0, LAYOUT.pizzaZ - 2.0); mound.scale.setScalar(0.85);
  blob(2.45, LAYOUT.pizzaZ - 2.0, 1.1, 0.3);

  // floury patches under the dough
  [[0, 0, 1.9, 0.5], [-0.4, 0.2, 1.4, 0.4], [1.2, -0.4, 1.1, 0.35], [-1.3, 1.4, 0.9, 0.3]].forEach(([x, z, r, o]) => {
    const f = new THREE.Mesh(G(new THREE.PlaneGeometry(r * 2, r * 2)), track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: o, depthWrite: false, color: 0xffffff })));
    f.rotation.x = -Math.PI / 2; f.position.set(x, 0.006, LAYOUT.pizzaZ + z); props.add(f);
  });

  // rolling pin
  const pin = new THREE.Group(); props.add(pin);
  const woodTex = track(tex.wood); const woodMat = clay(0xffffff, { map: woodTex, rough: 0.82, bump: 0.25 });
  const pinBody = mesh(G(new THREE.CylinderGeometry(0.29, 0.29, 2.3, 28)), woodMat, pin, true, false); pinBody.rotation.z = Math.PI / 2;
  [-1, 1].forEach((s) => {
    const h = mesh(G(new THREE.CylinderGeometry(0.1, 0.12, 0.62, 16)), woodMat, pin, true, false); h.rotation.z = Math.PI / 2; h.position.x = s * 1.45;
    const cap = mesh(G(new THREE.SphereGeometry(0.115, 14, 10)), woodMat, pin, true, false); cap.position.x = s * 1.78;
  });
  const pinShadow = blob(0, 0, 1.4, 0.3, props, 0.005); pinShadow.scale.set(1.5, 0.6, 1);

  // basil pot
  const potPts = [[0, 0], [0.3, 0], [0.38, 0.05], [0.46, 0.5], [0.5, 0.52], [0.5, 0.58], [0.44, 0.58], [0.4, 0.52], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = mesh(G(new THREE.LatheGeometry(potPts, 28)), clay('#c4552b', { side: THREE.DoubleSide }), props, true, true);
  pot.position.set(-2.3, 0, LAYOUT.pizzaZ + 1.5);
  blob(-2.3, LAYOUT.pizzaZ + 1.5, 0.9, 0.3);

  /* ---------------- basil leaf geometry (shared) ---------------- */
  function leafGeometry(scale = 1) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(0.34, 0.08, 0.42, 0.52, 0, 0.9); s.bezierCurveTo(-0.42, 0.52, -0.34, 0.08, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); g.scale(scale, scale, scale);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, p.getY(i) + 0.55 * x * x * scale / scale - 0.14 * z * z * scale + 0.035 * Math.exp(-(x * x) / 0.0016) * scale);
    }
    g.computeVertexNormals();
    return G(g);
  }
  const leafG = leafGeometry(0.62);
  const leafMat = clay('#6fae42', { rough: 0.65, bump: 0.5 });
  const basilPot = new THREE.InstancedMesh(leafG, leafMat, 9);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + hash(i) * 0.5, tilt = 0.9 + hash(i + 4) * 0.5;
    d.position.set(-2.3 + Math.cos(a) * 0.12, 0.55 + hash(i + 2) * 0.12, LAYOUT.pizzaZ + 1.5 + Math.sin(a) * 0.12);
    d.rotation.set(-tilt, -a + Math.PI / 2, 0, 'YXZ'); d.scale.setScalar(1 + hash(i) * 0.4); d.updateMatrix();
    basilPot.setMatrixAt(i, d.matrix);
  }
  basilPot.castShadow = shadows; props.add(basilPot);

  await nextTask();
  /* ---------------- the pizza ---------------- */
  const pizza = new THREE.Group(); scene.add(pizza);
  // dough: ball (base) morphing into a pizza disc with a puffy crust (morph target)
  const bakeU = { value: 0 };
  const patchBake = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBake = bakeU;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uBake;\nvoid main() {').replace('#include <color_vertex>', '#include <color_vertex>\n#if defined( USE_COLOR )\n vColor.rgb = mix( vec3( 1.0 ), vColor.rgb, uBake );\n#endif');
    };
  };
  const NP = 56, SEG = 72;
  const ballPts = [], discPts = [];
  const Rd = 1.5;
  for (let i = 0; i <= NP; i++) {
    const a = (Math.PI * i) / NP, s = Math.sin(a), c = Math.cos(a);
    ballPts.push(new THREE.Vector2(0.84 * s, 0.62 * (1 - c)));
    const x = Rd * Math.pow(s, 0.45);
    const hh = 0.075 + 0.135 * sstep(0.62 * Rd, 0.93 * Rd, x);
    discPts.push(new THREE.Vector2(x, hh * (1 - c)));
  }
  const gBall = G(new THREE.LatheGeometry(ballPts, SEG));
  const gDisc = new THREE.LatheGeometry(discPts, SEG);
  const wob = (g, amp) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + amp * (Math.sin(3 * a + 1.3) * 0.6 + Math.sin(5 * a + 0.4) * 0.4 + Math.sin(9 * a) * 0.15);
      p.setX(i, x * k); p.setZ(i, z * k);
      p.setY(i, p.getY(i) + amp * 0.35 * Math.sin(x * 4.1 + z * 3.3));
    }
  };
  wob(gBall, 0.035); wob(gDisc, 0.032);
  // char blotches on the crust (revealed by bake)
  const colA = new Float32Array(gDisc.attributes.position.count * 3);
  for (let i = 0; i < gDisc.attributes.position.count; i++) {
    const x = gDisc.attributes.position.getX(i), z = gDisc.attributes.position.getZ(i);
    const r = Math.hypot(x, z) / Rd;
    const rim = sstep(0.8, 0.95, r);
    const nz = TX.fbm(x * 1.8 + 5, z * 1.8 + 5, 64, 3);
    const bl = sstep(0.55, 0.68, nz) * rim;
    const k = 1 - 0.62 * bl;
    colA.set([k, k * 0.82, k * 0.7], i * 3);
  }
  gBall.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  gBall.morphAttributes.position = [gDisc.attributes.position];
  gBall.morphAttributes.normal = [gDisc.attributes.normal];
  const doughMat = clay('#f0d9ae', { rough: 0.8, bump: 1.5, vc: true });
  patchBake(doughMat);
  const dough = mesh(gBall, doughMat, pizza, true, true);
  dough.morphTargetInfluences[0] = 0;

  // sauce disc
  const sauceTex = track(tex.sauce);
  const sauceSide = clay('#a82616', { rough: 0.5, bump: 0.6 });
  const sauceTop = clay(0xffffff, { map: sauceTex, rough: 0.45, bump: 0.5 });
  const sauceG = G(new THREE.CylinderGeometry(1.08, 1.1, 0.08, 56, 1));
  const sauceM = mesh(sauceG, [sauceSide, sauceTop, sauceSide], pizza, false, true);
  sauceM.castShadow = shadows;

  await nextTask();
  // mozzarella: torn, soft pieces with a flat underside and slumped edges (not round balls)
  let cheeseG = new THREE.IcosahedronGeometry(0.3, 4);
  cheeseG.deleteAttribute('normal'); cheeseG.deleteAttribute('uv');
  cheeseG = G(mergeVertices(cheeseG, 1e-4));
  {
    const p = cheeseG.attributes.position; const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      // irregular torn outline (3 and 5 lobes) plus small surface ripples
      const n = 1 + 0.12 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.06 * Math.sin(x * 11 + 1) * Math.cos(z * 9 + y * 6);
      const r = Math.hypot(x, z) / 0.3;
      const top = y > 0 ? y * 0.5 * (1 - 0.35 * r * r) : y * 0.22; // domed top that slumps towards the rim, flat base
      p.setXYZ(i, x * n * 0.92, top, z * n * 0.92);
      // golden-brown blisters, revealed by the bake (uBake), mostly on top and at the rim
      const sp = sstep(0.48, 0.62, TX.fbm(x * 9 + 3, z * 9 + 3, 64, 2)) * (y > 0 ? 1 : 0) * (0.55 + 0.45 * r);
      const k = 1 - 0.55 * sp; cols.set([k, k * 0.8, k * 0.5], i * 3);
    }
    cheeseG.setAttribute('color', new THREE.BufferAttribute(cols, 3)); cheeseG.computeVertexNormals();
  }
  // soft milky material: a warm glow that grows towards the edges fakes light passing through the cheese
  const sssU = { value: 0.1 };
  const cheeseMat = clay('#fbf5ea', { rough: 0.3, nobump: true, vc: true });
  cheeseMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBake = bakeU; sh.uniforms.uSSS = sssU;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uBake;\nvoid main() {').replace('#include <color_vertex>',
      '#include <color_vertex>\n#if defined( USE_COLOR )\n vColor.rgb = mix( vec3( 1.0 ), color.rgb, uBake );\n#ifdef USE_INSTANCING_COLOR\n vColor.rgb *= instanceColor.rgb;\n#endif\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uSSS;\nvoid main() {').replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float rimT = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );\n totalEmissiveRadiance += uSSS * diffuseColor.rgb * vec3( 1.0, 0.88, 0.7 ) * ( 0.3 + 0.7 * rimT * rimT );');
  };
  cheeseMat.customProgramCacheKey = () => 'forno-cheese';
  const CH = [];
  { // spaced scatter inside r ~1.0
    let tries = 0;
    while (CH.length < 11 && tries++ < 400) {
      const a = hash(tries * 1.3) * 6.283, r = Math.sqrt(hash(tries * 2.7 + 1)) * 0.92;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (CH.every((c) => Math.hypot(c.x - x, c.z - z) > 0.46)) CH.push({ x, z, h: hash(CH.length + 40), h2: hash(CH.length + 90), s: 0.76 + hash(CH.length + 5) * 0.44, rot: hash(CH.length + 17) * 6.28 });
    }
  }
  const cheese = new THREE.InstancedMesh(cheeseG, cheeseMat, CH.length);
  { // subtle colour variation per piece: milk white, cream, a warmer ivory
    const tints = [new THREE.Color('#ffffff'), new THREE.Color('#fdf7ec'), new THREE.Color('#fbf2e1'), new THREE.Color('#f7ecd8')];
    const tc = new THREE.Color();
    for (let i = 0; i < CH.length; i++) cheese.setColorAt(i, tc.copy(tints[i % tints.length]).lerp(tints[(i + 1) % tints.length], hash(i + 7) * 0.6));
    cheese.instanceColor.needsUpdate = true;
  }
  cheese.castShadow = shadows; cheese.receiveShadow = shadows; pizza.add(cheese);

  // basil on top
  const BL = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283 + 0.4, r = 0.25 + (i % 3) * 0.28;
    BL.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: hash(i + 70), h2: hash(i + 80), rot: hash(i + 99) * 6.28, s: 0.95 + hash(i + 33) * 0.4 });
  }
  const basilMat = clay('#6fae42', { rough: 0.6, bump: 0.5 });
  const basil = new THREE.InstancedMesh(leafG, basilMat, BL.length);
  basil.castShadow = shadows; pizza.add(basil);

  // peel, board
  const peel = new THREE.Group(); scene.add(peel);
  const peelDisc = mesh(G(new THREE.CylinderGeometry(1.78, 1.78, 0.06, 56)), woodMat, peel, true, true);
  const peelHandle = mesh(G(new THREE.CylinderGeometry(0.09, 0.09, 5.4, 12)), woodMat, peel, true, false);
  peelHandle.rotation.x = Math.PI / 2; peelHandle.position.set(0, 0.0, 1.78 + 2.6);
  const peelGrip = mesh(G(new THREE.SphereGeometry(0.13, 12, 8)), woodMat, peel, true, false); peelGrip.position.set(0, 0, 1.78 + 5.3);
  const board = new THREE.Group(); scene.add(board);
  const boardMain = mesh(G(new THREE.CylinderGeometry(1.95, 2.0, 0.1, 64)), woodMat, board, true, true);
  boardMain.position.y = 0.05;
  const boardTab = mesh(G(new THREE.CylinderGeometry(0.17, 0.17, 1.1, 16)), woodMat, board, true, true);
  boardTab.rotation.x = Math.PI / 2; boardTab.position.set(0, 0.07, 2.3);
  const boardShadow = blob(0, 0, 2.8, 0.38, board, 0.003);

  /* ---------------- update ---------------- */
  const sauceSideEnd = new THREE.Color('#8a2a1c');
  const dummy = new THREE.Object3D();
  const baseCol = {
    dough: [new THREE.Color('#f0d9ae'), new THREE.Color('#d8943f')],
    cheese: [new THREE.Color('#fbf5ea'), new THREE.Color('#f4c46c')],
    sauce: [new THREE.Color('#ffffff'), new THREE.Color('#b8826f')],
    basil: [new THREE.Color('#6fae42'), new THREE.Color('#3f7a28')],
  };
  const EXPL = { sauce: 0.85, cheese: 1.55, basil: 2.3 };

  function update(J, t, camera) {
    /* mood */
    const m = moodAt(J);
    scene.background.copy(m.bg); scene.fog.color.copy(m.fog); scene.fog.density = m.fd;
    hemi.color.copy(m.hemiS); hemi.groundColor.copy(m.hemiG); hemi.intensity = m.hemi;
    key.color.copy(m.keyC); key.intensity = m.key;
    bulbMat.color.setRGB(1, 0.84, 0.58).multiplyScalar(m.bulb);
    const flick = 0.88 + 0.12 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.05 * Math.sin(t * 23);
    const flare = 1 + 0.35 * sstep(2.5, 2.7, J) * (1 - sstep(2.95, 3.25, J));
    fireIn.intensity = 15 * flick * flare * (0.45 + 0.55 * clamp01(m.glowOut));
    fireOut.intensity = 9 * m.glowOut * flick;
    innerMat.emissiveIntensity = 0.12 * flick * flare;
    logMat.emissiveIntensity = 0.45 + 0.25 * flick;

    /* dough -> pin -> disc */
    const roll = range(J, 0.2, 0.62);
    const pinZ = lerp(LAYOUT.pizzaZ + 2.4, LAYOUT.pizzaZ - 1.5, eio(roll));
    const morph = 1 - sstep(LAYOUT.pizzaZ - 1.3, LAYOUT.pizzaZ + 1.1, pinZ);
    dough.morphTargetInfluences[0] = roll >= 1 ? 1 : (J < 0.2 ? 0 : morph);
    const bob = Math.sin(t * 1.4) * 0.012 * (1 - morph);
    const arrive = sstep(0.04, 0.2, J);
    const dz = pinZ - LAYOUT.pizzaZ;
    const over = Math.exp(-(dz * dz) / 0.55);
    const hereTop = lerp(1.24 * over, 0.16 * over, morph);
    pin.position.set(lerp(2.0, 0, arrive), 0.3 + hereTop + sstep(0.64, 0.92, J) * 1.7, lerp(LAYOUT.pizzaZ + 2.4, pinZ, arrive));
    pin.position.x += sstep(0.66, 0.95, J) * 3.2;
    pin.rotation.x = pin.position.z / 0.29; pin.rotation.y = (1 - arrive) * 0.5;
    pin.visible = J < 1.05;
    pinShadow.position.set(pin.position.x, 0.005, pin.position.z); pinShadow.material.opacity = 0.3 * (1 - sstep(0.64, 0.92, J) * 0.8);
    pinShadow.scale.set(1.5 + (hereTop > 0.5 ? 0 : 0), 0.6, 1);

    /* pizza placement */
    const pp = pizzaPose(J);
    const pz = pp.z, px = pp.x;
    const peelIn = sstep(2.0, 2.2, J), peelOut = eio(range(J, 3.2, 3.45));
    const boardQ = sstep(3.12, 3.32, J);
    const onPeel = peelIn * (1 - boardQ);
    const py = 0.06 * onPeel + 0.1 * boardQ;
    pizza.position.set(px, py, pz);
    // idle turn on the board; tiny wobble while exploded
    const idle = sstep(3.3, 3.5, J);
    pizza.rotation.y = idle * (t * 0.18) + range(J, 1.35, 1.95) * 0.6;
    peel.position.set(px, 0.03, pz + (1 - peelIn) * 3.6 + peelOut * 3.2);
    peel.position.y = 0.03 + peelOut * 0.25;
    peel.visible = J > 1.99 && peelOut < 1;
    peel.rotation.x = -peelOut * 0.12;
    board.position.set(0, 0, LAYOUT.boardZ);
    board.visible = J > 3.1;
    board.scale.setScalar(Math.max(0.001, eoc(boardQ)));
    boardShadow.visible = board.visible;

    /* bake */
    // the bake starts as the pizza meets the fire at the oven station and is golden when it comes out
    const bake = sstep(2.35, 2.88, J);
    bakeU.value = bake;
    sssU.value = 0.04 + 0.08 * clamp01(m.hemi / 1.35) + 0.05 * bake * clamp01(m.glowOut);
    doughMat.color.lerpColors(baseCol.dough[0], baseCol.dough[1], bake);
    cheeseMat.color.lerpColors(baseCol.cheese[0], baseCol.cheese[1], bake);
    sauceTop.color.lerpColors(baseCol.sauce[0], baseCol.sauce[1], bake * 0.8);
    sauceSide.color.set(0xa82616).lerp(sauceSideEnd, bake);
    basilMat.color.lerpColors(baseCol.basil[0], baseCol.basil[1], bake);

    /* exploded layers */
    const pop = sstep(0.9, 1.12, J);
    const doughY = 0;
    dough.position.y = doughY + bob;
    dough.scale.setScalar(1);
    // sauce
    const qs = eoc(range(J, 1.35, 1.6));
    sauceM.visible = pop > 0.001;
    sauceM.position.set(0, 0.2 + (EXPL.sauce + 0.25 * (1 - pop)) * (1 - qs), 0);
    sauceM.rotation.y = (1 - qs) * 1.6;
    sauceM.scale.setScalar(Math.max(0.001, pop));
    const pulseS = qs > 0.9 ? Math.sin(((qs - 0.9) / 0.1) * Math.PI) * 0.06 : 0;
    sauceM.scale.y = Math.max(0.001, pop) * (1 - pulseS);
    // cheese
    cheese.visible = pop > 0.001;
    for (let i = 0; i < CH.length; i++) {
      const c = CH[i];
      const q = eoc(range(J, 1.48 + c.h * 0.22, 1.7 + c.h * 0.22));
      const e = 1 - q;
      const pulse = q > 0.88 ? Math.sin(((q - 0.88) / 0.12) * Math.PI) * 0.16 : 0;
      dummy.position.set(c.x + (c.h - 0.5) * 0.9 * e, 0.285 + (EXPL.cheese + c.h2 * 0.55) * e, c.z + (c.h2 - 0.5) * 0.9 * e);
      dummy.rotation.set((c.h - 0.5) * 3 * e, c.rot + e * 2.4, (c.h2 - 0.5) * 3 * e);
      const sc = Math.max(0.001, pop) * c.s;
      // pieces slump a little when they land, then melt and spread in the oven
      const spread = 1 + pulse * 0.5 + q * 0.1 + bake * 0.38, flat = (1 - pulse) * (1 - q * 0.18) * (1 - bake * 0.45);
      dummy.scale.set(sc * spread, sc * flat, sc * spread);
      dummy.updateMatrix(); cheese.setMatrixAt(i, dummy.matrix);
    }
    cheese.instanceMatrix.needsUpdate = true;
    // basil
    basil.visible = pop > 0.001;
    for (let i = 0; i < BL.length; i++) {
      const b = BL[i];
      const q = eoc(range(J, 1.68 + b.h * 0.2, 1.92 + b.h * 0.2));
      const e = 1 - q;
      dummy.position.set(b.x + (b.h - 0.5) * 1.2 * e, 0.425 + (EXPL.basil + b.h2 * 0.7) * e, b.z + (b.h2 - 0.5) * 1.2 * e);
      dummy.rotation.set((b.h2 - 0.5) * 2.6 * e, b.rot + e * 3.2, (b.h - 0.5) * 2.6 * e);
      const sc = Math.max(0.001, pop) * b.s * (1 - bake * 0.1);
      dummy.scale.set(sc, sc * (1 - bake * 0.25), sc);
      dummy.updateMatrix(); basil.setMatrixAt(i, dummy.matrix);
    }
    basil.instanceMatrix.needsUpdate = true;

    /* fire */
    const amp = (0.88 + 0.12 * Math.sin(t * 6)) * flare;
    flames.forEach((f, i) => {
      f.material.uniforms.uTime.value = t; f.material.uniforms.uAmp.value = amp * (0.8 + 0.2 * Math.sin(t * 3 + i * 2));
      if (camera) { f.rotation.y = Math.atan2(camera.position.x - (fire.position.x + f.position.x), camera.position.z - (fire.position.z + f.position.z)); }
      f.scale.y = 1 + 0.08 * Math.sin(t * 7 + i * 1.7);
    });

    /* particles */
    const nightness = clamp01((m.bulb - 0.5) / 2.5);
    flour.material.uniforms.uTime.value = t; flour.material.uniforms.uFade.value = 0.8 * (1 - sstep(1.9, 2.3, J));
    embersIn.material.uniforms.uTime.value = t; embersIn.material.uniforms.uFade.value = clamp01(m.glowOut) * (0.35 + 0.65 * sstep(2.0, 2.6, J)) * flare;
    sparks.material.uniforms.uTime.value = t; sparks.material.uniforms.uFade.value = sstep(1.9, 2.6, J);
    ambient.material.uniforms.uTime.value = t; ambient.material.uniforms.uFade.value = 0.8 * sstep(2.2, 3.4, J);
    flour.visible = J < 2.4;
    return m;
  }

  /* shadow rig follows the action */
  function focus(x, y, z) {
    key.target.position.set(x, y, z);
    key.position.set(x - 5.5, y + 9, z + 6);
    key.target.updateMatrixWorld();
  }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mm.dispose()); });
    disposables.forEach((o) => o.dispose && o.dispose());
  }

  return { scene, update, focus, dispose, pxScale, key, pizza };
}
