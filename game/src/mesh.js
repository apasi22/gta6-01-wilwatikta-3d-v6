// Mesh builder: an append-only triangle soup with per-vertex position,
// normal, color (with alpha) and glow. Static city geometry merges into one
// big buffer; vehicles, characters and effects are small separate buffers
// drawn with per-object model matrices. Back-face culling stays off, so
// winding never matters — only the explicit normals do.

// Hex color to [r, g, b, a] floats.
export function col(hex, a = 1) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a];
}

const FLOATS = 11; // pos3 + normal3 + color4 + glow1

export class Mesh {
  constructor() {
    this.v = [];
  }
  get count() {
    return this.v.length / FLOATS;
  }
  vert(x, y, z, nx, ny, nz, c, g) {
    const v = this.v;
    v.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], c[3], g);
  }
  tri(a, b, c, n, color, glow = 0) {
    this.vert(a[0], a[1], a[2], n[0], n[1], n[2], color, glow);
    this.vert(b[0], b[1], b[2], n[0], n[1], n[2], color, glow);
    this.vert(c[0], c[1], c[2], n[0], n[1], n[2], color, glow);
  }
  quad(a, b, c, d, n, color, glow = 0) {
    this.tri(a, b, c, n, color, glow);
    this.tri(a, c, d, n, color, glow);
  }
  // Axis-aligned box centered at (cx, cy, cz) with full sizes; the top face
  // may take its own color. The bottom face is emitted too — cheap, and
  // flying objects are seen from below.
  box(cx, cy, cz, sx, sy, sz, color, glow = 0, topColor = null) {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    const top = topColor || color;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], top, glow);
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], color, glow);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color, glow);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color, glow);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color, glow);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color, glow);
  }
  // Vertical prism (cylinder) from cy to cy+h; rTop lets it taper.
  prism(cx, cy, cz, r, h, sides, color, glow = 0, rTop = null) {
    const rt = rTop === null ? r : rTop;
    const y1 = cy + h;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const nx = Math.cos((a0 + a1) / 2);
      const nz = Math.sin((a0 + a1) / 2);
      this.quad(
        [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r],
        [cx + Math.cos(a1) * rt, y1, cz + Math.sin(a1) * rt],
        [cx + Math.cos(a0) * rt, y1, cz + Math.sin(a0) * rt],
        [nx, 0, nz],
        color,
        glow,
      );
    }
    this.disc(cx, y1, cz, rt, sides, color, glow);
    this.disc(cx, cy, cz, r, sides, color, glow);
  }
  // Cone with its apex at cy+h.
  cone(cx, cy, cz, r, h, sides, color, glow = 0) {
    const apex = [cx, cy + h, cz];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
      const nx = Math.cos((a0 + a1) / 2) * 0.8;
      const nz = Math.sin((a0 + a1) / 2) * 0.8;
      this.tri(p0, p1, apex, [nx, 0.6, nz], color, glow);
    }
    this.disc(cx, cy, cz, r, sides, color, glow);
  }
  // Flat horizontal fan at height cy, facing up.
  disc(cx, cy, cz, r, sides, color, glow = 0) {
    const c = [cx, cy, cz];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      this.tri(
        c,
        [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r],
        [0, 1, 0],
        color,
        glow,
      );
    }
  }
  // Horizontal cylinder along X (wheels, barrels lying down).
  cylX(cx, cy, cz, r, len, sides, color, glow = 0) {
    const x0 = cx - len / 2;
    const x1 = cx + len / 2;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const ny = Math.cos((a0 + a1) / 2);
      const nz = Math.sin((a0 + a1) / 2);
      this.quad(
        [x0, cy + Math.cos(a0) * r, cz + Math.sin(a0) * r],
        [x1, cy + Math.cos(a0) * r, cz + Math.sin(a0) * r],
        [x1, cy + Math.cos(a1) * r, cz + Math.sin(a1) * r],
        [x0, cy + Math.cos(a1) * r, cz + Math.sin(a1) * r],
        [0, ny, nz],
        color,
        glow,
      );
    }
    for (const [x, n] of [
      [x0, [-1, 0, 0]],
      [x1, [1, 0, 0]],
    ]) {
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        this.tri(
          [x, cy, cz],
          [x, cy + Math.cos(a0) * r, cz + Math.sin(a0) * r],
          [x, cy + Math.cos(a1) * r, cz + Math.sin(a1) * r],
          n,
          color,
          glow,
        );
      }
    }
  }
  // A palm frond: a tapered two-segment strip arcing out and down.
  frond(x, y, z, ang, len, w, droop, color, glow = 0) {
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const p0 = [x, y, z];
    const p1 = [x + dx * len * 0.55, y + len * 0.1, z + dz * len * 0.55];
    const p2 = [x + dx * len, y - droop, z + dz * len];
    const w0 = w / 2;
    const w1 = w * 0.32;
    const n = [0, 1, 0];
    this.quad(
      [p0[0] - px * w0, p0[1], p0[2] - pz * w0],
      [p0[0] + px * w0, p0[1], p0[2] + pz * w0],
      [p1[0] + px * w1, p1[1], p1[2] + pz * w1],
      [p1[0] - px * w1, p1[1], p1[2] - pz * w1],
      n,
      color,
      glow,
    );
    this.tri(
      [p1[0] - px * w1, p1[1], p1[2] - pz * w1],
      [p1[0] + px * w1, p1[1], p1[2] + pz * w1],
      p2,
      n,
      color,
      glow,
    );
  }
  toArray() {
    return new Float32Array(this.v);
  }
}
