// Renderer: raw WebGL1, two programs, no libraries. One forward program
// draws everything in the scene — per-vertex color and glow, one sun, linear
// fog — and a tiny second program draws the gradient sky with a sun disc and
// night stars. Draw order: sky, opaque city and objects, then one
// translucent pass with depth writes off for shadows, pools, cones and
// effects.

import { mIdentity, mPerspective, mLookAt, mMul, mModel } from './mat.js';
import { Mesh, col } from './mesh.js';

const SCENE_VS = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec4 aCol;
attribute float aGlow;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat3 uNMat;
varying vec3 vPos;
varying vec3 vNor;
varying vec4 vCol;
varying float vGlow;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vPos = wp.xyz;
  vNor = normalize(uNMat * aNor);
  vCol = aCol;
  vGlow = aGlow;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const SCENE_FS = `
precision mediump float;
varying vec3 vPos;
varying vec3 vNor;
varying vec4 vCol;
varying float vGlow;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uAmbient;
uniform float uGlowBoost;
uniform vec3 uFogCol;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
uniform vec3 uTint;
uniform float uAlpha;
void main() {
  vec3 n = normalize(vNor);
  float dif = max(dot(n, uSunDir), 0.0);
  vec3 lit = vCol.rgb * (uAmbient + uSunCol * dif);
  vec3 c = mix(lit, vCol.rgb * uGlowBoost, vGlow);
  float d = distance(vPos, uCamPos);
  float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  c = mix(c, uFogCol, f);
  gl_FragColor = vec4(c * uTint, vCol.a * uAlpha);
}`;

const SKY_VS = `
attribute vec2 aXY;
varying vec2 vXY;
void main() {
  vXY = aXY;
  gl_Position = vec4(aXY, 0.99999, 1.0);
}`;

