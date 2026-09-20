// Starts, stops and reconfigures modules on YouTube as settings arrive from content/bridge.js.
(() => {
  const YTU = window.YTU;
  if (!YTU || YTU.booted) return;
  YTU.booted = true;

  const running = new Map(); // id -> { settings, listeners:Set, cleanup }

  function defaultsOf(def) {
    const out = { enabled: def.enabledByDefault !== false };
    for (const [key, s] of Object.entries(def.settings || {})) {
      if ('default' in s) out[key] = s.default;
    }
    return out;
  }

  // Settings come from the extension's async storage, so the first ones land after YouTube has
  // already painted. A module can declare `css` (a string, or a function of its settings), which
  // goes in here at document_start using the settings we saw last time — nothing flashes before it.
  const CACHE = 'ytu:last-settings';
  let earlyStyle = null;

  function applyEarlyCss() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CACHE)) || {}; } catch { /* first run */ }
    const css = YTU.modules.map(def => {
      if (!def.css) return '';
      const cfg = { ...defaultsOf(def), ...((saved.modules || {})[def.id] || {}) };
      if (!cfg.enabled) return '';
      return typeof def.css === 'function' ? def.css(cfg) : def.css;
    }).filter(Boolean).join('\n');
    if (!css) return;
    earlyStyle = document.createElement('style');
    earlyStyle.id = 'ytu-early-css';
    earlyStyle.textContent = css;
    (document.head || document.documentElement).appendChild(earlyStyle);
    // If the settings never arrive — a broken bridge, half-reloaded extension — drop it rather than
    // leave the page hiding things with no module running to put them back.
    setTimeout(() => { if (earlyStyle) { earlyStyle.remove(); earlyStyle = null; } }, 5000);
  }

  function makeStorage(id) {
    const prefix = `ytu:${id}:`;
    return {
      get(key, fallback = null) {
        try {
          const raw = localStorage.getItem(prefix + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* storage full/blocked */ }
      },
      remove(key) {
        try { localStorage.removeItem(prefix + key); } catch { /* ignore */ }
      },
    };
  }

  function start(def, cfg) {
    const state = { settings: { ...cfg }, listeners: new Set(), cleanup: null };
    const ctx = {
      id: def.id,
      settings: state.settings,
      onChange(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); },
      storage: makeStorage(def.id),
      log: (...args) => console.log(`[YouTube Utils: ${def.name}]`, ...args),
    };
    running.set(def.id, state);
    try {
      const cleanup = def.run(ctx);
      if (typeof cleanup === 'function') state.cleanup = cleanup;
    } catch (err) {
      console.error(`[YouTube Utils] module "${def.id}" failed to start`, err);
    }
  }

  function stop(def) {
    const state = running.get(def.id);
    running.delete(def.id);
    try {
      if (state && state.cleanup) state.cleanup();
    } catch (err) {
      console.error(`[YouTube Utils] module "${def.id}" failed to stop`, err);
    }
  }

  function update(def, cfg) {
    const state = running.get(def.id);
    const changed = Object.keys(cfg).filter(k => state.settings[k] !== cfg[k]);
    if (!changed.length) return;
    Object.assign(state.settings, cfg);
    for (const fn of state.listeners) {
      try { fn(changed, state.settings); } catch (err) { console.error(err); }
    }
  }

  function apply(saved) {
    for (const def of YTU.modules) {
      const cfg = { ...defaultsOf(def), ...((saved.modules || {})[def.id] || {}) };
      const isRunning = running.has(def.id);
      if (cfg.enabled && !isRunning) start(def, cfg);
      else if (!cfg.enabled && isRunning) stop(def);
      else if (cfg.enabled) update(def, cfg);
    }
  }

  document.addEventListener('ytu:settings', e => {
    try { localStorage.setItem(CACHE, e.detail || '{}'); } catch { /* storage full/blocked */ }
    let saved = {};
    try { saved = JSON.parse(e.detail || '{}'); } catch { /* keep defaults */ }
    apply(saved);
    // Every running module brought its own stylesheet, so the early copy can go.
    if (earlyStyle) { earlyStyle.remove(); earlyStyle = null; }
  });
  applyEarlyCss();
  document.dispatchEvent(new CustomEvent('ytu:hello'));
})();
