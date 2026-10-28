// UI core: app state, DOM helpers, editing with undo, tooltips, toasts, modals, menus.
window.CC = window.CC || {};
(function (CC) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') e.innerHTML = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const state = {
    song: null, selTrackId: null, selSectionId: null,
    level: 'beginner', sideTab: 'make', editorMode: 'simple', noteLen: 2, snap: 1, zoom: 1,
    playMode: 'section', velLane: false
  };

  const ui = {
    state, $, $$, h,
    song: () => state.song,
    track: () => state.song.tracks.find(t => t.id === state.selTrackId) || state.song.tracks[0] || null,
    section: () => state.song.sections.find(s => s.id === state.selSectionId) || state.song.sections[0],
    selectedSectionId: () => (ui.section() || {}).id,
    advanced: () => state.level === 'advanced'
  };

  // ---------- Editing with undo + autosave ----------
  // fn mutates state.song in place. parts = which UI areas to refresh.
  ui.edit = function (label, fn, parts) {
    const r = fn(state.song);
    afterChange(label, parts);
    return r;
  };
  function afterChange(label, parts) {
    CC.song.commit(state.song, label);
    CC.storage.autosave(state.song);
    setSaveState('Saving…');
    CC.engine.setSong(state.song);
    ui.render(parts);
  }
  ui.commitOnly = function (label, parts) { afterChange(label, parts); };
  function setSaveState(t) { const e = $('#save-state'); if (e) e.textContent = t; }
  CC.events.on('autosaved', () => setSaveState('Autosaved'));

  ui.undo = function () { const s = CC.song.undo(); if (s) { replaceSong(s); toast('Undone'); } };
  ui.redo = function () { const s = CC.song.redo(); if (s) { replaceSong(s); toast('Redone'); } };
  function replaceSong(s) {
    state.song = CC.song.normalize(s);
    CC.engine.setSong(state.song);
    CC.storage.autosave(state.song);
    ui.render();
  }

  // Load a whole new song into the editor
  ui.loadSong = async function (song, opts = {}) {
    CC.engine.stop();
    state.song = CC.song.normalize(song);
    if (!state.song.projectId) state.song.projectId = CC.song.uid('p');
    state.selTrackId = (state.song.tracks.find(t => /melody|lead/i.test(t.name)) || state.song.tracks.find(t => t.kind === 'melody') || state.song.tracks[0] || {}).id;
    if (opts.selectDrums) state.selTrackId = (state.song.tracks.find(t => t.kind === 'drums') || {}).id || state.selTrackId;
    state.selSectionId = state.song.sections[0].id;
    await CC.storage.restoreSamples(state.song);
    CC.song.resetHistory(state.song);
    CC.engine.setSong(state.song);
    CC.storage.saveNow(state.song);
    $('#start').hidden = true;
    $('#app').hidden = false;
    ui.render();
    CC.instruments.ensureLoaded(state.song.tracks.map(t => t.instrument)).then(() => ui.render(['tracks']));
    requestAnimationFrame(() => CC.editor.scrollToNotes());
  };

  // ---------- Rendering orchestration ----------
  const renderers = {};
  ui.registerRenderer = (name, fn) => { renderers[name] = fn; };
  ui.render = function (parts) {
    if (!state.song) return;
    CC.theory.setKeyForNames(state.song.key, state.song.scale);
    const list = parts || Object.keys(renderers);
    list.forEach(p => { if (renderers[p]) { try { renderers[p](); } catch (e) { console.error('render ' + p, e); } } });
  };

  ui.selectTrack = function (id) {
    // Picking a different instrument switches the playable instrument to match it (piano, guitar or bass); you can still change it after
    if (id !== state.selTrackId) {
      const t = state.song.tracks.find(x => x.id === id), info = t && CC.instruments.info(t.instrument);
      if (info && t.kind !== 'drums') t.view = info.view === 'guitar' || info.view === 'bass' ? info.view : 'piano';
    }
    state.selTrackId = id;
    ui.render(['tracks', 'editor', 'side', 'surface']);
    CC.editor.scrollToNotes();
  };
  ui.selectSection = function (id) {
    state.selSectionId = id;
    ui.render(['timeline', 'editor', 'side']);
  };

  // ---------- Tooltips ----------
  let tipTimer = null, tipTarget = null;
  function showTip(target) {
    const tip = $('#tooltip');
    const text = target.getAttribute('data-tip');
    if (!text) return;
    const ex = target.getAttribute('data-ex');
    tip.innerHTML = '';
    tip.appendChild(document.createTextNode(text));
    if (ex) tip.appendChild(h('span', { class: 'ex' }, 'Example: ' + ex));
    tip.hidden = false;
    const r = target.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2, y = r.bottom + 8;
    if (y + tr.height > innerHeight - 4) y = r.top - tr.height - 8;
    x = Math.max(6, Math.min(innerWidth - tr.width - 6, x));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); tipTarget = null; $('#tooltip').hidden = true; }
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipTarget) return;
    hideTip();
    if (t) { tipTarget = t; tipTimer = setTimeout(() => showTip(t), 450); }
  });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); hideTip(); if (t && t.matches(':focus-visible')) { tipTarget = t; tipTimer = setTimeout(() => showTip(t), 300); } });
  document.addEventListener('mousedown', hideTip);
  document.addEventListener('focusout', hideTip);

  // ---------- Toast ----------
  function toast(msg, err) {
    const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), err ? 5000 : 2200);
  }
  ui.toast = toast;

  // ---------- Modal ----------
  ui.modal = function (title, body, { footer, narrow, onClose } = {}) {
    const root = $('#modal-root');
    const prevFocus = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); prevFocus && prevFocus.focus && prevFocus.focus(); };
    const closeBtn = h('button', { class: 'btn icon', 'aria-label': 'Close', onclick: close }, '✕');
    const modal = h('div', { class: 'modal' + (narrow ? ' narrow' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', {}, h('h2', {}, title), closeBtn),
      h('div', { class: 'body' }, body),
      footer ? h('footer', {}, footer) : null);
    const back = h('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(); } }, modal);
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = $$('button, input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter(x => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    root.appendChild(back);
    setTimeout(() => { const first = modal.querySelector('.body input, .body button, footer button') || closeBtn; first.focus(); }, 30);
    return { close, modal };
  };
  ui.prompt = function (title, value, onOk) {
    const inp = h('input', { type: 'text', value: value || '', style: { width: '100%' } });
    const m = ui.modal(title, inp, { narrow: true, footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn accent', onclick: ok }, 'OK')] });
    function ok() { const v = inp.value.trim(); m.close(); if (v) onOk(v); }
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } }); // stop Enter from also clicking the button focus returns to
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  };
  // Pick a color from a few ready-made swatches or any color you like
  ui.pickColor = function (title, current, palette, onPick) {
    const grid = h('div', { class: 'swatch-grid' });
    const m = ui.modal(title, h('div', {}, grid,
      h('label', { class: 'color-pick', style: { marginTop: '.7rem' } },
        h('input', { type: 'color', value: current, onchange: e => { m.close(); onPick(e.target.value); } }), h('span', {}, 'Or choose any color…'))), { narrow: true });
    palette.forEach(c => grid.appendChild(h('button', { class: 'swatch' + (c.toLowerCase() === (current || '').toLowerCase() ? ' on' : ''), 'aria-label': c, style: { background: c }, onclick: () => { m.close(); onPick(c); } })));
  };
  ui.confirm = function (title, text, okLabel, onOk) {
    const m = ui.modal(title, h('p', {}, text), { narrow: true, footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn accent', onclick: () => { m.close(); onOk(); } }, okLabel)] });
  };

  // ---------- Popup menu ----------
  ui.menu = function (anchor, items) {
    document.querySelectorAll('.menu').forEach(m => m.remove());
    const menu = h('div', { class: 'menu', role: 'menu' });
    items.filter(Boolean).forEach(it => {
      if (it === '-') { menu.appendChild(h('hr')); return; }
      menu.appendChild(h('button', { role: 'menuitem', class: it.danger ? 'danger' : '', onclick: () => { menu.remove(); it.action(); } }, it.label));
    });
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    menu.style.left = Math.min(innerWidth - mr.width - 6, r.left) + 'px';
    menu.style.top = (r.bottom + mr.height > innerHeight ? r.top - mr.height - 4 : r.bottom + 4) + 'px';
    const first = menu.querySelector('button'); first && first.focus();
    const off = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', off, true); } };
    setTimeout(() => document.addEventListener('mousedown', off, true), 0);
    menu.addEventListener('keydown', e => {
      const b = $$('button', menu); const i = b.indexOf(document.activeElement);
      if (e.key === 'Escape') { menu.remove(); anchor.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); b[(i + 1) % b.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); b[(i - 1 + b.length) % b.length].focus(); }
    });
  };

  // ---------- Small control builders ----------
  // Slider with plain-language label, ends, and the exact value shown nearby
  ui.slider = function ({ label, tip, ex, min = 0, max = 1, step = 0.01, value, left, right, fmt, onInput, onChange }) {
    const val = h('span', { class: 'val' }, fmt ? fmt(value) : '');
    const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); val.textContent = fmt ? fmt(v) : ''; onInput && onInput(v); });
    inp.addEventListener('change', () => onChange && onChange(parseFloat(inp.value)));
    return h('div', { class: 'ctrl', 'data-tip': tip, 'data-ex': ex }, h('label', {}, h('span', {}, label), val), inp, (left || right) ? h('div', { class: 'ends' }, h('span', {}, left || ''), h('span', {}, right || '')) : null);
  };
  ui.pct = (v) => Math.round(v * 100) + '%';

  CC.ui = ui;
})(window.CC);
