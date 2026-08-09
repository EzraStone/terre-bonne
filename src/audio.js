// Terre Bonne — audio.
//
// The document calls this the most important department, so none of it is
// silence-with-a-TODO. Everything here is synthesised at runtime: the swamp bed,
// the barred owl's "who cooks for you", the laugh (owl and a young woman, mixed
// at a ratio that shifts across the three occurrences), three moments of
// unaccompanied shape-note singing, and the recorder, which is band-passed and
// diegetic because the player should have to hold still and listen.
//
// A real build field-records the Chipola at night. This one is a solo project
// with no microphone, so the structure is here and the recordings drop in later.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function noiseBuffer(ctx, seconds = 2) {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class Audio {
  constructor() {
    this.ready = false;
    this.wildlife = 1;     // loop three takes this to zero. Removing sound is the scare.
    this.laughCount = 0;
  }

  start() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.ready = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // --- the bed -----------------------------------------------------------
    this.bed = ctx.createGain();
    this.bed.gain.value = 1;
    this.bed.connect(this.master);

    this.noise = noiseBuffer(ctx, 3);

    // cicadas: narrow band of noise, breathing
    const cic = ctx.createBufferSource();
    cic.buffer = this.noise; cic.loop = true;
    const cicBP = ctx.createBiquadFilter();
    cicBP.type = 'bandpass'; cicBP.frequency.value = 4200; cicBP.Q.value = 7;
    const cicGain = ctx.createGain(); cicGain.gain.value = 0.05;
    const cicLFO = ctx.createOscillator(); cicLFO.frequency.value = 0.13;
    const cicLFOg = ctx.createGain(); cicLFOg.gain.value = 0.028;
    cicLFO.connect(cicLFOg).connect(cicGain.gain);
    cic.connect(cicBP).connect(cicGain).connect(this.bed);
    cic.start(); cicLFO.start();

    // water: low rumble under everything, the river doing what it does
    const wat = ctx.createBufferSource();
    wat.buffer = this.noise; wat.loop = true;
    const watLP = ctx.createBiquadFilter();
    watLP.type = 'lowpass'; watLP.frequency.value = 190;
    const watGain = ctx.createGain(); watGain.gain.value = 0.10;
    wat.connect(watLP).connect(watGain).connect(this.master);   // water survives loop three
    wat.start();
    this.waterGain = watGain;

    this.cicGain = cicGain;

    // --- the layer underneath ----------------------------------------------
    // 0.40, Record state only: a working landscape at night with the sound of it
    // still going. Hoes into dirt, a cart axle, and people humming at a distance
    // because that is what working at night sounds like. It is deliberately not
    // frightening and it never comes closer — there is no chase here and no
    // figure to see. The horror at this stop is that it is ordinary.
    this.workGain = ctx.createGain();
    this.workGain.gain.value = 0;
    this.workGain.connect(this.master);

    const humMix = ctx.createGain();
    humMix.gain.value = 0.055;
    humMix.connect(this.workGain);
    for (const f of [146.8, 220.0]) {            // open fifth, no third, no verdict
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.07 + Math.random() * 0.05;
      const swellG = ctx.createGain(); swellG.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.5;
      swell.connect(swellG).connect(g.gain);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 520;
      o.connect(g).connect(lp).connect(humMix);
      o.start(); swell.start();
    }

    this.work = 0;
    this.workTimer = 0;

    // cricket frogs fire as one-shots on a loose timer
    this.frogTimer = 0;
    this.owlTimer = 18 + Math.random() * 20;
  }

  // A tool going into ground, heard from across a field.
  workStrike() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 300 + Math.random() * 200; bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;      // distance takes the top off
    let tail = lp;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      lp.connect(pan); tail = pan;
    }
    src.connect(bp).connect(g).connect(lp);
    tail.connect(this.workGain);
    src.start(t); src.stop(t + 0.3);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  update(dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    // Loop three has no bed at all — not a quieter one. The river goes too.
    // What is left is Ray's own boots, and that is the whole scare.
    this.cicGain.gain.setTargetAtTime(0.05 * this.wildlife, t, 1.5);
    this.waterGain.gain.setTargetAtTime(0.10 * this.wildlife, t, 2.5);
    if (this.workGain) {
      this.workGain.gain.setTargetAtTime(0.9 * this.work, t, 2.0);
    }

    if (this.wildlife > 0.05) {
      this.frogTimer -= dt;
      if (this.frogTimer <= 0) {
        this.frogTimer = 0.25 + Math.random() * 1.6;
        this.frog();
      }
      this.owlTimer -= dt;
      if (this.owlTimer <= 0) {
        this.owlTimer = 25 + Math.random() * 35;
        this.owl(0.16);
      }
    }

    if (this.work > 0.05) {
      this.workTimer -= dt;
      if (this.workTimer <= 0) {
        this.workTimer = 0.55 + Math.random() * 0.5;   // a loose, unhurried rhythm
        this.workStrike();
      }
    }
  }

  // cricket frog: a dry click, like a thumbnail on a comb
  frog() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 2600 + Math.random() * 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035 * this.wildlife, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 2 - 1; o.connect(g).connect(pan).connect(this.bed); }
    else o.connect(g).connect(this.bed);
    o.start(t); o.stop(t + 0.08);
  }

  // Barred owl: "who cooks for you, who cooks for you-ALL". The real call
  // genuinely cackles like a person, which is the entire reason the in-fiction
  // denial is plausible.
  owl(gain = 0.2, when = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const notes = [
      [0, 0.20, 620, 560], [0.26, 0.16, 700, 640], [0.50, 0.20, 610, 545],
      [0.95, 0.20, 640, 590], [1.21, 0.16, 720, 660], [1.45, 0.42, 600, 380],
    ];
    for (const [off, dur, f0, f1] of notes) {
      const t = t0 + off;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
      const vib = ctx.createOscillator(); vib.frequency.value = 22;
      const vibG = ctx.createGain(); vibG.gain.value = 14;
      vib.connect(vibG).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.connect(g).connect(lp).connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
      vib.start(t); vib.stop(t + dur + 0.05);
    }
    return 1.9;
  }

  // A young woman laughing. Each "ha" is a voiced source passed through the
  // resonances of an open vowel, with an aspirated onset. The little timing and
  // pitch differences keep it human without turning it into speech.
  woman(gain = 0.2, when = 0) {
    if (!this.ready) return 0;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const syllables = [
      // offset, duration, pitch, end-pitch ratio, strength
      [0.00, 0.13, 330, 1.10, 0.72],
      [0.16, 0.14, 365, 1.04, 0.90],
      [0.34, 0.15, 390, 0.94, 1.00],
      [0.54, 0.16, 370, 0.88, 0.92],
      [0.76, 0.18, 340, 0.82, 0.78],
      [1.01, 0.24, 305, 0.76, 0.58],
    ];

    for (const [off, dur, pitch, fall, strength] of syllables) {
      const t = t0 + off + (Math.random() - 0.5) * 0.008;
      const f0 = pitch * (1 + (Math.random() - 0.5) * 0.035);

      // A saw carries enough harmonics for the formants to shape into a vowel.
      const voice = ctx.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(f0 * 0.96, t);
      voice.frequency.exponentialRampToValueAtTime(f0, t + dur * 0.22);
      voice.frequency.exponentialRampToValueAtTime(f0 * fall, t + dur);

      const flutter = ctx.createOscillator();
      flutter.frequency.value = 5.4 + Math.random() * 0.8;
      const flutterDepth = ctx.createGain();
      flutterDepth.gain.value = 4 + Math.random() * 2;
      flutter.connect(flutterDepth).connect(voice.frequency);

      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, t);
      envelope.gain.exponentialRampToValueAtTime(gain * strength, t + 0.025);
      envelope.gain.setValueAtTime(gain * strength * 0.82, t + dur * 0.55);
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      voice.connect(envelope);

      // Female /a/ formants. Parallel filters make the source read as one mouth,
      // rather than several unrelated tones.
      for (const [frequency, q, level] of [
        [850, 5.0, 0.72], [1500, 6.5, 0.42], [2850, 9.0, 0.18],
      ]) {
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = frequency * (1 + (Math.random() - 0.5) * 0.025);
        formant.Q.value = q;
        const formantGain = ctx.createGain();
        formantGain.gain.value = level;
        envelope.connect(formant).connect(formantGain).connect(this.master);
      }

      voice.start(t); voice.stop(t + dur + 0.03);
      flutter.start(t); flutter.stop(t + dur + 0.03);

      // A short, high breath before the voice supplies the "h" in each "ha".
      const br = ctx.createBufferSource(); br.buffer = this.noise;
      const brBP = ctx.createBiquadFilter(); brBP.type = 'bandpass';
      brBP.frequency.value = 2400; brBP.Q.value = 1.0;
      const brG = ctx.createGain();
      brG.gain.setValueAtTime(0.0001, t);
      brG.gain.exponentialRampToValueAtTime(gain * strength * 0.16, t + 0.012);
      brG.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.075, dur * 0.5));
      br.connect(brBP).connect(brG).connect(this.master);
      br.start(t); br.stop(t + dur);
    }
    return 1.3;
  }

  // THE LAUGH. Occurrence 1 is 70/30 owl. By the third it is 10/90, and close.
  // It is never resolved in dialogue.
  laugh(index = null) {
    if (!this.ready) return 2;
    const n = index === null ? this.laughCount++ : index;
    const mixes = [0.70, 0.40, 0.10];                 // owl share
    const owlShare = mixes[Math.min(n, mixes.length - 1)];
    const near = 0.10 + (1 - owlShare) * 0.30;        // and it gets closer
    this.owl(0.22 * owlShare + 0.04, 0);
    this.woman(near * (1 - owlShare) + 0.03, 0.18);
    return 2.2;
  }

  // Unaccompanied shape-note singing. Loud, modal, strange to modern ears, and
  // one voice is what a solo project can afford. Used exactly three times.
  shapeNote(which = 0) {
    if (!this.ready) return 0;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.2;
    // minor-ish modal line, no leading tone — that is what makes it sound old
    const lines = [
      [0, 3, 5, 7, 5, 3, 0],
      [7, 5, 7, 10, 12, 10, 7],
      [0, 0, -2, 0, 3, 2, 0, -5],
    ];
    const line = lines[which % lines.length];
    const root = 196; // G3
    let t = t0;
    for (let i = 0; i < line.length; i++) {
      const dur = i === line.length - 1 ? 2.6 : 0.85;
      const f = root * Math.pow(2, line[i] / 12);
      for (const [mult, amp] of [[1, 1], [2, 0.34], [3, 0.16], [5, 0.06]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * mult * (1 + (Math.random() - 0.5) * 0.006);
        const vib = ctx.createOscillator(); vib.frequency.value = 4.6;
        const vibG = ctx.createGain(); vibG.gain.value = f * mult * 0.012;
        vib.connect(vibG).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.10 * amp, t + 0.14);
        g.gain.setValueAtTime(0.10 * amp, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
        o.connect(g).connect(bp).connect(this.master);
        o.start(t); o.stop(t + dur + 0.1);
        vib.start(t); vib.stop(t + dur + 0.1);
      }
      t += dur;
    }
    return t - t0;
  }

  // Recorder playback: band-passed, hiss, always sounding like it is coming out
  // of a small speaker in a man's hand rather than out of the mix.
  tapeHiss(on) {
    if (!this.ready) return;
    if (on && !this.hiss) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1800; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0.05;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.hiss = { src, g };
      this.bed.gain.setTargetAtTime(0.25, ctx.currentTime, 0.3);
    } else if (!on && this.hiss) {
      this.hiss.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
      const h = this.hiss; this.hiss = null;
      setTimeout(() => { try { h.src.stop(); } catch (e) { /* already gone */ } }, 500);
      this.bed.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
    }
  }

  // The two marked loud moments, and nothing else in the game is allowed to be one.
  stinger() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(140, t + 0.9);
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 1.5);
  }

  // Footfall on boardwalk plank or in mud, depending on where he is standing.
  step(onWood) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = onWood ? 'bandpass' : 'lowpass';
    f.frequency.value = onWood ? 220 + Math.random() * 90 : 420;
    f.Q.value = onWood ? 2.2 : 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(onWood ? 0.12 : 0.07, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (onWood ? 0.16 : 0.11));
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }

  // Prayer in Record state: something in the fog stops moving.
  quiet(seconds = 6) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.bed.gain.setTargetAtTime(0.12, t, 0.4);
    this.bed.gain.setTargetAtTime(1, t + seconds, 1.2);
  }

  // Something out past the draw distance moves through water. Never rendered.
  disturbance(dist = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 500 + 900 / dist;
    const g = ctx.createGain();
    const peak = clamp(0.09 / dist, 0.01, 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 1.6);
  }
}
