// Audio context, mixer graph, playback scheduler, adaptive game-state playback, live playing and recording.
window.CC = window.CC || {};
(function (CC) {
  // ---------- Tiny event bus ----------
  const handlers = {};
  CC.events = {
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit(name, ...args) { (handlers[name] || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }
  };

  // ---------- Audio context ----------
  let _ctx = null;
  CC.audio = {
    ctx() {
      if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      return _ctx;
    },
    resume() {
      const c = this.ctx();
      if (!this.unlocked) {
        this.unlocked = true;
        // iPhone/iPad: play through the speaker even when the silent switch is on
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        try { const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='); a.playsInline = true; a.play().catch(() => {}); } catch (e) {}
      }
      if (c.state !== 'running') return c.resume();
      return Promise.resolve();
    }
  };

  const STEPS_PER_BEAT = 4;
  function stepDur(song) { return 60 / song.bpm / STEPS_PER_BEAT; }
  function swingOffset(song, step) { return step % 2 === 1 ? (song.swing || 0) * 0.5 * stepDur(song) : 0; }
  function sectionSteps(sec) { return sec.bars * 16; }
  function moodLevel(mood) { return mood === 'intense' ? 3 : mood === 'tense' ? 2 : 1; }

  // ---------- Mixer graph (shared by live playback and offline export) ----------
  const impulseCache = new WeakMap();
  function impulse(ctx) {
    let b = impulseCache.get(ctx);
    if (b) return b;
    const len = Math.floor(ctx.sampleRate * 2.4);
    b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let seed = 777 + ch * 31;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = (seed / 0x3fffffff) - 1;
        d[i] = n * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1);
      }
    }
    impulseCache.set(ctx, b);
    return b;
  }

  function buildGraph(ctx, song, out) {
    const g = { ctx, tracks: {} };
    g.master = ctx.createGain();
    g.master.gain.value = song.masterVolume === undefined ? 0.85 : song.masterVolume;
    g.comp = ctx.createDynamicsCompressor();
    g.comp.threshold.value = -12; g.comp.knee.value = 8; g.comp.ratio.value = 4; g.comp.attack.value = 0.004; g.comp.release.value = 0.2;
    // Simple 3-band EQ (bass / middle / treble), heard live and in exports
    g.eqLow = ctx.createBiquadFilter(); g.eqLow.type = 'lowshelf'; g.eqLow.frequency.value = 220;
    g.eqMid = ctx.createBiquadFilter(); g.eqMid.type = 'peaking'; g.eqMid.frequency.value = 1100; g.eqMid.Q.value = 0.8;
    g.eqHigh = ctx.createBiquadFilter(); g.eqHigh.type = 'highshelf'; g.eqHigh.frequency.value = 4500;
    g.master.connect(g.eqLow); g.eqLow.connect(g.eqMid); g.eqMid.connect(g.eqHigh); g.eqHigh.connect(g.comp); g.comp.connect(out);
    g.reverb = ctx.createConvolver(); g.reverb.buffer = impulse(ctx);
    const revRet = ctx.createGain(); revRet.gain.value = 0.8; g.reverb.connect(revRet); revRet.connect(g.master);
    g.delay = ctx.createDelay(2); g.delay.delayTime.value = stepDur(song) * 3;
    g.fb = ctx.createGain(); g.fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3500;
    g.delay.connect(dlp); dlp.connect(g.fb); g.fb.connect(g.delay); dlp.connect(g.master);
    song.tracks.forEach(t => ensureTrackNodes(g, t));
    applyMix(g, song);
    return g;
  }
  function ensureTrackNodes(g, t) {
    if (g.tracks[t.id]) return g.tracks[t.id];
    const ctx = g.ctx;
    const n = {};
    n.input = ctx.createGain();
    n.tone = ctx.createBiquadFilter(); n.tone.type = 'lowpass';
    n.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    n.vol = ctx.createGain();
    n.gate = ctx.createGain();
    n.rev = ctx.createGain(); n.echo = ctx.createGain();
    n.input.connect(n.tone); n.tone.connect(n.pan); n.pan.connect(n.vol); n.vol.connect(n.gate); n.gate.connect(g.master);
    n.gate.connect(n.rev); n.rev.connect(g.reverb);
    n.gate.connect(n.echo); n.echo.connect(g.delay);
    g.tracks[t.id] = n;
    return n;
  }
  function trackAudible(song, t, level) {
    const anySolo = song.tracks.some(x => x.solo);
    if (t.mute) return false;
    if (anySolo && !t.solo) return false;
    if ((t.layer || 1) > level) return false;
    return true;
  }
  function applyMix(g, song, level = 3, when) {
    const ctx = g.ctx;
    const t0 = when === undefined ? ctx.currentTime : when;
    g.delay.delayTime.setTargetAtTime(stepDur(song) * 3, t0, 0.05);
    g.master.gain.setTargetAtTime(song.masterVolume === undefined ? 0.85 : song.masterVolume, t0, 0.02);
    const eq = song.eq || {};
    g.eqLow.gain.setTargetAtTime(eq.low || 0, t0, 0.03);
    g.eqMid.gain.setTargetAtTime(eq.mid || 0, t0, 0.03);
    g.eqHigh.gain.setTargetAtTime(eq.high || 0, t0, 0.03);
    song.tracks.forEach(t => {
      const n = ensureTrackNodes(g, t);
      const fx = t.fx || {};
      const tone = fx.tone === undefined ? 1 : fx.tone;
      n.tone.frequency.setTargetAtTime(tone >= 0.99 ? 20000 : 200 + Math.pow(tone, 2) * 16000, t0, 0.02);
      if (n.pan.pan) n.pan.pan.setTargetAtTime(t.pan || 0, t0, 0.02);
      n.vol.gain.setTargetAtTime(t.volume === undefined ? 0.8 : t.volume, t0, 0.02);
      n.rev.gain.setTargetAtTime((fx.space || 0) * 0.9, t0, 0.02);
      n.echo.gain.setTargetAtTime((fx.echo || 0) * 0.6, t0, 0.02);
      n.gate.gain.setTargetAtTime(trackAudible(song, t, level) ? 1 : 0, t0, 0.06);
    });
  }

  // ---------- Live engine ----------
  const E = {
    playing: false, mode: 'section', graph: null, song: null,
    level: 3, adaptiveLevel: 0, // 0 = follow section mood
    metronome: false, record: false, sustain: false,
    quantize: 'bar', crashOnSwitch: true,
    posQueue: [], voices: [], timer: null
  };
  let pos = null;           // {sectionId, step, arrIndex}
  let nextTime = 0;
  let pendingState = null;  // adaptive pending switch {state, at: 'beat'|'bar'|'end'}
  let currentState = null;

  function graph() {
    const ctx = CC.audio.ctx();
    if (!E.graph || E.graph.ctx !== ctx) {
      // The analyser lets the waveform panel show what is playing right now
      E.analyser = ctx.createAnalyser(); E.analyser.fftSize = 2048; E.analyser.smoothingTimeConstant = 0.75;
      E.analyser.connect(ctx.destination);
      E.graph = buildGraph(ctx, E.song, E.analyser);
    }
    return E.graph;
  }
  E.ensureGraph = graph;
  E.setSong = function (song) { E.song = song; if (E.graph) { song.tracks.forEach(t => ensureTrackNodes(E.graph, t)); E.refreshMix(); } };
  E.refreshMix = function () { if (E.graph && E.song) applyMix(E.graph, E.song, currentLevel()); };
  function sectionById(id) { return E.song.sections.find(s => s.id === id); }
  function currentLevel() {
    if (E.mode === 'adaptive' && E.adaptiveLevel) return E.adaptiveLevel;
    if (!E.song.layersFollowMood) return 3;
    const sec = pos && sectionById(pos.sectionId);
    return sec ? moodLevel(sec.mood) : 3;
  }

  function startPos() {
    const S = E.song;
    if (E.mode === 'song') return { sectionId: S.arrangement[0] || CC.ui.selectedSectionId(), step: 0, arrIndex: 0 };
    if (E.mode === 'adaptive') {
      const st = currentState || 'exploration';
      return { sectionId: (S.states[st] && S.states[st].section) || CC.ui.selectedSectionId(), step: 0 };
    }
    if (E.mode === 'seam') {
      const sec = sectionById(CC.ui.selectedSectionId());
      return { sectionId: sec.id, step: sectionSteps(sec) - 16 };
    }
    const id = CC.ui.selectedSectionId();
    const r = rangeFor(id);
    return { sectionId: id, step: r ? r.start : 0 };
  }
  // Loop range: play only part of a section (a bar, a few beats, or the span of selected notes)
  function rangeFor(id) { return E.mode === 'section' && E.loop && E.loop.sectionId === id ? E.loop : null; }
  E.setLoop = function (loop) {
    E.loop = loop;
    CC.events.emit('loopChanged', loop);
    if (E.playing && E.mode === 'section') E.play('section');
  };

  function advance(p) {
    const S = E.song;
    const sec = sectionById(p.sectionId);
    const len = sec ? sectionSteps(sec) : 16;
    let step = p.step + 1;
    // Adaptive switching at quantize boundaries
    if (E.mode === 'adaptive' && pendingState) {
      const boundary = pendingState.at === 'now' ? true : pendingState.at === 'beat' ? step % 4 === 0 : pendingState.at === 'bar' ? step % 16 === 0 : step >= len;
      if (boundary) {
        const target = S.states[pendingState.state];
        currentState = pendingState.state;
        pendingState = null;
        CC.events.emit('stateChanged', currentState);
        if (target && target.section && sectionById(target.section)) return { sectionId: target.section, step: 0, switched: true };
      }
    }
    if (E.mode === 'seam') {
      if (step >= len) return { sectionId: p.sectionId, step: 0 };
      if (step === 16 && len > 16) return { sectionId: p.sectionId, step: len - 16 };
      if (len === 16 && step >= 16) return { sectionId: p.sectionId, step: 0 };
      return { sectionId: p.sectionId, step };
    }
    const r = rangeFor(p.sectionId);
    if (r) return { sectionId: p.sectionId, step: step >= r.end || step < r.start ? r.start : step };
    if (step < len) return { sectionId: p.sectionId, step, arrIndex: p.arrIndex };
    if (E.mode === 'song') {
      let ai = (p.arrIndex || 0) + 1;
      if (ai >= S.arrangement.length) ai = 0;
      return { sectionId: S.arrangement[ai], step: 0, arrIndex: ai };
    }
    if (E.mode === 'adaptive') {
      const st = S.states[currentState];
      if (st && st.once) { E.stop(); return null; }
      return { sectionId: p.sectionId, step: 0 };
    }
    const next = CC.ui.selectedSectionId(), nr = rangeFor(next);
    return { sectionId: next, step: nr ? nr.start : 0 };
  }

  function scheduleStep(p, time) {
    const S = E.song, ctx = CC.audio.ctx(), G = graph();
    const sec = sectionById(p.sectionId);
    if (!sec) return;
    const clips = CC.song.activeClips(sec);
    const sd = stepDur(S);
    const t = time + swingOffset(S, p.step);
    if (p.step === 0 || p.switched) applyMix(G, S, currentLevel(), t);
    if (p.switched && E.crashOnSwitch) {
      const drum = S.tracks.find(x => x.kind === 'drums' && !(x.instrument || '').endsWith('sfx'));
      if (drum) CC.instruments.trigger(ctx, ensureTrackNodes(G, drum).input, drum, 7, t, 0.6);
    }
    for (const tr of S.tracks) {
      const notes = clips[tr.id];
      if (!notes || !notes.length) continue;
      const dest = ensureTrackNodes(G, tr).input;
      for (const n of notes) {
        if (n.s !== p.step) continue;
        if (E.onlyNotes && !E.onlyNotes.has(n)) continue;
        const v = CC.instruments.trigger(ctx, dest, tr, n.p, t, n.v === undefined ? 0.8 : n.v);
        const end = t + Math.max(0.03, n.l * sd - 0.005);
        v.stop(end);
        E.voices.push({ v, end });
      }
    }
    if (E.metronome && p.step % 4 === 0) {
      const o = ctx.createOscillator(); o.frequency.value = p.step % 16 === 0 ? 1600 : 1000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
    }
    E.posQueue.push({ time: t, sectionId: p.sectionId, step: p.step, rawTime: time, arrIndex: p.arrIndex });
  }

  function tick() {
    const ctx = CC.audio.ctx();
    const ahead = ctx.currentTime + 0.12;
    while (E.playing && nextTime < ahead) {
      scheduleStep(pos, nextTime);
      nextTime += stepDur(E.song);
      pos = advance(pos);
      if (!pos) return;
    }
    const now = ctx.currentTime;
    if (E.voices.length > 200) E.voices = E.voices.filter(x => x.end > now);
  }

  E.play = async function (mode) {
    await CC.audio.resume();
    if (E.playing) E.stop();
    E.mode = mode || E.mode;
    const S = E.song;
    await CC.instruments.ensureLoaded(S.tracks.map(t => t.instrument));
    graph();
    pos = startPos();
    if (!pos.sectionId) return;
    E.playing = true;
    nextTime = CC.audio.ctx().currentTime + 0.06;
    E.posQueue = [];
    applyMix(E.graph, S, currentLevel());
    E.timer = setInterval(tick, 25);
    tick();
    CC.events.emit('playState', true);
  };
  E.stop = function () {
    if (!E.playing) return;
    E.playing = false;
    E.onlyNotes = null;
    clearInterval(E.timer);
    const now = CC.audio.ctx().currentTime;
    E.voices.forEach(x => { if (x.end > now) x.v.stop(now); });
    E.voices = [];
    E.posQueue = [];
    pendingState = null;
    CC.events.emit('playState', false);
  };
  E.toggle = function (mode) { if (E.playing) E.stop(); else E.play(mode); };

  // Current visual playhead (call from requestAnimationFrame)
  E.playhead = function () {
    if (!E.playing) return null;
    const now = CC.audio.ctx().currentTime;
    let cur = null;
    while (E.posQueue.length > 1 && E.posQueue[1].time <= now) E.posQueue.shift();
    if (E.posQueue.length && E.posQueue[0].time <= now) cur = E.posQueue[0];
    if (!cur) return null;
    const frac = Math.min(1, (now - cur.rawTime) / stepDur(E.song));
    return { sectionId: cur.sectionId, step: cur.step, frac: Math.max(0, frac), arrIndex: cur.arrIndex };
  };

  // Adaptive game-state control
  E.setGameState = function (state, quantize) {
    if (E.mode !== 'adaptive' || !E.playing) {
      currentState = state;
      E.mode = 'adaptive';
      E.play('adaptive');
      CC.events.emit('stateChanged', state);
      return;
    }
    pendingState = { state, at: quantize || E.quantize };
    CC.events.emit('statePending', state);
  };
  E.gameState = () => currentState;
  E.setAdaptiveLevel = function (lvl) { E.adaptiveLevel = lvl; E.refreshMix(); };

  // ---------- Live playing (on-screen instruments, computer keyboard) ----------
  const held = {};
  E.noteOn = async function (track, pitch, vel = 0.85) {
    await CC.audio.resume();
    if (!CC.instruments.isReady(track.instrument)) await CC.instruments.ensureLoaded([track.instrument]);
    const G = graph();
    ensureTrackNodes(G, track);
    if (!E.playing) applyMix(G, E.song, 3);
    const ctx = CC.audio.ctx();
    const key = track.id + ':' + pitch;
    if (held[key]) held[key].voice.stop(ctx.currentTime);
    const voice = CC.instruments.trigger(ctx, G.tracks[track.id].input, track, pitch, ctx.currentTime + 0.005, vel);
    held[key] = { voice, start: ctx.currentTime, recPos: E.record && E.playing ? recordPosition() : null };
    CC.events.emit('liveNote', track.id, pitch, true);
  };
  E.noteOff = function (track, pitch) {
    const key = track.id + ':' + pitch;
    const h = held[key];
    if (!h) return;
    delete held[key];
    const ctx = CC.audio.ctx();
    // Sustain on: let the note ring out like a held piano pedal
    h.voice.stop(ctx.currentTime, E.sustain && track.kind !== 'drums' ? 2.5 : 0);
    CC.events.emit('liveNote', track.id, pitch, false);
    if (h.recPos) {
      const len = Math.max(1, Math.round((ctx.currentTime - h.start) / stepDur(E.song)));
      CC.events.emit('recordedNote', { trackId: track.id, sectionId: h.recPos.sectionId, s: h.recPos.step, p: pitch, l: track.kind === 'drums' ? 1 : len, v: 0.85 });
    }
  };
  E.preview = function (track, pitch, dur = 0.35, vel = 0.85) {
    E.noteOn(track, pitch, vel).then(() => setTimeout(() => E.noteOff(track, pitch), dur * 1000));
  };
  function recordPosition() {
    const now = CC.audio.ctx().currentTime;
    const q = E.posQueue;
    let cur = q[0];
    for (const e of q) if (e.time <= now) cur = e;
    if (!cur) return null;
    const sec = sectionById(cur.sectionId);
    const len = sec ? sectionSteps(sec) : 16;
    const frac = (now - cur.rawTime) / stepDur(E.song);
    let step = cur.step + Math.round(frac);
    if (step >= len) step -= len;
    return { sectionId: cur.sectionId, step };
  }

  // Preview an instrument from the library with a tiny phrase
  E.previewInstrument = async function (instrumentId) {
    await CC.audio.resume();
    await CC.instruments.ensureLoaded([instrumentId]);
    const ctx = CC.audio.ctx();
    const G = graph();
    const tmp = { id: '__preview', instrument: instrumentId, synth: CC.instruments.defaultSynthParams(instrumentId), kind: instrumentId.startsWith('kit:') ? 'drums' : 'melody' };
    const info = CC.instruments.info(instrumentId);
    const t0 = ctx.currentTime + 0.05;
    if (tmp.kind === 'drums') {
      const rows = instrumentId === 'kit:sfx' ? [0, 1, 3, 2] : [0, 3, 1, 3, 0, 0, 1, 4];
      rows.forEach((r, i) => CC.instruments.trigger(ctx, G.master, tmp, r, t0 + i * (instrumentId === 'kit:sfx' ? 0.45 : 0.16), 0.8));
    } else {
      const base = ((info && info.octave) || 4) * 12 + 12;
      [0, 4, 7, 12].forEach((iv, i) => { const v = CC.instruments.trigger(ctx, G.master, tmp, base + iv, t0 + i * 0.2, 0.75); v.stop(t0 + i * 0.2 + (i === 3 ? 0.6 : 0.18)); });
    }
  };

  CC.engine = E;
  CC.mix = { buildGraph, applyMix, ensureTrackNodes, trackAudible, stepDur, swingOffset, sectionSteps, moodLevel, STEPS_PER_BEAT };
})(window.CC);
