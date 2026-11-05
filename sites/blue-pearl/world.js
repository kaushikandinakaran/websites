// Blue Pearl - procedural underwater world. Everything is built from code: no models, no image files.
// Art direction: glassy, calm, stylised. Soft turquoise light from above, deep teal below.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const BED = -62;                 // base height of the seabed
export const HERO = { x: 0, z: -28 };   // the giant oyster
export const SUN = new THREE.Vector3(14, 0, -34);

const { clamp, lerp, smoothstep } = THREE.MathUtils;

let PATH = [];
export function setPath(pts) { PATH = pts.filter((p) => p.y < -40).map((p) => [p.x, p.z]); }
function nearPath(x, z, r = 3.4) { for (const p of PATH) if (Math.hypot(x - p[0], z - p[1]) < r) return true; return false; }

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bedHeight(x, z) {
  let h = 0.95 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4)
        + 0.5 * Math.sin(x * 0.27 + z * 0.21 + 2.0)
        + 0.2 * Math.sin(x * 0.63 - z * 0.51);
  const d = Math.hypot(x - HERO.x, z - HERO.z);
  const flat = smoothstep(d, 4, 12);
  const mound = 0.5 * Math.exp(-(d * d) / 16);
  return BED + h * flat + mound;
}

/* ------------------------------------------------------------------ shared uniforms */
export function makeUniforms(tier = 'high') {
  // causMode: 0 = none (phones), 1 = one texture lookup (mid), 2 = two lookups (high)
  const causMode = tier === 'low' ? 0 : tier === 'mid' ? 1 : 2;
  return {
    time: { value: 0 },
    caus: { value: 0.5 },
    causMode,
    causTex: { value: causMode > 0 ? makeCausticTexture() : null },
    fogColor: { value: new THREE.Color('#0a4954') },
    fogDensity: { value: 0.03 },
    shaft: { value: 1 },
    open: { value: 0 },
  };
}

