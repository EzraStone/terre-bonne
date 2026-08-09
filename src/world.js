// Terre Bonne — the trail.
//
// The sign says half a mile. The trail is 0.5 miles and the game is not: the
// walk is compressed to roughly 210 metres of real ground, and every distance
// the player is shown is the trail's own signage, which is unreliable on purpose.
//
// Geometry is tagged by visibility. Tag 'record' means it does not exist while
// Ray believes the pretty version — the fork, the quarter road, the field. New
// geometry only ever opens in Record state.

import { Builder } from './geometry.js';
import { ARTIFACTS } from './content.js';

const TRAIL_MILES = 0.5;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------------ trail */
export class Trail {
  constructor() {
    this.pts = [];
    const N = 71, step = 3;
    for (let i = 0; i < N; i++) {
      const x = Math.sin(i * 0.23) * 7 + Math.sin(i * 0.071) * 4.5;
      const z = -i * step;
      this.pts.push([x, z]);
    }
    // cumulative arc length
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) {
      const dx = this.pts[i][0] - this.pts[i - 1][0];
      const dz = this.pts[i][1] - this.pts[i - 1][1];
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dz));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  // Position at arc length s.
  at(s) {
    s = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const t = (s - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1]);
    const a = this.pts[i - 1], b = this.pts[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // Unit tangent at arc length s.
  tangent(s) {
    const a = this.at(Math.max(0, s - 0.5));
    const b = this.at(Math.min(this.length, s + 0.5));
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  // Left-hand normal.
  normal(s) { const [tx, tz] = this.tangent(s); return [-tz, tx]; }

  // Nearest point on the polyline: returns arc length and signed lateral offset.
  project(x, z) {
    let best = { s: 0, lat: 0, d2: Infinity };
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const len2 = abx * abx + abz * abz;
      let t = ((x - a[0]) * abx + (z - a[1]) * abz) / (len2 || 1);
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + abx * t, pz = a[1] + abz * t;
      const d2 = (x - px) ** 2 + (z - pz) ** 2;
      if (d2 < best.d2) {
        const s = this.cum[i - 1] + t * Math.sqrt(len2);
        const nx = -abz / Math.sqrt(len2 || 1), nz = abx / Math.sqrt(len2 || 1);
        best = { s, lat: (x - px) * nx + (z - pz) * nz, d2 };
      }
    }
    return best;
  }

  // arc length <-> the number printed on the marker
  toMiles(s) { return (s / this.length) * TRAIL_MILES; }
  fromMiles(m) { return (m / TRAIL_MILES) * this.length; }

  // World position offset laterally from the centreline.
  place(mile, lateral) {
    const s = this.fromMiles(mile);
    const [x, z] = this.at(s);
    const [nx, nz] = this.normal(s);
    return [x + nx * lateral, z + nz * lateral];
  }
}

