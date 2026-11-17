// Column-major 4x4 matrix math and 3-vector helpers — the only linear
// algebra the renderer needs: perspective, look-at, multiply, and a model
// matrix from a ground position plus a heading about the vertical axis.

export function mIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mPerspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function mLookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];
  const m = new Float32Array(16);
  m[0] = x[0];
  m[1] = y[0];
  m[2] = z[0];
  m[4] = x[1];
  m[5] = y[1];
  m[6] = z[1];
  m[8] = x[2];
  m[9] = y[2];
  m[10] = z[2];
  m[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  m[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  m[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  m[15] = 1;
  return m;
}

export function mMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

// Model matrix: uniform scale, rotation about Y by heading, translation.
// Heading 0 faces +Z; forward is (sin h, 0, cos h).
export function mModel(x, y, z, heading, scale = 1) {
  const c = Math.cos(heading) * scale;
  const s = Math.sin(heading) * scale;
  const m = new Float32Array(16);
  m[0] = c;
  m[2] = -s;
  m[5] = scale;
  m[8] = s;
  m[10] = c;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
  return m;
}

// Model matrix with independent axis scales (cones, pillars, discs).
export function mModelS(x, y, z, heading, sx, sy, sz) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const m = new Float32Array(16);
  m[0] = c * sx;
  m[2] = -s * sx;
  m[5] = sy;
  m[8] = s * sz;
  m[10] = c * sz;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
  return m;
}

export function mTranslate(x, y, z) {
  const m = mIdentity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function mRotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

// Upper 3x3 of a rotation-only model matrix, for normal transforms.
export function mNormal3(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}

export function vSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vLen(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vNorm(a) {
  const l = vLen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function vDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Shortest signed angle difference, for steering toward a heading.
export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
