// Terre Bonne — the text layer.
// The 3D frame is 240p and unreadable on purpose. The words are not: an
// unreadable document would be a different game than the one in the design doc.

export class UI {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);

    this.title = this.$('title');
    this.cw = this.$('cw');
    this.reader = this.$('reader');
    this.endingPanel = this.$('ending');
    this.hud = this.$('hud');
    this.prompt = this.$('prompt');
    this.subtitle = this.$('subtitle');
    this.prayerbar = this.$('prayerbar');
    this.recorder = this.$('recorder');
    this.fadeout = this.$('fadeout');

    this.readerOpen = false;
    this.queue = [];
    this.current = null;
    this.holdFor = 0;
    this.promptText = null;
    this.flash = 0;

    this.$('btn-start').onclick = () => game.begin();
    this.$('btn-again').onclick = () => game.quitToTitle();
    this.$('btn-cw').onclick = () => { this.title.classList.remove('show'); this.cw.classList.add('show'); };
    this.$('btn-cw-back').onclick = () => { this.cw.classList.remove('show'); this.title.classList.add('show'); };

    this.hiRes = false;
    this.$('btn-res').onclick = () => {
      this.hiRes = !this.hiRes;
      game.setInternalRes(this.hiRes);
      this.$('btn-res').textContent = this.hiRes
        ? 'Internal res: 640 × 480'
        : 'Internal res: 320 × 240';
    };

    this.pause = this.$('pause');
    this.opts = this.$('opts');
    this.optsFrom = 'title';

    this.$('btn-resume').onclick = () => game.setPaused(false);
    this.$('btn-quit').onclick = () => game.quitToTitle();
    this.$('btn-opts').onclick = () => this.openOptions('title');
    this.$('btn-pause-opts').onclick = () => this.openOptions('pause');
    this.$('btn-opts-back').onclick = () => this.closeOptions();

    this.loadSettings();
    this.bindSettings();
    this.renderFound();
  }

  /* -------------------------------------------------------------- settings */
  loadSettings() {
    const def = { sens: 1, invert: false, subs: 1, vol: 0.9 };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('terrebonne.settings') || '{}'); }
    catch (e) { saved = {}; }                    // corrupt storage is not fatal
    this.settings = { ...def, ...saved };
    this.applySettings();
  }

  saveSettings() {
    try { localStorage.setItem('terrebonne.settings', JSON.stringify(this.settings)); }
    catch (e) { /* private browsing; the game still runs, it just forgets */ }
  }

  applySettings() {
    const s = this.settings;
    this.subtitle.style.fontSize = (17 * s.subs).toFixed(1) + 'px';
    if (this.game.audio && this.game.audio.master) {
      this.game.audio.master.gain.value = s.vol;
    }
    this.$('opt-sens').value = s.sens;
    this.$('opt-invert').checked = s.invert;
    this.$('opt-subs').value = s.subs;
    this.$('opt-vol').value = s.vol;
    this.$('opt-sens-val').textContent = Number(s.sens).toFixed(2);
    this.$('opt-subs-val').textContent = Number(s.subs).toFixed(2);
    this.$('opt-vol-val').textContent = Number(s.vol).toFixed(2);
  }

  bindSettings() {
    const on = (id, key, cast) => {
      this.$(id).addEventListener('input', (e) => {
        this.settings[key] = cast(e.target);
        this.applySettings();
        this.saveSettings();
      });
    };
    on('opt-sens', 'sens', (t) => parseFloat(t.value));
    on('opt-subs', 'subs', (t) => parseFloat(t.value));
    on('opt-vol', 'vol', (t) => parseFloat(t.value));
    on('opt-invert', 'invert', (t) => t.checked);
  }

  openOptions(from) {
    this.optsFrom = from;
    this.title.classList.remove('show');
    this.pause.classList.remove('show');
    this.opts.classList.add('show');
  }

  closeOptions() {
    this.opts.classList.remove('show');
    if (this.optsFrom === 'pause') this.pause.classList.add('show');
    else this.title.classList.add('show');
  }

  setPausePanel(on) {
    this.pause.classList.toggle('show', on);
    if (!on) this.opts.classList.remove('show');
  }

  /* -------------------------------------------------- endings found so far */
  static ENDING_ORDER = [
    ['owl', 'Barred Owl'],
    ['register', 'The Register'],
    ['refusal', 'Always and Forever'],
    ['zero', '0.00'],
  ];

  loadFound() {
    try { return new Set(JSON.parse(localStorage.getItem('terrebonne.endings') || '[]')); }
    catch (e) { return new Set(); }
  }

  recordFound(which) {
    const found = this.loadFound();
    found.add(which);
    try { localStorage.setItem('terrebonne.endings', JSON.stringify([...found])); }
    catch (e) { /* nothing to do; the walk still happened */ }
    this.renderFound();
  }

  // Four endings and a 25-minute walk each: the title screen has to remember,
  // or nobody sees more than one of them.
  renderFound() {
    const found = this.loadFound();
    const el = this.$('found');
    if (!found.size) { el.innerHTML = ''; return; }
    const rows = UI.ENDING_ORDER.map(([key, name], i) => {
      const n = String(i + 1).padStart(2, '0');
      return found.has(key)
        ? `<p class="got">${n} · <b>${name}</b></p>`
        : `<p>${n} · ————</p>`;
    }).join('');
    el.innerHTML = `<p class="hd">Ways off the trail — ${found.size} of 4</p>${rows}`;
  }

  hidePanels() {
    this.title.classList.remove('show');
    this.cw.classList.remove('show');
    this.endingPanel.classList.remove('show');
    this.pause.classList.remove('show');
    this.opts.classList.remove('show');
  }

  showTitle() {
    this.hidePanels();
    this.renderFound();
    this.title.classList.add('show');
  }

  setHud(on) { this.hud.classList.toggle('show', on); }
  setMile(t) { this.$('mile').textContent = t; }

  setPrompt(text) {
    if (this.flash > 0) return;
    if (text === this.promptText) return;
    this.promptText = text;
    this.prompt.textContent = text || '';
    this.prompt.classList.toggle('show', !!text);
  }

  // Used when the game needs to insist — the thing in the fog, mostly.
  flashPrompt(text) {
    this.flash = 3;
    this.promptText = text;
    this.prompt.textContent = text;
    this.prompt.classList.add('show');
  }

  setPrayer(v) {
    this.prayerbar.classList.toggle('show', v > 0.01);
    this.prayerbar.firstElementChild.style.width = (v * 100) + '%';
  }

  /* ------------------------------------------------------------ subtitles */
  queueLines(lines, delay = 0) {
    let at = delay;
    for (const [who, text] of lines) {
      this.queue.push({ who, text, at, dur: Math.max(2.2, text.length * 0.055) });
      at += Math.max(2.2, text.length * 0.055) + 0.35;
    }
  }

  clearLines() {
    this.queue.length = 0;
    this.current = null;
    this.subtitle.classList.remove('show');
  }

  update(dt) {
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) { this.promptText = null; this.prompt.classList.remove('show'); }
    }

    for (const q of this.queue) q.at -= dt;

    if (this.current) {
      this.current.dur -= dt;
      if (this.current.dur <= 0) {
        this.current = null;
        this.subtitle.classList.remove('show');
      }
      return;
    }
    const next = this.queue.find(q => q.at <= 0);
    if (next) {
      this.queue.splice(this.queue.indexOf(next), 1);
      this.current = next;
      this.subtitle.innerHTML = (next.who ? `<span class="who">${next.who}</span>` : '') +
        this.escape(next.text);
      this.subtitle.classList.add('show');
    }
  }

  escape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  /* --------------------------------------------------------------- reader */
  openReader(a, loop) {
    this.readerOpen = true;
    const warm = a.kind === 'plaque';
    const kind = this.$('reader-kind');
    kind.textContent = warm ? 'What the sign says' : 'What the record says';
    kind.className = warm ? 'eyebrow myth' : 'eyebrow rec';
    this.reader.className = 'panel reader show ' + (warm ? 'myth' : 'rec');
    this.$('reader-title').textContent = a.title;

    const body = (loop >= 3 && a.loop3) ? a.loop3 : a.body;
    const html = body.map(([cls, text]) =>
      `<p class="${cls || 'doc'}">${this.escape(text)}</p>`).join('');
    const note = a.note
      ? `<p class="credit" style="font-family:var(--mono);font-size:11px;letter-spacing:.12em;
           text-transform:uppercase;color:var(--moss);margin-top:2rem">${this.escape(a.note)}</p>`
      : '';
    this.$('reader-body').innerHTML = html + note;
  }

  closeReader() {
    this.readerOpen = false;
    this.reader.className = 'panel reader';
  }

  /* ------------------------------------------------------------- recorder */
  setRecorder(lines) {
    if (!lines) { this.recorder.classList.remove('show'); return; }
    this.$('rec-lines').innerHTML = lines.map(l => `<p>${this.escape(l)}</p>`).join('');
    this.recorder.classList.add('show');
  }

  /* ------------------------------------------------------------ title card */
  titleCard() {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;
      justify-content:center;align-items:center;pointer-events:none;
      transition:opacity 1.6s ease;opacity:0;text-align:center`;
    el.innerHTML = `<h1 class="bigtitle" style="margin:0">TERRE<br>BONNE</h1>`;
    document.getElementById('ui').appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; }, 3600);
    setTimeout(() => el.remove(), 5600);
  }

  /* -------------------------------------------------------------- endings */
  showEnding(ending, credits) {
    this.clearLines();
    this.setRecorder(null);
    this.$('ending-tag').textContent = ending.tag;
    this.$('ending-title').textContent = ending.title;
    this.$('ending-body').innerHTML = ending.body
      .map(([cls, text]) => `<p class="${cls}">${this.escape(text)}</p>`).join('');
    this.endingPanel.classList.add('show');
    this.credits = credits;
    this.creditsShown = false;
  }

  // Second press rolls the credits under the ending text rather than cutting away.
  advanceEnding() {
    if (!this.endingPanel.classList.contains('show') || this.creditsShown) return;
    this.creditsShown = true;
    const html = this.credits.map(l =>
      l ? `<p class="credit">${this.escape(l)}</p>` : '<p class="credit">&nbsp;</p>').join('');
    this.$('ending-body').insertAdjacentHTML('beforeend',
      `<div style="margin-top:3rem;border-top:1px solid var(--moss);padding-top:2rem">${html}</div>`);
    this.endingPanel.scrollTo({ top: this.endingPanel.scrollHeight, behavior: 'smooth' });
  }
}
