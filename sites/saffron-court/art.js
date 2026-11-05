// Saffron Court - procedural art: arch outlines, textures, lathe profiles. No external assets.
import * as THREE from 'three';

export const COL = {
  maroon: '#4a1322', maroonDeep: '#240812', plaster: '#5e1a2c', brass: '#c9a24b', brassHi: '#f0d68a',
  teal: '#1f9e97', saffron: '#f5a524', cream: '#fbf0d9', clay: '#a2502e',
};

/* Deterministic hash noise so duplicated lathe seam vertices jitter identically. */
export function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ---------- Pointed (lancet) arch ---------- */
/* Returns the open arch outline as Vector2 points, right springing up over the apex and down the left side. */
export function archPoints(a, h0, rise, n = 28, scallops = 0, amp = 0) {
  const c = (rise * rise - a * a) / (2 * a);
  const R = a + c;
  const thMax = Math.atan2(rise, c);
  const right = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const th = u * thMax;
    let x = -c + R * Math.cos(th), y = h0 + R * Math.sin(th);
    if (scallops > 0 && i > 0) {
      const off = amp * Math.abs(Math.sin(scallops * Math.PI * u));
      const dx = (-c - x), dy = (h0 - y), len = Math.hypot(dx, dy) || 1;
      x += (dx / len) * off; y += (dy / len) * off;
    }
    right.push(new THREE.Vector2(x, y));
  }
  const left = right.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  return [...right, ...left];
}

/* Wall with an arched opening, extruded, centred on z. */
export function archFrameGeometry({ width, height, a, h0, rise, depth, scallops = 0, amp = 0, bevel = 0.06 }) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath();
  const hole = new THREE.Path();
  const pts = archPoints(a, h0, rise, 36, scallops, amp);
  hole.moveTo(-a, 0); hole.lineTo(a, 0);
  pts.forEach((p) => hole.lineTo(p.x, p.y));
  hole.lineTo(-a, 0);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/* Re-map UVs so each pier shows one mirrored tile: u from the opening edge to the outer edge, v by height. */
export function pierUV(g, a, width, height) {
  const pos = g.attributes.position, uv = g.attributes.uv, span = width / 2 - a;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.min(1, Math.max(0, (Math.abs(pos.getX(i)) - a) / span)), pos.getY(i) / height);
  return g;
}

/* Flat pointed-arch shape (upper part only) with 0..1 UVs, for jali screens. */
export function archFillGeometry(a, h0, rise, scallops = 0, amp = 0) {
  const pts = archPoints(a, h0, rise, 30, scallops, amp);
  const shape = new THREE.Shape(pts);
  const g = new THREE.ShapeGeometry(shape, 1);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + a) / (2 * a), (pos.getY(i) - h0) / rise);
  return g;
}

/* Glowing trim tube following the arch contour. */
export function archTrimGeometry(a, h0, rise, radius = 0.05, scallops = 0, amp = 0) {
  const pts = archPoints(a, h0, rise, 72, scallops, amp).map((p) => new THREE.Vector3(p.x, p.y, 0));
  pts.unshift(new THREE.Vector3(pts[0].x, 0.04, 0));
  pts.push(new THREE.Vector3(pts[pts.length - 1].x, 0.04, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(curve, 160, radius, 6, false);
}

/* ---------- Lathe profiles ---------- */
const P = (pairs) => pairs.map(([x, y]) => new THREE.Vector2(x, y));

export function bowlGeometry(seg = 28) {
  return new THREE.LatheGeometry(P([
    [0, 0], [0.26, 0], [0.33, 0.03], [0.48, 0.1], [0.6, 0.24], [0.66, 0.4], [0.68, 0.49], [0.655, 0.5],
    [0.625, 0.465], [0.575, 0.34], [0.46, 0.2], [0.3, 0.125], [0, 0.11],
  ]), seg);
}

/* Low-poly faceted mound of ground spice that sits in a bowl. */
export function moundGeometry(radius = 0.62, height = 0.62, seg = 12) {
  const prof = P([[radius, 0.1], [0.54, height * 0.3], [0.42, height * 0.52], [0.28, height * 0.76], [0.12, height * 0.94], [0, height]]);
  const g = new THREE.LatheGeometry(prof, seg);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const j = 1 + (hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)) - 0.5) * 0.2;
    pos.setXYZ(i, x * j, y + (j - 1) * 0.12, z * j);
  }
  g.computeVertexNormals();
  return g;
}

