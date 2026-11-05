// Jade Teahouse (photo edition) - the few procedural pieces kept from the earlier site: the bamboo steamer and
// dumplings, steam, the tea stream and the tea in the cup, and soft contact shadows. Everything else in the scene
// is a real 360-degree photograph or a real Poly Haven scan (see scene.js and assets/CREDITS.txt).
import * as THREE from 'three';

const { clamp, smoothstep } = THREE.MathUtils;
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
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v + 0.0625 * 0.5; } // 3 octaves (steam is soft; saves fill cost)
`;

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
  const tone = Array.from({ length: n * 2 }, () => 0.7 + R() * 0.46);
  const cellT = Array.from({ length: n * n }, () => 0.86 + R() * 0.26); // every crossing a little different
  const jit = Array.from({ length: n * 2 }, () => (R() - 0.5) * 0.16); // strips are not all the same width
  const fib = Array.from({ length: S }, () => R());
  const h = new Float32Array(S * S);
  const c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / w), j = Math.floor(y / w);
    const fx = (x % w) / w, fy = (y % w) / w;
    const horizTop = ((i + j) & 3) < 2;
    const strip = horizTop ? j : n + i;
    const across = Math.min(0.999, Math.max(0, (horizTop ? fy : fx) + jit[strip] * (horizTop ? fy : fx) * (1 - (horizTop ? fy : fx)) * 4)), along = horizTop ? fx : fy;
    const edge = Math.min(across, 1 - across);
    const gap = edge < 0.07;
    // rounded strip, lower toward the cell ends where it dives under the crossing strip
    let hh = gap ? 0.05 : 0.45 + 0.4 * Math.sqrt(Math.sin(Math.PI * across)) * (0.78 + 0.22 * Math.sin(Math.PI * along));
    const f = fib[(horizTop ? y : x) % S], fibre = 0.9 + 0.16 * f + 0.05 * Math.sin((horizTop ? x : y) * 0.9 + strip);
    hh += (f - 0.5) * 0.06;
    h[y * S + x] = hh;
    const stain = 1 - 0.22 * Math.max(0, Math.sin(x * 0.031 + 1.3) * Math.sin(y * 0.027 + 0.4) + 0.35 * Math.sin((x + y) * 0.06)); // handled, steamed, uneven
    const k = gap ? 0.24 + 0.08 * f : tone[strip] * cellT[j * n + i] * fibre * stain * (0.6 + 0.44 * hh);
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
  const skin = new THREE.Color(0xf0e7d8), fill = new THREE.Color(0xd99a7e), crest = new THREE.Color(0xfaf4ea), gold = new THREE.Color(0xa86e3a), c = new THREE.Color();
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
    const spot = smoothstep(blob, 0.42, 0.8) * (yo < 0.1 ? 1 : 0.35); // a few browned spots where the skin touched the liner
    c.lerp(gold, spot * 0.7);
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
