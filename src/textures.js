// Terre Bonne — procedural texture set.
// 64-128px, point-filtered, no mipmaps, and locked to the document's palette:
// tannin black, silt, moss, bone, lamp amber, record blue.

const PAL = {
  water:  [0x0b, 0x0d, 0x0b],
  silt:   [0x14, 0x17, 0x0f],
  moss:   [0x2e, 0x37, 0x29],
  bone:   [0xd8, 0xd1, 0xc0],
  fog:    [0x8a, 0x90, 0x83],
  lamp:   [0xd9, 0x9a, 0x3e],
  record: [0x9f, 0xb6, 0xbe],
};

// Deterministic noise — the swamp should look the same every time you walk it.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function surface(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  return { c, g, img, size, d: img.data };
}

function px(s, x, y, r, gr, b, a = 255) {
  const i = ((y & (s.size - 1)) * s.size + (x & (s.size - 1))) * 4;
  s.d[i] = r; s.d[i + 1] = gr; s.d[i + 2] = b; s.d[i + 3] = a;
}

function finish(s) { s.g.putImageData(s.img, 0, 0); return s.c; }

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* ------------------------------------------------------------- generators */

function bark(seed) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      // vertical fibre, occasional deep fissure
      const fib = Math.sin(x * 1.7 + Math.sin(y * 0.12) * 2.4) * 0.5 + 0.5;
      const grime = r() * 0.35;
      let t = 0.30 + fib * 0.55 + grime * 0.4;
      if (((x * 7 + ((y >> 3) * 3)) % 23) < 2) t *= 0.45;      // fissures
      const c = mix(PAL.silt, mix(PAL.moss, PAL.bone, 0.22), t);
      // damp moss creeps up from the bottom of every trunk in this county
      const damp = Math.max(0, 1 - y / 46) * (r() * 0.5 + 0.5) * 0.4;
      const f = mix(c, PAL.moss, damp);
      px(s, x, y, f[0], f[1], f[2]);
    }
  }
  return finish(s);
}

function planks(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    const board = (y / 16) | 0;
    const shade = 0.55 + ((board * 37) % 11) / 11 * 0.45;
    for (let x = 0; x < 128; x++) {
      const grain = Math.sin(x * 0.35 + board * 5.1) * 0.5 + 0.5;
      let t = (0.16 + grain * 0.22 + r() * 0.14) * shade;
      const gap = (y % 16) < 1 || (y % 16) === 15;
      if (gap) t *= 0.12;                                        // dark between boards
      if (x % 64 < 2 && !gap) t *= 0.7;                          // joist nailing line
      const c = mix(PAL.silt, mix(PAL.moss, PAL.bone, 0.5), 0.18 + t * 1.9);
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

function mud(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const blot = Math.sin(x * 0.21) * Math.cos(y * 0.17) * 0.5 + 0.5;
      let t = 0.1 + blot * 0.16 + r() * 0.2;
      const leaf = r();
      let c = mix(PAL.silt, mix(PAL.moss, PAL.bone, 0.34), 0.25 + t * 1.7);
      if (leaf > 0.982) c = mix(c, PAL.lamp, 0.22);              // a dead leaf, barely
      if (leaf < 0.006) c = mix(c, PAL.bone, 0.3);               // shell grit
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

function water(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const ripple = Math.sin(x * 0.16 + Math.sin(y * 0.09) * 3) * 0.5 + 0.5;
      const t = 0.05 + ripple * 0.14 + r() * 0.05;
      let c = mix(PAL.water, PAL.record, t);
      if (r() > 0.995) c = mix(c, PAL.moss, 0.55);               // duckweed
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// Alpha-cut foliage card. Palmetto fans and cypress needle mass share a builder;
// only the silhouette differs.
function frond(seed, kind) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) px(s, x, y, 0, 0, 0, 0);
  }
  const blades = kind === 'palmetto' ? 13 : 30;
  for (let b = 0; b < blades; b++) {
    const a = kind === 'palmetto'
      ? (-Math.PI * 0.9 + (b / (blades - 1)) * Math.PI * 0.8)
      : (r() * Math.PI * 2);
    const len = kind === 'palmetto' ? 26 + r() * 6 : 10 + r() * 20;
    const ox = 32, oy = kind === 'palmetto' ? 60 : 32;
    const shade = 0.28 + r() * 0.5;
    for (let t = 0; t < len; t++) {
      const wob = kind === 'palmetto' ? Math.sin(t * 0.2 + b) * 1.2 : 0;
      const x = Math.round(ox + Math.cos(a) * t + wob);
      const y = Math.round(oy + Math.sin(a) * t);
      const w = kind === 'palmetto' ? Math.max(1, 3 - (t / len) * 3) : 1;
      for (let k = -w; k <= w; k++) {
        const c = mix(PAL.silt, mix(PAL.moss, PAL.bone, 0.18), shade + (1 - Math.abs(k) / (w + 1)) * 0.35);
        if (x >= 0 && x < 64 && y >= 0 && y < 64) px(s, x, y + 0, c[0], c[1], c[2], 255), px(s, x + k, y, c[0], c[1], c[2], 255);
      }
    }
  }
  return finish(s);
}

// Spanish moss: hanging vertical strands, mostly empty.
function hangingMoss(seed) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) px(s, x, y, 0, 0, 0, 0);
  for (let n = 0; n < 26; n++) {
    let x = Math.floor(r() * 64);
    const len = 12 + r() * 46;
    for (let y = 0; y < len; y++) {
      if (r() > 0.86) x += r() > 0.5 ? 1 : -1;
      const t = 0.35 + (1 - y / len) * 0.25 + r() * 0.2;
      const c = mix(PAL.moss, PAL.fog, t);
      px(s, x, y, c[0], c[1], c[2], 255);
      if (r() > 0.6) px(s, x + 1, y, c[0], c[1], c[2], 255);
    }
  }
  return finish(s);
}

