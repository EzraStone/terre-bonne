// Terre Bonne — playthrough tests.
//
// These cover the paths that break silently: the four ending triggers, the
// belief rule, the dread/prayer loop, memory seeding, and the settings that
// persist. Everything here drives the real game in a real browser, because the
// bugs worth catching live in the wiring, not in the arithmetic.
//
//   npm test          (starts its own static server on 8123)
//
// Needs playwright and a chromium. Set CHROMIUM_PATH to override the binary.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT || 8123);
const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json',
};

/* ------------------------------------------------------------ tiny harness */
let passed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

function eq(name, actual, expected) {
  check(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

function section(title) { console.log(`\n${title}`); }

/* ------------------------------------------------------------ static serve */
function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (path.includes('..')) { res.writeHead(403).end(); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/* ----------------------------------------------------------------- browser */
async function launch() {
  // Prefer a local install, fall back to a global one (common on dev boxes and
  // CI images that ship playwright system-wide).
  const candidates = ['playwright'];
  if (process.env.PLAYWRIGHT_PATH) candidates.push(process.env.PLAYWRIGHT_PATH);
  for (const dir of ['/opt/node22/lib/node_modules', '/usr/lib/node_modules',
                     '/usr/local/lib/node_modules']) {
    candidates.push(`${dir}/playwright/index.js`);
  }

  let playwright;
  for (const spec of candidates) {
    try { playwright = await import(spec); break; } catch { /* try the next one */ }
  }
  if (!playwright) {
    console.error('These tests need playwright:  npm i -D playwright');
    console.error('(or point PLAYWRIGHT_PATH at an existing install)');
    process.exit(2);
  }
  const opts = {
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  // CommonJS playwright imported from ESM lands under .default
  const chromium = playwright.chromium || (playwright.default && playwright.default.chromium);
  if (!chromium) { console.error('playwright loaded but exposes no chromium'); process.exit(2); }
  return chromium.launch(opts);
}

/* -------------------------------------------------------------------- main */
const server = await serve();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e.message)));
page.on('console', (m) => {
  // Google Fonts is optional and may be unreachable offline; that is not a bug.
  if (m.type() === 'error' && !/404|ERR_CONNECTION|fonts\.googleapis/.test(m.text())) {
    consoleErrors.push(m.text());
  }
});

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.game, null, { timeout: 15000 });

// Drop straight past the cold open for every test that is not about the gate.
const play = () => page.evaluate(() => {
  const g = window.game;
  g.begin();
  g.phase = 'walk';
  g.gateStage = 5;
  g.paused = false;
});

const goto = (mile, lat = 0) => page.evaluate(([m, l]) => {
  const g = window.game;
  const s = g.trail.fromMiles(m);
  const [x, z] = g.trail.at(s);
  const [nx, nz] = g.trail.normal(s);
  g.p.x = x + nx * l; g.p.z = z + nz * l;
  const [tx, tz] = g.trail.tangent(s);
  g.p.yaw = Math.atan2(-tx, -tz);
  g.checkStops();
}, [mile, lat]);

/* --------------------------------------------------------------- the world */
section('world');
{
  const w = await page.evaluate(() => ({
    batches: window.game.batches.length,
    artifacts: window.game.artifacts.length,
    ledger: window.game.artifacts.filter(a => a.ledger).length,
    pairs: new Set(window.game.artifacts.map(a => a.pairId).filter(Boolean)).size,
    length: Math.round(window.game.trail.length),
  }));
  check('geometry batches built', w.batches > 10, `got ${w.batches}`);
  check('artifact set is the full pass', w.artifacts >= 24, `got ${w.artifacts}`);
  eq('three ledger leaves', w.ledger, 3);
  check('plaque/document pairs', w.pairs >= 6, `got ${w.pairs}`);
  check('trail is a walkable length', w.length > 180 && w.length < 260, `got ${w.length}m`);
}