export function onionDomeGeometry() {
  return new THREE.LatheGeometry(P([
    [0, 0], [0.92, 0], [1.08, 0.18], [1.1, 0.42], [0.96, 0.72], [0.66, 1.05], [0.34, 1.42], [0.1, 1.82], [0.03, 2.05], [0, 2.1],
  ]), 36);
}

export function tandoorGeometry() {
  return new THREE.LatheGeometry(P([
    [0, 0], [1.5, 0], [1.82, 0.22], [2.0, 0.9], [1.9, 1.7], [1.62, 2.4], [1.32, 2.95], [1.16, 3.3], [1.2, 3.52],
    [1.12, 3.62], [0.98, 3.58], [0.92, 3.4], [0.9, 3.0],
  ]), 40);
}

export function thaliTrayGeometry() {
  return new THREE.LatheGeometry(P([
    [0, 0.0], [1.55, 0.0], [1.74, 0.05], [1.9, 0.2], [1.93, 0.27], [1.88, 0.275], [1.84, 0.18], [1.66, 0.1], [0, 0.085],
  ]), 56);
}

export function lanternShellGeometry() {
  // cap + base only; glow body is a separate emissive mesh
  const cap = new THREE.LatheGeometry(P([[0, 0.7], [0.34, 0.7], [0.4, 0.74], [0.36, 0.78], [0.2, 0.86], [0.05, 0.96], [0, 0.98]]), 12);
  const base = new THREE.LatheGeometry(P([[0, 0], [0.22, 0], [0.3, 0.05], [0.36, 0.14], [0.37, 0.2], [0, 0.2]]), 12);
  const ring = new THREE.TorusGeometry(0.05, 0.015, 6, 10); ring.translate(0, 1.04, 0);
  const ribs = [0, 1, 2, 3].map((i) => { const r = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5); r.translate(Math.cos(i * Math.PI / 2) * 0.285, 0.45, Math.sin(i * Math.PI / 2) * 0.285); return r; });
  const merge = (geos) => {
    const out = new THREE.BufferGeometry();
    let total = 0; geos.forEach((g) => { total += g.attributes.position.count; });
    const p = new Float32Array(total * 3), n = new Float32Array(total * 3); let o = 0;
    const idx = []; let vo = 0;
    geos.forEach((g) => {
      const gi = g.index; p.set(g.attributes.position.array, o * 3); n.set(g.attributes.normal.array, o * 3);
      if (gi) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + vo);
      else for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + vo);
      o += g.attributes.position.count; vo += g.attributes.position.count;
    });
    out.setAttribute('position', new THREE.BufferAttribute(p, 3)); out.setAttribute('normal', new THREE.BufferAttribute(n, 3)); out.setIndex(idx);
    return out;
  };
  return merge([cap, base, ring, ...ribs]);
}

export function diyaGeometry() {
  return new THREE.LatheGeometry(P([[0, 0], [0.1, 0], [0.16, 0.03], [0.22, 0.1], [0.24, 0.14], [0.2, 0.135], [0.16, 0.09], [0.08, 0.06], [0, 0.06]]), 14);
}

export function starAniseGeometry() {
  const s = new THREE.Shape(); const pts = 8;
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.2, a = (i / (pts * 2)) * Math.PI * 2;
    i === 0 ? s.moveTo(Math.cos(a) * r, Math.sin(a) * r) : s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -0.05);
  return g;
}