/* -------------------------------------------------------- world construction */
export function buildWorld(trail) {
  const b = new Builder();
  const r = rng(1837);
  const L = trail.length;

  const boardwalkEnd = trail.fromMiles(0.16);   // deck runs out past the first sign

  /* ground: mud everywhere, gravel at the lot */
  b.group('mud');
  for (let s = 0; s < L; s += 6) {
    const [x, z] = trail.at(s + 3);
    b.ceiling(x, 0.02, z, 14, 8, 0.25);
  }
  b.group('gravel');
  {
    const [x, z] = trail.at(-2);
    b.ceiling(x, 0.03, z + 6, 18, 16, 0.2);
  }

  /* the black water on both sides — a plane you are never invited onto */
  b.group('water');
  for (let s = 0; s < L; s += 8) {
    const [x, z] = trail.at(s + 4);
    b.ceiling(x - 16, -0.35, z, 22, 12, 0.12);
    b.ceiling(x + 16, -0.35, z, 22, 12, 0.12);
  }

  /* boardwalk: deck, rail posts, and the joists you can see under the gaps */
  b.group('planks');
  for (let s = 0; s < boardwalkEnd; s += 1.5) {
    const [x, z] = trail.at(s);
    const [nx, nz] = trail.normal(s);
    const [x2, z2] = trail.at(Math.min(boardwalkEnd, s + 1.5));
    const [nx2, nz2] = trail.normal(Math.min(boardwalkEnd, s + 1.5));
    const w = 1.1;
    b.quad(
      [x - nx * w, 0.3, z - nz * w], [x + nx * w, 0.3, z + nz * w],
      [x2 + nx2 * w, 0.3, z2 + nz2 * w], [x2 - nx2 * w, 0.3, z2 - nz2 * w],
      [0, s * 0.35, 1, (s + 1.5) * 0.35],
    );
  }
  for (let s = 0; s < boardwalkEnd; s += 2.4) {
    const [nx, nz] = trail.normal(s);
    const [x, z] = trail.at(s);
    for (const side of [-1, 1]) {
      b.box(x + nx * 1.15 * side, 0, z + nz * 1.15 * side, 0.14, 1.15, 0.14, 1.2);
    }
  }

  /* cypress: flared trunks, knees, and the moss that hangs off all of it */
  b.group('bark');
  const trees = [];
  for (let i = 0; i < 190; i++) {
    const s = r() * (L + 20) - 10;
    const side = r() > 0.5 ? 1 : -1;
    const lat = side * (3.0 + r() * 13);
    const [x, z] = trail.at(Math.max(0, Math.min(L, s)));
    const [nx, nz] = trail.normal(Math.max(0, Math.min(L, s)));
    const px = x + nx * lat, pz = z + nz * lat;
    const h = 7 + r() * 9;
    const rad = 0.28 + r() * 0.32;
    b.column(px, pz, h, rad, rad * 0.55, 6, h * 0.22, 1, rad * 0.9);
    trees.push([px, pz, h, rad]);
    // knees: the little cypress spires coming up out of the water
    const knees = (r() * 4) | 0;
    for (let k = 0; k < knees; k++) {
      const a = r() * Math.PI * 2, d = rad + 0.5 + r() * 2.2;
      b.column(px + Math.cos(a) * d, pz + Math.sin(a) * d, 0.35 + r() * 0.7, 0.16, 0.03, 5, 1);
    }
  }

  b.group('canopy');
  for (const [px, pz, h] of trees) {
    b.cross(px, h * 0.72, pz, 5.5 + r() * 3, 4 + r() * 2.5, r() * Math.PI);
  }

  b.group('moss');
  for (const [px, pz, h] of trees) {
    if (r() > 0.45) continue;
    const a = r() * Math.PI * 2, d = 1.4 + r() * 2.4;
    const drop = 1.6 + r() * 2.6;
    b.cross(px + Math.cos(a) * d, h * 0.62 - drop, pz + Math.sin(a) * d, 2.2, drop, r() * Math.PI);
  }

  b.group('palmetto');
  for (let i = 0; i < 420; i++) {
    const s = r() * (L + 16) - 8;
    const side = r() > 0.5 ? 1 : -1;
    const lat = side * (1.8 + r() * 9);
    const sc = Math.max(0, Math.min(L, s));
    const [x, z] = trail.at(sc);
    const [nx, nz] = trail.normal(sc);
    if (sc < boardwalkEnd && Math.abs(lat) < 2.0) continue;   // don't grow through the deck
    b.cross(x + nx * lat, 0, z + nz * lat, 1.5 + r() * 1.1, 1.0 + r() * 0.9, r() * Math.PI);
  }

  /* the truck in the gravel lot: one vehicle, no other cars */
  b.group('truck');
  {
    const [x, z] = trail.at(-1);
    const [nx, nz] = trail.normal(-1);
    const tx = x + nx * 4.5, tz = z + nz * 4.5 + 5;
    b.box(tx, 0.35, tz, 2.0, 0.85, 5.0, 1);
    b.box(tx, 1.15, tz + 0.6, 1.85, 0.85, 2.1, 1);
    b.group('bark');
    for (const [ox, oz] of [[-0.85, 1.7], [0.85, 1.7], [-0.85, -1.7], [0.85, -1.7]]) {
      b.box(tx + ox, 0, tz + oz, 0.32, 0.72, 0.72, 1, 0.6);
    }
    b.group('truck');
  }

  /* 0.20 — the fork that is not on the map. Record state only. */
  b.group('mud', 'record');
  {
    const forkS = trail.fromMiles(0.20);
    const [bx, bz] = trail.at(forkS);
    const [nx, nz] = trail.normal(forkS);
    for (let d = 0; d < 26; d += 4) {
      b.ceiling(bx + nx * (2 + d) * 0.95, 0.05, bz + nz * (2 + d) * 0.95 - d * 0.35, 4.5, 5, 0.3);
    }
  }

  /* 0.30 — the grove. Elizabeth's stone, and beside it a smaller one. */
  b.group('stone');
  {
    const [gx, gz] = trail.place(0.30, -3.4);
    const yaw = Math.atan2(trail.tangent(trail.fromMiles(0.30))[0], 1);
    b.box(gx, 0, gz, 0.72, 1.15, 0.16, 1);
    b.box(gx, 0, gz, 0.9, 0.12, 0.4, 1);              // plinth
    b.box(gx + 1.15, 0, gz - 0.3, 0.34, 0.5, 0.12, 1); // Alexander
    // a low wall of stones, half sunk, marking a plot nobody maintains
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      b.box(gx + Math.cos(a) * 4.2, 0, gz + Math.sin(a) * 3.4, 0.5, 0.18 + (i % 3) * 0.06, 0.4, 1);
    }
    void yaw;
  }

  /* 0.40 — Terre Bonne. Record state only. The swamp thins into a field that
     has not existed in 160 years. No figures. No chase. No scare. */
  b.group('field', 'record');
  {
    const fs = trail.fromMiles(0.40);
    // The swamp thins. The ground opens out further than anything else in the
    // game is allowed to, because the point of this stop is that it is a place,
    // not a corridor — and that it is being worked.
    for (let d = -16; d < 34; d += 5) {
      const [x, z] = trail.at(fs + d);
      b.ceiling(x, 0.06, z, 44, 5, 0.16);
    }
  }
  b.group('bark', 'record');
  {
    const fs = trail.fromMiles(0.40);
    // Fence line on both sides, a cart track, and the crop rows themselves:
    // cotton stood in hills, in ground that is swamp again now.
    for (let i = 0; i < 30; i++) {
      const s = fs - 14 + i * 1.6;
      const [x, z] = trail.at(s);
      const [nx, nz] = trail.normal(s);
      for (const side of [-1, 1]) {
        // inside the Record draw distance, or it may as well not be built
        b.box(x + nx * 6.4 * side, 0, z + nz * 6.4 * side, 0.13, 1.05 + (i % 3) * 0.12, 0.13, 1, 0.8);
        if (i % 3 === 0) {   // the rail between the posts
          b.box(x + nx * 6.4 * side + 0.4, 0.85, z + nz * 6.4 * side, 1.6, 0.09, 0.09, 1, 0.7);
        }
      }
    }
    // A hoe left standing in the dirt, and a cart with one wheel off the axle.
    const [cx, cz] = trail.place(0.41, 3.9);
    b.box(cx, 0, cz, 0.09, 1.35, 0.09, 1, 0.9);
    const [wx, wz] = trail.place(0.395, -4.6);
    b.box(wx, 0.35, wz, 1.5, 0.5, 2.6, 1, 0.8);
    b.column(wx - 0.85, wz + 0.9, 0.1, 0.55, 0.55, 8, 1, 0.7);
    b.column(wx + 0.85, wz + 0.9, 0.1, 0.55, 0.55, 8, 1, 0.7);
  }
  b.group('palmetto', 'record');
  {
    // Crop rows as alpha cards — the same cheap plant trick, in ranks this time,
    // which is exactly what makes it read as cultivated instead of grown.
    const fs = trail.fromMiles(0.40);
    for (let row = 0; row < 26; row++) {
      const s = fs - 13 + row * 1.8;
      const [x, z] = trail.at(s);
      const [nx, nz] = trail.normal(s);
      for (let c = -6; c <= 6; c++) {
        if (Math.abs(c) < 2) continue;                 // the path stays clear
        const lat = c * 0.95 + Math.sin(row * 1.7) * 0.2;
        b.cross(x + nx * lat, 0, z + nz * lat, 0.9, 0.95 + ((row + c) % 3) * 0.12, row * 0.4);
      }
    }
  }

  /* 0.50 — the bridge. 1914, 119 feet, no deck. You cannot cross it. */
  b.group('steel');
  {
    const bs = trail.fromMiles(0.50);
    const [bx, bz] = trail.at(bs);
    const [tx, tz] = trail.tangent(bs);
    const [nx, nz] = trail.normal(bs);
    const span = 36;          // 119 feet, compressed with everything else
    const put = (d, lat, y, sx, sy, sz) =>
      b.box(bx + tx * d + nx * lat, y, bz + tz * d + nz * lat, sx, sy, sz);

    for (const lat of [-2.2, 2.2]) {
      put(span / 2, lat, 0.4, 0.4, 0.35, span);                 // bottom chord
      put(span / 2, lat, 4.6, 0.4, 0.35, span);                 // top chord
      for (let i = 0; i <= 9; i++) {                            // verticals + diagonals
        const d = 1 + i * (span / 9.5);
        put(d, lat, 0.6, 0.3, 4.1, 0.3);
        b.box(bx + tx * (d + 1) + nx * lat, 2.4, bz + tz * (d + 1) + nz * lat, 0.22, 2.6, 0.22, 1, 0.8);
      }
    }
    for (let i = 0; i <= 8; i++) {                              // sway bracing overhead
      const d = 2 + i * (span / 9);
      b.box(bx + tx * d, 4.7, bz + tz * d, 5.0, 0.22, 0.28);
    }
    // the deck is gone. Two stringers and nothing between them.
    put(span / 2, -1.1, 0.75, 0.22, 0.14, span);
    put(span / 2, 1.1, 0.75, 0.22, 0.14, span);
  }

  return b;
}

