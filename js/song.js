// Song data model, mood presets, generators, variations and undo history.
window.CC = window.CC || {};
(function (CC) {
  const T = CC.theory;
  let idCounter = Date.now() % 100000;
  const uid = (p) => p + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 5);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const COLORS = ['#d9a35a', '#4f9c9a', '#95c623', '#ec7a45', '#a6c4bf', '#c9b48a', '#6fb0b0', '#d98a6a', '#8fb8a8', '#b8c48a', '#e0c9a0', '#9ab0a0'];
  // Track colors from earlier versions, swapped for the calmer palette at the same position
  // Section colors (also shown in the song order and on the waveform). Sections without a chosen color use these in order.
  const SECTION_COLORS = ['#e0a458', '#95c623', '#ec7a45', '#c9b48a', '#d98a6a', '#b8c48a', '#4f9c9a', '#6fb0b0'];
  function secColor(song, sec) { return sec.color || SECTION_COLORS[Math.max(0, song.sections.indexOf(sec)) % SECTION_COLORS.length]; }
  const OLD_COLORS = [['#e0a24a', '#7a9cc6', '#7fae84', '#c7889a', '#a796c9', '#c9b48a', '#6fb0b0', '#d98a6a', '#8fa8d9', '#b8c48a', '#c9a0b8', '#9ab0a0'],
    ['#ff8a4c', '#ffc94d', '#7bd389', '#5ec8e5', '#9c8cff', '#ff6fa8', '#f2f2a0', '#6fe0c0', '#c39bff', '#ff9e7a', '#8fb4ff', '#e8c07a'],
    ['#ff7a3a', '#e8b04a', '#9cbf5f', '#7fbfcf', '#c99a6a', '#e8665a', '#efd9a0', '#7fc9a8', '#c98bd9', '#ff9e7a', '#8fa8d9', '#d9b87a']];

  // Seeded random so presets are repeatable
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function newSong(name = 'My song') {
    const sec = newSection('Main loop', 4, 'calm');
    return {
      version: 1, name, bpm: 110, swing: 0, key: 'C', scale: 'major', stayInKey: true,
      layersFollowMood: false, masterVolume: 0.85,
      tracks: [], sections: [sec], arrangement: [sec.id],
      states: { exploration: { section: sec.id, once: false }, alert: { section: sec.id, once: false }, combat: { section: sec.id, once: false }, victory: { section: sec.id, once: true } },
      samples: {}
    };
  }
  function newSection(name, bars = 4, mood = 'calm') {
    return { id: uid('s'), name, bars, mood, clips: {}, clipsB: null, showing: 'A' };
  }
  function newTrack(song, instrumentId, name) {
    const info = CC.instruments.info(instrumentId);
    const kind = instrumentId.startsWith('kit:') ? 'drums' : 'melody';
    const t = {
      id: uid('t'), name: name || (info ? info.name : 'Instrument'), kind, instrument: instrumentId,
      volume: kind === 'drums' ? 0.85 : 0.75, pan: 0, mute: false, solo: false, layer: 1,
      fx: { space: kind === 'drums' ? 0.05 : 0.18, echo: 0, tone: 1 },
      octave: (info && info.octave) || 4, color: COLORS[(song ? song.tracks.length : 0) % COLORS.length],
      view: kind === 'drums' ? 'pads' : (info && info.view) || 'piano', rowSamples: {}
    };
    if (instrumentId.startsWith('synth:')) t.synth = CC.instruments.defaultSynthParams(instrumentId);
    return t;
  }
  function activeClips(sec) { return sec.showing === 'B' && sec.clipsB ? sec.clipsB : sec.clips; }
  function clipOf(sec, trackId, create = true) {
    const c = activeClips(sec);
    if (!c[trackId] && create) c[trackId] = [];
    return c[trackId] || [];
  }

  // ---------- Pattern generators ----------
  // Drum rows: kick0 snare1 clap2 hat3 openhat4 tomlo5 tomhi6 crash7 rim8 shaker9 cowbell10
  const DRUM_STYLES = {
    basic:    { name: 'Simple rock beat', bar: { 0: [0, 8], 1: [4, 12], 3: [0, 2, 4, 6, 8, 10, 12, 14] } },
    four:     { name: 'Dance (four on the floor)', bar: { 0: [0, 4, 8, 12], 2: [4, 12], 4: [2, 6, 10, 14], 3: [0, 1, 3, 5, 7, 9, 11, 13, 15] } },
    chill:    { name: 'Chill hop', bar: { 0: [0, 7, 10], 1: [4, 12], 3: [0, 2, 4, 6, 8, 10, 12, 14], 9: [3, 11] } },
    march:    { name: 'Marching drums', bar: { 0: [0, 8], 1: [4, 12, 14, 15], 3: [0, 4, 8, 12], 8: [2, 6, 10] } },
    boss:     { name: 'Boss fight (driving)', bar: { 0: [0, 3, 6, 8, 10, 11, 14], 1: [4, 12], 3: [0, 2, 4, 6, 8, 10, 12, 14], 4: [14] } },
    halftime: { name: 'Half-time (heavy, slow)', bar: { 0: [0, 3], 1: [8], 3: [0, 2, 4, 6, 8, 10, 12, 14] } },
    sparse:   { name: 'Sparse and creepy', bar: { 0: [0], 8: [10], 5: [14], 9: [6] } },
    tribal:   { name: 'Tribal toms', bar: { 0: [0, 8], 5: [3, 6, 11, 14], 6: [10, 15], 9: [0, 2, 4, 6, 8, 10, 12, 14] } },
    chip:     { name: 'Retro arcade', bar: { 0: [0, 8, 10], 1: [4, 12], 3: [0, 2, 4, 6, 8, 10, 12, 14] } },
    shaker:   { name: 'Gentle shaker', bar: { 0: [0, 10], 9: [0, 2, 4, 6, 8, 10, 12, 14], 8: [12] } },
    fanfare:  { name: 'Fanfare roll', bar: { 1: [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15], 0: [0, 8], 7: [0] } }
  };
  function drumPattern(style, bars = 4, opts = {}) {
    const st = DRUM_STYLES[style] || DRUM_STYLES.basic;
    const notes = [];
    for (let b = 0; b < bars; b++) {
      for (const [row, steps] of Object.entries(st.bar)) {
        for (const s of steps) {
          const r = +row;
          let v = r === 3 ? (s % 4 === 0 ? 0.7 : 0.5) : r === 9 ? 0.5 : 0.85;
          if (r === 1 && style === 'fanfare') v = 0.45 + s / 40;
          notes.push({ s: b * 16 + s, p: r, l: 1, v });
        }
      }
    }
    if (opts.crash !== false && style !== 'sparse' && style !== 'shaker') notes.push({ s: 0, p: 7, l: 1, v: 0.6 });
    if (opts.fill) return VAR.addFill(notes, bars * 16);
    return notes;
  }

  function progChords(song, degrees) {
    const chords = T.diatonicChords(song.key, song.scale);
    return degrees.map(d => chords[d % 7]);
  }
  // style: pad | arp | stabs | bass | rootfifth | pulse8 | strum | power | ostinato
  function chordPart(song, degrees, bars, style, center = 60, seed = 1) {
    const chords = progChords(song, degrees);
    const notes = [];
    for (let b = 0; b < bars; b++) {
      const ch = chords[b % chords.length];
      const v = T.voiceChord(ch, center);
      const root = center - 12 + ((ch.rootPc - (center - 12)) % 12 + 12) % 12;
      const base = b * 16;
      switch (style) {
        case 'pad': v.forEach(p => notes.push({ s: base, p, l: 16, v: 0.6 })); break;
        case 'stabs': [0, 6, 12].forEach(s => v.forEach(p => notes.push({ s: base + s, p, l: 2, v: 0.7 }))); break;
        case 'strum': [0, 6, 10, 12].forEach((s, i) => v.forEach((p, k) => notes.push({ s: base + s, p, l: i === 0 ? 6 : 2, v: 0.65 - k * 0.05 }))); break;
        case 'arp': { const seq = [v[0], v[1], v[2], v[0] + 12, v[2], v[1], v[0], v[1]]; for (let i = 0; i < 8; i++) notes.push({ s: base + i * 2, p: seq[i], l: 2, v: i % 4 === 0 ? 0.75 : 0.6 }); break; }
        case 'arp16': { const seq = [v[0], v[1], v[2], v[0] + 12]; for (let i = 0; i < 16; i++) notes.push({ s: base + i, p: seq[i % 4], l: 1, v: i % 4 === 0 ? 0.7 : 0.5 }); break; }
        case 'ostinato': { const seq = [root, root + 7, root + 12, root + 7]; for (let i = 0; i < 8; i++) notes.push({ s: base + i * 2, p: seq[i % 4], l: 2, v: 0.6 }); break; }
        case 'bass': [[0, 6], [6, 2], [8, 6], [14, 2]].forEach(([s, l], i) => notes.push({ s: base + s, p: i === 3 ? root + 7 : root, l, v: 0.8 })); break;
        case 'rootfifth': notes.push({ s: base, p: root, l: 8, v: 0.8 }, { s: base + 8, p: root + 7 > center ? root - 5 : root + 7, l: 8, v: 0.7 }); break;
        case 'longroot': notes.push({ s: base, p: root, l: 16, v: 0.75 }); break;
        case 'pulse8': for (let i = 0; i < 8; i++) notes.push({ s: base + i * 2, p: i === 7 ? root + 12 : root, l: 1, v: i % 2 ? 0.6 : 0.85 }); break;
        case 'power': [0, 3, 6, 8, 10, 11, 14].forEach(s => [root, root + 7].forEach(p => notes.push({ s: base + s, p, l: 1, v: 0.8 }))); break;
        case 'oompah': [0, 8].forEach(s => notes.push({ s: base + s, p: s ? root + 7 - 12 * (root + 7 > center) : root, l: 4, v: 0.85 })); break;
        default: v.forEach(p => notes.push({ s: base, p, l: 16, v: 0.6 }));
      }
    }
    return notes;
  }

  // Simple melody generator over a chord progression
  const RHYTHMS = [
    [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 6], [6, 2], [8, 8]],
    [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
    [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
    [[2, 2], [4, 2], [6, 2], [8, 8]],
    [[0, 8], [10, 2], [12, 4]]
  ];
  function melody(song, degrees, bars, { center = 72, density = 0.6, seed = 7 } = {}) {
    const rand = rng(seed);
    const chords = progChords(song, degrees);
    const scale = T.scaleNotes(song.key, song.scale, center - 10, center + 12);
    const notes = [];
    let prev = T.snapToScale(center, song.key, song.scale);
    const motif = RHYTHMS[Math.floor(rand() * RHYTHMS.length)];
    for (let b = 0; b < bars; b++) {
      const ch = chords[b % chords.length];
      const chordPcs = ch.intervals.map(i => (ch.rootPc + i) % 12);
      let rhythm = (b % 2 === 0 || rand() < 0.4) ? motif : RHYTHMS[Math.floor(rand() * RHYTHMS.length)];
      if (density < 0.4) rhythm = rhythm.filter((_, i) => i % 2 === 0).map(([s, l]) => [s, Math.max(l, 4)]);
      if (b === bars - 1) rhythm = [[0, 4], [4, 4], [8, 8]];
      rhythm.forEach(([s, l], i) => {
        let target;
        const strong = s % 8 === 0;
        if (strong || i === 0) {
          const cands = scale.filter(m => chordPcs.includes(m % 12));
          target = cands.reduce((a, m) => Math.abs(m - prev) < Math.abs(a - prev) + (rand() < 0.3 ? 3 : 0) ? m : a, cands[0]);
        } else {
          const dir = rand() < 0.5 ? -1 : 1;
          target = T.stepInScale(prev, dir * (rand() < 0.75 ? 1 : 2), song.key, song.scale);
        }
        if (b === bars - 1 && i === rhythm.length - 1) {
          const roots = scale.filter(m => m % 12 === chords[0].rootPc);
          target = roots.reduce((a, m) => Math.abs(m - prev) < Math.abs(a - prev) ? m : a, roots[0] || target);
        }
        target = Math.max(scale[0], Math.min(scale[scale.length - 1], target));
        notes.push({ s: b * 16 + s, p: target, l, v: strong ? 0.85 : 0.7 });
        prev = target;
      });
    }
    return notes;
  }

  // ---------- Variations ----------
  const VAR = {
    addFill(notes, len) {
      const start = len - 4;
      const out = notes.filter(n => !(n.s >= start && [1, 3, 4, 5, 6].includes(n.p)));
      [[0, 1, 0.6], [1, 1, 0.65], [2, 6, 0.8], [3, 5, 0.9]].forEach(([o, p, v]) => out.push({ s: start + o, p, l: 1, v }));
      if (!out.some(n => n.s === 0 && n.p === 7)) out.push({ s: 0, p: 7, l: 1, v: 0.6 });
      return out;
    },
    drumsBusier(notes, len) {
      const out = clone(notes);
      const has = (s, p) => out.some(n => n.s === s && n.p === p);
      const hatSteps = out.filter(n => n.p === 3).map(n => n.s);
      const eighths = hatSteps.some(s => s % 2 === 0), sixteenths = hatSteps.some(s => s % 2 === 1);
      for (let s = 0; s < len; s++) {
        if (!eighths && s % 2 === 0 && !has(s, 3)) out.push({ s, p: 3, l: 1, v: s % 4 ? 0.45 : 0.6 });
        else if (eighths && !sixteenths && s % 2 === 1 && !has(s, 3)) out.push({ s, p: 3, l: 1, v: 0.35 });
      }
      for (let b = 0; b < len / 16; b++) {
        if (!has(b * 16 + 10, 0)) out.push({ s: b * 16 + 10, p: 0, l: 1, v: 0.75 });
        if (b % 2 === 1 && !has(b * 16 + 7, 1)) out.push({ s: b * 16 + 7, p: 1, l: 1, v: 0.3 });
      }
      return out;
    },
    drumsSimpler(notes) {
      return notes.filter(n => {
        if (n.p === 3 && n.s % 2 === 1) return false;
        if ((n.v || 0.8) < 0.4) return false;
        if (n.p === 0 && n.s % 4 !== 0) return false;
        if ([5, 6, 9, 10].includes(n.p) && n.s % 4 !== 0) return false;
        return true;
      });
    },
    newGroove(notes, len, seed = Date.now()) {
      const r = rng(seed);
      const kicks = [[0, 8], [0, 10], [0, 3, 8], [0, 6, 10], [0, 7, 8, 14], [0, 4, 8, 12], [0, 11]];
      const pat = kicks[Math.floor(r() * kicks.length)];
      const out = notes.filter(n => n.p !== 0);
      for (let b = 0; b < len / 16; b++) pat.forEach(s => out.push({ s: b * 16 + s, p: 0, l: 1, v: 0.85 }));
      return out;
    },
    halfTime(notes, len) { return notes.filter(n => n.s < len / 2).map(n => ({ ...n, s: n.s * 2, l: n.l * 2 })); },
    doubleTime(notes, len) { const h = notes.map(n => ({ ...n, s: Math.floor(n.s / 2), l: Math.max(1, Math.round(n.l / 2)) })); return dedupe(h.concat(h.map(n => ({ ...n, s: n.s + len / 2 })))); },
    intensify(notes, len, song) {
      const out = [];
      notes.forEach(n => {
        const v = Math.min(1, (n.v || 0.8) + 0.1);
        if (n.l >= 4) { for (let s = 0; s < n.l; s += 2) out.push({ s: n.s + s, p: n.p, l: 2, v: s ? v - 0.1 : v }); }
        else out.push({ ...n, v });
      });
      const sorted = out.sort((a, b) => a.s - b.s);
      const add = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i + 1];
        if (b.s - (a.s + a.l) >= 2 && Math.abs(b.p - a.p) > 2) add.push({ s: a.s + a.l, p: T.stepInScale(a.p, b.p > a.p ? 1 : -1, song.key, song.scale), l: 1, v: 0.6 });
      }
      return dedupe(sorted.concat(add)).filter(n => n.s < len);
    },
    calmer(notes) {
      const sorted = clone(notes).sort((a, b) => a.s - b.s);
      const kept = sorted.filter((n, i) => n.s % 4 === 0 || i % 2 === 0);
      kept.forEach((n, i) => {
        const next = kept.find((m, j) => j > i && m.s > n.s);
        if (next) n.l = Math.max(n.l, Math.min(8, next.s - n.s));
        n.v = Math.max(0.3, (n.v || 0.8) - 0.15);
      });
      return kept;
    },
    transposeScale(notes, steps, song) { return notes.map(n => ({ ...n, p: T.stepInScale(T.snapToScale(n.p, song.key, song.scale), steps, song.key, song.scale) })); },
    transpose(notes, semis) { return notes.map(n => ({ ...n, p: Math.max(0, Math.min(127, n.p + semis)) })); },
    harmony(notes, song) { return dedupe(notes.concat(notes.map(n => ({ ...n, p: T.stepInScale(T.snapToScale(n.p, song.key, song.scale), 2, song.key, song.scale), v: (n.v || 0.8) * 0.75 })))); },
    vary(notes, song, seed = Date.now()) {
      const r = rng(seed);
      const sorted = clone(notes).sort((a, b) => a.s - b.s);
      return sorted.map((n, i) => (i === 0 || i === sorted.length - 1 || r() > 0.35) ? n : { ...n, p: T.stepInScale(T.snapToScale(n.p, song.key, song.scale), (r() < 0.5 ? -1 : 1) * (r() < 0.7 ? 1 : 2), song.key, song.scale) });
    },
    reverse(notes, len) { return notes.map(n => ({ ...n, s: Math.max(0, len - n.s - n.l) })); },
    humanize(notes, seed = Date.now()) { const r = rng(seed); return notes.map(n => ({ ...n, v: Math.max(0.2, Math.min(1, (n.v || 0.8) + (r() - 0.5) * 0.25)) })); },
    echo(notes, len) {
      const out = clone(notes);
      notes.forEach(n => { const s = n.s + 3; if (s < len && !out.some(m => m.s === s && m.p === n.p)) out.push({ ...n, s, v: (n.v || 0.8) * 0.5 }); });
      return out;
    },
    arpeggiate(notes) {
      const byStep = {};
      notes.forEach(n => (byStep[n.s] = byStep[n.s] || []).push(n));
      const out = [];
      for (const group of Object.values(byStep)) {
        if (group.length < 2) { out.push(...group); continue; }
        const ps = group.map(n => n.p).sort((a, b) => a - b);
        const dur = Math.max(...group.map(n => n.l));
        const seq = ps.concat(ps.slice(1, -1).reverse());
        for (let i = 0; i * 2 < dur; i++) out.push({ s: group[0].s + i * 2, p: seq[i % seq.length], l: 2, v: group[0].v || 0.7 });
      }
      return out;
    },
    nudge(notes, d, len) { return notes.map(n => ({ ...n, s: ((n.s + d) % len + len) % len })); }
  };
  function dedupe(notes) { const seen = new Set(); return notes.filter(n => { const k = n.s + ':' + n.p; if (seen.has(k)) return false; seen.add(k); return true; }); }

  // ---------- Mood presets ----------
  const MOODS = {
    cozy: {
      name: 'Cozy town', emoji: '🏡', desc: 'Warm, gentle and a little bouncy.', bpm: 92, key: 'F', scale: 'major', swing: 0.35, prog: [0, 3, 0, 4],
      tracks: [['kit:lofi', 'Drums', { drums: 'chill' }], ['gm:acoustic_bass', 'Bass', { part: 'bass', center: 48 }], ['gm:electric_piano_1', 'Keys', { part: 'strum', center: 62 }], ['gm:clarinet', 'Melody', { melody: true, center: 70, density: 0.5 }], ['gm:glockenspiel', 'Sparkles', { part: 'arp', center: 82, layer: 2, vol: 0.4 }]]
    },
    dungeon: {
      name: 'Tense dungeon', emoji: '🕯️', desc: 'Dark, slow and suspenseful.', bpm: 76, key: 'D', scale: 'harmonicMinor', swing: 0, prog: [0, 0, 5, 4],
      tracks: [['kit:acoustic', 'Drums', { drums: 'sparse' }], ['gm:contrabass', 'Low strings', { part: 'longroot', center: 40 }], ['gm:pizzicato_strings', 'Sneaky plucks', { part: 'ostinato', center: 52 }], ['gm:music_box', 'Melody', { melody: true, center: 74, density: 0.3 }], ['gm:tremolo_strings', 'Tremolo', { part: 'pad', center: 62, layer: 2, vol: 0.5 }], ['gm:choir_aahs', 'Choir', { part: 'pad', center: 66, layer: 3, vol: 0.5 }]]
    },
    boss: {
      name: 'Boss fight', emoji: '🐉', desc: 'Fast, loud and dramatic.', bpm: 156, key: 'E', scale: 'minor', swing: 0, prog: [0, 5, 6, 4],
      tracks: [['kit:electronic', 'Drums', { drums: 'boss' }], ['synth:wobble', 'Growl bass', { part: 'pulse8', center: 40 }], ['gm:distortion_guitar', 'Heavy guitar', { part: 'power', center: 52, vol: 0.55 }], ['gm:brass_section', 'Brass melody', { melody: true, center: 70, density: 0.7 }], ['gm:string_ensemble_1', 'Strings', { part: 'pad', center: 64, layer: 2, vol: 0.6 }], ['gm:choir_aahs', 'Choir', { part: 'pad', center: 67, layer: 3, vol: 0.5 }]]
    },
    victory: {
      name: 'Victory fanfare', emoji: '🏆', desc: 'Triumphant, short and proud.', bpm: 120, key: 'C', scale: 'major', swing: 0, prog: [0, 3, 4, 0], bars: 2, fanfare: true,
      tracks: [['kit:acoustic', 'Drums', { drums: 'fanfare' }], ['gm:trumpet', 'Trumpets', { fanfare: true, center: 72 }], ['gm:french_horn', 'Horns', { part: 'pad', center: 60 }], ['gm:tuba', 'Tuba', { part: 'oompah', center: 40 }], ['gm:timpani', 'Timpani', { part: 'rootfifth', center: 45 }]]
    },
    overworld: {
      name: 'Overworld adventure', emoji: '🗺️', desc: 'Upbeat and heroic. Off you go!', bpm: 128, key: 'G', scale: 'major', swing: 0, prog: [0, 4, 5, 3],
      tracks: [['kit:acoustic', 'Drums', { drums: 'basic' }], ['gm:electric_bass_finger', 'Bass', { part: 'bass', center: 43 }], ['gm:acoustic_guitar_steel', 'Guitar', { part: 'strum', center: 57 }], ['gm:flute', 'Melody', { melody: true, center: 76, density: 0.7 }], ['gm:string_ensemble_1', 'Strings', { part: 'pad', center: 64, layer: 2, vol: 0.5 }]]
    },
    chiptune: {
      name: 'Chiptune arcade', emoji: '👾', desc: 'Retro 8-bit console vibes, made entirely in code.', bpm: 140, key: 'C', scale: 'major', swing: 0, prog: [5, 3, 0, 4],
      tracks: [['kit:chip', 'Noise drums', { drums: 'chip' }], ['synth:triangle', 'Triangle bass', { part: 'pulse8', center: 40 }], ['synth:pulse', 'Arpeggio', { part: 'arp16', center: 64, vol: 0.5 }], ['synth:square', 'Lead', { melody: true, center: 76, density: 0.8 }]]
    },
    spooky: {
      name: 'Spooky forest', emoji: '🌲', desc: 'Mysterious, magical and a bit eerie.', bpm: 70, key: 'A', scale: 'minor', swing: 0, prog: [0, 5, 3, 4],
      tracks: [['kit:lofi', 'Soft drums', { drums: 'shaker' }], ['gm:celesta', 'Celesta', { melody: true, center: 76, density: 0.35 }], ['gm:pizzicato_strings', 'Plucks', { part: 'arp', center: 55 }], ['gm:voice_oohs', 'Voices', { part: 'pad', center: 62, vol: 0.5 }], ['gm:contrabass', 'Low drone', { part: 'longroot', center: 36, layer: 2 }]]
    },
    ocean: {
      name: 'Dreamy ocean', emoji: '🌊', desc: 'Floating, calm and shimmering.', bpm: 84, key: 'Eb', scale: 'lydian', swing: 0.2, prog: [0, 1, 0, 1],
      tracks: [['kit:lofi', 'Shaker', { drums: 'shaker' }], ['synth:subbass', 'Sub bass', { part: 'longroot', center: 36 }], ['gm:pad_1_new_age', 'Pad', { part: 'pad', center: 62, vol: 0.5 }], ['gm:orchestral_harp', 'Harp', { part: 'arp', center: 60 }], ['gm:vibraphone', 'Vibraphone', { melody: true, center: 72, density: 0.45 }]]
    },
    space: {
      name: 'Space station', emoji: '🚀', desc: 'Synth pads and plucks, all built from code.', bpm: 100, key: 'C', scale: 'dorian', swing: 0, prog: [0, 3, 6, 3],
      tracks: [['kit:electronic', 'Drums', { drums: 'halftime' }], ['synth:subbass', 'Sub bass', { part: 'rootfifth', center: 36 }], ['synth:softpad', 'Pad', { part: 'pad', center: 60 }], ['synth:pluck', 'Pluck arp', { part: 'arp16', center: 64, vol: 0.5 }], ['synth:bell', 'Bell melody', { melody: true, center: 76, density: 0.45 }]]
    },
    shop: {
      name: 'Item shop', emoji: '🛒', desc: 'Jazzy, relaxed background music.', bpm: 100, key: 'Bb', scale: 'major', swing: 0.45, prog: [1, 4, 0, 0],
      tracks: [['kit:lofi', 'Drums', { drums: 'chill' }], ['gm:acoustic_bass', 'Upright bass', { part: 'bass', center: 40 }], ['gm:electric_piano_1', 'Electric piano', { part: 'stabs', center: 62 }], ['gm:vibraphone', 'Vibraphone', { melody: true, center: 74, density: 0.55 }]]
    }
  };

  function fanfareMelody(song, center, bars) {
    const r = T.snapToScale(center, song.key, song.scale);
    const up = (n) => T.stepInScale(r, n, song.key, song.scale);
    const seq = [[0, up(-3), 1], [1, up(-3), 1], [2, up(-3), 1], [3, r, 5], [8, up(-1), 2], [10, r, 2], [12, up(2), 4],
      [16, up(4), 3], [19, up(3), 1], [20, up(4), 4], [24, up(7), 8]];
    return seq.filter(([s]) => s < bars * 16).map(([s, p, l]) => ({ s, p, l, v: 0.85 }));
  }

  function fillTrackForPreset(song, track, spec, prog, bars, seed) {
    if (spec.drums) return drumPattern(spec.drums, bars, { crash: true });
    if (spec.fanfare) return fanfareMelody(song, spec.center || 72, bars);
    if (spec.melody) return melody(song, prog, bars, { center: spec.center || 72, density: spec.density || 0.6, seed });
    return chordPart(song, prog, bars, spec.part || 'pad', spec.center || 60, seed);
  }

  function songFromMood(moodId) {
    const M = MOODS[moodId];
    const song = newSong(M.name);
    Object.assign(song, { bpm: M.bpm, key: M.key, scale: M.scale, swing: M.swing, layersFollowMood: true });
    const bars = M.bars || 4;
    const seed = Math.floor(Math.random() * 100000);
    song.tracks = M.tracks.map(([inst, name, spec]) => {
      const t = newTrack(song, inst, name);
      if (spec.layer) t.layer = spec.layer;
      if (spec.vol) t.volume = spec.vol;
      if (spec.center) t.octave = Math.floor(spec.center / 12) - 1;
      t._spec = spec;
      song.tracks.push(t);
      return t;
    });
    const explore = song.sections[0];
    explore.name = M.fanfare ? 'Fanfare' : 'Explore'; explore.bars = bars; explore.mood = M.fanfare ? 'intense' : 'calm'; explore.prog = M.prog.slice();
    song.tracks.forEach(t => { explore.clips[t.id] = fillTrackForPreset(song, t, t._spec, M.prog, bars, seed); });
    if (!M.fanfare) {
      const alert = newSection('Alert', bars, 'tense');
      const combat = newSection('Combat', bars, 'intense');
      alert.prog = M.prog.slice(); combat.prog = M.prog.slice();
      const victory = newSection('Victory', 2, 'intense');
      song.tracks.forEach(t => {
        const base = explore.clips[t.id];
        const len = bars * 16;
        if (t.kind === 'drums') {
          alert.clips[t.id] = VAR.drumsBusier(base, len);
          combat.clips[t.id] = VAR.addFill(VAR.drumsBusier(VAR.drumsBusier(base, len), len), len);
          victory.clips[t.id] = drumPattern('fanfare', 2);
        } else if (t._spec.melody) {
          alert.clips[t.id] = VAR.vary(base, song, seed + 1);
          combat.clips[t.id] = VAR.intensify(base, len, song);
          victory.clips[t.id] = fanfareMelody(song, t._spec.center || 72, 2);
        } else {
          alert.clips[t.id] = clone(base);
          combat.clips[t.id] = /pad|longroot/.test(t._spec.part) ? clone(base) : VAR.intensify(base, len, song);
          victory.clips[t.id] = chordPart(song, [3, 0], 2, /bass|root|pulse|oompah/.test(t._spec.part) ? 'rootfifth' : 'pad', t._spec.center || 60);
        }
      });
      song.sections.push(alert, combat, victory);
      song.arrangement = [explore.id, explore.id, alert.id, combat.id, combat.id, victory.id];
      song.states = { exploration: { section: explore.id, once: false }, alert: { section: alert.id, once: false }, combat: { section: combat.id, once: false }, victory: { section: victory.id, once: true } };
    } else {
      song.arrangement = [explore.id];
      song.states = { exploration: { section: explore.id, once: false }, alert: { section: explore.id, once: false }, combat: { section: explore.id, once: false }, victory: { section: explore.id, once: true } };
    }
    song.tracks.forEach(t => {
      delete t._spec;
      // Center the simple grid and keyboard on where the notes actually are
      const ps = song.sections.flatMap(sec => sec.clips[t.id] || []).map(n => n.p);
      if (t.kind === 'melody' && ps.length) t.octave = Math.max(0, Math.floor((Math.min(...ps) + 5) / 12) - 1);
    });
    return song;
  }

  function songFromBeat(style) {
    const song = newSong('My beat');
    song.bpm = { four: 124, boss: 150, chill: 88, chip: 140, march: 112, halftime: 90, tribal: 100 }[style] || 110;
    if (style === 'chill') song.swing = 0.35;
    const kit = style === 'chip' ? 'kit:chip' : style === 'chill' ? 'kit:lofi' : style === 'four' || style === 'boss' ? 'kit:electronic' : 'kit:acoustic';
    const d = newTrack(song, kit, 'Drums'); song.tracks.push(d);
    const b = newTrack(song, style === 'chip' ? 'synth:triangle' : 'gm:electric_bass_finger', 'Bass'); song.tracks.push(b);
    const k = newTrack(song, style === 'chip' ? 'synth:square' : 'gm:acoustic_grand_piano', 'Melody'); song.tracks.push(k);
    song.sections[0].clips[d.id] = drumPattern(style, 4);
    song.sections[0].bars = 4;
    return song;
  }

  function songFromMelody(instrument = 'gm:acoustic_grand_piano', withStarter = true) {
    const song = newSong('My melody');
    song.bpm = 100;
    const m = newTrack(song, instrument, 'Melody'); song.tracks.push(m);
    const c = newTrack(song, 'gm:string_ensemble_1', 'Chords'); c.volume = 0.5; song.tracks.push(c);
    const d = newTrack(song, 'kit:lofi', 'Drums'); d.volume = 0.6; song.tracks.push(d);
    if (withStarter) {
      const prog = [0, 4, 5, 3];
      song.sections[0].clips[m.id] = melody(song, prog, 4, { center: 72, density: 0.6, seed: Math.floor(Math.random() * 9999) });
      song.sections[0].clips[c.id] = chordPart(song, prog, 4, 'pad', 60);
    }
    return song;
  }

  function blankSong() {
    const song = newSong('Untitled song');
    const d = newTrack(song, 'kit:electronic', 'Drums'); song.tracks.push(d);
    const m = newTrack(song, 'gm:acoustic_grand_piano', 'Piano'); song.tracks.push(m);
    return song;
  }

  // ---------- Undo / redo ----------
  const history = { stack: [], index: -1, max: 300 };
  function resetHistory(song) { history.stack = [JSON.stringify(song)]; history.index = 0; }
  function commit(song, label) {
    const snap = JSON.stringify(song);
    if (history.stack[history.index] === snap) return false;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snap);
    if (history.stack.length > history.max) history.stack.shift();
    history.index = history.stack.length - 1;
    CC.events.emit('changed', label);
    return true;
  }
  function undo() { if (history.index <= 0) return null; history.index--; return JSON.parse(history.stack[history.index]); }
  function redo() { if (history.index >= history.stack.length - 1) return null; history.index++; return JSON.parse(history.stack[history.index]); }
  function lastCommitted() { return JSON.parse(history.stack[history.index]); }
  function canUndo() { return history.index > 0; }
  function canRedo() { return history.index < history.stack.length - 1; }

  // Upgrade older or hand-edited songs so the rest of the app can rely on fields existing.
  function normalize(song) {
    const s = Object.assign(newSong(song.name || 'Untitled'), song);
    s.tracks.forEach(t => {
      t.fx = Object.assign({ space: 0.15, echo: 0, tone: 1 }, t.fx || {});
      t.rowSamples = t.rowSamples || {};
      if (t.layer === undefined) t.layer = 1;
      if (t.instrument && t.instrument.startsWith('synth:') && !t.synth) t.synth = CC.instruments.defaultSynthParams(t.instrument);
      t.kind = (t.instrument || '').startsWith('kit:') ? 'drums' : 'melody';
      for (const old of OLD_COLORS) { const i = old.indexOf((t.color || '').toLowerCase()); if (i >= 0) { t.color = COLORS[i]; break; } }
    });
    s.sections.forEach(sec => { sec.clips = sec.clips || {}; sec.showing = sec.showing || 'A'; if (sec.clipsB === undefined) sec.clipsB = null; });
    if (!s.arrangement.length) s.arrangement = [s.sections[0].id];
    s.eq = Object.assign({ low: 0, mid: 0, high: 0 }, s.eq || {});
    for (const k of ['exploration', 'alert', 'combat', 'victory']) if (!s.states[k] || !s.sections.some(x => x.id === s.states[k].section)) s.states[k] = { section: s.sections[0].id, once: k === 'victory' };
    return s;
  }

  CC.song = { uid, clone, rng, newSong, newSection, newTrack, activeClips, clipOf, drumPattern, DRUM_STYLES, chordPart, melody, progChords, fanfareMelody, VAR, dedupe, MOODS, songFromMood, songFromBeat, songFromMelody, blankSong, resetHistory, commit, undo, redo, lastCommitted, canUndo, canRedo, normalize, COLORS, SECTION_COLORS, secColor };
})(window.CC);
