// One-click music ideas: re-roll a part, a chord progression, a whole section or a whole song.
window.CC = window.CC || {};
(function (CC) {
  const SG = () => CC.song, T = () => CC.theory;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const seed = () => Math.floor(Math.random() * 1e6);

  const ROLES = {
    melody: { name: 'Melody', emoji: '🎵' },
    chords: { name: 'Chords', emoji: '🎹' },
    arp: { name: 'Arpeggio', emoji: '✨' },
    bass: { name: 'Bass', emoji: '🎸' },
    drums: { name: 'Drums', emoji: '🥁' }
  };
  const STYLES = {
    chords: ['pad', 'strum', 'stabs', 'pad'],
    arp: ['arp', 'arp16', 'ostinato'],
    bass: ['bass', 'rootfifth', 'pulse8', 'longroot', 'bass']
  };
  const GROOVES = Object.keys(SG().DRUM_STYLES).filter(id => id !== 'fanfare');

  // Best guess at what a track is for, unless the user picked it
  function role(t) {
    if (t.kind === 'drums') return 'drums';
    if (t.role && ROLES[t.role]) return t.role;
    const n = (t.name || '') + ' ' + (t.instrument || '');
    if (/bass|tuba|low|sub|drone|contrabass/i.test(n) || (t.octave === undefined ? 4 : t.octave) <= 1) return 'bass';
    if (/melody|lead|solo|flute|whistle|ocarina|trumpet/i.test(n)) return 'melody';
    if (/arp|pluck|harp|music.?box|celesta|glock|sparkle|bell/i.test(n)) return 'arp';
    return 'chords';
  }

  function progOf(sec, fallback) { return (sec.prog && sec.prog.length ? sec.prog : fallback || [0, 4, 5, 3]).slice(0, 4); }

  // Write a fresh part for one track in one section
  function partFor(song, sec, t, prog, opts = {}) {
    const bars = sec.bars, r = role(t), oct = (t.octave === undefined ? 4 : t.octave);
    if (r === 'drums') {
      const style = opts.groove || pick(GROOVES);
      return SG().drumPattern(style, bars, { fill: Math.random() < 0.5, crash: true });
    }
    if (r === 'melody') return SG().melody(song, prog, bars, { center: (oct + 1) * 12 + 7, density: opts.density === undefined ? 0.6 : opts.density, seed: seed() });
    const center = r === 'bass' ? Math.min(52, Math.max(36, (oct + 1) * 12 + 4)) : (oct + 1) * 12 + 2;
    return SG().chordPart(song, prog, bars, pick(STYLES[r]), center, seed());
  }

  function rollTrack(song, sec, t, prog, opts) {
    SG().activeClips(sec)[t.id] = partFor(song, sec, t, prog || progOf(sec), opts);
  }
  // Every track that is not locked
  function rollAll(song, sec, opts = {}) {
    const prog = progOf(sec, opts.prog);
    song.tracks.filter(t => !t.locked).forEach(t => rollTrack(song, sec, t, prog, opts));
  }

  function randomProgression() {
    if (Math.random() < 0.5) return pick(T().PROGRESSIONS).degrees.slice();
    const p = [0];
    while (p.length < 4) { const d = pick([1, 2, 3, 4, 5, 5, 3, 4]); if (d !== p[p.length - 1]) p.push(d); }
    return p;
  }
  function newProgression(song, sec, opts = {}) {
    sec.prog = randomProgression();
    song.tracks.filter(t => !t.locked && t.kind !== 'drums').forEach(t => rollTrack(song, sec, t, sec.prog, opts));
    return sec.prog;
  }

  // Small changes that keep the idea recognisable
  function remix(song, sec) {
    const V = SG().VAR, len = sec.bars * 16, clips = SG().activeClips(sec);
    song.tracks.filter(t => !t.locked && clips[t.id] && clips[t.id].length).forEach(t => {
      const r = role(t);
      if (r === 'drums') clips[t.id] = Math.random() < 0.5 ? V.addFill(V.drumsBusier(clips[t.id], len), len) : V.newGroove(clips[t.id], len, seed());
      else if (r === 'melody') clips[t.id] = V.vary(clips[t.id], song, seed());
      else clips[t.id] = V.humanize(clips[t.id], seed());
    });
  }

  // Calm / tense / intense copies of a section for game states
  function gameVersions(song, sec) {
    const V = SG().VAR, len = sec.bars * 16, base = SG().activeClips(sec);
    const tense = SG().newSection(sec.name + ' tense', sec.bars, 'tense');
    const intense = SG().newSection(sec.name + ' intense', sec.bars, 'intense');
    tense.prog = intense.prog = sec.prog;
    song.tracks.forEach(t => {
      const n = base[t.id]; if (!n || !n.length) return;
      const r = role(t);
      if (r === 'drums') { tense.clips[t.id] = V.drumsBusier(n, len); intense.clips[t.id] = V.addFill(V.drumsBusier(V.drumsBusier(n, len), len), len); }
      else if (r === 'melody') { tense.clips[t.id] = V.vary(n, song, seed()); intense.clips[t.id] = V.intensify(n, len, song); }
      else { tense.clips[t.id] = SG().clone(n); intense.clips[t.id] = r === 'chords' ? SG().clone(n) : V.intensify(n, len, song); }
    });
    const i = song.sections.indexOf(sec);
    song.sections.splice(i + 1, 0, tense, intense);
    song.arrangement.push(tense.id, intense.id);
    song.states.alert = { section: tense.id, once: false };
    song.states.combat = { section: intense.id, once: false };
    if (song.states.exploration) song.states.exploration.section = sec.id;
    return [tense, intense];
  }

  function randomMood() { return pick(Object.keys(SG().MOODS)); }

  CC.gen = { ROLES, role, partFor, rollTrack, rollAll, newProgression, randomProgression, remix, gameVersions, randomMood, progOf, GROOVES };
})(window.CC);
