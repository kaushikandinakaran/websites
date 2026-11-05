/* Food, plates and the chef's tools. Glossy "lacquer toy" stylisation:
   simple rounded forms, clearcoat on everything, bold local colour. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L, ss, lerp, clamp01, canvasTex, woodTex, radialTex, rng, mergeStatic, yieldTask } from './world.js';

const TOP = L.counterTop;
const TOY = 1.65;

// Phones (tier 0) get plain standard materials: clearcoat doubles the fragment cost of every lacquer surface.
// Materials are cached by their settings, so equal-looking parts share one material (and merge into one draw).
let LITE = false;
let CACHE = new Map();
// (textures are replaced by their id first: JSON.stringify would otherwise serialise the whole image)
const keyOf = (kind, color, o) => kind + color + JSON.stringify(Object.entries(o).map(([k, v]) => [k, v && v.isTexture ? v.uuid : v]));
const phys = (color, o = {}) => {
  const key = keyOf('p', color, o);
  if (CACHE.has(key)) return CACHE.get(key);
  let m;
  if (LITE) { const { clearcoat, clearcoatRoughness, ...rest } = o; m = new THREE.MeshStandardMaterial({ color, roughness: 0.3, envMapIntensity: 1.2, ...rest }); }
  else m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.4, ...o });
  CACHE.set(key, m); return m;
};
// Small or matte parts where a clearcoat never reads at this size: plain standard material (cheaper shader).
const matte = (color, o = {}) => {
  const key = keyOf('s', color, o);
  if (CACHE.has(key)) return CACHE.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, envMapIntensity: 1.0, ...o });
  CACHE.set(key, m); return m;
};

function stripeTex(base, line, positions, alpha = 0.7) {
  return canvasTex(8, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = line;
    positions.forEach((p) => { g.globalAlpha = alpha; g.fillRect(0, p * h - 2, w, 4); });
    g.globalAlpha = 1;
  });
}

export async function buildFood({ tier = 2 } = {}) {
  LITE = tier === 0; CACHE = new Map();
  const group = new THREE.Group();

  /* ----- shared geometry & materials ----- */
  const sphereG = new THREE.SphereGeometry(1, 20, 14);
  const hemiG = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const riceMat = matte(0xeee3cf, { roughness: 0.5 });
  const riceMatte = matte(0xe6dac4, { roughness: 0.7 });
  const nori = matte(0x0b1c12, { roughness: 0.5 });
  const neta = {
    tuna: phys(0xffffff, { map: stripeTex('#b3202a', '#e9858a', [0.25, 0.5, 0.75], 0.5), roughness: 0.2, emissive: 0x6a0a10 }),
    salmon: phys(0xffffff, { map: stripeTex('#ff6a30', '#ffe3cf', [0.2, 0.45, 0.7], 0.85), roughness: 0.22, emissive: 0x7a2a08 }),
    hirame: phys(0xf5ead7, { roughness: 0.22 }),
    ebi: phys(0xffffff, { map: stripeTex('#ff7d52', '#fff0dc', [0.15, 0.32, 0.5, 0.68, 0.85], 0.95), emissive: 0x6a2410 }),
  };
  const noriWall = matte(0x0b1c12, { roughness: 0.5, side: THREE.DoubleSide });
  const eggMat = phys(0xf2b81e, { roughness: 0.35, emissive: 0x4a3000 });
  const ikuraMat = phys(0xff5a1f, { roughness: 0.08, emissive: 0x3a0f00 });
  const uniMat = matte(0xf7a928, { roughness: 0.45, flatShading: true });
  const tailMat = matte(0xe8452c, { roughness: 0.3 });

  const ikuraGeo = (() => {
    const parts = []; const r = 0.0052;
    const add = (x, y, z) => { const s = new THREE.SphereGeometry(r, 8, 6); s.translate(x, y, z); parts.push(s); };
    add(0, 0.04, 0); for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283; add(Math.cos(a) * 0.0105, 0.037, Math.sin(a) * 0.0105); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + 0.4; add(Math.cos(a) * 0.016, 0.033, Math.sin(a) * 0.016); }
    add(0.005, 0.047, 0.003); add(-0.005, 0.046, -0.004);
    return mergeGeometries(parts);
  })();
  const uniGeo = (() => {
    const parts = [];
    [[0, 0.04, 0, 0.012], [0.009, 0.037, 0.008, 0.009], [-0.009, 0.038, -0.006, 0.0095]].forEach(([x, y, z, r]) => {
      const s = new THREE.IcosahedronGeometry(r, 1); s.scale(1, 0.75, 1.1); s.translate(x, y, z); parts.push(s);
    });
    return mergeGeometries(parts);
  })();
  const tailG = new THREE.ConeGeometry(0.012, 0.024, 6); tailG.rotateZ(-Math.PI / 2); tailG.scale(1, 0.4, 1.5);

  /* ----- a single nigiri / gunkan, length along +x, origin at its base ----- */
  function piece(kind) {
    const g = new THREE.Group();
    const rice = new THREE.Mesh(sphereG, riceMat);
    if (kind === 'ikura' || kind === 'uni') {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0175, 0.03, 20), riceMat); cyl.position.y = 0.015; g.add(cyl);
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.042, 28, 1, true), noriWall); wall.position.y = 0.021; g.add(wall);
      const top = new THREE.Mesh(kind === 'ikura' ? ikuraGeo : uniGeo, kind === 'ikura' ? ikuraMat : uniMat); g.add(top);
      return g;
    }
    rice.scale.set(0.034, 0.0165, 0.0195); rice.position.y = 0.0165; g.add(rice);
    if (kind === 'tamago') {
      const egg = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.022, 0.034, 3, 0.006), eggMat); egg.position.y = 0.038; g.add(egg);
      const band = new THREE.Mesh(new RoundedBoxGeometry(0.011, 0.027, 0.039, 2, 0.003), nori); band.position.y = 0.039; g.add(band);
    } else {
      const n = new THREE.Mesh(hemiG, neta[kind]); n.scale.set(0.043, 0.0135, 0.0245); n.position.y = 0.0255; g.add(n);
      if (kind === 'ebi') { const t = new THREE.Mesh(tailG, tailMat); t.position.set(0.045, 0.03, 0); g.add(t); }
    }
    return g;
  }

  /* ----- plates and vessels ----- */
  const hinokiTex = woodTex('#e6c99a', '120,80,40', 4);
  const hinokiMat = matte(0xffffff, { map: hinokiTex, roughness: 0.45 });
  const black = phys(0x15101a, { roughness: 0.14 });
  const white = phys(0xf6efe4, { roughness: 0.18 });
  const shuMat = phys(0xc8321b, { emissive: 0x240602 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8b45a, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.6 });
  const shadowTex = radialTex([[0, 'rgba(0,0,0,.75)'], [0.55, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']], 64);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false });
  const shadowG = new THREE.PlaneGeometry(1, 1); shadowG.rotateX(-Math.PI / 2);
  function blob(w, d, y = 0.002) { const m = new THREE.Mesh(shadowG, shadowMat); m.scale.set(w, 1, d); m.position.y = y; m.renderOrder = 2; return m; }

  function geta(len, w) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new RoundedBoxGeometry(len, 0.02, w, 2, 0.007), hinokiMat); board.position.y = 0.03; g.add(board);
    [-1, 1].forEach((s) => { const f = new THREE.Mesh(new RoundedBoxGeometry(len * 0.82, 0.02, 0.022, 2, 0.006), hinokiMat); f.position.set(0, 0.01, s * w * 0.36); g.add(f); });
    g.add(blob(len * 1.25, w * 1.5));
    g.userData.top = 0.04;
    return g;
  }
  function lathe(pts, mat, seg = 36) { return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat); }
  function roundPlate(r) {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.5 * r, 0], [0.9 * r, 0.01], [r, 0.024], [0.975 * r, 0.026], [0.55 * r, 0.011], [0, 0.011]], black));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.0023, 8, 48), goldMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.025; g.add(rim);
    g.add(blob(r * 2.7, r * 2.7)); g.userData.top = 0.011;
    return g;
  }
  function tray(len, w) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new RoundedBoxGeometry(len, 0.02, w, 2, 0.007), shuMat); a.position.y = 0.01; g.add(a);
    const b = new THREE.Mesh(new RoundedBoxGeometry(len - 0.03, 0.012, w - 0.03, 2, 0.005), black); b.position.y = 0.0185; g.add(b);
    g.add(blob(len * 1.3, w * 1.5)); g.userData.top = 0.025;
    return g;
  }
  function dish(r, liquid) {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [r * 0.6, 0], [r, 0.02], [r * 1.02, 0.026], [r * 0.95, 0.026], [r * 0.9, 0.014], [0, 0.01]], white, 28));
    if (liquid) { const l = new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 24), matte(liquid, { roughness: 0.05 })); l.rotation.x = -Math.PI / 2; l.position.y = 0.016; g.add(l); }
    g.add(blob(r * 3, r * 3));
    return g;
  }
  function tokkuri() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.04, 0], [0.05, 0.02], [0.052, 0.07], [0.036, 0.11], [0.017, 0.135], [0.019, 0.152], [0.026, 0.16], [0.02, 0.16], [0.0, 0.15]], phys(0x1b2a52, { roughness: 0.1 }), 24));
    g.add(blob(0.15, 0.15)); return g;
  }
  function ochoko() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.016, 0], [0.021, 0.012], [0.028, 0.042], [0.0265, 0.042], [0.02, 0.014], [0, 0.01]], white, 20));
    g.add(blob(0.08, 0.08)); return g;
  }
  function chopsticks() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.0048, 0.0028, 0.24, 8); geo.rotateX(Math.PI / 2);
    [-1, 1].forEach((s) => { const c = new THREE.Mesh(geo, matte(s > 0 ? 0x15101a : 0xc8321b, { roughness: 0.3 })); c.position.set(0, 0.012, s * 0.011); g.add(c); });
    const rest = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.012, 0.016, 2, 0.004), goldMat); rest.position.set(0, 0.006, 0.04); g.add(rest);
    return g;
  }

  function place(obj, x, z, ry = 0, s = TOY) { obj.position.set(x, TOP, z); obj.rotation.y = ry; obj.scale.setScalar(s); group.add(obj); mergeStatic(obj); return obj; }
  function onto(parent, kind, x, y, z, ry = 0) { const p = piece(kind); p.position.set(x, y, z); p.rotation.y = ry; parent.add(p); return p; }

  /* ----- scattered set-pieces along the counter ----- */
  const A = geta(0.3, 0.12); onto(A, 'tuna', -0.06, 0.04, 0, 0.1); onto(A, 'salmon', 0.065, 0.04, 0.003, -0.08); place(A, 0.12, -3.1, 0.35);
  const B = new THREE.Group(); const sd = dish(0.05, 0x1a0905); sd.position.set(0, 0, 0); B.add(sd);
  const gari = (() => { const g = new THREE.Group(); const m = matte(0xf2b0b6, { roughness: 0.4 }); const R = rng(4); for (let i = 0; i < 7; i++) { const p = new THREE.Mesh(sphereG, m); p.scale.set(0.013, 0.005, 0.011); p.position.set((R() - 0.5) * 0.02, 0.005 + i * 0.003, (R() - 0.5) * 0.02); p.rotation.y = R() * 3; g.add(p); } g.position.set(0.1, 0, 0.0); return g; })();
  const wasabi = (() => { const g = new THREE.Group(); const m = matte(0x8bc34a, { roughness: 0.3 }); const R = rng(8); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(sphereG, m); p.scale.setScalar(0.007 + R() * 0.004); p.position.set((R() - 0.5) * 0.014, 0.006 + (i > 2 ? 0.006 : 0), (R() - 0.5) * 0.014); g.add(p); } g.position.set(0.1, 0, -0.045); return g; })();
  B.add(gari, wasabi); const cs = chopsticks(); cs.position.set(-0.12, 0, 0.0); B.add(cs); place(B, 0.18, -5.3, 0.2);
  const C = roundPlate(0.16); onto(C, 'ikura', -0.06, 0.011, 0.02); onto(C, 'uni', 0.055, 0.011, 0.04); onto(C, 'ikura', 0.0, 0.011, -0.06); place(C, 0.05, -7.4, 0);
  const D = tray(0.3, 0.16); onto(D, 'ebi', -0.06, 0.025, 0.0); onto(D, 'tamago', 0.07, 0.025, 0.0, 0.05); place(D, 0.1, -9.6, -0.3);
  const E = new THREE.Group(); const tk = tokkuri(); tk.position.set(-0.06, 0, 0); E.add(tk); [[0.07, 0.05], [0.07, -0.05]].forEach(([x, z]) => { const o = ochoko(); o.position.set(x, 0, z); E.add(o); }); place(E, 0.08, -15.6, 0.5);
  const F = geta(0.3, 0.12); onto(F, 'hirame', -0.06, 0.04, 0, 0); onto(F, 'salmon', 0.065, 0.04, 0, 0.1); place(F, 0.1, -17.3, -0.25);
  const G = tray(0.3, 0.16); onto(G, 'tuna', -0.06, 0.025, 0); onto(G, 'tuna', 0.07, 0.025, 0, 0.1); place(G, 0.1, -24.2, 0.2);

  await yieldTask();

  /* ----- hero course: seven pieces on a long hinoki board ----- */
  const heroKinds = ['tamago', 'ebi', 'tuna', 'salmon', 'hirame', 'ikura', 'uni'];
  const HS = 1.7, HZ = -13.0, HX = 0.06;
  const hero = new THREE.Group(); hero.position.set(HX, TOP, HZ); hero.scale.setScalar(HS); group.add(hero);
  const hb = geta(0.15, 0.5); hb.rotation.y = 0; hero.add(hb);
  const heroPieces = heroKinds.map((k, i) => {
    const holder = new THREE.Group(); holder.position.set(0, 0.04, (i - 3) * 0.066);
    const p = piece(k); p.rotation.y = Math.PI / 2 * 0; holder.add(p); hero.add(holder);
    return { holder, p, lift: 0 };
  });
  // a pair of chopsticks and a dish beside the board
  const hd = dish(0.04, 0x1a0905); hd.position.set(0.15, 0, 0.0); hero.add(hd);
  const hg = chopsticks(); hg.position.set(-0.17, 0, 0); hero.add(hg);
  const heroFixed = new THREE.Group(); hero.add(heroFixed); [hb, hd, hg].forEach((o) => heroFixed.add(o)); mergeStatic(heroFixed);
  let hl = -1;

  await yieldTask();

  /* ----- the chef's tools ----- */
  const tools = new THREE.Group(); tools.position.set(0.02, TOP, -20.4); tools.scale.setScalar(1.45); group.add(tools);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.045, 0.78, 3, 0.012), hinokiMat); board.position.y = 0.0225; tools.add(board);
  tools.add(blob(0.62, 1.1));
  const fishMat = phys(0xff7a45, { roughness: 0.2 });
  const BL = 0.3;
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.056, BL, 3, 0.012), fishMat); tools.add(block);
  const marb = new THREE.Mesh(new RoundedBoxGeometry(0.102, 0.004, BL - 0.01, 1, 0.0015), matte(0xffe3cf, { roughness: 0.3 })); block.add(marb); marb.position.y = 0.012;
  const marb2 = marb.clone(); marb2.position.y = -0.008; block.add(marb2);
  const sliceG = new RoundedBoxGeometry(0.1, 0.014, 0.05, 2, 0.005);
  const slices = [0, 1, 2].map(() => { const m = new THREE.Mesh(sliceG, fishMat); m.visible = false; tools.add(m); return m; });
  const sliceRest = [[0.12, 0.052, 0.11, 0.12], [0.125, 0.052, 0.045, -0.05], [0.12, 0.052, -0.02, 0.16]];
  // yanagiba
  const knife = new THREE.Group(); tools.add(knife);
  const bs = new THREE.Shape(); bs.moveTo(0, 0); bs.lineTo(0.32, 0); bs.lineTo(0.37, 0.034); bs.lineTo(0.0, 0.034); bs.closePath();
  const bladeG = new THREE.ExtrudeGeometry(bs, { depth: 0.004, bevelEnabled: false }); bladeG.translate(0, 0, -0.002);
  const blade = new THREE.Mesh(bladeG, new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 1, roughness: 0.16, envMapIntensity: 2.2 })); knife.add(blade);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.004, 0.0055), new THREE.MeshStandardMaterial({ color: 0x9aa1a6, metalness: 1, roughness: 0.3 })); spine.position.set(0.185, 0.033, 0); knife.add(spine);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.02, 14), goldMat); fer.rotation.z = Math.PI / 2; fer.position.set(-0.008, 0.02, 0); knife.add(fer);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.12, 4, 12), matte(0x2a1a12, { roughness: 0.4 })); handle.rotation.z = Math.PI / 2; handle.position.set(-0.075, 0.021, 0); knife.add(handle);
  // hangiri (rice tub)
  const hang = new THREE.Group(); hang.position.set(-0.03, 0, 0.6); tools.add(hang);
  hang.add(lathe([[0, 0], [0.17, 0], [0.195, 0.02], [0.205, 0.105], [0.19, 0.105], [0.172, 0.03], [0, 0.03]], hinokiMat, 40));
  [0.045, 0.085].forEach((y) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2 - (0.1 - y) * 0.06, 0.004, 8, 48), goldMat); t.rotation.x = Math.PI / 2; t.position.y = y; hang.add(t); });
  const mound = new THREE.Mesh(sphereG, riceMatte); mound.scale.set(0.175, 0.07, 0.175); mound.position.y = 0.045; hang.add(mound);
  const paddle = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.007, 0.06, 2, 0.003), hinokiMat); paddle.position.set(0.0, 0.1, 0.0); paddle.rotation.set(0.1, 0.5, 0.35); hang.add(paddle);
  hang.add(blob(0.55, 0.55));
  // oroshi + wasabi
  const oro = new THREE.Group(); oro.position.set(0.0, 0.045, -0.5); oro.rotation.y = 0.2; tools.add(oro);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.014, 0.22, 2, 0.005), new THREE.MeshStandardMaterial({ color: 0xcfa86a, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5 })); plate.position.y = 0.008; plate.rotation.x = 0.0; oro.add(plate);
  for (let i = 0; i < 6; i++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.003), matte(0x5a4020, { roughness: 0.6 })); ln.position.set(0, 0.0165, -0.08 + i * 0.03); oro.add(ln); }
  const root = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.1, 4, 10), matte(0x7bb05a, { roughness: 0.4 })); root.rotation.set(0, 0.4, Math.PI / 2); root.position.set(0.1, 0.02, -0.02); oro.add(root);
  const wp = new THREE.Mesh(sphereG, matte(0x9ccc65, { roughness: 0.3 })); wp.scale.set(0.028, 0.014, 0.028); wp.position.set(0.0, 0.02, 0.1); oro.add(wp);
  const sd2 = dish(0.055, 0x1a0905); sd2.position.set(0.19, 0.0, 0.3); tools.add(sd2);
  const gr2 = gari.clone(); gr2.position.set(0.15, 0.0, 0.35); tools.add(gr2);
  const ch2 = chopsticks(); ch2.position.set(0.18, 0, -0.18); ch2.rotation.y = 0.12; tools.add(ch2);
  // everything on the tools board that never moves: one mesh per material
  const toolsFixed = new THREE.Group(); tools.add(toolsFixed);
  [board, hang, oro, sd2, gr2, ch2].forEach((o) => toolsFixed.add(o));
  tools.children.filter((o) => o.isMesh && o.material === shadowMat).forEach((o) => toolsFixed.add(o));
  mergeStatic(toolsFixed);

  /* ----- per-frame ----- */
  const ease = (x) => x * x * (3 - 2 * x);
  function update(st) {
    const u = st.u, t = st.t;
    // hero course: served one by one as the camera arrives
    heroPieces.forEach((hp, i) => {
      const p = ss(1.35 + i * 0.05, 1.72 + i * 0.05, u);
      const target = hl === i ? 1 : 0; hp.lift += (target - hp.lift) * Math.min(1, st.dt * 9);
      hp.holder.visible = p > 0.001;
      const sc = Math.max(0.001, p);
      hp.holder.scale.setScalar(sc * (1 + hp.lift * 0.14));
      hp.holder.position.y = 0.04 - (1 - p) * 0.05 + hp.lift * 0.03 + Math.sin(t * 1.4 + i) * 0.0012;
      hp.p.rotation.y = (1 - p) * 1.4 + hp.lift * Math.sin(t * 2.2) * 0.25;
    });

    // knife and the fish block: scrubbed by scroll
    const k0 = 2.6, k1 = 3.4;
    const s = clamp01((u - k0) / (k1 - k0)) * 3;
    const idx = Math.min(2, Math.floor(s)), f = s >= 3 ? 1 : s - idx;
    const cutDone = idx + (f > 0.8 ? ease(clamp01((f - 0.8) / 0.2)) : 0) + (s >= 3 ? 0 : 0);
    const nCut = s >= 3 ? 3 : idx + (f >= 0.8 ? 1 : 0);
    const Lb = BL - 0.045 * nCut;
    block.scale.z = Lb / BL; block.position.set(0, 0.0725, 0.15 - Lb / 2);
    const planeZ = -0.15 + 0.045 * (idx + 1);
    // knife pose
    let kx, ky;
    if (s <= 0) { kx = 0.06; ky = 0.3; }
    else if (f < 0.15) { const a = ease(f / 0.15); kx = lerp(idx === 0 ? 0.06 : -0.1, 0.06, a); ky = lerp(idx === 0 ? 0.3 : 0.26, 0.26, a); }
    else if (f < 0.3) { const a = ease((f - 0.15) / 0.15); kx = 0.06; ky = lerp(0.26, 0.15, a); }
    else if (f < 0.8) { const a = (f - 0.3) / 0.5; kx = lerp(0.06, -0.2, a); ky = lerp(0.15, 0.052, ease(a)); }
    else { const a = ease((f - 0.8) / 0.2); kx = lerp(-0.2, -0.1, a); ky = lerp(0.052, 0.26, a); }
    if (s >= 3) { kx = -0.1; ky = 0.26; }
    knife.position.set(kx, ky + Math.sin(t * 1.3) * 0.002, idx < 3 ? planeZ - 0.025 : 0);
    knife.rotation.set(0, 0, (f > 0.3 && f < 0.8 ? -0.05 : 0.04));
    slices.forEach((m, j) => {
      const done = j < idx || s >= 3;
      const cutting = j === idx && f >= 0.8 && s < 3;
      m.visible = done || cutting;
      if (!m.visible) return;
      const a = done ? 1 : ease((f - 0.8) / 0.2);
      const rz = sliceRest[j];
      const z0 = -0.15 + 0.045 * (j + 0.5);
      m.position.set(lerp(0, rz[0], a), lerp(0.0725, rz[1], a) + Math.sin(a * 3.14) * 0.03, lerp(z0, rz[2], a));
      m.rotation.set(0, lerp(0, rz[3], a), lerp(0, 0.0, a));
    });
  }

  return { group, update, highlight: (i) => { hl = i; }, heroCenter: new THREE.Vector3(HX, TOP, HZ) };
}