/* ------------------------------------------------------------------ caustics */
// One small tileable texture is baked once on the CPU. The shader only scrolls two lookups through it
// (instead of ~16 sin/abs/pow calls per fragment), and phones skip caustics completely.
function makeCausticTexture(N = 256) {
  const data = new Uint8Array(N * N * 4);
  const T = Math.PI * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const px = 3 * u + 0.30 * Math.sin(T * (2 * v + 0.15)) + 0.12 * Math.sin(T * (u + v));
    const py = 3 * v + 0.30 * Math.sin(T * (2 * u + 0.60)) + 0.12 * Math.sin(T * (u - v));
    const a = 1 - Math.abs(Math.sin(Math.PI * px)), b = 1 - Math.abs(Math.sin(Math.PI * py));
    let c = Math.max(a, b, 0); c *= c; c *= c; c *= c;          // sharpen into thin bright lines
    const k = (y * N + x) * 4, g = Math.round(c * 255);
    data[k] = data[k + 1] = data[k + 2] = g; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// The strength is a uniform (not baked into the code), so every material with the same features shares one
// shader program: fewer programs to compile at start-up.
export function withCaustics(material, U, opts = {}) {
  const strength = (opts.strength ?? 1);
  const mode = strength > 0 ? U.causMode : 0;
  const key = 'caus' + (opts.sway ? 'S' : '') + (opts.fish ? 'F' : '') + 'm' + mode;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uCaus = U.caus;
    sh.uniforms.uStrength = { value: strength };
    if (mode > 0) sh.uniforms.uCausTex = U.causTex;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        ${mode > 0 ? 'varying vec3 vWPos;' : ''}
        uniform float uTime;
        ${opts.fish ? 'attribute float aPhase;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${opts.sway ? `
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 1.3;
        #else
          float ph = 0.0;
        #endif
        float hh = clamp(position.y / 7.0, 0.0, 1.0);
        transformed.x += sin(uTime * 0.9 + position.y * 0.55 + ph) * hh * hh * 1.1;
        transformed.z += cos(uTime * 0.7 + position.y * 0.4 + ph * 1.3) * hh * hh * 0.7;` : ''}
        ${opts.fish ? `
        float tailAmt = smoothstep(0.2, -0.8, position.x);
        transformed.z += sin(uTime * 9.0 + aPhase - position.x * 5.0) * 0.16 * tailAmt;` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        ${mode > 0 ? `
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif` : ''}`);
    if (mode === 0) return;
    const sample = mode === 1 ? 'texture2D(uCausTex, vWPos.xz * 0.085 + vec2(uTime * 0.010, uTime * 0.006)).r * 1.1'
      : `causticMix()`;
    const decl = mode === 1 ? '' : `
        uniform sampler2D uCausTex;
        float causticMix(){
          float c1 = texture2D(uCausTex, vWPos.xz * 0.085 + vec2(uTime * 0.010, uTime * 0.006)).r;
          float c2 = texture2D(uCausTex, vWPos.xz * 0.13 + vec2(-uTime * 0.008, uTime * 0.012) + 0.37).r;
          return c1 * 0.55 + c2 * 0.35 + c1 * c2 * 1.3;
        }`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform float uTime;
        uniform float uCaus;
        uniform float uStrength;
        ${mode === 1 ? 'uniform sampler2D uCausTex;' : ''}
        ${decl}`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float up = clamp(wn.y * 0.6 + 0.4, 0.0, 1.0);
          float cs = ${sample} * uCaus * up * uStrength;
          outgoingLight += diffuseColor.rgb * cs * vec3(0.75, 1.0, 0.95);
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/* ------------------------------------------------------------------ sky dome (vertical water gradient + sun glow) */
export function makeDome(U) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#7fe6df') },
      uBottom: { value: new THREE.Color('#0b6a76') },
      uFog: U.fogColor,
      uSun: { value: new THREE.Vector3(0.3, 0.9, -0.5).normalize() },
      uSunStr: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uFog; uniform vec3 uSun; uniform float uSunStr;
      varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 col = mix(uBottom, uFog, smoothstep(-0.55, 0.02, h));
        col = mix(col, uTop, smoothstep(0.04, 0.95, h));
        float g = max(dot(normalize(vDir), uSun), 0.0);
        col += vec3(0.85, 1.0, 0.95) * (pow(g, 22.0) * 0.28 + pow(g, 120.0) * 0.5) * uSunStr;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ the surface seen from below */
export function makeSurface(U) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: U.time, uFogColor: U.fogColor, uFogDensity: U.fogDensity,
      uSunPos: { value: SUN.clone() },
      uTint: { value: new THREE.Color('#25a6ae') },
    },
    vertexShader: /* glsl */`
      varying vec3 vWPos;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uSunPos; uniform vec3 uTint;
      varying vec3 vWPos;
      void main(){
        vec2 p = vWPos.xz * 0.07;
        float w1 = sin(p.x*3.1 + uTime*0.50 + sin(p.y*2.3 + uTime*0.30)*1.6);
        float w2 = sin(p.y*3.7 - uTime*0.40 + sin(p.x*2.9 - uTime*0.35)*1.4);
        float ridge = pow(max(1.0 - abs(w1*w2), 0.0), 4.0);
        vec3 col = uTint * (0.7 + 0.2*w1*w2);
        col += vec3(0.35, 0.8, 0.78) * ridge * 0.42;
        float d = distance(vWPos.xz, uSunPos.xz);
        col += vec3(1.0, 0.97, 0.88) * (exp(-d*d*0.004) * 1.0 + exp(-d*d*0.0004) * 0.14);
        float cd = distance(cameraPosition, vWPos);
        float f = 1.0 - exp(-uFogDensity*uFogDensity*cd*cd*0.45);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 520).rotateX(Math.PI / 2), mat);
  mesh.position.y = 0;
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ light shafts */
function shaftMaterial(U, shaftU, seed, strength, color, flip) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: U.time, uShaft: shaftU, uSeed: { value: seed }, uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength }, uFlip: { value: flip ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vWPos;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uShaft; uniform float uSeed; uniform vec3 uColor; uniform float uStrength; uniform float uFlip;
      varying vec2 vUv; varying vec3 vWPos;
      void main(){
        float edge = smoothstep(0.0, 0.5, 0.5 - abs(vUv.x - 0.5));
        float y = clamp(uFlip > 0.5 ? 1.0 - vUv.y : vUv.y, 0.0, 1.0);
        float vert = pow(y, 1.35) * smoothstep(0.0, 0.04, 1.0 - y);
        float stripe = 0.62 + 0.38 * sin(vUv.x*20.0 + uTime*0.5 + uSeed*7.0) * sin(vUv.x*8.0 - uTime*0.35 + uSeed);
        float near = smoothstep(2.0, 10.0, distance(cameraPosition, vWPos));
        float a = edge * vert * stripe * uStrength * uShaft * near;
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function makeShafts(U, count) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
  const rand = rng(11);
  for (let i = 0; i < count; i++) {
    const mat = shaftMaterial(U, U.shaft, rand() * 10, 0.16 + rand() * 0.12, '#aef5ee', false);
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(geo, mat);
      const w = 5 + rand() * 9;
      m.scale.set(w, 60 + rand() * 24, 1);
      m.position.set(-32 + rand() * 78, 0.6, -52 + rand() * 62);
      m.rotation.set(0, rand() * Math.PI + k * Math.PI * 0.5, 0);
      m.rotateZ(-0.2 + (rand() - 0.5) * 0.06);
      m.frustumCulled = false;
      group.add(m);
    }
  }
  return group;
}

