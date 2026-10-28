// Offline rendering and export: WAV (with loop points), MP3, MIDI, stems and a game-ready pack (ZIP).
window.CC = window.CC || {};
(function (CC) {
  const M = () => CC.mix;
  const SR = 44100;

  function sec(song, id) { return song.sections.find(s => s.id === id); }
  function planSteps(song, plan) { return plan.reduce((a, id) => a + M().sectionSteps(sec(song, id)), 0); }

  // Render a list of section ids. opts: {solo: trackId, repeat: n, tail: seconds}
  async function renderPlan(song, plan, opts = {}) {
    await CC.instruments.ensureLoaded(song.tracks.map(t => t.instrument));
    const S = CC.song.clone(song);
    if (opts.solo) S.tracks.forEach(t => { t.solo = t.id === opts.solo; t.mute = false; });
    const sd = M().stepDur(S);
    const repeat = opts.repeat || 1;
    const fullPlan = [];
    for (let r = 0; r < repeat; r++) fullPlan.push(...plan);
    const totalSteps = planSteps(S, fullPlan);
    const tail = opts.tail === undefined ? 2.5 : opts.tail;
    const rate = opts.sampleRate || SR;
    const length = Math.ceil((totalSteps * sd + tail) * rate);
    const ctx = new OfflineAudioContext(2, length, rate);
    const G = M().buildGraph(ctx, S, ctx.destination);
    let stepBase = 0;
    for (const id of fullPlan) {
      const section = sec(S, id);
      const level = S.layersFollowMood ? M().moodLevel(section.mood) : 3;
      const t0 = stepBase * sd;
      M().applyMix(G, S, opts.level || level, Math.max(0, t0 - 0.01));
      const clips = CC.song.activeClips(section);
      for (const tr of S.tracks) {
        const notes = clips[tr.id];
        if (!notes) continue;
        if (opts.gentle) await new Promise(r => setTimeout(r, 0)); // let the app breathe between tracks
        const dest = M().ensureTrackNodes(G, tr).input;
        for (const n of notes) {
          if (n.s >= M().sectionSteps(section)) continue;
          const t = t0 + n.s * sd + M().swingOffset(S, n.s) + 0.001;
          const v = CC.instruments.trigger(ctx, dest, tr, n.p, t, n.v === undefined ? 0.8 : n.v);
          v.stop(t + Math.max(0.03, n.l * sd - 0.005));
        }
      }
      stepBase += M().sectionSteps(section);
    }
    const buf = await ctx.startRendering();
    return { buffer: buf, loopSamples: Math.round(planSteps(S, plan) * sd * rate) };
  }

  // A loop that repeats seamlessly: ringing notes from the end are folded into the start.
  async function renderLoop(song, plan, opts = {}) {
    const { buffer, loopSamples } = await renderPlan(song, plan, Object.assign({}, opts, { repeat: 2, tail: 0.05 }));
    const out = new AudioBuffer({ numberOfChannels: 2, length: loopSamples, sampleRate: SR });
    for (let ch = 0; ch < 2; ch++) out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(loopSamples, loopSamples * 2));
    return out;
  }

  // Trim trailing silence for non-looping renders
  function trimTail(buf, minLen) {
    let end = buf.length;
    const a = buf.getChannelData(0), b = buf.getChannelData(1);
    while (end > minLen && Math.abs(a[end - 1]) < 1e-4 && Math.abs(b[end - 1]) < 1e-4) end--;
    end = Math.min(buf.length, end + 2000);
    if (end >= buf.length) return buf;
    const out = new AudioBuffer({ numberOfChannels: 2, length: end, sampleRate: buf.sampleRate });
    for (let ch = 0; ch < 2; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(0, end));
    return out;
  }

  // ---------- WAV ----------
  function wav(buffer, loop) {
    const chs = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
    const dataLen = len * chs * 2;
    const smplLen = loop ? 60 : 0;
    const ab = new ArrayBuffer(44 + dataLen + (smplLen ? smplLen + 8 : 0));
    const dv = new DataView(ab);
    let o = 0;
    const str = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
    const u32 = (v) => { dv.setUint32(o, v, true); o += 4; };
    const u16 = (v) => { dv.setUint16(o, v, true); o += 2; };
    str('RIFF'); u32(ab.byteLength - 8); str('WAVE');
    str('fmt '); u32(16); u16(1); u16(chs); u32(sr); u32(sr * chs * 2); u16(chs * 2); u16(16);
    str('data'); u32(dataLen);
    const data = []; for (let c = 0; c < chs; c++) data.push(buffer.getChannelData(c));
    for (let i = 0; i < len; i++) for (let c = 0; c < chs; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    if (smplLen) {
      // 'smpl' chunk with one forward loop. Godot and many samplers read this as the loop point.
      str('smpl'); u32(smplLen);
      u32(0); u32(0); u32(Math.round(1e9 / sr)); u32(60); u32(0); u32(0); u32(0); u32(1); u32(0);
      u32(0); u32(0); u32(loop.start); u32(loop.end - 1); u32(0); u32(0);
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  // ---------- MP3 (lamejs) ----------
  async function mp3(buffer, kbps = 192, onProgress) {
    if (!window.lamejs) throw new Error('MP3 encoder not loaded');
    const enc = new lamejs.Mp3Encoder(2, buffer.sampleRate, kbps);
    const L = buffer.getChannelData(0), R = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);
    const toI16 = (f, a, b) => { const out = new Int16Array(b - a); for (let i = a; i < b; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i - a] = s < 0 ? s * 0x8000 : s * 0x7fff; } return out; };
    const chunks = [];
    const block = 1152 * 20;
    for (let i = 0; i < L.length; i += block) {
      const e = Math.min(L.length, i + block);
      const m = enc.encodeBuffer(toI16(L, i, e), toI16(R, i, e));
      if (m.length) chunks.push(new Uint8Array(m));
      if (i % (block * 20) === 0) { onProgress && onProgress(i / L.length); await new Promise(r => setTimeout(r, 0)); }
    }
    const end = enc.flush(); if (end.length) chunks.push(new Uint8Array(end));
    return new Blob(chunks, { type: 'audio/mpeg' });
  }

  // ---------- MIDI ----------
  function midi(song, plan) {
    const TPQ = 480, TPS = TPQ / 4;
    const vlq = (n) => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
    const trackChunk = (events) => {
      events.sort((a, b) => a.t - b.t || a.order - b.order);
      const bytes = []; let last = 0;
      for (const e of events) { bytes.push(...vlq(e.t - last), ...e.d); last = e.t; }
      bytes.push(0, 0xff, 0x2f, 0);
      return [0x4d, 0x54, 0x72, 0x6b, (bytes.length >>> 24) & 255, (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes];
    };
    const text = (s) => Array.from(new TextEncoder().encode(s));
    const tracks = [];
    const tempo = Math.round(60000000 / song.bpm);
    const meta = [{ t: 0, order: 0, d: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] }, { t: 0, order: 0, d: [0xff, 0x58, 4, 4, 2, 24, 8] }];
    let base = 0;
    plan.forEach(id => { const s = sec(song, id); const name = text(s.name); meta.push({ t: base * TPS, order: 0, d: [0xff, 0x06, name.length, ...name] }); base += M().sectionSteps(s); });
    meta.push({ t: base * TPS, order: 0, d: [0xff, 0x06, 8, ...text('loop end')] });
    tracks.push(trackChunk(meta));
    let melodicCh = 0;
    song.tracks.forEach(tr => {
      const drums = tr.kind === 'drums';
      const ch = drums ? 9 : (melodicCh === 9 ? ++melodicCh : melodicCh) % 16;
      if (!drums) melodicCh++;
      const nm = text(tr.name);
      const ev = [{ t: 0, order: 0, d: [0xff, 0x03, nm.length, ...nm] }];
      const prog = CC.instruments.GM_PROGRAM[(tr.instrument || '').slice(3)];
      if (!drums) ev.push({ t: 0, order: 0, d: [0xc0 | ch, prog === undefined ? 80 : prog] });
      const rows = drums ? CC.instruments.kitRows(tr) : null;
      let b = 0;
      plan.forEach(id => {
        const s = sec(song, id);
        const notes = CC.song.activeClips(s)[tr.id] || [];
        notes.forEach(n => {
          if (n.s >= M().sectionSteps(s)) return;
          const key = drums ? (CC.instruments.GM_DRUM_NOTE[rows[n.p] && rows[n.p].id] || 60 + n.p) : n.p;
          const vel = Math.max(1, Math.min(127, Math.round((n.v === undefined ? 0.8 : n.v) * 127)));
          const on = (b + n.s) * TPS, off = (b + n.s + (drums ? 1 : n.l)) * TPS - 1;
          ev.push({ t: on, order: 2, d: [0x90 | ch, key, vel] }, { t: off, order: 1, d: [0x80 | ch, key, 0] });
        });
        b += M().sectionSteps(s);
      });
      tracks.push(trackChunk(ev));
    });
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (TPQ >> 8) & 255, TPQ & 255];
    const all = header.concat(...tracks);
    return new Blob([new Uint8Array(all)], { type: 'audio/midi' });
  }

  // ---------- ZIP (store, no compression) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const data = f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data;
      const name = new TextEncoder().encode(f.name);
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, p) => a + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  // ---------- High level exports ----------
  const fname = (s) => CC.storage.safeName(s);
  function songPlan(song) { return song.arrangement.filter(id => sec(song, id)); }

  async function exportAudio(song, { what = 'song', sectionId, format = 'wav', loop = false, kbps = 192 }, progress) {
    const plan = what === 'song' ? songPlan(song) : [sectionId];
    progress('Rendering audio…', 0.1);
    let buf, loopInfo = null;
    if (loop) { buf = await renderLoop(song, plan); loopInfo = { start: 0, end: buf.length }; }
    else { const r = await renderPlan(song, plan, { tail: 3 }); buf = trimTail(r.buffer, r.loopSamples); }
    const base = fname(song.name) + (what === 'song' ? '' : '_' + fname(sec(song, sectionId).name)) + (loop ? '_loop' : '');
    if (format === 'mp3') {
      progress('Encoding MP3…', 0.5);
      return { blob: await mp3(buf, kbps, f => progress('Encoding MP3…', 0.5 + f * 0.5)), name: base + '.mp3' };
    }
    return { blob: wav(buf, loopInfo), name: base + '.wav' };
  }

  async function exportStems(song, { what = 'song', sectionId, loop = true }, progress) {
    const plan = what === 'song' ? songPlan(song) : [sectionId];
    const files = [];
    const tracks = song.tracks.filter(t => !t.mute);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      progress('Rendering stem: ' + t.name, i / tracks.length);
      const buf = loop ? await renderLoop(song, plan, { solo: t.id, level: 3 }) : trimTail((await renderPlan(song, plan, { solo: t.id, level: 3 })).buffer, 0);
      files.push({ name: `${String(i + 1).padStart(2, '0')}_${fname(t.name)}.wav`, data: wav(buf, loop ? { start: 0, end: buf.length } : null) });
    }
    progress('Zipping…', 0.95);
    return { blob: await zip(files), name: fname(song.name) + '_stems.zip' };
  }

  async function exportGamePack(song, { stems = true, mp3s = false }, progress) {
    const files = [];
    const sd = M().stepDur(song);
    const meta = {
      title: song.name, bpm: song.bpm, beatsPerBar: 4, key: song.key + ' ' + song.scale, sampleRate: SR,
      exportedWith: 'Campfire Composer', sections: [], gameStates: {}, layers: []
    };
    const usedSections = song.sections;
    for (let i = 0; i < usedSections.length; i++) {
      const s = usedSections[i];
      progress('Rendering loop: ' + s.name, i / (usedSections.length + 2));
      const buf = await renderLoop(song, [s.id]);
      const file = `loops/${String(i + 1).padStart(2, '0')}_${fname(s.name)}.wav`;
      files.push({ name: file, data: wav(buf, { start: 0, end: buf.length }) });
      if (mp3s) files.push({ name: file.replace('.wav', '.mp3'), data: await mp3(buf, 192) });
      const entry = { name: s.name, mood: s.mood, bars: s.bars, beats: s.bars * 4, seconds: +(s.bars * 16 * sd).toFixed(4), loopStartSample: 0, loopEndSample: buf.length, file, stems: [] };
      if (stems) {
        const tracks = song.tracks.filter(t => !t.mute && (CC.song.activeClips(s)[t.id] || []).length);
        for (const t of tracks) {
          const sb = await renderLoop(song, [s.id], { solo: t.id, level: 3 });
          const sf = `stems/${fname(s.name)}/${fname(t.name)}.wav`;
          files.push({ name: sf, data: wav(sb, { start: 0, end: sb.length }) });
          entry.stems.push({ track: t.name, layer: ['', 'calm', 'tense', 'intense'][t.layer || 1], file: sf });
        }
      }
      meta.sections.push(entry);
    }
    for (const [state, v] of Object.entries(song.states)) {
      const s = sec(song, v.section);
      if (s) meta.gameStates[state] = { section: s.name, loop: !v.once };
    }
    meta.layers = song.tracks.map(t => ({ track: t.name, playsFrom: ['', 'calm', 'tense', 'intense'][t.layer || 1] }));
    progress('Rendering full song…', 0.9);
    const full = await renderLoop(song, songPlan(song));
    files.push({ name: 'full_song_loop.wav', data: wav(full, { start: 0, end: full.length }) });
    files.push({ name: 'song.mid', data: midi(song, songPlan(song)) });
    files.push({ name: 'music.json', data: JSON.stringify(meta, null, 2) });
    files.push({ name: 'README.txt', data: packReadme(song, meta) });
    progress('Zipping…', 0.97);
    return { blob: await zip(files), name: fname(song.name) + '_game_pack.zip' };
  }

  function packReadme(song, meta) {
    return [
      `${song.name} - game music pack from Campfire Composer`,
      '',
      `Tempo: ${song.bpm} BPM, 4 beats per bar. One bar = ${(240 / song.bpm).toFixed(4)} seconds.`,
      '',
      'loops/      One seamless loop per section. Set the file to loop in your engine.',
      '            Ringing notes from the end are already folded into the start, so there is no click or gap.',
      '            Each WAV also has a loop point stored inside it (smpl chunk), which Godot reads on import.',
      'stems/      Each instrument of each section on its own, same length as the loop.',
      '            Play them together in sync and fade layers in/out for adaptive music.',
      'music.json  Tempo, loop lengths in samples, game state -> section mapping and layer info.',
      'song.mid    The whole arrangement as MIDI, if you want to load it into other music software.',
      '',
      'Game states:',
      ...Object.entries(meta.gameStates).map(([k, v]) => `  ${k}: ${v.section}${v.loop ? ' (loops)' : ' (plays once)'}`),
      '',
      'Tip: to switch sections musically, wait for the next bar boundary (multiple of one bar length) before swapping clips.'
    ].join('\r\n');
  }

  CC.exporter = { renderPlan, renderLoop, wav, mp3, midi, zip, exportAudio, exportStems, exportGamePack, songPlan };
})(window.CC);
