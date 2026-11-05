/* Drifting sakura petals: one instanced draw call, motion computed on the GPU.
   Petals live in a box that follows the camera, so there are always some around you. */
import * as THREE from 'three';
import { rng } from './world.js';

export function buildPetals({ count = 650, fogColor, fogDensity }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(0.55, -0.36, 0.56, 0.3, 0.17, 0.5);
  shape.lineTo(0, 0.37);
  shape.lineTo(-0.17, 0.5);
  shape.bezierCurveTo(-0.56, 0.3, -0.55, -0.36, 0, -0.5);
  const base = new THREE.ShapeGeometry(shape, 6);

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const R = rng(1234);
  const box = new THREE.Vector3(26, 13, 26);
  const off = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off.set([(R() - 0.5) * box.x, (R() - 0.2) * box.y, (R() - 0.5) * box.z], i * 3);
    seed.set([R(), R(), 0.05 + R() * 0.05, R()], i * 4);
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box },
      uWind: { value: new THREE.Vector3(0.25, 0, 0.35) }, uSwirl: { value: 0 }, uSwirlC: { value: new THREE.Vector3(0.8, 0, -29) },
      uFogColor: { value: fogColor }, uFog: { value: fogDensity }, uGlow: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aOff; attribute vec4 aSeed;
      uniform float uT; uniform vec3 uCam; uniform vec3 uBox; uniform vec3 uWind; uniform float uSwirl; uniform vec3 uSwirlC;
      varying vec3 vCol; varying float vDepth; varying vec2 vUv;
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      void main(){
        float t = uT;
        vec3 p = aOff;
        p.y -= t*(0.22 + aSeed.y*0.32);
        p.x += t*uWind.x + sin(t*0.5 + aSeed.x*6.283)*0.7;
        p.z += t*uWind.z + cos(t*0.43 + aSeed.x*9.0)*0.6;
        p = uCam + mod(p - uCam + uBox*0.5, uBox) - uBox*0.5;
        // finale: a slow vortex of petals lifting around the reserve station
        vec2 d = p.xz - uSwirlC.xz; float r = length(d);
        float ang = uSwirl*(0.25*t + 2.4/(1.0 + r*0.35));
        float cs = cos(ang), sn = sin(ang);
        p.xz = uSwirlC.xz + vec2(cs*d.x - sn*d.y, sn*d.x + cs*d.y);
        p.y += uSwirl*(0.6 + 0.6*sin(t*0.6 + aSeed.x*6.283))*(1.0 + aSeed.y);
        float size = aSeed.z;
        vec3 l = vec3(position.xy*size, 0.0);
        l.z += position.x*position.x*size*1.6;
        l = rotY(t*(0.7 + aSeed.y*1.3) + aSeed.x*20.0) * rotX(t*(0.5 + aSeed.w) + aSeed.w*30.0) * l;
        vec4 mv = viewMatrix*vec4(p + l, 1.0);
        vDepth = -mv.z; vUv = uv;
        vec3 c1 = vec3(1.0,0.63,0.74), c2 = vec3(1.0,0.82,0.88), c3 = vec3(0.93,0.5,0.66);
        vCol = aSeed.w < 0.45 ? mix(c1,c2,aSeed.w*2.2) : (aSeed.w < 0.8 ? c1 : c3);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uFogColor; uniform float uFog; uniform float uGlow;
      varying vec3 vCol; varying float vDepth; varying vec2 vUv;
      void main(){
        vec3 col = vCol*(0.72 + 0.4*vUv.y)*uGlow;
        float f = 1.0 - exp(-pow(uFog*vDepth, 2.0));
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return {
    mesh,
    setCount(n) { geo.instanceCount = Math.min(count, n); },
    update(t, camPos, swirl) { mat.uniforms.uT.value = t; mat.uniforms.uCam.value.copy(camPos); mat.uniforms.uSwirl.value = swirl; },
  };
}