/* ---------- Canvas textures ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* Jali: interlocking circle lattice, white lines on black (used as an alpha map). */
export function jaliTexture(repeat = [3, 2]) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 11;
  const s = 128;
  for (let i = -1; i <= 4; i++) for (let j = -1; j <= 4; j++) {
    g.beginPath(); g.arc(i * s, j * s, s * 0.7071, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(i * s + s / 2, j * s + s / 2, s * 0.09, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { srgb: false, repeat, aniso: 8 });
}

/* Courtyard wall: blind pointed-arch niche with tile inlay. One tile = 7 world units wide. */
export function wallTexture(repeat) {
  const [c, g] = canvas(512, 704);
  const grd = g.createLinearGradient(0, 0, 0, 704);
  grd.addColorStop(0, '#3a0e1c'); grd.addColorStop(1, '#5a1a2b');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 704);
  // niche
  const nicheArch = (inset, color, lw, fill) => {
    const cx = 256, w = 150 - inset, h0 = 330, rise = 240 - inset, base = 650 - inset * 0.3;
    const cc = (rise * rise - w * w) / (2 * w), R = w + cc, th = Math.atan2(rise, cc);
    g.beginPath(); g.moveTo(cx - w, base); g.lineTo(cx - w, h0);
    for (let i = 0; i <= 24; i++) { const a = th * (i / 24); g.lineTo(cx - (-cc + R * Math.cos(a)) * 1, h0 - R * Math.sin(a)); }
    for (let i = 24; i >= 0; i--) { const a = th * (i / 24); g.lineTo(cx + (-cc + R * Math.cos(a)), h0 - R * Math.sin(a)); }
    g.lineTo(cx + w, base); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = color; g.lineWidth = lw; g.stroke(); }
  };
  nicheArch(0, '#c9a24b', 7, '#240812');
  nicheArch(18, 'rgba(201,162,75,.55)', 2.5, '#2d0b17');
  // teal spandrel diamonds
  g.fillStyle = '#1f9e97';
  [[84, 120], [428, 120], [256, 52]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 18, y); g.lineTo(x, y + 24); g.lineTo(x - 18, y); g.closePath(); g.fill(); });
  g.strokeStyle = '#c9a24b'; g.lineWidth = 2;
  [[84, 120], [428, 120], [256, 52]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 24, y); g.lineTo(x, y + 30); g.lineTo(x - 24, y); g.closePath(); g.stroke(); });
  // medallion in niche
  g.strokeStyle = '#e8cd82'; g.lineWidth = 3; g.beginPath(); g.arc(256, 300, 40, 0, 6.283); g.stroke();
  g.fillStyle = '#f5a524'; g.beginPath(); g.arc(256, 300, 10, 0, 6.283); g.fill();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.beginPath(); g.moveTo(256 + Math.cos(a) * 14, 300 + Math.sin(a) * 14); g.lineTo(256 + Math.cos(a) * 36, 300 + Math.sin(a) * 36); g.stroke(); }
  // wainscot band
  g.fillStyle = '#240812'; g.fillRect(0, 664, 512, 40);
  g.fillStyle = '#c9a24b'; g.fillRect(0, 660, 512, 4);
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#1f9e97' : '#f5a524'; g.beginPath(); const x = i * 32 + 16; g.moveTo(x, 672); g.lineTo(x + 9, 684); g.lineTo(x, 696); g.lineTo(x - 9, 684); g.closePath(); g.fill(); }
  return tex(c, { repeat, aniso: 8 });
}

/* Floor: khatam star tile, one tile = 6 world units. */
export function floorTexture(repeat) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#2b0b16'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(201,162,75,.7)'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 500);
  g.strokeStyle = 'rgba(201,162,75,.28)'; g.lineWidth = 2; g.strokeRect(20, 20, 472, 472);
  const star = (cx, cy, r1, r2, n, fill, stroke, lw) => {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = (i / (n * 2)) * 6.283 - Math.PI / 2; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  };
  star(256, 256, 214, 150, 8, '#3d1020', '#c9a24b', 4);
  star(256, 256, 150, 90, 8, '#561327', 'rgba(232,205,130,.8)', 3);
  star(256, 256, 84, 52, 8, '#1f9e97', '#e8cd82', 3);
  g.fillStyle = '#f5a524'; g.beginPath(); g.arc(256, 256, 22, 0, 6.283); g.fill();
  [[0, 0], [512, 0], [0, 512], [512, 512]].forEach(([x, y]) => star(x, y, 120, 70, 8, '#3d1020', 'rgba(201,162,75,.6)', 3));
  [[0, 0], [512, 0], [0, 512], [512, 512]].forEach(([x, y]) => { g.fillStyle = '#1f9e97'; g.beginPath(); g.arc(x, y, 34, 0, 6.283); g.fill(); });
  return tex(c, { repeat, aniso: 8 });
}

