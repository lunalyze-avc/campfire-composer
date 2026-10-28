// Song waveform (rendered from the real audio), live frequency meter, and the master EQ.
window.CC = window.CC || {};
(function (CC) {
  const ui = CC.ui, { $, h } = ui, S = ui.state;
  const W = { peaks: null, key: '', rendering: false, timer: null, segs: [], total: 0, base: null, lastPh: null };
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // Only what changes the sound, so selecting things does not re-render audio
  function soundKey(song) {
    return JSON.stringify([song.bpm, song.swing, song.key, song.masterVolume, song.eq, song.layersFollowMood, song.arrangement,
      song.tracks.map(t => [t.id, t.instrument, t.volume, t.mute, t.solo, t.layer, t.pan, t.fx, t.synth, t.rowSamples]),
      song.sections.map(s => [s.id, s.bars, s.mood, s.showing, s.clips, s.clipsB])]);
  }
  function segments(song) {
    let at = 0;
    const segs = song.arrangement.map((id, i) => {
      const sec = song.sections.find(s => s.id === id); if (!sec) return null;
      const steps = CC.mix.sectionSteps(sec);
      const seg = { id, i, name: sec.name, mood: sec.mood, color: CC.song.secColor(song, sec), start: at, steps };
      at += steps; return seg;
    }).filter(Boolean);
    return { segs, total: at };
  }

  function schedule() {
    if (!S.song) return;
    clearTimeout(W.timer);
    W.timer = setTimeout(update, 900);
  }
  async function update() {
    const song = S.song; if (!song) return;
    const key = soundKey(song);
    if (key === W.key && W.peaks) return drawBase();
    if (W.rendering) { W.again = true; return; }
    // Wait until playback stops so the render can never cause a hiccup in the music
    if (CC.engine.playing) { setStatus('Updates when you stop'); W.timer = setTimeout(update, 1500); return; }
    W.rendering = true; setStatus('Listening to your song…');
    try {
      const snapshot = CC.song.clone(song);
      const { buffer } = await CC.exporter.renderPlan(snapshot, snapshot.arrangement, { tail: 0, sampleRate: 6000, gentle: true });
      W.peaks = peaks(buffer, 1600);
      W.key = key;
      setStatus('');
    } catch (e) { console.error('waveform', e); setStatus('Could not draw the waveform'); }
    W.rendering = false;
    drawBase();
    if (W.again) { W.again = false; schedule(); }
  }
  function peaks(buf, n) {
    const a = buf.getChannelData(0), b = buf.getChannelData(1);
    const per = Math.max(1, Math.floor(a.length / n)), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      const end = Math.min(a.length, (i + 1) * per);
      for (let j = i * per; j < end; j++) { const v = Math.max(Math.abs(a[j]), Math.abs(b[j])); if (v > m) m = v; }
      out[i] = m;
    }
    return out;
  }
  function setStatus(t) { const e = $('#wave-status'); if (e) e.textContent = t; }

  function sizeCanvas(c) {
    const dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), hh = Math.max(10, Math.round(r.height));
    if (c.width !== w * dpr || c.height !== hh * dpr) { c.width = w * dpr; c.height = hh * dpr; }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hh };
  }

  // Static picture: sections, labels and the waveform bars. Kept in an offscreen canvas.
  function drawBase() {
    const c = $('#wave'); if (!c || !S.song || !c.offsetParent) return;
    const { ctx, w, h: H } = sizeCanvas(c);
    const { segs, total } = segments(S.song);
    W.segs = segs; W.total = total;
    ctx.clearRect(0, 0, w, H);
    const v1 = css('--viz1'), v2 = css('--viz2'), line = css('--line'), faint = css('--faint');
    const moodCol = { calm: css('--calm'), tense: css('--tense'), intense: css('--intense') };
    const selId = ui.section().id;
    const x = (step) => step / Math.max(1, total) * w;
    segs.forEach(sg => {
      const x0 = x(sg.start), x1 = x(sg.start + sg.steps);
      if (sg.id === selId) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x0, 0, x1 - x0, H); }
      ctx.fillStyle = sg.color || moodCol[sg.mood] || faint; ctx.fillRect(x0, H - 2, x1 - x0 - 1, 2);
      ctx.fillStyle = line; ctx.fillRect(x0, 0, 1, H);
      ctx.fillStyle = sg.id === selId ? sg.color : faint;
      ctx.font = '500 10px "Segoe UI", sans-serif';
      if (x1 - x0 > 34) ctx.fillText(sg.name, x0 + 5, 11);
    });
    if (W.peaks) {
      const bars = Math.floor(w / 3), mid = (H + 6) / 2, amp = (H - 18) / 2;
      const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
      grad.addColorStop(0, v2); grad.addColorStop(0.5, v1); grad.addColorStop(1, v2);
      ctx.fillStyle = grad;
      let max = 0.0001; for (const p of W.peaks) if (p > max) max = p;
      for (let i = 0; i < bars; i++) {
        const p = W.peaks[Math.floor(i / bars * W.peaks.length)] / max;
        const hh = Math.max(1, Math.pow(p, 0.8) * amp);
        ctx.fillRect(i * 3, mid - hh, 2, hh * 2);
      }
    }
    W.base = ctx.getImageData(0, 0, c.width, c.height);
    W.lastPh = null;
    if (CC.engine.playing) frame(CC.engine.playhead());
  }

  // Per animation frame while playing: playhead on the waveform and the frequency meter
  function frame(ph) {
    const c = $('#wave');
    if (c && W.base && W.total) {
      const pos = ph ? playPos(ph) : null;
      if (pos !== W.lastPh) {
        W.lastPh = pos;
        const ctx = c.getContext('2d');
        ctx.putImageData(W.base, 0, 0);
        if (pos !== null) {
          const dpr = window.devicePixelRatio || 1, w = c.width / dpr, H = c.height / dpr;
          const xx = pos / W.total * w;
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(xx, 0, w - xx, H);
          ctx.fillStyle = css('--accent'); ctx.shadowColor = css('--accent'); ctx.shadowBlur = 8;
          ctx.fillRect(xx - 1, 0, 2, H); ctx.shadowBlur = 0;
        }
      }
    }
    drawSpectrum(!!ph);
  }
  function playPos(ph) {
    let seg = ph.arrIndex !== undefined ? W.segs.find(s => s.i === ph.arrIndex) : null;
    if (!seg) seg = W.segs.find(s => s.id === ph.sectionId);
    return seg ? seg.start + Math.min(seg.steps, ph.step) : null;
  }

  let freq = null, idleDrawn = false;
  function drawSpectrum(playing) {
    const c = $('#spectrum'); if (!c || !c.offsetParent) return;
    const an = CC.engine.analyser;
    if (!playing && idleDrawn) return;
    const { ctx, w, h: H } = sizeCanvas(c);
    ctx.clearRect(0, 0, w, H);
    const bands = 16, gap = 2, bw = (w - gap * (bands - 1)) / bands, cells = 9, ch = (H - (cells - 1) * 2) / cells;
    let levels = new Array(bands).fill(0);
    if (playing && an) {
      if (!freq || freq.length !== an.frequencyBinCount) freq = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(freq);
      const nyq = an.context.sampleRate / 2;
      for (let b = 0; b < bands; b++) {
        const f0 = 40 * Math.pow(16000 / 40, b / bands), f1 = 40 * Math.pow(16000 / 40, (b + 1) / bands);
        const i0 = Math.floor(f0 / nyq * freq.length), i1 = Math.max(i0 + 1, Math.floor(f1 / nyq * freq.length));
        let m = 0; for (let i = i0; i < i1; i++) m = Math.max(m, freq[i]);
        levels[b] = m / 255;
      }
    }
    const v1 = css('--viz1'), v2 = css('--viz2'), hot = css('--accent');
    for (let b = 0; b < bands; b++) {
      const lit = Math.round(levels[b] * cells);
      for (let k = 0; k < cells; k++) {
        const y = H - (k + 1) * ch - k * 2;
        ctx.fillStyle = k < lit ? (k >= cells - 2 ? hot : k >= cells - 4 ? v2 : v1) : 'rgba(255,255,255,0.035)';
        ctx.fillRect(b * (bw + gap), y, bw, ch);
      }
    }
    idleDrawn = !playing;
  }

  function seekClick(e) {
    const c = $('#wave'); if (!W.total) return;
    const r = c.getBoundingClientRect();
    const step = (e.clientX - r.left) / r.width * W.total;
    const seg = W.segs.find(s => step >= s.start && step < s.start + s.steps);
    if (seg) ui.selectSection(seg.id);
  }

  // ---------- EQ ----------
  const EQ_PRESETS = [
    ['Flat', { low: 0, mid: 0, high: 0 }],
    ['Warm & cozy', { low: 3, mid: -1, high: -3 }],
    ['Bright & clear', { low: -1, mid: 1, high: 4 }],
    ['Big bass', { low: 6, mid: 0, high: 1 }],
    ['Old radio', { low: -12, mid: 5, high: -10 }],
    ['Underwater', { low: 3, mid: -6, high: -12 }],
    ['Far away', { low: -6, mid: -2, high: -8 }]
  ];
  function eqDialog() {
    const song = S.song; if (!song) return;
    song.eq = song.eq || { low: 0, mid: 0, high: 0 };
    const body = h('div', {});
    function build() {
      body.innerHTML = '';
      body.appendChild(h('p', { class: 'help' }, 'Shape the sound of the whole song. Bass is the deep thump, middle is the body of the instruments, treble is the sparkle and air. This also changes your exports.'));
      const pre = h('div', { class: 'cat-chips' });
      EQ_PRESETS.forEach(([name, v]) => pre.appendChild(h('button', { 'aria-pressed': String(v.low === song.eq.low && v.mid === song.eq.mid && v.high === song.eq.high), onclick: () => { Object.assign(song.eq, v); CC.engine.refreshMix(); ui.commitOnly('EQ ' + name, ['wave']); build(); } }, name)));
      body.appendChild(pre);
      [['low', 'Bass', 'Boom, thump, warmth'], ['mid', 'Middle', 'The body of most instruments'], ['high', 'Treble', 'Sparkle, air, cymbals']].forEach(([k, label, tip]) =>
        body.appendChild(ui.slider({ label, tip, min: -12, max: 12, step: 1, value: song.eq[k], left: 'Less', right: 'More', fmt: v => (v > 0 ? '+' : '') + v + ' dB',
          onInput: v => { song.eq[k] = v; CC.engine.refreshMix(); }, onChange: () => { ui.commitOnly('EQ', ['wave']); build(); } })));
      body.appendChild(h('p', { class: 'faint' }, 'Tip: press Play first, then move the sliders to hear the change.'));
    }
    build();
    ui.modal('EQ: bass, middle and treble', body, { narrow: true });
  }

  function init() {
    $('#wave').addEventListener('click', seekClick);
    $('#eq-btn').addEventListener('click', eqDialog);
    addEventListener('resize', () => { clearTimeout(W.rt); W.rt = setTimeout(() => { idleDrawn = false; drawBase(); drawSpectrum(false); }, 150); });
  }
  ui.registerRenderer('wave', () => { drawBase(); idleDrawn = false; drawSpectrum(CC.engine.playing); schedule(); });
  CC.events.on('changed', schedule);
  CC.wave = { init, frame, update, eqDialog, EQ_PRESETS };
})(window.CC);
