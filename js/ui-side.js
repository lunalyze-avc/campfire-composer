// Side panel tabs: Chords & ideas, Change it (variations), Sound, Game (adaptive + loop tools), Code lab.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, T = CC.theory, S = ui.state, V = CC.song.VAR;
  S.progSlots = [0, 4, 5, 3];
  S.chordStyle = 'pad';
  S.melodyBusy = 0.6;
  S.varScope = 'section';

  function render() {
    $$('#side-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.sideTab)));
    const body = $('#side-body');
    const keepScroll = body.scrollTop;
    body.innerHTML = '';
    const track = ui.track();
    ({ make: makeTab, ideas: ideasTab, vary: varyTab, sound: soundTab, game: gameTab, code: codeTab })[S.sideTab](body, track);
    body.scrollTop = keepScroll;
  }
  ui.registerRenderer('side', render);

  // ---------- Make it for me (generators) ----------
  S.genMood = 'random';
  function makeTab(body) {
    const song = S.song, sec = ui.section(), G = CC.gen;
    const ch = T.diatonicChords(song.key, song.scale);
    const prog = G.progOf(sec, S.progSlots);
    body.append(h('h3', {}, '🎲 Make it for me'),
      h('p', { class: 'help' }, `No ideas? Roll the dice. Everything here changes "${sec.name}" only, and Ctrl+Z always undoes it. Lock a part you like so the dice leave it alone.`));
    body.appendChild(h('button', { class: 'btn accent big-dice', 'data-tip': 'Writes new parts for every unlocked instrument in this section, following the chords below.', onclick: () => ui.edit('Roll everything', s => G.rollAll(s, sec, { density: S.melodyBusy })) }, '🎲 Roll new ideas'));
    body.appendChild(h('div', { class: 'btn-grid', style: { marginTop: '.45rem' } },
      h('button', { class: 'btn', 'data-tip': 'Pick new chords, then rewrite the melody, bass and chords to match. Drums stay.', onclick: () => ui.edit('New chords', s => G.newProgression(s, sec, { density: S.melodyBusy })) }, '🎼 New chords'),
      h('button', { class: 'btn', 'data-tip': 'Small changes to what is already there: a few melody notes, a drum fill, a more human feel.', onclick: () => ui.edit('Remix', s => G.remix(s, sec)) }, '🔀 Remix a little'),
      h('button', { class: 'btn', 'data-tip': 'Makes a tense and an intense copy of this section for Alert and Combat in your game, and adds them to the song.', onclick: () => ui.edit('Game versions', s => { const [a] = G.gameVersions(s, sec); ui.toast('Added "' + a.name + '" and an intense version. The Game tab now uses them for Alert and Combat.'); }) }, '🎮 Make game versions'),
      h('button', { class: 'btn', 'data-tip': 'Adds an 8-bar section by joining this one with a remixed copy, so the loop takes longer to repeat.', onclick: () => ui.edit('Longer', s => {
        const len = sec.bars * 16, clips = CC.song.activeClips(sec);
        if (sec.bars >= 16) return ui.toast('This section is already as long as it can be.');
        s.tracks.forEach(t => { const n = clips[t.id]; if (!n) return; const copy = G.role(t) === 'melody' ? CC.song.VAR.vary(n, s, Math.random() * 1e6) : n; clips[t.id] = n.concat(copy.map(x => ({ ...x, s: x.s + len }))); });
        sec.bars *= 2;
      }) }, '↔ Make it longer')));
    body.append(h('div', { class: 'faint', style: { margin: '.5rem 0 .2rem' } }, 'Chords: ' + prog.map(d => ch[d % 7].name).join(' – ')));
    body.appendChild(ui.slider({ label: 'Melody busyness', tip: 'How many notes new melodies get.', min: 0.2, max: 1, step: 0.05, value: S.melodyBusy, left: 'Few, long notes', right: 'Lots of notes', fmt: ui.pct, onInput: v => { S.melodyBusy = v; } }));

    body.append(h('h3', {}, 'One part at a time'));
    song.tracks.forEach(t => {
      const r = G.role(t);
      const roleSel = t.kind === 'drums' ? h('span', { class: 'role-tag' }, '🥁 Drums') : h('select', { class: 'role-sel', 'aria-label': 'What ' + t.name + ' plays', 'data-tip': 'What this instrument plays when you roll the dice.', onchange: e => ui.edit('Part type', () => { t.role = e.target.value; }, ['side']) },
        Object.entries(G.ROLES).filter(([k]) => k !== 'drums').map(([k, v]) => h('option', { value: k, selected: r === k }, v.emoji + ' ' + v.name)));
      body.appendChild(h('div', { class: 'gen-row' + (t.locked ? ' locked' : '') },
        h('span', { class: 'sw', style: { background: t.color } }),
        h('div', { class: 'grow' }, h('b', {}, t.name), roleSel),
        h('button', { class: 'btn small icon', 'aria-pressed': String(!!t.locked), 'aria-label': (t.locked ? 'Unlock ' : 'Lock ') + t.name, 'data-tip': t.locked ? 'Locked: the dice leave this part alone. Click to unlock.' : 'Lock this part so the dice don\'t change it.', onclick: () => ui.edit(t.locked ? 'Unlock' : 'Lock', () => { t.locked = !t.locked; }, ['side']) }, t.locked ? '🔒' : '🔓'),
        h('button', { class: 'btn small accent', 'data-tip': 'Write a new ' + (G.ROLES[r] || {}).name.toLowerCase() + ' part for ' + t.name + ' in this section.', onclick: () => ui.edit('New ' + t.name, s => G.rollTrack(s, sec, t, null, { density: S.melodyBusy })) }, '🎲 New')));
    });

    body.append(h('h3', {}, 'A whole new song'), h('p', { class: 'help' }, 'Starts a fresh song with every section filled in. Your current song stays safe in "Your songs" on the start screen.'));
    const moodSel = h('select', { 'aria-label': 'Mood for the new song', onchange: e => { S.genMood = e.target.value; } },
      h('option', { value: 'random', selected: S.genMood === 'random' }, '🎲 Any mood'),
      Object.entries(CC.song.MOODS).map(([id, m]) => h('option', { value: id, selected: S.genMood === id }, m.emoji + ' ' + m.name)));
    body.appendChild(h('div', { class: 'row' }, moodSel, h('button', { class: 'btn accent', onclick: () => {
      const id = S.genMood === 'random' ? CC.gen.randomMood() : S.genMood;
      CC.storage.saveNow(S.song);
      const n = CC.song.songFromMood(id); delete n.projectId;
      ui.loadSong(n).then(() => ui.toast(CC.song.MOODS[id].emoji + ' A brand new ' + CC.song.MOODS[id].name.toLowerCase() + ' song. Roll the dice to change any part.'));
    } }, '✨ Surprise me')));
  }

  // ---------- Chords & ideas ----------
  function ideasTab(body, track) {
    const song = S.song, sec = ui.section();
    if (sec.prog && S.progSec !== sec.id) { S.progSec = sec.id; S.progSlots = sec.prog.slice(); }
    if (track && track.kind === 'drums') {
      body.append(h('h3', {}, 'Pick a drum groove'), h('p', { class: 'help' }, `Replaces the drums in "${sec.name}". Click ▶ to hear it first. You can always undo.`));
      for (const [id, st] of Object.entries(CC.song.DRUM_STYLES)) {
        body.appendChild(h('div', { class: 'prog' },
          h('button', { class: 'btn small', 'aria-label': 'Preview ' + st.name, onclick: () => previewGroove(track, id) }, '▶'),
          h('div', { class: 'grow' }, st.name),
          h('button', { class: 'btn small', onclick: () => ui.edit('Drum groove', () => { CC.song.activeClips(sec)[track.id] = CC.song.drumPattern(id, sec.bars); }) }, 'Use')));
      }
      body.append(h('div', { class: 'callout' }, 'Chords and melodies are for pitched instruments. Select one on the left to see chord helpers.'));
      return;
    }
    const chords = T.diatonicChords(song.key, song.scale);
    body.append(h('h3', {}, `Chords in ${song.key} ${T.SCALES[song.scale].name.split(' (')[0].toLowerCase()}`),
      h('p', { class: 'help' }, 'These chords always sound good in your key. Click to hear one. Green = home, yellow = tension that wants to resolve.'));
    const grid = h('div', { class: 'chord-grid' });
    chords.forEach((c, i) => grid.appendChild(h('button', { class: 'chord' + (i === 0 ? ' home' : (i === 4 || i === 6) ? ' tension' : ''), 'data-tip': `${c.name} (${c.roman}): ${c.hint}`, onclick: () => previewChord(track, c) }, h('b', {}, c.name), h('small', {}, c.roman))));
    body.appendChild(grid);

    body.append(h('h3', {}, 'Build a chord progression'), h('p', { class: 'help' }, 'One chord per bar. Pick from the lists, or start from a ready-made one below.'));
    const n = Math.min(8, sec.bars < 4 ? 4 : sec.bars);
    while (S.progSlots.length < n) S.progSlots.push(S.progSlots[S.progSlots.length % 4]);
    const slots = h('div', { class: 'row' });
    for (let i = 0; i < n; i++) {
      const sel = h('select', { 'aria-label': 'Chord for bar ' + (i + 1) }, chords.map((c, d) => h('option', { value: d, selected: S.progSlots[i] === d }, c.name)));
      sel.onchange = () => { S.progSlots[i] = +sel.value; };
      slots.appendChild(h('label', { class: 'field' }, h('small', {}, (i + 1) + ''), sel));
    }
    body.appendChild(slots);
    const style = h('select', { 'aria-label': 'How to play the chords' }, [['pad', 'Held chords'], ['strum', 'Strummed'], ['stabs', 'Short stabs'], ['arp', 'Arpeggio (one note at a time)'], ['arp16', 'Fast arpeggio'], ['bass', 'Bass line'], ['rootfifth', 'Simple bass (root + fifth)'], ['pulse8', 'Driving bass (8th notes)'], ['oompah', 'Oom-pah']].map(([v, l]) => h('option', { value: v, selected: S.chordStyle === v }, l)));
    style.onchange = () => { S.chordStyle = style.value; };
    body.appendChild(h('div', { class: 'row', style: { marginTop: '.5rem' } },
      h('button', { class: 'btn small', onclick: () => previewProg(track, S.progSlots.slice(0, n)) }, '▶ Hear it'),
      style));
    body.appendChild(h('div', { class: 'row', style: { marginTop: '.4rem' } },
      h('button', { class: 'btn accent small', disabled: !track, 'data-tip': `Writes these chords into "${track ? track.name : ''}" for this section, replacing its notes.`, onclick: () => putChords(track, n) }, `Put chords into ${track ? track.name : '…'}`)));

    body.append(h('h3', {}, 'Ready-made progressions'));
    T.PROGRESSIONS.forEach(p => {
      const names = progNames(p.degrees);
      body.appendChild(h('div', { class: 'prog' },
        h('button', { class: 'btn small', 'aria-label': 'Preview ' + p.name, onclick: () => previewProg(track, p.degrees) }, '▶'),
        h('div', { class: 'grow' }, h('b', {}, p.name), h('small', {}, names + ' · ' + p.tip)),
        h('button', { class: 'btn small', 'data-tip': 'Load into the progression builder above', onclick: () => { for (let i = 0; i < S.progSlots.length; i++) S.progSlots[i] = p.degrees[i % 4]; render(); } }, 'Use')));
    });

    body.append(h('h3', {}, 'Make up a melody for me'), h('p', { class: 'help' }, `Creates a melody that follows the chords above, in "${track ? track.name : ''}". Not quite right? Click again for a new one.`));
    body.appendChild(ui.slider({ label: 'How busy', tip: 'How many notes the melody has.', min: 0.2, max: 1, step: 0.05, value: S.melodyBusy, left: 'Few, long notes', right: 'Lots of notes', fmt: ui.pct, onInput: v => { S.melodyBusy = v; } }));
    body.appendChild(h('button', { class: 'btn accent small', disabled: !track, onclick: () => ui.edit('Make melody', () => {
      const center = (track.octave + 1) * 12 + 7;
      CC.song.activeClips(sec)[track.id] = CC.song.melody(song, S.progSlots.slice(0, n), sec.bars, { center, density: S.melodyBusy, seed: Math.floor(Math.random() * 1e6) });
    }) }, '✨ Make a melody'));
  }
  function progNames(degrees) { const ch = T.diatonicChords(S.song.key, S.song.scale); return degrees.map(d => ch[d].name).join(' – '); }
  function chordTrack(track) { return track && track.kind === 'melody' ? track : { id: '__chord', instrument: 'gm:acoustic_grand_piano', kind: 'melody' }; }
  function previewChord(track, c) {
    const t = chordTrack(track);
    T.voiceChord(c, ((t.octave || 4) + 1) * 12 + 4).forEach(p => CC.engine.preview(t, p, 0.8, 0.6));
  }
  function previewProg(track, degrees) {
    const ch = T.diatonicChords(S.song.key, S.song.scale);
    degrees.forEach((d, i) => setTimeout(() => previewChord(track, ch[d]), i * 650));
  }
  function previewGroove(track, id) {
    CC.audio.resume().then(() => {
      const ctx = CC.audio.ctx();
      const notes = CC.song.drumPattern(id, 1);
      const sd = CC.mix.stepDur(S.song); const t0 = ctx.currentTime + 0.05;
      const G = CC.engine.ensureGraph();
      const dest = CC.mix.ensureTrackNodes(G, track).input;
      for (let r = 0; r < 2; r++) notes.forEach(n => CC.instruments.trigger(ctx, dest, track, n.p, t0 + (r * 16 + n.s) * sd, n.v));
    });
  }
  function putChords(track, n) {
    const sec = ui.section();
    const degrees = S.progSlots.slice(0, n);
    ui.edit('Put chords', () => {
      let center = (track.octave + 1) * 12 + 4;
      if (/bass|root|pulse|oompah/.test(S.chordStyle)) center = Math.min(center, 52);
      CC.song.activeClips(sec)[track.id] = CC.song.chordPart(S.song, degrees, sec.bars, S.chordStyle, center);
      sec.prog = degrees.slice(0, 4);
    });
  }

  // ---------- Change it (variations) ----------
  function varyTab(body, track) {
    const song = S.song, sec = ui.section();
    if (!track) return;
    body.append(h('h3', {}, `Change "${track.name}"`),
      h('p', { class: 'help' }, 'Quick ways to try something new without starting over. Everything can be undone (Ctrl+Z), or use A/B above the grid to compare.'));
    const scope = h('select', { 'aria-label': 'Apply changes to' }, [['section', 'This section only'], ['all', 'Every section']].map(([v, l]) => h('option', { value: v, selected: S.varScope === v }, l)));
    scope.onchange = () => { S.varScope = scope.value; };
    body.appendChild(h('label', { class: 'field', style: { marginBottom: '.5rem' } }, h('span', {}, 'Apply to:'), scope));
    const grid = h('div', { class: 'btn-grid' });
    const act = (label, tip, fn, ex) => grid.appendChild(h('button', { class: 'btn', 'data-tip': tip, 'data-ex': ex, onclick: () => applyVar(track, label, fn) }, label));
    if (track.kind === 'drums') {
      act('🥁 Make the drums busier', 'Adds more hi-hats, an extra kick and soft "ghost" snare hits.', (n, len) => V.drumsBusier(n, len));
      act('🍃 Make the drums simpler', 'Removes the quieter and in-between hits, keeping the main beat.', (n) => V.drumsSimpler(n));
      act('💥 Add a fill at the end', 'Adds a short drum roll on the last beat that leads back to the start, plus a crash.', (n, len) => V.addFill(n, len));
      act('🎲 Try a new kick pattern', 'Swaps the kick drum rhythm. Click again for another.', (n, len) => V.newGroove(n, len));
      act('🐢 Half-time feel', 'Stretches the beat so it feels slower and heavier.', (n, len) => V.halfTime(n, len));
      act('🐇 Double-time feel', 'Squashes the beat so it feels twice as fast.', (n, len) => V.doubleTime(n, len));
      act('🤲 Make it feel human', 'Slightly varies how hard each hit is, like a real drummer.', (n) => V.humanize(n), 'Velocity (loudness) randomized by ±12%.');
    } else {
      act('🔥 More intense', 'Splits long notes into driving 8th notes, adds passing notes and plays a bit harder.', (n, len) => V.intensify(n, len, song));
      act('🌙 Calmer', 'Removes some notes, makes the rest longer and softer.', (n) => V.calmer(n));
      act('⬆ Move up (in key)', 'Every note moves up one step in your key.', (n) => V.transposeScale(n, 1, song));
      act('⬇ Move down (in key)', 'Every note moves down one step in your key.', (n) => V.transposeScale(n, -1, song));
      act('⏫ Up an octave', 'Same notes, higher.', (n) => V.transpose(n, 12));
      act('⏬ Down an octave', 'Same notes, lower.', (n) => V.transpose(n, -12));
      act('🎶 Add harmony', 'Adds a second voice a few notes above, like two instruments playing together.', (n) => V.harmony(n, song), 'C becomes C + E.');
      act('🎲 Remix a few notes', 'Changes about a third of the notes to nearby ones. Keeps the rhythm.', (n) => V.vary(n, song));
      act('🔁 Echo the notes', 'Adds a softer copy of each note shortly after it.', (n, len) => V.echo(n, len));
      act('🌊 Chords → arpeggio', 'Turns stacked chord notes into one-at-a-time patterns.', (n) => V.arpeggiate(n));
      act('↩ Play it backwards', 'Reverses the order of the notes.', (n, len) => V.reverse(n, len));
      act('🤲 Make it feel human', 'Slightly varies how hard each note is played.', (n) => V.humanize(n));
    }
    act('⏪ Notes a bit earlier', 'Shifts every note 1/16 earlier (wraps around).', (n, len) => V.nudge(n, -1, len));
    act('⏩ Notes a bit later', 'Shifts every note 1/16 later (wraps around).', (n, len) => V.nudge(n, 1, len));
    body.appendChild(grid);

    body.append(h('h3', {}, 'Song feel'));
    body.appendChild(ui.slider({ label: 'Groove', tip: 'Straight = robotic and even. Bouncy = every second 1/16 note is a little late, like a shuffle. Technical name: swing.', ex: 'Cozy and jazzy songs sound great around 30-45%.', min: 0, max: 0.8, step: 0.05, value: song.swing || 0, left: 'Straight', right: 'Bouncy (swing)', fmt: v => 'swing ' + Math.round(v * 100) + '%', onInput: v => { song.swing = v; }, onChange: () => ui.commitOnly('Groove', ['top']) }));
    body.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => ui.edit('Slower', s => { s.bpm = Math.max(40, Math.round(s.bpm * 0.9)); }, ['top']) }, '🐢 A bit slower'),
      h('button', { class: 'btn small', onclick: () => ui.edit('Faster', s => { s.bpm = Math.min(240, Math.round(s.bpm * 1.1)); }, ['top']) }, '🐇 A bit faster')));

    body.append(h('h3', {}, `Mood of "${sec.name}"`), h('p', { class: 'help' }, 'Mark how this section should feel. "Match" changes every instrument in it to fit.'));
    const seg = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Section mood' });
    ['calm', 'tense', 'intense'].forEach(m => seg.appendChild(h('button', { role: 'radio', 'aria-checked': String(sec.mood === m), onclick: () => ui.edit('Mood', () => { sec.mood = m; }) }, { calm: '🔵 Calm', tense: '🟡 Tense', intense: '🔴 Intense' }[m])));
    body.appendChild(h('div', { class: 'row' }, seg, h('button', { class: 'btn small', 'data-tip': 'Calm: simpler drums and softer melodies. Intense: busier drums and driving melodies. Tense: a bit of both.', onclick: () => matchMood(sec) }, 'Match instruments to mood')));
  }
  function applyVar(track, label, fn) {
    const song = S.song;
    ui.edit(label, () => {
      const secs = S.varScope === 'all' ? song.sections : [ui.section()];
      secs.forEach(sec => {
        const c = CC.song.activeClips(sec);
        c[track.id] = CC.song.dedupe(fn(c[track.id] || [], sec.bars * 16).filter(n => n.s >= 0 && n.s < sec.bars * 16 && n.p >= 0 && n.p <= 127));
      });
    });
  }
  function matchMood(sec) {
    const song = S.song;
    ui.edit('Match mood', () => {
      const c = CC.song.activeClips(sec), len = sec.bars * 16;
      song.tracks.forEach(t => {
        const n = c[t.id]; if (!n || !n.length) return;
        if (t.kind === 'drums') c[t.id] = sec.mood === 'calm' ? V.drumsSimpler(n) : sec.mood === 'intense' ? V.addFill(V.drumsBusier(n, len), len) : V.drumsBusier(V.drumsSimpler(n), len);
        else if (sec.mood === 'calm') c[t.id] = V.calmer(n);
        else if (sec.mood === 'intense') c[t.id] = V.intensify(n, len, song);
      });
    });
  }

  // ---------- Sound ----------
  function soundTab(body, track) {
    if (!track) return;
    const info = CC.instruments.info(track.instrument);
    const adv = ui.advanced();
    body.append(h('h3', {}, `Sound of "${track.name}"`),
      h('div', { class: 'row' }, h('b', {}, info.name), h('button', { class: 'btn small', onclick: () => CC.engine.previewInstrument(track.instrument) }, '▶ Preview'), h('button', { class: 'btn small', onclick: () => CC.modals.library({ trackId: track.id }) }, 'Change…')),
      h('p', { class: 'help' }, info.desc));
    const live = (fn) => (v) => { fn(v); CC.engine.refreshMix(); };
    const commit = () => ui.commitOnly('Sound', ['tracks']);
    body.appendChild(ui.slider({ label: 'Volume', min: 0, max: 1, value: track.volume, fmt: ui.pct, onInput: live(v => { track.volume = v; }), onChange: commit }));
    if (adv) body.appendChild(ui.slider({ label: 'Left / right', tip: 'Where the sound sits between your speakers (pan).', min: -1, max: 1, value: track.pan || 0, left: 'Left', right: 'Right', fmt: v => Math.abs(v) < 0.02 ? 'center' : (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v) * 100), onInput: live(v => { track.pan = v; }), onChange: commit }));
    body.appendChild(ui.slider({ label: 'Space', tip: 'How big the room sounds. Technical name: reverb.', ex: 'A little for a cozy room, lots for a cave or cathedral.', min: 0, max: 1, value: track.fx.space, left: 'Dry, close', right: 'Huge hall', fmt: ui.pct, onInput: live(v => { track.fx.space = v; }), onChange: commit }));
    body.appendChild(ui.slider({ label: 'Echo', tip: 'Repeats each note softly in time with the music. Technical name: delay (dotted 1/8).', min: 0, max: 1, value: track.fx.echo, left: 'None', right: 'Lots', fmt: ui.pct, onInput: live(v => { track.fx.echo = v; }), onChange: commit }));
    body.appendChild(ui.slider({ label: 'Tone', tip: 'Darker sounds muffled and far away; brighter is crisp and close. Technical name: low-pass filter.', ex: 'Turn it down to make music sound like it is behind a wall or underwater.', min: 0.05, max: 1, value: track.fx.tone, left: 'Dark, muffled', right: 'Bright', fmt: v => v >= 0.99 ? 'open' : Math.round(200 + v * v * 16000) + ' Hz', onInput: live(v => { track.fx.tone = v; }), onChange: commit }));
    if (adv || S.song.layersFollowMood) body.appendChild(layerSelect(track));

    if (track.kind === 'drums') drumSounds(body, track);
    if (track.instrument.startsWith('synth:')) synthDesigner(body, track, adv);
    if (track.instrument.startsWith('user:')) userSampleCtl(body, track);

    body.append(h('h3', {}, 'Your own sounds'), h('p', { class: 'help' }, 'Upload a recording (WAV, MP3, OGG) or record one with your microphone. Use it as a playable instrument, or as a drum sound.'));
    body.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => CC.modals.uploadSample() }, '⬆ Upload a sound…'), h('button', { class: 'btn small', onclick: () => CC.modals.recordSound() }, '🎙 Record…'), h('button', { class: 'btn small', onclick: () => CC.modals.sounds() }, '🗂 Manage your sounds')));
  }
  function layerSelect(track) {
    const sel = h('select', { 'aria-label': 'Plays in which moods' }, [[1, 'Every section'], [2, 'Tense and intense sections'], [3, 'Intense sections only']].map(([v, l]) => h('option', { value: v, selected: (track.layer || 1) === v }, l)));
    sel.onchange = () => ui.edit('Layer', () => { track.layer = +sel.value; });
    return h('div', { class: 'ctrl', 'data-tip': 'Mood layers: add instruments only when the game gets tense. Works when "Layers follow mood" is on (Game tab).' }, h('label', {}, 'Plays in'), sel);
  }
  function drumSounds(body, track) {
    body.append(h('h3', {}, 'Drum sounds'), h('p', { class: 'help' }, 'Swap any drum for one of your uploaded sounds.'));
    const samples = Object.entries(CC.instruments.userSamples);
    CC.instruments.KITS[track.instrument.split(':')[1]].rows.forEach(([id, name], i) => {
      const sel = h('select', { 'aria-label': 'Sound for ' + name }, h('option', { value: '' }, 'Built-in ' + name.split(' (')[0]), samples.map(([sid, s]) => h('option', { value: sid, selected: track.rowSamples[i] === sid }, '📁 ' + s.name)));
      sel.onchange = () => ui.edit('Drum sound', () => { if (sel.value) track.rowSamples[i] = sel.value; else delete track.rowSamples[i]; });
      body.appendChild(h('div', { class: 'row', style: { marginBottom: '.25rem' } }, h('button', { class: 'btn small', 'aria-label': 'Preview ' + name, onclick: () => CC.engine.preview(track, i) }, '▶'), sel));
    });
  }
  function synthDesigner(body, track, adv) {
    const P = track.synth;
    const preset = track.instrument.split(':')[1];
    body.append(h('h3', {}, '🎛 Sound designer'), h('p', { class: 'help' }, 'This instrument is generated live by Web Audio code, so you can reshape it. Play keys below while you tweak.'));
    const upd = () => {};
    const commit = () => ui.commitOnly('Sound design', []);
    const wave = h('select', { 'aria-label': 'Waveform' }, [['sine', 'Sine (pure, soft)'], ['triangle', 'Triangle (round, flute-ish)'], ['square', 'Square (8-bit, hollow)'], ['pulse', 'Pulse (thin, NES)'], ['sawtooth', 'Saw (buzzy, bright)'], ['noise', 'Noise (wind, breath)'], ['custom', 'Custom harmonics']].map(([v, l]) => h('option', { value: v, selected: P.wave === v }, l)));
    wave.onchange = () => ui.edit('Waveform', () => { P.wave = wave.value; if (wave.value === 'custom' && !P.harmonics) P.harmonics = [1, 0.5, 0.3, 0.2, 0.1, 0, 0, 0]; }, ['side']);
    body.appendChild(h('div', { class: 'ctrl', 'data-tip': 'The basic shape of the sound wave. This is the biggest change to the character.' }, h('label', {}, 'Basic sound'), wave));
    const sl = (key, label, opts) => body.appendChild(ui.slider(Object.assign({ label, value: P[key] === undefined ? (opts.def || 0) : P[key], onInput: v => { P[key] = v; upd(); }, onChange: commit }, opts)));
    sl('brightness', 'Brightness', { tip: 'Filter cutoff: how much of the bright buzzy part comes through.', left: 'Dull', right: 'Bright', fmt: ui.pct, def: 0.7 });
    sl('attack', 'Fade in', { tip: 'Attack: how quickly a note reaches full volume.', min: 0.001, max: 2, step: 0.001, left: 'Instant', right: 'Slow swell', fmt: v => v.toFixed(3) + ' s' });
    sl('release', 'Fade out', { tip: 'Release: how long a note rings after it ends.', min: 0.01, max: 3, step: 0.01, left: 'Cut off', right: 'Long tail', fmt: v => v.toFixed(2) + ' s' });
    sl('detune', 'Thickness', { tip: 'Detune: two copies slightly out of tune for a wide, chorus-like sound.', min: 0, max: 40, step: 1, left: 'Thin', right: 'Thick', fmt: v => v + ' cents' });
    if (adv) {
      sl('decay', 'Decay', { tip: 'How fast the note falls from its peak to the hold level.', min: 0.01, max: 2, step: 0.01, fmt: v => v.toFixed(2) + ' s', def: 0.1 });
      sl('sustain', 'Hold level', { tip: 'Sustain: volume while you hold a note. 0 = plucky.', min: 0, max: 1, fmt: ui.pct, def: 0.8 });
      sl('resonance', 'Squelch', { tip: 'Filter resonance: a whistling peak at the cutoff.', min: 0, max: 1, fmt: ui.pct });
      sl('filterEnv', 'Pluck / zap', { tip: 'Filter envelope: each note starts bright and quickly darkens.', min: 0, max: 1, fmt: ui.pct });
      sl('vibrato', 'Pitch wobble', { tip: 'Vibrato depth.', min: 0, max: 1, fmt: ui.pct });
      sl('wobble', 'Filter wobble', { tip: 'An LFO moving the brightness up and down (dubstep-style "wub").', min: 0, max: 1, fmt: ui.pct });
      sl('fmAmount', 'Metallic (FM)', { tip: 'FM synthesis amount: makes bells, metallic and glassy tones.', min: 0, max: 8, step: 0.1, fmt: v => v.toFixed(1) });
      sl('fmRatio', 'Metallic ratio', { tip: 'FM ratio. Whole numbers sound musical, in-between sounds clangy.', min: 0, max: 8, step: 0.25, fmt: v => v ? v.toFixed(2) : 'off' });
      if (P.wave === 'pulse') sl('width', 'Pulse width', { min: 0.05, max: 0.5, step: 0.005, fmt: ui.pct, def: 0.25 });
      sl('volume', 'Synth level', { min: 0.05, max: 1, fmt: ui.pct, def: 0.4 });
    }
    if (P.wave === 'custom') {
      body.appendChild(h('p', { class: 'help' }, 'Harmonics: drag each bar to build your own waveform (left = lowest).'));
      const hs = h('div', { class: 'harm-sliders' });
      (P.harmonics || []).forEach((v, i) => {
        const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: v, 'aria-label': 'Harmonic ' + (i + 1) });
        inp.oninput = () => { P.harmonics[i] = +inp.value; };
        inp.onchange = commit;
        hs.appendChild(inp);
      });
      body.appendChild(hs);
    }
    body.appendChild(h('button', { class: 'btn small', style: { marginTop: '.5rem' }, onclick: () => ui.edit('Reset synth', () => { track.synth = CC.instruments.defaultSynthParams(track.instrument); }) }, '↺ Reset to "' + CC.instruments.SYNTHS[preset].name + '"'));
  }
  function userSampleCtl(body, track) {
    const id = track.instrument.slice(5);
    const s = CC.instruments.userSamples[id];
    if (!s) { body.appendChild(h('p', { class: 'help' }, 'This uploaded sound is missing. Open the song file that contains it, or upload it again.')); return; }
    body.append(h('h3', {}, 'Uploaded sound'));
    const root = h('select', { 'aria-label': 'Original note' }, Array.from({ length: 61 }, (_, i) => i + 36).map(p => h('option', { value: p, selected: s.root === p }, T.noteName(p))));
    root.onchange = () => ui.edit('Root note', (song) => { s.root = +root.value; song.samples[id].root = s.root; CC.storage.storeSample(id, s.name, s.bytes, s.root, s.mime); });
    body.appendChild(h('div', { class: 'ctrl', 'data-tip': 'The note your recording is at. Playing this note plays it at its original pitch.' }, h('label', {}, 'Original note'), root));
    body.appendChild(h('label', { class: 'toggle', 'data-tip': 'One-shot: always plays the whole sound at its original pitch, whichever key you press. Good for sound effects and voice clips.' },
      h('input', { type: 'checkbox', checked: !!track.oneShot, onchange: e => ui.edit('One-shot', () => { track.oneShot = e.target.checked; }) }), h('span', {}, 'Play as one-shot (no pitch change)')));
  }

  // ---------- Game ----------
  const STATES = [['exploration', '🌲', 'Exploration'], ['alert', '⚠️', 'Alert'], ['combat', '⚔️', 'Combat'], ['victory', '🏆', 'Victory']];
  function gameTab(body) {
    const song = S.song, sec = ui.section(), E = CC.engine;
    body.append(h('h3', {}, '🎮 Adaptive music preview'), h('p', { class: 'help' }, 'Pretend you are playing your game. Click a game state and hear the music switch over, right on the beat.'));
    const g = h('div', { class: 'state-grid' });
    STATES.forEach(([id, em, label]) => {
      const st = song.states[id];
      const target = song.sections.find(s => s.id === st.section);
      const active = E.playing && E.mode === 'adaptive' && E.gameState() === id;
      g.appendChild(h('button', { class: 'state-btn' + (active ? ' active' : ''), 'data-state': id, onclick: () => E.setGameState(id) }, h('b', {}, em + ' ' + label), h('small', {}, (target ? target.name : '?') + (st.once ? ' · plays once' : ' · loops'))));
    });
    body.appendChild(g);
    body.appendChild(h('div', { class: 'row', style: { marginTop: '.5rem' } },
      E.playing && E.mode === 'adaptive' ? h('button', { class: 'btn small', onclick: () => E.stop() }, '■ Stop preview') : null,
      h('label', { class: 'field', 'data-tip': 'When a game state changes, the music waits for this moment before switching, so it stays in rhythm.' }, h('span', {}, 'Switch at'),
        sel([['beat', 'next beat'], ['bar', 'next bar'], ['end', 'end of section'], ['now', 'right away']], E.quantize, v => { E.quantize = v; }))));
    body.appendChild(h('label', { class: 'toggle', style: { marginTop: '.3rem' }, 'data-tip': 'Hit a crash cymbal when the music switches. Hides the seam.' }, h('input', { type: 'checkbox', checked: E.crashOnSwitch, onchange: e => { E.crashOnSwitch = e.target.checked; } }), h('span', {}, 'Crash cymbal on switch')));
    const lv = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Intensity layers', style: { marginTop: '.5rem' } });
    [[0, 'Auto'], [1, 'Calm'], [2, 'Tense'], [3, 'Intense']].forEach(([v, l]) => lv.appendChild(h('button', { role: 'radio', 'aria-checked': String(E.adaptiveLevel === v), onclick: () => { E.setAdaptiveLevel(v); render(); } }, l)));
    body.appendChild(h('div', { class: 'ctrl', 'data-tip': 'Fade instrument layers in and out live, like a game raising the danger level. Auto uses each section\'s mood.' }, h('label', {}, 'Intensity layers (live)'), lv));

    body.append(h('h4', { class: 'muted', style: { margin: '.8rem 0 .3rem' } }, 'Which section plays for each state'));
    const cfg = h('div', { class: 'state-cfg' });
    STATES.forEach(([id, em, label]) => {
      const st = song.states[id];
      cfg.append(h('span', {}, em + ' ' + label),
        sel(song.sections.map(s => [s.id, s.name]), st.section, v => ui.edit('Game state', () => { st.section = v; })),
        h('label', { class: 'toggle', 'data-tip': 'Loop forever, or play once and stop (good for victory jingles).' }, h('input', { type: 'checkbox', checked: !st.once, onchange: e => ui.edit('Loop state', () => { st.once = !e.target.checked; }) }), h('small', {}, 'loop')));
    });
    body.appendChild(cfg);

    body.append(h('h3', {}, '🎚 Mood layers'), h('p', { class: 'help' }, 'Let instruments join in only when things get tense. Each section has a mood (dot color in Sections).'));
    body.appendChild(h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!song.layersFollowMood, onchange: e => ui.edit('Mood layers', () => { song.layersFollowMood = e.target.checked; }) }), h('span', {}, 'Layers follow section mood')));
    if (song.layersFollowMood) {
      song.tracks.forEach(t => body.appendChild(h('div', { class: 'row', style: { margin: '.3rem 0' } }, h('span', { style: { flex: 1 } }, t.name),
        sel([[1, 'always'], [2, 'tense +'], [3, 'intense only']], t.layer || 1, v => ui.edit('Layer', () => { t.layer = +v; })))));
    }

    body.append(h('h3', {}, '🔁 Loop tools'));
    const sd = CC.mix.stepDur(song), len = sec.bars * 16;
    body.appendChild(h('p', { class: 'help' }, `"${sec.name}" is ${sec.bars} bars = ${(len * sd).toFixed(2)} seconds = ${Math.round(len * sd * 44100).toLocaleString()} samples at 44.1 kHz.`));
    body.appendChild(h('button', { class: 'btn small', 'data-tip': 'Plays just the last bar and then the first bar, over and over, so you can hear if the loop joins smoothly.', onclick: () => { S.playMode = 'section'; E.play('seam'); ui.render(['top']); } }, '▶ Listen to the loop seam'));
    const over = [];
    const clips = CC.song.activeClips(sec);
    song.tracks.forEach(t => (clips[t.id] || []).forEach(n => { if (t.kind === 'melody' && n.s + n.l > len) over.push(n); }));
    if (over.length) {
      body.appendChild(h('div', { class: 'callout' }, `${over.length} note${over.length > 1 ? 's ring' : ' rings'} past the end of the loop. Game exports fold that into the start automatically, or you can trim them.`,
        h('div', {}, h('button', { class: 'btn small', style: { marginTop: '.3rem' }, onclick: () => ui.edit('Trim loop end', () => { over.forEach(n => { n.l = len - n.s; }); }) }, 'Trim them'))));
    } else body.appendChild(h('p', { class: 'help' }, '✓ No notes hang over the loop end.'));
    const drums = song.tracks.find(t => t.kind === 'drums' && !t.instrument.endsWith('sfx'));
    if (drums) body.appendChild(h('button', { class: 'btn small', style: { marginTop: '.3rem' }, 'data-tip': 'A drum fill at the end tells the player\'s ear "here we go again".', onclick: () => ui.edit('Add fill', () => { const c = CC.song.activeClips(sec); c[drums.id] = V.addFill(c[drums.id] || [], len); }) }, '💥 Add a drum fill that leads back to the start'));
    body.appendChild(h('div', { class: 'row', style: { marginTop: '.5rem' } }, h('button', { class: 'btn accent small', onclick: () => CC.modals.exportDialog('loop') }, '⬇ Export this loop'), h('button', { class: 'btn small', onclick: () => CC.modals.exportDialog('pack') }, '📦 Game-ready pack')));
  }
  function sel(options, value, onChange) {
    const s = h('select', {}, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
    s.onchange = () => onChange(s.value);
    return s;
  }
  CC.events.on('stateChanged', () => { if (S.sideTab === 'game' && ui.song()) render(); });
  CC.events.on('statePending', (st) => { $$('.state-btn').forEach(b => b.classList.toggle('pending', b.dataset.state === st)); });
  CC.events.on('playState', () => { if (S.sideTab === 'game' && ui.song()) render(); });

  // ---------- Code lab ----------
  const EXAMPLES = {
    'Bouncy 8-bit melody': `// A random melody that always stays in your key.
// Change the numbers and press Run again!
const lead = track('Code lead', 'synth:square');
lead.clear();
const notes = scale(5).slice(0, 8);   // 8 notes of your key, starting in octave 5
for (let s = 0; s < steps; s += 2) {
  if (random() < 0.7) lead.note(pick(notes), s, 2);
}`,
    'Euclidean drums': `// Spread hits evenly with euclid(hits, steps)
const d = track('Code drums', 'kit:chip');
d.clear();
d.hit('kick', euclid(5, 16));
d.hit('snare', [4, 12]);
d.hit('hat', euclid(11, 16), 0.5);`,
    'Design a synth from harmonics': `// Build a waveform from scratch: each number is the strength of a harmonic
const organ = track('My organ', 'synth:organ');
organ.synth({ wave: 'custom', harmonics: [1, 0, 0.5, 0, 0.3, 0, 0.2], attack: 0.05, release: 0.3, vibrato: 0.3, volume: 0.3 });
organ.clear();
['C', 'Am', 'F', 'G'].forEach((c, bar) => organ.chord(c, bar * 16, 16, 4));`,
    'Arpeggio over chords': `const arp = track('Arp', 'synth:pluck');
arp.clear();
const prog = ['Am', 'F', 'C', 'G'];
for (let bar = 0; bar < bars; bar++) {
  const notes = chord(prog[bar % prog.length], 4);
  for (let i = 0; i < 16; i++) {
    arp.note(notes[i % notes.length] + (i % 8 >= 4 ? 12 : 0), bar * 16 + i, 1, i % 4 ? 0.5 : 0.85);
  }
}`,
    'Laser zap sound': `// A sound effect synth. Play it on the keyboard below after running.
const zap = track('Zap', 'synth:saw');
zap.synth({ wave: 'sawtooth', attack: 0.001, decay: 0.15, sustain: 0, release: 0.1,
  brightness: 0.9, filterEnv: 1, resonance: 0.6, fmRatio: 0.5, fmAmount: 3, volume: 0.4 });
zap.clear();
zap.note('C6', 0, 1);`,
    'Use real instruments': `// Any instrument from the library works: 'gm:clarinet', 'gm:vibraphone', 'gm:trombone'...
const v = track('Vibes', 'gm:vibraphone');
v.clear();
v.notes([['C5', 0, 4], ['E5', 4, 4], ['G5', 8, 4], ['B5', 12, 4]]);
print(instruments().filter(i => i.startsWith('gm:')).slice(0, 12).join(', '));`
  };
  const API_DOC = `track(name, instrumentId?)  find or create an instrument
  .clear()                     remove its notes in this section
  .note(pitch, step, len=2, vel=0.8)   pitch: 'C5' or MIDI number
  .notes([[pitch, step, len], ...])
  .chord('Am' | [60,64,67], step, len, octave=4)
  .hit('kick'|'snare'|'hat'|row#, [steps], vel)   drums
  .synth({wave, attack, decay, sustain, release, brightness,
          resonance, filterEnv, detune, vibrato, wobble,
          fmRatio, fmAmount, harmonics, width, volume})
  .instrument('gm:flute') .volume(0.7)
bars, steps        length of the current section
scale(octave)      MIDI notes of your key
chord('F#m', oct)  MIDI notes of a chord
note('C4')         name -> MIDI number
euclid(hits, steps, rotate=0), random(), pick(array)
bpm(n), key('D', 'minor'), instruments(), print(...)
Steps are 1/16 notes: 0-15 is bar 1, 16-31 bar 2...`;

  let lastOut = null;
  function codeTab(body) {
    const song = S.song;
    body.append(h('h3', {}, '⌨ Code lab'), h('p', { class: 'help' }, 'Write JavaScript to generate notes and design synth sounds. It runs on the current section, and Ctrl+Z undoes it.'));
    const ex = sel([['', 'Load an example…'], ...Object.keys(EXAMPLES).map(k => [k, k])], '', v => { if (v) { area.value = EXAMPLES[v]; song.code = area.value; } });
    const area = h('textarea', { class: 'code-area', spellcheck: 'false', 'aria-label': 'Code' });
    area.value = song.code || EXAMPLES['Bouncy 8-bit melody'];
    area.addEventListener('input', () => { song.code = area.value; });
    area.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const s = area.selectionStart; area.setRangeText('  ', s, area.selectionEnd, 'end'); }
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); run(); }
      e.stopPropagation();
    });
    const out = h('div', { class: 'code-out' + (lastOut && lastOut.err ? ' err' : ''), hidden: !lastOut }, lastOut ? lastOut.text : '');
    function run() {
      const logs = [];
      try {
        ui.edit('Run code', () => runCode(area.value, logs));
        lastOut = { text: '✓ Done. Press Play to hear it.' + (logs.length ? '\n' + logs.join('\n') : ''), err: false };
      } catch (e) {
        // Throw away anything the code half-changed before the error
        S.song = CC.song.normalize(CC.song.lastCommitted());
        S.song.code = area.value;
        CC.engine.setSong(S.song);
        lastOut = { text: '✗ ' + e.message + (logs.length ? '\n' + logs.join('\n') : ''), err: true };
      }
      ui.render();
    }
    body.append(ex, area, h('div', { class: 'row', style: { marginTop: '.4rem' } }, h('button', { class: 'btn accent small', onclick: run }, '▶ Run (Ctrl+Enter)'), h('button', { class: 'btn small', onclick: () => CC.engine.play('section') }, 'Play section')), out,
      h('details', { class: 'api' }, h('summary', {}, 'What can I use?'), h('pre', {}, API_DOC)));
  }

  function runCode(code, logs) {
    const song = S.song, sec = ui.section();
    const toP = (x) => typeof x === 'number' ? x : T.parseNote(x);
    function trackApi(t) {
      const clip = () => CC.song.clipOf(sec, t.id);
      const rowIdx = (r) => {
        if (typeof r === 'number') return r;
        const rows = CC.instruments.kitRows(t);
        const i = rows.findIndex(x => x.id === r || x.name.toLowerCase().startsWith(String(r).toLowerCase()));
        if (i < 0) throw new Error(`No drum called "${r}". Try: ${rows.map(x => x.id).join(', ')}`);
        return i;
      };
      const api = {
        clear() { CC.song.activeClips(sec)[t.id] = []; return api; },
        note(p, s, l = 2, v = 0.8) { clip().push({ s: Math.round(s), p: toP(p), l: Math.max(1, Math.round(l)), v }); return api; },
        notes(list) { list.forEach(n => api.note(...n)); return api; },
        chord(c, s, l = 16, oct = 4, v = 0.7) { const ps = Array.isArray(c) ? c.map(toP) : chordNotes(c, oct); ps.forEach(p => api.note(p, s, l, v)); return api; },
        hit(r, steps, v = 0.8) { const i = rowIdx(r); (Array.isArray(steps) ? steps : [steps]).forEach(s => clip().push({ s, p: i, l: 1, v })); return api; },
        synth(p) { if (!t.instrument.startsWith('synth:')) t.instrument = 'synth:square'; t.synth = Object.assign({}, t.synth || {}, p); return api; },
        instrument(id) { t.instrument = id; t.kind = id.startsWith('kit:') ? 'drums' : 'melody'; if (id.startsWith('synth:')) t.synth = CC.instruments.defaultSynthParams(id); return api; },
        volume(v) { t.volume = v; return api; },
        get id() { return t.id; }
      };
      return api;
    }
    function chordNotes(name, oct = 4) { const c = T.chordFromName(name); const root = (oct + 1) * 12 + c.rootPc; return c.intervals.map(i => root + i); }
    const env = {
      song, bars: sec.bars, steps: sec.bars * 16,
      track(name, inst) {
        let t = song.tracks.find(x => x.name === name);
        if (!t) { t = CC.song.newTrack(song, inst || 'synth:square', name); song.tracks.push(t); CC.instruments.ensureLoaded([t.instrument]); }
        else if (inst && inst !== t.instrument) trackApi(t).instrument(inst);
        S.selTrackId = t.id;
        return trackApi(t);
      },
      scale(oct = 4) { const lo = (oct + 1) * 12; return T.scaleNotes(song.key, song.scale, lo, lo + 23); },
      chord: chordNotes,
      note: (n) => T.parseNote(n),
      euclid(k, n, rot = 0) { const out = []; for (let i = 0; i < n; i++) if (Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) || i === 0) out.push((i + rot) % n); return out.slice(0, k).sort((a, b) => a - b); },
      random: Math.random,
      pick: (a) => a[Math.floor(Math.random() * a.length)],
      bpm(n) { song.bpm = n; },
      key(k, sc) { song.key = k; if (sc) song.scale = sc; },
      instruments: () => CC.instruments.catalog().map(i => i.id),
      print: (...a) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
      console: { log: (...a) => logs.push(a.join(' ')) }
    };
    const fn = new Function(...Object.keys(env), code);
    fn(...Object.values(env));
    song.tracks.forEach(t => { const c = CC.song.activeClips(sec)[t.id]; if (c) CC.song.activeClips(sec)[t.id] = CC.song.dedupe(c.filter(n => n.s >= 0 && n.p >= 0 && n.p <= 127)); });
  }

  function init() {
    $$('#side-tabs [data-tab]').forEach(b => b.addEventListener('click', () => { S.sideTab = b.dataset.tab; render(); }));
  }
  CC.side = { init, render, runCode };
})(window.CC);
