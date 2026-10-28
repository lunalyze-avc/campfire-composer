// Make room on smaller screens: fold away the side panel and the top section, and resize the playable instrument.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, h } = ui;
  const relayout = () => dispatchEvent(new Event('resize'));

  function setSide(collapsed) {
    document.body.classList.toggle('side-collapsed', collapsed);
    CC.storage.setting('sideCollapsed', collapsed);
    const b = $('#side-toggle');
    b.textContent = collapsed ? '«' : '»';
    b.setAttribute('aria-label', collapsed ? 'Show the side panel' : 'Hide the side panel');
    b.setAttribute('data-tip', collapsed ? 'Show the side panel' : 'Hide the side panel to give the grid more room');
    relayout();
  }
  function setTop(compact) {
    document.body.classList.toggle('tl-compact', compact);
    CC.storage.setting('tlCompact', compact);
    const b = $('#tl-toggle');
    b.textContent = compact ? '▾ More' : '▴ Less';
    b.setAttribute('data-tip', compact ? 'Show the song order and sound wave again' : 'Show only the sections, to give the grid and instrument more room');
    relayout();
  }
  function setCompact(on) {
    document.body.classList.toggle('tracks-compact', on);
    CC.storage.setting('tracksCompact', on);
    const b = $('#tracks-compact');
    b.textContent = on ? '☰ Roomy' : '≡ Compact';
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('data-tip', on ? 'Show each instrument\'s sound name and volume slider again' : 'Shorter instrument cards: hides the sound name and volume slider so more instruments fit (change the sound from the ⋯ menu)');
  }
  function setSurfaceHeight(px) {
    const max = Math.max(120, innerHeight * 0.55);
    px = Math.round(Math.max(70, Math.min(max, px)));
    document.documentElement.style.setProperty('--surface-h', px + 'px');
    return px;
  }

  function init() {
    // Side panel: a button at the end of the tab row; clicking any tab while folded opens it again
    const tabs = $('#side-tabs');
    tabs.appendChild(h('button', { id: 'side-toggle', class: 'side-toggle', type: 'button', onclick: (e) => { e.stopPropagation(); setSide(!document.body.classList.contains('side-collapsed')); } }));
    tabs.addEventListener('click', (e) => { if (e.target.closest('[data-tab]') && document.body.classList.contains('side-collapsed')) setSide(false); });
    setSide(!!CC.storage.setting('sideCollapsed'));

    // Top section: show just the sections row, or everything
    $('.timeline').appendChild(h('button', { id: 'tl-toggle', class: 'btn small tl-toggle', type: 'button', onclick: () => setTop(!document.body.classList.contains('tl-compact')) }));
    setTop(!!CC.storage.setting('tlCompact'));

    // Instruments list: compact cards
    $('.tracks .panel-title').appendChild(h('button', { id: 'tracks-compact', class: 'btn small tracks-compact', type: 'button', onclick: () => setCompact(!document.body.classList.contains('tracks-compact')) }));
    setCompact(!!CC.storage.setting('tracksCompact'));

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
  CC.layout = { init, setSide, setTop, setCompact };
})(window.CC);
