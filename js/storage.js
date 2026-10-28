// Autosave, project library (IndexedDB), uploaded sample storage, save/open song files.
window.CC = window.CC || {};
(function (CC) {
  const DB_NAME = 'campfire-composer';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('No IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('samples')) d.createObjectStore('samples', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : r);
      t.onerror = () => reject(t.error);
    });
  }
  const put = (store, v) => tx(store, 'readwrite', s => s.put(v)).catch(e => console.warn('save failed', e));
  const get = (store, k) => tx(store, 'readonly', s => s.get(k)).catch(() => null);
  const del = (store, k) => tx(store, 'readwrite', s => s.delete(k)).catch(() => null);
  const all = (store) => tx(store, 'readonly', s => s.getAll()).catch(() => []);

  function b64(bytes) {
    const u = new Uint8Array(bytes); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

  // ---------- Uploaded samples ----------
  async function storeSample(id, name, bytes, root, mime) { await put('samples', { id, name, bytes, root, mime }); }
  async function listSamples() { return (await all('samples')) || []; }
  async function deleteSample(id) { await del('samples', id); }
  async function getSample(id) { return get('samples', id); }
  async function restoreSamples(song) {
    for (const [id, meta] of Object.entries(song.samples || {})) {
      if (CC.instruments.userSamples[id]) { CC.instruments.userSamples[id].root = meta.root; continue; }
      const rec = await get('samples', id);
      if (rec) { try { await CC.instruments.addUserSample(id, meta.name || rec.name, rec.bytes, meta.root || rec.root, rec.mime); } catch (e) { console.warn(e); } }
    }
  }

  // ---------- Autosave + project library ----------
  let timer = null;
  function autosave(song) {
    clearTimeout(timer);
    timer = setTimeout(() => saveNow(song), 700);
  }
  async function saveNow(song) {
    if (!song) return;
    if (!song.projectId) song.projectId = CC.song.uid('p');
    const rec = { id: song.projectId, name: song.name, updated: Date.now(), song: JSON.stringify(song) };
    try { localStorage.setItem('cc.autosave', rec.song); localStorage.setItem('cc.autosaveTime', String(rec.updated)); } catch (e) {}
    await put('projects', rec);
    CC.events.emit('autosaved', rec.updated);
  }
  function lastAutosave() {
    try { const s = localStorage.getItem('cc.autosave'); return s ? { song: JSON.parse(s), time: +localStorage.getItem('cc.autosaveTime') } : null; } catch (e) { return null; }
  }
  async function listProjects() { const p = await all('projects'); return (p || []).sort((a, b) => b.updated - a.updated); }
  async function openProject(id) { const r = await get('projects', id); return r ? JSON.parse(r.song) : null; }
  async function deleteProject(id) { await del('projects', id); }

  // ---------- Save / open song file ----------
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  function safeName(s) { return (s || 'song').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'song'; }
  async function saveFile(song) {
    const samples = {};
    for (const id of Object.keys(song.samples || {})) {
      const s = CC.instruments.userSamples[id];
      if (s) samples[id] = { name: s.name, root: s.root, mime: s.mime, data: b64(s.bytes) };
    }
    const json = JSON.stringify({ format: 'campfire-composer', version: 1, song, samples });
    const blob = new Blob([json], { type: 'application/json' });
    const filename = safeName(song.name) + '.campfire';
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'Campfire Composer song', accept: { 'application/json': ['.campfire'] } }] });
        const w = await h.createWritable(); await w.write(blob); await w.close();
        return true;
      } catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    download(blob, filename);
    return true;
  }
  async function openFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.format !== 'campfire-composer') throw new Error('This is not a Campfire Composer song file.');
    for (const [id, s] of Object.entries(data.samples || {})) {
      const bytes = unb64(s.data);
      await storeSample(id, s.name, bytes, s.root, s.mime);
      await CC.instruments.addUserSample(id, s.name, bytes, s.root, s.mime);
    }
    const song = CC.song.normalize(data.song);
    song.projectId = CC.song.uid('p');
    return song;
  }

  // ---------- Settings ----------
  function setting(key, val) {
    try {
      if (val === undefined) { const v = localStorage.getItem('cc.set.' + key); return v === null ? null : JSON.parse(v); }
      localStorage.setItem('cc.set.' + key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  CC.storage = { storeSample, listSamples, deleteSample, getSample, restoreSamples, autosave, saveNow, lastAutosave, listProjects, openProject, deleteProject, saveFile, openFile, download, safeName, setting, b64 };
})(window.CC);