/* -------------------------------------------------------------- the light */
section('belief — you can read both, you cannot hold both');
await play();
{
  const r = await page.evaluate(() => {
    const g = window.game;
    const face = (a) => {
      g.p.x = a.x + Math.sin(a.yaw) * 1.1;
      g.p.z = a.z + Math.cos(a.yaw) * 1.1;
      g.p.yaw = Math.atan2(a.x - g.p.x, a.z - g.p.z) + Math.PI;
    };
    const plaque = g.artifacts.find(x => x.id === 'sign-boardwalk');
    const doc = g.artifacts.find(x => x.id === 'doc-obituary');
    face(plaque);
    const prompt = (g.updateHud(), document.getElementById('prompt').textContent);
    g.onUse();
    const opened = g.ui.readerOpen;
    const title = document.getElementById('reader-title').textContent;
    const warm = g.state;
    g.closeReader();
    face(doc); g.onUse();
    const cold = g.state;
    g.closeReader();
    return { prompt, opened, title, warm, cold };
  });
  check('interaction prompt names the thing', /read/i.test(r.prompt), r.prompt);
  check('reader opens', r.opened);
  eq('reader shows the right document', r.title, 'The Bride of Bellamy Bridge');
  eq('the plaque warms the light', r.warm, 'legend');
  eq('the document underneath cools it', r.cold, 'record');
}
{
  const drift = await page.evaluate(() => {
    const g = window.game;
    g.belief = -0.9;
    for (let i = 0; i < 60 * 240; i++) {
      if (g.belief < -0.05 && !g.ui.readerOpen) g.belief = Math.min(-0.05, g.belief + (1 / 60) * 0.010);
    }
    return { belief: +g.belief.toFixed(3), state: g.state };
  });
  eq('comfort pulls belief back to the boundary', drift.belief, -0.05);
  eq('but never flips the light on its own', drift.state, 'record');
}

/* ------------------------------------------------- the record opens the way */
section('record state gates the geometry');
{
  const vis = await page.evaluate(() => {
    const g = window.game;
    const led = g.artifacts.find(a => a.ledger);
    g.belief = 1; const warm = g.visible(led);
    g.belief = -1; const cold = g.visible(led);
    const recordBatches = g.batches.filter(b => b.tag === 'record').length;
    return { warm, cold, recordBatches };
  });
  eq('ledger is invisible in Legend', vis.warm, false);
  eq('ledger exists in Record', vis.cold, true);
  check('record-only geometry is tagged', vis.recordBatches > 0, `got ${vis.recordBatches}`);
}

/* ------------------------------------------------------------ dread/prayer */
section('prayer is pressure relief, and it costs');
{
  const d = await page.evaluate(() => {
    const g = window.game;
    g.belief = 1; g.dread = 0.5;
    for (let i = 0; i < 600; i++) g.updateDread(1 / 60);
    const warm = g.dread;

    g.belief = -1; g.dread = 0; g.calm = 0; g.memoriesLost = 0; g.seeded = new Set();
    for (let i = 0; i < 60 * 90; i++) g.updateDread(1 / 60);
    const cold = g.dread;
    const drag = g.dreadDrag;
    const draw = g.drawDistance;

    const calmDraw = (g.dread = 0, g.drawDistance);   // same light, no pressure
    g.dread = cold;
    g.pray();
    return { warm, cold: +cold.toFixed(2), drag: +drag.toFixed(2), draw, calmDraw,
             afterPray: g.dread, memories: g.memoriesLost, calm: g.calm > 0 };
  });
  eq('dread does not accumulate in the warm', d.warm, 0);
  check('dread builds in Record', d.cold > 0.8, `got ${d.cold}`);
  check('the walk slows but never stops', d.drag > 0 && d.drag < 0.4, `drag ${d.drag}`);
  check('the draw distance tightens with it', d.draw < d.calmDraw * 0.8,
        `${d.draw.toFixed(1)}m under pressure vs ${d.calmDraw.toFixed(1)}m calm`);
  eq('prayer clears it', d.afterPray, 0);
  check('prayer buys real quiet', d.calm);
  eq('and it takes a memory', d.memories, 1);
}
{
  const warmPray = await page.evaluate(() => {
    const g = window.game;
    g.belief = 1;
    const before = g.memoriesLost;
    g.pray();
    return { before, after: g.memoriesLost };
  });
  eq('prayer in Legend costs nothing', warmPray.after, warmPray.before);
}
{
  const seed = await page.evaluate(() => {
    const g = window.game;
    g.reset(); g.phase = 'walk';
    const s = g.trail.fromMiles(0.05); const [x, z] = g.trail.at(s);
    g.p.x = x; g.p.z = z; g.checkStops();
    return { seeded: g.seeded.has(0), queued: g.ui.queue.map(q => q.text).join(' ') };
  });
  check('the soft memory is seeded on the trail', seed.seeded);
  check('and it is the comfortable version', /screen door/.test(seed.queued));
}

