/* Ear Bench — app shell, keyboard, MIDI and training modes */
(function () {
  'use strict';
  const T = window.Theory, A = window.PianoAudio, mod = T.mod;

  // ---------- helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = s => document.querySelector(s);
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function load(key, dflt) { try { const v = localStorage.getItem(key); return v ? Object.assign(structuredClone(dflt), JSON.parse(v)) : structuredClone(dflt); } catch (e) { return structuredClone(dflt); } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } }
  function today(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  const timers = new Set();
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers.clear(); }
  function toast(msg, action) {
    const el = $('#toast');
    el.innerHTML = '';
    el.append(h('span', null, msg));
    if (action) el.append(h('button', { class: 'linkbtn', onclick: () => { action.fn(); el.hidden = true; } }, action.label));
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 4500);
  }

  // ---------- settings & stats ----------
  const DEFAULTS = {
    global: { volume: 0.8, samples: true, midiEcho: false, labels: 'c', goal: 40 },
    intervals: { level: 0, custom: null, dir: 'asc', auto: true },
    degrees: { level: 0, custom: null, key: 'random', every: 5, cadence: 'keychange', range: 'one', resolve: true, auto: true },
    chords: { level: 0, custom: null, inv: 'root', style: 'both', auto: true },
    prog: { tonality: 'major', levelmajor: 1, levelminor: 0, length: 4, key: 'random', tempo: 84, startTonic: true, cadence: true, hearPick: false },
    melody: { level: 0, length: 4, key: 'random', tempo: 92, cadence: true, octave: 'any' },
    workshop: { key: 0, minor: false, tempo: 90, latch: true, chords: [], songs: [] }
  };
  const Settings = load('earbench.settings', DEFAULTS);
  for (const k of Object.keys(DEFAULTS)) Settings[k] = Object.assign({}, DEFAULTS[k], Settings[k]);
  const saveSettings = () => save('earbench.settings', Settings);

  const Stats = {
    d: load('earbench.stats', { items: {}, modes: {}, recent: {}, days: {} }),
    record(mode, item, ok, levelKey) {
      const k = mode + ':' + item;
      const it = this.d.items[k] || (this.d.items[k] = { a: 0, c: 0 });
      it.a++; if (ok) it.c++;
      const m = this.d.modes[mode] || (this.d.modes[mode] = { a: 0, c: 0 });
      m.a++; if (ok) m.c++;
      if (levelKey != null) {
        const rk = mode + '@' + levelKey;
        const r = this.d.recent[rk] || (this.d.recent[rk] = []);
        r.push(ok ? 1 : 0); if (r.length > 20) r.shift();
      }
      const t = today();
      this.d.days[t] = (this.d.days[t] || 0) + 1;
      save('earbench.stats', this.d);
      updateGoal();
    },
    item(mode, item) { return this.d.items[mode + ':' + item] || { a: 0, c: 0 }; },
    weight(mode, item) { const it = this.item(mode, item); const acc = (it.c + 1) / (it.a + 2); return 1 + 3 * (1 - acc) + (it.a < 3 ? 0.8 : 0); },
    recent(mode, levelKey) { return this.d.recent[mode + '@' + levelKey] || []; },
    reset() { this.d = { items: {}, modes: {}, recent: {}, days: {} }; save('earbench.stats', this.d); updateGoal(); }
  };

  function streakDays() {
    let n = 0; const d = new Date();
    if (!Stats.d.days[today(d)]) d.setDate(d.getDate() - 1);
    while (Stats.d.days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function updateGoal() {
    const n = Stats.d.days[today()] || 0, g = Settings.global.goal;
    const el = $('#goal'); if (!el) return;
    el.querySelector('.goal-num').textContent = n + ' / ' + g;
    el.style.setProperty('--p', Math.min(1, n / g));
    el.title = 'Today: ' + n + ' answers. Daily goal ' + g + '. Streak ' + streakDays() + ' day(s).';
  }

  // ---------- on-screen keyboard ----------
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const KB = {
    lo: 36, hi: 84, keys: new Map(),
    render() {
      const el = $('#keyboard'); el.innerHTML = ''; this.keys.clear();
      let whites = 0;
      for (let m = this.lo; m <= this.hi; m++) if (!BLACK.has(mod(m))) whites++;
      el.style.setProperty('--whites', whites);
      let wi = 0;
      for (let m = this.lo; m <= this.hi; m++) {
        const black = BLACK.has(mod(m));
        const key = h('div', { class: 'key ' + (black ? 'black' : 'white'), 'data-m': m, role: 'button', 'aria-label': T.noteName(m) },
          h('span', { class: 'mark' }), h('span', { class: 'kname' }, !black ? T.noteName(m) : ''));
        if (black) key.style.left = 'calc(' + wi + ' * var(--ww) - var(--bw) / 2)';
        else wi++;
        if (!black && mod(m) === 0) key.classList.add('is-c');
        if (m === 60) key.classList.add('is-middle');
        el.append(key); this.keys.set(m, key);
      }
      el.dataset.labels = Settings.global.labels;
      el.onpointerdown = e => {
        const k = e.target.closest('.key'); if (!k) return;
        e.preventDefault();
        const m = +k.dataset.m;
        if (current && current.latchClick && current.latchClick(m)) return;
        KB.down = m; Input.on(m, 'screen', 0.72);
      };
      const up = () => { if (KB.down != null) { Input.off(KB.down, 'screen'); KB.down = null; } };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    press(m, on) { const k = this.keys.get(m); if (k) k.classList.toggle('down', on); },
    mark(m, label, kind = 'info') {
      const k = this.keys.get(m); if (!k) return;
      const mk = k.querySelector('.mark'); mk.textContent = label || ''; k.dataset.mark = kind;
    },
    flash(m, kind = 'play', ms = 500) {
      const k = this.keys.get(m); if (!k) return;
      k.classList.add('flash-' + kind); setTimeout(() => k.classList.remove('flash-' + kind), ms);
    },
    clearMarks() { for (const k of this.keys.values()) { delete k.dataset.mark; k.querySelector('.mark').textContent = ''; } },
    scrollTo(m) {
      const k = this.keys.get(m), sc = $('.kb-scroll'); if (!k || !sc) return;
      const target = k.offsetLeft - sc.clientWidth / 2 + k.offsetWidth / 2;
      sc.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  };

  // ---------- input (screen, computer keys, MIDI) ----------
  const Input = {
    held: new Map(),
    on(m, src, vel = 0.7) {
      A.init();
      if (this.held.has(m)) return;
      let v = null;
      if (src !== 'midi' || Settings.global.midiEcho) v = A.note(m, 0, null, vel);
      this.held.set(m, v);
      KB.press(m, true);
      if (current && current.onNote) current.onNote(m, src);
    },
    off(m) {
      if (!this.held.has(m)) return;
      const v = this.held.get(m);
      if (v) A.noteOff(v);
      this.held.delete(m);
      KB.press(m, false);
      if (current && current.onNoteOff) current.onNoteOff(m);
    }
  };

  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
  let kbdBase = 60;
  function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  document.addEventListener('keydown', e => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key in KEYMAP) { if (!e.repeat) Input.on(kbdBase + KEYMAP[key], 'kbd'); e.preventDefault(); return; }
    if (key === 'z') { kbdBase = Math.max(36, kbdBase - 12); toast('Computer keys now start at ' + T.noteName(kbdBase)); return; }
    if (key === 'x') { kbdBase = Math.min(72, kbdBase + 12); toast('Computer keys now start at ' + T.noteName(kbdBase)); return; }
    if (!current) return;
    if (key === ' ' && current.replay) { e.preventDefault(); current.replay(); }
    else if (key === 'enter' && current.next) { e.preventDefault(); current.next(); }
    else if (/^[1-9]$/.test(key) && current.answerIndex) { current.answerIndex(+key - 1); }
    else if (key === '0' && current.answerIndex) { current.answerIndex(9); }
  });
  document.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key in KEYMAP) Input.off(kbdBase + KEYMAP[key]);
  });
  window.addEventListener('blur', () => { [...Input.held.keys()].forEach(m => Input.off(m)); });

  const Midi = {
    status: 'off', names: [],
    async connect(manual) {
      const pill = $('#midiBtn');
      if (!navigator.requestMIDIAccess) { this.set('unsupported'); if (manual) toast('This browser has no Web MIDI. Use Chrome or Edge to connect a MIDI keyboard.'); return; }
      try {
        const acc = await navigator.requestMIDIAccess();
        const bind = () => {
          this.names = [];
          acc.inputs.forEach(inp => { inp.onmidimessage = this.onMsg; this.names.push(inp.name); });
          this.set(this.names.length ? 'on' : 'none');
        };
        bind(); acc.onstatechange = bind;
        if (manual && !this.names.length) toast('MIDI is ready, but no keyboard is plugged in. Connect it by USB and it will appear.');
      } catch (e) { this.set('blocked'); if (manual) toast('MIDI access was blocked. Allow MIDI for this page in the browser\'s site settings.'); }
      void pill;
    },
    onMsg(e) {
      const [st, d1, d2] = e.data, cmd = st & 0xf0;
      if (cmd === 0x90 && d2 > 0) Input.on(d1, 'midi', d2 / 127);
      else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) Input.off(d1);
    },
    set(s) {
      this.status = s;
      const pill = $('#midiBtn');
      pill.dataset.state = s;
      pill.querySelector('.pill-text').textContent = s === 'on' ? (this.names[0] || 'MIDI keyboard') : s === 'none' ? 'No MIDI device' : s === 'blocked' ? 'MIDI blocked' : s === 'unsupported' ? 'No MIDI' : 'Connect MIDI';
    }
  };

  // ---------- shared UI pieces ----------
  function shell(title, blurb) {
    const s = {};
    s.root = h('div', { class: 'ex' });
    s.status = h('div', { class: 'status' }, s.main = h('div', { class: 'status-main' }), s.sub = h('div', { class: 'status-sub' }));
    s.controls = h('div', { class: 'controls' });
    s.answers = h('div', { class: 'answers' });
    s.feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    s.session = h('div', { class: 'session' });
    s.root.append(h('div', { class: 'ex-head' }, h('h1', null, title), h('p', { class: 'blurb' }, blurb)), s.status, s.controls, s.answers, s.feedback, s.session);
    s.set = (main, sub) => { s.main.textContent = main || ''; s.sub.textContent = sub || ''; };
    s.fb = (kind, html) => { s.feedback.dataset.kind = kind || ''; s.feedback.innerHTML = html || ''; };
    s.sess = { a: 0, c: 0, streak: 0, best: 0 };
    s.score = ok => {
      const x = s.sess; x.a++; if (ok) { x.c++; x.streak++; x.best = Math.max(x.best, x.streak); } else x.streak = 0;
      s.renderSession();
    };
    s.renderSession = () => {
      const x = s.sess;
      s.session.innerHTML = '';
      s.session.append(
        stat('This session', x.a ? x.c + ' / ' + x.a : '—'),
        stat('Accuracy', x.a ? Math.round(100 * x.c / x.a) + '%' : '—'),
        stat('Streak', x.streak), stat('Best streak', x.best));
    };
    s.renderSession();
    return s;
  }
  function stat(label, value) { return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, value), h('div', { class: 'stat-l' }, label)); }
  function btn(label, onclick, cls = '', title) { return h('button', { class: 'btn ' + cls, onclick, title }, label); }
  function section(title, ...kids) { return h('section', { class: 'side-sec' }, title && h('h3', null, title), ...kids); }
  function field(label, control, hint) { return h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), control, hint && h('span', { class: 'field-h' }, hint)); }
  function select(id, options, value, onchange) {
    const el = h('select', { id, onchange: e => onchange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
    return el;
  }
  function seg(id, options, value, onchange) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', id });
    options.forEach(([v, l]) => {
      const b = h('button', { class: 'seg-b', role: 'radio', 'aria-checked': String(v) === String(value) ? 'true' : 'false', onclick: () => { wrap.querySelectorAll('.seg-b').forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); onchange(v); } }, l);
      wrap.append(b);
    });
    return wrap;
  }
  function toggle(id, label, value, onchange) {
    const input = h('input', { type: 'checkbox', id, checked: value, onchange: e => onchange(e.target.checked) });
    return h('label', { class: 'toggle', for: id }, input, h('span', { class: 'toggle-ui' }), h('span', null, label));
  }
  const KEY_OPTIONS = [['random', 'Random key']].concat([...Array(12)].map((_, i) => [i, T.pcName(i, T.usesFlats(i, false)) + ' major']));

  // Level picker with optional custom chips
  function poolPicker(st, levels, all, labelFn, onchange, levelProp = 'level') {
    const wrap = h('div', { class: 'pool' });
    const sel = select(null, levels.map((l, i) => [i, 'Level ' + (i + 1) + ' — ' + l.name]).concat([['custom', 'Custom selection']]),
      st.custom ? 'custom' : st[levelProp], v => {
        if (v === 'custom') st.custom = currentPool().slice(); else { st.custom = null; st[levelProp] = +v; }
        saveSettings(); drawChips(); onchange();
      });
    const chips = h('div', { class: 'chips' });
    function currentPool() { return st.custom && st.custom.length ? st.custom : levels[Math.min(st[levelProp], levels.length - 1)].pool; }
    function drawChips() {
      chips.innerHTML = '';
      const pool = currentPool();
      all.forEach(id => {
        const on = pool.includes(id);
        chips.append(h('button', {
          class: 'chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => {
            const p = currentPool().slice();
            const i = p.indexOf(id);
            if (i >= 0) { if (p.length <= 2) { toast('Keep at least two options in the pool.'); return; } p.splice(i, 1); } else p.push(id);
            st.custom = all.filter(x => p.includes(x)); sel.value = 'custom'; saveSettings(); drawChips(); onchange();
          }
        }, labelFn(id)));
      });
    }
    drawChips();
    wrap.append(field('Level', sel), chips);
    return { el: wrap, pool: currentPool, levelKey: () => st.custom ? 'custom' : String(st[levelProp]), refresh: () => { sel.value = st.custom ? 'custom' : st[levelProp]; drawChips(); } };
  }

  function levelNudge(mode, picker, levels, st, levelProp = 'level') {
    const el = h('div', { class: 'nudge', hidden: true });
    function check() {
      if (st.custom) { el.hidden = true; return; }
      const r = Stats.recent(mode, picker.levelKey());
      const lvl = st[levelProp];
      if (r.length >= 20 && lvl < levels.length - 1) {
        const acc = r.reduce((a, b) => a + b, 0) / r.length;
        if (acc >= 0.85) {
          el.innerHTML = '';
          el.append(h('span', null, 'You\'re at ' + Math.round(acc * 100) + '% over your last 20 at this level. '),
            h('button', { class: 'linkbtn', onclick: () => { st[levelProp] = lvl + 1; saveSettings(); picker.refresh(); check(); current.next && current.next(); } }, 'Move up to Level ' + (lvl + 2)));
          el.hidden = false; return;
        }
      }
      el.hidden = true;
    }
    check();
    return { el, check };
  }

  function answerButton(i, main, sub, onclick) {
    return h('button', { class: 'ans', 'data-i': i, onclick },
      h('span', { class: 'ans-k' }, i < 9 ? String(i + 1) : i === 9 ? '0' : ''),
      h('span', { class: 'ans-main' }, main), sub ? h('span', { class: 'ans-sub' }, sub) : null);
  }

  function tonicNear(pc, lo = 55) { let t = mod(pc); while (t < lo) t += 12; return t; }

  // Establish key: I–IV–V–I (major) or i–iv–V–i (minor). Returns seconds used.
  function playCadence(tonic, minor, at = 0, step = 0.62) {
    const pc = mod(tonic);
    const seq = minor ? [[0, 'min'], [5, 'min'], [7, 'maj'], [0, 'min']] : [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']];
    const vs = T.voiceSequence(seq.map(([o, t]) => ({ root: mod(pc + o), type: t })));
    vs.forEach((v, i) => A.chord(v.all, at + i * step, i === 3 ? step * 1.6 : step * 1.05, 0.5));
    return at + step * 4 + 0.45;
  }

  // ===================================================================
  // MODE: Intervals
  // ===================================================================
  const IV_LEVELS = [
    { name: 'M3 · P5 · octave', pool: ['M3', 'P5', 'P8'] },
    { name: '+ M2 · P4', pool: ['M2', 'M3', 'P4', 'P5', 'P8'] },
    { name: '+ m3 · M6', pool: ['M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'] },
    { name: '+ m2 · m6 · m7 · M7', pool: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] },
    { name: 'All intervals', pool: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] }
  ];
  const IV_ALL = IV_LEVELS[4].pool;
  const ivById = id => T.INTERVALS.find(i => i.id === id);

  function IntervalsMode(stage, side) {
    const st = Settings.intervals;
    const s = shell('Intervals', 'Hear two notes and name the distance between them. Answer with the buttons, or find the second note on the keys.');
    let q = null, answered = false, tries = 0;
    const picker = poolPicker(st, IV_LEVELS, IV_ALL, id => id, () => { drawAnswers(); next(); });
    const nudge = levelNudge('intervals', picker, IV_LEVELS, st);

    const bNext = btn('Next', () => next(), 'primary');
    s.controls.append(bNext, btn('Replay', () => play(), '', 'Space'), btn('Hear slowly', () => play(1.8)));

    function drawAnswers() {
      s.answers.innerHTML = '';
      s.answers.className = 'answers grid-iv';
      picker.pool().forEach((id, i) => {
        const iv = ivById(id);
        s.answers.append(answerButton(i, iv.name, iv.id, () => choose(id)));
      });
    }
    function next() {
      clearTimers(); A.stopAll(); KB.clearMarks();
      const pool = picker.pool();
      const id = T.weightedPick(pool, pool.map(x => Stats.weight('intervals', x)));
      const iv = ivById(id);
      const dir = st.dir === 'mixed' ? pick(['asc', 'desc', 'harm']) : st.dir;
      const lo = rand(50, 74 - iv.s);
      q = { iv, dir, lo, hi: lo + iv.s };
      answered = false; tries = 0;
      s.set(dir === 'asc' ? 'Ascending interval' : dir === 'desc' ? 'Descending interval' : 'Harmonic interval', 'Which interval is it?');
      s.fb('', dir !== 'harm' ? 'Tip: try playing the second note on your keyboard before you answer.' : '');
      s.answers.querySelectorAll('.ans').forEach(b => b.removeAttribute('data-state'));
      bNext.textContent = 'Skip';
      play();
    }
    function play(slow = 1) {
      if (!q) return next();
      A.stopAll();
      const { lo, hi, dir } = q, gap = 0.75 * slow;
      if (dir === 'asc') { A.note(lo, 0, gap + 0.2); A.note(hi, gap, 1.3); }
      else if (dir === 'desc') { A.note(hi, 0, gap + 0.2); A.note(lo, gap, 1.3); }
      else { A.note(lo, 0, 1.8 * slow); A.note(hi, 0, 1.8 * slow); }
    }
    function preview(id) {
      const iv = ivById(id); A.stopAll();
      const lo = q.lo, hi = lo + iv.s;
      if (q.dir === 'desc') { A.note(lo + iv.s, 0, 0.9); A.note(lo, 0.75, 1.2); }
      else if (q.dir === 'harm') { A.note(lo, 0, 1.6); A.note(hi, 0, 1.6); }
      else { A.note(lo, 0, 0.9); A.note(hi, 0.75, 1.2); }
    }
    function choose(id) {
      if (!q) return;
      if (answered) return preview(id);
      finish(id === q.iv.id, id);
    }
    function finish(ok, chosenId) {
      answered = true;
      Stats.record('intervals', q.iv.id, ok, picker.levelKey());
      s.score(ok);
      s.answers.querySelectorAll('.ans').forEach(b => {
        const id = picker.pool()[+b.dataset.i];
        if (id === q.iv.id) b.dataset.state = 'right';
        else if (id === chosenId) b.dataset.state = 'wrong';
      });
      const ref = q.iv.song ? ' <span class="muted">Ascending reference: ' + q.iv.song + '.</span>' : '';
      if (ok) s.fb('good', '<strong>' + q.iv.name + '.</strong>' + ref);
      else s.fb('bad', 'It was a <strong>' + q.iv.name + '</strong>' + (chosenId ? ', not a ' + ivById(chosenId).name.toLowerCase() : '') + '.' + ref + ' <span class="muted">Tap any answer to hear it from the same note.</span>');
      KB.mark(q.lo, T.noteName(q.lo), 'info'); KB.mark(q.hi, T.noteName(q.hi), ok ? 'good' : 'bad');
      bNext.textContent = 'Next';
      nudge.check();
      if (ok && st.auto) later(next, 1300);
    }
    function onNote(m) {
      if (!q || answered || q.dir === 'harm') return;
      const target = q.dir === 'asc' ? q.hi : q.lo, ref = q.dir === 'asc' ? q.lo : q.hi;
      if (m === ref) return;
      if (m === target) { finish(tries === 0, tries === 0 ? q.iv.id : null); if (tries) s.fb('good', 'Found it: <strong>' + q.iv.name + '</strong> after ' + (tries + 1) + ' tries. Counted as a miss so it comes back more often.'); }
      else {
        tries++;
        const d = m - ref;
        s.fb('', 'You played ' + (d > 0 ? 'a ' : 'a descending ') + T.intervalBySemis(Math.abs(d) % 13).name.toLowerCase() + (Math.abs(d) > 12 ? ' (plus an octave)' : '') + '. Keep looking.');
      }
    }

    side.append(
      section('Practice set', picker.el, nudge.el),
      section('How it sounds',
        field('Direction', seg('iv-dir', [['asc', 'Up'], ['desc', 'Down'], ['harm', 'Together'], ['mixed', 'Mixed']], st.dir, v => { st.dir = v; saveSettings(); next(); })),
        toggle('iv-auto', 'Go to the next question after a correct answer', st.auto, v => { st.auto = v; saveSettings(); })),
      section('Tips', h('p', { class: 'small' }, 'Sing the interval back before answering. On the piano, find the first note, then search for the second; your hands learn the shapes while your ear learns the sound.'),
        h('p', { class: 'small muted' }, 'Shortcuts: Space replays, Enter goes on, number keys answer.'))
    );
    stage.append(s.root);
    drawAnswers();
    s.set('Press Next to hear your first interval', 'Your level and direction are on the right.');
    bNext.textContent = 'Start';
    return { onNote, replay: () => play(), next, answerIndex: i => { const id = picker.pool()[i]; if (id) choose(id); } };
  }

  // ===================================================================
  // MODE: Scale degrees (functional ear training)
  // ===================================================================
  const DEG_LEVELS = [
    { name: '1 · 3 · 5', pool: ['1', '3', '5'] },
    { name: '1 to 5', pool: ['1', '2', '3', '4', '5'] },
    { name: 'Major scale', pool: ['1', '2', '3', '4', '5', '6', '7'] },
    { name: '+ ♭3 · ♭7', pool: ['1', '2', '♭3', '3', '4', '5', '6', '♭7', '7'] },
    { name: 'Chromatic', pool: ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'] }
  ];
  const DEG_ALL = DEG_LEVELS[4].pool;
  const degById = id => T.DEGREES.find(d => d.id === id);

  function DegreesMode(stage, side) {
    const st = Settings.degrees;
    const s = shell('Scale degrees', 'A cadence sets the key, then one note plays. Name its place in the key. This is the core skill behind hearing melodies and bass lines.');
    let q = null, answered = false, tries = 0, keyPc = null, count = 0, keyFresh = true;
    const picker = poolPicker(st, DEG_LEVELS, DEG_ALL, id => id, () => { drawAnswers(); next(); });
    const nudge = levelNudge('degrees', picker, DEG_LEVELS, st);
    const bNext = btn('Start', () => next(), 'primary');
    s.controls.append(bNext, btn('Replay note', () => playNote(), '', 'Space'), btn('Cadence', () => { A.stopAll(); const t = playCadence(q ? q.tonic : 60, false); later(() => playNote(), t * 1000); }), btn('Tonic', () => { A.stopAll(); if (q) A.note(q.tonic, 0, 1.4); }));

    function drawAnswers() {
      s.answers.innerHTML = ''; s.answers.className = 'answers grid-deg';
      picker.pool().forEach((id, i) => { const d = degById(id); s.answers.append(answerButton(i, id, d.sol, () => choose(id))); });
    }
    function chooseKey() {
      const fixed = st.key !== 'random';
      const prev = keyPc;
      if (fixed) keyPc = +st.key;
      else if (keyPc == null || count % st.every === 0) { do { keyPc = rand(0, 11); } while (keyPc === prev && Math.random() < 0.8); }
      keyFresh = keyPc !== prev;
    }
    function next() {
      clearTimers(); A.stopAll(); KB.clearMarks();
      chooseKey(); count++;
      const pool = picker.pool();
      const id = T.weightedPick(pool, pool.map(x => Stats.weight('degrees', x)));
      const deg = degById(id);
      const tonic = tonicNear(keyPc, 55);
      let note = tonic + deg.s;
      if (st.range === 'two') {
        const opts = [note - 12, note, note + 12].filter(n => n >= 45 && n <= 81);
        note = pick(opts);
      }
      q = { deg, tonic, note };
      answered = false; tries = 0;
      s.set('Key of ' + T.keyName(keyPc, false), 'Which scale degree is the note?');
      s.fb('', 'You can also answer by playing the note on your keyboard (any octave).');
      s.answers.querySelectorAll('.ans').forEach(b => b.removeAttribute('data-state'));
      bNext.textContent = 'Skip';
      const withCad = st.cadence === 'always' || keyFresh || count === 1;
      if (withCad) { const t = playCadence(tonic, false); later(() => playNote(), t * 1000); }
      else playNote();
    }
    function playNote() { if (!q) return next(); A.note(q.note, 0, 1.5, 0.75); }
    function resolution() {
      const { note, tonic } = q;
      const rel = mod(note - tonic);
      if (rel === 0) return [note];
      const down = rel <= 5;
      const target = down ? note - rel : note + (12 - rel);
      const seq = [note]; let cur = note;
      const dia = new Set(T.MAJOR_SCALE);
      while (cur !== target) { cur += down ? -1 : 1; if (cur === target || dia.has(mod(cur - tonic))) seq.push(cur); }
      return seq;
    }
    function finish(ok, chosen) {
      answered = true;
      Stats.record('degrees', q.deg.id, ok, picker.levelKey());
      s.score(ok);
      s.answers.querySelectorAll('.ans').forEach(b => {
        const id = picker.pool()[+b.dataset.i];
        if (id === q.deg.id) b.dataset.state = 'right'; else if (id === chosen) b.dataset.state = 'wrong';
      });
      const flats = T.usesFlats(keyPc, false);
      const nm = T.pcName(q.note, flats);
      s.fb(ok ? 'good' : 'bad', (ok ? '' : 'It was ') + '<strong>' + q.deg.id + ' (' + q.deg.sol + ')</strong>, the note ' + nm + ' in ' + T.keyName(keyPc, false) + '.' + (st.resolve ? ' <span class="muted">Listen to it resolve home.</span>' : ''));
      KB.mark(q.tonic, '1', 'info'); KB.mark(q.note, q.deg.id, ok ? 'good' : 'bad');
      bNext.textContent = 'Next';
      nudge.check();
      let wait = 1300;
      if (st.resolve) {
        const seq = resolution();
        A.stopAll();
        seq.forEach((n, i) => { A.note(n, 0.15 + i * 0.38, i === seq.length - 1 ? 1.2 : 0.42, 0.68); later(() => KB.flash(n, 'play', 380), (0.15 + i * 0.38) * 1000); });
        wait = 600 + seq.length * 380;
      }
      if (ok && st.auto) later(next, wait + 500);
    }
    function choose(id) {
      if (!q) return;
      if (answered) { const d = degById(id); A.stopAll(); A.note(q.tonic + d.s, 0, 1.2); return; }
      finish(id === q.deg.id, id);
    }
    function onNote(m) {
      if (!q || answered) return;
      const rel = mod(m - q.tonic);
      if (rel === q.deg.s) { const first = tries === 0; finish(first, first ? q.deg.id : null); if (!first) s.fb('good', 'Found it: <strong>' + q.deg.id + ' (' + q.deg.sol + ')</strong> after ' + (tries + 1) + ' tries.'); }
      else { tries++; const d = T.DEGREES[rel]; s.fb('', 'That\'s ' + d.id + ' (' + d.sol + '). Keep looking.'); }
    }

    side.append(
      section('Practice set', picker.el, nudge.el),
      section('Key',
        field('Key', select('deg-key', KEY_OPTIONS, st.key, v => { st.key = v; keyPc = null; saveSettings(); })),
        field('New random key every', select('deg-every', [[1, 'question'], [5, '5 questions'], [10, '10 questions']], st.every, v => { st.every = +v; saveSettings(); })),
        field('Cadence', seg('deg-cad', [['keychange', 'When key changes'], ['always', 'Every question']], st.cadence, v => { st.cadence = v; saveSettings(); }))),
      section('Notes',
        field('Register', seg('deg-range', [['one', 'One octave'], ['two', 'Wide']], st.range, v => { st.range = v; saveSettings(); })),
        toggle('deg-res', 'Resolve the note to the tonic after each answer', st.resolve, v => { st.resolve = v; saveSettings(); }),
        toggle('deg-auto', 'Go to the next question after a correct answer', st.auto, v => { st.auto = v; saveSettings(); })),
      section('Why this matters', h('p', { class: 'small' }, 'Every note has a personality in a key: 7 pulls up to 1, 4 leans down to 3, 5 feels stable but open. Learn those pulls and you can work out melodies and bass lines without hunting note by note.'))
    );
    stage.append(s.root);
    drawAnswers();
    s.set('Press Start to hear the key and a note', 'Answers use scale numbers with solfège underneath.');
    return { onNote, replay: playNote, next, answerIndex: i => { const id = picker.pool()[i]; if (id) choose(id); } };
  }

  // ===================================================================
  // MODE: Chord qualities
  // ===================================================================
  const CH_LEVELS = [
    { name: 'Major · minor', pool: ['maj', 'min'] },
    { name: '+ diminished · augmented', pool: ['maj', 'min', 'dim', 'aug'] },
    { name: '+ sus2 · sus4', pool: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'] },
    { name: 'Seventh chords', pool: ['maj7', 'dom7', 'min7'] },
    { name: 'All sevenths', pool: ['maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'mmaj7'] },
    { name: 'Triads + sevenths', pool: ['maj', 'min', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7'] },
    { name: 'Colour chords', pool: ['maj6', 'min6', 'sus7', 'add9', 'dom9', 'maj9', 'min9'] }
  ];
  const CH_ALL = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'mmaj7', 'maj6', 'min6', 'sus7', 'add9', 'dom9', 'maj9', 'min9'];

  function ChordsMode(stage, side) {
    const st = Settings.chords;
    const s = shell('Chord qualities', 'A chord plays. Name its quality. Start with major and minor and work up to sevenths and colour chords.');
    let q = null, answered = false;
    const picker = poolPicker(st, CH_LEVELS, CH_ALL, id => T.CHORDS[id].name, () => { drawAnswers(); next(); });
    const nudge = levelNudge('chords', picker, CH_LEVELS, st);
    const bNext = btn('Start', () => next(), 'primary');
    s.controls.append(bNext, btn('Replay', () => play(), '', 'Space'), btn('Arpeggiate', () => play('arp')), btn('Block', () => play('block')));

    function build(root, type, inv) {
      const iv = T.CHORDS[type].iv;
      let notes = iv.map(i => root + i);
      if (inv > 0 && iv.length <= 4) notes = notes.map((n, i) => i < inv ? n + 12 : n).sort((a, b) => a - b);
      return notes;
    }
    function drawAnswers() {
      s.answers.innerHTML = ''; s.answers.className = 'answers grid-ch';
      picker.pool().forEach((id, i) => s.answers.append(answerButton(i, T.CHORDS[id].name, 'C' + T.CHORDS[id].sym, () => choose(id))));
    }
    function next() {
      clearTimers(); A.stopAll(); KB.clearMarks();
      const pool = picker.pool();
      const type = T.weightedPick(pool, pool.map(x => Stats.weight('chords', x)));
      const root = rand(48, 59);
      const n = T.CHORDS[type].iv.length;
      const inv = st.inv === 'any' && n <= 4 ? rand(0, n - 1) : 0;
      q = { type, root, inv, notes: build(root, type, inv) };
      answered = false;
      s.set(inv ? 'Inverted chord' : 'Chord in root position', 'What quality is it?');
      s.fb('', '');
      s.answers.querySelectorAll('.ans').forEach(b => b.removeAttribute('data-state'));
      bNext.textContent = 'Skip';
      play();
    }
    function play(style = st.style, notes = q && q.notes) {
      if (!q) return next();
      A.stopAll();
      if (style === 'arp' || style === 'both') notes.forEach((m, i) => A.note(m, i * 0.32, style === 'both' ? 0.5 + (notes.length - i) * 0.32 : 1.4 - i * 0.1, 0.62));
      const t = style === 'both' ? notes.length * 0.32 + 0.25 : 0;
      if (style === 'block' || style === 'both') A.chord(notes, t, 1.8, 0.6);
    }
    function choose(id) {
      if (!q) return;
      if (answered) { play('both', build(q.root, id, Math.min(q.inv, T.CHORDS[id].iv.length - 1))); return; }
      const ok = id === q.type;
      answered = true;
      Stats.record('chords', q.type, ok, picker.levelKey());
      s.score(ok);
      s.answers.querySelectorAll('.ans').forEach(b => {
        const x = picker.pool()[+b.dataset.i];
        if (x === q.type) b.dataset.state = 'right'; else if (x === id) b.dataset.state = 'wrong';
      });
      const c = T.CHORDS[q.type], flats = false;
      const name = T.chordName(mod(q.root), q.type, flats, mod(q.notes[0]));
      s.fb(ok ? 'good' : 'bad', (ok ? '' : 'It was ') + '<strong>' + c.name + '</strong>: ' + name + (q.inv ? ' (inversion ' + q.inv + ')' : '') + '. <span class="muted">Tap any answer to hear that quality on the same root.</span>');
      q.notes.forEach(m => { const iv = mod(m - q.root); const ivs = c.iv.find(x => mod(x) === iv); KB.mark(m, T.TONE_LABELS[ivs] || '', ok ? 'good' : 'bad'); });
      bNext.textContent = 'Next';
      nudge.check();
      if (ok && st.auto) later(next, 1500);
    }

    side.append(
      section('Practice set', picker.el, nudge.el),
      section('How it sounds',
        field('Voicing', seg('ch-inv', [['root', 'Root position'], ['any', 'Inversions']], st.inv, v => { st.inv = v; saveSettings(); })),
        field('Playback', seg('ch-style', [['block', 'Block'], ['arp', 'Arpeggio'], ['both', 'Both']], st.style, v => { st.style = v; saveSettings(); })),
        toggle('ch-auto', 'Go to the next question after a correct answer', st.auto, v => { st.auto = v; saveSettings(); })),
      section('Listening for', h('ul', { class: 'small list' },
        h('li', null, h('b', null, 'Major / minor: '), 'listen to the middle note. Bright or dark.'),
        h('li', null, h('b', null, 'Diminished: '), 'tense and small; augmented sounds stretched, unresolved.'),
        h('li', null, h('b', null, 'Dominant 7: '), 'bluesy and wants to move. Major 7 is soft and floating.'),
        h('li', null, h('b', null, 'Sus chords: '), 'no third, so neither happy nor sad. Hollow.')))
    );
    stage.append(s.root);
    drawAnswers();
    s.set('Press Start to hear a chord', 'After answering, the chord tones are labelled on the keyboard.');
    return { replay: () => play(), next, answerIndex: i => { const id = picker.pool()[i]; if (id) choose(id); } };
  }

  // ===================================================================
  // MODE: Chord progressions
  // ===================================================================
  function ProgMode(stage, side) {
    const st = Settings.prog;
    const s = shell('Progressions', 'Hear a progression in a key and write it down in Roman numerals. This is how you work out the chords of a song.');
    let q = null, answer = [], active = 0, checked = false;
    const levelProp = () => 'level' + st.tonality;
    const levels = () => T.PROG_LEVELS[st.tonality];
    let picker, nudge;
    const slotsEl = h('div', { class: 'slots' });
    const palette = h('div', { class: 'answers grid-rn' });
    const bNext = btn('Start', () => next(), 'primary');
    const bCheck = btn('Check', () => check(), 'accent');
    s.controls.append(bNext, btn('Replay', () => play(), '', 'Space'), btn('Bass line', () => play('bass')), btn('Cadence', () => { A.stopAll(); if (q) playCadence(q.tonic + 12, st.tonality === 'minor'); }), btn('Hear my answer', () => play('mine')), bCheck);
    s.answers.replaceWith(h('div', { class: 'prog-area' }, slotsEl, palette));
    s.answers = palette;

    function chordOf(label, tonicPc) { const [o, type] = T.PROG[label]; return { root: mod(tonicPc + o), type }; }

    function buildPicker() {
      const holder = side.querySelector('#prog-picker'); if (!holder) return;
      holder.innerHTML = '';
      const all = [...new Set(levels().flatMap(l => l.pool))];
      const stProxy = st; // custom pools are per tonality
      const key = 'custom' + st.tonality;
      const view = { get custom() { return stProxy[key]; }, set custom(v) { stProxy[key] = v; } };
      Object.defineProperty(view, levelProp(), { get: () => stProxy[levelProp()], set: v => { stProxy[levelProp()] = v; }, enumerable: true });
      picker = poolPicker(view, levels(), all, id => id, () => { drawPalette(); next(); }, levelProp());
      nudge = levelNudge('prog', { levelKey: () => st.tonality + picker.levelKey(), refresh: picker.refresh }, levels(), view, levelProp());
      holder.append(picker.el, nudge.el);
    }
    function pool() { return picker.pool(); }
    function drawPalette() {
      palette.innerHTML = '';
      pool().forEach((l, i) => { const c = q && chordOf(l, q.tonic); palette.append(answerButton(i, l, c ? T.chordIn(c.root, c.type, q.tonic, st.tonality === 'minor') : '', () => fill(l))); });
    }
    function drawSlots() {
      slotsEl.innerHTML = '';
      if (!q) return;
      q.labels.forEach((l, i) => {
        const locked = i === 0 && st.startTonic;
        const mine = answer[i];
        const cls = 'slot' + (i === active && !checked ? ' active' : '') + (checked ? (mine === l ? ' right' : ' wrong') : '') + (locked ? ' locked' : '');
        const flats = T.usesFlats(q.tonic, st.tonality === 'minor');
        const c = chordOf(l, q.tonic);
        slotsEl.append(h('button', { class: cls, 'data-i': i, onclick: () => { active = i; drawSlots(); playOne(i); } },
          h('span', { class: 'slot-n' }, 'Chord ' + (i + 1)),
          h('span', { class: 'slot-rn' }, mine || '?'),
          checked ? h('span', { class: 'slot-ans' }, mine === l ? T.chordIn(c.root, c.type, q.tonic, st.tonality === 'minor') : l + ' · ' + T.chordIn(c.root, c.type, q.tonic, st.tonality === 'minor')) : h('span', { class: 'slot-ans muted' }, locked ? 'Tonic, given' : 'Tap to hear')));
      });
    }
    function next() {
      clearTimers(); A.stopAll(); KB.clearMarks();
      const minor = st.tonality === 'minor';
      const tonic = st.key === 'random' ? rand(0, 11) : +st.key;
      const p = pool();
      const labels = T.makeProgression(p, st.length, minor, st.startTonic, l => Stats.weight('prog', l));
      const chords = labels.map(l => chordOf(l, tonic));
      q = { tonic, labels, chords, voicings: T.voiceSequence(chords) };
      answer = labels.map((l, i) => (i === 0 && st.startTonic ? l : null));
      active = st.startTonic ? 1 : 0; checked = false;
      s.set('Key of ' + T.keyName(tonic, minor) + ' · ' + st.length + ' chords', 'Pick a slot, then choose its chord below.');
      s.fb('', '');
      bNext.textContent = 'Skip'; bCheck.disabled = false;
      drawPalette(); drawSlots();
      const t = st.cadence ? playCadence(tonicNear(tonic, 55), minor) + 0.4 : 0;
      later(() => play(), t * 1000);
    }
    const beat = () => 60 / st.tempo;
    function play(what = 'all') {
      if (!q) return next();
      A.stopAll(); clearTimers();
      const dur = beat() * 2;
      const minor = st.tonality === 'minor';
      let vs = q.voicings;
      if (what === 'mine') {
        if (answer.some(x => !x)) { toast('Fill in every slot first, then compare.'); return; }
        vs = T.voiceSequence(answer.map(l => chordOf(l, q.tonic)));
      }
      vs.forEach((v, i) => {
        const t = i * dur;
        if (what === 'bass') A.note(v.bass + 12, t, dur * 0.95, 0.8);
        else { A.note(v.bass, t, dur * 0.98, 0.7); A.chord(v.rh, t + 0.015, dur * 0.98, 0.52); }
        later(() => { slotsEl.querySelectorAll('.slot').forEach((el, j) => el.classList.toggle('playing', j === i)); }, t * 1000);
      });
      later(() => slotsEl.querySelectorAll('.slot').forEach(el => el.classList.remove('playing')), vs.length * dur * 1000);
      void minor;
    }
    function playOne(i) {
      if (!q) return;
      A.stopAll();
      const v = q.voicings[i];
      A.note(v.bass, 0, 1.4, 0.7); A.chord(v.rh, 0.015, 1.4, 0.52);
      if (checked) { KB.clearMarks(); v.all.forEach(m => KB.mark(m, T.pcName(m, T.usesFlats(q.tonic, st.tonality === 'minor')), 'info')); }
    }
    function fill(label) {
      if (!q) return;
      if (checked) { // after checking: preview the chord in this key
        const c = chordOf(label, q.tonic); const v = T.voice(c.root, c.type, null); A.stopAll(); A.chord(v.all, 0, 1.4, 0.55); return;
      }
      if (active === 0 && st.startTonic) active = 1;
      answer[active] = label;
      if (st.hearPick) { const c = chordOf(label, q.tonic); const v = T.voice(c.root, c.type, q.voicings[active]); A.stopAll(); A.chord(v.all, 0, 1.2, 0.55); }
      const empty = answer.findIndex((x, i) => !x && i > active);
      const anyEmpty = answer.findIndex(x => !x);
      active = empty >= 0 ? empty : anyEmpty >= 0 ? anyEmpty : active;
      drawSlots();
    }
    function check() {
      if (!q || checked) return;
      if (answer.some(x => !x)) { toast('Fill in every slot before checking.'); return; }
      checked = true; bCheck.disabled = true;
      let right = 0, total = 0;
      q.labels.forEach((l, i) => {
        if (i === 0 && st.startTonic) return;
        total++;
        const ok = answer[i] === l; if (ok) right++;
        Stats.record('prog', l, ok, st.tonality + picker.levelKey());
      });
      s.score(right === total);
      const flats = T.usesFlats(q.tonic, st.tonality === 'minor');
      const names = q.chords.map(c => T.chordIn(c.root, c.type, q.tonic, st.tonality === 'minor')).join(' – ');
      s.fb(right === total ? 'good' : 'bad', '<strong>' + right + ' of ' + total + '</strong> chords right. The progression was <strong class="rn">' + q.labels.join(' – ') + '</strong> <span class="muted">(' + names + ')</span>. Tap a slot to hear one chord; tap a numeral to hear it in this key.');
      bNext.textContent = 'Next';
      drawSlots(); nudge.check();
    }

    const sideKey = h('div', { id: 'prog-picker' });
    side.append(
      section('Practice set',
        field('Tonality', seg('pr-ton', [['major', 'Major'], ['minor', 'Minor']], st.tonality, v => { st.tonality = v; saveSettings(); buildPicker(); drawPalette(); next(); })),
        sideKey),
      section('Progression',
        field('Length', seg('pr-len', [[3, '3'], [4, '4'], [5, '5'], [6, '6'], [8, '8']], st.length, v => { st.length = +v; saveSettings(); next(); })),
        field('Key', select('pr-key', KEY_OPTIONS, st.key, v => { st.key = v; saveSettings(); })),
        field('Tempo', h('div', { class: 'range' }, h('input', { type: 'range', id: 'pr-tempo', min: 50, max: 140, value: st.tempo, oninput: e => { st.tempo = +e.target.value; e.target.nextSibling.textContent = st.tempo + ' bpm'; saveSettings(); } }), h('output', null, st.tempo + ' bpm'))),
        toggle('pr-tonic', 'Start on the tonic (given)', st.startTonic, v => { st.startTonic = v; saveSettings(); next(); }),
        toggle('pr-cad', 'Play a cadence first to set the key', st.cadence, v => { st.cadence = v; saveSettings(); }),
        toggle('pr-hear', 'Play each chord as I choose it', st.hearPick, v => { st.hearPick = v; saveSettings(); })),
      section('How to listen', h('ol', { class: 'small list' },
        h('li', null, 'Follow the bass first. Use the Bass line button and sing it as scale degrees.'),
        h('li', null, 'Bass on 1, 4 or 5 usually means I, IV or V. Bass on 6 or 2 is usually minor (vi, ii).'),
        h('li', null, 'Then check each chord\'s quality: major or minor?'),
        h('li', null, 'Use Hear my answer to compare your guess with the real thing.')))
    );
    buildPicker();
    stage.append(s.root);
    drawPalette();
    s.set('Press Start to hear a progression', 'Roman numerals: upper case is major, lower case is minor.');
    return { replay: () => play(), next, answerIndex: i => { const l = pool()[i]; if (l) fill(l); } };
  }

  // ===================================================================
  // MODE: Melody echo (play back what you hear)
  // ===================================================================
  const MEL_LEVELS = [
    { name: 'Do · Re · Mi', pool: [0, 2, 4], maxStep: 1 },
    { name: 'Do to Sol', pool: [0, 2, 4, 5, 7], maxStep: 2 },
    { name: 'Major scale', pool: [-1, 0, 2, 4, 5, 7, 9, 11, 12], maxStep: 2 },
    { name: 'Scale with leaps', pool: [-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12], maxStep: 4 },
    { name: 'Chromatic notes', pool: [-5, -3, -1, 0, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12], maxStep: 4 }
  ];
  function MelodyMode(stage, side) {
    const st = Settings.melody;
    const s = shell('Melody echo', 'Listen to a short melody, then play it back on the piano. Use your MIDI keyboard, the computer keys or the keys below.');
    let q = null, pos = 0, mistakes = 0, done = false;
    const dots = h('div', { class: 'dots' });
    s.answers.replaceWith(dots); s.answers = dots;
    const bNext = btn('Start', () => next(), 'primary');
    s.controls.append(bNext, btn('Replay', () => play(), '', 'Space'), btn('Cadence', () => { A.stopAll(); if (q) playCadence(q.tonic, false); }), btn('First note', () => { if (q) A.note(q.notes[0], 0, 1); }), btn('Show me', () => reveal()));

    function gen() {
      const lvl = MEL_LEVELS[Math.min(st.level, MEL_LEVELS.length - 1)];
      const p = lvl.pool;
      let idx = p.indexOf(0);
      const out = [p[idx]];
      for (let i = 1; i < st.length; i++) {
        const steps = [], w = [];
        for (let d = -lvl.maxStep; d <= lvl.maxStep; d++) {
          const j = idx + d; if (j < 0 || j >= p.length) continue;
          steps.push(j); w.push(d === 0 ? 0.4 : Math.abs(d) === 1 ? 5 : Math.abs(d) === 2 ? 2.2 : 0.8);
        }
        idx = T.weightedPick(steps, w); out.push(p[idx]);
      }
      return out;
    }
    function next() {
      clearTimers(); A.stopAll(); KB.clearMarks();
      const keyPc = st.key === 'random' ? rand(0, 11) : +st.key;
      const tonic = tonicNear(keyPc, 60);
      q = { keyPc, tonic, notes: gen().map(o => tonic + o) };
      pos = 0; mistakes = 0; done = false;
      s.set('Key of ' + T.keyName(keyPc, false) + ' · ' + q.notes.length + ' notes', 'Play it back. The first note is ' + T.DEGREES[mod(q.notes[0] - tonic)].id + ' of the key.');
      s.fb('', st.octave === 'any' ? 'Any octave counts.' : 'Play in the same octave you hear.');
      drawDots(); bNext.textContent = 'Skip';
      const t = st.cadence ? playCadence(tonicNear(keyPc, 55), false) : 0;
      later(() => play(), t * 1000);
    }
    function drawDots() {
      dots.innerHTML = '';
      q.notes.forEach((n, i) => dots.append(h('span', { class: 'dot' + (i < pos ? ' ok' : '') + (i === pos && !done ? ' cur' : '') }, i < pos || done ? T.DEGREES[mod(n - q.tonic)].id : '')));
    }
    function play() {
      if (!q) return next();
      A.stopAll();
      const b = 60 / st.tempo;
      q.notes.forEach((n, i) => A.note(n, i * b, b * 0.95, 0.72));
    }
    function reveal() {
      if (!q) return;
      A.stopAll();
      const b = 60 / st.tempo;
      q.notes.forEach((n, i) => { A.note(n, i * b, b * 0.95, 0.72); later(() => { KB.flash(n, 'play', b * 900); KB.mark(n, T.DEGREES[mod(n - q.tonic)].id, 'info'); }, i * b * 1000); });
      KB.scrollTo(q.tonic + 4);
      if (!done) { done = true; Stats.record('melody', 'L' + st.level, false, String(st.level)); s.score(false); s.fb('bad', 'Here it is: <strong>' + q.notes.map(n => T.DEGREES[mod(n - q.tonic)].id).join(' – ') + '</strong>'); drawDots(); bNext.textContent = 'Next'; }
    }
    function onNote(m) {
      if (!q || done) return;
      const want = q.notes[pos];
      const ok = st.octave === 'any' ? mod(m) === mod(want) : m === want;
      if (ok) {
        pos++;
        if (pos >= q.notes.length) {
          done = true;
          const clean = mistakes === 0;
          Stats.record('melody', 'L' + st.level, clean, String(st.level)); s.score(clean);
          s.fb(clean ? 'good' : 'bad', clean ? '<strong>Perfect.</strong> ' + q.notes.map(n => T.DEGREES[mod(n - q.tonic)].id).join(' – ') : 'Got there with ' + mistakes + ' wrong note' + (mistakes > 1 ? 's' : '') + '. <strong>' + q.notes.map(n => T.DEGREES[mod(n - q.tonic)].id).join(' – ') + '</strong>');
          bNext.textContent = 'Next';
          if (clean) later(next, 1800);
        }
      } else { mistakes++; KB.flash(m, 'bad', 400); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); }
      drawDots();
    }
    side.append(
      section('Practice set',
        field('Level', select('mel-lvl', MEL_LEVELS.map((l, i) => [i, 'Level ' + (i + 1) + ' — ' + l.name]), st.level, v => { st.level = +v; saveSettings(); next(); })),
        field('Notes', seg('mel-len', [[3, '3'], [4, '4'], [5, '5'], [6, '6'], [8, '8']], st.length, v => { st.length = +v; saveSettings(); next(); }))),
      section('Playback',
        field('Key', select('mel-key', KEY_OPTIONS, st.key, v => { st.key = v; saveSettings(); })),
        field('Tempo', h('div', { class: 'range' }, h('input', { type: 'range', id: 'mel-tempo', min: 50, max: 160, value: st.tempo, oninput: e => { st.tempo = +e.target.value; e.target.nextSibling.textContent = st.tempo + ' bpm'; saveSettings(); } }), h('output', null, st.tempo + ' bpm'))),
        field('Octave', seg('mel-oct', [['any', 'Any octave'], ['exact', 'Exact pitch']], st.octave, v => { st.octave = v; saveSettings(); })),
        toggle('mel-cad', 'Play a cadence first', st.cadence, v => { st.cadence = v; saveSettings(); })),
      section('Tips', h('p', { class: 'small' }, 'Sing it back first, then play. Think in scale degrees (1, 2, 3) rather than note names, so the same melody feels the same in every key.'))
    );
    stage.append(s.root);
    s.set('Press Start to hear a melody', 'Played notes fill in the dots as you get them right.');
    return { onNote, replay: play, next };
  }

  // ===================================================================
  // MODE: Song workshop
  // ===================================================================
  function WorkshopMode(stage, side) {
    const st = Settings.workshop;
    let capture = new Set(), gesture = false, detected = [], looping = false;
    const flats = () => T.usesFlats(st.key, st.minor);

    // --- chord finder
    const big = h('div', { class: 'finder-name' }, '—');
    const rn = h('div', { class: 'finder-rn' });
    const notesEl = h('div', { class: 'finder-notes muted' }, 'Play or tap a chord on the keyboard.');
    const alts = h('div', { class: 'finder-alts' });
    const finder = h('section', { class: 'card finder' },
      h('div', { class: 'card-head' }, h('h2', null, 'Chord finder'),
        toggle('ws-latch', 'Tapped keys stay down', st.latch, v => { st.latch = v; saveSettings(); })),
      h('div', { class: 'finder-body' }, h('div', null, big, rn), h('div', { class: 'finder-meta' }, notesEl, alts)),
      h('div', { class: 'row' }, btn('Add to progression', () => addCurrent(), 'primary'), btn('Hear it', () => { if (capture.size) A.chord([...capture].sort((a, b) => a - b), 0, 1.6); }), btn('Clear', () => { capture.clear(); KB.clearMarks(); updateFinder(); })));

    function updateFinder() {
      KB.clearMarks();
      const notes = [...capture].sort((a, b) => a - b);
      notes.forEach(m => KB.mark(m, '', 'held'));
      detected = notes.length ? T.detectChord(notes, flats()) : [];
      const top = detected[0];
      big.textContent = top ? (top.type ? T.chordIn(top.root, top.type, st.key, st.minor, top.bass) : top.name) : '—';
      rn.textContent = top && top.type ? T.roman(top.root, top.type, st.key) + ' in ' + T.keyName(st.key, st.minor) : '';
      notesEl.textContent = notes.length ? notes.map(m => T.noteName(m, flats())).join('  ') : 'Play or tap a chord on the keyboard.';
      alts.innerHTML = '';
      const others = detected.slice(1, 4).filter(d => d.type);
      if (others.length) alts.append(h('span', { class: 'muted' }, 'Also: '), ...others.map(o => h('span', { class: 'tag' }, T.chordIn(o.root, o.type, st.key, st.minor, o.bass))));
    }

    // --- notebook
    const nbList = h('div', { class: 'nb-list' });
    const nbKeys = h('div', { class: 'nb-keys' });
    const songName = h('input', { type: 'text', id: 'ws-song', placeholder: 'Song name', maxlength: 60 });
    const loopBtn = btn('Loop', () => toggleLoop());
    const notebook = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Progression notebook'), h('div', { class: 'row tight' }, btn('−1', () => transpose(-1), 'small', 'Transpose down'), btn('+1', () => transpose(1), 'small', 'Transpose up'))),
      nbList,
      h('div', { class: 'row' }, btn('Play', () => playNotebook(false), 'primary'), loopBtn, btn('Guess key', () => guessKey()), btn('Clear', () => { const old = st.chords.slice(); st.chords = []; saveSettings(); drawNotebook(); toast('Notebook cleared.', { label: 'Undo', fn: () => { st.chords = old; saveSettings(); drawNotebook(); } }); })),
      nbKeys,
      h('div', { class: 'row save-row' }, songName, btn('Save song', () => saveSong())));

    function chordLabel(c) { return T.chordIn(c.root, c.type, st.key, st.minor, c.bass); }
    function drawNotebook() {
      nbList.innerHTML = '';
      if (!st.chords.length) { nbList.append(h('p', { class: 'muted small empty' }, 'No chords yet. Find chords with the chord finder or the chord palette, then add them here in order.')); return; }
      st.chords.forEach((c, i) => {
        nbList.append(h('div', { class: 'nb-chip', 'data-i': i },
          h('button', { class: 'nb-main', onclick: () => playChord(c) }, h('span', { class: 'nb-name' }, chordLabel(c)), h('span', { class: 'nb-rn' }, T.roman(c.root, c.type, st.key))),
          h('div', { class: 'nb-tools' },
            h('button', { class: 'icon', title: 'Move left', 'aria-label': 'Move left', onclick: () => move(i, -1) }, '‹'),
            h('button', { class: 'icon', title: 'Remove', 'aria-label': 'Remove chord', onclick: () => { st.chords.splice(i, 1); saveSettings(); drawNotebook(); } }, '×'),
            h('button', { class: 'icon', title: 'Move right', 'aria-label': 'Move right', onclick: () => move(i, 1) }, '›'))));
      });
    }
    function move(i, d) { const j = i + d; if (j < 0 || j >= st.chords.length) return; const c = st.chords.splice(i, 1)[0]; st.chords.splice(j, 0, c); saveSettings(); drawNotebook(); }
    function voicingFor(c, prev) { if (c.notes && c.notes.length) return { all: c.notes, rh: c.notes.slice(1), bass: c.notes[0] }; return T.voice(c.root, c.type, prev); }
    function playChord(c) { A.stopAll(); const v = voicingFor(c, null); A.chord(v.all, 0, 1.5, 0.58); KB.clearMarks(); v.all.forEach(m => KB.mark(m, T.pcName(m, flats()), 'info')); }
    function playNotebook(loop) {
      if (!st.chords.length) { toast('Add some chords first.'); return; }
      A.stopAll(); clearTimers();
      const dur = 60 / st.tempo * 2;
      let prev = null;
      st.chords.forEach((c, i) => {
        const v = c.notes ? voicingFor(c) : (prev = T.voice(c.root, c.type, prev));
        A.chord(v.all, i * dur, dur * 0.97, 0.56);
        later(() => nbList.querySelectorAll('.nb-chip').forEach((el, j) => el.classList.toggle('playing', j === i)), i * dur * 1000);
      });
      later(() => { nbList.querySelectorAll('.nb-chip').forEach(el => el.classList.remove('playing')); if (loop && looping) playNotebook(true); }, st.chords.length * dur * 1000);
    }
    function toggleLoop() { looping = !looping; loopBtn.classList.toggle('on', looping); loopBtn.textContent = looping ? 'Stop loop' : 'Loop'; if (looping) playNotebook(true); else { clearTimers(); A.stopAll(); } }
    function transpose(d) {
      st.chords = st.chords.map(c => ({ root: mod(c.root + d), type: c.type, bass: c.bass != null ? mod(c.bass + d) : null, notes: c.notes ? c.notes.map(n => n + d) : null }));
      st.key = mod(st.key + d); saveSettings(); drawNotebook(); drawKeyCard(); drawPalette();
    }
    function addCurrent() {
      const top = detected.find(d => d.type);
      if (!top) { toast('Play at least three notes so a chord can be named.'); return; }
      st.chords.push({ root: top.root, type: top.type, bass: top.bass !== top.root ? top.bass : null, notes: [...capture].sort((a, b) => a - b) });
      saveSettings(); drawNotebook();
    }
    function guessKey() {
      nbKeys.innerHTML = '';
      const g = T.guessKeys(st.chords.filter(c => c.type));
      if (!g.length) { toast('Add some chords first.'); return; }
      nbKeys.append(h('span', { class: 'muted small' }, 'Likely keys: '), ...g.map((k, i) => h('button', { class: 'chip', 'aria-pressed': i === 0 ? 'true' : 'false', onclick: () => { st.key = k.tonic; st.minor = k.minor; saveSettings(); drawKeyCard(); drawNotebook(); drawPalette(); updateFinder(); } }, T.keyName(k.tonic, k.minor))));
    }
    function saveSong() {
      const name = songName.value.trim();
      if (!name) { songName.focus(); toast('Give the song a name first.'); return; }
      if (!st.chords.length) { toast('The notebook is empty.'); return; }
      const ex = st.songs.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
      const rec = { name, key: st.key, minor: st.minor, tempo: st.tempo, chords: st.chords.slice() };
      if (ex >= 0) st.songs[ex] = rec; else st.songs.unshift(rec);
      saveSettings(); drawSongs(); toast('Saved "' + name + '".');
    }

    // --- chord palette in key
    const paletteEl = h('div', { class: 'palette' });
    const paletteCard = h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Try chords in this key'), h('span', { class: 'muted small' }, 'Tap to hear. + adds to the notebook.')),
      paletteEl);
    function drawPalette() {
      paletteEl.innerHTML = '';
      const labels = st.minor ? ['i', 'ii°', '♭III', 'iv', 'v', 'V', '♭VI', '♭VII', 'V7', 'iv7', 'i7'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'V7', 'ii7', 'Imaj7', 'IVmaj7', '♭VII', 'iv', '♭VI', 'II', 'III'];
      labels.forEach(l => {
        const [o, type] = T.PROG[l]; const root = mod(st.key + o);
        const c = { root, type };
        paletteEl.append(h('div', { class: 'pal-item' },
          h('button', { class: 'pal-main', onclick: () => { const v = T.voice(root, type, null); capture = new Set(v.all); updateFinder(); A.stopAll(); A.chord(v.all, 0, 1.5, 0.58); } }, h('span', { class: 'pal-rn' }, l), h('span', { class: 'pal-name' }, T.chordIn(root, type, st.key, st.minor))),
          h('button', { class: 'pal-add', title: 'Add to notebook', 'aria-label': 'Add ' + l + ' to notebook', onclick: () => { st.chords.push(c); saveSettings(); drawNotebook(); A.chord(T.voice(root, type, null).all, 0, 1, 0.5); } }, '+')));
      });
    }

    // --- side: key, drone, library, method
    const keyCard = h('div');
    function drawKeyCard() {
      keyCard.innerHTML = '';
      const droneRoot = 36 + mod(st.key) + (mod(st.key) > 6 ? 0 : 12);
      keyCard.append(
        h('div', { class: 'row tight' },
          select('ws-key', [...Array(12)].map((_, i) => [i, T.pcName(i, T.usesFlats(i, st.minor))]), st.key, v => { st.key = +v; saveSettings(); restartDrone(); drawAll(); }),
          seg('ws-mode', [['maj', 'Major'], ['min', 'Minor']], st.minor ? 'min' : 'maj', v => { st.minor = v === 'min'; saveSettings(); drawAll(); })),
        toggle('ws-drone', 'Drone on the tonic', A.droneOn, v => A.drone(droneRoot, v)),
        h('p', { class: 'small muted' }, 'Play the song in another tab and switch the drone on. If the song feels at rest over it, you have the right key.'),
        field('Tempo', h('div', { class: 'range' }, h('input', { type: 'range', id: 'ws-tempo', min: 50, max: 160, value: st.tempo, oninput: e => { st.tempo = +e.target.value; e.target.nextSibling.textContent = st.tempo + ' bpm'; saveSettings(); } }), h('output', null, st.tempo + ' bpm'))));
    }
    function restartDrone() { if (A.droneOn) A.drone(36 + mod(st.key) + (mod(st.key) > 6 ? 0 : 12), true); }
    function drawAll() { drawKeyCard(); drawPalette(); drawNotebook(); updateFinder(); }

    const songsEl = h('div', { class: 'songs' });
    function drawSongs() {
      songsEl.innerHTML = '';
      if (!st.songs.length) { songsEl.append(h('p', { class: 'small muted' }, 'Saved songs appear here.')); return; }
      st.songs.forEach((sg, i) => songsEl.append(h('div', { class: 'song' },
        h('button', { class: 'song-main', onclick: () => { st.chords = sg.chords.slice(); st.key = sg.key; st.minor = sg.minor; st.tempo = sg.tempo || st.tempo; songName.value = sg.name; saveSettings(); drawAll(); } },
          h('span', { class: 'song-name' }, sg.name), h('span', { class: 'small muted' }, T.keyName(sg.key, sg.minor) + ' · ' + sg.chords.map(c => T.roman(c.root, c.type, sg.key)).join(' '))),
        h('button', { class: 'icon', title: 'Delete', 'aria-label': 'Delete ' + sg.name, onclick: () => { const old = st.songs.splice(i, 1)[0]; saveSettings(); drawSongs(); toast('Deleted "' + old.name + '".', { label: 'Undo', fn: () => { st.songs.splice(i, 0, old); saveSettings(); drawSongs(); } }); } }, '×'))));
    }

    const lib = h('div', { class: 'library' });
    T.COMMON_PROGRESSIONS.forEach(p => {
      lib.append(h('details', { class: 'lib-item' },
        h('summary', null, h('span', { class: 'lib-name' }, p.name), h('span', { class: 'lib-rn' }, p.rn.join(' '))),
        h('div', { class: 'lib-body' },
          h('p', { class: 'small' }, p.note),
          p.songs.length ? h('p', { class: 'small muted' }, 'Heard in: ' + p.songs.join('; ')) : null,
          h('div', { class: 'row tight' },
            btn('Hear it', () => {
              A.stopAll();
              const seq = p.rn.map(l => ({ root: mod(st.key + T.PROG[l][0]), type: T.PROG[l][1] }));
              const dur = 60 / st.tempo * 2;
              T.voiceSequence(seq).forEach((v, i) => A.chord(v.all, i * dur, dur * 0.97, 0.55));
            }, 'small'),
            btn('Load into notebook', () => {
              const old = st.chords.slice();
              st.chords = p.rn.map(l => ({ root: mod(st.key + T.PROG[l][0]), type: T.PROG[l][1] }));
              if (p.minor !== st.minor) st.minor = p.minor;
              saveSettings(); drawAll();
              toast('Loaded ' + p.name + '.', { label: 'Undo', fn: () => { st.chords = old; saveSettings(); drawNotebook(); } });
            }, 'small')))));
    });

    side.append(
      section('Song key', keyCard),
      section('Saved songs', songsEl),
      section('Common progressions', h('p', { class: 'small muted' }, 'Most songs reuse a handful of patterns. Learn to spot these by ear.'), lib),
      section('Working out a song', h('ol', { class: 'small list' },
        h('li', null, 'Find the tonic: hum the note the song keeps returning to, then find it on the piano. Check with the drone.'),
        h('li', null, 'Find the bass line, one note per chord. Sing it, then play it.'),
        h('li', null, 'For each bass note, try the chords in the palette until one matches. Major or minor?'),
        h('li', null, 'Add the chords to the notebook and loop them along with the recording.'),
        h('li', null, 'Compare the Roman numerals with the common progressions. Most songs use one of them.')))
    );
    stage.append(h('div', { class: 'ex' },
      h('div', { class: 'ex-head' }, h('h1', null, 'Song workshop'), h('p', { class: 'blurb' }, 'Tools for working out real songs at the piano: name any chord you play, try chords in a key, and write progressions down in Roman numerals.')),
      finder, paletteCard, notebook));
    drawAll(); drawSongs();
    if (!st.chords.length) {
      // open with a realistic example
      st.chords = ['I', 'V', 'vi', 'IV'].map(l => ({ root: mod(st.key + T.PROG[l][0]), type: T.PROG[l][1] }));
      drawNotebook();
    }

    return {
      onNote(m) { if (!gesture) { capture.clear(); gesture = true; } capture.add(m); updateFinder(); },
      onNoteOff() { if (Input.held.size === 0) gesture = false; },
      latchClick(m) {
        if (!st.latch) return false;
        if (capture.has(m)) capture.delete(m); else { capture.add(m); A.note(m, 0, 0.9, 0.65); }
        gesture = true; updateFinder(); return true;
      },
      replay: () => playNotebook(false),
      leave() { looping = false; A.drone(0, false); }
    };
  }

  // ===================================================================
  // MODE: Progress
  // ===================================================================
  const MODE_META = {
    intervals: { name: 'Intervals', label: id => (ivById(id) || {}).name || id },
    degrees: { name: 'Scale degrees', label: id => id + ' (' + ((degById(id) || {}).sol || '') + ')' },
    chords: { name: 'Chord qualities', label: id => (T.CHORDS[id] || {}).name || id },
    prog: { name: 'Progressions', label: id => id },
    melody: { name: 'Melody echo', label: id => 'Level ' + (+id.slice(1) + 1) }
  };
  function ProgressMode(stage, side) {
    const root = h('div', { class: 'ex progress' });
    function draw() {
      root.innerHTML = '';
      const d = Stats.d;
      const total = Object.values(d.modes).reduce((a, m) => a + m.a, 0);
      const correct = Object.values(d.modes).reduce((a, m) => a + m.c, 0);
      root.append(h('div', { class: 'ex-head' }, h('h1', null, 'Progress'), h('p', { class: 'blurb' }, 'Your history on this device. Weak spots come up more often in practice automatically.')));
      root.append(h('div', { class: 'session big' },
        stat('Today', (d.days[today()] || 0) + ' / ' + Settings.global.goal),
        stat('Day streak', streakDays()),
        stat('Answers', total),
        stat('Accuracy', total ? Math.round(100 * correct / total) + '%' : '—')));
      // 5-week calendar
      const cal = h('div', { class: 'cal' });
      const dd = new Date(); dd.setDate(dd.getDate() - 34);
      for (let i = 0; i < 35; i++) {
        const k = today(dd), n = d.days[k] || 0;
        const lvl = n === 0 ? 0 : n < 10 ? 1 : n < Settings.global.goal ? 2 : 3;
        cal.append(h('span', { class: 'cal-d', 'data-l': lvl, title: k + ': ' + n + ' answers' }));
        dd.setDate(dd.getDate() + 1);
      }
      root.append(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Last five weeks'), h('span', { class: 'small muted' }, 'Darker squares mean more practice; the darkest hit your daily goal.')), cal));

      const grid = h('div', { class: 'mode-grid' });
      Object.entries(MODE_META).forEach(([id, meta]) => {
        const m = d.modes[id] || { a: 0, c: 0 };
        const items = Object.entries(d.items).filter(([k]) => k.startsWith(id + ':')).map(([k, v]) => ({ id: k.slice(id.length + 1), ...v, acc: v.c / v.a }));
        items.sort((a, b) => a.acc - b.acc || b.a - a.a);
        const card = h('section', { class: 'card mode-card' },
          h('div', { class: 'card-head' }, h('h2', null, meta.name), h('span', { class: 'mc-acc' }, m.a ? Math.round(100 * m.c / m.a) + '%' : '—')),
          h('p', { class: 'small muted' }, m.a ? m.a + ' answers' : 'Not practised yet'));
        if (items.length) {
          const bars = h('div', { class: 'bars' });
          items.slice(0, 8).forEach(it => bars.append(h('div', { class: 'bar-row' },
            h('span', { class: 'bar-l' }, meta.label(it.id)),
            h('span', { class: 'bar' }, h('span', { class: 'bar-f', style: { width: Math.round(it.acc * 100) + '%' }, 'data-q': it.acc >= 0.85 ? 'good' : it.acc >= 0.6 ? 'mid' : 'low' })),
            h('span', { class: 'bar-v' }, Math.round(it.acc * 100) + '% · ' + it.a))));
          card.append(h('p', { class: 'small' }, 'Weakest first:'), bars);
        }
        card.append(btn('Practise', () => go(id), 'small'));
        grid.append(card);
      });
      root.append(grid);
    }
    const resetWrap = h('div');
    function drawReset(confirming) {
      resetWrap.innerHTML = '';
      if (!confirming) resetWrap.append(btn('Reset all progress', () => drawReset(true), 'small'));
      else resetWrap.append(h('p', { class: 'small' }, 'This deletes every answer recorded on this device.'), h('div', { class: 'row tight' }, btn('Delete history', () => { Stats.reset(); draw(); drawReset(false); toast('Progress reset.'); }, 'small danger'), btn('Cancel', () => drawReset(false), 'small')));
    }
    drawReset(false);
    side.append(
      section('Daily goal', field('Answers per day', select('goal', [[20, '20'], [40, '40'], [60, '60'], [100, '100']], Settings.global.goal, v => { Settings.global.goal = +v; saveSettings(); updateGoal(); draw(); }))),
      section('Suggested route', h('ol', { class: 'small list' },
        h('li', null, 'Scale degrees Level 1–3 and Intervals Level 1–3 side by side.'),
        h('li', null, 'Chord qualities to Level 2, then Progressions Level 1–2.'),
        h('li', null, 'Melody echo daily for a few minutes. It ties ear and hands together.'),
        h('li', null, 'Move up a level when you hold 85% or better over 20 answers. The app will offer it.'),
        h('li', null, 'Once Progressions Level 4 feels easy, start working out real songs in the Song workshop.'))),
      section('Data', h('p', { class: 'small muted' }, 'Progress is stored in this browser only.'), resetWrap));
    stage.append(root);
    draw();
    return {};
  }

  // ---------- app shell ----------
  const MODES = [
    ['intervals', 'Intervals', IntervalsMode],
    ['degrees', 'Scale degrees', DegreesMode],
    ['chords', 'Chords', ChordsMode],
    ['prog', 'Progressions', ProgMode],
    ['melody', 'Melody echo', MelodyMode],
    ['workshop', 'Song workshop', WorkshopMode],
    ['progress', 'Progress', ProgressMode]
  ];
  let current = null, currentId = null;

  function go(id, fromHash) {
    const entry = MODES.find(m => m[0] === id) || MODES[0];
    if (current && current.leave) current.leave();
    clearTimers(); A.stopAll(); KB.clearMarks();
    [...Input.held.keys()].forEach(m => Input.off(m));
    currentId = entry[0];
    const stage = $('#stage'), side = $('#side');
    stage.innerHTML = ''; side.innerHTML = '';
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.id === currentId ? 'true' : 'false'));
    $('#kbWrap').hidden = currentId === 'progress';
    current = entry[2](stage, side) || {};
    if (!fromHash) { try { history.replaceState(null, '', '#' + currentId); } catch (e) { } }
    const tab = document.querySelector('.tab[data-id="' + currentId + '"]'); if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function buildChrome() {
    const tabs = $('#tabs');
    MODES.forEach(([id, label]) => tabs.append(h('button', { class: 'tab', role: 'tab', 'data-id': id, onclick: () => { A.init(); go(id); } }, label)));
    $('#midiBtn').addEventListener('click', () => Midi.connect(true));
    const panel = $('#soundPanel');
    $('#soundBtn').addEventListener('click', e => {
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      panel.style.top = Math.max(8, r.bottom + 8) + 'px';
      panel.hidden = !panel.hidden;
    });
    document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target) && e.target.id !== 'soundBtn') panel.hidden = true; });
    const g = Settings.global;
    const sampleNote = h('p', { class: 'small muted', id: 'sampleState' });
    panel.append(
      h('h3', null, 'Sound'),
      field('Volume', h('div', { class: 'range' }, h('input', { type: 'range', id: 'vol', min: 0, max: 1, step: 0.01, value: g.volume, oninput: e => { g.volume = +e.target.value; A.setVolume(g.volume); saveSettings(); } }))),
      toggle('samples', 'Recorded grand piano (downloads about 4 MB)', g.samples, v => { g.samples = v; A.setUseSamples(v); saveSettings(); }),
      sampleNote,
      toggle('echo', 'Play sound for MIDI keyboard input', g.midiEcho, v => { g.midiEcho = v; saveSettings(); }),
      h('p', { class: 'small muted' }, 'Leave this off if your digital piano makes its own sound.'),
      h('h3', null, 'Keyboard'),
      field('Key labels', seg('labels', [['c', 'C only'], ['all', 'All white keys'], ['none', 'None']], g.labels, v => { g.labels = v; saveSettings(); $('#keyboard').dataset.labels = v; })),
      h('p', { class: 'small muted' }, 'Computer keys: A W S E D F T G Y H U J K play from middle C. Z and X shift the octave.'),
      btn('Test sound', () => { A.init(); A.chord([48, 60, 64, 67, 72], 0, 2, 0.6); }, 'small'));
    const showState = s => {
      sampleNote.textContent = s === 'loading' ? 'Loading piano samples…' : s === 'ready' ? 'Recorded piano loaded.' : s === 'failed' ? 'Couldn\'t download the samples, so the built-in synth piano is playing instead.' : s === 'off' ? 'Using the built-in synth piano.' : 'Samples load when you first play a sound.';
      $('#soundBtn').dataset.state = s;
    };
    A.onSampleState(showState); showState(A.sampleState);
    A.volume = g.volume; A.useSamples = g.samples;
    document.addEventListener('pointerdown', () => A.init(), { once: true });
    document.addEventListener('keydown', () => A.init(), { once: true });
    KB.render();
    updateGoal();
    Midi.connect(false);
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== currentId) go(id, true); });
    const start = location.hash.slice(1);
    go(MODES.some(m => m[0] === start) ? start : 'intervals', true);
    requestAnimationFrame(() => KB.scrollTo(62));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildChrome); else buildChrome();

  // Offline support + "Install app" on Android/desktop Chrome (needs http(s), not file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