/* ----------------------------------------------------- artifact placement */
export function placeArtifacts(trail) {
  return ARTIFACTS.map((a, i) => {
    const jitter = ((i * 37) % 7) / 7 - 0.5;
    const mile = Math.min(0.495, Math.max(0.005, a.stop + jitter * 0.006));
    const lat = a.side * (a.prop ? 3.2 : 1.9);
    const [x, z] = trail.place(mile, lat);
    const s = trail.fromMiles(mile);
    const [nx, nz] = trail.normal(s);
    return {
      ...a,
      x, z,
      y: a.prop ? 0.0 : 0.75,
      yaw: Math.atan2(-nx * a.side, -nz * a.side),
      read: false,
    };
  });
}

// The readable things themselves: county signage on posts, and the documents
// somebody tucked behind them. The graves are already in the world mesh.
export function buildArtifactProps(instances) {
  const b = new Builder();
  for (const a of instances) {
    if (a.prop) continue;                       // headstones are part of the grove
    if (a.kind === 'plaque') {
      b.group('bark');
      b.box(a.x, 0, a.z, 0.12, 0.78, 0.12, 1, 0.7);
      b.group('plaque');
      b.panel(a.x, 0.72, a.z, 0.86, 0.6, a.yaw);
    } else {
      b.group('paper', a.record ? 'record' : 'always');
      // smaller, lower, and behind the sign — you have to be looking for it
      b.panel(a.x + Math.cos(a.yaw) * 0.06, 0.42, a.z, 0.34, 0.44, a.yaw);
    }
  }
  return b;
}

export { TRAIL_MILES };