const SKY_FS = `
precision mediump float;
varying vec2 vXY;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBot;
uniform vec2 uSun;
uniform float uSunI;
uniform float uNight;
uniform float uAspect;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float y = vXY.y * 0.5 + 0.5;
  vec3 c = y < 0.45 ? mix(uBot, uMid, y / 0.45) : mix(uMid, uTop, (y - 0.45) / 0.55);
  vec2 sp = vec2((vXY.x - uSun.x) * uAspect, vXY.y - uSun.y);
  float d = length(sp);
  float disc = smoothstep(0.085, 0.065, d);
  float glow = exp(-d * 5.0) * 0.7;
  c += vec3(1.0, 0.72, 0.42) * (disc * uSunI + glow * uSunI * 0.5);
  vec2 g = floor(vec2(vXY.x * uAspect, vXY.y) * 90.0);
  float star = step(0.992, hash(g)) * smoothstep(0.45, 0.7, y);
  c += vec3(star) * uNight * 0.7;
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

function transMatrix(x, y, z) {
  const m = mIdentity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function rotXMatrix(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

// Model matrix for a walker leg: translate to the ground position, face the
// heading, then swing about the hip pivot at y = 0.9.
export function legMatrix(x, z, heading, swing) {
  const base = mModel(x, 0, z, heading);
  const pivot = mMul(transMatrix(0, 0.9, 0), mMul(rotXMatrix(swing), transMatrix(0, -0.9, 0)));
  return mMul(base, pivot);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    this.scene = program(gl, SCENE_VS, SCENE_FS);
    this.sky = program(gl, SKY_VS, SKY_FS);
    const S = this.scene;
    this.loc = {
      aPos: gl.getAttribLocation(S, 'aPos'),
      aNor: gl.getAttribLocation(S, 'aNor'),
      aCol: gl.getAttribLocation(S, 'aCol'),
      aGlow: gl.getAttribLocation(S, 'aGlow'),
      uMVP: gl.getUniformLocation(S, 'uMVP'),
      uModel: gl.getUniformLocation(S, 'uModel'),
      uNMat: gl.getUniformLocation(S, 'uNMat'),
      uSunDir: gl.getUniformLocation(S, 'uSunDir'),
      uSunCol: gl.getUniformLocation(S, 'uSunCol'),
      uAmbient: gl.getUniformLocation(S, 'uAmbient'),
      uGlowBoost: gl.getUniformLocation(S, 'uGlowBoost'),
      uFogCol: gl.getUniformLocation(S, 'uFogCol'),
      uFogNear: gl.getUniformLocation(S, 'uFogNear'),
      uFogFar: gl.getUniformLocation(S, 'uFogFar'),
      uCamPos: gl.getUniformLocation(S, 'uCamPos'),
      uTint: gl.getUniformLocation(S, 'uTint'),
      uAlpha: gl.getUniformLocation(S, 'uAlpha'),
    };
    this.skyLoc = {
      aXY: gl.getAttribLocation(this.sky, 'aXY'),
      uTop: gl.getUniformLocation(this.sky, 'uTop'),
      uMid: gl.getUniformLocation(this.sky, 'uMid'),
      uBot: gl.getUniformLocation(this.sky, 'uBot'),
      uSun: gl.getUniformLocation(this.sky, 'uSun'),
      uSunI: gl.getUniformLocation(this.sky, 'uSunI'),
      uNight: gl.getUniformLocation(this.sky, 'uNight'),
      uAspect: gl.getUniformLocation(this.sky, 'uAspect'),
    };
    // Fullscreen triangle for the sky.
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.cache = new Map();
    // Shared effect meshes.
    const disc = new Mesh();
    disc.disc(0, 0, 0, 1, 14, col(0xffffff));
    this.discMesh = disc.toArray();
    const cone = new Mesh();
    cone.cone(0, -1, 0, 1, 1, 12, col(0xffffff));
    this.coneMesh = cone.toArray();
    const pillar = new Mesh();
    pillar.prism(0, 0, 0, 1, 1, 10, col(0xffffff));
    this.pillarMesh = pillar.toArray();
  }

  bufferFor(arr) {
    let b = this.cache.get(arr);
    if (!b) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      b = { buf, count: arr.length / 11 };
      this.cache.set(arr, b);
    }
    return b;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  drawOne(proj, view, item, alpha) {
    const gl = this.gl;
    const L = this.loc;
    let b;
    if (item.dynamic) {
      // Rebuilt every frame: one reused buffer, re-uploaded, never cached.
      if (!this.dynBuf) this.dynBuf = { buf: gl.createBuffer(), count: 0 };
      b = this.dynBuf;
      const arr = new Float32Array(item.mesh.v);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      b.count = arr.length / 11;
    } else {
      b = this.bufferFor(item.mesh);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 44, 0);
    gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 44, 12);
    gl.vertexAttribPointer(L.aCol, 4, gl.FLOAT, false, 44, 24);
    gl.vertexAttribPointer(L.aGlow, 1, gl.FLOAT, false, 44, 40);
    gl.enableVertexAttribArray(L.aPos);
    gl.enableVertexAttribArray(L.aNor);
    gl.enableVertexAttribArray(L.aCol);
    gl.enableVertexAttribArray(L.aGlow);
    const m = item.matrix;
    gl.uniformMatrix4fv(L.uMVP, false, mMul(proj, mMul(view, m)));
    gl.uniformMatrix4fv(L.uModel, false, m);
    gl.uniformMatrix3fv(L.uNMat, false, new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]));
    const tint = item.tint || [1, 1, 1];
    gl.uniform3f(L.uTint, tint[0], tint[1], tint[2]);
    gl.uniform1f(L.uAlpha, alpha === undefined ? 1 : alpha);
    gl.drawArrays(gl.TRIANGLES, 0, b.count);
  }

  // One full frame: sky, opaque draws, translucent draws.
  frame(pal, eye, target, fov, opaque, translucent) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const aspect = w / h;
    const proj = mPerspective(fov, aspect, 0.1, 900);
    const view = mLookAt(eye, target, [0, 1, 0]);
    gl.clearColor(pal.fog[0], pal.fog[1], pal.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sky: sun position projected to NDC; hidden when behind the camera.
    const sunW = [eye[0] + pal.sunDir[0] * 500, eye[1] + pal.sunDir[1] * 500, eye[2] + pal.sunDir[2] * 500];
    const pv = mMul(proj, view);
    const cx = pv[0] * sunW[0] + pv[4] * sunW[1] + pv[8] * sunW[2] + pv[12];
    const cy = pv[1] * sunW[0] + pv[5] * sunW[1] + pv[9] * sunW[2] + pv[13];
    const cw = pv[3] * sunW[0] + pv[7] * sunW[1] + pv[11] * sunW[2] + pv[15];
    const nightF = Math.max(0, Math.min(1, (pal.glowBoost - 0.4) / 1.3));
    const sunI = cw > 0 ? 1 - nightF * 0.75 : 0;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.vertexAttribPointer(this.skyLoc.aXY, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.skyLoc.aXY);
    gl.uniform3f(this.skyLoc.uTop, pal.skyTop[0], pal.skyTop[1], pal.skyTop[2]);
    gl.uniform3f(this.skyLoc.uMid, pal.skyMid[0], pal.skyMid[1], pal.skyMid[2]);
    gl.uniform3f(this.skyLoc.uBot, pal.skyBot[0], pal.skyBot[1], pal.skyBot[2]);
    gl.uniform2f(this.skyLoc.uSun, cw > 0 ? cx / cw : 5, cw > 0 ? cy / cw : 5);
    gl.uniform1f(this.skyLoc.uSunI, sunI);
    const starF = Math.max(0, Math.min(1, (pal.glowBoost - 1.15) / 0.55));
    gl.uniform1f(this.skyLoc.uNight, starF);
    gl.uniform1f(this.skyLoc.uAspect, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Scene passes.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.scene);
    const L = this.loc;
    gl.uniform3f(L.uSunDir, pal.sunDir[0], pal.sunDir[1], pal.sunDir[2]);
    gl.uniform3f(L.uSunCol, pal.sunCol[0], pal.sunCol[1], pal.sunCol[2]);
    gl.uniform1f(L.uAmbient, pal.ambient);
    gl.uniform1f(L.uGlowBoost, pal.glowBoost);
    gl.uniform3f(L.uFogCol, pal.fog[0], pal.fog[1], pal.fog[2]);
    gl.uniform1f(L.uFogNear, pal.fogNear);
    gl.uniform1f(L.uFogFar, pal.fogFar);
    gl.uniform3f(L.uCamPos, eye[0], eye[1], eye[2]);
    for (const item of opaque) this.drawOne(proj, view, item);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const item of translucent) this.drawOne(proj, view, item, item.alpha === undefined ? 1 : item.alpha);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
