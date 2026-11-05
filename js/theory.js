/* Ear Bench — music theory helpers */
(function () {
  'use strict';

  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const mod = (n, m = 12) => ((n % m) + m) % m;
  const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb

  function usesFlats(tonic, minor) { return FLAT_MAJOR.has(minor ? mod(tonic + 3) : mod(tonic)); }
  function pcName(pc, flats) { return (flats ? FLAT : SHARP)[mod(pc)]; }
  function noteName(m, flats) { return pcName(m, flats) + (Math.floor(m / 12) - 1); }
  // Spell a pitch class inside a key: flatted degrees (♭2 ♭3 ♭6 ♭7) always use flats
  function spell(pc, tonic, minor) {
    const rel = mod(pc - tonic);
    return pcName(pc, usesFlats(tonic, minor) || [1, 3, 8, 10].includes(rel));
  }
  function chordIn(rootPc, type, tonic, minor, bassPc) {
    let n = spell(rootPc, tonic, minor) + CHORDS[type].sym;
    if (bassPc != null && mod(bassPc) !== mod(rootPc)) n += '/' + spell(bassPc, tonic, minor);
    return n;
  }
  function keyName(t, minor) { return pcName(t, usesFlats(t, minor)) + (minor ? ' minor' : ' major'); }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Ascending reference tunes (titles only) to anchor each interval
  const INTERVALS = [
    { s: 0, id: 'P1', name: 'Unison', song: '' },
    { s: 1, id: 'm2', name: 'Minor 2nd', song: 'Jaws theme' },
    { s: 2, id: 'M2', name: 'Major 2nd', song: 'Happy Birthday' },
    { s: 3, id: 'm3', name: 'Minor 3rd', song: 'Greensleeves' },
    { s: 4, id: 'M3', name: 'Major 3rd', song: 'When the Saints Go Marching In' },
    { s: 5, id: 'P4', name: 'Perfect 4th', song: 'Here Comes the Bride' },
    { s: 6, id: 'TT', name: 'Tritone', song: 'The Simpsons theme' },
    { s: 7, id: 'P5', name: 'Perfect 5th', song: 'Twinkle Twinkle Little Star' },
    { s: 8, id: 'm6', name: 'Minor 6th', song: 'The Entertainer (opening leap)' },
    { s: 9, id: 'M6', name: 'Major 6th', song: 'My Bonnie Lies Over the Ocean' },
    { s: 10, id: 'm7', name: 'Minor 7th', song: 'Somewhere (West Side Story)' },
    { s: 11, id: 'M7', name: 'Major 7th', song: 'Take On Me (chorus)' },
    { s: 12, id: 'P8', name: 'Octave', song: 'Somewhere Over the Rainbow' }
  ];
  const intervalBySemis = s => INTERVALS[mod(s, 13)] || INTERVALS[0];

  // rn: suffix used in Roman numerals; minor: lower-case numeral
  const CHORDS = {
    maj:   { iv: [0, 4, 7], name: 'Major', sym: '', rn: '', minor: false, rank: 0 },
    min:   { iv: [0, 3, 7], name: 'Minor', sym: 'm', rn: '', minor: true, rank: 0 },
    dim:   { iv: [0, 3, 6], name: 'Diminished', sym: 'dim', rn: '°', minor: true, rank: 1 },
    aug:   { iv: [0, 4, 8], name: 'Augmented', sym: 'aug', rn: '+', minor: false, rank: 1 },
    sus2:  { iv: [0, 2, 7], name: 'Sus 2', sym: 'sus2', rn: 'sus2', minor: false, rank: 1 },
    sus4:  { iv: [0, 5, 7], name: 'Sus 4', sym: 'sus4', rn: 'sus4', minor: false, rank: 1 },
    maj7:  { iv: [0, 4, 7, 11], name: 'Major 7th', sym: 'maj7', rn: 'maj7', minor: false, rank: 1 },
    dom7:  { iv: [0, 4, 7, 10], name: 'Dominant 7th', sym: '7', rn: '7', minor: false, rank: 1 },
    min7:  { iv: [0, 3, 7, 10], name: 'Minor 7th', sym: 'm7', rn: '7', minor: true, rank: 1 },
    m7b5:  { iv: [0, 3, 6, 10], name: 'Half-diminished', sym: 'm7♭5', rn: 'ø7', minor: true, rank: 2 },
    dim7:  { iv: [0, 3, 6, 9], name: 'Diminished 7th', sym: 'dim7', rn: '°7', minor: true, rank: 2 },
    mmaj7: { iv: [0, 3, 7, 11], name: 'Minor-major 7th', sym: 'm(maj7)', rn: '(maj7)', minor: true, rank: 3 },
    maj6:  { iv: [0, 4, 7, 9], name: 'Major 6th', sym: '6', rn: '6', minor: false, rank: 2 },
    min6:  { iv: [0, 3, 7, 9], name: 'Minor 6th', sym: 'm6', rn: '6', minor: true, rank: 2 },
    sus7:  { iv: [0, 5, 7, 10], name: '7sus4', sym: '7sus4', rn: '7sus4', minor: false, rank: 2 },
    add9:  { iv: [0, 4, 7, 14], name: 'Add 9', sym: 'add9', rn: 'add9', minor: false, rank: 2 },
    dom9:  { iv: [0, 4, 7, 10, 14], name: 'Dominant 9th', sym: '9', rn: '9', minor: false, rank: 3 },
    maj9:  { iv: [0, 4, 7, 11, 14], name: 'Major 9th', sym: 'maj9', rn: 'maj9', minor: false, rank: 3 },
    min9:  { iv: [0, 3, 7, 10, 14], name: 'Minor 9th', sym: 'm9', rn: '9', minor: true, rank: 3 }
  };

  const TONE_LABELS = { 0: 'R', 2: '9', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♯5', 9: '6', 10: '♭7', 11: '7', 14: '9' };

  function chordName(rootPc, type, flats, bassPc) {
    let n = pcName(rootPc, flats) + CHORDS[type].sym;
    if (bassPc != null && mod(bassPc) !== mod(rootPc)) n += '/' + pcName(bassPc, flats);
    return n;
  }

  // Chord detection from a set of MIDI notes
  function detectChord(midis, flats) {
    const notes = [...new Set(midis)].sort((a, b) => a - b);
    if (!notes.length) return [];
    const pcs = [...new Set(notes.map(n => mod(n)))];
    const bass = mod(notes[0]);
    if (pcs.length === 1) return [{ name: pcName(bass, flats), root: bass, type: null, score: 0 }];
    if (pcs.length === 2) {
      const iv = intervalBySemis(mod(pcs[1] - pcs[0]));
      const s = mod(notes[notes.length - 1] - notes[0]);
      return [{ name: pcName(bass, flats) + ' + ' + intervalBySemis(s).name.toLowerCase(), root: bass, type: null, score: 0, interval: iv }];
    }
    const res = [];
    const pcset = new Set(pcs);
    for (const root of pcs) {
      const rel = new Set(pcs.map(p => mod(p - root)));
      for (const [type, c] of Object.entries(CHORDS)) {
        const tpl = new Set(c.iv.map(i => mod(i)));
        let score = -1;
        if (sameSet(rel, tpl)) score = 10 - c.rank;
        else if (tpl.has(7) && tpl.size >= 4) {
          const no5 = new Set([...tpl].filter(x => x !== 7));
          if (sameSet(rel, no5)) score = 6 - c.rank;
        }
        if (score < 0) continue;
        if (root === bass) score += 5;
        res.push({ name: chordName(root, type, flats, bass), root, type, score, bass });
      }
    }
    void pcset;
    res.sort((a, b) => b.score - a.score);
    return res;
  }
  function sameSet(a, b) { if (a.size !== b.size) return false; for (const x of a) if (!b.has(x)) return false; return true; }

  const RN = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  function roman(rootPc, type, tonic) {
    let r = RN[mod(rootPc - tonic)];
    const c = CHORDS[type];
    if (!c) return r;
    if (c.minor) r = r.replace(/[IV]+/, x => x.toLowerCase());
    return r + c.rn;
  }

  // Progression vocabulary: label -> [offset from tonic, type, function]
  // Functions: T tonic, P predominant, D dominant, S secondary dominant
  const PROG = {
    'I': [0, 'maj', 'T'], 'ii': [2, 'min', 'P'], 'iii': [4, 'min', 'T'], 'IV': [5, 'maj', 'P'],
    'V': [7, 'maj', 'D'], 'vi': [9, 'min', 'T'], 'vii°': [11, 'dim', 'D'],
    'V7': [7, 'dom7', 'D'], 'ii7': [2, 'min7', 'P'], 'Imaj7': [0, 'maj7', 'T'], 'IVmaj7': [5, 'maj7', 'P'], 'vi7': [9, 'min7', 'T'],
    '♭VII': [10, 'maj', 'P'], 'iv': [5, 'min', 'P'], '♭VI': [8, 'maj', 'P'], '♭III': [3, 'maj', 'T'],
    'II': [2, 'maj', 'S'], 'III': [4, 'maj', 'S'],
    'i': [0, 'min', 'T'], 'ii°': [2, 'dim', 'P'], 'v': [7, 'min', 'D'], 'i7': [0, 'min7', 'T'], 'iv7': [5, 'min7', 'P']
  };

  const PROG_LEVELS = {
    major: [
      { name: 'I · IV · V', pool: ['I', 'IV', 'V'] },
      { name: '+ vi', pool: ['I', 'IV', 'V', 'vi'] },
      { name: '+ ii', pool: ['I', 'ii', 'IV', 'V', 'vi'] },
      { name: 'All diatonic triads', pool: ['I', 'ii', 'iii', 'IV', 'V', 'vi'] },
      { name: '+ sevenths', pool: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'V7', 'ii7', 'Imaj7', 'IVmaj7'] },
      { name: '+ borrowed (♭VII iv ♭VI)', pool: ['I', 'ii', 'IV', 'V', 'vi', '♭VII', 'iv', '♭VI'] },
      { name: '+ secondary dominants', pool: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'II', 'III', '♭VII', 'iv', 'vii°'] }
    ],
    minor: [
      { name: 'i · iv · V', pool: ['i', 'iv', 'V'] },
      { name: '+ ♭VI · v', pool: ['i', 'iv', 'v', 'V', '♭VI'] },
      { name: '+ ♭III · ♭VII', pool: ['i', 'iv', 'V', '♭VI', '♭VII', '♭III'] },
      { name: 'Full minor', pool: ['i', 'ii°', '♭III', 'iv', 'v', 'V', '♭VI', '♭VII'] },
      { name: '+ sevenths', pool: ['i', 'iv', 'V', '♭VI', '♭VII', '♭III', 'i7', 'iv7', 'V7'] }
    ]
  };

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

  const DEGREES = [
    { s: 0, id: '1', sol: 'Do' }, { s: 1, id: '♭2', sol: 'Ra' }, { s: 2, id: '2', sol: 'Re' },
    { s: 3, id: '♭3', sol: 'Me' }, { s: 4, id: '3', sol: 'Mi' }, { s: 5, id: '4', sol: 'Fa' },
    { s: 6, id: '♯4', sol: 'Fi' }, { s: 7, id: '5', sol: 'Sol' }, { s: 8, id: '♭6', sol: 'Le' },
    { s: 9, id: '6', sol: 'La' }, { s: 10, id: '♭7', sol: 'Te' }, { s: 11, id: '7', sol: 'Ti' }
  ];

  function chordPcs(rootPc, type) { return CHORDS[type].iv.map(i => mod(rootPc + i)); }

  // Piano-style voicing: left-hand bass root + right-hand close voicing with smooth voice leading
  function voice(rootPc, type, prev) {
    let iv = CHORDS[type].iv.slice();
    if (iv.length > 4) iv = iv.filter(i => i !== 7); // drop the 5th on 9ths
    const pcs = iv.map(i => mod(rootPc + i));
    const cands = [];
    for (let start = 55; start <= 67; start++) {
      if (!pcs.includes(mod(start))) continue;
      const k = pcs.indexOf(mod(start));
      const order = pcs.slice(k).concat(pcs.slice(0, k));
      const stack = [start];
      for (let j = 1; j < order.length; j++) {
        let n = stack[j - 1] + 1;
        while (mod(n) !== order[j]) n++;
        stack.push(n);
      }
      if (stack[stack.length - 1] <= 79) cands.push(stack);
    }
    let best = cands[0], bestScore = Infinity;
    for (const c of cands) {
      let score;
      if (prev && prev.rh && prev.rh.length) {
        score = 0;
        for (const n of c) score += Math.min(...prev.rh.map(p => Math.abs(p - n)));
        score += Math.abs(c.length - prev.rh.length) * 2;
      } else {
        const mid = c.reduce((a, b) => a + b, 0) / c.length;
        score = Math.abs(mid - 65);
      }
      if (score < bestScore) { bestScore = score; best = c; }
    }
    // bass between E2 (40) and D#3 (51), nearest to previous bass
    const bassOpts = [];
    for (let n = 40; n <= 51; n++) if (mod(n) === mod(rootPc)) bassOpts.push(n);
    const target = prev && prev.bass ? prev.bass : 45;
    const bass = bassOpts.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    return { bass, rh: best, all: [bass].concat(best) };
  }

  function voiceSequence(chords /* [{root,type}] */) {
    let prev = null;
    return chords.map(c => (prev = voice(c.root, c.type, prev)));
  }

  // Weighted random progression following functional harmony
  const TRANS = {
    T: { T: 1, P: 3, D: 2, S: 1 },
    P: { T: 1.2, P: 1.4, D: 3.2, S: 0.6 },
    D: { T: 4, P: 0.4, D: 0.4, S: 0.3 },
    S: { T: 0.4, P: 0.6, D: 0.6, S: 0.1 }
  };
  function makeProgression(pool, length, minor, startOnTonic, weightFn) {
    const tonic = minor ? 'i' : 'I';
    const seq = [];
    for (let i = 0; i < length; i++) {
      if (i === 0 && startOnTonic && pool.includes(tonic)) { seq.push(tonic); continue; }
      const prev = seq[i - 1];
      const opts = pool.filter(l => l !== prev);
      const weights = opts.map(l => {
        let w = 1;
        if (prev) {
          const pf = PROG[prev][2], nf = PROG[l][2];
          w = TRANS[pf][nf];
          if (prev === 'II' && (l === 'V' || l === 'V7')) w = 6;
          if (prev === 'III' && l === 'vi') w = 6;
          if (pf === 'S' && !(l === 'V' || l === 'V7' || l === 'vi')) w *= 0.3;
        }
        if (i === length - 1 && (l === tonic || PROG[l][2] === 'D')) w *= 1.6;
        if (weightFn) w *= weightFn(l);
        return w;
      });
      seq.push(weightedPick(opts, weights));
    }
    return seq;
  }

  function weightedPick(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  // Guess the most likely keys for a list of chords [{root,type}]
  function guessKeys(chords) {
    if (!chords.length) return [];
    const out = [];
    for (let t = 0; t < 12; t++) {
      for (const minor of [false, true]) {
        const scale = new Set((minor ? MINOR_SCALE.concat([11]) : MAJOR_SCALE).map(s => mod(t + s)));
        let score = 0;
        chords.forEach((c, i) => {
          if (!c.type) return;
          const pcs = chordPcs(c.root, c.type);
          const inside = pcs.filter(p => scale.has(p)).length;
          if (inside === pcs.length) score += 2; else if (scale.has(c.root)) score += 0.6; else score -= 1;
          const isTonic = c.root === t && CHORDS[c.type].minor === minor;
          if (isTonic) score += (i === 0 || i === chords.length - 1) ? 1.6 : 0.6;
        });
        if (minor) score -= 0.1;
        out.push({ tonic: t, minor, score });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  const COMMON_PROGRESSIONS = [
    { name: 'The pop axis', rn: ['I', 'V', 'vi', 'IV'], minor: false, songs: ['Let It Be — The Beatles', 'With or Without You — U2', 'Don\'t Stop Believin\' — Journey'], note: 'The most common loop in modern pop. Listen for the bass stepping down from V to vi.' },
    { name: 'Axis, starting on vi', rn: ['vi', 'IV', 'I', 'V'], minor: false, songs: ['Zombie — The Cranberries'], note: 'Same four chords as the pop axis, rotated so the loop feels minor.' },
    { name: '50s doo-wop', rn: ['I', 'vi', 'IV', 'V'], minor: false, songs: ['Stand By Me — Ben E. King', 'Every Breath You Take — The Police'], note: 'Bass moves down a third, then steps up to V.' },
    { name: 'Jazz ii–V–I', rn: ['ii7', 'V7', 'Imaj7', 'Imaj7'], minor: false, songs: ['Autumn Leaves', 'Fly Me to the Moon'], note: 'The basic jazz cadence. Bass falls in fifths: 2 → 5 → 1.' },
    { name: 'Three-chord rock', rn: ['I', 'IV', 'I', 'V'], minor: false, songs: ['Johnny B. Goode — Chuck Berry (12-bar blues)'], note: 'Primary chords only. Train these until they are instant.' },
    { name: 'Mixolydian ♭VII', rn: ['I', '♭VII', 'IV', 'I'], minor: false, songs: ['Sweet Child O\' Mine — Guns N\' Roses', 'Hey Jude — The Beatles (outro)'], note: 'A major chord a whole step below the tonic gives a rock, modal sound.' },
    { name: 'Minor plagal (borrowed iv)', rn: ['I', 'III', 'IV', 'iv'], minor: false, songs: ['Creep — Radiohead'], note: 'III is a secondary dominant; IV turning to iv is the bittersweet moment.' },
    { name: 'Andalusian cadence', rn: ['i', '♭VII', '♭VI', 'V'], minor: true, songs: ['Hit the Road Jack — Ray Charles'], note: 'Bass walks down 1 → ♭7 → ♭6 → 5. Common in flamenco and surf rock.' },
    { name: 'Epic minor', rn: ['i', '♭VI', '♭III', '♭VII'], minor: true, songs: [], note: 'A staple of film and modern pop. All four chords are major except the tonic.' },
    { name: 'Pachelbel\'s Canon', rn: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], minor: false, songs: ['Canon in D — Pachelbel', 'Basket Case — Green Day (verse)'], note: 'Bass descends stepwise across the first half of the loop.' }
  ];

  window.Theory = {
    mod, pcName, noteName, keyName, spell, chordIn, usesFlats, freq,
    INTERVALS, intervalBySemis, CHORDS, TONE_LABELS, chordName, detectChord, roman,
    PROG, PROG_LEVELS, MAJOR_SCALE, MINOR_SCALE, DEGREES, chordPcs, voice, voiceSequence,
    makeProgression, weightedPick, guessKeys, COMMON_PROGRESSIONS
  };
})();
