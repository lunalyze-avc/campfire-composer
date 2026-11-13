// Make room on smaller screens: fold away the side panel and the top section, and resize the playable instrument.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui;
  const relayout = () => dispatchEvent(new Event('resize'));

  function setSide(collapsed) {
    document.body.classList.toggle('side-collapsed', collapsed);
    CC.storage.setting('sideCollapsed', collapsed);
    $$('#side-tabs [data-tab]').forEach(b => b.classList.toggle('open', !collapsed && b.dataset.tab === ui.state.sideTab));
    relayout();
  }
  function setTop(compact) {
    document.body.classList.toggle('tl-compact', compact);
    CC.storage.setting('tlCompact', compact);
    const b = $('#tl-toggle'); if (!b) return relayout();
    b.textContent = compact ? '▾ Sound wave' : '▴ Hide wave';
    b.setAttribute('data-tip', compact ? 'Show the sound wave of the whole song under the lanes' : 'Hide the sound wave to give the grid more room');
    relayout();
  }
  function setCompact(on) {
    document.body.classList.toggle('tracks-compact', on);
    CC.storage.setting('tracksCompact', on);
    CC.storage.setting('laneRows', on ? 'compact' : 'roomy');
  }
  function setSurfaceHeight(px) {
    const max = Math.max(120, innerHeight * 0.55);
    px = Math.round(Math.max(70, Math.min(max, px)));
    document.documentElement.style.setProperty('--surface-h', px + 'px');
    return px;
  }

  function init() {
    // Helper panel: slides out of the rail on the right edge. Tap a rail button to open its panel; tap it again (or ») to tuck it away
    const tabs = $('#side-tabs');
    $('#side-toggle').addEventListener('click', () => setSide(true));
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      const collapsed = document.body.classList.contains('side-collapsed');
      if (!collapsed && b.dataset.tab === ui.state.sideTab) { e.stopImmediatePropagation(); setSide(true); return; }
      if (collapsed) setSide(false);
      setTimeout(() => setSide(false), 0); // after the tab switched, so the right rail button lights up
    }, true);
    // Smaller screens start with the helper panel tucked away so the grid has room
    const sc = CC.storage.setting('sideCollapsed');
    setSide(sc === undefined || sc === null ? innerWidth <= 1450 : !!sc);

    // The sound wave row is gone in this look, so the lanes always get that room
    document.body.classList.add('tl-compact');

    // Instrument list: roomy rows unless you picked compact from the ☰ menu above it
    $('.tracks .panel-title').appendChild(h('button', { class: 'lane-menu', id: 'tracks-compact', type: 'button', 'aria-label': 'Instrument row size', 'aria-haspopup': 'menu', 'data-tip': 'Row size: roomy or compact',
      onclick: (e) => {
        const compact = document.body.classList.contains('tracks-compact');
        ui.menu(e.currentTarget, [
          { label: (compact ? '\u2003 ' : '✓ ') + 'Roomy rows (name, sound and volume)', action: () => { setCompact(false); ui.render(['tracks']); } },
          { label: (compact ? '✓ ' : '\u2003 ') + 'Compact rows (more instruments fit)', action: () => { setCompact(true); ui.render(['tracks']); } }]);
      } }, '☰'));
    setCompact(CC.storage.setting('laneRows') === 'compact');

    // Instrument height: drag the grip on top of the instrument area
    const saved = CC.storage.setting('surfaceH');
    if (saved) setSurfaceHeight(saved);
    else if (matchMedia('(pointer: coarse)').matches) setSurfaceHeight(innerHeight * 0.26); // bigger keys for fingers
    const grip = h('div', { class: 'surface-grip', role: 'separator', 'aria-label': 'Drag to make the instrument taller or shorter', 'data-tip': 'Drag up or down to make the instrument taller or shorter' }, h('span'));
    $('.surface').prepend(grip);
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const y0 = e.clientY, h0 = $('#surface-body').getBoundingClientRect().height;
      let last = h0;
      const mv = (ev) => { last = setSurfaceHeight(h0 + (y0 - ev.clientY)); relayout(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); CC.storage.setting('surfaceH', last); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }
  // Drag a grip to resize an area. onMove gets the pointer offset from where the drag started; the size is saved for next time.
  function dragGrip(grip, start, onMove, save, reset) {
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY, s0 = start();
      let last = s0;
      grip.classList.add('dragging');
      const mv = (ev) => { last = onMove(s0, ev.clientX - x0, ev.clientY - y0); relayout(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); grip.classList.remove('dragging'); save(last); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => { reset(); relayout(); });
  }
  function setSideWidth(px) {
    if (!px) { document.documentElement.style.removeProperty('--side-w'); return 0; }
    px = Math.round(Math.max(200, Math.min(innerWidth - 420, px)));
    document.documentElement.style.setProperty('--side-w', px + 'px');
    return px;
  }
  function initResize() {
    setSideWidth(CC.storage.setting('sideW'));
    // The panel sits on the right, so dragging its left edge leftwards makes it wider
    dragGrip($('#side-grip'), () => $('.side').getBoundingClientRect().width, (w0, dx) => setSideWidth(w0 - dx),
      v => CC.storage.setting('sideW', v), () => { setSideWidth(0); CC.storage.setting('sideW', null); });
  }
  CC.layout = { init: () => { init(); initResize(); }, setSide, setTop, setCompact };
})(window.CC);
