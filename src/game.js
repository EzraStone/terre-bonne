// Terre Bonne — game logic.
//
// Three rules decide every argument in this file:
//   1. The limitation is the monster. Nothing is ever rendered clearly enough to settle.
//   2. Sadness is the payload, horror is the delivery.
//   3. The comfortable version is the trap — never punished with a jump scare,
//      only with a shorter game.

import { Renderer, RES, M4 } from './gl.js';
import { buildTextures } from './textures.js';
import { billboardMesh } from './geometry.js';
import { Trail, buildWorld, buildArtifactProps, placeArtifacts } from './world.js';
import { Audio } from './audio.js';
import { MEMORIES, LINES, IDLE, ENDINGS, CREDITS } from './content.js';
import { UI } from './ui.js';

const EYE = 1.65;
const WALK = 2.15;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Legend 2200K: candle, kerosene, the warm lie. Record 5600K: cold, documented.
const LIGHT_LEGEND = [1.00, 0.66, 0.28];
const LIGHT_RECORD = [0.70, 0.82, 0.88];
const FOG_LEGEND = [0.055, 0.062, 0.052];
const FOG_RECORD = [0.042, 0.050, 0.055];

function modelAt(x, y, z, yaw, scale = 1) {
  const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
  return new Float32Array([
    c, 0, -s, 0,
    0, scale, 0, 0,
    s, 0, c, 0,
    x, y, z, 1,
  ]);
}

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.tex = buildTextures(this.renderer);
    this.audio = new Audio();
    this.ui = new UI(this);

    this.trail = new Trail();
    this.artifacts = placeArtifacts(this.trail);
    this.batches = buildWorld(this.trail).compile(this.renderer);
    this.batches = this.batches.concat(buildArtifactProps(this.artifacts).compile(this.renderer));
    this.figureQuad = this.renderer.upload(billboardMesh(0.75, 1.75));
    this.lampQuad = this.renderer.upload(billboardMesh(0.5, 0.5));

    this.reset();
    this.bindInput(canvas);

    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  reset() {
    const t = this.trail;
    const [sx, sz] = t.at(0);
    const [tx, tz] = t.tangent(0);
    this.p = { x: sx, z: sz, yaw: Math.atan2(-tx, -tz), pitch: 0 };
    this.phase = 'title';

    // He drove down from Dothan wanting the ghost story to be true. Start warm.
    this.belief = 0.35;
    this.lightMix = 1;              // 1 = legend amber, 0 = record blue-white
    this.loop = 1;
    this.outbound = true;
    this.reachedBridge = false;
    this.prayers = 0;
    this.memoriesLost = 0;
    this.seeded = new Set();
    this.dread = 0;
    this.dreadTick = 8;
    this.maxMile = 0;
    this.timers = [];
    this.idleTimer = 34;
    this.idleUsed = new Set();
    this.ledger = 0;
    this.laughs = 0;
    this.gateStage = 0;
    this.bobPhase = 0;
    this.stepAccum = 0;
    this.prayHold = 0;
    this.stayHold = 0;
    this.readHold = 0;
    this.presence = { vis: 0, timer: 6, active: false, pose: 0 };
    this.shapeNoteUsed = [false, false, false];
    this.fade = 1;
    this.fadeTarget = 1;
    this.flicker = 1;
    this.calm = 0;
    this.mile = 0;
    this.cine = null;
    this.recorderOpen = false;
    this.paused = false;
    this.seen = new Set();
    for (const a of this.artifacts) a.read = false;
  }

  /* ------------------------------------------------------------- input */
  bindInput(canvas) {
    this.keys = new Set();
    this.pointerLocked = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'escape') {
        if (this.ui.readerOpen) this.closeReader();
        else document.exitPointerLock();
      }
      if (k === 'e') this.onUse();
      if (k === 'r') this.toggleRecorder();
      if ((k === ' ' || k === 'enter') && this.phase === 'ending') this.ui.advanceEnding();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (this.paused) { this.setPaused(false); return; }
      if (this.phase === 'walk' && !this.ui.readerOpen) this.grabPointer();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      document.body.classList.toggle('playing', this.pointerLocked);
      const playing = this.phase === 'walk' || this.phase === 'gate';
      if (!this.pointerLocked && playing && !this.ui.readerOpen && !this.paused) {
        this.setPaused(true);
      }
    });
    addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || this.paused) return;
      const s = this.ui.settings;
      const inv = s.invert ? -1 : 1;
      this.p.yaw -= e.movementX * 0.0022 * s.sens;
      this.p.pitch = clamp(this.p.pitch - e.movementY * 0.0022 * s.sens * inv, -1.2, 1.2);
    });
  }

  /* --------------------------------------------------------------- pausing */
  // Esc is swallowed by the browser when it exits pointer lock, so the lock
  // change is the signal rather than the keypress.
  setPaused(on) {
    if (this.phase !== 'walk' && this.phase !== 'gate') return;
    this.paused = on;
    this.keys.clear();
    this.ui.setPausePanel(on);
    if (!on) this.grabPointer();
  }

  // Chromium logs an error if you ask for a lock you already hold, and the
  // request can reject outright when it arrives without a user gesture.
  grabPointer() {
    if (this.pointerLocked) return;
    const r = this.renderer.canvas.requestPointerLock();
    if (r && typeof r.catch === 'function') r.catch(() => { /* needs a click first */ });
  }

  quitToTitle() {
    this.paused = false;
    this.phase = 'title';
    this.audio.tapeHiss(false);
    this.audio.wildlife = 1;
    this.audio.work = 0;
    this.ui.setHud(false);
    this.ui.clearLines();
    this.ui.setRecorder(null);
    this.ui.showTitle();
  }

  begin() {
    this.reset();
    this.audio.start();
    this.audio.resume();
    this.ui.applySettings();      // volume needs the graph to exist first
    this.phase = 'gate';
    this.ui.hidePanels();
    this.ui.setHud(true);
    this.gateStage = 0;
    this.gateTimer = 1.2;
    this.grabPointer();
  }

  /* ------------------------------------------------------- belief & light */
  get state() { return this.belief >= 0 ? 'legend' : 'record'; }

  get drawDistance() {
    // Legend 20 m · Record 12 m · loop three drops to 8 m.
    const base = lerp(12, 20, clamp(this.lightMix, 0, 1));
    const d = this.loop >= 3 ? Math.min(base, 8) : base;
    return d * (1 - 0.3 * this.dread);   // it closes in as the pressure builds
  }

  // You can read both. You cannot hold both: the thing most recently read wins,
  // and what came before it only softens how hard the light swings.
  shiftBelief(dir) {
    const before = this.state;
    this.belief = clamp(this.belief * 0.35 + dir * 0.75, -1, 1);
    const after = this.state;
    if (before !== after) {
      if (after === 'legend' && !this.seen.has('firstWarm')) { this.seen.add('firstWarm'); this.say(LINES.firstWarm); }
      if (after === 'record' && !this.seen.has('firstCold')) { this.seen.add('firstCold'); this.say(LINES.firstCold); }
    }
  }

  /* --------------------------------------------------------------- lines */
  say(lines, delay = 0) {
    this.ui.queueLines(lines, delay);
  }

  // Game-time scheduling. Wall-clock timers fire while the player is nose-deep
  // in a document; these wait until he has looked up and is walking again.
  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  updateTimers(dt) {
    if (this.ui.readerOpen || this.phase === 'ending') return;
    for (const timer of this.timers) timer.t -= dt;
    const due = this.timers.filter(x => x.t <= 0);
    if (due.length) {
      this.timers = this.timers.filter(x => x.t > 0);
      for (const d of due) d.fn();
    }
  }

  /* ------------------------------------------------------------ artifacts */
  visible(a) {
    if (a.record && this.state !== 'record') return false;   // ledger only opens cold
    return true;
  }

  nearestArtifact() {
    const fx = -Math.sin(this.p.yaw), fz = -Math.cos(this.p.yaw);
    let best = null, bestD = 3.0;
    for (const a of this.artifacts) {
      if (!this.visible(a)) continue;
      const dx = a.x - this.p.x, dz = a.z - this.p.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      if ((dx / d) * fx + (dz / d) * fz < 0.45) continue;
      best = a; bestD = d;
    }
    return best;
  }

  onUse() {
    if (this.phase === 'ending') { this.ui.advanceEnding(); return; }
    if (this.ui.readerOpen) { this.closeReader(); return; }
    if (this.phase !== 'walk' && this.phase !== 'gate') return;

    // the truck: the only way this ends without anybody getting hurt
    if (this.nearTruck()) {
      // Turning around before the bridge is the hidden ending: he never finds out,
      // and nobody is hurt. Walking out after it is the story the town tells.
      // 0.00 is the gate ending, not a general escape hatch: he has to turn
      // around before the trail has shown him anything. Past the boardwalk he
      // has already seen too much, and walking out is Ending 01 instead.
      if (this.loop === 1 && this.maxMile < 0.12 && this.gateStage >= 4) this.end('zero');
      else this.end('owl');
      return;
    }

    const a = this.nearestArtifact();
    if (a) this.openReader(a);
  }

  openReader(a) {
    const first = !a.read;
    a.read = true;
    if (first) {
      this.shiftBelief(a.belief);
      if (a.ledger) {
        this.ledger++;
        if (this.ledger === 3) this.say(LINES.ledgerDone, 1.0);
      }
      // The laugh fires every time Ray accepts an easy explanation — but on
      // game time, so it lands when he looks up from the sign, not while he is
      // still reading it.
      if (a.kind === 'plaque') {
        // The gate already spent occurrences one and two; every one after that
        // is the third mix — 10/90, and close.
        const n = this.laughs++;
        this.after(1.6, () => {
          if (n === 0) this.audio.stinger();   // marked loud point, one of two
          this.audio.laugh(2);
        });
      }
    }
    this.ui.openReader(a, this.loop);
    document.exitPointerLock();
  }

  closeReader() {
    this.ui.closeReader();
    if (this.phase === 'walk' || this.phase === 'gate') this.grabPointer();
  }

  nearTruck() {
    const [tx, tz] = this.trail.at(-1);
    const [nx, nz] = this.trail.normal(-1);
    return Math.hypot(this.p.x - (tx + nx * 4.5), this.p.z - (tz + nz * 4.5 + 5)) < 3.2;
  }

  /* ----------------------------------------------------------------- dread */
  // Prayer used to be a key that opened one door. It is pressure relief now:
  // in Record state the swamp closes on Ray continuously — the draw distance
  // tightens, the sway builds, the thing in the fog comes around more often —
  // and prayer is the only thing that pushes it back. The player should want it
  // before they are told it exists, so that the cost lands when it arrives.
  updateDread(dt) {
    if (this.phase !== 'walk') return;

    if (this.state !== 'record') {
      // Comfort is not just safe, it is restful. Nothing accumulates in the warm.
      this.dread = Math.max(0, this.dread - dt * 0.25);
      return;
    }

    if (this.calm > 0) {
      this.dread = Math.max(0, this.dread - dt * 0.5);
    } else {
      const rate = 0.014 + (this.loop - 1) * 0.007;
      this.dread = clamp(this.dread + dt * rate * (this.outbound ? 1 : 0.6), 0, 1);
    }

    // It circles closer as it builds, and it is never rendered.
    this.dreadTick -= dt;
    if (this.dreadTick <= 0 && this.dread > 0.25) {
      this.dreadTick = lerp(14, 3.5, this.dread) * (0.7 + Math.random() * 0.6);
      this.audio.disturbance(lerp(3, 0.8, this.dread));
    }

    if (this.dread > 0.72 && !this.seen.has('dread-told')) {
      this.seen.add('dread-told');
      this.ui.flashPrompt('Hold F — pray');
    }
  }

  // How much the walk itself resists him. Never a wall — he can always push on,
  // it just costs him the will to do it.
  get dreadDrag() {
    return 1 - 0.72 * clamp((this.dread - 0.55) / 0.45, 0, 1);
  }

  /* ---------------------------------------------------------------- prayer */
  updatePrayer(dt) {
    const holding = this.keys.has('f') && this.phase === 'walk' && !this.ui.readerOpen;
    if (holding) {
      this.prayHold = Math.min(1, this.prayHold + dt / 1.6);
      this.ui.setPrayer(this.prayHold);
      if (this.prayHold >= 1) { this.prayHold = 0; this.pray(); }
    } else if (this.prayHold > 0) {
      this.prayHold = Math.max(0, this.prayHold - dt / 0.5);
      this.ui.setPrayer(this.prayHold);
    }
  }

  pray() {
    this.prayers++;
    if (this.prayers === 1) this.say(LINES.prayFirst);

    if (this.state === 'legend') {
      // Comfort, and comfort is all it is. The breathing steadies. Nothing moves.
      this.calm = 6;
      this.say(LINES.prayWarm, 1.2);
      return;
    }

    // Record state: it works, and it takes something to do it.
    this.audio.quiet(6);
    this.calm = 12;
    this.dread = 0;
    this.presence.vis = 0;
    this.say(LINES.prayCold);

    if (this.memoriesLost < MEMORIES.length) {
      const i = this.memoriesLost++;
      const m = MEMORIES[i];
      // The soft version was seeded hours ago, out on the trail. If the player
      // somehow never heard it, show it now so the correction still has a target.
      let at = 2.2;
      if (!this.seeded.has(i)) { this.say([['', m.soft]], at); at += 4.2; }
      this.say(LINES.memoryLost, at);
      this.say([['', m.true]], at + 1.4);
      const slot = Math.min(i, 2);
      if (!this.shapeNoteUsed[slot] && (i === 0 || i === 3)) {
        this.shapeNoteUsed[slot] = true;
        this.after(at + 6, () => this.audio.shapeNote(slot));
      }
    }
  }

  // Establish the comfortable version of a memory, long before prayer takes it.
  seedMemory(i) {
    if (this.seeded.has(i) || i >= MEMORIES.length) return;
    this.seeded.add(i);
    this.say([['', MEMORIES[i].soft]], 1.5);
  }

  /* ------------------------------------------------------------- interiority */
  // The stops carry the history. The walk between them is where the grief goes,
  // and it was silent before this.
  updateIdle(dt) {
    if (this.phase !== 'walk' || this.ui.readerOpen) return;
    this.idleTimer -= dt;
    if (this.idleTimer > 0 || this.ui.current || this.ui.queue.length) return;

    const pools = ['any', this.state];
    if (this.loop === 2) pools.push('loop2');
    if (this.loop >= 3) pools.push('loop3');

    const options = [];
    for (const key of pools) {
      (IDLE[key] || []).forEach((line, i) => {
        const id = key + i;
        if (!this.idleUsed.has(id)) options.push([id, line]);
      });
    }
    if (!options.length) { this.idleTimer = 999; return; }

    const [id, line] = options[(Math.random() * options.length) | 0];
    this.idleUsed.add(id);
    this.say([line]);
    this.idleTimer = 38 + Math.random() * 30;
  }

  /* ------------------------------------------------------------- movement */
  updateWalk(dt) {
    const k = this.keys;
    let fwd = 0, strafe = 0;
    if (k.has('w') || k.has('arrowup')) fwd += 1;
    if (k.has('s') || k.has('arrowdown')) fwd -= 1;
    if (k.has('d') || k.has('arrowright')) strafe += 1;
    if (k.has('a') || k.has('arrowleft')) strafe -= 1;

    const moving = (fwd || strafe) && !this.ui.readerOpen;
    if (moving) {
      const len = Math.hypot(fwd, strafe) || 1;
      fwd /= len; strafe /= len;
      const fx = -Math.sin(this.p.yaw), fz = -Math.cos(this.p.yaw);
      const rx = Math.cos(this.p.yaw), rz = -Math.sin(this.p.yaw);
      const speed = WALK * (this.loop >= 3 ? 0.92 : 1) * this.dreadDrag;
      let nx = this.p.x + (fx * fwd + rx * strafe) * speed * dt;
      let nz = this.p.z + (fz * fwd + rz * strafe) * speed * dt;

      // The corridor: swamp on both sides, and no invitation onto the water.
      // The corridor: swamp on both sides, and no invitation onto the water.
      // The last half-metre is soft — he wades, slows, and gives up on his own
      // rather than striking an invisible pane of glass.
      const pr = this.trail.project(nx, nz);
      const onDeck = pr.s < this.trail.fromMiles(0.16);
      const halfWidth = onDeck ? 1.05 : 3.4;
      const soft = onDeck ? 0.25 : 0.6;
      const over = Math.abs(pr.lat) - halfWidth;
      if (over > 0) {
        const [px, pz] = this.trail.at(pr.s);
        const [tnx, tnz] = this.trail.normal(pr.s);
        const eased = halfWidth + soft * (1 - Math.exp(-over / soft));
        const lat = Math.sign(pr.lat) * Math.min(Math.abs(pr.lat), eased);
        nx = px + tnx * lat; nz = pz + tnz * lat;
      }

      const s = clamp(this.trail.project(nx, nz).s, -8, this.trail.length);
      if (s > -8) { this.p.x = nx; this.p.z = nz; }

      this.bobPhase += dt * 7.5;
      this.stepAccum += dt * speed;
      if (this.stepAccum > 1.15) {
        this.stepAccum = 0;
        this.audio.step(this.trail.project(this.p.x, this.p.z).s < this.trail.fromMiles(0.16));
      }
    }
    this.checkStops();
  }

  /* ------------------------------------------------------ trail milestones */
  checkStops() {
    const pr = this.trail.project(this.p.x, this.p.z);
    const mile = this.trail.toMiles(pr.s);
    this.mile = mile;
    this.maxMile = Math.max(this.maxMile, mile);

    const once = (key, fn) => { if (!this.seen.has(key)) { this.seen.add(key); fn(); } };

    // The four comfortable versions are laid down here, across the whole walk,
    // so that prayer has something of his to take later.
    if (mile > 0.04) once('seed0', () => this.seedMemory(0));
    if (mile > 0.13) once('seed1', () => this.seedMemory(1));
    if (mile > 0.33) once('seed2', () => this.seedMemory(2));
    if (mile > 0.45) once('seed3', () => this.seedMemory(3));

    if (mile > 0.09) once('boardwalk' + this.loop, () => {
      if (this.loop === 1) this.say(LINES.boardwalk);
      if (this.loop === 2) this.say(LINES.loop2);
    });
    if (mile > 0.19 && this.state === 'record') once('fork', () => this.say(LINES.fork));
    if (mile > 0.29) once('grove' + this.loop, () => { if (this.loop === 1) this.say(LINES.grove); });
    if (mile > 0.31) once('grave2', () => this.say(LINES.grave2, 2.0));
    if (mile > 0.39 && this.state === 'record') once('field', () => {
      this.say(LINES.field);
      if (!this.shapeNoteUsed[1]) { this.shapeNoteUsed[1] = true; this.after(9, () => this.audio.shapeNote(1)); }
    });

    if (mile > 0.478) {
      once('bridge' + this.loop, () => this.say(LINES.bridge));
      if (!this.reachedBridge) {
        this.reachedBridge = true;
        this.outbound = false;
        this.say(LINES.turnaround, 5.5);
      }
    }

    // Back at the gate with the bridge behind him: the trail loops.
    if (this.reachedBridge && pr.s < 4) {
      if (this.loop < 3) {
        this.loop++;
        this.reachedBridge = false;
        this.outbound = true;
        this.seen.delete('bridge' + this.loop);
        if (this.loop === 3) {
          // Loop three strips the wildlife entirely. Removing sound is the scare.
          this.audio.wildlife = 0;
          this.audio.stinger();
          this.say(LINES.loop3);
        }
      }
    }
  }

  /* -------------------------------------------------------------- endings */
  canRegister() {
    return this.reachedBridge && this.ledger >= 3 && this.state === 'record';
  }

  canRefuse() {
    return this.loop >= 3 && this.reachedBridge;
  }

  updateEndingHolds(dt) {
    if (this.phase !== 'walk' || this.ui.readerOpen) { this.readHold = this.stayHold = 0; return; }
    const atBridge = this.mile > 0.47;

    if (atBridge && this.canRegister() && this.keys.has('e')) {
      this.readHold += dt;
      if (this.readHold > 1.4) this.end('register');
    } else this.readHold = 0;

    if (atBridge && this.canRefuse() && this.keys.has('x')) {
      this.stayHold += dt;
      if (this.stayHold > 1.8) { this.say(LINES.refuse); this.end('refusal'); }
    } else this.stayHold = 0;
  }

  end(which) {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    document.exitPointerLock();
    this.ui.setHud(false);
    this.ui.clearLines();

    if (which === 'refusal') {
      // The camera lets go of him and pulls back to the trailhead.
      this.cine = { t: 0, from: this.trail.project(this.p.x, this.p.z).s, dur: 7 };
    }
    if (which === 'register' && !this.shapeNoteUsed[2]) {
      this.shapeNoteUsed[2] = true;
      this.audio.wildlife = 0;
      setTimeout(() => this.audio.shapeNote(2), 1500);
    }
    if (which === 'owl') this.audio.wildlife = 1;
    this.ui.recordFound(which);

    const delay = which === 'refusal' ? 7200 : 2600;
    this.fadeTarget = 0;
    setTimeout(() => {
      this.audio.tapeHiss(which === 'owl');
      if (which === 'owl') setTimeout(() => this.audio.laugh(2), 3200);
      this.ui.showEnding(ENDINGS[which], CREDITS);
    }, delay);
  }

  /* ------------------------------------------------------- the cold open */
  updateGate(dt) {
    this.gateTimer -= dt;
    if (this.gateTimer > 0) return;
    switch (this.gateStage) {
      case 0:
        this.say(LINES.gate1);
        this.gateTimer = 7;
        break;
      case 1:
        this.audio.laugh(0);              // 70/30 owl. Genuinely ambiguous.
        this.gateTimer = 3.2;
        break;
      case 2:
        this.say(LINES.laugh1);           // "Barred owl." No choice is offered,
        this.gateTimer = 7;               // because at 2 a.m. nobody is given one.
        break;
      case 3:
        this.audio.laugh(1);              // Then it happens again.
        this.ui.titleCard();
        this.say(LINES.laugh2, 2.4);
        this.gateTimer = 6;
        break;
      case 4:
        this.phase = 'walk';
        break;
    }
    this.gateStage++;
  }

  /* --------------------------------------------------------------- presence */
  updatePresence(dt) {
    const p = this.presence;
    // Hard rule: she exists only at the draw-distance boundary, as silhouette,
    // and only while Ray believes the version with a bride in it.
    if (this.state !== 'legend' || this.phase !== 'walk') {
      p.vis = Math.max(0, p.vis - dt * 1.5);
      p.active = false;
      return;
    }
    p.timer -= dt;
    if (p.timer <= 0) {
      p.timer = 14 + Math.random() * 22;
      p.active = !p.active;
      if (p.active) {
        // She is never the same way round twice. Nothing tweens.
        p.pose = (p.pose + 1 + ((Math.random() * 2) | 0)) % 3;
        if (!this.seen.has('presence')) { this.seen.add('presence'); this.say(LINES.presence, 2); }
        this.audio.disturbance(2.5);
      }
    }
    p.vis = clamp(p.vis + (p.active ? dt * 0.7 : -dt * 1.1), 0, 1);

    const pr = this.trail.project(this.p.x, this.p.z);
    const ahead = clamp(pr.s + this.drawDistance * 0.95, 0, this.trail.length);
    const [x, z] = this.trail.at(ahead);
    const [nx, nz] = this.trail.normal(ahead);
    const off = Math.sin(ahead * 0.3) * 2.4;    // at the treeline, never on the path
    p.x = x + nx * off; p.z = z + nz * off;
  }

  /* ------------------------------------------------------------- recorder */
  toggleRecorder() {
    if (this.phase !== 'walk' && this.phase !== 'gate') return;
    this.recorderOpen = !this.recorderOpen;
    this.audio.tapeHiss(this.recorderOpen);
    if (!this.recorderOpen) { this.ui.setRecorder(null); return; }

    const finalAct = this.loop >= 3;
    const lines = finalAct ? [
      'FILE 001 — 2:00:00 — the gravel lot.',
      'Before the trail. Before anything happened.',
      '"Recorder\'s on. It\'s two in the morning…"',
      'And underneath him, quiet, on the very first file: the laugh.',
      'It was always on it.',
    ] : [
      `FILE ${String(this.loop).padStart(3, '0')} — 2:00:00 — Bellamy Bridge trail.`,
      `${this.artifacts.filter(a => a.read).length} of ${this.artifacts.length} things read.`,
      this.ledger >= 3 ? 'Ledger: all three leaves. The names are on the tape.'
                       : `Ledger: ${this.ledger} of 3 leaves.`,
      this.memoriesLost ? `Memories corrected: ${this.memoriesLost} of 4.` : 'Nothing has been taken yet.',
    ];
    if (finalAct) setTimeout(() => this.audio.laugh(2), 4200);
    this.ui.setRecorder(lines);
  }

  /* ------------------------------------------------------------------ loop */
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.paused) { this.render(now); requestAnimationFrame(this.frame); return; }

    if (this.phase === 'gate') this.updateGate(dt);
    if (this.phase === 'gate' || this.phase === 'walk') {
      if (!this.ui.readerOpen) this.updateWalk(dt);
      this.updateDread(dt);
      this.updateIdle(dt);
      this.updatePrayer(dt);
      this.updateEndingHolds(dt);
      this.updatePresence(dt);
      this.updateHud();
    }

    // The light eases between the two states; it is the only HUD in the game.
    const target = this.state === 'legend' ? 1 : 0;
    this.lightMix = lerp(this.lightMix, target, 1 - Math.pow(0.02, dt));
    if (this.calm > 0) this.calm -= dt;

    // The comfortable version is the trap, so comfort is also the resting state:
    // conviction in the record decays toward the boundary whenever Ray is not
    // looking at evidence. It stops at -0.05 and never flips the light for him —
    // holding the cold is effort, but the swing is always the player's to make.
    if (this.phase === 'walk' && this.belief < -0.05 && !this.ui.readerOpen) {
      this.belief = Math.min(-0.05, this.belief + dt * 0.010);
    }

    // The field is audible before it is visible and stays audible behind him.
    // It only exists in Record state, and it never approaches.
    const inField = this.state === 'record' && this.phase === 'walk' &&
                    this.mile > 0.34 && this.mile < 0.47;
    this.audio.work = inField
      ? clamp(1 - Math.abs(this.mile - 0.405) / 0.065, 0, 1)
      : 0;

    this.flicker = 0.88 + Math.sin(now * 0.011) * 0.04 + Math.random() * 0.08;
    this.fade = lerp(this.fade, this.fadeTarget ?? 1, 1 - Math.pow(0.15, dt));

    this.updateTimers(dt);
    this.audio.update(dt);
    this.ui.update(dt);
    this.render(now);
    requestAnimationFrame(this.frame);
  }

  updateHud() {
    // Distance markers are the trail's own signage. Their unreliability is the point.
    const stretch = 1 + (this.loop - 1) * 0.2 + (this.outbound ? 0 : 0.25);
    const shown = clamp(this.mile / stretch, 0, 0.5);
    this.ui.setMile(shown.toFixed(2) + ' mi');

    if (this.ui.readerOpen) { this.ui.setPrompt(null); return; }
    if (this.phase === 'ending') { this.ui.setPrompt(null); return; }

    if (this.mile > 0.47 && this.canRegister()) {
      this.ui.setPrompt('Hold E — read the names into the recorder');
    } else if (this.mile > 0.47 && this.canRefuse()) {
      this.ui.setPrompt('Hold X — stay');
    } else if (this.nearTruck() && (this.gateStage >= 4 || this.reachedBridge || this.loop > 1)) {
      this.ui.setPrompt('E — get in the truck');
    } else {
      const a = this.nearestArtifact();
      this.ui.setPrompt(a ? `E — read ${a.label}` : null);
    }
  }

  render(now) {
    const legend = this.lightMix;
    const fogFar = this.drawDistance;
    const sway = (this.calm > 0 ? 0.25 : 1) * (1 + this.dread * 1.6);
    const bob = Math.sin(this.bobPhase) * 0.035 * sway;
    const roll = Math.sin(this.bobPhase * 0.5) * 0.006 * sway;
    const breathe = Math.sin(now * 0.0016) * 0.012 * sway;

    let cx = this.p.x, cz = this.p.z, cy = EYE + bob + breathe;
    let yaw = this.p.yaw, pitch = this.p.pitch;

    const onDeck = this.trail.project(cx, cz).s < this.trail.fromMiles(0.16);
    if (onDeck) cy += 0.3;

    // Ending 03: the camera detaches from Ray and pulls back to the trailhead.
    if (this.cine) {
      this.cine.t += 1 / 60;
      const k = clamp(this.cine.t / this.cine.dur, 0, 1);
      const s = lerp(this.cine.from, 2, k * k);
      const [x, z] = this.trail.at(s);
      cx = x; cz = z; cy = 1.9 + k * 2.2;
      const [tx, tz] = this.trail.tangent(s);
      yaw = Math.atan2(-tx, -tz);
      pitch = -0.12;
    }

    const cam = {
      view: M4.view(cx, cy, cz, yaw, pitch, roll),
      fov: 1.15,
      snap: 1,
      fogCol: [
        lerp(FOG_RECORD[0], FOG_LEGEND[0], legend),
        lerp(FOG_RECORD[1], FOG_LEGEND[1], legend),
        lerp(FOG_RECORD[2], FOG_LEGEND[2], legend),
      ],
      fogNear: fogFar * 0.28,
      fogFar,
      lightCol: [
        lerp(LIGHT_RECORD[0], LIGHT_LEGEND[0], legend),
        lerp(LIGHT_RECORD[1], LIGHT_LEGEND[1], legend),
        lerp(LIGHT_RECORD[2], LIGHT_LEGEND[2], legend),
      ],
      lightRange: lerp(13, 18, legend),
      lightInner: lerp(0.92, 0.86, legend),
      lightOuter: lerp(0.55, 0.42, legend),
      lightGain: lerp(3.4, 3.0, legend),
      ambient: [
        lerp(0.16, 0.15, legend),
        lerp(0.18, 0.155, legend),
        lerp(0.21, 0.135, legend),
      ],
      flicker: this.flicker,
    };

    const R = this.renderer;
    R.beginFrame(cam);

    const isRecord = this.state === 'record';
    for (const bch of this.batches) {
      if (bch.tag === 'record' && !isRecord) continue;
      if (bch.tag === 'legend' && isRecord) continue;
      if (bch.tag === 'loop3' && this.loop < 3) continue;
      const tex = this.tex[bch.tex] || this.tex.mud;
      const foliage = bch.tex === 'palmetto' || bch.tex === 'canopy' || bch.tex === 'moss';
      R.draw(bch.handle, tex, {
        doubleSided: foliage || bch.tex === 'water',
        scroll: bch.tex === 'water' ? (now * 0.00002) : 0,
      });
    }

    // The one figure in the game. If the player runs at her, the fog resolves to
    // empty trail, because she is always exactly at the boundary and never inside it.
    if (this.presence.vis > 0.02) {
      const p = this.presence;
      const yawTo = Math.atan2(cx - p.x, cz - p.z);
      const poseTex = [this.tex.figure, this.tex.figureB, this.tex.figureC][p.pose];
      R.draw(this.figureQuad, poseTex, {
        model: modelAt(p.x, 0, p.z, yawTo, 1 + p.vis * 0.02),
        alphaCut: 1 - p.vis * 0.9,
        doubleSided: true,
        unlit: true,
      });
    }

    if (this.cine) {
      // A distant light moving in the trees. It does not get closer.
      const s = clamp(this.cine.from + 6, 0, this.trail.length);
      const [lx, lz] = this.trail.at(s);
      const [nx, nz] = this.trail.normal(s);
      const wob = Math.sin(this.cine.t * 1.6) * 2.2;
      R.draw(this.lampQuad, this.tex.lamp, {
        model: modelAt(lx + nx * (5 + wob), 1.2, lz + nz * 5, Math.atan2(cx - lx, cz - lz)),
        alphaCut: 0.2,
        doubleSided: true,
        unlit: true,
      });
    }

    R.endFrame(0.55, this.fade);
  }

  setInternalRes(hi) {
    this.renderer.setInternalRes(hi ? RES.hi : RES.lo);
  }
}
