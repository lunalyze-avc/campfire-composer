// Top bar, instrument (track) list, and timeline (sections + song order).
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, T = CC.theory, S = ui.state;
  const MOOD_LABEL = { calm: 'Calm', tense: 'Tense', intense: 'Intense' };

  // ---------- Top bar ----------
  function initTopbar() {
    const keySel = $('#key-sel');
    T.FLAT_NAMES.forEach(n => keySel.appendChild(h('option', { value: n }, n)));
    const scaleSel = $('#scale-sel');
    Object.entries(T.SCALES).forEach(([k, v]) => scaleSel.appendChild(h('option', { value: k }, v.name)));
    $('#song-name').addEventListener('change', e => ui.edit('Rename song', s => { s.name = e.target.value.trim() || 'Untitled song'; }, ['top']));
    $('#bpm').addEventListener('change', e => ui.edit('Tempo', s => { s.bpm = Math.max(40, Math.min(240, +e.target.value || 110)); }, ['top']));
    keySel.addEventListener('change', e => ui.edit('Change key', s => changeKey(s, e.target.value)));
    scaleSel.addEventListener('change', e => ui.edit('Change scale', s => changeScale(s, e.target.value)));
    $('#stay-key').addEventListener('change', e => ui.edit('Stay in key', s => { s.stayInKey = e.target.checked; }));
    $('#play-btn').addEventListener('click', () => CC.engine.toggle(S.playMode));
    $$('[data-playmode]').forEach(b => b.addEventListener('click', () => {
      S.playMode = b.dataset.playmode;
      const wasPlaying = CC.engine.playing;
      if (wasPlaying) CC.engine.play(S.playMode);
      renderTop();
    }));
    $$('[data-level]').forEach(b => b.addEventListener('click', () => { S.level = b.dataset.level; CC.storage.setting('level', S.level); ui.render(); }));
    $('#undo-btn').addEventListener('click', ui.undo);
    $('#redo-btn').addEventListener('click', ui.redo);
    $('#new-btn').addEventListener('click', () => CC.modals.newSong());
    $('#save-btn').addEventListener('click', () => CC.modals.save());
    $('#open-btn').addEventListener('click', () => $('#file-open').click());
    $('#export-btn').addEventListener('click', () => CC.modals.exportDialog());
    $('#settings-btn').addEventListener('click', () => CC.modals.settings());
    $('#help-btn').addEventListener('click', () => CC.modals.help());
    $('#home-btn').addEventListener('click', () => { CC.engine.stop(); CC.storage.saveNow(S.song); CC.start.show(); });
    CC.events.on('playState', () => renderTop());
  }
  function changeKey(song, newKey) {
    let d = T.keyIndex(newKey) - T.keyIndex(song.key);
    if (d > 6) d -= 12; if (d < -6) d += 12;
    song.key = newKey;
    forEachMelodicNote(song, n => { n.p += d; });
    ui.toast(`Moved your notes to the key of ${newKey}.`);
  }
  function changeScale(song, newScale) {
    const oldSteps = T.scaleSteps(song.scale), newSteps = T.scaleSteps(newScale);
    const k = T.keyIndex(song.key);
    const oldScale = song.scale;
    song.scale = newScale;
    if (newScale === 'chromatic' || oldScale === 'chromatic') return;
    forEachMelodicNote(song, n => {
      const rel = ((n.p - k) % 12 + 12) % 12, oct = Math.floor((n.p - k) / 12);
      const deg = oldSteps.indexOf(rel);
      if (deg >= 0 && oldSteps.length === newSteps.length) n.p = k + oct * 12 + newSteps[deg];
      else n.p = T.snapToScale(n.p, song.key, newScale);
    });
    ui.toast('Changed the mood scale. Your notes were moved to fit.');
  }
  function forEachMelodicNote(song, fn) {
    const melodic = new Set(song.tracks.filter(t => t.kind === 'melody').map(t => t.id));
    song.sections.forEach(sec => [sec.clips, sec.clipsB].filter(Boolean).forEach(c => Object.entries(c).forEach(([id, notes]) => { if (melodic.has(id)) notes.forEach(fn); })));
  }

  function renderTop() {
    const s = S.song;
    const name = $('#song-name'); if (document.activeElement !== name) name.value = s.name;
    const bpm = $('#bpm'); if (document.activeElement !== bpm) bpm.value = s.bpm;
    $('#key-sel').value = T.FLAT_NAMES[T.keyIndex(s.key)];
    $('#scale-sel').value = s.scale;
    $('#stay-key').checked = !!s.stayInKey;
    $('#undo-btn').disabled = !CC.song.canUndo();
    $('#redo-btn').disabled = !CC.song.canRedo();
    $$('[data-playmode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.playmode === S.playMode)));
    $$('[data-level]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.level === S.level)));
    const pb = $('#play-btn');
    pb.textContent = CC.engine.playing ? '■ Stop' : '▶ Play';
    pb.classList.toggle('playing', CC.engine.playing);
    document.title = s.name + ' - Campfire Composer';
  }
  ui.registerRenderer('top', renderTop);

  // ---------- Instruments (tracks) ----------
  function renderTracks() {
    const list = $('#track-list'); list.innerHTML = '';
    const song = S.song, sec = ui.section();
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Instruments');
    song.tracks.forEach((t, i) => {
      const info = CC.instruments.info(t.instrument);
      const sel = t.id === (ui.track() || {}).id;
      const gated = song.layersFollowMood && (t.layer || 1) > CC.mix.moodLevel(sec.mood);
      const count = (CC.song.activeClips(sec)[t.id] || []).length;
      const el = h('div', { class: 'track' + (gated ? ' gated' : ''), role: 'option', 'aria-selected': String(sel), tabindex: 0, 'aria-label': `${t.name}, ${info.name}${t.mute ? ', muted' : ''}` },
        h('div', { class: 'stripe', style: { background: t.color } }),
        h('div', { class: 'tname', title: t.name }, t.name, count ? h('span', { class: 'faint' }, ' · ' + count) : null),
        h('div', { class: 'tbtns' },
          h('button', { class: 'mute' + (t.mute ? ' on' : ''), 'aria-pressed': String(!!t.mute), 'data-tip': 'Mute: silence this instrument', onclick: (e) => { e.stopPropagation(); ui.edit('Mute', () => { t.mute = !t.mute; }, ['tracks']); } }, 'M'),
          h('button', { class: 'solo' + (t.solo ? ' on' : ''), 'aria-pressed': String(!!t.solo), 'data-tip': 'Solo: hear only this instrument (and other soloed ones)', onclick: (e) => { e.stopPropagation(); ui.edit('Solo', () => { t.solo = !t.solo; }, ['tracks']); } }, 'S'),
          h('button', { 'aria-label': 'More options for ' + t.name, 'data-tip': 'Rename, duplicate, move or delete', onclick: (e) => { e.stopPropagation(); trackMenu(e.currentTarget, t, i); } }, '⋯')),
        h('button', { class: 'tinst', 'data-tip': 'Click to swap this instrument for another sound. Your notes stay the same.', onclick: (e) => { e.stopPropagation(); CC.modals.library({ trackId: t.id }); } },
          (t.kind === 'drums' ? '🥁 ' : '🎵 ') + info.name + (CC.instruments.isReady(t.instrument) ? '' : ' (loading…)') + ' ▾'),
        h('div', { class: 'tvol' }, '🔈',
          h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: t.volume, 'aria-label': t.name + ' volume', onclick: e => e.stopPropagation(),
            oninput: (e) => { t.volume = +e.target.value; CC.engine.refreshMix(); }, onchange: () => ui.commitOnly('Volume', []) }),
          song.layersFollowMood ? h('span', { class: 'layer-badge mood-' + ['', 'calm', 'tense', 'intense'][t.layer || 1], 'data-tip': 'Mood layer: which sections this instrument plays in. Change it in the Game tab.' }, ['', 'all', 'tense+', 'intense'][t.layer || 1]) : null));
      el.addEventListener('click', () => ui.selectTrack(t.id));
      el.addEventListener('dblclick', (e) => { if (e.target.closest('.tname')) rename(t); });
      el.addEventListener('keydown', (e) => {
        if (e.target !== el) return;
        if (e.key === 'Enter') ui.selectTrack(t.id);
        if (e.key === 'ArrowDown' && el.nextSibling) { e.preventDefault(); el.nextSibling.focus(); }
        if (e.key === 'ArrowUp' && el.previousSibling) { e.preventDefault(); el.previousSibling.focus(); }
      });
      list.appendChild(el);
    });
    if (!song.tracks.length) list.appendChild(h('p', { class: 'muted', style: { padding: '.5rem' } }, 'No instruments yet.'));
  }
  function rename(t) { ui.prompt('Rename instrument', t.name, v => ui.edit('Rename', () => { t.name = v; })); }
  function trackMenu(anchor, t, i) {
    const song = S.song;
    ui.menu(anchor, [
      { label: '✏️ Rename', action: () => rename(t) },
      { label: '🎻 Change sound', action: () => CC.modals.library({ trackId: t.id }) },
      { label: '🎨 Color', action: () => ui.pickColor('Color for ' + t.name, t.color, CC.song.COLORS, c => ui.edit('Instrument color', () => { t.color = c; }, ['tracks', 'editor', 'side'])) },
      { label: '⧉ Duplicate', action: () => ui.edit('Duplicate instrument', () => {
        const c = CC.song.clone(t); c.id = CC.song.uid('t'); c.name = t.name + ' copy'; c.color = CC.song.COLORS[song.tracks.length % CC.song.COLORS.length];
        song.tracks.splice(i + 1, 0, c);
        song.sections.forEach(s => { if (s.clips[t.id]) s.clips[c.id] = CC.song.clone(s.clips[t.id]); if (s.clipsB && s.clipsB[t.id]) s.clipsB[c.id] = CC.song.clone(s.clipsB[t.id]); });
        S.selTrackId = c.id;
      }) },
      { label: '↑ Move up', action: () => ui.edit('Move', () => { if (i > 0) song.tracks.splice(i - 1, 0, song.tracks.splice(i, 1)[0]); }) },
      { label: '↓ Move down', action: () => ui.edit('Move', () => { if (i < song.tracks.length - 1) song.tracks.splice(i + 1, 0, song.tracks.splice(i, 1)[0]); }) },
      '-',
      { label: '🗑 Delete instrument', danger: true, action: () => ui.confirm('Delete instrument?', `Delete "${t.name}" and its notes in every section? You can undo this.`, 'Delete', () => ui.edit('Delete instrument', () => {
        song.tracks.splice(i, 1);
        song.sections.forEach(s => { delete s.clips[t.id]; if (s.clipsB) delete s.clipsB[t.id]; });
        if (S.selTrackId === t.id) S.selTrackId = (song.tracks[0] || {}).id;
      })) }
    ]);
  }
  ui.registerRenderer('tracks', renderTracks);

  // Add a track with a given instrument
  ui.addTrack = function (instrumentId, name) {
    ui.edit('Add instrument', (song) => {
      const t = CC.song.newTrack(song, instrumentId, name);
      song.tracks.push(t);
      S.selTrackId = t.id;
    });
    CC.instruments.ensureLoaded([instrumentId]).then(() => ui.render(['tracks', 'editor']));
    CC.editor.scrollToNotes();
  };

  // ---------- Timeline ----------
  function renderTimeline() {
    const song = S.song;
    const list = $('#section-list'); list.innerHTML = '';
    song.sections.forEach((sec, i) => {
      const sel = sec.id === ui.section().id;
      const card = h('div', { class: 'sec-card', role: 'option', tabindex: 0, 'aria-selected': String(sel), 'aria-label': `${sec.name}, ${sec.bars} bars, ${sec.mood}` },
        h('span', { class: 'mood-dot', style: { background: CC.song.secColor(song, sec) }, 'data-tip': 'Mood: ' + MOOD_LABEL[sec.mood] + '. Change its color in the ⋯ menu.' }),
        h('span', { class: 'nm' }, sec.name),
        h('span', { class: 'meta' }, sec.bars + (sec.bars === 1 ? ' bar' : ' bars')),
        sec.clipsB ? h('span', { class: 'ab', 'data-tip': 'This section has A and B versions. Showing ' + sec.showing + '.' }, sec.showing) : null,
        h('button', { class: 'menu-btn', 'aria-label': 'Options for ' + sec.name, onclick: (e) => { e.stopPropagation(); sectionMenu(e.currentTarget, sec, i); } }, '⋯'));
      card.addEventListener('click', () => ui.selectSection(sec.id));
      card.addEventListener('dblclick', () => renameSection(sec));
      card.draggable = true;
      card.setAttribute('data-tip', 'Click to edit. Drag it down into the song order to add it there.');
      card.addEventListener('dragstart', (e) => { dragIndex = null; dragSection = sec.id; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', sec.name); });
      card.addEventListener('dragend', () => { dragSection = null; });
      card.addEventListener('keydown', e => {
        if (e.target !== card) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.selectSection(sec.id); }
        if (e.key === 'ArrowRight' && card.nextSibling) card.nextSibling.focus();
        if (e.key === 'ArrowLeft' && card.previousSibling) card.previousSibling.focus();
      });
      list.appendChild(card);
    });
    list.appendChild(h('button', { class: 'btn small add-chip', id: 'sec-new', 'data-tip': 'Add a new empty section', onclick: () => ui.newSection() }, '＋ New'));
    list.appendChild(h('button', { class: 'btn small add-chip', id: 'sec-dup', 'data-tip': 'Copy this section so you can change the copy (Ctrl+D)', onclick: () => ui.duplicateSection() }, '⧉ Duplicate'));
    renderArrangement();
  }
  function renameSection(sec) { ui.prompt('Rename section', sec.name, v => ui.edit('Rename section', () => { sec.name = v; })); }
  function sectionMenu(anchor, sec, i) {
    const song = S.song;
    ui.menu(anchor, [
      { label: '✏️ Rename', action: () => renameSection(sec) },
      { label: '🎨 Color', action: () => ui.pickColor('Color for ' + sec.name, CC.song.secColor(song, sec), CC.song.SECTION_COLORS, c => ui.edit('Section color', () => { sec.color = c; }, ['timeline', 'wave'])) },
      { label: '➕ Add to end of song order', action: () => ui.edit('Add to song', () => { song.arrangement.push(sec.id); }) },
      { label: '⧉ Duplicate', action: () => duplicateSection(sec) },
      { label: '📋 Copy all its notes', action: () => { sectionClipboard = { bars: sec.bars, clips: CC.song.clone(CC.song.activeClips(sec)) }; ui.toast(`Copied "${sec.name}". Open another section's ⋯ menu and choose Paste.`); } },
      sectionClipboard ? { label: '📥 Paste copied notes here (replace)', action: () => ui.edit('Paste section', () => {
        const c = CC.song.clone(sectionClipboard.clips);
        if (sec.showing === 'B' && sec.clipsB) sec.clipsB = c; else sec.clips = c;
        if (sectionClipboard.bars > sec.bars) sec.bars = sectionClipboard.bars;
      }) } : null,
      sectionClipboard ? { label: '➕ Paste copied notes on top (merge)', action: () => ui.edit('Merge section', () => {
        const target = CC.song.activeClips(sec);
        for (const [id, ns] of Object.entries(sectionClipboard.clips)) target[id] = CC.song.dedupe((target[id] || []).concat(CC.song.clone(ns)));
        if (sectionClipboard.bars > sec.bars) sec.bars = sectionClipboard.bars;
      }) } : null,
      '-',
      { label: '🔵 Mood: calm', action: () => ui.edit('Mood', () => { sec.mood = 'calm'; }) },
      { label: '🟡 Mood: tense', action: () => ui.edit('Mood', () => { sec.mood = 'tense'; }) },
      { label: '🔴 Mood: intense', action: () => ui.edit('Mood', () => { sec.mood = 'intense'; }) },
      '-',
      { label: '🗑 Delete section', danger: true, action: () => {
        if (song.sections.length < 2) { ui.toast('You need at least one section.'); return; }
        ui.confirm('Delete section?', `Delete "${sec.name}"? You can undo this.`, 'Delete', () => ui.edit('Delete section', () => {
          song.sections.splice(i, 1);
          song.arrangement = song.arrangement.filter(id => id !== sec.id);
          if (!song.arrangement.length) song.arrangement = [song.sections[0].id];
          for (const st of Object.values(song.states)) if (st.section === sec.id) st.section = song.sections[0].id;
          if (S.selSectionId === sec.id) S.selSectionId = song.sections[0].id;
        }));
      } }
    ]);
  }
  function duplicateSection(sec) {
    ui.edit('Duplicate section', (song) => {
      const c = CC.song.clone(sec);
      c.id = CC.song.uid('s');
      c.name = nextName(song, sec.name);
      song.sections.splice(song.sections.indexOf(sec) + 1, 0, c);
      const ai = song.arrangement.lastIndexOf(sec.id);
      song.arrangement.splice(ai >= 0 ? ai + 1 : song.arrangement.length, 0, c.id);
      S.selSectionId = c.id;
    });
    ui.toast('Copied! Change the copy without touching the original.');
  }
  function nextName(song, base) {
    const m = /^(.*?)(?: (\d+))?$/.exec(base); let n = m[2] ? +m[2] + 1 : 2;
    while (song.sections.some(s => s.name === m[1] + ' ' + n)) n++;
    return m[1] + ' ' + n;
  }
  ui.duplicateSection = () => duplicateSection(ui.section());
  ui.newSection = function () {
    ui.edit('New section', (song) => {
      const sec = CC.song.newSection(nextName(song, 'Section'), ui.section().bars, 'calm');
      song.sections.push(sec);
      song.arrangement.push(sec.id);
      S.selSectionId = sec.id;
    });
  };

  let dragIndex = null, dragSection = null, sectionClipboard = null;
  function renderArrangement() {
    const song = S.song;
    const arr = $('#arrangement'); arr.innerHTML = '';
    song.arrangement.forEach((id, i) => {
      const sec = song.sections.find(s => s.id === id); if (!sec) return;
      const chip = h('div', { class: 'arr-chip mood-' + sec.mood + (sec.id === ui.section().id ? ' sel' : ''), draggable: 'true', tabindex: 0, 'data-i': i, 'aria-label': `${i + 1}: ${sec.name}. Press Alt+arrow keys to move.`, 'data-tip': sec.name + ' (' + MOOD_LABEL[sec.mood] + '). Click to edit, drag to move.', style: { borderLeftColor: CC.song.secColor(song, sec) } },
        h('span', {}, sec.name),
        h('button', { 'aria-label': 'Remove from song order', onclick: (e) => { e.stopPropagation(); if (song.arrangement.length < 2) return ui.toast('The song needs at least one section.'); ui.edit('Remove from song', () => { song.arrangement.splice(i, 1); }); } }, '✕'));
      chip.addEventListener('click', () => ui.selectSection(sec.id));
      chip.addEventListener('dragstart', (e) => { dragIndex = i; chip.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
      chip.addEventListener('dragover', (e) => { e.preventDefault(); });
      chip.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (dragSection) { const id = dragSection; dragSection = null; ui.edit('Add to song', () => { song.arrangement.splice(i, 0, id); }); return; }
        if (dragIndex === null || dragIndex === i) return; const from = dragIndex; dragIndex = null; ui.edit('Reorder song', () => { song.arrangement.splice(i, 0, song.arrangement.splice(from, 1)[0]); }); });
      chip.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
          if (to < 0 || to >= song.arrangement.length) return;
          ui.edit('Reorder song', () => { song.arrangement.splice(to, 0, song.arrangement.splice(i, 1)[0]); });
          setTimeout(() => { const c = $(`#arrangement [data-i="${to}"]`); c && c.focus(); }, 0);
        } else if (e.key === 'Enter') ui.selectSection(sec.id);
      });
      arr.appendChild(chip);
    });
    if (!arr._dropBound) {
      arr._dropBound = true;
      arr.addEventListener('dragover', (e) => { if (dragSection) e.preventDefault(); });
      arr.addEventListener('drop', (e) => { if (!dragSection) return; e.preventDefault(); const id = dragSection; dragSection = null; ui.edit('Add to song', () => { S.song.arrangement.push(id); }); });
    }
    arr.appendChild(h('button', { class: 'btn small add-chip arr-add', 'data-tip': 'Add a section to the end of the song order', onclick: (e) => ui.menu(e.currentTarget, song.sections.map(s => ({ label: '➕ ' + s.name, action: () => ui.edit('Add to song', () => { song.arrangement.push(s.id); }) }))) }, '＋ Add'));
    const secs = song.arrangement.reduce((a, id) => { const s = song.sections.find(x => x.id === id); return a + (s ? s.bars * 4 * 60 / song.bpm : 0); }, 0);
    arr.appendChild(h('span', { class: 'song-len' }, 'Song length ' + fmtTime(secs)));
  }
  function fmtTime(s) { return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); }
  ui.registerRenderer('timeline', renderTimeline);

  let lastArr = -1;
  function updatePlaying(ph) {
    const pos = $('#pos-display');
    if (!ph) { if (lastArr !== -2) { pos.textContent = 'Bar 1'; $$('.arr-chip.playing').forEach(c => c.classList.remove('playing')); lastArr = -2; } return; }
    const sec = S.song.sections.find(s => s.id === ph.sectionId);
    pos.textContent = (sec ? sec.name + ' · ' : '') + 'Bar ' + (Math.floor(ph.step / 16) + 1) + '.' + (Math.floor(ph.step % 16 / 4) + 1);
    const key = ph.arrIndex === undefined ? ph.sectionId : ph.arrIndex;
    if (key !== lastArr) {
      lastArr = key;
      $$('.arr-chip').forEach((c, i) => c.classList.toggle('playing', ph.arrIndex !== undefined ? i === ph.arrIndex : S.song.arrangement[i] === ph.sectionId && false));
    }
  }

  function init() {
    initTopbar();
    $('#add-track').addEventListener('click', () => CC.modals.library({ add: true }));
  }
  CC.panels = { init, updatePlaying, changeKey, changeScale };
})(window.CC);
