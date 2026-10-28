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
          h('span', { style: { fontSize: '1.6rem' } }, '🔥'),
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
      const grid = h('div', { class: 'choice-grid' });
      Object.entries(CC.song.MOODS).forEach(([id, m]) => {
        const card = h('div', { class: 'choice' },
          h('span', { class: 'em' }, m.emoji), h('b', {}, m.name), h('small', {}, m.desc), h('small', { class: 'faint' }, m.bpm + ' BPM · ' + m.key + ' ' + m.scale.replace(/([A-Z])/g, ' $1').toLowerCase()),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', 'aria-label': 'Preview ' + m.name, onclick: (e) => { e.stopPropagation(); e.currentTarget.textContent = '…'; const b = e.currentTarget; previewSong(CC.song.songFromMood(id)).then(() => { b.textContent = '▶ Hear it'; }); } }, '▶ Hear it'),
            h('button', { class: 'btn small accent', onclick: () => { stopPreview(); ui.loadSong(CC.song.songFromMood(id)); ui.toast(m.emoji + ' ' + m.name + ': we made Explore, Alert, Combat and Victory sections for you.'); } }, 'Start')));
        grid.appendChild(card);
      });
      start.sub('Pick a game mood', h('div', {}, h('p', { class: 'muted' }, 'Each mood makes a full starter loop with matching instruments, plus calmer and more intense versions for different game moments. Then make it yours.'), grid));
    },
    beats() {
      const grid = h('div', { class: 'choice-grid' });
      Object.entries(CC.song.DRUM_STYLES).filter(([id]) => id !== 'fanfare').forEach(([id, st]) => {
        grid.appendChild(h('div', { class: 'choice' }, h('span', { class: 'em' }, '🥁'), h('b', {}, st.name),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => previewSong(CC.song.songFromBeat(id), 2) }, '▶ Hear it'),
            h('button', { class: 'btn small accent', onclick: () => { stopPreview(); ui.loadSong(CC.song.songFromBeat(id), { selectDrums: true }); ui.toast('Click squares in the grid to change the beat. Then pick "Bass" on the left to add notes.'); } }, 'Start'))));
      });
      start.sub('Pick a beat to start from', grid);
    },
    melody() {
      const opts = [['gm:acoustic_grand_piano', '🎹', 'Piano'], ['gm:flute', '🪈', 'Flute'], ['gm:clarinet', '🎷', 'Clarinet'], ['gm:vibraphone', '✨', 'Vibraphone'], ['gm:acoustic_guitar_nylon', '🎸', 'Guitar'], ['gm:ocarina', '🗺️', 'Ocarina'], ['synth:square', '👾', '8-bit lead'], ['gm:violin', '🎻', 'Violin']];
      const starter = h('input', { type: 'checkbox', checked: true });
      const grid = h('div', { class: 'choice-grid' });
      opts.forEach(([id, em, name]) => grid.appendChild(h('button', { class: 'choice', onclick: () => { ui.loadSong(CC.song.songFromMelody(id, starter.checked)); ui.toast(starter.checked ? 'Here is a starter melody. Click notes to remove them, click empty squares to add.' : 'Play the keyboard at the bottom, or click squares in the grid to place notes.'); } },
        h('span', { class: 'em' }, em), h('b', {}, name), h('small', {}, CC.instruments.info(id).desc))));
      start.sub('Which instrument plays your melody?', h('div', {}, h('label', { class: 'toggle', style: { marginBottom: '.8rem' } }, starter, h('span', {}, 'Give me a starter melody and chords to change')), grid));
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
