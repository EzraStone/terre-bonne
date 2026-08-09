// Terre Bonne — geometry.
//
// Everything is baked into world space and batched by (texture, visibility tag)
// so the whole swamp draws in a handful of calls. Lighting is baked into vertex
// colours at build time; the only runtime light in the game is the flashlight,
// and there are no dynamic shadows anywhere.

const FLOATS = 11; // pos3 uv2 col3 nrm3
const MAX_VERTS = 65000;

// Baked moonlight: weak, high, slightly blue, plus contact darkening near the
// ground so props sit in the muck instead of floating on it.
function bake(nx, ny, nz, y, tint) {
  const up = Math.max(0, ny);
  const side = Math.max(0, nx * 0.35 + nz * 0.2);
  let l = 0.62 + up * 0.28 + side * 0.08;
  l *= 0.66 + Math.min(1, Math.max(0, y) / 2.2) * 0.34;   // ambient occlusion, cheaply
  const t = tint || 1;
  return [l * 0.92 * t, l * 1.0 * t, l * 0.95 * t];
}

class Chunk {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  mesh() {
    return { verts: new Float32Array(this.v), index: new Uint16Array(this.i) };
  }
}

export class Builder {
  constructor() {
    this.groups = new Map();  // "tex|tag" -> {tex, tag, chunks:[Chunk]}
    this.cur = null;
  }

  group(tex, tag = 'always') {
    const key = tex + '|' + tag;
    let g = this.groups.get(key);
    if (!g) { g = { tex, tag, chunks: [new Chunk()] }; this.groups.set(key, g); }
    this.curGroup = g;
    this.cur = g.chunks[g.chunks.length - 1];
    return this;
  }

  _room(need) {
    if (this.cur.n + need > MAX_VERTS) {
      this.cur = new Chunk();
      this.curGroup.chunks.push(this.cur);
    }
  }

  // Four corners, counter-clockwise seen from the front face.
  quad(a, b, c, d, uv = [0, 0, 1, 1], tint = 1) {
    this._room(4);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    const [u0, v0, u1, v1] = uv;
    const pts = [[a, u0, v1], [b, u1, v1], [c, u1, v0], [d, u0, v0]];
    const base = this.cur.n;
    for (const [p, u, v] of pts) {
      const col = bake(nx, ny, nz, p[1], tint);
      this.cur.v.push(p[0], p[1], p[2], u, v, col[0], col[1], col[2], nx, ny, nz);
    }
    this.cur.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.cur.n += 4;
    return this;
  }

  // Axis-aligned box. Cheap, and most props in this game are boxes at heart.
  box(cx, cy, cz, sx, sy, sz, uvScale = 1, tint = 1) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy, y1 = cy + sy;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const U = (w, h) => [0, 0, w * uvScale, h * uvScale];
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], U(sx,sy), tint);   // +Z
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], U(sx,sy), tint);   // -Z
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], U(sz,sy), tint);   // +X
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], U(sz,sy), tint);   // -X
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], U(sx,sz), tint);   // +Y
    return this;
  }

  // Tapered n-gon column: cypress trunks, flared at the base like the real thing.
  column(cx, cz, height, rBottom, rTop, sides = 6, uvScale = 1, tint = 1, flare = 0) {
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const segs = flare > 0 ? 3 : 1;
      for (let g = 0; g < segs; g++) {
        const t0 = g / segs, t1 = (g + 1) / segs;
        const rad = (t) => {
          const base = rBottom + (rTop - rBottom) * t;
          return base + flare * Math.pow(1 - t, 3);      // the buttress
        };
        const r0 = rad(t0), r1 = rad(t1);
        const y0 = height * t0, y1 = height * t1;
        const p = (a, r, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
        this.quad(p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1),
                  [0, t0 * uvScale, 1, t1 * uvScale], tint);
      }
    }
    return this;
  }

  // Two intersecting alpha cards. Every plant in the game is this.
  cross(cx, cy, cz, w, h, rot = 0, tint = 1) {
    for (let k = 0; k < 2; k++) {
      const a = rot + k * Math.PI / 2;
      const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
      this.quad(
        [cx - dx, cy, cz - dz], [cx + dx, cy, cz + dz],
        [cx + dx, cy + h, cz + dz], [cx - dx, cy + h, cz - dz],
        [0, 0, 1, 1], tint,
      );
    }
    return this;
  }

  // Horizontal card, used for water sheen and the moss canopy overhead.
  ceiling(cx, cy, cz, w, d, uvScale = 1, tint = 1) {
    this.quad(
      [cx - w / 2, cy, cz + d / 2], [cx + w / 2, cy, cz + d / 2],
      [cx + w / 2, cy, cz - d / 2], [cx - w / 2, cy, cz - d / 2],
      [0, 0, w * uvScale, d * uvScale], tint,
    );
    return this;
  }

  // Upright panel facing a yaw direction — plaques, documents, headstones.
  panel(cx, cy, cz, w, h, yaw, tint = 1, uv = [0, 0, 1, 1]) {
    const dx = Math.cos(yaw) * w / 2, dz = -Math.sin(yaw) * w / 2;
    this.quad([cx - dx, cy, cz - dz], [cx + dx, cy, cz + dz],
              [cx + dx, cy + h, cz + dz], [cx - dx, cy + h, cz - dz], uv, tint);
    // back face, so it is solid from behind
    this.quad([cx + dx, cy, cz + dz], [cx - dx, cy, cz - dz],
              [cx - dx, cy + h, cz - dz], [cx + dx, cy + h, cz + dz], uv, tint * 0.5);
    return this;
  }

  compile(renderer) {
    const out = [];
    for (const g of this.groups.values()) {
      for (const ch of g.chunks) {
        if (!ch.n) continue;
        out.push({ tex: g.tex, tag: g.tag, handle: renderer.upload(ch.mesh()) });
      }
    }
    return out;
  }
}

// A single quad mesh in local space, re-oriented every frame. Used for the one
// figure in the game and for the recorder's little amber eye.
export function billboardMesh(w, h) {
  const b = new Builder();
  b.group('_');
  b.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0]);
  const ch = b.groups.values().next().value.chunks[0];
  return ch.mesh();
}

export { FLOATS };