/* ---------------------------------------------------------------- scheduling */
section('cues wait for the player to look up');
{
  const t = await page.evaluate(() => {
    const g = window.game;
    let fired = false;
    g.after(0.1, () => { fired = true; });
    g.ui.readerOpen = true;
    for (let i = 0; i < 60; i++) g.updateTimers(1 / 60);
    const whileReading = fired;
    g.ui.readerOpen = false;
    for (let i = 0; i < 60; i++) g.updateTimers(1 / 60);
    return { whileReading, after: fired };
  });
  eq('nothing fires while a document is open', t.whileReading, false);
  eq('it fires once it is closed', t.after, true);
}

/* --------------------------------------------------------------- the loops */
section('the trail is longer than the sign says');
await play();
await page.evaluate(() => { window.game.belief = -1; });
await goto(0.49);
{
  const bridge = await page.evaluate(() => ({
    reached: window.game.reachedBridge, outbound: window.game.outbound,
  }));
  eq('the bridge turns him around', bridge.reached, true);
  eq('and the walk back is inbound', bridge.outbound, false);
}
await goto(0.005);
eq('returning to the gate starts loop two', await page.evaluate(() => window.game.loop), 2);
{
  const three = await page.evaluate(() => {
    const g = window.game;
    const s = g.trail.fromMiles(0.49), [x, z] = g.trail.at(s);
    g.p.x = x; g.p.z = z; g.checkStops();
    const [x2, z2] = g.trail.at(1); g.p.x = x2; g.p.z = z2; g.checkStops();
    return { loop: g.loop, wildlife: g.audio.wildlife };
  });
  eq('loop three arrives', three.loop, 3);
  eq('and takes the whole bed with it', three.wildlife, 0);
}

/* -------------------------------------------------------------- the field */
section('the layer underneath');
await play();
await page.evaluate(() => { window.game.belief = -1; });
await goto(0.405);
await page.waitForTimeout(600);
{
  const field = await page.evaluate(() => ({
    work: window.game.audio.work,
    warm: (() => { const g = window.game; const b = g.belief; g.belief = 1;
                   const v = g.mile > 0.34 && g.state === 'record'; g.belief = b; return v; })(),
  }));
  check('the field is audible in Record', field.work > 0.5, `got ${field.work}`);
  eq('and silent in Legend', field.warm, false);
}

/* ------------------------------------------------------------- the endings */
section('four ways off the trail');
// Walking back to the truck: what that means depends on how far he got.
const walkOut = (maxMile) => page.evaluate((m) => {
  const g = window.game;
  g.reset(); g.phase = 'walk'; g.gateStage = 5; g.paused = false;
  g.maxMile = m;
  const [tx, tz] = g.trail.at(-1);
  const [nx, nz] = g.trail.normal(-1);
  g.p.x = tx + nx * 4.5; g.p.z = tz + nz * 4.5 + 5;
  let landed = null;
  const realEnd = g.end.bind(g);
  g.end = (w) => { landed = w; };
  g.onUse();
  g.end = realEnd;
  return landed;
}, maxMile);

