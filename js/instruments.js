// Instrument catalog and sound generation (Web Audio synths, drum kits, sound effects, sampled instruments, uploaded sounds).
window.CC = window.CC || {};
(function (CC) {
  const T = CC.theory;

  // ---------- Catalog ----------
  const GM = [
    // [file, name, category, description, suggested octave]
    ['acoustic_grand_piano', 'Grand piano', 'Keys', 'Classic piano. Works for anything.', 4],
    ['bright_acoustic_piano', 'Bright piano', 'Keys', 'A punchier piano that cuts through.', 4],
    ['electric_piano_1', 'Electric piano', 'Keys', 'Soft and jazzy. Great for shops and menus.', 4],
    ['harpsichord', 'Harpsichord', 'Keys', 'Royal castle feel.', 4],
    ['drawbar_organ', 'Organ', 'Keys', 'Funky, rock organ.', 4],
    ['church_organ', 'Church organ', 'Keys', 'Huge cathedral sound. Spooky in minor keys.', 3],
    ['accordion', 'Accordion', 'Keys', 'Tavern and village vibes.', 4],
    ['vibraphone', 'Vibraphone', 'Mallets & bells', 'Soft shimmering metal bars. Dreamy.', 4],
    ['marimba', 'Marimba', 'Mallets & bells', 'Warm wooden bars. Bouncy and friendly.', 4],
    ['xylophone', 'Xylophone', 'Mallets & bells', 'Bright, playful wooden taps.', 5],
    ['glockenspiel', 'Glockenspiel', 'Mallets & bells', 'Tiny sparkly bells.', 5],
    ['celesta', 'Celesta', 'Mallets & bells', 'Magical twinkles (think fairy music).', 5],
    ['music_box', 'Music box', 'Mallets & bells', 'Delicate and nostalgic. Creepy when slow.', 5],
    ['kalimba', 'Kalimba', 'Mallets & bells', 'Thumb piano. Cozy and earthy.', 4],
    ['tubular_bells', 'Tubular bells', 'Mallets & bells', 'Big ringing bells.', 4],
    ['steel_drums', 'Steel drums', 'Mallets & bells', 'Beach and island levels.', 4],
    ['dulcimer', 'Dulcimer', 'Mallets & bells', 'Hammered strings, folky and old-world.', 4],
    ['violin', 'Violin', 'Strings', 'Expressive solo strings.', 5],
    ['viola', 'Viola', 'Strings', 'Warmer, lower than a violin.', 4],
    ['cello', 'Cello', 'Strings', 'Deep and emotional.', 3],
    ['contrabass', 'Double bass (bowed)', 'Strings', 'The lowest bowed strings.', 2],
    ['string_ensemble_1', 'String section', 'Strings', 'A whole orchestra of strings. Instant cinema.', 4],
    ['tremolo_strings', 'Tremolo strings', 'Strings', 'Shivering strings for suspense.', 4],
    ['pizzicato_strings', 'Plucked strings', 'Strings', 'Sneaky, tiptoe plucks.', 4],
    ['orchestral_harp', 'Harp', 'Strings', 'Gentle and magical. Great for arpeggios.', 4],
    ['fiddle', 'Fiddle', 'Strings', 'Folk violin. Taverns and farms.', 5],
    ['trumpet', 'Trumpet', 'Brass', 'Bright fanfares and victory.', 4],
    ['muted_trumpet', 'Muted trumpet', 'Brass', 'Soft, jazzy trumpet.', 4],
    ['trombone', 'Trombone', 'Brass', 'Big brassy slides. Bold or silly.', 3],
    ['tuba', 'Tuba', 'Brass', 'Low oompah brass.', 2],
    ['french_horn', 'French horn', 'Brass', 'Noble and heroic.', 3],
    ['brass_section', 'Brass section', 'Brass', 'A full brass band hit.', 4],
    ['flute', 'Flute', 'Woodwinds', 'Light, airy melodies.', 5],
    ['piccolo', 'Piccolo', 'Woodwinds', 'Very high flute. Marches and birds.', 5],
    ['clarinet', 'Clarinet', 'Woodwinds', 'Smooth and woody. Cozy or quirky.', 4],
    ['oboe', 'Oboe', 'Woodwinds', 'Pastoral and a bit sad.', 4],
    ['bassoon', 'Bassoon', 'Woodwinds', 'Low and goofy or mysterious.', 3],
    ['recorder', 'Recorder', 'Woodwinds', 'Simple, medieval, innocent.', 5],
    ['pan_flute', 'Pan flute', 'Woodwinds', 'Breathy, mountain and forest.', 5],
    ['ocarina', 'Ocarina', 'Woodwinds', 'Adventure game classic.', 5],
    ['alto_sax', 'Alto sax', 'Woodwinds', 'Smooth jazz and cool cities.', 4],
    ['tenor_sax', 'Tenor sax', 'Woodwinds', 'Deeper, raspier sax.', 3],
    ['harmonica', 'Harmonica', 'Woodwinds', 'Western and bluesy.', 4],
    ['bagpipe', 'Bagpipe', 'Woodwinds', 'Highlands and battle.', 4],
    ['acoustic_guitar_nylon', 'Nylon guitar', 'Guitars & plucked', 'Soft classical/Spanish guitar.', 3, 'guitar'],
    ['acoustic_guitar_steel', 'Acoustic guitar', 'Guitars & plucked', 'Bright campfire strumming.', 3, 'guitar'],
    ['electric_guitar_clean', 'Clean electric guitar', 'Guitars & plucked', 'Chill electric guitar.', 3, 'guitar'],
    ['overdriven_guitar', 'Crunchy guitar', 'Guitars & plucked', 'Gritty rock guitar.', 3, 'guitar'],
    ['distortion_guitar', 'Heavy guitar', 'Guitars & plucked', 'Loud metal guitar for boss fights.', 3, 'guitar'],
    ['banjo', 'Banjo', 'Guitars & plucked', 'Country and frontier.', 4, 'guitar'],
    ['sitar', 'Sitar', 'Guitars & plucked', 'Buzzing, exotic strings.', 4, 'guitar'],
    ['koto', 'Koto', 'Guitars & plucked', 'Japanese zither. Temples and gardens.', 4, 'guitar'],
    ['shamisen', 'Shamisen', 'Guitars & plucked', 'Twangy Japanese lute.', 4, 'guitar'],
    ['acoustic_bass', 'Upright bass', 'Basses', 'Plucked jazz bass.', 2, 'bass'],
    ['electric_bass_finger', 'Bass guitar', 'Basses', 'Solid bass for anything.', 2, 'bass'],
    ['slap_bass_1', 'Slap bass', 'Basses', 'Funky and poppy.', 2, 'bass'],
    ['synth_bass_1', 'Synth bass (sampled)', 'Basses', 'Electronic bass.', 2, 'bass'],
    ['choir_aahs', 'Choir "aah"', 'Voices & pads', 'Heavenly or haunting voices.', 4],
    ['voice_oohs', 'Voices "ooh"', 'Voices & pads', 'Soft vocal pad.', 4],
    ['pad_2_warm', 'Warm pad', 'Voices & pads', 'Soft background wash.', 4],
    ['pad_1_new_age', 'Fantasy pad', 'Voices & pads', 'Shimmering fantasy background.', 4],
    ['fx_4_atmosphere', 'Atmosphere', 'Voices & pads', 'Floating, spacey texture.', 4],
    ['synth_strings_1', 'Synth strings', 'Voices & pads', '80s style strings.', 4],
    ['timpani', 'Timpani', 'Orchestral percussion', 'Big orchestral kettle drums.', 2],
    ['taiko_drum', 'Taiko drum', 'Orchestral percussion', 'Huge Japanese war drum.', 2],
    ['orchestra_hit', 'Orchestra hit', 'Orchestral percussion', 'Dramatic stab! Use sparingly.', 4],
    ['lead_1_square', 'Square lead (sampled)', 'Synths & chiptune', 'Sampled retro lead.', 4],
    ['lead_2_sawtooth', 'Saw lead (sampled)', 'Synths & chiptune', 'Sampled buzzy lead.', 4]
  ];
  const GM_PROGRAM = { acoustic_grand_piano: 0, bright_acoustic_piano: 1, electric_piano_1: 4, harpsichord: 6, celesta: 8, glockenspiel: 9, music_box: 10, vibraphone: 11, marimba: 12, xylophone: 13, tubular_bells: 14, dulcimer: 15, drawbar_organ: 16, church_organ: 19, accordion: 21, harmonica: 22, acoustic_guitar_nylon: 24, acoustic_guitar_steel: 25, electric_guitar_clean: 27, overdriven_guitar: 29, distortion_guitar: 30, acoustic_bass: 32, electric_bass_finger: 33, slap_bass_1: 36, synth_bass_1: 38, violin: 40, viola: 41, cello: 42, contrabass: 43, tremolo_strings: 44, pizzicato_strings: 45, orchestral_harp: 46, timpani: 47, string_ensemble_1: 48, synth_strings_1: 50, choir_aahs: 52, voice_oohs: 53, orchestra_hit: 55, trumpet: 56, trombone: 57, tuba: 58, muted_trumpet: 59, french_horn: 60, brass_section: 61, alto_sax: 65, tenor_sax: 66, oboe: 68, bassoon: 70, clarinet: 71, piccolo: 72, flute: 73, recorder: 74, pan_flute: 75, ocarina: 79, lead_1_square: 80, lead_2_sawtooth: 81, pad_1_new_age: 88, pad_2_warm: 89, fx_4_atmosphere: 99, sitar: 104, banjo: 105, shamisen: 106, koto: 107, kalimba: 108, bagpipe: 109, fiddle: 110, steel_drums: 114, taiko_drum: 116 };

  // Synth presets built purely with Web Audio (no samples). Plain-language params.
  const SYNTHS = {
    square:   { name: 'Square lead', desc: 'The classic 8-bit hero melody sound.', p: { wave: 'square', attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.08, brightness: 0.8, resonance: 0, volume: 0.35 }, oct: 5 },
    pulse:    { name: 'Thin pulse lead', desc: 'Nasal, NES-style lead.', p: { wave: 'pulse', width: 0.125, attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.06, brightness: 0.9, volume: 0.35 }, oct: 5 },
    triangle: { name: 'Triangle bass', desc: 'Round retro bass like old consoles.', p: { wave: 'triangle', attack: 0.003, decay: 0.05, sustain: 0.9, release: 0.05, brightness: 1, volume: 0.7 }, oct: 2, view: 'bass' },
    saw:      { name: 'Saw lead', desc: 'Bright buzzy lead that cuts through.', p: { wave: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.15, brightness: 0.6, resonance: 0.2, detune: 8, volume: 0.3 }, oct: 4 },
    sine:     { name: 'Pure tone', desc: 'Soft whistle-like tone.', p: { wave: 'sine', attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2, brightness: 1, vibrato: 0.2, volume: 0.5 }, oct: 5 },
    softpad:  { name: 'Soft pad', desc: 'Slow, warm background chords.', p: { wave: 'sawtooth', attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.2, brightness: 0.3, detune: 14, volume: 0.22 }, oct: 4 },
    pluck:    { name: 'Pluck', desc: 'Short plucky notes for arpeggios.', p: { wave: 'sawtooth', attack: 0.002, decay: 0.25, sustain: 0, release: 0.2, brightness: 0.35, filterEnv: 0.6, resonance: 0.3, volume: 0.4 }, oct: 4 },
    bell:     { name: 'Crystal bell', desc: 'FM bell. Magic items and twinkles.', p: { wave: 'sine', fmRatio: 3.5, fmAmount: 2.5, attack: 0.002, decay: 1.2, sustain: 0, release: 0.8, brightness: 1, volume: 0.35 }, oct: 5 },
    subbass:  { name: 'Sub bass', desc: 'Deep rumble you feel more than hear.', p: { wave: 'sine', attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.1, brightness: 1, volume: 0.8 }, oct: 1, view: 'bass' },
    wobble:   { name: 'Growl bass', desc: 'Aggressive, wobbly bass for boss fights.', p: { wave: 'sawtooth', attack: 0.005, decay: 0.2, sustain: 0.8, release: 0.1, brightness: 0.25, resonance: 0.6, vibrato: 0, wobble: 0.7, wobbleRate: 4, detune: 10, volume: 0.45 }, oct: 2, view: 'bass' },
    acid:     { name: 'Squelchy bass', desc: 'Rubbery, squelchy electronic bass.', p: { wave: 'sawtooth', attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.08, brightness: 0.15, resonance: 0.75, filterEnv: 0.7, volume: 0.45 }, oct: 2, view: 'bass' },
    brass:    { name: 'Synth brass', desc: 'Punchy 80s brass stabs.', p: { wave: 'sawtooth', attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.2, brightness: 0.35, filterEnv: 0.5, detune: 10, volume: 0.3 }, oct: 4 },
    organ:    { name: 'Code organ', desc: 'Organ built from custom harmonics.', p: { wave: 'custom', harmonics: [1, 0.8, 0.5, 0.6, 0, 0.3, 0, 0.25], attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.08, brightness: 1, vibrato: 0.15, volume: 0.3 }, oct: 4 },
    strings:  { name: 'Synth strings', desc: 'Lush strings, made from code.', p: { wave: 'sawtooth', attack: 0.3, decay: 0.3, sustain: 0.85, release: 0.6, brightness: 0.4, detune: 18, vibrato: 0.25, volume: 0.22 }, oct: 4 },
    blip:     { name: 'Blip', desc: 'Tiny staccato blips for fast arpeggios.', p: { wave: 'square', attack: 0.001, decay: 0.06, sustain: 0, release: 0.03, brightness: 1, volume: 0.3 }, oct: 5 },
    wind:     { name: 'Breathy wind', desc: 'Pitched noise, like wind through a pipe.', p: { wave: 'noise', attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.4, brightness: 0.5, resonance: 0.9, volume: 0.6 }, oct: 5 }
  };

  const DRUM_ROWS = [
    ['kick', 'Kick (boom)'], ['snare', 'Snare (crack)'], ['clap', 'Clap'], ['hat', 'Hi-hat (tick)'], ['openhat', 'Open hi-hat (tsss)'],
    ['tomlo', 'Low tom'], ['tomhi', 'High tom'], ['crash', 'Crash cymbal'], ['rim', 'Rim click'], ['shaker', 'Shaker'], ['cowbell', 'Cowbell']
  ];
  const SFX_ROWS = [
    ['coin', 'Coin'], ['jump', 'Jump'], ['laser', 'Laser'], ['powerup', 'Power up'], ['hit', 'Hit / hurt'], ['explosion', 'Explosion'],
    ['blip', 'Menu blip'], ['heal', 'Heal / 1-up'], ['whoosh', 'Whoosh'], ['magic', 'Magic sparkle'], ['error', 'Error buzz']
  ];
  const KITS = {
    electronic: { name: 'Electronic drums', desc: 'Punchy drum machine. Modern and clean.', rows: DRUM_ROWS },
    acoustic:   { name: 'Band drums', desc: 'Tighter, more natural drum kit.', rows: DRUM_ROWS },
    chip:       { name: '8-bit drums', desc: 'Retro console noise drums.', rows: DRUM_ROWS },
    lofi:       { name: 'Soft lo-fi drums', desc: 'Dusty, gentle drums for chill and cozy music.', rows: DRUM_ROWS },
    sfx:        { name: 'Game sound effects', desc: 'Coins, jumps, lasers and more. Place them like drums.', rows: SFX_ROWS }
  };
  const GM_DRUM_NOTE = { kick: 36, snare: 38, clap: 39, hat: 42, openhat: 46, tomlo: 45, tomhi: 50, crash: 49, rim: 37, shaker: 70, cowbell: 56 };

  function catalog() {
    const list = [];
    for (const [k, v] of Object.entries(KITS)) list.push({ id: 'kit:' + k, name: v.name, category: k === 'sfx' ? 'Sound effects' : 'Drums', desc: v.desc, kind: 'drums', type: 'kit' });
    for (const [k, v] of Object.entries(SYNTHS)) list.push({ id: 'synth:' + k, name: v.name, category: 'Synths & chiptune', desc: v.desc + ' (made with Web Audio code)', kind: 'melody', type: 'synth', octave: v.oct, view: v.view });
    for (const g of GM) list.push({ id: 'gm:' + g[0], name: g[1], category: g[2], desc: g[3], kind: 'melody', type: 'sample', octave: g[4], view: g[5] || (g[2] === 'Basses' ? 'bass' : undefined) });
    for (const [id, s] of Object.entries(userSamples)) list.push({ id: 'user:' + id, name: s.name, category: 'Your sounds', desc: 'Uploaded sound. Root note ' + T.noteName(s.root) + '.', kind: 'melody', type: 'user', octave: Math.floor(s.root / 12) - 1 });
    return list;
  }
  const CATEGORY_ORDER = ['Drums', 'Sound effects', 'Synths & chiptune', 'Keys', 'Mallets & bells', 'Strings', 'Brass', 'Woodwinds', 'Guitars & plucked', 'Basses', 'Voices & pads', 'Orchestral percussion', 'Your sounds'];
  function info(id) {
    if (!id) return null;
    return catalog().find(x => x.id === id) || { id, name: id.split(':')[1] || id, category: '?', desc: '', kind: id.startsWith('kit:') ? 'drums' : 'melody', type: id.split(':')[0] };
  }
  function kitRows(track) {
    const kit = KITS[(track.instrument || '').split(':')[1]] || KITS.electronic;
    return kit.rows.map(([id, name], i) => {
      const ov = track.rowSamples && track.rowSamples[i];
      return { id, name: ov && userSamples[ov] ? userSamples[ov].name : name, override: ov };
    });
  }

  // ---------- Sample loading ----------
  const sampleSets = {};   // name -> {midi: AudioBuffer}
  const loading = {};
  const pendingRegister = {};
  window.CampfireSamples = {
    register(name, data) { if (pendingRegister[name]) pendingRegister[name](data); }
  };
  function b64ToArrayBuffer(dataUri) {
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  function loadSampleSet(name) {
    if (sampleSets[name]) return Promise.resolve(sampleSets[name]);
    if (loading[name]) return loading[name];
    loading[name] = new Promise((resolve, reject) => {
      pendingRegister[name] = async (data) => {
        delete pendingRegister[name];
        const ctx = CC.audio.ctx();
        const set = {};
        await Promise.all(Object.entries(data).map(async ([note, uri]) => {
          try {
            const buf = await ctx.decodeAudioData(b64ToArrayBuffer(uri));
            // Some soundfont notes outside an instrument's real range are silent; skip them so a nearby real note is used
            const d = buf.getChannelData(0); let peak = 0;
            for (let i = 0; i < d.length; i += 4) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
            if (peak > 0.004) set[T.parseNote(note)] = buf;
          } catch (e) { /* skip bad sample */ }
        }));
        sampleSets[name] = set;
        resolve(set);
        CC.events && CC.events.emit('samplesLoaded', name);
      };
      const s = document.createElement('script');
      s.src = 'samples/' + name + '.js';
      s.onerror = () => { delete loading[name]; reject(new Error('Could not load instrument ' + name)); };
      s.onload = () => s.remove();
      document.head.appendChild(s);
    });
    return loading[name];
  }
  function ensureLoaded(instrumentIds) {
    const names = [...new Set(instrumentIds.filter(i => i && i.startsWith('gm:')).map(i => i.slice(3)))];
    return Promise.all(names.map(n => loadSampleSet(n).catch(e => console.warn(e))));
  }
  function isReady(id) { return !id || !id.startsWith('gm:') || !!sampleSets[id.slice(3)]; }

  // ---------- Uploaded samples ----------
  const userSamples = {}; // id -> {name, root, buffer, bytes(ArrayBuffer), mime}
  async function addUserSample(id, name, bytes, root = 60, mime = 'audio/wav') {
    const ctx = CC.audio.ctx();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    userSamples[id] = { name, root, buffer, bytes, mime };
    return userSamples[id];
  }

  // ---------- Shared helpers ----------
  const noiseCache = new WeakMap();
  function noiseBuffer(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
      noiseCache.set(ctx, b);
    }
    return b;
  }
  const waveCache = new WeakMap();
  function periodicWave(ctx, key, real, imag) {
    let m = waveCache.get(ctx);
    if (!m) { m = {}; waveCache.set(ctx, m); }
    if (!m[key]) m[key] = ctx.createPeriodicWave(new Float32Array(real), new Float32Array(imag));
    return m[key];
  }
  function pulseWave(ctx, width) {
    const n = 64, real = [0], imag = [0];
    for (let k = 1; k < n; k++) { real.push(Math.sin(2 * Math.PI * k * width) / (k * Math.PI)); imag.push((1 - Math.cos(2 * Math.PI * k * width)) / (k * Math.PI)); }
    return periodicWave(ctx, 'pulse' + width, real, imag);
  }
  function harmonicWave(ctx, harmonics) {
    const real = [0], imag = [0];
    harmonics.forEach(h => { real.push(0); imag.push(+h || 0); });
    if (imag.length < 2) { real.push(0); imag.push(1); }
    return periodicWave(ctx, 'h' + harmonics.join(','), real, imag);
  }
  function env(param, time, peak, attack, decay, sustain) {
    param.setValueAtTime(0.0001, time);
    param.linearRampToValueAtTime(peak, time + Math.max(0.001, attack));
    param.setTargetAtTime(Math.max(0.0001, peak * sustain), time + attack, Math.max(0.005, decay / 3));
  }
  function releaseParam(param, t, release) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); }
    param.setTargetAtTime(0, t, Math.max(0.005, release / 4));
  }

  // ---------- Synth voice ----------
  function synthVoice(ctx, dest, P, midi, time, vel) {
    const freq = T.midiToFreq(midi);
    const out = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.7 + (P.resonance || 0) * 18;
    const b = P.brightness === undefined ? 0.7 : P.brightness;
    const baseCut = Math.min(20000, 120 + b * b * 14000 + freq * 1.5);
    if (P.filterEnv) {
      const peakCut = Math.min(20000, baseCut + P.filterEnv * 9000);
      filt.frequency.setValueAtTime(peakCut, time);
      filt.frequency.setTargetAtTime(baseCut, time + 0.005, Math.max(0.01, (P.decay || 0.2) / 3));
    } else filt.frequency.value = baseCut;
    filt.connect(out);
    out.connect(dest);
    const srcs = [];
    const mkOsc = (detuneCents) => {
      const o = ctx.createOscillator();
      if (P.wave === 'pulse') o.setPeriodicWave(pulseWave(ctx, P.width || 0.25));
      else if (P.wave === 'custom') o.setPeriodicWave(harmonicWave(ctx, P.harmonics || [1]));
      else o.type = P.wave || 'sine';
      o.frequency.value = freq;
      o.detune.value = detuneCents;
      return o;
    };
    if (P.wave === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(ctx); n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 5 + (P.resonance || 0) * 40;
      const boost = ctx.createGain(); boost.gain.value = 3;
      n.connect(bp); bp.connect(boost); boost.connect(filt);
      srcs.push(n);
    } else {
      const det = P.detune || 0;
      const oscs = det ? [mkOsc(-det), mkOsc(det)] : [mkOsc(0)];
      const mix = ctx.createGain(); mix.gain.value = 1 / oscs.length;
      mix.connect(filt);
      oscs.forEach(o => { o.connect(mix); srcs.push(o); });
      if (P.fmRatio) {
        const mod = ctx.createOscillator(); mod.frequency.value = freq * P.fmRatio;
        const mg = ctx.createGain();
        const amt = freq * (P.fmAmount || 1);
        mg.gain.setValueAtTime(amt, time);
        mg.gain.setTargetAtTime(amt * 0.1, time, 0.3);
        mod.connect(mg); oscs.forEach(o => mg.connect(o.frequency));
        srcs.push(mod);
      }
      if (P.vibrato) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = P.vibratoRate || 5.5;
        const lg = ctx.createGain(); lg.gain.setValueAtTime(0, time); lg.gain.linearRampToValueAtTime(P.vibrato * 40, time + 0.3);
        lfo.connect(lg); oscs.forEach(o => lg.connect(o.detune));
        srcs.push(lfo);
      }
      if (P.wobble) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = P.wobbleRate || 4;
        const lg = ctx.createGain(); lg.gain.value = baseCut * 0.5 + P.wobble * 1500;
        lfo.connect(lg); lg.connect(filt.frequency);
        srcs.push(lfo);
      }
    }
    const peak = vel * (P.volume === undefined ? 0.4 : P.volume);
    env(out.gain, time, peak, P.attack || 0.005, P.decay || 0.1, P.sustain === undefined ? 0.8 : P.sustain);
    srcs.forEach(s => s.start(time));
    const rel0 = P.release || 0.1;
    return {
      stop(t, ring) { // ring: a longer release, like holding a sustain pedal
        const rel = Math.max(rel0, ring || 0);
        t = Math.max(t, time + 0.005);
        releaseParam(out.gain, t, rel);
        srcs.forEach(s => { try { s.stop(t + rel * 1.6 + 0.05); } catch (e) {} });
      }
    };
  }

  // ---------- Sample voice ----------
  function sampleVoice(ctx, dest, set, midi, time, vel, opts = {}) {
    const keys = Object.keys(set).map(Number);
    if (!keys.length) return { stop() {} };
    let best = keys[0];
    for (const k of keys) if (Math.abs(k - midi) < Math.abs(best - midi)) best = k;
    const src = ctx.createBufferSource();
    src.buffer = set[best];
    src.playbackRate.value = Math.pow(2, (midi - best) / 12);
    const g = ctx.createGain();
    const peak = vel * (opts.volume || 1);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + (opts.attack || 0.004));
    src.connect(g); g.connect(dest);
    src.start(time);
    const rel0 = opts.release || 0.25;
    return {
      stop(t, ring) {
        const rel = Math.max(rel0, ring || 0);
        t = Math.max(t, time + 0.01);
        releaseParam(g.gain, t, rel);
        try { src.stop(t + rel * 1.6 + 0.05); } catch (e) {}
      }
    };
  }
  function userVoice(ctx, dest, s, midi, time, vel, oneShot) {
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = oneShot ? 1 : Math.pow(2, (midi - s.root) / 12);
    const g = ctx.createGain(); g.gain.value = vel;
    src.connect(g); g.connect(dest);
    src.start(time);
    return {
      stop(t, ring) {
        if (oneShot) return;
        const rel = Math.max(0.08, ring || 0);
        t = Math.max(t, time + 0.01);
        releaseParam(g.gain, t, rel);
        try { src.stop(t + rel * 1.6 + 0.05); } catch (e) {}
      }
    };
  }

  // ---------- Drum kits ----------
  function noiseHit(ctx, dest, time, vel, { type = 'highpass', freq = 8000, q = 1, decay = 0.05, attack = 0.001, sweepTo }) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    n.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, time); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, time + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vel, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    n.connect(f); f.connect(g); g.connect(dest);
    n.start(time, Math.random()); n.stop(time + attack + decay + 0.05);
  }
  function toneHit(ctx, dest, time, vel, { type = 'sine', from = 150, to = 50, sweep = 0.1, decay = 0.4 }) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), time + sweep);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    o.connect(g); g.connect(dest);
    o.start(time); o.stop(time + decay + 0.05);
  }
  function seqTones(ctx, dest, time, vel, notes, stepLen, type = 'square', decayEach) {
    notes.forEach((m, i) => {
      const t = time + i * stepLen;
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = typeof m === 'number' && m < 200 ? T.midiToFreq(m) : m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (decayEach || stepLen * 1.5));
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + (decayEach || stepLen * 1.5) + 0.02);
    });
  }

  function drumHit(ctx, dest, kitName, rowId, time, vel) {
    const v = vel;
    if (kitName === 'sfx') return sfxHit(ctx, dest, rowId, time, v);
    const chip = kitName === 'chip', ac = kitName === 'acoustic', lofi = kitName === 'lofi';
    let out = dest;
    if (lofi) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; lp.connect(dest); out = lp;
    }
    switch (rowId) {
      case 'kick':
        if (chip) { toneHit(ctx, out, time, v * 0.6, { type: 'square', from: 220, to: 40, sweep: 0.08, decay: 0.15 }); break; }
        toneHit(ctx, out, time, v * 1.1, { from: ac ? 120 : 160, to: ac ? 50 : 42, sweep: ac ? 0.06 : 0.12, decay: ac ? 0.3 : (lofi ? 0.35 : 0.55) });
        noiseHit(ctx, out, time, v * 0.25, { type: 'lowpass', freq: ac ? 3000 : 1500, decay: 0.012 });
        break;
      case 'snare':
        if (chip) { noiseHit(ctx, out, time, v * 0.5, { type: 'highpass', freq: 1500, decay: 0.12 }); break; }
        toneHit(ctx, out, time, v * 0.45, { type: 'triangle', from: ac ? 220 : 190, to: 140, sweep: 0.05, decay: 0.1 });
        noiseHit(ctx, out, time, v * 0.75, { type: 'highpass', freq: ac ? 1800 : 1200, decay: ac ? 0.16 : 0.2 });
        if (ac) noiseHit(ctx, out, time, v * 0.4, { type: 'bandpass', freq: 4500, q: 0.8, decay: 0.08 });
        break;
      case 'clap':
        [0, 0.011, 0.022].forEach(o => noiseHit(ctx, out, time + o, v * 0.55, { type: 'bandpass', freq: 1400, q: 1.2, decay: 0.012 }));
        noiseHit(ctx, out, time + 0.03, v * 0.6, { type: 'bandpass', freq: 1300, q: 1, decay: chip ? 0.06 : 0.16 });
        break;
      case 'hat':
        noiseHit(ctx, out, time, v * (chip ? 0.3 : 0.4), { type: 'highpass', freq: chip ? 6000 : 8000, decay: chip ? 0.03 : (ac ? 0.04 : 0.05) });
        break;
      case 'openhat':
        noiseHit(ctx, out, time, v * 0.35, { type: 'highpass', freq: chip ? 5000 : 7000, decay: chip ? 0.15 : 0.32 });
        break;
      case 'tomlo':
        if (chip) toneHit(ctx, out, time, v * 0.4, { type: 'triangle', from: 220, to: 90, sweep: 0.15, decay: 0.2 });
        else toneHit(ctx, out, time, v * 0.8, { from: 140, to: 85, sweep: 0.2, decay: 0.4 });
        break;
      case 'tomhi':
        if (chip) toneHit(ctx, out, time, v * 0.4, { type: 'triangle', from: 400, to: 160, sweep: 0.12, decay: 0.16 });
        else toneHit(ctx, out, time, v * 0.75, { from: 230, to: 140, sweep: 0.18, decay: 0.32 });
        break;
      case 'crash':
        noiseHit(ctx, out, time, v * 0.4, { type: 'highpass', freq: chip ? 3000 : 4500, decay: chip ? 0.5 : 1.4 });
        if (!chip) noiseHit(ctx, out, time, v * 0.2, { type: 'bandpass', freq: 9000, q: 0.5, decay: 1.0 });
        break;
      case 'rim':
        toneHit(ctx, out, time, v * 0.5, { type: 'triangle', from: 1700, to: 1200, sweep: 0.02, decay: 0.04 });
        noiseHit(ctx, out, time, v * 0.3, { type: 'bandpass', freq: 3000, q: 2, decay: 0.02 });
        break;
      case 'shaker':
        noiseHit(ctx, out, time, v * 0.3, { type: 'bandpass', freq: 7000, q: 1, decay: 0.06, attack: 0.02 });
        break;
      case 'cowbell': {
        const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.25, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
        [540, 800].forEach(f => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(time); o.stop(time + 0.32); });
        bp.connect(g); g.connect(out);
        break;
      }
    }
  }

  function sfxHit(ctx, dest, id, time, v) {
    const sweepOsc = (type, from, to, dur, vol, expo = true) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(from, time);
      if (expo) o.frequency.exponentialRampToValueAtTime(to, time + dur); else o.frequency.linearRampToValueAtTime(to, time + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(vol * v, time); g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.05);
      o.connect(g); g.connect(dest); o.start(time); o.stop(time + dur + 0.1);
    };
    switch (id) {
      case 'coin': {
        const o = ctx.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(988, time); o.frequency.setValueAtTime(1319, time + 0.07);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.25 * v, time); g.gain.setValueAtTime(0.25 * v, time + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);
        o.connect(g); g.connect(dest); o.start(time); o.stop(time + 0.5);
        break;
      }
      case 'jump': sweepOsc('square', 150, 620, 0.16, 0.25); break;
      case 'laser': sweepOsc('sawtooth', 1600, 120, 0.22, 0.25); break;
      case 'powerup': seqTones(ctx, dest, time, v, [72, 76, 79, 84, 88, 91, 96], 0.045, 'square', 0.08); break;
      case 'hit': sweepOsc('square', 220, 50, 0.12, 0.3); noiseHit(ctx, dest, time, v * 0.4, { type: 'lowpass', freq: 3000, decay: 0.1 }); break;
      case 'explosion': noiseHit(ctx, dest, time, v * 0.9, { type: 'lowpass', freq: 3000, sweepTo: 80, decay: 1.1, q: 2 }); toneHit(ctx, dest, time, v * 0.6, { from: 90, to: 30, sweep: 0.5, decay: 0.8 }); break;
      case 'blip': sweepOsc('square', 1200, 1200, 0.05, 0.2); break;
      case 'heal': seqTones(ctx, dest, time, v, [76, 79, 88, 84, 86, 91], 0.07, 'triangle', 0.12); break;
      case 'whoosh': {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
        f.frequency.setValueAtTime(300, time); f.frequency.exponentialRampToValueAtTime(2500, time + 0.25); f.frequency.exponentialRampToValueAtTime(300, time + 0.5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(v * 0.8, time + 0.25); g.gain.linearRampToValueAtTime(0.0001, time + 0.5);
        n.connect(f); f.connect(g); g.connect(dest); n.start(time); n.stop(time + 0.55);
        break;
      }
      case 'magic': seqTones(ctx, dest, time, v * 1.4, [96, 91, 100, 95, 103, 98, 108], 0.04, 'sine', 0.35); break;
      case 'error': sweepOsc('square', 140, 140, 0.1, 0.2); { const t2 = time + 0.14; const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 110; const g = ctx.createGain(); g.gain.setValueAtTime(0.2 * v, t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.15); o.connect(g); g.connect(dest); o.start(t2); o.stop(t2 + 0.2); } break;
    }
  }

  // Per-instrument loudness balance (measured), so every sound starts at a similar volume
  const LEVEL = {"kit:acoustic": 1.23, "kit:chip": 2.09, "kit:lofi": 1.22, "kit:sfx": 1.41, "synth:square": 0.67, "synth:pulse": 1.7, "synth:triangle": 0.39, "synth:saw": 2.07, "synth:sine": 0.5, "synth:softpad": 2.82, "synth:pluck": 2.63, "synth:subbass": 0.32, "synth:acid": 1.76, "synth:brass": 2.09, "synth:strings": 2.34, "synth:blip": 3.98, "synth:wind": 3.98, "gm:acoustic_grand_piano": 1.78, "gm:bright_acoustic_piano": 1.86, "gm:electric_piano_1": 0.78, "gm:harpsichord": 1.2, "gm:drawbar_organ": 1.22, "gm:accordion": 1.48, "gm:vibraphone": 1.78, "gm:marimba": 1.35, "gm:xylophone": 3.98, "gm:glockenspiel": 2.24, "gm:celesta": 1.32, "gm:music_box": 1.26, "gm:kalimba": 2.4, "gm:tubular_bells": 1.19, "gm:steel_drums": 1.68, "gm:dulcimer": 2.82, "gm:contrabass": 1.15, "gm:pizzicato_strings": 1.15, "gm:orchestral_harp": 1.26, "gm:trumpet": 1.4, "gm:trombone": 0.65, "gm:tuba": 0.74, "gm:french_horn": 0.88, "gm:flute": 0.69, "gm:piccolo": 0.76, "gm:clarinet": 0.72, "gm:oboe": 0.86, "gm:bassoon": 0.81, "gm:recorder": 0.66, "gm:pan_flute": 0.81, "gm:ocarina": 0.67, "gm:alto_sax": 0.73, "gm:harmonica": 1.36, "gm:acoustic_guitar_nylon": 0.87, "gm:acoustic_guitar_steel": 1.17, "gm:distortion_guitar": 0.73, "gm:banjo": 1.66, "gm:sitar": 1.8, "gm:koto": 2.16, "gm:shamisen": 3.05, "gm:electric_bass_finger": 0.85, "gm:slap_bass_1": 1.4, "gm:synth_bass_1": 1.12, "gm:choir_aahs": 1.22, "gm:voice_oohs": 0.85, "gm:pad_2_warm": 2.26, "gm:pad_1_new_age": 1.51, "gm:fx_4_atmosphere": 0.84, "gm:timpani": 1.68, "gm:orchestra_hit": 1.24, "gm:lead_1_square": 0.77, "gm:lead_2_sawtooth": 1.15};

  // ---------- Unified note trigger ----------
  // pitch: MIDI note for melodic tracks, row index for drum tracks. Returns {stop(time)}.
  function trigger(ctx, dest, track, pitch, time, vel = 0.8) {
    const id = track.instrument || 'synth:square';
    if (LEVEL[id]) vel *= LEVEL[id];
    const [type, name] = id.split(/:(.*)/);
    if (type === 'kit') {
      const rows = KITS[name] ? KITS[name].rows : DRUM_ROWS;
      const ov = track.rowSamples && track.rowSamples[pitch];
      if (ov && userSamples[ov]) return userVoice(ctx, dest, userSamples[ov], 60, time, vel, true);
      const row = rows[pitch];
      if (row) drumHit(ctx, dest, name, row[0], time, vel);
      return { stop() {} };
    }
    if (type === 'synth') return synthVoice(ctx, dest, track.synth || (SYNTHS[name] || SYNTHS.square).p, pitch, time, vel);
    if (type === 'gm') {
      const set = sampleSets[name];
      if (!set) { loadSampleSet(name).catch(() => {}); return { stop() {} }; }
      const sustained = /strings|string_|organ|pad|fx_|choir|voice|accordion|harmonica|bagpipe|violin|viola|cello|contrabass|trumpet|trombone|tuba|horn|brass|sax|flute|piccolo|clarinet|oboe|bassoon|recorder|ocarina|fiddle/.test(name);
      return sampleVoice(ctx, dest, set, pitch, time, vel, { release: sustained ? 0.18 : 0.35, volume: 3.2 });
    }
    if (type === 'user') {
      const s = userSamples[name];
      if (!s) return { stop() {} };
      return userVoice(ctx, dest, s, pitch, time, vel, !!track.oneShot);
    }
    return { stop() {} };
  }

  function defaultSynthParams(id) {
    const name = (id || '').split(':')[1];
    return SYNTHS[name] ? JSON.parse(JSON.stringify(SYNTHS[name].p)) : null;
  }

  CC.instruments = { GM, GM_PROGRAM, SYNTHS, KITS, DRUM_ROWS, SFX_ROWS, GM_DRUM_NOTE, CATEGORY_ORDER, catalog, info, kitRows, loadSampleSet, ensureLoaded, isReady, userSamples, addUserSample, trigger, defaultSynthParams, noiseBuffer };
})(window.CC);