/* Rangoli (floor mandala) in spice colours. Transparent outside the disc. */
export function rangoliTexture() {
  const [c, g] = canvas(1024, 1024);
  const cx = 512, cy = 512;
  const petals = (n, r0, r1, w, colors, rot = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + rot; g.save(); g.translate(cx, cy); g.rotate(a);
      g.fillStyle = colors[i % colors.length];
      g.beginPath(); g.moveTo(r0, 0); g.quadraticCurveTo((r0 + r1) / 2, w, r1, 0); g.quadraticCurveTo((r0 + r1) / 2, -w, r0, 0); g.fill(); g.restore();
    }
  };
  const ring = (r, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke(); };
  g.fillStyle = '#240812'; g.beginPath(); g.arc(cx, cy, 498, 0, 6.283); g.fill();
  ring(490, 10, '#c9a24b'); ring(470, 3, 'rgba(232,205,130,.7)');
  // outer triangles
  for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.283; g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = i % 2 ? '#1f9e97' : '#f5a524'; g.beginPath(); g.moveTo(440, -16); g.lineTo(466, 0); g.lineTo(440, 16); g.closePath(); g.fill(); g.restore(); }
  petals(24, 300, 430, 36, ['#c4301f', '#f2b01e', '#e8751a', '#7aa34a']);
  ring(296, 6, '#c9a24b');
  petals(16, 190, 290, 40, ['#561327', '#f5a524', '#1f9e97'], 0.12);
  ring(186, 6, '#e8cd82');
  petals(8, 70, 180, 52, ['#f2b01e', '#c4301f'], 0.2);
  for (let i = 0; i < 32; i++) { const a = (i / 32) * 6.283; g.fillStyle = '#fbf0d9'; g.beginPath(); g.arc(cx + Math.cos(a) * 314, cy + Math.sin(a) * 314, 6, 0, 6.283); g.fill(); }
  g.fillStyle = '#c9a24b'; g.beginPath(); g.arc(cx, cy, 66, 0, 6.283); g.fill();
  g.fillStyle = '#f5a524'; g.beginPath(); g.arc(cx, cy, 36, 0, 6.283); g.fill();
  return tex(c, { aniso: 8 });
}

/* Bands for the tandoor clay body. */
export function tandoorTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#9a4a2b'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40},20,10,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
  const band = (y, h, col) => { g.fillStyle = col; g.fillRect(0, y, 256, h); };
  band(250, 40, '#1f9e97'); band(246, 4, '#c9a24b'); band(290, 4, '#c9a24b');
  for (let i = 0; i < 8; i++) { g.fillStyle = '#e8cd82'; g.beginPath(); const x = i * 32 + 16; g.moveTo(x, 258); g.lineTo(x + 10, 270); g.lineTo(x, 282); g.lineTo(x - 10, 270); g.closePath(); g.fill(); }
  band(150, 6, '#c9a24b'); band(380, 6, '#c9a24b');
  for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(232,205,130,.5)'; g.beginPath(); g.arc(i * 16 + 8, 400, 3, 0, 6.283); g.fill(); }
  return tex(c, { repeat: [3, 1], aniso: 4 });
}

/* Naan with char spots. */
export function naanTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e9c78a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,60,20,${0.25 + Math.random() * 0.4})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 8, 0, 6.283); g.fill(); }
  return tex(c);
}

/* Moon: crescent with glow. */
export function moonTexture() {
  const [c, g] = canvas(256, 256);
  const [m, mg] = canvas(256, 256);
  mg.fillStyle = '#f6e3ab'; mg.beginPath(); mg.arc(128, 128, 54, 0, 6.283); mg.fill();
  mg.globalCompositeOperation = 'destination-out'; mg.beginPath(); mg.arc(152, 114, 50, 0, 6.283); mg.fill();
  g.drawImage(m, 0, 0);
  g.globalCompositeOperation = 'destination-over';
  const gr = g.createRadialGradient(118, 134, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(255,225,160,.32)'); gr.addColorStop(1, 'rgba(255,225,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

/* Pier tile for the hall arches: diamond column with brass lines. */
export function pierTexture() {
  const [c, g] = canvas(256, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#4a1022'); gr.addColorStop(1, '#5c162a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = 'rgba(201,162,75,.7)'; g.lineWidth = 3;
  [30, 226].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); });
  g.strokeStyle = 'rgba(201,162,75,.3)'; g.lineWidth = 2;
  [42, 214].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); });
  for (let k = 0; k < 4; k++) {
    const cy = 64 + k * 128;
    g.fillStyle = '#1f9e97'; g.beginPath(); g.moveTo(128, cy - 52); g.lineTo(168, cy); g.lineTo(128, cy + 52); g.lineTo(88, cy); g.closePath(); g.fill();
    g.strokeStyle = '#c9a24b'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#240812'; g.beginPath(); g.moveTo(128, cy - 28); g.lineTo(148, cy); g.lineTo(128, cy + 28); g.lineTo(108, cy); g.closePath(); g.fill();
    g.fillStyle = '#f5a524'; g.beginPath(); g.arc(128, cy, 9, 0, 6.283); g.fill();
    g.fillStyle = '#c9a24b'; [cy - 64, cy + 64].forEach((y) => { g.beginPath(); g.arc(128, y, 5, 0, 6.283); g.fill(); });
    g.fillStyle = '#e8cd82'; [[64, cy], [192, cy]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 8, y); g.lineTo(x, y + 12); g.lineTo(x - 8, y); g.closePath(); g.fill(); });
  }
  return tex(c, { aniso: 8 });
}
