// Playable on-screen instruments: piano keyboard, guitar/bass fretboard, drum pads. Computer keyboard playing and live recording.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, T = CC.theory, S = ui.state;
  const LOWER = 'zsxdcvgbhnjm,';
  const UPPER = 'q2w3er5t6y7ui9o0p';
  const PAD_KEYS = '1234qwerasdfzxcv';
  const GUITAR = [64, 59, 55, 50, 45, 40], BASS = [43, 38, 33, 28];
  let pointerDown = false;
  const keyHeld = {};

  function surfaceView(track) {
    if (!track) return 'none';
    if (track.kind === 'drums') return 'pads';
    return track.view === 'guitar' || track.view === 'bass' ? track.view : 'piano';
  }
  function playPitch(track, p) {
    if (track.kind !== 'drums' && S.song.stayInKey) p = T.snapToScale(p, S.song.key, S.song.scale);
    return p;
  }

  function renderBar() {
    const bar = $('#surface-bar'); bar.innerHTML = '';
    const track = ui.track(); if (!track) return;
    const view = surfaceView(track);
    bar.appendChild(h('b', {}, '🎵 Play ' + track.name + ':'));
    if (track.kind !== 'drums') {
      const seg = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Instrument view' });
      [['piano', '🎹 Piano'], ['guitar', '🎸 Guitar'], ['bass', 'Bass guitar']].forEach(([v, l]) => seg.appendChild(h('button', { role: 'radio', 'aria-checked': String(view === v), 'data-tip': v === 'piano' ? 'Play on piano keys' : v === 'guitar' ? 'Play on a 6-string guitar neck. Dots show notes in your key, orange dots are the home note.' : 'Play on a 4-string bass neck.', onclick: () => ui.edit('Change view', () => { track.view = v; }, ['surface']) }, l)));
      bar.appendChild(seg);
      if (view === 'piano') {
        bar.appendChild(h('span', { class: 'row', style: { gap: '.25rem' } },
          h('button', { class: 'btn small', 'aria-label': 'Octave down', 'data-tip': 'Lower octave (also moves the simple grid down)', onclick: () => ui.edit('Octave', () => { track.octave = Math.max(0, track.octave - 1); }, ['surface', 'editor']) }, '◀'),
          h('span', { class: 'muted', 'data-tip': 'The octave your computer keys play. Dots on the piano show which keys they are.' }, 'Octave ' + track.octave),
          h('button', { class: 'btn small', 'aria-label': 'Octave up', 'data-tip': 'Higher octave', onclick: () => ui.edit('Octave', () => { track.octave = Math.min(7, track.octave + 1); }, ['surface', 'editor']) }, '▶')));
      }
    }
    if (view !== 'pads') {
      const isPiano = view === 'piano';
      const zoom = (d) => { S.pianoZoom = Math.max(0, Math.min(ZOOM_NAMES.length - 1, S.pianoZoom + d)); CC.storage.setting('pianoZoom', S.pianoZoom); renderBar(); renderBody(); };
      bar.appendChild(h('span', { class: 'row zoom-ctl', style: { gap: '.2rem' }, 'data-tip': isPiano ? 'Key size. Full fits all 88 keys across the screen; L, XL, XXL and Huge show fewer octaves with bigger keys (use the octave arrows to move around).' : 'Fret size. Full fits the whole neck across the screen; L, XL, XXL and Huge show fewer, wider frets (scroll sideways to reach the high frets).' },
        h('button', { class: 'btn small', 'aria-label': isPiano ? 'Smaller keys' : 'Smaller frets', disabled: S.pianoZoom === 0, onclick: () => zoom(-1) }, '🔍−'),
        h('span', { class: 'muted zoom-lbl' }, (isPiano ? 'Keys ' : 'Frets ') + ZOOM_NAMES[S.pianoZoom]),
        h('button', { class: 'btn small', 'aria-label': isPiano ? 'Bigger keys' : 'Bigger frets', disabled: S.pianoZoom === ZOOM_NAMES.length - 1, onclick: () => zoom(1) }, '🔍+')));
    }
    if (track.kind !== 'drums') bar.appendChild(h('button', { class: 'btn small' + (CC.engine.sustain ? ' on' : ''), 'aria-pressed': String(!!CC.engine.sustain), 'data-tip': 'Sustain: like a piano pedal. On, notes keep ringing after you let go of a key. Off, they stop when you let go. Only affects what you play live.', onclick: () => { CC.engine.sustain = !CC.engine.sustain; CC.storage.setting('sustain', CC.engine.sustain); renderBar(); } }, '〰 Sustain'));
    bar.appendChild(h('button', { class: 'btn small rec-btn' + (CC.engine.record ? ' on' : ''), 'aria-pressed': String(CC.engine.record), 'data-tip': 'Record: while the section plays, whatever you play gets added to the loop (snapped to the grid). Press play first.', 'data-ex': 'Press Record, then Play, then tap keys along with the beat.', onclick: () => { CC.engine.record = !CC.engine.record; if (CC.engine.record && !CC.engine.playing) CC.engine.play(S.playMode); renderBar(); } }, '● Record'));
    bar.appendChild(h('label', { class: 'toggle', 'data-tip': 'Play a click on every beat to help you keep time.' }, h('input', { type: 'checkbox', checked: CC.engine.metronome, onchange: (e) => { CC.engine.metronome = e.target.checked; } }), h('span', {}, 'Click track')));
    const collapsed = $('.surface').classList.contains('collapsed');
    bar.appendChild(h('button', { class: 'btn small', 'aria-expanded': String(!collapsed), 'data-tip': 'Hide or show the playable instrument to give the grid more room.', onclick: () => { $('.surface').classList.toggle('collapsed'); CC.storage.setting('surfaceCollapsed', $('.surface').classList.contains('collapsed')); renderBar(); renderBody(); CC.editor.render(); } }, collapsed ? '▴ Show' : '▾ Hide'));
    if (!collapsed) bar.appendChild(h('span', { class: 'faint' }, track.kind === 'drums' ? 'Tip: use keys 1-4, Q-R, A-F, Z-V to drum.' : 'Tip: play with your computer keys: Z S X D C V… (low) and Q 2 W 3 E… (high).' + (S.song.stayInKey ? ' Stay in key is on, so your computer keys always land on good notes.' : '')));
  }

  function renderBody() {
    const body = $('#surface-body'); body.innerHTML = '';
    const track = ui.track(); if (!track) return;
    const view = surfaceView(track);
    const el = view === 'pads' ? pads(track) : view === 'piano' ? piano(track) : fretboard(track, view === 'bass' ? BASS : GUITAR);
    // iPad: stop the system from treating several fingers as a zoom or scroll gesture, so chords work
    el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    body.appendChild(el);
  }

  function bindPress(el, track, getPitch) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); pointerDown = true;
      if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (el._p !== undefined) return; // already sounding (a finger slid onto it)
      const p = getPitch(); el._p = p; CC.engine.noteOn(track, p);
    });
    el.addEventListener('pointerenter', () => { if (pointerDown && el._p === undefined) { const p = getPitch(); el._p = p; CC.engine.noteOn(track, p); } });
    const off = () => { if (el._p !== undefined) { CC.engine.noteOff(track, el._p); el._p = undefined; } };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
  }
  addEventListener('pointerup', () => { pointerDown = false; });

  // Zoom always starts from "Full" (everything fills the width) and only gets bigger from there.
  // Each step says how much fits on screen: white piano keys, or guitar/bass frets.
  const ZOOM_NAMES = ['Full', 'L', 'XL', 'XXL', 'Huge'];
  const ZOOM_WHITES = [52, 29, 22, 15, 8]; // about 7, 4, 3, 2 and 1 octaves
  const ZOOM_FRETS = [0, 15, 11, 8, 5]; // 0 = the whole neck
  // Full 88-key piano (A0 to C8), scrollable. Clicked keys play exactly the note pressed.
  function piano(track) {
    // Whole piano fits the window by default; "Bigger keys" makes it scrollable with larger keys
    const bodyW = ($('#surface-body') || {}).clientWidth || 0;
    const WHITE_W = bodyW < 300 ? 36 : Math.max(14, Math.floor((bodyW - 24) / ZOOM_WHITES[S.pianoZoom]));
    const BLACK_W = Math.round(WHITE_W * 0.62);
    const narrow = WHITE_W < 26;
    const wrap = h('div', { class: 'piano', role: 'group', 'aria-label': 'Piano keyboard' });
    const base = (track.octave + 1) * 12;
    const lo = 21, hi = 108;
    const keyFor = (p) => { const d = p - base; if (d >= 0 && d < LOWER.length) return LOWER[d]; if (d >= 12 && d - 12 < UPPER.length) return UPPER[d - 12]; return ''; };
    const song = S.song;
    let wi = 0;
    for (let p = lo; p <= hi; p++) {
      const inKey = T.inScale(p, song.key, song.scale);
      const label = keyFor(p) && !narrow ? h('kbd', {}, keyFor(p).toUpperCase()) : null;
      if (T.isBlack(p)) {
        const b = h('button', { class: 'bkey' + (!inKey ? ' out' : ''), 'data-p': p, 'aria-label': T.noteName(p), tabindex: -1, style: { left: (wi * WHITE_W - BLACK_W / 2) + 'px', width: BLACK_W + 'px' } }, label);
        bindPress(b, track, () => p);
        wrap.appendChild(b);
      } else {
        const root = (p - T.keyIndex(song.key)) % 12 === 0;
        const k = h('button', { class: 'wkey' + (!inKey ? ' out' : '') + (root ? ' root' : ''), 'data-p': p, 'aria-label': T.noteName(p), tabindex: -1, style: { left: (wi * WHITE_W) + 'px', width: WHITE_W + 'px' } },
          h('span', {}, narrow ? (p % 12 === 0 ? T.noteName(p) : (keyFor(p) ? '•' : '')) : T.noteName(p, (p % 12) === 0)), label);
        bindPress(k, track, () => p);
        wrap.appendChild(k);
        wi++;
      }
    }
    wrap.style.width = (wi * WHITE_W) + 'px';
    // Scroll so the octave your computer keys play is in view
    let whitesBefore = 0;
    for (let p = lo; p < base; p++) if (!T.isBlack(p)) whitesBefore++;
    requestAnimationFrame(() => { const body = $('#surface-body'); if (body) body.scrollLeft = Math.max(0, whitesBefore * WHITE_W - 24); });
    return wrap;
  }

  function fretboard(track, tuning) {
    const FRETS = tuning.length > 4 ? 22 : 20; // a typical electric guitar has 22 frets, a bass 20
    const fb = h('div', { class: 'fretboard', role: 'group', 'aria-label': 'Fretboard' });
    fb.style.gridTemplateColumns = `3rem repeat(${FRETS}, 1fr)`;
    // Zoomed in: fewer frets fill the width, the rest scroll sideways
    if (S.pianoZoom) fb.style.width = fb.style.minWidth = `calc(3rem + (100% - 3rem) * ${FRETS / ZOOM_FRETS[S.pianoZoom]})`;
    fb.style.gridTemplateRows = `repeat(${tuning.length}, 1fr)`;
    const song = S.song;
    tuning.forEach(open => {
      for (let f = 0; f <= FRETS; f++) {
        const p = open + f;
        const inKey = T.inScale(p, song.key, song.scale);
        const root = (p - T.keyIndex(song.key)) % 12 === 0;
        const b = h('button', { class: 'fret' + (f === 0 ? ' open' : '') + (inKey ? ' in' : '') + (root ? ' rootn' : ''), 'data-p': p, title: T.noteName(p), tabindex: -1, 'aria-label': T.noteName(p) },
          h('span', {}, f === 0 ? T.noteName(p, false) : ([3, 5, 7, 9, 12, 15, 17, 19, 21].includes(f) && open === tuning[tuning.length - 1] ? String(f) : '')));
        bindPress(b, track, () => p);
        fb.appendChild(b);
      }
    });
    return fb;
  }

  function pads(track) {
    const wrap = h('div', { class: 'pads', role: 'group', 'aria-label': 'Drum pads' });
    CC.instruments.kitRows(track).forEach((r, i) => {
      const b = h('button', { class: 'pad', 'data-p': i, tabindex: -1, style: { borderColor: track.color + '88' } }, h('span', {}, r.name), PAD_KEYS[i] ? h('kbd', {}, PAD_KEYS[i].toUpperCase()) : null);
      bindPress(b, track, () => i);
      wrap.appendChild(b);
    });
    return wrap;
  }

  CC.events.on('liveNote', (trackId, p, on) => {
    const t = ui.track(); if (!t || t.id !== trackId) return;
    $$(`#surface-body [data-p="${p}"]`).forEach(el => el.classList.toggle('down', on));
  });

  // Recording: collect notes, commit in small batches
  let recTimer = null;
  CC.events.on('recordedNote', (n) => {
    const song = S.song;
    const sec = song.sections.find(s => s.id === n.sectionId);
    if (!sec) return;
    const clip = CC.song.clipOf(sec, n.trackId);
    const ex = clip.find(m => m.s === n.s && m.p === n.p);
    if (ex) ex.l = Math.max(ex.l, n.l); else clip.push({ s: n.s, p: n.p, l: n.l, v: n.v });
    CC.editor.draw();
    clearTimeout(recTimer);
    recTimer = setTimeout(() => ui.commitOnly('Record notes', ['editor', 'tracks']), 400);
  });

  // Computer keyboard
  function keyToPitch(track, key) {
    if (track.kind === 'drums') { const i = PAD_KEYS.indexOf(key); return i >= 0 && i < CC.instruments.kitRows(track).length ? i : null; }
    const base = (track.octave + 1) * 12;
    let i = LOWER.indexOf(key); if (i >= 0) return playPitch(track, base + i);
    i = UPPER.indexOf(key); if (i >= 0) return playPitch(track, base + 12 + i);
    return null;
  }
  function onKeyDown(e) {
    const track = ui.track(); if (!track) return false;
    const k = e.key.toLowerCase();
    const p = keyToPitch(track, k);
    if (p === null) return false;
    if (!keyHeld[k]) { keyHeld[k] = { p, track }; CC.engine.noteOn(track, p); }
    return true;
  }
  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    const held = keyHeld[k];
    if (!held) return false;
    delete keyHeld[k];
    CC.engine.noteOff(held.track, held.p);
    return true;
  }
  addEventListener('blur', () => { for (const k of Object.keys(keyHeld)) { CC.engine.noteOff(keyHeld[k].track, keyHeld[k].p); delete keyHeld[k]; } });

  ui.registerRenderer('surface', () => { renderBar(); renderBody(); });
  const z = CC.storage.setting('pianoZoom');
  S.pianoZoom = Math.max(0, Math.min(4, z === null ? (CC.storage.setting('pianoBig') ? 2 : 0) : +z || 0));
  CC.engine.sustain = !!CC.storage.setting('sustain');
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (CC.ui.song() && !$('#app').hidden) renderBody(); }, 150); });
  CC.surface = { onKeyDown, onKeyUp, renderBar };
})(window.CC);