function stone(seed) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const t = 0.46 + r() * 0.2 + Math.sin(x * 0.4 + y * 0.2) * 0.06;
      let c = mix(PAL.moss, PAL.bone, t);
      // lichen along the north face, and the weathering of 189 years
      if (r() > 0.972) c = mix(c, PAL.moss, 0.75);
      if (y > 46 && r() > 0.6) c = mix(c, PAL.moss, (y - 46) / 40);
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// Interpretive signage — the story the county tells, in county brown.
function plaque(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      let c = mix(PAL.silt, PAL.moss, 0.35 + r() * 0.1);
      const inset = x > 8 && x < 120 && y > 10 && y < 118;
      if (inset) c = mix(c, PAL.lamp, 0.16);
      // fake lines of text, unreadable at this resolution — as intended
      if (inset && y > 24 && ((y - 24) % 9) < 3 && x > 16 && x < 112 - ((y * 7) % 24)) {
        c = mix(c, PAL.bone, 0.55);
      }
      if (inset && y >= 14 && y < 22 && x > 16 && x < 84) c = mix(c, PAL.bone, 0.8);
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// A photocopy someone left tucked behind the sign. Cold, documentary, true.
function paper(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      let c = mix(PAL.fog, PAL.bone, 0.5 + r() * 0.25);
      if (x < 4 || x > 123 || y < 4 || y > 123) c = mix(c, PAL.silt, 0.5);
      if (((y - 12) % 8) < 2 && y > 12 && y < 112 && x > 12 && x < 116 - ((y * 13) % 30)) {
        c = mix(c, PAL.water, 0.7);
      }
      if (r() > 0.99) c = mix(c, PAL.silt, 0.6);                 // toner speckle
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// 1914 steel truss, riveted, rusted, no deck left.
function steel(seed) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let t = 0.34 + r() * 0.16;
      let c = mix(PAL.silt, PAL.fog, t);
      const rust = Math.sin(x * 0.3) * Math.cos(y * 0.22) * 0.5 + 0.5;
      if (rust > 0.62) c = mix(c, PAL.lamp, (rust - 0.62) * 0.8);
      if (x % 16 === 8 && y % 16 === 8) c = mix(c, PAL.bone, 0.35);   // rivet
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// The field at 0.40: cotton rows in ground that is swamp again now.
function field(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const row = Math.abs(Math.sin(y * 0.19));
      let t = 0.08 + row * 0.14 + r() * 0.12;
      let c = mix(PAL.silt, mix(PAL.moss, PAL.bone, 0.28), 0.2 + t * 1.9);
      if (row > 0.93 && r() > 0.8) c = mix(c, PAL.bone, 0.25);   // a boll, or something white
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

function gravel(seed) {
  const s = surface(128), r = rng(seed);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const t = 0.12 + r() * 0.3;
      const c = mix(PAL.silt, PAL.fog, 0.2 + t * 0.8);
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

function truckPaint(seed) {
  const s = surface(64), r = rng(seed);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let c = mix(PAL.water, PAL.moss, 0.4 + r() * 0.1);
      if (y > 18 && y < 34) c = mix(c, PAL.record, 0.28);        // window band
      px(s, x, y, c[0], c[1], c[2]);
    }
  }
  return finish(s);
}

// The silhouette. She is never a model the player is allowed to look at:
// a soft-edged alpha card, and the fog is always in front of her.
function figure() {
  const s = surface(64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const nx = (x - 32) / 32, ny = y / 64;
      // a shape that reads as a standing person and resolves into nothing
      const width = 0.10 + (ny > 0.22 ? (ny - 0.22) * 0.55 : 0) + (ny < 0.16 ? 0.04 : 0);
      const head = Math.hypot(nx, (ny - 0.11) * 2.6) < 0.17;
      const bodyShape = Math.abs(nx) < width && ny > 0.14;
      const inside = head || bodyShape;
      if (!inside) { px(s, x, y, 0, 0, 0, 0); continue; }
      const edge = 1 - Math.min(1, Math.abs(nx) / Math.max(width, 0.001));
      const c = mix(PAL.water, PAL.fog, 0.10 + edge * 0.16);
      px(s, x, y, c[0], c[1], c[2], 255);
    }
  }
  return finish(s);
}

// A distant light moving in the trees. Ending 03 only.
function lampCard() {
  const s = surface(32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 16, y - 16) / 16;
      const a = Math.max(0, 1 - d);
      const c = mix(PAL.lamp, PAL.bone, Math.max(0, 1 - d * 2.4));
      px(s, x, y, c[0], c[1], c[2], a > 0.08 ? 255 : 0);
    }
  }
  return finish(s);
}

/* ------------------------------------------------------------------ build */
export function buildTextures(renderer) {
  const src = {
    bark: bark(11), barkB: bark(97),
    planks: planks(23),
    mud: mud(41),
    water: water(53),
    palmetto: frond(67, 'palmetto'),
    canopy: frond(71, 'canopy'),
    moss: hangingMoss(83),
    stone: stone(29),
    plaque: plaque(31),
    paper: paper(37),
    steel: steel(43),
    field: field(59),
    gravel: gravel(61),
    truck: truckPaint(73),
    figure: figure(),
    lamp: lampCard(),
  };
  const out = {};
  for (const k in src) out[k] = renderer.makeTexture(src[k]);
  return out;
}

export { PAL };