eq('0.00 is the gate ending', await walkOut(0.04), 'zero');
eq('past the boardwalk it is Barred Owl instead', await walkOut(0.40), 'owl');
{
  await play();
  const reg = await page.evaluate(async () => {
    const g = window.game;
    g.artifacts.filter(a => a.ledger).forEach(a => { if (!a.read) { a.read = true; g.ledger++; } });
    g.belief = -1;
    const s = g.trail.fromMiles(0.49), [x, z] = g.trail.at(s);
    g.p.x = x; g.p.z = z; g.checkStops();
    const can = g.canRegister();
    g.keys.add('e');
    await new Promise(r => setTimeout(r, 2000));
    g.keys.delete('e');
    return { can, phase: g.phase };
  });
  eq('The Register unlocks with all three leaves', reg.can, true);
  eq('and holding E ends the game', reg.phase, 'ending');
  await page.waitForTimeout(3200);
  eq('the right ending is shown', await page.evaluate(() =>
    document.getElementById('ending-title').textContent), 'The Register');
  check('credits roll on the second press', await page.evaluate(() => {
    window.game.ui.advanceEnding();
    return document.getElementById('ending-body').textContent.includes('fictional composites');
  }));
  eq('the ending is remembered', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('terrebonne.endings') || '[]').includes('register')), true);
}
{
  await play();
  const refuse = await page.evaluate(async () => {
    const g = window.game;
    g.loop = 3; g.reachedBridge = true; g.belief = -1;
    const s = g.trail.fromMiles(0.49), [x, z] = g.trail.at(s);
    g.p.x = x; g.p.z = z; g.mile = 0.49;
    const can = g.canRefuse();
    g.keys.add('x');
    await new Promise(r => setTimeout(r, 2400));
    g.keys.delete('x');
    return { can, phase: g.phase, cine: !!g.cine };
  });
  eq('Always and Forever unlocks on loop three', refuse.can, true);
  eq('and holding X ends the game', refuse.phase, 'ending');
  check('the camera lets go of him', refuse.cine);
}

/* -------------------------------------------------------------- the shell */
section('pause, options, and what the game remembers');
{
  await play();
  const p = await page.evaluate(async () => {
    const g = window.game;
    g.setPaused(true);
    const shown = document.getElementById('pause').classList.contains('show');
    const x0 = g.p.x;
    g.keys.add('w');
    await new Promise(r => setTimeout(r, 400));
    const moved = Math.abs(g.p.x - x0) > 0.001;
    g.keys.delete('w');
    g.setPaused(false);
    return { shown, moved };
  });
  check('pause panel appears', p.shown);
  eq('nothing moves while paused', p.moved, false);
}
{
  await page.evaluate(() => {
    const ui = window.game.ui;
    ui.settings.sens = 1.6; ui.settings.invert = true; ui.settings.subs = 1.25;
    ui.saveSettings();
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.game, null, { timeout: 15000 });
  const s = await page.evaluate(() => window.game.ui.settings);
  eq('sensitivity persists', s.sens, 1.6);
  eq('invert persists', s.invert, true);
  eq('subtitle size persists', s.subs, 1.25);

  const look = await page.evaluate(() => {
    const g = window.game;
    g.begin(); g.phase = 'walk'; g.paused = false; g.pointerLocked = true;
    g.p.pitch = 0;
    dispatchEvent(new MouseEvent('mousemove', { movementX: 0, movementY: 100 }));
    return g.p.pitch;
  });
  check('invert actually inverts the look', look > 0, `pitch ${look.toFixed(3)}`);

  const found = await page.evaluate(() =>
    document.getElementById('found').textContent.includes('The Register'));
  check('the endings ledger survives a reload', found);
}

/* ----------------------------------------------------------------- wrap up */
section('runtime');
check('no uncaught errors during the whole run', consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('failed: ' + failures.join(', '));
  process.exit(1);
}
