// Dialogs: instrument library, sample upload, export, save, settings, help.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, $$, h } = ui, T = CC.theory, S = ui.state;

  // ---------- Instrument library ----------
  function library({ trackId, add } = {}) {
    const track = trackId ? S.song.tracks.find(t => t.id === trackId) : null;
    let cat = 'All', q = '';
    const search = h('input', { type: 'text', placeholder: 'Search: clarinet, bass, spooky, 8-bit…', 'aria-label': 'Search instruments' });
    const chips = h('div', { class: 'cat-chips', role: 'group', 'aria-label': 'Categories' });
    const list = h('div', {});
    const body = h('div', {}, h('div', { class: 'lib-tools' }, search, h('button', { class: 'btn', onclick: () => { m.close(); uploadSample({ forTrack: trackId }); } }, '⬆ Upload your own sound'), h('button', { class: 'btn', onclick: () => { m.close(); recordSound({ forTrack: trackId }); } }, '🎙 Record a sound'), h('button', { class: 'btn', onclick: () => { m.close(); sounds(); } }, '🗂 Manage your sounds')), chips, list);
    const m = ui.modal(track ? `Choose a sound for "${track.name}"` : 'Add an instrument', body);
    function draw() {
      const all = CC.instruments.catalog();
      const cats = ['All', ...CC.instruments.CATEGORY_ORDER.filter(c => all.some(i => i.category === c))];
      chips.innerHTML = '';
      cats.forEach(c => chips.appendChild(h('button', { 'aria-pressed': String(c === cat), onclick: () => { cat = c; draw(); } }, c)));
      list.innerHTML = '';
      const ql = q.toLowerCase();
      const items = all.filter(i => (cat === 'All' || i.category === cat) && (!ql || (i.name + ' ' + i.desc + ' ' + i.category + ' ' + i.id).toLowerCase().includes(ql)));
      CC.instruments.CATEGORY_ORDER.forEach(c => {
        const group = items.filter(i => i.category === c);
        if (!group.length) return;
        list.appendChild(h('h3', { class: 'lib-cat' }, c));
        const grid = h('div', { class: 'lib-grid' });
        group.forEach(i => grid.appendChild(h('div', { class: 'lib-item' + (track && track.instrument === i.id ? ' current' : '') },
          h('button', { class: 'btn small', 'aria-label': 'Preview ' + i.name, onclick: () => CC.engine.previewInstrument(i.id) }, '▶'),
          h('div', { class: 'grow' }, h('b', {}, i.name), h('small', {}, i.desc)),
          h('button', { class: 'btn small accent', onclick: () => choose(i) }, track ? 'Use' : 'Add'))));
        list.appendChild(grid);
      });
      if (!items.length) list.appendChild(h('p', { class: 'muted' }, 'Nothing found. Try another word.'));
    }
    function choose(i) {
      m.close();
      if (!track || add) { ui.addTrack(i.id); return; }
      if ((i.kind === 'drums') !== (track.kind === 'drums')) {
        ui.addTrack(i.id);
        ui.toast('Drum kits and pitched instruments use different grids, so I added it as a new instrument.');
        return;
      }
      const oldInfo = CC.instruments.info(track.instrument);
      let moved = 0;
      ui.edit('Change sound', (song) => {
        track.instrument = i.id;
        if (i.id.startsWith('synth:')) track.synth = CC.instruments.defaultSynthParams(i.id);
        if (i.view) track.view = i.view;
        else if (track.view === 'bass' || track.view === 'guitar') track.view = 'piano';
        if (i.octave && Math.abs(i.octave - track.octave) > 1) track.octave = i.octave;
        // Keep the name in step if it was just the old instrument's name
        if (oldInfo && track.name === oldInfo.name) track.name = i.name;
        // Move the notes into the new instrument's natural range (a marimba tune is far too high for a bass)
        if (i.octave) {
          const clips = [];
          song.sections.forEach(sec => { [sec.clips, sec.clipsB].forEach(c => { if (c && c[track.id] && c[track.id].length) clips.push(c[track.id]); }); });
          const ps = clips.flat().map(n => n.p);
          if (ps.length) {
            const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
            const home = (i.octave + 1) * 12 + 7;
            moved = Math.round((home - avg) / 12);
            if (Math.abs(moved) < 2 && !(i.view === 'bass' && avg > home + 9)) moved = 0;
            const lo = Math.min(...ps), hi = Math.max(...ps);
            while (moved && (lo + moved * 12 < 24 || hi + moved * 12 > 108)) moved += moved > 0 ? -1 : 1;
            if (moved) clips.forEach(c => c.forEach(n => { n.p += moved * 12; }));
          }
        }
      });
      if (moved) ui.toast(`Moved the notes ${Math.abs(moved)} octave${Math.abs(moved) > 1 ? 's' : ''} ${moved < 0 ? 'down' : 'up'} so they suit the ${i.name.toLowerCase()}. Press Ctrl+Z to undo.`);
      CC.instruments.ensureLoaded([i.id]).then(() => ui.render(['tracks', 'editor']));
    }
    search.addEventListener('input', () => { q = search.value; draw(); });
    draw();
  }

  // ---------- Upload a sample ----------
  function uploadSample({ forTrack } = {}) {
    const input = $('#file-sample');
    input.value = '';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      try {
        const bytes = await file.arrayBuffer();
        await addSound(file.name.replace(/\.[^.]+$/, '').slice(0, 40), bytes, file.type || 'audio/wav', forTrack);
      } catch (e) {
        ui.toast('Could not read that audio file. Try WAV, MP3 or OGG.', true);
      }
    };
    input.click();
  }
  // ---------- Manage uploaded sounds ----------
  function usesOf(song, id) {
    const n = song.tracks.filter(t => t.instrument === 'user:' + id || Object.values(t.rowSamples || {}).includes(id)).map(t => t.name);
    return n;
  }
  function sounds() {
    const list = h('div', { class: 'sound-list' });
    const body = h('div', {}, h('p', { class: 'help' }, 'Every sound you have uploaded is kept inside this app on this computer. Preview, rename or delete them here. Deleting a sound frees space; instruments that used it switch to a piano.'),
      h('div', { class: 'row', style: { marginBottom: '.6rem' } }, h('button', { class: 'btn small', onclick: () => { m.close(); uploadSample(); } }, '⬆ Upload a sound…'), h('button', { class: 'btn small', onclick: () => { m.close(); recordSound(); } }, '🎙 Record a sound…')), list);
    const m = ui.modal('Your sounds', body, {});
    let playing = null;
    async function bufferOf(id) {
      if (CC.instruments.userSamples[id]) return CC.instruments.userSamples[id].buffer;
      const rec = await CC.storage.getSample(id); if (!rec) return null;
      return CC.audio.ctx().decodeAudioData(rec.bytes.slice(0));
    }
    async function preview(id) {
      if (playing) { try { playing.stop(); } catch (e) {} playing = null; }
      const buf = await bufferOf(id); if (!buf) return;
      const ctx = CC.audio.ctx(); const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(); playing = src;
    }
    async function build() {
      list.innerHTML = '';
      const recs = await CC.storage.listSamples();
      const seen = new Set(recs.map(r => r.id));
      Object.entries(CC.instruments.userSamples).forEach(([id, s]) => { if (!seen.has(id)) recs.push({ id, name: s.name, bytes: s.bytes }); });
      if (!recs.length) { list.appendChild(h('p', { class: 'muted' }, 'No uploaded sounds yet.')); return; }
      const song = S.song;
      recs.sort((a, b) => a.name.localeCompare(b.name)).forEach(r => {
        const used = song ? usesOf(song, r.id) : [];
        const inSong = song && song.samples && song.samples[r.id];
        const kb = r.bytes ? Math.round(r.bytes.byteLength / 1024) : 0;
        const size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
        list.appendChild(h('div', { class: 'sound-item' },
          h('button', { class: 'btn small icon', 'aria-label': 'Preview ' + r.name, 'data-tip': 'Listen', onclick: () => preview(r.id) }, '▶'),
          h('div', { class: 'grow' }, h('b', {}, r.name), h('small', { class: 'faint' }, size + (used.length ? ' · used by ' + used.join(', ') : inSong ? ' · in this song' : ''))),
          song && !inSong ? h('button', { class: 'btn small', 'data-tip': 'Add it to this song so it shows under "Your sounds" in the instrument list', onclick: async () => {
            const rec = await CC.storage.getSample(r.id);
            if (rec && !CC.instruments.userSamples[r.id]) await CC.instruments.addUserSample(r.id, rec.name, rec.bytes, rec.root, rec.mime);
            ui.edit('Use sound', (sg) => { sg.samples[r.id] = { name: r.name, root: (rec && rec.root) || 60 }; }, ['side']);
            ui.toast(`"${r.name}" is now in "Your sounds" in the instrument list.`); build();
          } }, '➕ Use in this song') : null,
          h('button', { class: 'btn small icon', 'aria-label': 'Rename ' + r.name, 'data-tip': 'Rename', onclick: () => ui.prompt('Rename sound', r.name, async v => {
            const rec = await CC.storage.getSample(r.id);
            if (rec) await CC.storage.storeSample(r.id, v, rec.bytes, rec.root, rec.mime);
            if (CC.instruments.userSamples[r.id]) CC.instruments.userSamples[r.id].name = v;
            if (song && song.samples[r.id]) ui.edit('Rename sound', (sg) => { sg.samples[r.id].name = v; });
            build();
          }) }, '✏️'),
          h('button', { class: 'btn small icon', 'aria-label': 'Delete ' + r.name, 'data-tip': 'Delete this sound', onclick: () => ui.confirm('Delete sound?',
            `Delete "${r.name}" from this app? ` + (used.length ? `It is used by ${used.join(', ')} in this song; ${used.length > 1 ? 'they' : 'it'} will switch to a piano (drum sounds go back to the built-in drum). ` : '') + 'Other songs that use it will lose it too, unless you saved them as a file. This cannot be undone.',
            'Delete', async () => {
              await CC.storage.deleteSample(r.id);
              delete CC.instruments.userSamples[r.id];
              if (song) {
                ui.edit('Delete sound', (sg) => {
                  delete sg.samples[r.id];
                  sg.tracks.forEach(t => {
                    if (t.instrument === 'user:' + r.id) { t.instrument = 'gm:acoustic_grand_piano'; t.oneShot = false; }
                    for (const [k, v] of Object.entries(t.rowSamples || {})) if (v === r.id) delete t.rowSamples[k];
                  });
                });
                CC.instruments.ensureLoaded(['gm:acoustic_grand_piano']).then(() => ui.render(['tracks', 'editor']));
              }
              ui.toast(`Deleted "${r.name}".`); build();
            }) }, '🗑')));
      });
    }
    build();
  }
  // ---------- Record a sound with a microphone ----------
  function recordSound({ forTrack } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return ui.toast('Recording is not available in this browser.', true);
    let stream = null, rec = null, chunks = [], recorded = null, raf = 0, startedAt = 0, previewSrc = null;
    const devSel = h('select', { 'aria-label': 'Microphone', style: { flex: 1, minWidth: 0 } });
    const meter = h('canvas', { class: 'rec-meter', width: 300, height: 14 });
    const status = h('div', { class: 'faint', 'aria-live': 'polite' }, 'Asking for your microphone…');
    const nameIn = h('input', { type: 'text', value: 'Recording ' + (Object.keys(CC.instruments.userSamples).length + 1), 'aria-label': 'Name', style: { flex: 1, minWidth: 0 } });
    const recBtn = h('button', { class: 'btn accent', onclick: toggle, disabled: true }, '● Record');
    const playBtn = h('button', { class: 'btn', disabled: true, onclick: preview }, '▶ Listen');
    const useBtn = h('button', { class: 'btn accent', disabled: true, onclick: use }, 'Use this sound');
    const body = h('div', {},
      h('p', { class: 'help' }, 'Pick a microphone, press Record, make your sound, then press Stop. Silence at the start and end is trimmed for you.'),
      h('div', { class: 'row' }, h('label', {}, '🎙'), devSel),
      meter, h('div', { class: 'row', style: { margin: '.6rem 0' } }, recBtn, playBtn), status,
      h('div', { class: 'row', style: { marginTop: '.6rem' } }, h('label', {}, 'Name'), nameIn));
    const m = ui.modal('Record a sound', body, { narrow: true, onClose: cleanup, footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), useBtn] });

    async function open(deviceId) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(raf);
      try {
        // Raw sound for music: no phone-call processing
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) { status.textContent = 'Could not use a microphone. Check that one is plugged in and that this app is allowed to use it.'; return; }
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
      const cur = stream.getAudioTracks()[0].getSettings().deviceId;
      devSel.innerHTML = '';
      devs.forEach((d, i) => devSel.appendChild(h('option', { value: d.deviceId, selected: d.deviceId === cur }, d.label || 'Microphone ' + (i + 1))));
      recBtn.disabled = false;
      status.textContent = recorded ? status.textContent : 'Ready. Make some noise to see the level move.';
      const ctx = CC.audio.ctx(); await CC.audio.resume();
      const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      const data = new Float32Array(an.fftSize), g = meter.getContext('2d');
      const draw = () => {
        raf = requestAnimationFrame(draw);
        an.getFloatTimeDomainData(data); let pk = 0; for (const v of data) pk = Math.max(pk, Math.abs(v));
        g.clearRect(0, 0, 300, 14); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 300, 14);
        g.fillStyle = pk > 0.95 ? '#ff4a3a' : getComputedStyle(document.documentElement).getPropertyValue('--accent'); g.fillRect(0, 0, 300 * Math.min(1, pk), 14);
        if (rec) status.textContent = 'Recording… ' + ((performance.now() - startedAt) / 1000).toFixed(1) + ' s';
      };
      draw();
    }
    devSel.onchange = () => open(devSel.value);
    function toggle() {
      if (rec) { rec.stop(); return; }
      chunks = []; recorded = null; useBtn.disabled = playBtn.disabled = true;
      rec = new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = finish;
      rec.start(); startedAt = performance.now();
      recBtn.textContent = '■ Stop'; devSel.disabled = true;
    }
    async function finish() {
      rec = null; recBtn.textContent = '● Record again'; devSel.disabled = false;
      try {
        const raw = await new Blob(chunks).arrayBuffer();
        const buf = await CC.audio.ctx().decodeAudioData(raw);
        recorded = trim(buf);
        if (!recorded) { status.textContent = 'That was silent. Check the microphone and try again.'; return; }
        status.textContent = `Got ${recorded.duration.toFixed(2)} s. Listen to it, then press "Use this sound".`;
        useBtn.disabled = playBtn.disabled = false;
      } catch (e) { status.textContent = 'Could not read the recording. Try again.'; }
    }
    // Cut the quiet parts at the start and end, with a tiny fade so there are no clicks
    function trim(buf) {
      const d = buf.getChannelData(0); let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
      if (pk < 0.003) return null;
      const th = pk * 0.04; let a = 0, b = d.length - 1;
      while (a < d.length && Math.abs(d[a]) < th) a++;
      while (b > a && Math.abs(d[b]) < th) b--;
      a = Math.max(0, a - Math.round(buf.sampleRate * 0.01)); b = Math.min(d.length - 1, b + Math.round(buf.sampleRate * 0.15));
      const len = b - a + 1, out = new AudioBuffer({ numberOfChannels: 1, length: len, sampleRate: buf.sampleRate });
      const o = out.getChannelData(0), fade = Math.min(len >> 2, Math.round(buf.sampleRate * 0.005));
      for (let i = 0; i < len; i++) { let v = 0; for (let c = 0; c < buf.numberOfChannels; c++) v += buf.getChannelData(c)[a + i]; o[i] = v / buf.numberOfChannels; }
      for (let i = 0; i < fade; i++) { o[i] *= i / fade; o[len - 1 - i] *= i / fade; }
      return out;
    }
    function preview() {
      if (!recorded) return;
      if (previewSrc) try { previewSrc.stop(); } catch (e) {}
      const ctx = CC.audio.ctx(); previewSrc = ctx.createBufferSource(); previewSrc.buffer = recorded; previewSrc.connect(ctx.destination); previewSrc.start();
    }
    async function use() {
      const bytes = await CC.exporter.wav(recorded).arrayBuffer();
      const name = nameIn.value.trim().slice(0, 40) || 'Recording';
      m.close();
      await addSound(name, bytes, 'audio/wav', forTrack);
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      if (rec) { rec.onstop = null; try { rec.stop(); } catch (e) {} }
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (previewSrc) try { previewSrc.stop(); } catch (e) {}
    }
    open();
  }
  // Keep a new sound in the app and in this song, then ask how to use it
  async function addSound(name, bytes, mime, forTrack) {
    const id = CC.song.uid('u');
    const s = await CC.instruments.addUserSample(id, name, bytes, 60, mime);
    await CC.storage.storeSample(id, name, bytes, 60, mime);
    ui.edit('Add sound', (song) => { song.samples[id] = { name, root: 60 }; }, []);
    afterUpload(id, s, forTrack);
  }
  function afterUpload(id, s, forTrack) {
    const drum = S.song.tracks.find(t => t.kind === 'drums' && t.id === forTrack) || S.song.tracks.find(t => t.kind === 'drums');
    const dur = s.buffer.duration.toFixed(2);
    const body = h('div', {},
      h('p', {}, `"${s.name}" (${dur} s) is ready. How do you want to use it?`),
      h('div', { class: 'export-opts' },
        h('button', { class: 'export-opt', onclick: () => { m.close(); ui.addTrack('user:' + id, s.name); } }, h('div', {}, h('b', {}, '🎹 As a playable instrument'), h('small', {}, 'Play it at different pitches on the keyboard, like a sampler. Best for single notes (a sung note, a pluck, a bell).'))),
        h('button', { class: 'export-opt', onclick: () => { m.close(); ui.addTrack('user:' + id, s.name); ui.edit('One-shot', () => { ui.track().oneShot = true; }); } }, h('div', {}, h('b', {}, '💥 As a one-shot sound'), h('small', {}, 'Always plays exactly as recorded. Best for sound effects, voice clips, hits.'))),
        drum ? h('button', { class: 'export-opt', onclick: () => { m.close(); S.selTrackId = drum.id; S.sideTab = 'sound'; ui.render(); ui.toast('Pick which drum to replace under "Drum sounds".'); } }, h('div', {}, h('b', {}, '🥁 As a drum sound'), h('small', {}, `Replace a drum in "${drum.name}" with it.`))) : null,
        h('button', { class: 'export-opt', onclick: () => m.close() }, h('div', {}, h('b', {}, '📁 Just keep it'), h('small', {}, 'It will be in "Your sounds" in the instrument list.')))));
    const m = ui.modal('Sound ready', body, { narrow: true });
  }

  // ---------- Export ----------
  function exportDialog(preset) {
    const song = S.song, sec = ui.section();
    let choice = preset || 'song', format = 'wav';
    const opt = (id, title, desc) => h('label', { class: 'export-opt' }, h('input', { type: 'radio', name: 'exp', value: id, checked: choice === id, onchange: () => { choice = id; refresh(); } }), h('div', {}, h('b', {}, title), h('small', {}, desc)));
    const fmtSeg = h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Audio format' });
    const fmtRow = h('div', { class: 'row', style: { margin: '.6rem 0' } }, h('span', {}, 'Format:'), fmtSeg, h('span', { class: 'faint', id: 'fmt-hint' }));
    const stemScope = h('select', {}, h('option', { value: 'section' }, `"${sec.name}" as a loop`), h('option', { value: 'song' }, 'Whole song'));
    const stemRow = h('div', { class: 'row', style: { margin: '.6rem 0' } }, h('span', {}, 'Stems of:'), stemScope);
    const packStems = h('input', { type: 'checkbox', checked: true });
    const packMp3 = h('input', { type: 'checkbox' });
    const packRow = h('div', { style: { margin: '.6rem 0' } }, h('label', { class: 'toggle' }, packStems, h('span', {}, 'Include separate instrument stems for every section')), h('br'), h('label', { class: 'toggle' }, packMp3, h('span', {}, 'Also include MP3 copies of the loops')));
    const prog = h('div', { class: 'progress', hidden: true }, h('div'));
    const status = h('p', { class: 'muted', 'aria-live': 'polite' });
    function refresh() {
      fmtSeg.innerHTML = '';
      [['wav', 'WAV'], ['mp3', 'MP3']].forEach(([v, l]) => fmtSeg.appendChild(h('button', { role: 'radio', 'aria-checked': String(format === v), onclick: () => { format = v; refresh(); } }, l)));
      $('#fmt-hint', fmtRow) && ($('#fmt-hint', fmtRow).textContent = format === 'wav' ? 'Best quality. Loops include loop points.' : 'Smaller files. Fine for most games.');
      fmtRow.hidden = !['song', 'loop', 'songloop'].includes(choice);
      stemRow.hidden = choice !== 'stems';
      packRow.hidden = choice !== 'pack';
    }
    const body = h('div', {},
      h('div', { class: 'export-opts' },
        opt('song', '🎵 Whole song', 'Plays through the song order once, letting the last notes ring out.'),
        opt('loop', `🔁 "${sec.name}" as a seamless loop`, 'Perfect for game background music. Ringing notes at the end are folded into the start so it repeats without a gap.'),
        opt('songloop', '🔁 Whole song as a seamless loop', 'The full song order, ready to repeat forever.'),
        opt('stems', '🎚 Separate instrument stems (ZIP)', 'One audio file per instrument, all the same length. Mix them in your game for adaptive music.'),
        opt('midi', '🎼 MIDI file', 'The notes only, to open in other music software (like FL Studio).'),
        opt('pack', '📦 Game-ready pack (ZIP)', 'Every section as a seamless loop + stems + MIDI + a music.json with tempo, loop points and game states.')),
      fmtRow, stemRow, packRow, prog, status);
    const go = h('button', { class: 'btn accent', onclick: run }, '⬇ Export');
    const m = ui.modal('Export your music', body, { footer: [h('button', { class: 'btn', onclick: () => m.close() }, 'Close'), go] });
    refresh();
    async function run() {
      go.disabled = true; prog.hidden = false;
      const bar = prog.firstChild;
      const progress = (msg, f) => { status.textContent = msg; bar.style.width = Math.round(f * 100) + '%'; };
      try {
        CC.engine.stop();
        let res;
        if (choice === 'song') res = await CC.exporter.exportAudio(song, { what: 'song', format }, progress);
        else if (choice === 'loop') res = await CC.exporter.exportAudio(song, { what: 'section', sectionId: sec.id, format, loop: true }, progress);
        else if (choice === 'songloop') res = await CC.exporter.exportAudio(song, { what: 'song', format, loop: true }, progress);
        else if (choice === 'stems') res = await CC.exporter.exportStems(song, { what: stemScope.value, sectionId: sec.id, loop: true }, progress);
        else if (choice === 'midi') res = { blob: CC.exporter.midi(song, CC.exporter.songPlan(song)), name: CC.storage.safeName(song.name) + '.mid' };
        else if (choice === 'pack') res = await CC.exporter.exportGamePack(song, { stems: packStems.checked, mp3s: packMp3.checked }, progress);
        progress('Done! Saved "' + res.name + '" to your Downloads folder.', 1);
        CC.storage.download(res.blob, res.name);
      } catch (e) {
        console.error(e);
        status.textContent = 'Something went wrong: ' + e.message;
      }
      go.disabled = false;
    }
  }

  // ---------- Save ----------
  async function save() {
    try {
      const ok = await CC.storage.saveFile(S.song);
      await CC.storage.saveNow(S.song);
      if (ok) ui.toast('Saved "' + S.song.name + '"');
      return ok;
    } catch (e) { ui.toast('Could not save: ' + e.message, true); return false; }
  }

  // ---------- New song ----------
  function newSong() {
    const go = () => { m.close(); CC.engine.stop(); CC.storage.saveNow(S.song); CC.start.show(); };
    const body = h('div', {}, h('p', {}, `Start a new song? "${S.song.name}" is autosaved in this app, so you can open it again from "Your songs" on the start screen.`),
      h('p', { class: 'help' }, 'Want a copy outside the app too (for backups or another PC)? Save it to a file first.'));
    const m = ui.modal('Start a new song', body, { narrow: true, footer: [
      h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn', onclick: async () => { if (await save()) go(); } }, '💾 Save to file, then new'),
      h('button', { class: 'btn accent', onclick: go }, '✨ Start new')] });
  }

  // ---------- Settings ----------
  function applySettings() {
    const fs = CC.storage.setting('fontScale') || 1;
    document.documentElement.style.setProperty('--fs', (15 * fs) + 'px');
    document.documentElement.classList.toggle('contrast', !!CC.storage.setting('contrast'));
    document.documentElement.classList.toggle('reduce-motion', !!CC.storage.setting('reduceMotion'));
    CC.theme.apply();
  }
  // Theme picker: presets, your own colors, and how glassy and glowing the panels look
  function themeControls() {
    const box = h('div', { class: 'theme-box' });
    function refresh() { CC.theme.apply(); if (S.song) ui.render(['editor', 'wave']); build(); }
    function build() {
      const t = CC.theme.get();
      box.innerHTML = '';
      const sw = h('div', { class: 'theme-swatches', role: 'radiogroup', 'aria-label': 'Color theme' });
      Object.entries(CC.theme.PRESETS).forEach(([id, p]) => sw.appendChild(h('button', {
        class: 'theme-sw', role: 'radio', 'aria-checked': String(t.preset === id),
        style: { background: `linear-gradient(0deg, ${CC.theme.rgba(p.ember, 0.35)}, transparent 70%), ${p.bg}` },
        onclick: () => { CC.theme.set({ preset: id }); refresh(); }
      }, h('span', { class: 'dots' }, h('i', { style: { background: p.accent } }), h('i', { style: { background: p.accent2 } })), h('span', {}, p.name))));
      sw.appendChild(h('button', {
        class: 'theme-sw custom', role: 'radio', 'aria-checked': String(t.preset === 'custom'),
        onclick: () => { const c = CC.theme.get(); CC.theme.set({ preset: 'custom', bg: c.bg, accent: c.accent, accent2: c.accent2, ember: c.ember }); refresh(); }
      }, h('span', { class: 'dots' }, '🎨'), h('span', {}, 'My own colors')));
      box.appendChild(sw);
      if (t.preset === 'custom') {
        const pick = (key, label) => h('label', { class: 'color-pick' }, h('input', { type: 'color', value: t[key], oninput: e => CC.theme.set({ [key]: e.target.value }), onchange: () => S.song && ui.render(['editor', 'wave']) }), h('span', {}, label));
        box.appendChild(h('div', { class: 'color-picks' }, pick('accent', 'Main color'), pick('accent2', 'Highlight'), pick('ember', 'Embers'), pick('bg', 'Background')));
      }
      // Sound wave and level meter colors work with every theme
      const wpick = (key, label) => h('label', { class: 'color-pick' }, h('input', { type: 'color', value: t[key === 'wave1' ? 'viz1' : 'viz2'], oninput: e => { CC.theme.set({ [key]: e.target.value }); S.song && ui.render(['wave']); } }), h('span', {}, label));
      box.appendChild(h('div', { class: 'set-sub' }, 'Sound wave and meter'));
      box.appendChild(h('div', { class: 'color-picks' }, wpick('wave1', 'Middle'), wpick('wave2', 'Edges and peaks'),
        (t.wave1 || t.wave2) ? h('button', { class: 'btn small', onclick: () => { CC.theme.set({ wave1: null, wave2: null }); refresh(); } }, '↺ Theme colors') : null));
      box.appendChild(ui.slider({ label: 'Glow', tip: 'How much buttons, notes and embers glow.', min: 0, max: 1.6, step: 0.05, value: t.glow, fmt: ui.pct, left: 'Off', right: 'Bright', onInput: v => CC.theme.set({ glow: v }), onChange: () => S.song && ui.render(['editor', 'wave']) }));
      box.appendChild(h('label', { class: 'toggle', style: { margin: '.4rem 0', display: 'flex' } }, h('input', { type: 'checkbox', checked: t.embers, onchange: e => CC.theme.set({ embers: e.target.checked }) }), h('span', {}, 'Drifting embers in the background')));
      box.appendChild(h('button', { class: 'btn small', onclick: () => { CC.storage.setting('theme', null); refresh(); } }, '↺ Reset look'));
    }
    build();
    return box;
  }
  function settings() {
    const body = h('div', {},
      h('h3', { class: 'set-h' }, 'Look'),
      themeControls(),
      h('h3', { class: 'set-h' }, 'Reading and comfort'),
      ui.slider({ label: 'Text size', min: 0.8, max: 1.5, step: 0.05, value: CC.storage.setting('fontScale') || 1, fmt: ui.pct, onInput: v => { CC.storage.setting('fontScale', v); applySettings(); }, onChange: () => ui.render() }),
      h('label', { class: 'toggle', style: { margin: '.5rem 0', display: 'flex' } }, h('input', { type: 'checkbox', checked: !!CC.storage.setting('contrast'), onchange: e => { CC.storage.setting('contrast', e.target.checked); applySettings(); ui.render(['editor']); } }), h('span', {}, 'High contrast colors')),
      h('label', { class: 'toggle', style: { margin: '.5rem 0', display: 'flex' } }, h('input', { type: 'checkbox', checked: !!CC.storage.setting('reduceMotion'), onchange: e => { CC.storage.setting('reduceMotion', e.target.checked); applySettings(); } }), h('span', {}, 'Reduce motion')),
      h('p', { class: 'faint', style: { margin: '-.3rem 0 .5rem 1.6rem', fontSize: '.82rem' } }, 'Turns off the drifting embers, hover lifts, fades and pulsing. Use it if movement on screen is distracting.'),
      h('h3', { class: 'set-h' }, 'Sound'),
      ui.slider({ label: 'Master volume', min: 0, max: 1, value: S.song ? S.song.masterVolume : 0.85, fmt: ui.pct, onInput: v => { if (S.song) { S.song.masterVolume = v; CC.engine.refreshMix(); } }, onChange: () => S.song && ui.commitOnly('Master volume', []) }),
      h('p', { class: 'faint' }, 'Your songs are autosaved inside this app on this computer. Use Save to keep a copy as a file (good for backups or moving to another PC).'));
    const m = ui.modal('Settings', body, { narrow: true });
    m.modal.parentElement.classList.add('see-through');
  }

  // ---------- Help ----------
  function help() {
    const keys = [['Space', 'Play / stop'], ['Esc', 'Stop'], ['Ctrl+Z', 'Undo'], ['Ctrl+Y', 'Redo'], ['Ctrl+S', 'Save to file'], ['Ctrl+E', 'Export'], ['Ctrl+D', 'Duplicate section'], ['Ctrl+O', 'Open a song file'], ['Z S X D C…', 'Play low notes'], ['Q 2 W 3 E…', 'Play high notes'], ['1-4 Q-R A-F Z-V', 'Drum pads'], ['?', 'This help']];
    const gridKeys = [['Arrows', 'Move the cursor in the grid'], ['Enter', 'Add / remove a note'], ['Delete', 'Remove the note'], ['Shift + ←/→', 'Make a note shorter / longer'], ['Shift + ↑/↓', 'Move a note up / down'], ['Ctrl + mouse wheel', 'Zoom'], ['Drag', 'Draw notes anywhere you drag'], ['Right-click', 'Erase notes (drag to erase more)'], ['Shift + drag', 'Select notes with a box'], ['Drag selected', 'Move them (Ctrl + drag = copy)'], ['Ctrl+C / X / V', 'Copy / cut / paste notes'], ['Ctrl+A', 'Select all notes'], ['P / Shift+P', 'Play selection / just the selected notes'], ['Click a bar number', 'Loop only that bar (drag for a range)'], ['Ctrl+D', 'Duplicate selected notes'], ['Alt + ←/→', 'Move a section in the song order']];
    const table = (rows) => h('table', {}, rows.map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v))));
    const body = h('div', {},
      h('h3', {}, 'The idea in 30 seconds'),
      h('ol', {},
        h('li', {}, h('b', {}, 'Instruments'), ' (left) are the sounds in your song. Click one to edit it.'),
        h('li', {}, h('b', {}, 'The grid'), ' (middle) is time going left to right. Click squares to add notes. For drums each row is a drum; for melodies higher rows are higher notes.'),
        h('li', {}, h('b', {}, 'Sections'), ' (top) are short loops like "Explore" or "Combat". ', h('b', {}, 'Song order'), ' lines them up.'),
        h('li', {}, 'The ', h('b', {}, 'keyboard / guitar / pads'), ' at the bottom let you play sounds. Press ● Record while playing to capture what you play.'),
        h('li', {}, 'The ', h('b', {}, 'helpers'), ' (right) suggest chords, change your ideas, shape the sound, preview game states, and let you write code.'),
        h('li', {}, h('b', {}, 'Export'), ' gives you audio files for your game. "Game-ready pack" has everything.')),
      h('p', { class: 'muted' }, 'Everything is undoable and autosaved, so experiment freely.'),
      h('div', { class: 'help-grid' }, h('div', {}, h('h3', {}, 'Shortcuts'), table(keys)), h('div', {}, h('h3', {}, 'In the grid'), table(gridKeys))),
      h('p', { class: 'faint', style: { marginTop: '1rem' } }, 'Real instrument sounds: FluidR3 GM soundfont by Frank Wen (MIT license), via the midi-js-soundfonts project. MP3 export: LAME (lamejs, LGPL).'));
    ui.modal('How Campfire Composer works', body);
  }

  CC.modals = { library, uploadSample, recordSound, sounds, newSong, exportDialog, save, settings, help, applySettings };
})(window.CC);
