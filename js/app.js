// App startup: start screen, global shortcuts, playhead animation.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, S = ui.state;

  // ---------- Start screen previews (plays a song's first section briefly without loading it) ----------
  let previewGraph = null;
  async function previewSong(song, bars = 2) {
    stopPreview();
    await CC.audio.resume();
    await CC.instruments.ensureLoaded(song.tracks.map(t => t.instrument));
    const ctx = CC.audio.ctx();
    const out = ctx.createGain(); out.connect(ctx.destination);
    const G = CC.mix.buildGraph(ctx, song, out);
    previewGraph = { out };
    const sec = song.sections[0];
    const sd = CC.mix.stepDur(song);
    const t0 = ctx.currentTime + 0.08;
    const clips = CC.song.activeClips(sec);
    song.tracks.forEach(t => {
      if (song.layersFollowMood && (t.layer || 1) > CC.mix.moodLevel(sec.mood)) return;
      (clips[t.id] || []).forEach(n => {
        if (n.s >= bars * 16) return;
        const tt = t0 + n.s * sd + CC.mix.swingOffset(song, n.s);
        CC.instruments.trigger(ctx, G.tracks[t.id].input, t, n.p, tt, n.v || 0.8).stop(tt + n.l * sd);
      });
    });
  }
  function stopPreview() {
    if (!previewGraph) return;
    const ctx = CC.audio.ctx();
    previewGraph.out.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    const o = previewGraph.out; setTimeout(() => o.disconnect(), 300);
    previewGraph = null;
  }

  const start = {
    async show() {
      $('#app').hidden = true;
      $('#start').hidden = false;
      $('#start-sub').hidden = true;
      $('.start-grid').hidden = false;
      const last = CC.storage.lastAutosave();
      const box = $('#resume-box'); box.innerHTML = '';
      if (last && last.song && last.song.tracks) {
        box.appendChild(h('div', { class: 'resume' },
          h('img', { src: 'icons/logo-128.png?v=41', alt: '', style: 'width:2.2rem;height:2.2rem;flex-shrink:0' }),
          h('div', { class: 'grow' }, h('b', {}, 'Continue "' + last.song.name + '"'), h('div', { class: 'faint' }, 'Last edited ' + ago(last.time))),
          h('button', { class: 'btn accent', onclick: () => ui.loadSong(last.song) }, 'Continue')));
      }
      const recent = $('#recent-box'); recent.innerHTML = '';
      const projects = (await CC.storage.listProjects()).slice(0, 12);
      if (projects.length) {
        const list = h('div', { class: 'recent-list' });
        projects.forEach(p => list.appendChild(h('div', { class: 'recent-item' },
          h('button', { class: 'open', onclick: async () => { const s = await CC.storage.openProject(p.id); if (s) ui.loadSong(s); } }, h('b', {}, p.name), h('small', {}, ago(p.updated))),
          h('button', { class: 'btn small icon', 'aria-label': 'Delete ' + p.name, 'data-tip': 'Remove from this list', onclick: () => ui.confirm('Remove song?', `Remove "${p.name}" from your songs in this app? Files you saved elsewhere are not affected.`, 'Remove', async () => { await CC.storage.deleteProject(p.id); start.show(); }) }, '🗑'))));
        recent.appendChild(h('div', { class: 'recent' }, h('h3', {}, 'Your songs'), list));
      }
      setTimeout(() => { const f = $('#start .resume .btn') || $('#start .start-card'); f && f.focus(); }, 50);
    },
    sub(title, content) {
      $('.start-grid').hidden = true;
      const sub = $('#start-sub');
      sub.innerHTML = '';
      sub.hidden = false;
      sub.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { stopPreview(); start.show(); } }, '← Back'), h('h2', { style: { margin: 0 } }, title)), content);
      setTimeout(() => { const b = sub.querySelector('.choice'); b && b.focus(); }, 30);
    },
    moods() {
      // Build a start from two choices: the world (which instruments) and the game moment (what kind of track)
      const W = CC.song.WORLDS, M = CC.song.MOMENTS;
      let world = CC.storage.setting('startWorld') || 'fantasy';
      if (!W[world]) world = 'fantasy';
      const moments = new Set(['explore']);
      const worldGrid = h('div', { class: 'chip-grid', role: 'radiogroup', 'aria-label': 'World' });
      const momentGrid = h('div', { class: 'chip-grid', role: 'group', 'aria-label': 'Game moments' });
      const summary = h('div', { class: 'build-summary' });
      const chip = (em, name, desc, on, click, role) => h('button', { class: 'pick', role, 'aria-checked': role === 'radio' ? String(on) : null, 'aria-pressed': role ? null : String(on), 'data-tip': desc || null, onclick: click }, h('span', { class: 'em' }, em), h('span', {}, name));
      function draw() {
        worldGrid.innerHTML = ''; momentGrid.innerHTML = '';
        Object.entries(W).forEach(([id, w]) => worldGrid.appendChild(chip(w.emoji, w.name, w.desc, id === world, () => { world = id; CC.storage.setting('startWorld', id); draw(); }, 'radio')));
        Object.entries(M).forEach(([id, m]) => momentGrid.appendChild(chip(m.emoji, m.name, null, moments.has(id), () => { if (moments.has(id) && moments.size > 1) moments.delete(id); else moments.add(id); draw(); })));
        const list = [...moments], first = CC.song.moodSpec(world, list[0]);
        summary.innerHTML = '';
        summary.append(
          h('div', { class: 'grow' },
            h('b', {}, list.length === 1 ? first.name : `${list.length} songs in the ${W[world].name} world`),
            h('small', {}, list.length === 1 ? `${first.bpm} BPM · ${first.key} ${CC.theory.SCALES[first.scale].name.split(' (')[0].toLowerCase()} · ${first.tracks.map(t => CC.instruments.info(t[0]).name).join(', ')}`
              : list.map(id => M[id].name).join(' · ') + '. Each one is saved in Your songs.')),
          h('button', { class: 'btn', 'aria-label': 'Preview', onclick: (e) => { const b = e.currentTarget; b.textContent = '…'; previewSong(CC.song.songFromWorld(world, list[0])).then(() => { b.textContent = '▶ Hear it'; }); } }, '▶ Hear it'),
          h('button', { class: 'btn accent', onclick: () => makeSongs(list) }, list.length === 1 ? 'Start' : `Make ${list.length} songs`));
      }
      async function makeSongs(list) {
        stopPreview();
        const songs = list.map(id => { const sg = CC.song.songFromWorld(world, id); sg.projectId = CC.song.uid('p'); return sg; });
        for (const sg of songs.slice(1)) await CC.storage.saveNow(sg);
        await ui.loadSong(songs[0]);
        ui.toast(songs.length > 1 ? `Made ${songs.length} ${W[world].name} songs. The others are waiting in Your songs on the start screen.` : W[world].emoji + ' ' + songs[0].name + ': with calmer and more intense versions for different game moments.');
      }
      draw();
      // The ready-made moods from before, for a one-click start
      const grid = h('div', { class: 'choice-grid' });
      Object.entries(CC.song.MOODS).forEach(([id, m]) => {
        const card = h('div', { class: 'choice' },
          h('span', { class: 'em' }, m.emoji), h('b', {}, m.name), h('small', {}, m.desc), h('small', { class: 'faint' }, m.bpm + ' BPM · ' + m.key + ' ' + m.scale.replace(/([A-Z])/g, ' $1').toLowerCase()),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', 'aria-label': 'Preview ' + m.name, onclick: (e) => { e.stopPropagation(); e.currentTarget.textContent = '…'; const b = e.currentTarget; previewSong(CC.song.songFromMood(id)).then(() => { b.textContent = '▶ Hear it'; }); } }, '▶ Hear it'),
            h('button', { class: 'btn small accent', onclick: () => { stopPreview(); ui.loadSong(CC.song.songFromMood(id)); ui.toast(m.emoji + ' ' + m.name + ': we made Explore, Alert, Combat and Victory sections for you.'); } }, 'Start')));
        grid.appendChild(card);
      });
      start.sub('Build a game mood', h('div', {},
        h('p', { class: 'muted' }, 'Pick the world your game is set in, then the kind of track you need. A cozy dungeon, a space boss fight, a spooky shop... any mix works. Pick several moments to make a matching set of songs at once.'),
        h('h3', { class: 'step-h' }, '1. Your world'), worldGrid,
        h('h3', { class: 'step-h' }, '2. Game moments'), momentGrid,
        summary,
        h('h3', { class: 'step-h' }, 'Or start from a ready-made mood'), grid));
    },
    beats() {
      // Options that apply to whichever beat you pick
      let kit = 'auto', speed = 'auto';
      const kits = [['auto', 'Best match'], ['kit:acoustic', 'Band'], ['kit:electronic', 'Electronic'], ['kit:lofi', 'Soft lo-fi'], ['kit:chip', '8-bit']];
      const speeds = [['auto', 'Best match'], ['70', 'Slow'], ['100', 'Medium'], ['128', 'Fast'], ['160', 'Very fast']];
      const optRow = h('div', { class: 'opt-rows' });
      const seg = (label, items, get, set) => h('div', { class: 'opt-row' }, h('span', { class: 'faint' }, label),
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, items.map(([v, n]) => h('button', { role: 'radio', 'aria-checked': String(get() === v), onclick: () => { set(v); drawOpts(); } }, n))));
      function drawOpts() { optRow.innerHTML = ''; optRow.append(seg('Drum kit', kits, () => kit, v => { kit = v; }), seg('Speed', speeds, () => speed, v => { speed = v; })); }
      drawOpts();
      const opts = () => ({ kit: kit === 'auto' ? null : kit, bpm: speed === 'auto' ? null : +speed });
      const grid = h('div', { class: 'choice-grid' });
      Object.entries(CC.song.DRUM_STYLES).filter(([id]) => id !== 'fanfare').forEach(([id, st]) => {
        grid.appendChild(h('div', { class: 'choice' }, h('span', { class: 'em' }, '🥁'), h('b', {}, st.name), h('small', { class: 'faint' }, (CC.song.BEAT_BPM[id] || 110) + ' BPM · ' + CC.instruments.info(CC.song.beatKit(id)).name),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => previewSong(CC.song.songFromBeat(id, opts()), 2) }, '▶ Hear it'),
            h('button', { class: 'btn small accent', onclick: () => { stopPreview(); ui.loadSong(CC.song.songFromBeat(id, opts()), { selectDrums: true }); ui.toast('Click squares in the grid to change the beat. Then pick "Bass" in the song lanes to add notes.'); } }, 'Start'))));
      });
      start.sub('Pick a beat to start from', h('div', {}, optRow, grid));
    },
    melody() {
      // Every melodic instrument in the app, grouped like the instrument library, plus a feeling for the starter tune
      let feel = 'happy', query = '';
      const starter = h('input', { type: 'checkbox', checked: true });
      const feels = h('div', { class: 'seg wrap', role: 'radiogroup', 'aria-label': 'Feeling' });
      const drawFeels = () => { feels.innerHTML = ''; Object.entries(CC.song.MELODY_FEELS).forEach(([id, f]) => feels.appendChild(h('button', { role: 'radio', 'aria-checked': String(id === feel), onclick: () => { feel = id; drawFeels(); } }, f.name))); };
      drawFeels();
      const search = h('input', { type: 'text', placeholder: 'Search instruments (flute, synth, guitar…)', 'aria-label': 'Search instruments', class: 'inst-search', oninput: (e) => { query = e.target.value.trim().toLowerCase(); drawList(); } });
      const listBox = h('div', {});
      const cats = {};
      CC.instruments.catalog().filter(x => x.kind === 'melody').forEach(x => { (cats[x.category] = cats[x.category] || []).push(x); });
      function pick(id) {
        stopPreview();
        ui.loadSong(CC.song.songFromMelody(id, starter.checked, { feel }));
        ui.toast(starter.checked ? 'Here is a starter melody. Click notes to remove them, click empty squares to add.' : 'Play the keyboard at the bottom, or click squares in the grid to place notes.');
      }
      function drawList() {
        listBox.innerHTML = '';
        Object.entries(cats).forEach(([cat, items]) => {
          const shown = items.filter(x => !query || (x.name + ' ' + x.desc + ' ' + cat).toLowerCase().includes(query));
          if (!shown.length) return;
          listBox.append(h('h3', { class: 'step-h' }, cat), h('div', { class: 'inst-grid' }, shown.map(x => h('div', { class: 'inst-pick' },
            h('button', { class: 'name', onclick: () => pick(x.id), 'data-tip': x.desc }, h('b', {}, x.name), h('small', {}, x.desc)),
            h('button', { class: 'btn small icon', 'aria-label': 'Hear ' + x.name, 'data-tip': 'Hear it', onclick: () => CC.engine.previewInstrument(x.id) }, '▶')))));
        });
        if (!listBox.children.length) listBox.append(h('p', { class: 'muted' }, 'No instrument matches "' + query + '".'));
      }
      drawList();
      start.sub('Which instrument plays your melody?', h('div', {},
        h('div', { class: 'opt-rows' },
          h('label', { class: 'toggle' }, starter, h('span', {}, 'Give me a starter melody and chords to change')),
          h('div', { class: 'opt-row' }, h('span', { class: 'faint' }, 'Feeling'), feels)),
        search, listBox));
      setTimeout(() => search.focus(), 40);
    }
  };
  function ago(t) {
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString();
  }
  CC.start = start;

  // ---------- Global keyboard ----------
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range'].includes(t.type) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  document.addEventListener('keydown', (e) => {
    if ($('#app').hidden || $('#modal-root').children.length) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey && !typing(e)) { e.preventDefault(); ui.undo(); }
      else if ((k === 'y' || (k === 'z' && e.shiftKey)) && !typing(e)) { e.preventDefault(); ui.redo(); }
      else if (k === 's') { e.preventDefault(); CC.modals.save(); }
      else if (k === 'e') { e.preventDefault(); CC.modals.exportDialog(); }
      else if (k === 'o') { e.preventDefault(); $('#file-open').click(); }
      else if (k === 'd' && !typing(e)) { e.preventDefault(); if (!CC.editor.duplicateSel()) ui.duplicateSection(); }
      else if (k === 'c' && !typing(e)) { e.preventDefault(); CC.editor.copySel(false); }
      else if (k === 'x' && !typing(e)) { e.preventDefault(); CC.editor.copySel(true); }
      else if (k === 'v' && !typing(e)) { e.preventDefault(); CC.editor.paste(); }
      else if (k === 'a' && !typing(e)) { e.preventDefault(); CC.editor.selectAll(); }
      return;
    }
    if (typing(e) || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); CC.engine.toggle(S.playMode); return; }
    if (e.key === 'Escape') { CC.engine.stop(); CC.editor.clearSel(); return; }
    if ((e.key === 'p' || e.key === 'P') && CC.editor.hasSel()) { e.preventDefault(); CC.editor.playSelection(e.shiftKey); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && CC.editor.hasSel()) { e.preventDefault(); CC.editor.deleteSel(); return; }
    if (e.key === '?') { CC.modals.help(); return; }
    if (CC.surface.onKeyDown(e)) e.preventDefault();
  }, true);
  document.addEventListener('keyup', (e) => { if (!typing(e)) CC.surface.onKeyUp(e); });

  // ---------- Playhead loop ----------
  function frame() {
    if (S.song && !$('#app').hidden) {
      const ph = CC.engine.playhead();
      CC.editor.updatePlayhead(ph);
      CC.panels.updatePlaying(ph);
      CC.lanes.frame(ph);
      CC.wave.frame(ph);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Init ----------
  function init() {
    CC.modals.applySettings();
    S.level = CC.storage.setting('level') || 'beginner';
    S.editorMode = CC.storage.setting('editorMode') || 'simple';
    if (CC.storage.setting('surfaceCollapsed')) $('.surface').classList.add('collapsed');
    CC.panels.init();
    CC.editor.init();
    CC.side.init();
    CC.wave.init();
    CC.layout.init();
    CC.lanes.init();
    $$('[data-start]').forEach(b => b.addEventListener('click', () => {
      CC.audio.resume();
      const k = b.dataset.start;
      if (k === 'mood') start.moods();
      else if (k === 'beat') start.beats();
      else if (k === 'melody') start.melody();
      else ui.loadSong(CC.song.blankSong());
    }));
    $('#start-open').addEventListener('click', () => $('#file-open').click());
    $('#start-help').addEventListener('click', () => CC.modals.help());
    $('#file-open').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const song = await CC.storage.openFile(f); await ui.loadSong(song); ui.toast('Opened "' + song.name + '"'); }
      catch (err) { ui.toast('Could not open that file: ' + err.message, true); }
    });
    addEventListener('beforeunload', () => { if (S.song) CC.storage.saveNow(S.song); });
    CC.events.on('playState', (on) => { if (!on) CC.engine.record = false; CC.surface.renderBar(); });
    start.show();
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.CC);