/* The beam of light that falls onto the oyster when it opens. */
export function makePearlBeam(U, origin) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const mat = shaftMaterial(U, U.open, 3.3, 0.34, '#bffcf5', true);
  for (let k = 0; k < 2; k++) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(9, 26, 1);
    m.rotation.y = k * Math.PI * 0.5 + 0.4;
    m.frustumCulled = false;
    group.add(m);
  }
  group.position.copy(origin);
  return group;
}

/* ------------------------------------------------------------------ bubbles (GPU instanced) */
export function makeBubbles(U, count) {
  const base = new THREE.IcosahedronGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.normal = base.attributes.normal;
  const r = rng(5);
  const seed = new Float32Array(count * 4), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 34;
    seed[i * 4] = Math.cos(a) * rad + 2;
    seed[i * 4 + 1] = Math.sin(a) * rad - 20;
    seed[i * 4 + 2] = r();
    seed[i * 4 + 3] = 0.04 + Math.pow(r(), 3.2) * 0.34;
    speed[i] = 1.2 + r() * 2.6;
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uFogDensity: U.fogDensity, uBottom: { value: BED + 1 }, uTop: { value: -0.5 }, uFogColor: U.fogColor },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uBottom; uniform float uTop;
      attribute vec4 aSeed; attribute float aSpeed;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      void main(){
        float H = uTop - uBottom;
        float y = mod(aSeed.z * H + uTime * aSpeed, H) + uBottom;
        vec3 c = vec3(aSeed.x + sin(uTime*0.8 + aSeed.z*30.0) * 0.4, y, aSeed.y + cos(uTime*0.7 + aSeed.z*20.0) * 0.4);
        vec3 p = c + position * aSeed.w;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFogDensity; uniform vec3 uFogColor;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      void main(){
        float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float rim = pow(max(f, 0.0), 2.4);
        float hi = pow(max(dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))), 0.0), 18.0);
        float fog = exp(-uFogDensity*uFogDensity*vDist*vDist*0.9);
        float a = (rim * 0.8 + hi * 0.9 + 0.035) * fog;
        vec3 col = mix(vec3(0.62, 0.95, 0.93), vec3(1.0), hi);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}

/* A column of bubbles that rises from the giant oyster as it opens. */
export function makeBurst(U, count, origin) {
  const base = new THREE.IcosahedronGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.normal = base.attributes.normal;
  const r = rng(77);
  const seed = new Float32Array(count * 4), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 1.9;
    seed[i * 4] = Math.cos(a) * rad; seed[i * 4 + 1] = Math.sin(a) * rad * 1.3;
    seed[i * 4 + 2] = r(); seed[i * 4 + 3] = 0.05 + Math.pow(r(), 2.6) * 0.3;
    speed[i] = 0.5 + r() * 1.2;
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uOpen: U.open, uFogDensity: U.fogDensity, uOrigin: { value: origin.clone() } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uOpen; uniform vec3 uOrigin;
      attribute vec4 aSeed; attribute float aSpeed;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      void main(){
        float ph = uOpen * 3.0 + uTime * 0.25;
        float rise = mod(aSeed.z * 24.0 + ph * aSpeed * 9.0, 26.0);
        vec3 c = uOrigin + vec3(aSeed.x + sin(uTime + aSeed.z*40.0)*0.3, rise, aSeed.y + cos(uTime*0.8 + aSeed.z*30.0)*0.3);
        float grow = smoothstep(0.12, 0.45, uOpen) * (1.0 - smoothstep(18.0, 26.0, rise));
        vec3 p = c + position * aSeed.w * grow;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFogDensity;
      varying vec3 vN; varying vec3 vV; varying float vDist;
      void main(){
        float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float rim = pow(max(f, 0.0), 2.2);
        float hi = pow(max(dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))), 0.0), 16.0);
        float fog = exp(-uFogDensity*uFogDensity*vDist*vDist*0.7);
        float a = (rim * 0.85 + hi + 0.04) * fog;
        gl_FragColor = vec4(mix(vec3(0.7, 0.98, 0.96), vec3(1.0), hi), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return mesh;
}

