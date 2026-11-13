// Playhead strip: the whole song to scale under the song order. The orange marker is where "From playhead" starts.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, S = ui.state;
  S.cue = { arrIndex: 0, step: 0 };
  S.selArrIndex = 0;

  const secById = (id) => S.song.sections.find(s => s.id === id);
  const steps = (sec) => sec.bars * 16;

  function setCue(arrIndex, step) {
    S.cue = { arrIndex, step };
    CC.engine.cue = S.cue;
  }

  // ---------- Rendering ----------
  // A slim strip under the song order: the whole song to scale, bar numbers, and the playhead you can drag
  function render() {
    const song = S.song, wrap = $('#lanes');
    if (!wrap) return;
    const sel = ui.section();
    const arr = song.arrangement.map((id, i) => ({ sec: secById(id), i })).filter(x => x.sec);
    if (S.cue.arrIndex >= song.arrangement.length) setCue(0, 0);
    if (song.arrangement[S.selArrIndex] !== sel.id) {
      const k = song.arrangement.indexOf(sel.id);
      if (k >= 0) S.selArrIndex = k;
    }
    CC.engine.cue = S.cue;
    wrap.innerHTML = '';
    let bar = 1;
    arr.forEach(({ sec, i }) => {
      const first = bar; bar += sec.bars;
      const ticks = h('div', { class: 'lane-ruler', 'data-i': i });
      for (let b = 0; b < sec.bars; b++) ticks.appendChild(h('span', { class: 'tick' + (b === 0 ? ' first' : '') }, b === 0 || sec.bars <= 8 || b % 4 === 0 ? String(first + b) : ''));
      wrap.appendChild(h('div', { class: 'lane-col' + (i === S.selArrIndex && sec.id === sel.id ? ' here' : ''), 'data-i': i,
        style: '--sc:' + CC.song.secColor(song, sec) + ';flex-grow:' + sec.bars, 'data-tip': sec.name + ': tap or drag here to move the playhead. Then press Play with "From playhead".' }, ticks));
    });
    wrap.appendChild(h('div', { class: 'lane-ph', id: 'lane-ph', 'aria-hidden': 'true' }));
    const grip = h('div', { class: 'lane-grip', id: 'lane-grip', role: 'slider', tabindex: 0, 'aria-label': 'Playhead. Arrow keys move it one bar.', 'data-tip': 'Playhead: drag it to where you want to start, then press Play with "From playhead".' });
    wrap.appendChild(grip);
    grip.addEventListener('keydown', gripKey);
    last = null;
    requestAnimationFrame(() => frame(null, true));
  }
  // Draw the strip after the song order whenever the top panel redraws
  const baseTimeline = ui.getRenderer('timeline');
  ui.registerRenderer('timeline', () => { baseTimeline && baseTimeline(); render(); });

  // ---------- Playhead ----------
  // Where a song position sits on screen, in px from the left edge of the lanes
  function xOf(arrIndex, step) {
    const col = $(`#lanes .lane-col[data-i="${arrIndex}"]`); if (!col) return null;
    const sec = secById(S.song.arrangement[arrIndex]); if (!sec) return null;
    return col.offsetLeft + col.offsetWidth * Math.min(1, step / steps(sec));
  }
  function posAt(clientX) {
    const cols = $$('#lanes .lane-col[data-i]');
    if (!cols.length) return null;
    let col = cols.find(c => { const r = c.getBoundingClientRect(); return clientX < r.right; }) || cols[cols.length - 1];
    const r = col.getBoundingClientRect(), i = +col.dataset.i, sec = secById(S.song.arrangement[i]);
    const frac = Math.max(0, Math.min(0.9999, (clientX - r.left) / r.width));
    return { arrIndex: i, step: Math.floor(frac * steps(sec) / 4) * 4 }; // snap to the beat
  }
  function seek(e) {
    const p = posAt(e.clientX); if (!p) return;
    setCue(p.arrIndex, p.step);
    if (S.playMode !== 'here') { S.playMode = 'here'; ui.render(['top']); }
    frame(null, true);
  }
  function gripKey(e) {
    const song = S.song; let { arrIndex: i, step } = S.cue;
    const sec = secById(song.arrangement[i]); if (!sec) return;
    if (e.key === 'ArrowRight') { step += 16; if (step >= steps(sec)) { if (i < song.arrangement.length - 1) { i++; step = 0; } else step = steps(sec) - 16; } }
    else if (e.key === 'ArrowLeft') { step -= 16; if (step < 0) { if (i > 0) { i--; step = steps(secById(song.arrangement[i])) - 16; } else step = 0; } }
    else if (e.key === 'Home') { i = 0; step = 0; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); S.playMode = 'here'; CC.engine.toggle('here'); ui.render(['top']); return; }
    else return;
    e.preventDefault(); e.stopPropagation();
    setCue(i, step); if (S.playMode !== 'here') { S.playMode = 'here'; ui.render(['top']); }
    frame(null, true);
  }

  let last = null, lastPh = null;
  function frame(ph, force) {
    const line = $('#lane-ph'), grip = $('#lane-grip'); if (!line) return;
    const song = S.song;
    let p = null;
    if (ph) {
      lastPh = ph;
      let i = ph.arrIndex;
      if (i === undefined || song.arrangement[i] !== ph.sectionId) i = song.arrangement[S.selArrIndex] === ph.sectionId ? S.selArrIndex : song.arrangement.indexOf(ph.sectionId);
      if (i >= 0) p = { arrIndex: i, step: ph.step + ph.frac };
    } else p = S.cue;
    const key = p ? p.arrIndex + ':' + p.step.toFixed(2) + ':' + !!ph : 'none';
    if (key === last && !force) return;
    last = key;
    const x = p ? xOf(p.arrIndex, p.step) : null;
    line.hidden = grip.hidden = x === null;
    if (x === null) return;
    line.style.transform = grip.style.transform = `translateX(${x}px)`;
    line.classList.toggle('live', !!ph);
    // Bar number and time at the playhead
    let bars = 0, sec = 0;
    for (let k = 0; k < p.arrIndex; k++) { const s = secById(song.arrangement[k]); if (s) bars += s.bars; }
    const at = bars * 16 + p.step;
    sec = at / 4 * 60 / song.bpm;
    const pos = $('#lane-pos');
    if (pos) pos.textContent = 'Bar ' + (Math.floor(at / 16) + 1) + ' · ' + Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
    grip.setAttribute('aria-valuetext', pos ? pos.textContent : '');
  }

  function init() {
    CC.engine.cue = S.cue;
    const wrap = $('#lanes');
    let dragging = false;
    wrap.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.lane-ruler:not(.blank), .lane-grip')) return;
      e.preventDefault();
      dragging = true; wrap.setPointerCapture(e.pointerId); seek(e);
    });
    wrap.addEventListener('pointermove', (e) => { if (dragging) seek(e); });
    const up = () => {
      if (!dragging) return; dragging = false;
      if (CC.engine.playing) CC.engine.play('here'); // jump there right away
    };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    // Stopping while playing "From playhead" leaves the marker where the music stopped, so Play carries on from there
    CC.events.on('playState', (on) => {
      if (!on && S.playMode === 'here' && lastPh && lastPh.arrIndex !== undefined && S.song.arrangement[lastPh.arrIndex] === lastPh.sectionId) setCue(lastPh.arrIndex, lastPh.step);
      lastPh = null; last = null;
    });
    if (window.ResizeObserver) new ResizeObserver(() => { last = null; frame(null, true); }).observe($('#lanes-scroll'));
  }
  CC.lanes = { init, render, frame, setCue };
})(window.CC);
