// Music theory helpers: note names, scales, chords, progressions.
window.CC = window.CC || {};
(function (CC) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const SCALES = {
    major:        { name: 'Major (happy, bright)', steps: [0, 2, 4, 5, 7, 9, 11] },
    minor:        { name: 'Minor (sad, serious)', steps: [0, 2, 3, 5, 7, 8, 10] },
    harmonicMinor:{ name: 'Harmonic minor (mysterious, dramatic)', steps: [0, 2, 3, 5, 7, 8, 11] },
    dorian:       { name: 'Dorian (adventurous minor)', steps: [0, 2, 3, 5, 7, 9, 10] },
    mixolydian:   { name: 'Mixolydian (heroic, folky)', steps: [0, 2, 4, 5, 7, 9, 10] },
    lydian:       { name: 'Lydian (dreamy, magical)', steps: [0, 2, 4, 6, 7, 9, 11] },
    phrygian:     { name: 'Phrygian (dark, tense)', steps: [0, 1, 3, 5, 7, 8, 10] },
    majorPent:    { name: 'Major pentatonic (can\'t go wrong)', steps: [0, 2, 4, 7, 9] },
    minorPent:    { name: 'Minor pentatonic (bluesy, rock)', steps: [0, 3, 5, 7, 10] },
    blues:        { name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
    chromatic:    { name: 'Chromatic (all notes)', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  };

  let useFlats = false;
  // Flat keys (F, Bb, Eb...) read better with flat note names (Bb instead of A#)
  function setKeyForNames(key, scale) {
    const minorish = ['minor', 'harmonicMinor', 'dorian', 'phrygian', 'minorPent', 'blues'].includes(scale);
    useFlats = /b/.test(key) || key === 'F' || (minorish && ['D', 'G', 'C', 'F'].includes(key));
  }
  function noteName(midi, withOctave = true) {
    const n = (useFlats ? FLAT_NAMES : NOTE_NAMES)[((midi % 12) + 12) % 12];
    return withOctave ? n + (Math.floor(midi / 12) - 1) : n;
  }
  function parseNote(str) {
    if (typeof str === 'number') return str;
    const m = /^([A-Ga-g])([#b]?)(-?\d+)?$/.exec(String(str).trim());
    if (!m) throw new Error('Not a note name: ' + str);
    let pc = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
    if (m[2] === '#') pc++;
    if (m[2] === 'b') pc--;
    const oct = m[3] === undefined ? 4 : parseInt(m[3], 10);
    return (oct + 1) * 12 + pc;
  }
  function keyIndex(key) { return parseNote(key + '0') % 12; }
  function scaleSteps(scale) { return (SCALES[scale] || SCALES.major).steps; }
  function inScale(midi, key, scale) {
    const pc = (((midi - keyIndex(key)) % 12) + 12) % 12;
    return scaleSteps(scale).includes(pc);
  }
  // All MIDI notes of the scale between lo and hi (inclusive)
  function scaleNotes(key, scale, lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (inScale(m, key, scale)) out.push(m);
    return out;
  }
  // Move a note by n scale degrees
  function stepInScale(midi, n, key, scale) {
    const notes = scaleNotes(key, scale, 0, 127);
    let i = notes.indexOf(midi);
    if (i < 0) i = notes.findIndex(x => x > midi) - (n > 0 ? 1 : 0);
    i = Math.max(0, Math.min(notes.length - 1, i + n));
    return notes[i];
  }
  function snapToScale(midi, key, scale) {
    if (inScale(midi, key, scale)) return midi;
    for (let d = 1; d < 7; d++) {
      if (inScale(midi - d, key, scale)) return midi - d;
      if (inScale(midi + d, key, scale)) return midi + d;
    }
    return midi;
  }

  // Diatonic chords for 7-note scales. Returns [{degree, roman, name, notes(pitch classes from root), root}]
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const FUNCTION_HINT = ['home (restful)', 'moving away', 'gentle', 'moving away', 'tension (wants to go home)', 'bittersweet', 'tension'];
  function diatonicChords(key, scale) {
    let steps = scaleSteps(scale);
    if (steps.length !== 7) steps = scale === 'minorPent' || scale === 'blues' ? SCALES.minor.steps : SCALES.major.steps;
    const k = keyIndex(key);
    const chords = [];
    for (let d = 0; d < 7; d++) {
      const r = steps[d], t = steps[(d + 2) % 7] + (d + 2 >= 7 ? 12 : 0), f = steps[(d + 4) % 7] + (d + 4 >= 7 ? 12 : 0);
      const third = t - r, fifth = f - r;
      let quality = '', roman = ROMAN[d];
      if (third === 4 && fifth === 7) quality = '';
      else if (third === 3 && fifth === 7) { quality = 'm'; roman = roman.toLowerCase(); }
      else if (third === 3 && fifth === 6) { quality = 'dim'; roman = roman.toLowerCase() + '°'; }
      else if (third === 4 && fifth === 8) { quality = 'aug'; roman = roman + '+'; }
      const rootPc = (k + r) % 12;
      chords.push({ degree: d, roman, name: (useFlats ? FLAT_NAMES : NOTE_NAMES)[rootPc] + quality, rootPc, intervals: [0, third, fifth], hint: FUNCTION_HINT[d] });
    }
    return chords;
  }
  // Voice a chord near a center pitch
  function voiceChord(chord, center = 60) {
    let root = center - 6 + ((((chord.rootPc - (center - 6)) % 12) + 12) % 12);
    return chord.intervals.map(i => root + i);
  }
  function chordFromName(name) {
    const m = /^([A-G][#b]?)(m|dim|aug|maj7|m7|7|sus2|sus4)?$/.exec(name.trim());
    if (!m) throw new Error('Unknown chord: ' + name);
    const rootPc = parseNote(m[1] + '0') % 12;
    const ints = { undefined: [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7] }[m[2]];
    return { name, rootPc, intervals: ints };
  }

  // Progressions as scale degrees (0-based) with friendly descriptions
  const PROGRESSIONS = [
    { id: 'heroic', name: 'Heroic journey', degrees: [0, 4, 5, 3], tip: 'The classic uplifting loop (I–V–vi–IV).' },
    { id: 'cozy', name: 'Cozy and warm', degrees: [0, 3, 0, 4], tip: 'Gentle back-and-forth, great for towns.' },
    { id: 'epic', name: 'Epic minor', degrees: [0, 5, 2, 6], tip: 'Big and cinematic (i–VI–III–VII in minor).' },
    { id: 'dark', name: 'Dark and brooding', degrees: [0, 3, 0, 4], tip: 'Use with a minor key for dungeons.' },
    { id: 'wonder', name: 'Sense of wonder', degrees: [0, 2, 3, 3], tip: 'Floaty and curious.' },
    { id: 'jazzy', name: 'Jazzy shop', degrees: [1, 4, 0, 0], tip: 'ii–V–I, smooth and relaxed.' },
    { id: 'tension', name: 'Rising tension', degrees: [0, 0, 1, 1], tip: 'Stays put then nudges up. Good for suspense.' },
    { id: 'sad', name: 'Bittersweet', degrees: [5, 3, 0, 4], tip: 'vi–IV–I–V, emotional.' }
  ];

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function isBlack(m) { return [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12); }

  CC.theory = { setKeyForNames, NOTE_NAMES, FLAT_NAMES, SCALES, PROGRESSIONS, noteName, parseNote, keyIndex, scaleSteps, inScale, scaleNotes, stepInScale, snapToScale, diatonicChords, voiceChord, chordFromName, midiToFreq, isBlack };
})(window.CC);
