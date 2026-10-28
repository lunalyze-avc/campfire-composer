// Note grid editor: beat grid for drums, simple in-key grid and full piano roll for melodic instruments.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, h } = ui, T = CC.theory;
  const S = ui.state;
  const KEYS_W = 108, HEADER_H = 24, VEL_H = 60;
  let geo = { rows: [], rowH: 24, cellW: 24, steps: 64 };
  let cursor = { r: 0, s: 0 };
  let drag = null;
  let lastDrumRow = 0;

  const grid = () => $('#editor-grid');

  function sectionLen(sec) { return sec.bars * 16; }
  function isDrums(track) { return track && track.kind === 'drums'; }
  function mode(track) { return isDrums(track) ? 'drums' : S.editorMode; }

  // Rows shown in the grid for the current track and mode
  function buildRows(track) {
    const song = S.song;
    if (isDrums(track)) return CC.instruments.kitRows(track).map((r, i) => ({ p: i, label: r.name, drum: true }));
    const o = track.octave || 4;
    let lo, hi;
    if (mode(track) === 'simple') { lo = (o + 1) * 12 - 5; hi = (o + 1) * 12 + 24; }
    else { lo = Math.max(12, o * 12 - 12); hi = Math.min(120, (o + 4) * 12); }
    const rows = [];
    for (let p = hi; p >= lo; p--) {
      const inKey = T.inScale(p, song.key, song.scale);
      if (mode(track) === 'simple' && song.stayInKey && !inKey) continue;
      rows.push({ p, label: T.noteName(p), black: T.isBlack(p), inKey, root: (p - T.keyIndex(song.key)) % 12 === 0 });
    }
    return rows;
  }

  function computeGeometry() {
    const track = ui.track(), sec = ui.section();
    const rows = track ? buildRows(track) : [];
    const steps = sectionLen(sec);
    const wrap = $('#grid-scroll');
    const avail = Math.max(300, wrap.clientWidth - KEYS_W - 2);
    const cellW = Math.max(16, Math.floor(avail / steps)) * S.zoom;
    const rowH = isDrums(track) ? 30 : mode(track) === 'simple' ? 24 : 18;
    geo = { rows, rowH, cellW, steps, track, sec };
    return geo;
  }

  function sizeCanvas(c, w, hgt) {
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr); c.height = Math.round(hgt * dpr);
    c.style.width = w + 'px'; c.style.height = hgt + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function notes() { return CC.song.clipOf(geo.sec, geo.track.id); }

  // ---------- Drawing ----------
  function draw() {
    if (!geo.track) return;
    const { rows, rowH, cellW, steps, track } = geo;
    const W = steps * cellW, H = rows.length * rowH;
    const ctx = sizeCanvas(grid(), W, H);
    const bg = css('--grid-bg'), line = css('--grid-line'), beat = css('--grid-beat'), bar = css('--grid-bar');
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = css('--grid-fill') || bg; ctx.fillRect(0, 0, W, H); // see-through so the embers show
    // beat group shading
    for (let s = 0; s < steps; s += 4) if ((s / 4) % 2 === 1) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(s * cellW, 0, 4 * cellW, H); }
    rows.forEach((r, i) => {
      if (r.black) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(0, i * rowH, W, rowH); }
      if (!r.drum && !r.inKey && S.song.stayInKey) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, i * rowH, W, rowH); }
      if (r.root) { ctx.fillStyle = css('--grid-root') || 'rgba(255,138,61,0.07)'; ctx.fillRect(0, i * rowH, W, rowH); }
      ctx.fillStyle = line; ctx.fillRect(0, (i + 1) * rowH - 1, W, 1);
    });
    for (let s = 0; s <= steps; s++) {
      ctx.fillStyle = s % 16 === 0 ? bar : s % 4 === 0 ? beat : line;
      ctx.fillRect(s * cellW - (s % 16 === 0 ? 1 : 0), 0, s % 16 === 0 ? 2 : 1, H);
    }
    // ghost notes from other melodic tracks (piano roll only)
    if (mode(track) === 'piano') {
      const clips = CC.song.activeClips(geo.sec);
      S.song.tracks.forEach(t => {
        if (t.id === track.id || t.kind === 'drums') return;
        (clips[t.id] || []).forEach(n => {
          const ri = rows.findIndex(r => r.p === n.p);
          if (ri < 0) return;
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(n.s * cellW + 1, ri * rowH + 2, n.l * cellW - 2, rowH - 4);
        });
      });
    }
    // notes
    const col = track.color || '#ff8a3d';
    const glow = parseFloat(css('--glow')) || 0;
    notes().forEach(n => {
      const ri = rows.findIndex(r => r.p === n.p);
      if (ri < 0) return;
      const x = n.s * cellW + 1, y = ri * rowH + 2, w = Math.max(4, Math.min(n.l, steps - n.s) * cellW - 2), hh = rowH - 4;
      const v = n.v === undefined ? 0.8 : n.v;
      ctx.globalAlpha = 0.45 + v * 0.55;
      ctx.fillStyle = col;
      if (glow > 0) { ctx.shadowColor = col; ctx.shadowBlur = 6 * glow; }
      roundRect(ctx, x, y, w, hh, 1); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      if (sel.has(n)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; roundRect(ctx, x + 1, y + 1, w - 2, hh - 2, 1); ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, hh - 1, 1); ctx.stroke(); }
      if (!isDrums(track) && w > 30 && rowH >= 18) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.font = '600 11px Segoe UI, sans-serif'; ctx.fillText(T.noteName(n.p), x + 4, y + hh / 2 + 4); }
      if (n.s + n.l > steps && !isDrums(track)) { ctx.fillStyle = '#fff'; ctx.fillText('›', x + w - 8, y + hh / 2 + 4); }
    });
    const lr = loopHere();
    if (lr) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, lr.start * cellW, H); ctx.fillRect(lr.end * cellW, 0, (steps - lr.end) * cellW, H);
      ctx.fillStyle = css('--accent'); ctx.fillRect(lr.start * cellW, 0, 2, H); ctx.fillRect(lr.end * cellW - 2, 0, 2, H);
    }
    if (drag && drag.mode === 'marquee') {
      ctx.fillStyle = CC.theme.rgba(css('--accent'), 0.12); ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), hh = Math.abs(drag.y1 - drag.y0);
      ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); ctx.setLineDash([]);
    }
    // keyboard cursor
    if (document.activeElement === grid()) {
      ctx.strokeStyle = css('--focus'); ctx.lineWidth = 2;
      ctx.strokeRect(cursor.s * cellW + 1, cursor.r * rowH + 1, (isDrums(track) ? 1 : S.noteLen) * cellW - 2, rowH - 2);
    }
    drawKeys(); drawHeader(); drawVel();
    const gc = $('#grid-content');
    const velOn = S.velLane && ui.advanced();
    gc.style.gridTemplateColumns = KEYS_W + 'px ' + W + 'px';
    gc.style.gridTemplateRows = HEADER_H + 'px ' + H + 'px' + (velOn ? ' ' + VEL_H + 'px' : '');
    $('#vel-lane').hidden = !velOn; $('#vel-label').hidden = !velOn;
  }
  function roundRect(ctx, x, y, w, hgt, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hgt, r); ctx.arcTo(x + w, y + hgt, x, y + hgt, r); ctx.arcTo(x, y + hgt, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawKeys() {
    const { rows, rowH } = geo;
    const c = $('#grid-keys');
    const ctx = sizeCanvas(c, KEYS_W, rows.length * rowH);
    ctx.font = (rowH >= 24 ? 12 : 11) + 'px Segoe UI, sans-serif';
    rows.forEach((r, i) => {
      const y = i * rowH;
      if (r.drum) {
        ctx.fillStyle = i % 2 ? css('--panel2') : css('--panel3'); ctx.fillRect(0, y, KEYS_W, rowH);
        ctx.fillStyle = i === lastDrumRow ? css('--accent2') : '#e9e3f5';
        ctx.fillText(r.label.length > 15 ? r.label.slice(0, 14) + '…' : r.label, 8, y + rowH / 2 + 4);
      } else {
        ctx.fillStyle = r.black ? css('--panel') : (r.inKey || !S.song.stayInKey ? css('--panel3') : css('--panel2'));
        ctx.fillRect(0, y, KEYS_W, rowH);
        if (r.root) { ctx.fillStyle = css('--accent'); ctx.fillRect(KEYS_W - 6, y, 6, rowH); }
        ctx.fillStyle = r.black ? css('--faint') : css('--text');
        if (!r.black || rowH >= 20) ctx.fillText(r.label + (r.root ? '  ⌂' : ''), 8, y + rowH / 2 + 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y + rowH - 1, KEYS_W, 1);
    });
  }
  function drawHeader() {
    const { steps, cellW } = geo;
    const ctx = sizeCanvas($('#grid-header'), steps * cellW, HEADER_H);
    ctx.clearRect(0, 0, steps * cellW, HEADER_H); ctx.fillStyle = css('--grid-head'); ctx.fillRect(0, 0, steps * cellW, HEADER_H);
    ctx.font = '600 12px Segoe UI, sans-serif';
    for (let s = 0; s < steps; s += 4) {
      const x = s * cellW;
      if (s % 16 === 0) { ctx.fillStyle = css('--text'); ctx.fillText('Bar ' + (s / 16 + 1), x + 4, 16); ctx.fillStyle = css('--grid-bar'); ctx.fillRect(x, 0, 2, HEADER_H); }
      else if (cellW * 4 > 26) { ctx.fillStyle = css('--faint'); ctx.font = '11px Segoe UI, sans-serif'; ctx.fillText(String(s / 4 % 4 + 1), x + 3, 16); ctx.font = '600 12px Segoe UI, sans-serif'; ctx.fillRect(x, HEADER_H - 6, 1, 6); }
    }
    ctx.fillStyle = css('--line'); ctx.fillRect(0, HEADER_H - 1, steps * cellW, 1);
    const r = loopHere();
    if (r) {
      ctx.fillStyle = CC.theme.rgba(css('--accent'), 0.3); ctx.fillRect(r.start * cellW, 0, (r.end - r.start) * cellW, HEADER_H);
      ctx.fillStyle = css('--accent'); ctx.fillRect(r.start * cellW, HEADER_H - 4, (r.end - r.start) * cellW, 4);
    }
  }
  function loopHere() { const L = CC.engine.loop; return L && geo.sec && L.sectionId === geo.sec.id ? L : null; }

  // ---------- Play part of a section ----------
  // Drag on the bar numbers to pick a range (click = one bar). Click inside the range to clear it.
  function headerDown(e) {
    if (!geo.sec) return;
    const c = $('#grid-header'), rect = c.getBoundingClientRect();
    const stepAt = (ev) => Math.max(0, Math.min(geo.steps, (ev.clientX - rect.left) / geo.cellW));
    const s0 = stepAt(e);
    const cur = loopHere();
    let moved = false;
    const mv = (ev) => {
      const s1 = stepAt(ev);
      if (Math.abs(s1 - s0) * geo.cellW < 6 && !moved) return;
      moved = true;
      const a = Math.floor(Math.min(s0, s1) / 4) * 4, b = Math.ceil(Math.max(s0, s1) / 4) * 4;
      CC.engine.loop = { sectionId: geo.sec.id, start: a, end: Math.max(a + 4, b) };
      drawHeader(); draw();
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (!moved) {
        if (cur && s0 >= cur.start && s0 < cur.end) { CC.engine.setLoop(null); }
        else { const bar = Math.floor(s0 / 16) * 16; CC.engine.setLoop({ sectionId: geo.sec.id, start: bar, end: Math.min(geo.steps, bar + 16) }); }
      } else CC.engine.setLoop(CC.engine.loop);
      render();
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function playRange(start, end, onlyNotes) {
    const E = CC.engine;
    E.stop();
    S.playMode = 'section';
    E.loop = { sectionId: geo.sec.id, start, end };
    E.onlyNotes = onlyNotes || null;
    E.play('section');
    ui.render(['top', 'editor']);
  }
  function playSelection(onlyThese) {
    const ns = selection();
    if (!ns.length) { ui.toast('Select some notes first (Shift + drag a box).'); return; }
    const a = Math.floor(Math.min(...ns.map(n => n.s)) / 4) * 4;
    const b = Math.ceil(Math.max(...ns.map(n => n.s + Math.max(1, n.l))) / 4) * 4;
    playRange(a, Math.min(geo.steps, Math.max(a + 4, b)), onlyThese ? new Set(ns) : null);
  }
  function playBar(bar) { playRange(bar * 16, Math.min(geo.steps, bar * 16 + 16)); }
  function velTargets() {
    const ns = notes();
    return isDrums(geo.track) ? ns.filter(n => n.p === lastDrumRow) : ns;
  }
  function drawVel() {
    if (!(S.velLane && ui.advanced())) return;
    const { steps, cellW } = geo;
    const ctx = sizeCanvas($('#vel-lane'), steps * cellW, VEL_H);
    ctx.clearRect(0, 0, steps * cellW, VEL_H); ctx.fillStyle = css('--grid-bg'); ctx.fillRect(0, 0, steps * cellW, VEL_H);
    for (let s = 0; s <= steps; s += 4) { ctx.fillStyle = s % 16 === 0 ? css('--grid-bar') : css('--grid-line'); ctx.fillRect(s * cellW, 0, 1, VEL_H); }
    ctx.fillStyle = geo.track.color;
    velTargets().forEach(n => { const v = n.v === undefined ? 0.8 : n.v; const hh = v * (VEL_H - 6); ctx.fillRect(n.s * cellW + cellW / 2 - 3, VEL_H - hh, 6, hh); ctx.fillRect(n.s * cellW + cellW / 2 - 6, VEL_H - hh, 12, 3); });
  }

  // ---------- Editor bar + notice ----------
  function renderBar() {
    const bar = $('#editor-bar');
    bar.innerHTML = '';
    const track = ui.track(), sec = ui.section();
    if (!track) { bar.appendChild(h('span', { class: 'muted' }, 'Add an instrument to start making music.')); return; }
    bar.appendChild(h('div', { class: 'title' }, h('span', { class: 'sw', style: { background: track.color } }), track.name, h('span', { class: 'muted', style: { fontWeight: 400 } }, ' in ' + sec.name)));
    bar.appendChild(h('button', { class: 'btn small accent dice-btn', 'data-tip': `Roll the dice: write a brand new ${CC.gen.ROLES[CC.gen.role(track)].name.toLowerCase()} part for ${track.name} here. Ctrl+Z brings the old one back.`, onclick: () => ui.edit('New idea', s => CC.gen.rollTrack(s, sec, track, null, { density: S.melodyBusy })) }, '🎲 New idea'));
    const tools = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Mouse tool' });
    [['draw', '✏️ Draw', 'Draw: click or drag anywhere to add notes. Click a note to remove it. Hold Shift and drag to select instead.'],
     ['select', '⬚ Select', 'Select: drag a box around notes, then drag them to move (hold Ctrl to drag a copy). Ctrl+C / Ctrl+V to copy and paste.']].forEach(([v, l, tip]) =>
      tools.appendChild(h('button', { role: 'radio', 'aria-checked': String((S.tool || 'draw') === v), 'data-tip': tip, onclick: () => { S.tool = v; renderBar(); } }, l)));
    bar.appendChild(tools);
    const lr = loopHere();
    if (lr) bar.appendChild(h('span', { class: 'row', style: { gap: '.2rem' } },
      h('span', { class: 'faint', style: { color: '#7bd389' } }, '🔁 Playing ' + rangeLabel(lr)),
      h('button', { class: 'btn small', 'aria-label': 'Play the whole section again', 'data-tip': 'Stop looping just this part and play the whole section again.', onclick: () => { CC.engine.setLoop(null); render(); } }, '✕')));
    const nSel = selection().length;
    if (nSel) bar.appendChild(h('span', { class: 'row', style: { gap: '.2rem' } },
      h('button', { class: 'btn small accent', 'data-tip': 'Loop the bars/beats your selected notes are in, with all instruments (P).', onclick: () => playSelection(false) }, '▶ Play selection'),
      h('button', { class: 'btn small', 'data-tip': 'Loop only the selected notes, nothing else (Shift+P).', onclick: () => playSelection(true) }, '▶ Just these notes')));
    if (nSel || clipboard) {
      bar.appendChild(h('span', { class: 'row', style: { gap: '.2rem' } },
        nSel ? h('span', { class: 'faint' }, nSel + ' selected') : null,
        nSel ? h('button', { class: 'btn small', 'data-tip': 'Copy selected notes (Ctrl+C)', onclick: () => copySel(false) }, 'Copy') : null,
        nSel ? h('button', { class: 'btn small', 'data-tip': 'Cut selected notes (Ctrl+X)', onclick: () => copySel(true) }, 'Cut') : null,
        nSel ? h('button', { class: 'btn small', 'data-tip': 'Copy the selection right after itself (Ctrl+D)', onclick: duplicateSel }, 'Duplicate') : null,
        nSel ? h('button', { class: 'btn small', 'data-tip': 'Delete selected notes (Delete)', onclick: deleteSel }, 'Delete') : null,
        clipboard ? h('button', { class: 'btn small', 'data-tip': 'Paste at the last place you clicked in the grid (Ctrl+V). Works in other sections and instruments too.', onclick: () => paste() }, 'Paste') : null));
    }
    if (!isDrums(track)) {
      const seg = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Grid type' });
      [['simple', 'Simple grid', 'Big rows with only the notes that fit your key. Click squares to place notes.'], ['piano', 'Piano roll', 'Every note on a piano keyboard, with more room. Drag notes to move them, drag the right edge to make them longer.']].forEach(([m, l, tip]) => {
        seg.appendChild(h('button', { role: 'radio', 'aria-checked': String(S.editorMode === m), 'data-tip': tip, onclick: () => { S.editorMode = m; CC.storage.setting('editorMode', m); ui.render(['editor']); scrollToNotes(); } }, l));
      });
      bar.appendChild(seg);
      const len = h('select', { 'aria-label': 'Length of new notes', 'data-tip': 'How long new notes are when you click the grid. You can also drag while clicking to draw a longer note.' },
        [[1, 'Very short (1/16)'], [2, 'Short (1/8)'], [4, 'One beat'], [8, 'Half bar'], [16, 'Whole bar']].map(([v, l]) => h('option', { value: v, selected: S.noteLen === v }, l)));
      len.onchange = () => { S.noteLen = +len.value; };
      bar.appendChild(h('label', { class: 'field' }, h('span', {}, 'New notes:'), len));
    }
    const bars = h('select', { 'aria-label': 'Section length in bars', 'data-tip': 'How long this section loop is. 1 bar = 4 beats. Most game loops are 4 or 8 bars.' },
      [1, 2, 4, 8, 16].map(v => h('option', { value: v, selected: sec.bars === v }, v + (v === 1 ? ' bar' : ' bars'))));
    bars.onchange = () => ui.edit('Change section length', () => setBars(sec, +bars.value));
    bar.appendChild(h('label', { class: 'field' }, h('span', {}, 'Length:'), bars));
    bar.appendChild(h('div', { class: 'row', style: { gap: '.2rem' } },
      h('button', { class: 'btn icon small', 'aria-label': 'Zoom out', 'data-tip': 'Zoom out (see more)', onclick: () => { S.zoom = Math.max(0.5, S.zoom / 1.25); ui.render(['editor']); } }, '−'),
      h('button', { class: 'btn icon small', 'aria-label': 'Zoom in', 'data-tip': 'Zoom in (bigger squares)', onclick: () => { S.zoom = Math.min(4, S.zoom * 1.25); ui.render(['editor']); } }, '+')));
    if (ui.advanced()) {
      const snap = h('select', { 'aria-label': 'Snap', 'data-tip': 'Snap: where notes can start when you place or drag them.' }, [[1, '1/16'], [2, '1/8'], [4, 'Beat'], [16, 'Bar']].map(([v, l]) => h('option', { value: v, selected: S.snap === v }, l)));
      snap.onchange = () => { S.snap = +snap.value; };
      bar.appendChild(h('label', { class: 'field' }, h('span', {}, 'Snap'), snap));
      bar.appendChild(h('button', { class: 'btn small' + (S.velLane ? ' on' : ''), 'data-tip': 'Show a lane where you drag bars up/down to make individual notes louder or softer (velocity).' + (isDrums(track) ? ' For drums it edits the row you last clicked.' : ''), onclick: () => { S.velLane = !S.velLane; ui.render(['editor']); } }, 'Loudness lane'));
    }
    // A/B comparison
    const ab = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'A/B version', 'data-tip': 'A/B: keep two versions of this section and flip between them while it plays, to hear which you like more.' });
    ['A', 'B'].forEach(v => ab.appendChild(h('button', { role: 'radio', 'aria-checked': String(sec.showing === v), onclick: () => switchAB(sec, v) }, v)));
    bar.appendChild(ab);
    bar.appendChild(h('button', { class: 'btn small', 'aria-label': 'A/B options', 'data-tip': 'A/B options', onclick: (e) => abMenu(e.currentTarget, sec) }, '⋯'));
    bar.appendChild(h('div', { class: 'spacer' }));
    bar.appendChild(h('button', { class: 'btn small danger', 'data-tip': 'Remove notes: from this instrument, this whole section, or the whole song (you can undo).', onclick: () => clearDialog(sec, track) }, '🗑 Clear'));
  }
  function setBars(sec, bars) {
    const old = sec.bars;
    sec.bars = bars;
    if (bars > old) {
      // Repeat the existing loop to fill the new length so nothing feels lost
      for (const clips of [sec.clips, sec.clipsB].filter(Boolean)) {
        for (const id of Object.keys(clips)) {
          const src = clips[id].filter(n => n.s < old * 16);
          const out = src.slice();
          for (let k = 1; k * old < bars; k++) src.forEach(n => { if (n.s + k * old * 16 < bars * 16) out.push({ ...n, s: n.s + k * old * 16 }); });
          clips[id] = out;
        }
      }
    }
  }
  function switchAB(sec, v) {
    if (sec.showing === v) return;
    ui.edit('Switch to ' + v, () => {
      if (v === 'B' && !sec.clipsB) { sec.clipsB = CC.song.clone(sec.clips); ui.toast('Made a B copy. Change it freely, A is safe.'); }
      sec.showing = v;
    });
  }
  function abMenu(anchor, sec) {
    const other = sec.showing === 'A' ? 'B' : 'A';
    const items = [];
    if (sec.clipsB) {
      items.push({ label: `Keep only ${sec.showing} (delete ${other})`, action: () => ui.edit('Keep ' + sec.showing, () => { if (sec.showing === 'B') sec.clips = sec.clipsB; sec.clipsB = null; sec.showing = 'A'; }) });
      items.push({ label: `Copy ${sec.showing} over ${other}`, action: () => ui.edit('Copy version', () => { const c = CC.song.clone(CC.song.activeClips(sec)); if (sec.showing === 'A') sec.clipsB = c; else sec.clips = c; }) });
      items.push({ label: `Make ${other} a new section`, action: () => ui.edit('A/B to section', () => { const ns = CC.song.newSection(sec.name + ' ' + other, sec.bars, sec.mood); ns.clips = CC.song.clone(sec.showing === 'A' ? sec.clipsB : sec.clips); S.song.sections.splice(S.song.sections.indexOf(sec) + 1, 0, ns); }) });
    } else items.push({ label: 'Create a B version to compare', action: () => switchAB(sec, 'B') });
    ui.menu(anchor, items);
  }

  function renderNotice() {
    const n = $('#editor-notice');
    const track = ui.track(), sec = ui.section();
    n.innerHTML = '';
    n.hidden = true;
    if (!track) return;
    const song = S.song;
    const level = CC.mix.moodLevel(sec.mood);
    if (song.layersFollowMood && (track.layer || 1) > level) {
      n.hidden = false;
      n.append(`"${track.name}" only plays in ${['', '', 'tense and intense', 'intense'][track.layer]} sections, so it's silent in this ${sec.mood} section.`,
        h('button', { class: 'btn small', onclick: () => ui.edit('Layer', () => { track.layer = 1; }) }, 'Play it everywhere'),
        h('button', { class: 'btn small', onclick: () => ui.edit('Layers off', () => { song.layersFollowMood = false; }) }, 'Turn off mood layers'));
      return;
    }
    if (!isDrums(track) && S.editorMode === 'simple') {
      const rowsP = new Set(geo.rows.map(r => r.p));
      const hidden = notes().filter(x => !rowsP.has(x.p)).length;
      if (hidden) {
        n.hidden = false;
        n.append(`${hidden} note${hidden > 1 ? 's are' : ' is'} outside this view.`, h('button', { class: 'btn small', onclick: () => { S.editorMode = 'piano'; ui.render(['editor']); scrollToNotes(); } }, 'Show in piano roll'));
      }
    }
    if (!CC.instruments.isReady(track.instrument)) {
      n.hidden = false;
      n.append(h('span', { class: 'loading-badge' }, '  Loading the ' + CC.instruments.info(track.instrument).name + ' sound…'));
    }
  }

  function render() {
    computeGeometry();
    renderBar();
    renderNotice();
    if (!geo.track) { sizeCanvas(grid(), 10, 10); return; }
    cursor.r = Math.min(cursor.r, Math.max(0, geo.rows.length - 1));
    cursor.s = Math.min(cursor.s, geo.steps - 1);
    draw();
  }
  ui.registerRenderer('editor', render);
  CC.events.on('samplesLoaded', () => { if (CC.ui.song()) renderNotice(); });

  // ---------- Hit testing & mouse ----------
  function at(e) {
    const r = grid().getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const s = Math.max(0, Math.min(geo.steps - 1, Math.floor(x / geo.cellW)));
    const ri = Math.max(0, Math.min(geo.rows.length - 1, Math.floor(y / geo.rowH)));
    return { x, y, s, ri, p: geo.rows[ri] && geo.rows[ri].p, fx: x / geo.cellW };
  }
  function noteAt(p, s) { return notes().find(n => n.p === p && s >= n.s && s < n.s + Math.max(1, n.l)); }
  function snapStep(s) { return Math.floor(s / S.snap) * S.snap; }
  function allowedPitch(p) {
    if (isDrums(geo.track)) return true;
    return !S.song.stayInKey || T.inScale(p, S.song.key, S.song.scale);
  }
  function preview(p) { CC.engine.preview(geo.track, p, isDrums(geo.track) ? 0.3 : 0.25); }

  // ---------- Selection & clipboard ----------
  let sel = new Set();
  let clipboard = null; // { kind, notes: [{s,p,l,v}] with s relative to the first note }
  function rowIndex(p) { return geo.rows.findIndex(r => r.p === p); }
  function removeNote(n) { const list = notes(); const i = list.indexOf(n); if (i >= 0) list.splice(i, 1); sel.delete(n); }
  function nearEnd(n, a) { const endX = (n.s + n.l) * geo.cellW; return endX - a.x < Math.max(7, geo.cellW * 0.3) && a.x < endX; }
  function pruneSel() { const list = notes(); sel = new Set([...sel].filter(n => list.includes(n))); }
  function selection() { pruneSel(); return [...sel]; }
  function rangeLabel(r) {
    const fmt = (st) => 'bar ' + (Math.floor(st / 16) + 1) + (st % 16 ? ' beat ' + (st % 16 / 4 + 1) : '');
    if (r.start % 16 === 0 && r.end - r.start === 16) return 'bar ' + (r.start / 16 + 1) + ' only';
    if (r.start % 16 === 0 && r.end % 16 === 0) return 'bars ' + (r.start / 16 + 1) + '–' + (r.end / 16);
    return fmt(r.start) + ' to ' + fmt(r.end);
  }
  function finish(label) { CC.song.activeClips(geo.sec)[geo.track.id] = CC.song.dedupe(notes()); pruneSel(); ui.commitOnly(label, ['editor', 'tracks']); }

  function copySel(cut) {
    const ns = selection();
    if (!ns.length) { ui.toast('Select some notes first: drag a box around them (Select tool, or hold Shift).'); return; }
    const s0 = Math.min(...ns.map(n => n.s));
    clipboard = { kind: geo.track.kind, notes: ns.map(n => ({ s: n.s - s0, p: n.p, l: n.l, v: n.v })), len: Math.max(...ns.map(n => n.s + n.l)) - s0 };
    if (cut) { ns.forEach(removeNote); finish('Cut notes'); ui.toast('Cut ' + ns.length + ' notes'); }
    else { ui.toast('Copied ' + ns.length + ' notes. Click where you want them, then Ctrl+V.'); renderBar(); }
  }
  function paste(at) {
    if (!clipboard) { ui.toast('Nothing copied yet.'); return; }
    if (clipboard.kind !== geo.track.kind) { ui.toast(clipboard.kind === 'drums' ? 'Those are drum notes. Pick a drum instrument to paste them.' : 'Those are melody notes. Pick a melody instrument to paste them.'); return; }
    const start = at === undefined ? cursor.s : at;
    const list = notes();
    const added = [];
    clipboard.notes.forEach(n => { const s = start + n.s; if (s < geo.steps) { const c = { ...n, s }; list.push(c); added.push(c); } });
    sel = new Set(added);
    finish('Paste notes');
    ui.toast('Pasted ' + added.length + ' notes. Drag them to move.');
  }
  function duplicateSel() {
    const ns = selection(); if (!ns.length) return false;
    const s0 = Math.min(...ns.map(n => n.s)), s1 = Math.max(...ns.map(n => n.s + n.l));
    const len = Math.max(1, Math.ceil((s1 - s0) / 4) * 4);
    const list = notes(), added = [];
    ns.forEach(n => { if (n.s + len < geo.steps) { const c = { ...n, s: n.s + len }; list.push(c); added.push(c); } });
    sel = new Set(added);
    finish('Duplicate notes');
    return true;
  }
  function deleteSel() { const ns = selection(); if (!ns.length) return false; ns.forEach(removeNote); finish('Delete notes'); return true; }
  function selectAll() { sel = new Set(notes()); draw(); renderBar(); }
  function clearSel() { if (sel.size) { sel.clear(); draw(); renderBar(); } }

  // ---------- Mouse, pen and touch ----------
  // On a touch screen one finger draws; a second finger cancels that and scrolls the grid instead.
  const touches = new Map(); let pan = null, touchSnap = null;
  function touchDown(e) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) { touchSnap = JSON.stringify(notes()); return false; }
    if (drag) { const list = notes(); list.splice(0, list.length, ...JSON.parse(touchSnap)); sel.clear(); drag = null; draw(); }
    const sc = $('#grid-scroll'), pts = [...touches.values()];
    pan = { x: pts[0].x, y: pts[0].y, id: e.pointerId, sl: sc.scrollLeft, st: sc.scrollTop };
    return true;
  }
  function onDown(e) {
    if (!geo.track) return;
    if (e.pointerType === 'touch' && touchDown(e)) return;
    e.preventDefault();
    grid().focus({ preventScroll: true });
    const a = at(e);
    if (a.p === undefined) return;
    cursor = { r: a.ri, s: a.s };
    const list = notes();
    const hit = noteAt(a.p, a.s);
    const drums = isDrums(geo.track);
    if (drums) lastDrumRow = a.p;
    pruneSel();
    if (e.button === 2) {
      drag = { mode: 'erase', changed: false };
      if (hit) { removeNote(hit); drag.changed = true; }
      draw(); return;
    }
    const selectTool = S.tool === 'select';
    // Grab selected notes (or any note with the Select tool): drag moves them, Ctrl/Alt+drag copies them
    if (hit && (sel.has(hit) || selectTool)) {
      if (!sel.has(hit)) { if (!e.shiftKey) sel.clear(); sel.add(hit); }
      let moving = [...sel];
      const copying = e.ctrlKey || e.altKey;
      if (copying) { const copies = moving.map(n => ({ ...n })); list.push(...copies); sel = new Set(copies); moving = copies; }
      if (!drums && nearEnd(hit, a) && !copying) drag = { mode: 'resize-sel', notes: moving, startL: moving.map(n => n.l), startS: a.s, changed: false };
      else drag = { mode: 'move-sel', notes: moving, orig: moving.map(n => ({ s: n.s, r: rowIndex(n.p), p: n.p })), startS: a.s, startR: a.ri, hit, moved: false, changed: copying, shift: e.shiftKey };
      preview(hit.p);
      draw(); renderBar(); return;
    }
    if (selectTool || e.shiftKey) {
      drag = { mode: 'marquee', x0: a.x, y0: a.y, x1: a.x, y1: a.y, base: e.shiftKey ? new Set(sel) : new Set() };
      sel = new Set(drag.base);
      draw(); return;
    }
    if (sel.size) { sel.clear(); renderBar(); }
    if (drums) {
      if (hit) { removeNote(hit); drag = { mode: 'erase', changed: true }; }
      else { list.push({ s: a.s, p: a.p, l: 1, v: 0.8 }); preview(a.p); drag = { mode: 'paint', changed: true, start: a.s, len: 1 }; }
      draw(); return;
    }
    if (hit) {
      if (nearEnd(hit, a)) drag = { mode: 'resize', note: hit, changed: false };
      else drag = { mode: 'move', note: hit, offset: a.s - hit.s, moved: false, changed: false };
      preview(hit.p);
      return;
    }
    if (!allowedPitch(a.p)) { ui.toast('That note is outside your key. Turn off "Stay in key" to use it.'); return; }
    const n = { s: snapStep(a.s), p: a.p, l: S.noteLen, v: 0.8 };
    list.push(n);
    preview(a.p);
    drag = { mode: 'create', note: n, row: a.ri, changed: true };
    draw();
  }

  // Keep the grid scrolling while you drag near its edges
  let autoScroll = null;
  function edgeScroll(e) {
    const sc = $('#grid-scroll'), r = sc.getBoundingClientRect();
    let dy = 0, dx = 0;
    if (e.clientY < r.top + HEADER_H + 24) dy = -12; else if (e.clientY > r.bottom - 20) dy = 12;
    if (e.clientX < r.left + KEYS_W + 20) dx = -14; else if (e.clientX > r.right - 20) dx = 14;
    clearInterval(autoScroll); autoScroll = null;
    if ((dx || dy) && drag) {
      const last = { clientX: e.clientX, clientY: e.clientY, buttons: 1 };
      autoScroll = setInterval(() => { if (!drag) { clearInterval(autoScroll); return; } sc.scrollTop += dy; sc.scrollLeft += dx; onMove(last, true); }, 40);
    }
  }

  function onMove(e, fromScroll) {
    if (pan && e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = touches.get(pan.id), sc = $('#grid-scroll');
      if (p) { sc.scrollLeft = pan.sl - (p.x - pan.x); sc.scrollTop = pan.st - (p.y - pan.y); }
      return;
    }
    if (!drag) {
      if (!geo.track || e.buttons) return;
      const a = at(e);
      const hit = a.p !== undefined && noteAt(a.p, a.s);
      grid().style.cursor = hit ? (!isDrums(geo.track) && nearEnd(hit, a) ? 'ew-resize' : (sel.has(hit) || S.tool === 'select' ? 'move' : 'grab')) : (S.tool === 'select' ? 'cell' : 'crosshair');
      return;
    }
    if (!fromScroll) edgeScroll(e);
    const a = at(e);
    const list = notes();
    switch (drag.mode) {
      case 'erase': { const hit = noteAt(a.p, a.s); if (hit) { removeNote(hit); drag.changed = true; draw(); } return; }
      case 'paint': {
        // Drums: paint a hit in every cell you pass over, on any row
        if (!noteAt(a.p, a.s)) { list.push({ s: a.s, p: a.p, l: 1, v: 0.8 }); preview(a.p); drag.changed = true; draw(); }
        return;
      }
      case 'create': {
        if (a.ri !== drag.row) {
          // Moved to another row: switch from "stretch the note" to "draw notes wherever I drag"
          drag.note.l = S.noteLen;
          drag.mode = 'paint-melody'; drag.origin = drag.note.s;
          return onMove(e, true);
        }
        const l = Math.max(1, Math.min(geo.steps - drag.note.s + 16, Math.ceil(a.fx) - drag.note.s));
        if (l !== drag.note.l) { drag.note.l = l; drag.changed = true; draw(); }
        return;
      }
      case 'paint-melody': {
        const len = S.noteLen;
        const s0 = drag.origin + Math.floor((a.s - drag.origin) / len) * len;
        if (s0 < 0 || s0 >= geo.steps || !allowedPitch(a.p)) return;
        const covered = list.some(n => n.p === a.p && n.s < s0 + len && n.s + n.l > s0);
        if (!covered) { list.push({ s: s0, p: a.p, l: len, v: 0.8 }); preview(a.p); drag.changed = true; draw(); }
        return;
      }
      case 'resize': {
        const l = Math.max(1, Math.min(geo.steps - drag.note.s + 16, Math.ceil(a.fx) - drag.note.s));
        if (l !== drag.note.l) { drag.note.l = l; drag.changed = true; draw(); }
        return;
      }
      case 'move': {
        const s = snapStep(Math.max(0, Math.min(geo.steps - 1, a.s - drag.offset)));
        let p = a.p;
        if (!allowedPitch(p)) p = drag.note.p;
        if (s !== drag.note.s || p !== drag.note.p) {
          if (p !== drag.note.p) preview(p);
          drag.note.s = s; drag.note.p = p; drag.moved = true; drag.changed = true; draw();
        }
        return;
      }
      case 'move-sel': {
        let dS = Math.round((a.s - drag.startS) / S.snap) * S.snap, dR = a.ri - drag.startR;
        const minS = Math.min(...drag.orig.map(o => o.s)), maxS = Math.max(...drag.orig.map(o => o.s));
        dS = Math.max(-minS, Math.min(geo.steps - 1 - maxS, dS));
        const rs = drag.orig.filter(o => o.r >= 0).map(o => o.r);
        if (rs.length) dR = Math.max(-Math.min(...rs), Math.min(geo.rows.length - 1 - Math.max(...rs), dR));
        let changedPitch = false;
        drag.notes.forEach((n, i) => {
          const o = drag.orig[i];
          n.s = o.s + dS;
          const np = o.r >= 0 ? geo.rows[o.r + dR].p : o.p;
          if (np !== n.p) { n.p = np; changedPitch = true; }
        });
        if (dS || dR) { drag.moved = true; drag.changed = true; }
        if (changedPitch && drag.hit) preview(drag.hit.p);
        draw();
        return;
      }
      case 'resize-sel': {
        const d = a.s - drag.startS;
        drag.notes.forEach((n, i) => { n.l = Math.max(1, drag.startL[i] + d); });
        drag.changed = true; draw();
        return;
      }
      case 'marquee': {
        drag.x1 = Math.max(0, Math.min(geo.steps * geo.cellW, a.x)); drag.y1 = Math.max(0, Math.min(geo.rows.length * geo.rowH, a.y));
        const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1), y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1);
        sel = new Set(drag.base);
        list.forEach(n => {
          const ri = rowIndex(n.p); if (ri < 0) return;
          const nx0 = n.s * geo.cellW, nx1 = (n.s + n.l) * geo.cellW, ny0 = ri * geo.rowH, ny1 = ny0 + geo.rowH;
          if (nx1 > x0 && nx0 < x1 && ny1 > y0 && ny0 < y1) sel.add(n);
        });
        draw();
        return;
      }
    }
  }
  function onUp(e) {
    if (e && e.pointerType === 'touch') { touches.delete(e.pointerId); if (pan) { if (!touches.size) pan = null; return; } }
    clearInterval(autoScroll); autoScroll = null;
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'marquee') { draw(); renderBar(); return; }
    if (d.mode === 'move' && !d.moved) { removeNote(d.note); d.changed = true; draw(); }
    if (d.mode === 'move-sel' && !d.moved && !d.changed) {
      // A plain click on a selected note: in Draw mode remove it, in Select mode select just it
      if (S.tool !== 'select' && !d.shift) { removeNote(d.hit); d.changed = true; }
      else if (!d.shift) { sel = new Set([d.hit]); }
      draw(); renderBar();
    }
    if (d.changed) finish(d.mode === 'move-sel' ? 'Move notes' : 'Edit notes');
  }

  // Velocity lane dragging
  function velDown(e) {
    const c = $('#vel-lane');
    const set = (ev) => {
      const r = c.getBoundingClientRect();
      const s = Math.floor((ev.clientX - r.left) / geo.cellW);
      const v = Math.max(0.05, Math.min(1, 1 - (ev.clientY - r.top) / VEL_H));
      velTargets().filter(n => n.s === s).forEach(n => { n.v = +v.toFixed(2); });
      draw();
    };
    set(e);
    const mv = (ev) => set(ev);
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ui.commitOnly('Note loudness', ['editor']); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // Clear notes: one instrument, one section, or everything
  function clearDialog(sec, track) {
    const btn = (text, label, fn, cls) => h('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: () => { m.close(); ui.edit(label, fn); ui.toast(label + '. Press Ctrl+Z to undo.'); } }, text);
    const m = ui.modal('Clear notes', h('div', { class: 'clear-btns' },
      btn('Clear ' + track.name, 'Cleared ' + track.name, () => { CC.song.activeClips(sec)[track.id] = []; }),
      btn('Clear section', 'Cleared ' + sec.name, () => { const c = CC.song.activeClips(sec); Object.keys(c).forEach(k => { c[k] = []; }); }),
      btn('Clear everything', 'Cleared the whole song', (song) => { song.sections.forEach(s => { [s.clips, s.clipsB].forEach(c => { if (c) Object.keys(c).forEach(k => { c[k] = []; }); }); }); }, 'danger')), { narrow: true });
  }

  // ---------- Keyboard on the grid ----------
  const live = h('div', { 'aria-live': 'polite', style: { position: 'absolute', left: '-9999px' } });
  document.body.appendChild(live);
  function announce() {
    const r = geo.rows[cursor.r]; if (!r) return;
    const n = noteAt(r.p, cursor.s);
    live.textContent = `${r.label}, bar ${Math.floor(cursor.s / 16) + 1} beat ${Math.floor(cursor.s % 16 / 4) + 1}${cursor.s % 4 ? ' and ' + (cursor.s % 4) + '/4' : ''}${n ? ', note here' : ''}`;
  }
  function onKey(e) {
    if (!geo.track) return;
    const r = geo.rows[cursor.r];
    const list = notes();
    let handled = true;
    switch (e.key) {
      case 'ArrowUp': cursor.r = Math.max(0, cursor.r - 1); if (e.shiftKey) moveAt(-1); break;
      case 'ArrowDown': cursor.r = Math.min(geo.rows.length - 1, cursor.r + 1); if (e.shiftKey) moveAt(1); break;
      case 'ArrowLeft': if (e.shiftKey) resizeAt(-1); else cursor.s = Math.max(0, cursor.s - S.snap); break;
      case 'ArrowRight': if (e.shiftKey) resizeAt(1); else cursor.s = Math.min(geo.steps - 1, cursor.s + S.snap); break;
      case 'Enter': {
        const n = noteAt(r.p, cursor.s);
        if (n) list.splice(list.indexOf(n), 1);
        else if (allowedPitch(r.p)) { list.push({ s: cursor.s, p: r.p, l: isDrums(geo.track) ? 1 : S.noteLen, v: 0.8 }); preview(r.p); }
        ui.commitOnly('Edit notes', ['editor']);
        break;
      }
      case 'Delete': case 'Backspace': { const n = noteAt(r.p, cursor.s); if (n) { list.splice(list.indexOf(n), 1); ui.commitOnly('Delete note', ['editor']); } break; }
      default: handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); if (isDrums(geo.track)) lastDrumRow = geo.rows[cursor.r].p; draw(); announce(); scrollCursorIntoView(); }
    function resizeAt(d) { const n = noteAt(r.p, cursor.s); if (n && !isDrums(geo.track)) { n.l = Math.max(1, n.l + d * S.snap); ui.commitOnly('Resize note', ['editor']); } }
    function moveAt(d) { const prev = geo.rows[cursor.r + (d < 0 ? 1 : -1)]; const n = prev && noteAt(prev.p, cursor.s); if (n && !isDrums(geo.track)) { n.p = geo.rows[cursor.r].p; preview(n.p); ui.commitOnly('Move note', ['editor']); } }
  }
  function scrollCursorIntoView() {
    const sc = $('#grid-scroll');
    const x = KEYS_W + cursor.s * geo.cellW, y = HEADER_H + cursor.r * geo.rowH;
    if (x < sc.scrollLeft + KEYS_W) sc.scrollLeft = x - KEYS_W - 20;
    if (x + geo.cellW > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = x + geo.cellW - sc.clientWidth + 20;
    if (y < sc.scrollTop + HEADER_H) sc.scrollTop = y - HEADER_H - 10;
    if (y + geo.rowH > sc.scrollTop + sc.clientHeight) sc.scrollTop = y + geo.rowH - sc.clientHeight + 10;
  }

  function scrollToNotes() {
    requestAnimationFrame(() => {
      const sc = $('#grid-scroll');
      if (!geo.track || isDrums(geo.track)) { sc.scrollTop = 0; return; }
      const ns = notes();
      let target;
      if (ns.length) { const avg = ns.reduce((a, n) => a + n.p, 0) / ns.length; target = geo.rows.findIndex(r => r.p <= avg); }
      else target = geo.rows.findIndex(r => r.p <= (geo.track.octave + 1) * 12 + 7);
      if (target < 0) target = 0;
      sc.scrollTop = Math.max(0, target * geo.rowH - sc.clientHeight / 2 + HEADER_H);
    });
  }

  function keysDown(e) {
    const c = $('#grid-keys'); const r = c.getBoundingClientRect();
    const ri = Math.floor((e.clientY - r.top) / geo.rowH);
    const row = geo.rows[ri]; if (!row) return;
    if (row.drum) { lastDrumRow = row.p; drawKeys(); drawVel(); }
    CC.engine.noteOn(geo.track, row.p);
    const up = () => { CC.engine.noteOff(geo.track, row.p); removeEventListener('pointerup', up); };
    addEventListener('pointerup', up);
  }

  // ---------- Playhead ----------
  function updatePlayhead(ph) {
    const el = $('#playhead');
    if (!ph || !geo.sec || ph.sectionId !== geo.sec.id) { el.style.display = 'none'; return; }
    const x = (ph.step + ph.frac) * geo.cellW;
    el.style.display = 'block';
    el.style.transform = `translateX(${x}px)`;
    const sc = $('#grid-scroll');
    if (!drag && (x + KEYS_W > sc.scrollLeft + sc.clientWidth - 30 || x + KEYS_W < sc.scrollLeft + KEYS_W)) sc.scrollLeft = Math.max(0, x - 40);
  }

  function init() {
    const g = grid();
    g.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    g.addEventListener('contextmenu', e => e.preventDefault());
    g.addEventListener('keydown', onKey);
    g.addEventListener('focus', () => { draw(); announce(); });
    g.addEventListener('blur', () => draw());
    g.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); S.zoom = Math.max(0.5, Math.min(4, S.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); render(); } }, { passive: false });
    $('#grid-keys').addEventListener('pointerdown', keysDown);
    $('#grid-header').addEventListener('pointerdown', headerDown);
    $('#grid-header').setAttribute('title', 'Click a bar number to loop just that bar. Drag to loop a few beats or bars. Click again to clear.');
    CC.events.on('loopChanged', () => { if (CC.ui.song()) { drawHeader(); draw(); renderBar(); } });
    $('#vel-lane').addEventListener('pointerdown', velDown);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => CC.ui.song() && render(), 120); });
  }

  CC.editor = { init, render, draw, updatePlayhead, scrollToNotes, setBars, cursorStep: () => cursor.s, copySel, paste, duplicateSel, deleteSel, selectAll, clearSel, hasSel: () => selection().length > 0, playSelection, playBar, hasClipboard: () => !!clipboard, setClipboard: (c) => { clipboard = c; }, getClipboard: () => clipboard };
})(window.CC);