/* ------------------------------------------------------------------ marine snow */
// Marine snow lives in a box that wraps around the camera. A second, larger and dimmer layer (far = true)
// fills the middle distance so the open water reads as deep. Both layers share one shader program.
export function makeSnow(U, count, far = false) {
  const r = rng(far ? 19 : 9);
  const pos = new Float32Array(count * 3), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r(); size[i] = 0.4 + r() * 1.0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const box = far ? new THREE.Vector3(110, 56, 110) : new THREE.Vector3(46, 30, 46);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: U.time, uPx: { value: 1 }, uAlpha: { value: far ? 0.55 : 1 }, uBox: { value: box },
      uFade: { value: far ? new THREE.Vector2(58, 18) : new THREE.Vector2(46, 8) }, uSizeK: { value: far ? 120 : 70 },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPx; uniform vec3 uBox; uniform vec2 uFade; uniform float uSizeK;
      attribute float aSize; varying float vA;
      void main(){
        vec3 p = position * uBox;
        p.y -= uTime * (0.25 + aSize * 0.25);
        p.x += sin(uTime*0.2 + position.z*20.0) * 0.8;
        vec3 rel = mod(p - cameraPosition + uBox*0.5, uBox) - uBox*0.5;
        vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
        float d = -mv.z;
        gl_PointSize = clamp(aSize * uSizeK * uPx / d, 1.0, 14.0 * uPx);
        vA = smoothstep(uFade.x, uFade.y, d) * smoothstep(0.5, 2.5, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        float a = smoothstep(0.5, 0.05, r) * vA * 0.5 * uAlpha;
        gl_FragColor = vec4(0.75, 1.0, 0.98, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  return pts;
}

/* ------------------------------------------------------------------ seabed */
export function makeSeabed(U, tier) {
  const seg = tier === 'low' ? [90, 70] : [150, 112];
  const geo = new THREE.PlaneGeometry(220, 170, seg[0], seg[1]).rotateX(-Math.PI / 2).translate(0, 0, -30);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c1 = new THREE.Color('#b8b19c'), c2 = new THREE.Color('#7f9a95'), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = bedHeight(x, z);
    p.setY(i, h);
    const t = clamp((h - BED + 1.4) / 3.0, 0, 1);
    tmp.copy(c2).lerp(c1, t);
    const n = 0.92 + 0.08 * Math.sin(x * 1.7) * Math.sin(z * 1.3);
    col[i * 3] = tmp.r * n; col[i * 3 + 1] = tmp.g * n; col[i * 3 + 2] = tmp.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.15 }), U, { key: 'bed', strength: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ shells */
const smooth = (a, b, x) => smoothstep(x, a, b);

function finish(g) {
  g.deleteAttribute('uv');
  const ng = mergeVertices(g, 1e-4);
  ng.computeVertexNormals();
  return ng;
}

// One oyster valve. sign +1 = upper (flatter), -1 = lower (deeper cup). Hinge end is -z.
export function valveGeometry(sign, seed = 1, w = 40, h = 22) {
  const g = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, sign > 0 ? 0 : Math.PI / 2, Math.PI / 2);
  g.deleteAttribute('normal');
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rho = Math.min(1, Math.hypot(x, z));
    const ang = Math.atan2(x, z);
    const taper = lerp(0.58, 1.0, smooth(-1.0, 0.35, z));
    let X = x * 0.92 * taper, Z = z * 1.25;
    const wob = 1 + 0.07 * Math.sin(ang * 5 + seed) * Math.pow(rho, 3) + 0.045 * Math.sin(ang * 11 + seed * 2) * Math.pow(rho, 4);
    X *= wob; Z *= wob;
    const depth = sign > 0 ? 0.2 : 0.36;
    let Y = Math.abs(y) * depth * sign;
    const ring = Math.sin(rho * 46 + Math.sin(ang * 3 + seed) * 2.2);
    const radial = Math.sin(ang * 17 + seed) * Math.pow(rho, 2);
    Y += sign * (0.026 * ring * rho + 0.02 * radial);
    p.setXYZ(i, X, Y, Z);
    const shade = 0.82 + 0.1 * ring * rho + 0.08 * radial;
    col[i * 3] = shade; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return finish(g);
}

export function closedOysterGeometry(seed = 1) {
  const up = valveGeometry(1, seed, 28, 14), lo = valveGeometry(-1, seed + 3, 28, 14);
  up.translate(0, 0.015, 0);
  return mergeGeometries([up, lo]);
}

export function scallopGeometry(seed = 1) {
  const nu = 18, nv = 44;
  const pos = [], idx = [], col = [];
  for (let i = 0; i <= nu; i++) {
    const r = i / nu;
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      const a = v * 1.08;
      const edge = r > 0.92 ? 1 + 0.02 * Math.sin(v * Math.PI * 18) : 1;
      const R = r * 1.5 * edge;
      const rib = Math.cos(v * Math.PI * 9);
      const x = Math.sin(a) * R, z = Math.cos(a) * R;
      const y = 0.46 * Math.sin(Math.min(r, 1) * Math.PI * 0.62) * (1 - v * v * 0.55) + rib * 0.045 * Math.pow(r, 1.2);
      pos.push(x, y, z);
      const s = 0.8 + 0.14 * rib * r + 0.06 * Math.sin(r * 22);
      col.push(s, s, s);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // little hinge ears
  const ear = new THREE.BoxGeometry(0.5, 0.06, 0.26).translate(0, 0.04, 0.1);
  ear.deleteAttribute('uv');
  const ec = new Float32Array(ear.attributes.position.count * 3).fill(0.78);
  ear.setAttribute('color', new THREE.BufferAttribute(ec, 3));
  return mergeGeometries([g, ear]);
}

export function spiralGeometry() {
  const turns = 3.6, nu = 70, nv = 14;
  const pos = [], idx = [], col = [];
  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * turns * Math.PI * 2;
    const w = Math.exp(-0.115 * u);
    const cx = Math.cos(u) * w, cz = Math.sin(u) * w;
    const cy = (1 - w) * 3.0;
    const rho = w * 0.52 * (i === 0 ? 1 : 1);
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * Math.PI * 2;
      const nx = Math.cos(u), nz = Math.sin(u);
      pos.push(cx + rho * Math.cos(v) * nx, cy + rho * Math.sin(v), cz + rho * Math.cos(v) * nz);
      const s = 0.78 + 0.16 * Math.sin(u * 3.0) * 0.5 + 0.1 * Math.cos(v);
      col.push(s, s, s);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // lay the shell on its side: spiral axis (y) becomes horizontal
  g.rotateZ(Math.PI / 2.4);
  g.scale(0.45, 0.45, 0.45);
  return g;
}

function coralGeometry(seed = 3) {
  const r = rng(seed), parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  function branch(origin, dir, len, rad, depth) {
    const g = new THREE.CylinderGeometry(rad * 0.62, rad, len, 7, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const m = new THREE.Matrix4().compose(origin, q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    g.deleteAttribute('uv');
    parts.push(g);
    const tip = origin.clone().addScaledVector(dir, len);
    if (depth > 0) {
      const n = depth === 3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.1, (r() * 0.3), (r() - 0.5) * 1.1)).normalize();
        branch(tip, d, len * 0.72, rad * 0.68, depth - 1);
      }
    } else {
      const s = new THREE.SphereGeometry(rad * 0.62, 7, 5); s.translate(tip.x, tip.y, tip.z); s.deleteAttribute('uv'); parts.push(s);
    }
  }
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.9, 0.2, 3);
  const g = mergeGeometries(parts);
  const c = new Float32Array(g.attributes.position.count * 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const s = 0.7 + 0.3 * smoothstep(p.getY(i), 0, 2.6); c[i * 3] = s; c[i * 3 + 1] = s; c[i * 3 + 2] = s; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.22 * Math.sin(x * 3.1 + y * 2.3) * Math.cos(z * 2.7 + x) + 0.1 * Math.sin(y * 7 + z * 5);
    p.setXYZ(i, x * n, y * n * 0.62, z * n);
  }
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals();
  return m;
}

function kelpGeometry() {
  const g = new THREE.PlaneGeometry(0.55, 7, 1, 14).translate(0, 3.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 7; p.setX(i, p.getX(i) * (1 - 0.75 * t) * (1 + 0.4 * Math.sin(t * 9))); }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ the seabed garden (oysters, shells, coral, kelp, rocks) */
export function makeGarden(U, tier) {
  const group = new THREE.Group();
  const r = rng(21);
  const f = tier === 'low' ? 0.5 : tier === 'mid' ? 0.75 : 1;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const place = (mesh, n, fn) => {
    for (let i = 0; i < n; i++) {
      fn(dummy, color, i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const scatter = (zoneFn) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = (r() - 0.5) * 70, z = 14 - r() * 62;
      if (Math.hypot(x - HERO.x, z - HERO.z) < 6.5 || nearPath(x, z)) continue;
      if (!zoneFn || zoneFn(x, z)) return [x, z];
    }
    return [30, -40];
  };

  // oysters in reefs
  const reefs = [[-9, -4], [6, -10], [-13, -19], [13, -21], [-1, -17], [-6, -38], [10, -40], [-20, -8], [20, -4], [3, -6]];
  const oysterCount = Math.round(64 * f);
  const oysters = new THREE.InstancedMesh(closedOysterGeometry(2), withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.35 }), U, { key: 'oy', strength: 0.6 }), oysterCount);
  place(oysters, oysterCount, (d, c, i) => {
    const reef = reefs[i % reefs.length];
    let x = reef[0] + (r() - 0.5) * 6.5, z = reef[1] + (r() - 0.5) * 6.5;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 6.5) { x += 7; }
    const s = 0.7 + r() * 0.85;
    if (nearPath(x, z, 2.2)) x += 6;
    d.position.set(x, bedHeight(x, z) + 0.06 * s, z);
    d.rotation.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.2);
    d.scale.set(s, s, s);
    c.setHSL(0.47 + r() * 0.06, 0.12 + r() * 0.1, 0.38 + r() * 0.14);
  });

  // scallops
  const scN = Math.round(30 * f);
  const scallops = new THREE.InstancedMesh(scallopGeometry(), withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.04, side: THREE.DoubleSide, envMapIntensity: 0.7 }), U, { key: 'sc', strength: 1 }), scN);
  place(scallops, scN, (d, c, i) => {
    const [x, z] = scatter();
    const s = 0.35 + r() * 0.5;
    d.position.set(x, bedHeight(x, z) + 0.05, z);
    const flip = r() < 0.4;
    d.rotation.set(flip ? Math.PI + (r() - 0.5) * 0.2 : (r() - 0.5) * 0.18, r() * Math.PI * 2, 0);
    d.scale.set(s, s, s);
    const pick = r();
    if (pick < 0.45) c.set('#f2d9c8'); else if (pick < 0.75) c.set('#f6b9a8'); else c.set('#efe7d6');
  });

  // spiral shells
  const spN = Math.round(16 * f);
  const spirals = new THREE.InstancedMesh(spiralGeometry(), withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.8 }), U, { key: 'sp', strength: 1 }), spN);
  place(spirals, spN, (d, c, i) => {
    const [x, z] = scatter();
    const s = 0.7 + r() * 0.9;
    d.position.set(x, bedHeight(x, z) + 0.25 * s, z);
    d.rotation.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4);
    d.scale.set(s, s, s);
    if (r() < 0.5) c.set('#f7ecde'); else c.set('#ffc3b3');
  });

  // coral
  const cN = Math.round(16 * f);
  const coral = new THREE.InstancedMesh(coralGeometry(4), withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, envMapIntensity: 0.5 }), U, { key: 'co', strength: 0.8 }), cN);
  place(coral, cN, (d, c, i) => {
    const [x, z] = scatter((x, z) => Math.abs(x) > 5 || z < -8);
    const s = 0.8 + r() * 1.3;
    d.position.set(x, bedHeight(x, z) - 0.1, z);
    d.rotation.set(0, r() * 6.28, 0);
    d.scale.set(s, s * (0.8 + r() * 0.5), s);
    const p = r();
    if (p < 0.55) c.set('#ff6f61'); else if (p < 0.8) c.set('#ff9a85'); else c.set('#e8527a');
  });

  // rocks
  const rkN = Math.round(46 * f);
  const rockGeo = rockGeometry();
  const rockMat = withCaustics(new THREE.MeshStandardMaterial({ color: '#7d9a9c', roughness: 0.9, flatShading: true, envMapIntensity: 0.25 }), U, { key: 'rk', strength: 0.7 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rkN);
  place(rocks, rkN, (d, c, i) => {
    const far = i % 3 === 0;
    const x = (r() - 0.5) * (far ? 120 : 64), z = far ? -34 - r() * 40 : 12 - r() * 55;
    const s = far ? 3 + r() * 5 : 0.4 + r() * 1.6;
    if (Math.hypot(x - HERO.x, z - HERO.z) < 8 + s * 1.6 || nearPath(x, z, 2 + s)) { d.position.set(0, -200, 0); d.scale.setScalar(0.001); c.set('#000'); return; }
    d.position.set(x, bedHeight(x, z) + 0.12 * s, z);
    d.rotation.set(r() * 0.4, r() * 6.28, r() * 0.4);
    d.scale.set(s * (1 + r() * 0.6), s, s * (1 + r() * 0.5));
    c.setHSL(0.5 + r() * 0.03, 0.12, 0.28 + r() * 0.12);
  });

  // tall rock pinnacles far away: dark silhouettes in the haze that give the open water depth.
  // Same geometry and material as the rocks (no extra shader program), kept clear of the oyster backdrop.
  const pnN = tier === 'low' ? 6 : tier === 'mid' ? 9 : 12;
  const pr = rng(57);
  const pinnacles = new THREE.InstancedMesh(rockGeo, rockMat, pnN);
  place(pinnacles, pnN, (d, c, i) => {
    let x = 0, z = 0;
    for (let t = 0; t < 30; t++) {
      x = (pr() - 0.5) * 110; z = -36 - pr() * 44;
      if (Math.abs(x) > 15 + (z + 80) * 0.15) break;
    }
    const w = 2.6 + pr() * 3.4, h = 16 + pr() * 22;
    d.position.set(x, bedHeight(x, z) + h * 0.22, z);
    d.rotation.set((pr() - 0.5) * 0.12, pr() * 6.28, (pr() - 0.5) * 0.12);
    d.scale.set(w, h, w * (0.8 + pr() * 0.5));
    c.setHSL(0.52, 0.16, 0.13 + pr() * 0.05);
  });

  // kelp
  const kN = Math.round(110 * f);
  const kelpMat = withCaustics(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.2 }), U, { key: 'ke', strength: 0.5, sway: true });
  const kelp = new THREE.InstancedMesh(kelpGeometry(), kelpMat, kN);
  place(kelp, kN, (d, c, i) => {
    const cluster = i % 6 === 0;
    const [x, z] = scatter((x, z) => Math.abs(x) > 7 || z < -10);
    const s = 0.7 + r() * 1.1;
    d.position.set(x + (r() - 0.5) * 0.8, bedHeight(x, z) - 0.15, z + (r() - 0.5) * 0.8);
    d.rotation.set(0, r() * 6.28, 0);
    d.scale.set(1, s * (cluster ? 1.3 : 1), 1);
    c.setHSL(0.43 + r() * 0.06, 0.6, 0.2 + r() * 0.08);
  });

  group.userData.dispose = () => {};
  return group;
}

