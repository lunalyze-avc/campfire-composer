// Color themes (warm campfire palettes, or your own colors) and the drifting embers background.
window.CC = window.CC || {};
(function (CC) {
  const PRESETS = {
    evergreen: { name: 'Black & orange', bg: '#0a0b0b', tint: '#a0a0a0', text: '#efe7da', accent: '#e55812', accent2: '#bdbdbd', ember: '#e55812', sel: '#2b2b2b', deep: '#171818', viz1: '#c4461a', viz2: '#f2a65a', vizSel: '#0e4749' },
    night: { name: 'Campfire night', bg: '#111829', tint: '#c4cce6', accent: '#f2a33a', accent2: '#c7889a', ember: '#f5b14a' },
    dusk: { name: 'Dusk', bg: '#19142a', tint: '#d8c8e4', accent: '#f2a33a', accent2: '#d0909a', ember: '#f5a84a' },
    pine: { name: 'Pine forest', bg: '#0f1a18', tint: '#c8dccf', accent: '#f2a33a', accent2: '#7fae84', ember: '#f5b14a' },
    moon: { name: 'Moonlight', bg: '#14171f', tint: '#d4d8e2', accent: '#e8d29a', accent2: '#8fa3c7', ember: '#e8d9a8' },
    ember: { name: 'Ember', bg: '#15110e', tint: '#d8c8b0', accent: '#f08a3a', accent2: '#d4a86a', ember: '#f5803a' }
  };
  const DEFAULTS = { preset: 'evergreen', glow: 0.5, embers: true };
  const KEYS = ['bg', 'accent', 'accent2', 'ember'];

  function stored() {
    const t = CC.storage.setting('theme') || {};
    if (t.preset && !PRESETS[t.preset] && t.preset !== 'custom') t.preset = 'evergreen'; // themes from older versions
    return t;
  }
  function get() {
    const t = Object.assign({}, DEFAULTS, stored());
    const base = PRESETS[t.preset] || PRESETS.evergreen;
    KEYS.forEach(k => { t[k] = (t.preset === 'custom' && t[k]) || base[k]; });
    t.tint = t.preset === 'custom' ? '#ccd0e0' : base.tint;
    t.text = (t.preset !== 'custom' && base.text) || '#ebe7f0';
    t.sel = (t.preset !== 'custom' && base.sel) || mix(t.bg, t.accent2, 0.22);
    t.deep = (t.preset !== 'custom' && base.deep) || mix(t.bg, t.accent2, 0.1);
    // Colors for the music itself (waveform, meter, sections, song order, instruments)
    t.viz1 = t.wave1 || (t.preset !== 'custom' && base.viz1) || t.accent2;
    t.viz2 = t.wave2 || (t.preset !== 'custom' && base.viz2) || t.accent;
    t.vizSel = (t.preset !== 'custom' && base.vizSel) || t.sel;
    return t;
  }
  function set(changes) {
    CC.storage.setting('theme', Object.assign({}, DEFAULTS, stored(), changes));
    apply();
  }

  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (c) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const rgba = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
  const lum = (c) => { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  let current = null;
  function apply() {
    const root = document.documentElement;
    const t = get(), st = root.style;
    const contrast = root.classList.contains('contrast');
    if (contrast) t.glow = 0;
    current = t;
    if (!contrast) {
      // Panels are the background lifted slightly toward the theme's light tint, so everything stays in one family
      const ash = t.tint;
      st.setProperty('--bg', t.bg);
      st.setProperty('--text', t.text);
      st.setProperty('--sel', t.sel);
      st.setProperty('--deep', t.deep);
      st.setProperty('--muted', mix(t.text, t.bg, 0.3));
      st.setProperty('--faint', mix(t.text, t.bg, 0.5));
      st.setProperty('--panel', mix(t.bg, ash, 0.045));
      st.setProperty('--panel2', mix(t.bg, ash, 0.08));
      st.setProperty('--panel3', mix(t.bg, ash, 0.13));
      st.setProperty('--line', mix(t.bg, ash, 0.2));
      st.setProperty('--grid-bg', mix(t.bg, '#000000', 0.25));
      st.setProperty('--grid-fill', rgba(mix(t.bg, '#000000', 0.25), 0.5));
      st.setProperty('--grid-alt', mix(t.bg, ash, 0.025));
      st.setProperty('--grid-line', mix(t.bg, ash, 0.08));
      st.setProperty('--grid-beat', mix(t.bg, ash, 0.16));
      st.setProperty('--grid-head', mix(t.bg, ash, 0.05));
      st.setProperty('--grid-bar', mix(t.accent, t.bg, 0.45));
    } else ['--bg', '--grid-fill', '--sel', '--deep', '--text', '--muted', '--faint', '--panel', '--panel2', '--panel3', '--line', '--grid-bg', '--grid-alt', '--grid-line', '--grid-beat', '--grid-head', '--grid-bar'].forEach(k => st.removeProperty(k));
    st.setProperty('--accent', t.accent);
    st.setProperty('--accent2', t.accent2);
    st.setProperty('--focus', t.accent);
    st.setProperty('--viz1', t.viz1);
    st.setProperty('--viz2', t.viz2);
    st.setProperty('--viz-sel', t.vizSel);
    st.setProperty('--ember', t.ember);
    st.setProperty('--accent-text', lum(t.accent) > 0.28 ? '#140d08' : '#ffffff');
    st.setProperty('--accent2-text', lum(t.accent2) > 0.28 ? '#140d08' : '#ffffff');
    st.setProperty('--glow', t.glow);
    st.setProperty('--grid-root', rgba(t.accent, 0.08));
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = t.bg;
    // The app's own Reduce motion setting decides (not the Windows animation setting)
    embers.toggle(t.embers && !contrast && !root.classList.contains('reduce-motion'));
  }

  // ---------- Drifting embers (a few dozen sparks rising from the bottom) ----------
  const embers = (() => {
    let on = false, raf = 0, last = 0, parts = [], c, ctx, w, hgt;
    function resize() {
      c = document.getElementById('embers'); if (!c) return;
      const dpr = 1;
      w = innerWidth; hgt = innerHeight;
      c.width = w * dpr; c.height = hgt * dpr; c.style.width = w + 'px'; c.style.height = hgt + 'px';
      ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(initial) {
      return { x: Math.random() * w, y: initial ? Math.random() * hgt : hgt + 10, r: 1 + Math.random() * 2.2, vy: 12 + Math.random() * 30, vx: (Math.random() - 0.5) * 10, life: 0, max: 6 + Math.random() * 10, ph: Math.random() * 6.28 };
    }
    // One soft glowing dot, drawn once and stamped for every spark (much cheaper than blur)
    let sprite = null, spriteKey = '';
    function getSprite(col, g) {
      const key = col + g;
      if (sprite && spriteKey === key) return sprite;
      sprite = document.createElement('canvas'); sprite.width = sprite.height = 24; spriteKey = key;
      const x = sprite.getContext('2d'), grd = x.createRadialGradient(12, 12, 0, 12, 12, 12);
      grd.addColorStop(0, '#fff6e0'); grd.addColorStop(0.18, col); grd.addColorStop(0.45, rgba(col, 0.35 * Math.min(1, g))); grd.addColorStop(1, rgba(col, 0));
      x.fillStyle = grd; x.fillRect(0, 0, 24, 24);
      return sprite;
    }
    function step(now) {
      raf = requestAnimationFrame(step);
      if (now - last < 40 || document.hidden) return; // 25 frames a second is plenty for drifting sparks
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const g = current ? current.glow : 1, img = getSprite(current ? current.ember : '#ff7a2a', g);
      ctx.clearRect(0, 0, w, hgt);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.life += dt; p.y -= p.vy * dt; p.x += (p.vx + Math.sin(p.life * 1.7 + p.ph) * 8) * dt;
        if (p.life > p.max || p.y < -10) { parts[i] = spawn(false); continue; }
        const fade = Math.min(1, p.life / 1.2) * (1 - p.life / p.max);
        const flick = 0.65 + 0.35 * Math.sin(p.life * 9 + p.ph);
        ctx.globalAlpha = Math.max(0, fade * flick * Math.min(1, 0.7 + g * 0.5));
        const sz = p.r * (4 + 4 * Math.min(1.5, g));
        ctx.drawImage(img, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    function toggle(want) {
      if (want === on) return;
      on = want;
      if (on) {
        resize(); if (!ctx) { on = false; return; }
        parts = Array.from({ length: Math.round(Math.min(40, w / 45)) }, () => spawn(true));
        last = performance.now(); raf = requestAnimationFrame(step);
      } else { cancelAnimationFrame(raf); if (ctx) ctx.clearRect(0, 0, w, hgt); }
    }
    addEventListener('resize', () => { if (on) resize(); });
    return { toggle };
  })();

  CC.theme = { PRESETS, DEFAULTS, get, set, apply, rgba };
})(window.CC);
