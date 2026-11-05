/* Ear Bench — piano audio engine (sampled grand piano with a synthesized fallback) */
(function () {
  'use strict';

  const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
  // Salamander Grand Piano samples are recorded every minor third
  const SAMPLE_NOTES = [];
  for (let oct = 1; oct <= 7; oct++) {
    [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]].forEach(([n, pc]) => {
      const midi = (oct + 1) * 12 + pc;
      if (midi >= 24 && midi <= 96) SAMPLE_NOTES.push({ midi, file: n + oct + '.mp3' });
    });
  }

  let ctx = null, master, comp, wet, dry, convolver;
  const buffers = new Map();
  let sampleState = 'idle'; // idle | loading | ready | failed | off
  const voices = new Set();
  let drone = null;
  const listeners = [];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = Audio.volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    dry = ctx.createGain(); dry.gain.value = 1;
    wet = ctx.createGain(); wet.gain.value = 0.16;
    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(2.2, 2.8);
    dry.connect(comp); wet.connect(convolver); convolver.connect(comp);
    comp.connect(master); master.connect(ctx.destination);
    if (Audio.useSamples) loadSamples();
    return ctx;
  }

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function setState(s) { sampleState = s; listeners.forEach(f => f(s)); }

  async function loadSamples() {
    if (sampleState === 'loading' || sampleState === 'ready') return;
    setState('loading');
    let ok = 0;
    // load middle range first so playback improves quickly
    const order = SAMPLE_NOTES.slice().sort((a, b) => Math.abs(a.midi - 60) - Math.abs(b.midi - 60));
    await Promise.all(order.map(async s => {
      try {
        const res = await fetch(SAMPLE_BASE + s.file);
        if (!res.ok) throw new Error(res.status);
        const arr = await res.arrayBuffer();
        const buf = await new Promise((resolve, reject) => ctx.decodeAudioData(arr, resolve, reject));
        buffers.set(s.midi, buf); ok++;
      } catch (e) { /* ignore single failures */ }
    }));
    setState(ok >= SAMPLE_NOTES.length * 0.6 ? 'ready' : 'failed');
  }

  function nearestSample(midi) {
    let best = null, bd = 99;
    for (const [m, buf] of buffers) { const d = Math.abs(m - midi); if (d < bd) { bd = d; best = { m, buf }; } }
    return bd <= 3 ? best : null;
  }

  // ---- voices ----
  function sampleVoice(midi, t, vel) {
    const s = nearestSample(midi);
    if (!s) return null;
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (midi - s.m) / 12);
    const g = ctx.createGain();
    const amp = 0.25 + vel * 0.75;
    g.gain.setValueAtTime(amp, t);
    src.connect(g); g.connect(dry); g.connect(wet);
    src.start(t);
    const v = { g, nodes: [src], end: t + s.buf.duration };
    src.onended = () => voices.delete(v);
    return v;
  }

  function synthVoice(midi, t, vel) {
    const f = Theory.freq(midi);
    const out = ctx.createGain();
    out.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    const bright = Math.min(16000, f * (6 + vel * 8) + 1200);
    filt.frequency.setValueAtTime(bright, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 400), t + 2.2);
    filt.Q.value = 0.4;
    out.connect(filt); filt.connect(dry); filt.connect(wet);

    const base = Math.max(0.9, Math.min(5.5, 4.2 - (midi - 48) * 0.06));
    const partials = [[1, 1], [2, 0.55], [3, 0.28], [4, 0.16], [5, 0.09], [6, 0.06], [7, 0.03]];
    const B = 0.00035;
    const nodes = [];
    const peak = 0.13 * (0.35 + vel * 0.65) * (midi > 84 ? 0.8 : 1);
    partials.forEach(([n, a]) => {
      const fn = n * f * Math.sqrt(1 + B * n * n);
      if (fn > 18000) return;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fn;
      o.detune.value = (Math.random() - 0.5) * 4;
      const g = ctx.createGain();
      const tau = base / Math.pow(n, 0.75);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(a * peak * 0.45, t + 0.08);
      g.gain.setTargetAtTime(0.00001, t + 0.08, tau / 3);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + base * 2.2);
      nodes.push(o);
    });
    // hammer thump
    const nlen = Math.floor(ctx.sampleRate * 0.03);
    const nb = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nlen, 3);
    const ns = ctx.createBufferSource(); ns.buffer = nb;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 3, 5000); bp.Q.value = 1.2;
    const ng = ctx.createGain(); ng.gain.value = 0.05 * vel;
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t);
    nodes.push(ns);
    out.gain.setValueAtTime(1, t);
    const v = { g: out, nodes, end: t + base * 2.2 };
    nodes[0].onended = () => voices.delete(v);
    return v;
  }

  function release(v, at, time = 0.12) {
    if (!v || v.released) return;
    v.released = true;
    const t = Math.max(at, ctx.currentTime);
    try {
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value || 0.0001, t);
      v.g.gain.setTargetAtTime(0, t, time);
      v.nodes.forEach(n => { try { n.stop(t + time * 6); } catch (e) { } });
    } catch (e) { }
  }

  const Audio = {
    volume: 0.8,
    useSamples: true,
    get sampleState() { return sampleState; },
    onSampleState(fn) { listeners.push(fn); },
    init: ensure,
    now() { ensure(); return ctx.currentTime; },
    setVolume(v) { Audio.volume = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    setUseSamples(on) {
      Audio.useSamples = on;
      if (on && ctx) loadSamples();
      if (!on) setState('off'); else if (buffers.size) setState('ready');
    },
    /** Play a note. dur in seconds (null = until noteOff). Returns voice handle. */
    note(midi, when = 0, dur = 1.2, vel = 0.7) {
      ensure();
      const t = ctx.currentTime + Math.max(0, when) + 0.01;
      let v = null;
      if (Audio.useSamples && buffers.size) v = sampleVoice(midi, t, vel);
      if (!v) v = synthVoice(midi, t, vel);
      v.midi = midi;
      voices.add(v);
      if (dur != null) release(v, t + dur, 0.18);
      return v;
    },
    chord(midis, when = 0, dur = 1.6, vel = 0.62, spread = 0.012) {
      return midis.map((m, i) => Audio.note(m, when + i * spread, dur, vel * (i === 0 ? 1.05 : 1)));
    },
    noteOff(v) { if (v) release(v, ctx.currentTime, 0.1); },
    stopAll() {
      if (!ctx) return;
      for (const v of voices) release(v, ctx.currentTime, 0.05);
      voices.clear();
    },
    drone(midiRoot, on) {
      ensure();
      if (drone) {
        const d = drone; drone = null;
        d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        d.oscs.forEach(o => o.stop(ctx.currentTime + 2));
      }
      if (!on) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      g.connect(lp); lp.connect(dry); lp.connect(wet);
      const oscs = [];
      [[midiRoot, 0.5, 'triangle'], [midiRoot + 7, 0.22, 'sine'], [midiRoot + 12, 0.18, 'sine']].forEach(([m, a, type]) => {
        [-3, 3].forEach(det => {
          const o = ctx.createOscillator(); o.type = type; o.frequency.value = Theory.freq(m); o.detune.value = det;
          const og = ctx.createGain(); og.gain.value = a * 0.12;
          o.connect(og); og.connect(g); o.start(); oscs.push(o);
        });
      });
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      drone = { g, oscs, root: midiRoot };
    },
    get droneOn() { return !!drone; }
  };

  window.PianoAudio = Audio;
})();