/* ------------------------------------------------------------------ fish */
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 12, 8).scale(1, 0.46, 0.22);
  const tail = new THREE.ConeGeometry(0.2, 0.42, 4, 1).rotateZ(-Math.PI / 2).scale(1, 1.5, 0.28).translate(-0.62, 0, 0);
  const dorsal = new THREE.ConeGeometry(0.1, 0.26, 3, 1).scale(1.4, 1, 0.3).translate(0.02, 0.26, 0);
  const eyeL = new THREE.SphereGeometry(0.045, 6, 4).translate(0.3, 0.06, 0.1);
  const eyeR = new THREE.SphereGeometry(0.045, 6, 4).translate(0.3, 0.06, -0.1);
  const parts = [body, tail, dorsal, eyeL, eyeR];
  parts.forEach((g) => {
    g.deleteAttribute('uv');
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    const isEye = g === eyeL || g === eyeR;
    for (let i = 0; i < p.count; i++) { const s = isEye ? 0.04 : lerp(0.34, 1.0, clamp((p.getY(i) + 0.2) / 0.4, 0, 1)); c[i * 3] = s; c[i * 3 + 1] = s; c[i * 3 + 2] = s; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  });
  return mergeGeometries(parts);
}

// All schools are one instanced mesh with one material: one draw call and one shader program.
export function makeSchools(U, tier) {
  const f = tier === 'low' ? 0.5 : tier === 'mid' ? 0.75 : 1;
  const defs = [
    { n: 70, center: [-3, -28, -8], radius: [8, 5], speed: 0.2, color: '#8fd3e0', spread: [3.4, 1.8, 3.4], size: 1.0 },
    { n: 36, center: [3, -8, -14], radius: [10, 6], speed: 0.24, color: '#ffc24a', spread: [2.6, 1.3, 2.6], size: 0.8 },
    { n: 44, center: [-2, -51, -4], radius: [10, 6], speed: 0.2, color: '#ff7a5c', spread: [2.6, 1.3, 2.6], size: 0.62 },
    { n: 22, center: [4, -39, -18], radius: [18, 8], speed: 0.14, color: '#9db8ff', spread: [2.0, 1.0, 2.0], size: 0.95 },
    // the dive: a silver group passing close, and a dark bait ball far off in the haze
    { n: 30, center: [10, -21, -4], radius: [7, 4], speed: 0.17, color: '#d9f2f2', spread: [2.4, 1.2, 2.4], size: 0.72 },
    { n: 96, center: [-16, -33, -40], radius: [9, 5], speed: 0.09, color: '#2f6f7b', spread: [4.2, 2.6, 4.2], size: 0.55 },
  ];
  const r = rng(33);
  const total = defs.reduce((a, d) => a + Math.max(6, Math.round(d.n * f)), 0);
  const geo = fishGeometry();
  const phase = new Float32Array(total);
  const mat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35, envMapIntensity: 0.55, emissive: new THREE.Color('#9fdde0'), emissiveIntensity: 0.06 }), U, { fish: true, strength: 0.0 });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  let at = 0;
  const schools = defs.map((d) => {
    const n = Math.max(6, Math.round(d.n * f)), start = at;
    const offs = [];
    for (let i = 0; i < n; i++) {
      phase[start + i] = r() * 6.28;
      offs.push(new THREE.Vector3((r() - 0.5) * 2 * d.spread[0], (r() - 0.5) * 2 * d.spread[1], (r() - 0.5) * 2 * d.spread[2]));
      const c = new THREE.Color(d.color); c.offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.12);
      mesh.setColorAt(start + i, c);
    }
    at += n;
    return { def: d, offs, start, n };
  });
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);

  const dummy = new THREE.Object3D();
  const ctr = new THREE.Vector3(), fwd = new THREE.Vector3();
  group.userData.update = (t) => {
    for (const s of schools) {
      const d = s.def, a = t * d.speed + s.def.center[0];
      ctr.set(d.center[0] + Math.cos(a) * d.radius[0], d.center[1] + Math.sin(a * 0.7) * 2.2, d.center[2] + Math.sin(a) * d.radius[1]);
      fwd.set(-Math.sin(a) * d.radius[0], Math.cos(a * 0.7) * 0.2, Math.cos(a) * d.radius[1]).normalize();
      const yaw = -Math.atan2(fwd.z, fwd.x);
      for (let i = 0; i < s.n; i++) {
        const o = s.offs[i], ph = phase[s.start + i];
        dummy.position.set(
          ctr.x + o.x + Math.sin(t * 0.7 + ph) * 0.7,
          ctr.y + o.y + Math.sin(t * 0.9 + ph * 1.3) * 0.4,
          ctr.z + o.z + Math.cos(t * 0.6 + ph) * 0.7);
        dummy.rotation.set(0, yaw + Math.sin(t * 0.8 + ph) * 0.22, Math.sin(t * 0.9 + ph * 1.3) * 0.08);
        const sc = d.size * (0.85 + 0.3 * ((ph * 7.3) % 1));
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(s.start + i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return group;
}

/* ------------------------------------------------------------------ the giant oyster and the pearl */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(210,255,250,.7)'); gr.addColorStop(0.5, 'rgba(120,230,225,.18)'); gr.addColorStop(1, 'rgba(120,230,225,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeHeroOyster(U) {
  const S = 2.7;
  const root = new THREE.Group();
  const gy = bedHeight(HERO.x, HERO.z);
  root.position.set(HERO.x, gy + 0.55, HERO.z);
  root.rotation.y = 0.05;

  const outerMat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, color: '#8fa7a6', roughness: 0.52, metalness: 0.06, envMapIntensity: 0.7 }), U, { key: 'hero-out', strength: 0.8 });
  const nacre = new THREE.MeshPhysicalMaterial({
    color: '#eaf4f1', roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1,
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 520], side: THREE.BackSide, envMapIntensity: 0.7,
    emissive: new THREE.Color('#7be3dc'), emissiveIntensity: 0,
  });

  const lowGeo = valveGeometry(-1, 2, 64, 32);
  const upGeo = valveGeometry(1, 2, 64, 32);

  const lower = new THREE.Group(); lower.scale.setScalar(S);
  lower.add(new THREE.Mesh(lowGeo, outerMat));
  lower.add(new THREE.Mesh(lowGeo, nacre));
  root.add(lower);

  // hinge at the far (-z) end of the shell; the lid swings up around it
  const HZ = 1.2 * S;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.03 * S, -HZ);
  const upper = new THREE.Group(); upper.scale.setScalar(S); upper.position.set(0, 0, HZ);
  upper.add(new THREE.Mesh(upGeo, outerMat));
  upper.add(new THREE.Mesh(upGeo, nacre));
  hinge.add(upper);
  root.add(hinge);

  // soft oyster meat inside the lower valve
  const meat = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 20).scale(0.78 * S, 0.1 * S, 1.02 * S),
    new THREE.MeshStandardMaterial({ color: '#d8cfbf', roughness: 0.3, envMapIntensity: 0.9 })   // standard, not physical: one heavy program less
  );
  meat.position.set(0, -0.09 * S, 0.12 * S);
  root.add(meat);

  // the pearl
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: '#fbfbf7', roughness: 0.1, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 600], envMapIntensity: 1.6,
    emissive: new THREE.Color('#bff6f1'), emissiveIntensity: 0.05,
  });
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 32), pearlMat);
  pearl.position.set(0, 0.2, 0.55);
  root.add(pearl);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#aef5ee', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  glow.position.copy(pearl.position);
  glow.scale.setScalar(2);
  root.add(glow);

  // The two lights live in their own group that stays in the scene from the start, so the number of lights
  // never changes when the oyster is added (a change would recompile every lit material).
  const lights = new THREE.Group();
  lights.position.copy(root.position); lights.rotation.copy(root.rotation);
  const light = new THREE.PointLight('#c4fbf5', 0, 0, 2);
  light.position.set(0, 1.4, 1.0);
  lights.add(light);
  const fill = new THREE.PointLight('#ffb7a6', 0, 0, 2);
  fill.position.set(0, 2.2, 5.5);
  lights.add(fill);
  root.userData.lights = lights;

  root.userData.update = (open, t, motion) => {
    const o = open;
    hinge.rotation.x = -o * 1.0;
    const rise = smoothstep(o, 0.35, 1);
    pearl.position.y = 0.2 + rise * 0.55 + (motion ? Math.sin(t * 0.8) * 0.05 * rise : 0);
    pearl.rotation.y = motion ? t * 0.25 : 0;
    glow.position.copy(pearl.position);
    const k = smoothstep(o, 0.18, 1);
    glow.material.opacity = k * 0.7;
    glow.scale.setScalar(1.4 + k * 2.6);
    pearlMat.emissiveIntensity = 0.05 + k * 0.5;
    nacre.emissiveIntensity = k * 0.08;
    light.intensity = k * 22;
    fill.intensity = k * 5;
  };
  root.userData.pearl = pearl;
  root.userData.lidPoint = new THREE.Vector3(HERO.x, root.position.y + 0.8, HERO.z);
  return root;
}

/* ------------------------------------------------------------------ disposal helper */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });   // shared materials: a second dispose is a no-op
    }
    if (o.isInstancedMesh) o.dispose();
  });
}
