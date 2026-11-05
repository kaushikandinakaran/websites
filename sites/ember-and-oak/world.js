// Ember & Oak - procedural pieces that Poly Haven does not provide: fire, coals, embers, logs,
// the sliced steak, knife, rosemary, salt, table, contact shadows. Real-world scale (metres).
import * as THREE from 'three';

// Noise comes from one baked, tileable texture (R: 4-octave fbm, G: value noise, A: fine fbm) instead of
// procedural loops: much cheaper to compile (Direct3D/ANGLE unrolls loops) and to run.
const NOISE = /* glsl */`
uniform sampler2D uNoise;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ return texture2D(uNoise, x.xy * 0.0625 + x.z * vec2(0.37, 0.61)).g; }
float fbm3(vec3 p){ return texture2D(uNoise, p.xy * 0.25 + p.z * vec2(0.29, 0.53)).r; }
float fineN(vec3 p){ return texture2D(uNoise, p.xy * 0.0625 + p.z * vec2(0.41, 0.23)).a; }
`;

function makeNoiseTexture() {
  const S = 256, data = new Uint8Array(S * S * 4);
  const lattice = (n, seed) => { const a = new Float32Array(n * n); let x = seed >>> 0; for (let i = 0; i < n * n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; a[i] = x / 4294967296; } return a; };
  const L = [4, 8, 16, 32, 64].map((n, i) => ({ n, a: lattice(n, 97 + i * 131) }));
  const val = ({ n, a }, u, v) => {
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = xi % n, x1 = (xi + 1) % n, y0 = yi % n, y1 = (yi + 1) % n;
    const t = a[y0 * n + x0] + (a[y0 * n + x1] - a[y0 * n + x0]) * fx, b = a[y1 * n + x0] + (a[y1 * n + x1] - a[y1 * n + x0]) * fx;
    return t + (b - t) * fy;
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S, k = (j * S + i) * 4;
    const n4 = val(L[0], u, v), n8 = val(L[1], u, v), n16 = val(L[2], u, v), n32 = val(L[3], u, v), n64 = val(L[4], u, v);
    data[k] = (0.5 * n4 + 0.25 * n8 + 0.125 * n16 + 0.0625 * n32) * 255;
    data[k + 1] = n16 * 255;
    data[k + 2] = n64 * 255;
    data[k + 3] = (0.5 * n16 + 0.3 * n32 + 0.2 * n64) * 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export const shared = { time: { value: 0 }, noise: { value: makeNoiseTexture() } };

/* ---------------------------------------------------------------- textures */
export function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function contactShadow(tex, w, d, opacity = 0.7) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}

/* ---------------------------------------------------------------- fire */
export function buildFire(tier) {
  const group = new THREE.Group();
  const t = shared.time;

  // flame tongues: cylindrical billboards with a scrolling-noise flame shader (HDR values for bloom)
  const flameGeo = new THREE.PlaneGeometry(1, 1, 1, 1); flameGeo.translate(0, 0.5, 0);
  const flameMat = (seed, inten) => new THREE.ShaderMaterial({
    uniforms: { uTime: t, uSeed: { value: seed }, uInt: { value: inten }, uNoise: shared.noise },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 sx = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 0.0);
        vec3 toCam = cameraPosition - c; toCam.y = 0.0; toCam = normalize(toCam + 1e-5);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        vec3 wp = c + right * position.x * sx.x + vec3(0.0, position.y * sx.y, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSeed, uInt;
      varying vec2 vUv;
      void main(){
        float T = uTime;
        vec2 q = vec2(vUv.x - 0.5, vUv.y);
        float n1 = fbm3(vec3(q.x * 2.6 + uSeed, q.y * 1.7 - T * 1.5, T * 0.22 + uSeed));
        float n2 = fbm3(vec3(q.x * 6.5 - uSeed, q.y * 4.2 - T * 2.7, T * 0.37));
        float n3 = vnoise(vec3(q.x * 14.0, q.y * 9.0 - T * 4.0, uSeed));
        float x = q.x + (n1 - 0.5) * 0.55 * vUv.y + (n2 - 0.5) * 0.08;
        float w = 0.30 * pow(max(0.0, 1.0 - vUv.y), 0.85) + 0.015;
        float shape = 1.0 - smoothstep(w * 0.25, w, abs(x));
        // tongues: the flame breaks up with height, licks detach near the top
        float flick = n2 * 1.15 + n1 * 0.55 + n3 * 0.18 - vUv.y * 1.3;
        float body = shape * smoothstep(0.08, 0.42, flick) * smoothstep(0.0, 0.07, vUv.y);
        float heat = clamp((flick - 0.05) * 1.6 * shape, 0.0, 1.0);
        vec3 col = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.28, 0.02), smoothstep(0.0, 0.35, heat));
        col = mix(col, vec3(1.0, 0.6, 0.16), smoothstep(0.35, 0.7, heat));
        col = mix(col, vec3(1.0, 0.86, 0.55), smoothstep(0.75, 1.0, heat));
        float base = smoothstep(0.25, 0.0, vUv.y) * shape * 0.35; // blue-free deep orange root
        gl_FragColor = vec4(col * (body * (0.35 + heat)) * uInt + vec3(0.6, 0.12, 0.0) * base * uInt, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const flames = [];
  const specs = [
    [0.0, 0.0, 0.52, 1.25, 1.5], [0.13, 0.08, 0.42, 1.0, 1.25], [-0.14, -0.05, 0.44, 1.05, 1.25],
    [0.05, -0.15, 0.34, 0.7, 1.1], [-0.07, 0.15, 0.36, 0.72, 1.1], [0.22, -0.1, 0.26, 0.5, 1.0], [-0.22, 0.06, 0.28, 0.55, 1.0],
  ].slice(0, tier === 0 ? 5 : 7);
  specs.forEach(([x, z, w, h, k], i) => {
    const m = new THREE.Mesh(flameGeo, flameMat(i * 7.31 + 1.7, k));
    m.position.set(x, 0.17, z); m.scale.set(w, h, 1); m.renderOrder = 5; m.frustumCulled = false;
    m.userData.base = h;
    flames.push(m); group.add(m);
  });

  // logs: charred cylinders with glowing cracks, stacked as a loose teepee
  const logMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.92, metalness: 0 });
  logMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = t; sh.uniforms.uNoise = shared.noise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = (modelMatrix * vec4(position, 1.0)).xyz; vLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vLP; uniform float uTime;\n' + NOISE + `
      // charred-wood "alligator" pattern: a jittered grid of blocks in cylinder coordinates; returns crack strength
      float charGrid(vec3 lp, out float cell){
        float ang = atan(lp.z, lp.x) / 6.2831 + 0.5;
        vec2 g = vec2(ang * 7.0, lp.y * 21.0);
        g.x += (vnoise(vec3(g.y * 1.7, 3.0, 1.0)) - 0.5) * 1.2;
        g.y += floor(g.x) * 0.37 + (vnoise(vec3(g.x * 1.9, 7.0, 2.0)) - 0.5) * 1.1;
        vec2 f = fract(g) - 0.5; vec2 id = floor(g);
        cell = h31(vec3(id, 5.0));
        float e = max(abs(f.x), abs(f.y));
        return smoothstep(0.43, 0.49, e) * (0.4 + 0.6 * vnoise(vec3(g * 3.1, 9.0)));
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cellR; float edge = charGrid(vLP, cellR);
        float grainN = fbm3(vLP * vec3(60.0, 8.0, 60.0));
        diffuseColor.rgb = mix(vec3(0.028, 0.02, 0.017), vec3(0.06, 0.045, 0.035), cellR * 0.7 + grainN * 0.3);
        diffuseColor.rgb *= 1.0 - edge * 0.8;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.8, 0.55, cellR);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float low = smoothstep(0.55, 0.12, vOP.y);
        float hotP = smoothstep(0.35, 0.75, fbm3(vOP * 9.0 + vec3(0.0, -uTime * 0.04, uTime * 0.03)));
        float pulse = 0.7 + 0.3 * sin(uTime * 1.9 + cellR * 20.0);
        vec3 ember = mix(vec3(0.9, 0.12, 0.0), vec3(1.0, 0.42, 0.06), hotP);
        totalEmissiveRadiance += ember * (edge * 3.2 * hotP + hotP * hotP * 0.35 * cellR) * low * pulse;`);
  };
  const logGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.62, 10, 6);
  const logs = [
    [0.0, 0.22, 0.12, 0.25, 0.0, 1.25], [0.0, 0.22, -0.12, -0.25, 0.0, 1.25], [0.12, 0.26, 0.0, 0.0, 1.57, 1.0],
    [-0.1, 0.3, 0.02, 0.62, 0.9, 0.55], [0.08, 0.3, -0.06, -0.55, 2.3, 0.55],
  ];
  logs.forEach(([x, y, z, rx, ry, rz]) => {
    const m = new THREE.Mesh(logGeo, logMat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = false;
    group.add(m);
  });

  // coal bed: instanced lumps with a breathing ember glow
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x120c09, roughness: 0.95 });
  coalMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = t; sh.uniforms.uNoise = shared.noise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uTime;\n' + NOISE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float g = fbm3(vWP * 26.0 + vec3(uTime * 0.12, 0.0, -uTime * 0.09));
        float hot = smoothstep(0.42, 0.78, g);
        float rad = smoothstep(0.42, 0.05, length(vWP.xz));
        totalEmissiveRadiance += mix(vec3(0.7, 0.08, 0.0), vec3(1.0, 0.45, 0.08), hot) * hot * 5.0 * rad;`);
  };
  const coalGeo = new THREE.IcosahedronGeometry(1, 1);
  const pa = coalGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const k = 0.75 + Math.random() * 0.5; pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k * 0.7, pa.getZ(i) * k); }
  coalGeo.computeVertexNormals();
  const nCoal = tier === 0 ? 50 : 110;
  const coals = new THREE.InstancedMesh(coalGeo, coalMat, nCoal);
  const o = new THREE.Object3D();
  for (let i = 0; i < nCoal; i++) {
    const r = Math.sqrt(Math.random()) * 0.42, a = Math.random() * Math.PI * 2;
    o.position.set(Math.cos(a) * r, 0.13 + Math.random() * 0.03, Math.sin(a) * r);
    o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    o.scale.setScalar(0.014 + Math.random() * 0.022);
    o.updateMatrix(); coals.setMatrixAt(i, o.matrix);
  }
  group.add(coals);

  // embers: additive points, rising on turbulent paths; a few drift toward the viewer
  const nE = tier === 0 ? 110 : tier === 1 ? 240 : 360;
  const eg = new THREE.BufferGeometry();
  const seeds = new Float32Array(nE * 4);
  for (let i = 0; i < nE; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random(); }
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nE * 3), 3));
  eg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const px = { value: 800 };
  const emberMat = new THREE.ShaderMaterial({
    uniforms: { uTime: t, uPx: px, uInt: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec4 aSeed; uniform float uTime, uPx; varying float vLife; varying float vHot;
      void main(){
        float speed = 0.16 + aSeed.y * 0.22;
        float life = fract(uTime * speed + aSeed.x);
        vLife = life; vHot = aSeed.w;
        float a = aSeed.z * 6.2831 + uTime * (0.6 + aSeed.w);
        float r = 0.06 + aSeed.y * 0.3 + life * (0.25 + aSeed.w * 0.6);
        vec3 p = vec3(cos(a) * r, 0.25 + life * (1.6 + aSeed.w * 1.4), sin(a) * r);
        p.x += sin(life * 9.0 + aSeed.x * 20.0) * 0.12 * life;
        p.z += life * life * (aSeed.w > 0.82 ? 1.6 : 0.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = (0.0035 + aSeed.y * 0.0045) * (1.0 - life * 0.5);
        gl_PointSize = max(1.0, s * uPx / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform float uInt; varying float vLife; varying float vHot;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        float fade = smoothstep(0.0, 0.06, vLife) * (1.0 - smoothstep(0.55 + vHot * 0.3, 1.0, vLife));
        vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.16, 0.01), vLife);
        gl_FragColor = vec4(col * a * fade * 3.2 * uInt, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const embers = new THREE.Points(eg, emberMat);
  embers.frustumCulled = false; embers.renderOrder = 6;
  group.add(embers);

  // fire light: a warm point light that breathes with the flames
  const LI = 12;
  const light = new THREE.PointLight(0xff8236, LI, 0, 2);
  light.position.set(0, 1.1, 0);
  group.add(light);

  function update(T) {
    const f = 0.82 + 0.1 * Math.sin(T * 7.3) + 0.06 * Math.sin(T * 13.7 + 1.3) + 0.05 * Math.sin(T * 23.1 + 0.4);
    light.intensity = LI * f;
    light.position.x = Math.sin(T * 3.1) * 0.04; light.position.z = Math.cos(T * 2.7) * 0.04;
    flames.forEach((m, i) => { m.scale.y = m.userData.base * (0.92 + 0.1 * Math.sin(T * (2.1 + i * 0.37) + i)); });
  }
  return { group, update, px, light, flames, embers };
}

/* ---------------------------------------------------------------- firewood stack */
export function buildWoodpile(tier) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNoise = shared.noise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cap = step(0.7, abs(vON.y));
        float rr = length(vOP.xz);
        float rings = 0.5 + 0.5 * sin(rr * 380.0 + fbm3(vOP * 40.0) * 9.0);
        vec3 endc = mix(vec3(0.20, 0.13, 0.08), vec3(0.30, 0.21, 0.13), rings * 0.6 + fineN(vOP * 300.0) * 0.4) * (0.7 + 0.5 * fbm3(vOP * 90.0));
        endc *= 1.0 - 0.5 * smoothstep(0.55, 0.8, fineN(vOP * 120.0 + 5.0));
        endc = mix(endc, vec3(0.12, 0.08, 0.05), smoothstep(0.85, 1.0, rr / 0.07));
        float bark = fbm3(vOP * vec3(30.0, 6.0, 30.0)) * 0.7 + fbm3(vOP * vec3(120.0, 14.0, 120.0)) * 0.5;
        vec3 side = vec3(0.16, 0.11, 0.08) * (0.5 + bark);
        diffuseColor.rgb = mix(side, endc, cap);`);
  };
  const geo = new THREE.CylinderGeometry(0.065, 0.07, 0.5, 12, 1);
  const rows = [5, 4, 3, 2];
  let n = 0; rows.forEach((r) => { n += r; });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const o = new THREE.Object3D();
  let k = 0;
  rows.forEach((r, row) => {
    for (let i = 0; i < r; i++) {
      o.position.set((i - (r - 1) / 2) * 0.138 + (Math.random() - 0.5) * 0.01, 0.07 + row * 0.12, (Math.random() - 0.5) * 0.06);
      o.rotation.set(Math.PI / 2, 0, (Math.random() - 0.5) * 0.08);
      o.rotateY(Math.random() * 6.28);
      const s = 0.85 + Math.random() * 0.3; o.scale.set(s, 1, s);
      o.updateMatrix(); mesh.setMatrixAt(k++, o.matrix);
    }
  });
  mesh.castShadow = tier > 0; mesh.receiveShadow = true;
  return mesh;
}

/* ---------------------------------------------------------------- table */
export function buildTable(woodTex, tier) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.9), woodTex);
  top.position.y = 0.73; top.castShadow = true; top.receiveShadow = true; g.add(top);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, metalness: 0.85, roughness: 0.55 });
  const legGeo = new THREE.BoxGeometry(0.05, 0.7, 0.05);
  [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]].forEach(([x, z]) => {
    const l = new THREE.Mesh(legGeo, iron); l.position.set(x, 0.35, z); l.castShadow = tier > 0; g.add(l);
  });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.04), iron); rail.position.set(0, 0.12, 0); g.add(rail);
  [-0.8, 0.8].forEach((x) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.76), iron); r.position.set(x, 0.12, 0); g.add(r); });
  return g;
}

/* ---------------------------------------------------------------- steak */
// A sliced strip steak: superellipse cross-section extruded per slice, shaded with crust, grey band,
// pink centre, muscle grain, fine marbling and a fat cap. Lit low and partly shadowed on purpose.
export function buildSteak(tier) {
  const A = 0.048, B = 0.016, N = 3.4; // half width, half height, superellipse exponent
  const shape = new THREE.Shape();
  const seg = 48;
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / N) * A;
    let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / N) * B;
    y *= 1 - 0.22 * Math.max(0, -x / A) * (y > 0 ? 1 : 0.25); // tapered tail end
    const wob = 1 + 0.018 * Math.sin(th * 3 + 1.1) + 0.012 * Math.sin(th * 7 + 0.4); // hand-cut, not machined
    x *= wob; y *= wob;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const mkGeo = (depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.0009, bevelSize: 0.0008, bevelSegments: 3, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, clearcoat: tier > 0 ? 0.12 : 0, clearcoatRoughness: 0.5, sheen: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAB = { value: new THREE.Vector3(A, B, N) }; sh.uniforms.uNoise = shared.noise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform vec3 uAB;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cut = smoothstep(0.55, 0.9, abs(vON.z));
        vec2 p = vOP.xy;
        float se = pow(pow(abs(p.x) / uAB.x, uAB.z) + pow(abs(p.y) / uAB.y, uAB.z), 1.0 / uAB.z);
        float dEdge = (1.0 - se) * uAB.y;              // metres from the outer edge (approx.)
        float grain = fineN(vec3(p.x * 1400.0, p.y * 220.0, vOP.z * 300.0)) * 0.7 + vnoise(vec3(p.x * 700.0 + p.y * 300.0, p.y * 90.0, 1.0)) * 0.3;
        float marb = smoothstep(0.66, 0.74, fbm3(vec3(p * 160.0, vOP.z * 40.0)));
        vec3 crust = vec3(0.055, 0.026, 0.012) * (0.5 + 1.0 * fbm3(vOP * 260.0));
        crust = mix(crust, vec3(0.006, 0.003, 0.002), smoothstep(0.55, 0.7, fbm3(vOP * 120.0 + 3.0)) * 0.85);
        crust = mix(crust, vec3(0.12, 0.06, 0.025), smoothstep(0.62, 0.78, fineN(vOP * 500.0)) * 0.6);
        vec3 grey = vec3(0.16, 0.085, 0.055);
        vec3 pink = mix(vec3(0.30, 0.075, 0.055), vec3(0.42, 0.085, 0.07), smoothstep(0.005, 0.012, dEdge));
        vec3 inside = mix(grey, pink, smoothstep(0.0025, 0.0085, dEdge));
        inside = mix(crust, inside, smoothstep(0.0006, 0.0018, dEdge));
        inside *= 0.72 + 0.5 * grain;
        inside = mix(inside, inside * vec3(0.75, 0.55, 0.5), smoothstep(0.55, 0.8, fbm3(vec3(p * 90.0, 2.0))) * 0.5); // uneven doneness
        inside = mix(inside, vec3(0.5, 0.3, 0.22), marb * 0.45 * smoothstep(0.004, 0.008, dEdge));
        float fat = smoothstep(0.55, 0.72, p.x / uAB.x) * smoothstep(-0.2, 0.4, p.y / uAB.y);
        inside = mix(inside, vec3(0.70, 0.52, 0.36) * (0.85 + 0.2 * grain), fat * smoothstep(0.0015, 0.004, dEdge));
        crust = mix(crust, vec3(0.16, 0.07, 0.025) * (0.6 + 0.6 * fbm3(vOP * 300.0)), fat * 0.8);
        diffuseColor.rgb = mix(crust, inside, cut);
        float wet = cut;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.72, 0.42, wet);');
  };
  mat.customProgramCacheKey = () => 'steak';
  const g = new THREE.Group();
  const T = 0.0115; // slice thickness
  const sliceGeo = mkGeo(T);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sliceGeo, mat);
    // slices fall away from the uncut end like dominoes, cut faces turned up toward the viewer (local -z)
    const a = 0.62 + i * 0.1;
    m.position.set(0.003 * i, B * Math.cos(a) + (T / 2) * Math.sin(a) + 0.0004, -0.004 - i * 0.021);
    m.rotation.set(a, 0.025 * i, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const endPiece = new THREE.Mesh(mkGeo(0.055), mat);
  endPiece.position.set(-0.002, B + 0.0005, 0.036);
  endPiece.castShadow = true; endPiece.receiveShadow = true;
  g.add(endPiece);
  g.userData.topY = B * 2;
  return g;
}

/* ---------------------------------------------------------------- knife */
export function buildKnife(woodMat) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.2, 0.004); s.quadraticCurveTo(0.235, 0.008, 0.25, 0.026);
  s.lineTo(0.004, 0.034); s.lineTo(0, 0.03); s.lineTo(0, 0);
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 8 }),
    new THREE.MeshStandardMaterial({ color: 0x8f8c88, metalness: 1, roughness: 0.42 }));
  blade.castShadow = true; g.add(blade);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.026, 0.016), woodMat);
  handle.position.set(-0.06, 0.017, 0.001); handle.castShadow = true; g.add(handle);
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, metalness: 1, roughness: 0.55 });
  [-0.025, -0.06, -0.095].forEach((x) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0172, 10), rivetMat);
    r.rotation.x = Math.PI / 2; r.position.set(x, 0.017, 0.001); g.add(r);
  });
  const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.012), rivetMat);
  bolster.position.set(0.002, 0.017, 0.001); g.add(bolster);
  return g;
}

/* ---------------------------------------------------------------- rosemary + salt */
export function buildRosemary() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.004, 0.01), new THREE.Vector3(0.1, 0.006, 0.005), new THREE.Vector3(0.14, 0.004, -0.01)]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0014, 5, false), new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.8 }));
  stem.castShadow = true; g.add(stem);
  const needleGeo = new THREE.CapsuleGeometry(0.0011, 0.016, 2, 4); needleGeo.rotateZ(Math.PI / 2); needleGeo.translate(0.009, 0, 0); needleGeo.scale(1, 0.55, 1);
  const n = 70;
  const needles = new THREE.InstancedMesh(needleGeo, new THREE.MeshStandardMaterial({ color: 0x2e4527, roughness: 0.55 }), n);
  const o = new THREE.Object3D(), p = new THREE.Vector3(), tg = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = 0.04 + (i / n) * 0.94;
    curve.getPointAt(u, p); curve.getTangentAt(u, tg);
    o.position.copy(p);
    const side = i % 2 ? 1 : -1;
    o.rotation.set(0, Math.atan2(-tg.z, tg.x) + side * (0.9 + Math.random() * 0.4), (Math.random() - 0.3) * 0.5);
    o.scale.setScalar(0.75 + 0.35 * Math.sin(u * 3.14));
    o.updateMatrix(); needles.setMatrixAt(i, o.matrix);
  }
  needles.castShadow = true; g.add(needles);
  return g;
}
export function buildSalt(n, spread, yFn) {
  const geo = new THREE.BoxGeometry(0.0022, 0.0008, 0.0018);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xcfc9c0, roughness: 0.35 }), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * spread[0], z = (Math.random() - 0.5) * spread[1];
    o.position.set(x, yFn(x, z), z);
    o.rotation.set(Math.random() * 0.6, Math.random() * 6, Math.random() * 0.6);
    o.scale.setScalar(0.6 + Math.random() * 0.9);
    o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  }
  return m;
}

/* ---------------------------------------------------------------- lamp light cone dust (subtle volume) */
export function buildDust(tier, center, size) {
  const n = tier === 0 ? 0 : 140;
  if (!n) return null;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * size[0]; pos[i * 3 + 1] = Math.random() * size[1]; pos[i * 3 + 2] = (Math.random() - 0.5) * size[2]; sd[i] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
  const px = { value: 800 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.time, uPx: px, uH: { value: size[1] } },
    vertexShader: 'attribute float aS; uniform float uTime, uPx, uH; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime * (0.01 + aS * 0.02), uH); p.x += sin(uTime * 0.3 + aS * 30.0) * 0.05; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, 0.004 * uPx / -mv.z); vA = 0.5 + 0.5 * sin(uTime + aS * 50.0); }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * smoothstep(0.5, 0.0, d) * 0.35 * vA, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.copy(center); pts.frustumCulled = false;
  return { points: pts, px };
}
