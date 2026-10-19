// Songsterr tabs in a floating window next to the video, with the tab's cursor following the song.
YTU.register({
  id: 'songsterr',
  name: 'Songsterr tabs',
  description: 'Attach a Songsterr tab to a video and read it in a floating window you can drag and resize. Click the tab icon in the player bar to paste the link; it\'s remembered for that video. Once you\'ve set the tempo and bar 1 in Count-in & loop, the tab\'s cursor moves bar by bar with the video, at any speed, through seeks and loops.',
  settings: {
    tabOnly: { type: 'boolean', label: 'Show only the tab (hide Songsterr\'s menus and toolbar)', default: true },
    follow: { type: 'boolean', label: 'Move the tab\'s cursor along with the video', default: true },
  },

  run(ctx) {
    const s = ctx.settings;
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    const NAME = 'ytu-songsterr'; // content/songsterr-frame.js only wakes up in a window with this name
    const SONGSTERR = 'https://www.songsterr.com';

    const style = document.createElement('style');
    style.textContent = `
      .ytu-tab-btn svg { display: block; margin: auto; }
      .ytu-tab-btn.ytu-tab-set .ytu-tab-dot { fill: #3ea6ff; }
      .ytu-tab-win {
        position: fixed; z-index: 2400; display: flex; flex-direction: column; box-sizing: border-box;
        min-width: 320px; min-height: 180px; border-radius: 12px; overflow: hidden;
        background: rgba(30, 30, 30, .94); backdrop-filter: blur(20px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 12px 32px rgba(0, 0, 0, .45);
        color: #f1f1f1; font: 400 13px/1.35 Roboto, Arial, sans-serif;
      }
      .ytu-tab-win[hidden] { display: none; }
      .ytu-tab-win * { box-sizing: border-box; }
      .ytu-tab-head { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 6px 0 12px; flex: none; cursor: move; user-select: none; }
      .ytu-tab-title { font-size: 14px; font-weight: 500; }
      .ytu-tab-status { margin-right: auto; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: rgba(255, 255, 255, .55); font-size: 12px; }
      .ytu-tab-win button {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 26px; padding: 0 10px; border: none; border-radius: 13px; cursor: pointer;
        background: rgba(255, 255, 255, .1); color: #f1f1f1; font: 500 12px/1 Roboto, Arial, sans-serif;
      }
      .ytu-tab-win button:hover { background: rgba(255, 255, 255, .18); }
      .ytu-tab-win button:focus-visible, .ytu-tab-win input:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 1px; }
      .ytu-tab-win button.ytu-tab-icon { width: 26px; padding: 0; background: none; font-size: 15px; color: rgba(255, 255, 255, .7); }
      .ytu-tab-win button.ytu-tab-icon:hover { background: rgba(255, 255, 255, .1); color: #fff; }
      .ytu-tab-offset { display: flex; align-items: center; height: 26px; border-radius: 13px; background: rgba(255, 255, 255, .1); }
      .ytu-tab-offset[hidden] { display: none; }
      .ytu-tab-win .ytu-tab-offset button { width: 24px; padding: 0; background: none; font-size: 15px; }
      .ytu-tab-offset span { min-width: 64px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; }
      .ytu-tab-body { position: relative; flex: 1; min-height: 0; background: #fff; }
      .ytu-tab-body iframe { display: block; width: 100%; height: 100%; border: 0; }
      .ytu-tab-dragging .ytu-tab-body iframe { pointer-events: none; }
      .ytu-tab-note {
        position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
        padding: 16px; background: #1e1e1e; text-align: center; color: rgba(255, 255, 255, .75);
      }
      .ytu-tab-note[hidden] { display: none; }
      .ytu-tab-note form { display: flex; gap: 8px; width: 100%; max-width: 460px; }
      .ytu-tab-note input {
        flex: 1; min-width: 0; height: 32px; padding: 0 12px; border: 1px solid rgba(255, 255, 255, .15); border-radius: 16px;
        background: rgba(0, 0, 0, .3); color: #fff; font: 400 13px Roboto, Arial, sans-serif;
      }
      .ytu-tab-win .ytu-tab-note button { height: 32px; border-radius: 16px; }
      .ytu-tab-win .ytu-tab-note button.ytu-tab-primary { background: #f1f1f1; color: #0f0f0f; }
      .ytu-tab-win .ytu-tab-note button.ytu-tab-primary:hover { background: #d9d9d9; }
      .ytu-tab-err { color: #ff8a80; font-size: 12px; }
      .ytu-tab-err:empty { display: none; }
      .ytu-tab-grip { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 1;
        background: linear-gradient(135deg, transparent 50%, rgba(128, 128, 128, .7) 50%, rgba(128, 128, 128, .7) 60%, transparent 60%, transparent 70%, rgba(128, 128, 128, .7) 70%, rgba(128, 128, 128, .7) 80%, transparent 80%); }
    `;
    (document.head || document.documentElement).appendChild(style);
    disposers.push(() => style.remove());

    const player = () => document.querySelector('#movie_player');
    const video = () => { const p = player(); return p && p.querySelector('video'); };
    const isWatch = () => location.pathname === '/watch';

    function currentVideoId() {
      const p = player();
      const data = p && typeof p.getVideoData === 'function' ? p.getVideoData() : null;
      return (data && data.video_id) || new URLSearchParams(location.search).get('v');
    }

    // Only Songsterr tab pages: anything else in the frame would be someone else's page on YouTube.
    function parseLink(text) {
      let u;
      try { u = new URL(String(text).trim()); } catch { return null; }
      if (!/^(www\.)?songsterr\.com$/.test(u.hostname) || !/^https?:$/.test(u.protocol)) return null;
      if (u.pathname === '/' || u.pathname === '') return null;
      return SONGSTERR + u.pathname + u.search;
    }

    // -------------------------------------------------------------- per-video link
    // { url, offset (tab bar minus video bar) }
    let videoId = null;
    let tab = {};
    function save() {
      if (!videoId) return;
      if (tab.url) ctx.storage.set('tab:' + videoId, tab);
      else ctx.storage.remove('tab:' + videoId);
    }

    // The tempo grid you set in Count-in & loop: bar 1 is at `start`, every bar is perBar beats long.
    function songGrid() {
      if (!videoId) return null;
      let song = null;
      let perBar = 4;
      try {
        song = JSON.parse(localStorage.getItem('ytu:count-in:song:' + videoId));
        const cached = JSON.parse(localStorage.getItem('ytu:last-settings')) || {};
        perBar = ((cached.modules || {})['count-in'] || {}).perBar || perBar;
      } catch { /* no grid */ }
      if (!song || !song.bpm || song.enabled === false) return null;
      return { start: song.start || 0, bar: (60 / song.bpm) * (song.perBar || perBar) };
    }

    // -------------------------------------------------------------- window
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    const btnEl = (text, title, onClick, cls) => {
      const b = el('button', cls, text);
      b.type = 'button';
      if (title) b.title = title;
      b.addEventListener('click', e => { e.stopPropagation(); onClick(e); });
      return b;
    };

    let win = null;
    let frame = null;       // the iframe, while the tab is shown in the page
    let popup = null;       // the separate window, when the page can't show Songsterr
    let ready = false;      // the Songsterr side answered
    let readyTimer = null;
    let lastBar = null;     // the bar we last sent
    let usePopup = !!ctx.storage.get('popup', false);
    const ui = {};

    const target = () => (popup && !popup.closed ? popup : frame && frame.contentWindow);
    function send(msg) {
      const t = target();
      if (t && ready) t.postMessage(msg, SONGSTERR);
    }

    function place(box) {
      const w = Math.min(Math.max(320, box.w), window.innerWidth);
      const h = Math.min(Math.max(180, box.h), window.innerHeight);
      const x = Math.min(Math.max(0, box.x), window.innerWidth - Math.min(w, 120));
      const y = Math.min(Math.max(0, box.y), window.innerHeight - 36);
      Object.assign(win.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      return { x, y, w, h };
    }
    function savedBox() {
      return ctx.storage.get('box', null) || { x: window.innerWidth - 640, y: 80, w: 620, h: 420 };
    }

    // Drag by the title bar, resize from the corner. The iframe would swallow the pointer while it
    // passes over it, so it ignores the mouse until you let go.
    function dragger(handle, apply) {
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button, input')) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const start = { px: e.clientX, py: e.clientY, ...savedBoxFromStyle() };
        win.classList.add('ytu-tab-dragging');
        const move = ev => place(apply(start, ev.clientX - start.px, ev.clientY - start.py));
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          win.classList.remove('ytu-tab-dragging');
          ctx.storage.set('box', savedBoxFromStyle());
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      });
    }
    function savedBoxFromStyle() {
      const r = win.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    function buildWindow() {
      const w = el('div', 'ytu-tab-win');
      w.hidden = true;

      const head = el('div', 'ytu-tab-head');
      ui.status = el('span', 'ytu-tab-status');
      ui.offset = el('div', 'ytu-tab-offset');
      ui.offsetVal = el('span');
      ui.offset.title = 'Shifts the tab against the video, for when the tab has bars before bar 1 that the video doesn\'t, or the other way round.';
      ui.offset.append(
        btnEl('−', 'Tab one bar earlier', () => setOffset(-1)),
        ui.offsetVal,
        btnEl('+', 'Tab one bar later', () => setOffset(1)));
      head.append(
        el('span', 'ytu-tab-title', 'Tab'),
        ui.status,
        ui.offset,
        btnEl('🔗', 'Change the Songsterr link', () => showForm(), 'ytu-tab-icon'),
        ui.popBtn = btnEl('⧉', 'Open the tab in a separate window', () => openPopup(true), 'ytu-tab-icon'),
        btnEl('×', 'Close', () => setOpen(false), 'ytu-tab-icon'));

      const body = el('div', 'ytu-tab-body');

      ui.form = el('div', 'ytu-tab-note');
      const form = el('form');
      ui.input = el('input');
      ui.input.type = 'url';
      ui.input.placeholder = 'https://www.songsterr.com/a/wsa/…-tab-s…';
      ui.input.setAttribute('aria-label', 'Songsterr link');
      const saveBtn = el('button', 'ytu-tab-primary', 'Save');
      saveBtn.type = 'submit';
      form.append(ui.input, saveBtn);
      form.addEventListener('submit', e => { e.preventDefault(); submitLink(); });
      ui.err = el('div', 'ytu-tab-err');
      ui.removeBtn = btnEl('Remove the link from this video', null, () => { tab = {}; save(); showForm(); refreshButton(); });
      ui.form.append(el('div', null, 'Paste the link to this song\'s tab on Songsterr.'), form, ui.err, ui.removeBtn);

      ui.blocked = el('div', 'ytu-tab-note');
      ui.blockedText = el('div');
      ui.blocked.append(ui.blockedText,
        btnEl('Open in a separate window', null, () => openPopup(true), 'ytu-tab-primary'),
        ui.retryBtn = btnEl('Try in the page again', null, () => { usePopup = false; ctx.storage.set('popup', false); closePopup(); load(); }));

      const grip = el('div', 'ytu-tab-grip');
      body.append(ui.form, ui.blocked, grip);
      w.append(head, body);
      ui.body = body;

      dragger(head, (b, dx, dy) => ({ ...b, x: b.x + dx, y: b.y + dy }));
      dragger(grip, (b, dx, dy) => ({ ...b, w: b.w + dx, h: b.h + dy }));
      return w;
    }

    function setOffset(d) {
      tab.offset = (tab.offset || 0) + d;
      save();
      lastBar = null; // re-send at once
      refreshHead();
    }

    function submitLink() {
      const url = parseLink(ui.input.value);
      if (!url) {
        ui.err.textContent = 'That isn\'t a Songsterr tab link.';
        return;
      }
      tab = { url, offset: url === tab.url ? tab.offset || 0 : 0 };
      save();
      refreshButton();
      load();
    }

    function showForm() {
      unloadFrame();
      ui.blocked.hidden = true;
      ui.form.hidden = false;
      ui.input.value = tab.url || '';
      ui.err.textContent = '';
      ui.removeBtn.hidden = !tab.url;
      refreshHead();
      setTimeout(() => ui.input.focus(), 0);
    }

    function showBlocked(text, canRetry) {
      ui.form.hidden = true;
      ui.blocked.hidden = false;
      ui.blockedText.textContent = text;
      ui.retryBtn.hidden = !canRetry;
    }

    function unloadFrame() {
      clearTimeout(readyTimer);
      if (frame) { frame.remove(); frame = null; }
      ready = false;
      lastBar = null;
    }

    // Shows the tab: in the page, or in the separate window if you chose that.
    function load() {
      unloadFrame();
      if (!tab.url) { showForm(); return; }
      if (usePopup) { openPopup(false); return; }
      ui.form.hidden = true;
      ui.blocked.hidden = true;
      frame = el('iframe');
      frame.name = NAME;
      frame.title = 'Songsterr tab';
      frame.referrerPolicy = 'no-referrer';
      frame.src = tab.url;
      ui.body.insertBefore(frame, ui.body.firstChild);
      // Songsterr's page reports in when it loads. If it never does, it refused to be shown inside
      // another site, or the extension isn't allowed on songsterr.com.
      readyTimer = setTimeout(() => {
        if (!ready) showBlocked('Songsterr didn\'t load inside the page.', false);
      }, 12000);
      refreshHead();
    }

    // `byClick`: browsers only let a click open a new window; later videos reuse the one already open.
    function openPopup(byClick) {
      if (!tab.url) return;
      unloadFrame();
      if (popup && !popup.closed) {
        popup.location.href = tab.url;
      } else if (byClick) {
        const box = savedBox();
        popup = window.open(tab.url, NAME, `popup,width=${Math.round(box.w)},height=${Math.round(box.h)}`);
      }
      if (byClick) { usePopup = true; ctx.storage.set('popup', true); }
      if (popup && !popup.closed) showBlocked('The tab is open in a separate window and follows the video from there.', true);
      else showBlocked('Open the tab in a separate window to read it next to the video.', true);
      refreshHead();
    }

    function closePopup() {
      if (popup && !popup.closed) popup.close();
      popup = null;
      ready = false;
    }

    function setOpen(open) {
      ctx.storage.set('open', open);
      if (!win) return;
      win.hidden = !open;
      if (open) {
        place(savedBox());
        if (!frame && !(popup && !popup.closed)) load();
      } else {
        unloadFrame();
        closePopup();
      }
    }
    const isOpen = () => !!win && !win.hidden;

    // -------------------------------------------------------------- following the video
    function refreshHead() {
      if (!win) return;
      const grid = songGrid();
      ui.offset.hidden = !tab.url || !s.follow;
      const o = tab.offset || 0;
      ui.offsetVal.textContent = `${o > 0 ? '+' : ''}${o} bars`;
      ui.popBtn.hidden = !tab.url;
      if (!tab.url) ui.status.textContent = '';
      else if (!s.follow) ui.status.textContent = '';
      else if (!grid) ui.status.textContent = 'Set the tempo in Count-in to follow the video';
      else ui.status.textContent = lastBar ? `Bar ${lastBar}` : '';
    }

    function tick() {
      if (!s.follow || !ready || !tab.url) return;
      const v = video();
      const grid = songGrid();
      if (!v || !grid) return;
      const videoBar = Math.floor((v.currentTime - grid.start) / grid.bar + 1e-6) + 1;
      const bar = Math.max(1, videoBar + (tab.offset || 0));
      if (bar === lastBar) return;
      lastBar = bar;
      send({ type: 'ytu-tab:goto', bar });
      refreshHead();
    }
    const tickTimer = setInterval(tick, 50);
    disposers.push(() => clearInterval(tickTimer));

    on(window, 'message', e => {
      const t = target();
      if (!t || e.source !== t || e.origin !== SONGSTERR) return;
      if (!e.data || e.data.type !== 'ytu-tab:ready') return;
      ready = true;
      clearTimeout(readyTimer);
      lastBar = null;
      send({ type: 'ytu-tab:config', tabOnly: !!s.tabOnly });
      tick();
    });

    disposers.push(ctx.onChange(keys => {
      if (keys.includes('tabOnly')) send({ type: 'ytu-tab:config', tabOnly: !!s.tabOnly });
      if (keys.includes('follow')) lastBar = null;
      refreshHead();
    }));

    // YouTube reads keys page-wide, so typing a link would seek or pause the video. Stopped on window
    // in the capture phase, ahead of YouTube; the typing itself still happens.
    for (const type of ['keydown', 'keypress', 'keyup']) {
      on(window, type, e => { if (win && e.target instanceof Node && win.contains(e.target)) e.stopImmediatePropagation(); }, true);
    }

    // Keep the window on screen when the browser window shrinks.
    on(window, 'resize', () => { if (isOpen()) place(savedBoxFromStyle()); });

    // -------------------------------------------------------------- player bar button
    let btn = null;

    function tabIcon() {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      const attrs = { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: '#fff', 'stroke-width': '1.6', 'stroke-linecap': 'round' };
      for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
      const add = (tag, a) => {
        const n = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
        svg.appendChild(n);
        return n;
      };
      for (const y of [6, 10, 14, 18]) add('path', { d: `M3 ${y}h18` }); // strings
      add('path', { d: 'M3 6v12M21 6v12' });                            // bar lines
      add('circle', { class: 'ytu-tab-dot', cx: '9', cy: '10', r: '2', fill: '#fff', stroke: 'none' });
      add('circle', { class: 'ytu-tab-dot', cx: '15', cy: '14', r: '2', fill: '#fff', stroke: 'none' });
      return svg;
    }

    function buildButton() {
      const b = el('button', 'ytp-button ytu-tab-btn');
      b.type = 'button';
      b.setAttribute('aria-label', 'Songsterr tab');
      b.title = 'Songsterr tab';
      b.appendChild(tabIcon());
      b.addEventListener('click', e => { e.stopPropagation(); setOpen(!isOpen()); });
      return b;
    }

    function refreshButton() {
      if (btn) btn.classList.toggle('ytu-tab-set', !!tab.url);
    }

    function ensureUi() {
      const p = player();
      if (!isWatch() || !p) {
        if (btn) btn.remove();
        if (win) win.hidden = true;
        return;
      }
      const hostEl = p.querySelector('.ytp-right-controls-left') || p.querySelector('.ytp-right-controls');
      if (hostEl) {
        if (!btn) btn = buildButton();
        if (btn.parentElement !== hostEl) hostEl.insertBefore(btn, hostEl.querySelector('.ytp-settings-button') || hostEl.firstChild);
      }
      if (!win) win = buildWindow();
      if (win.parentElement !== document.body && document.body) document.body.appendChild(win);
    }

    // -------------------------------------------------------------- page tracking
    function poll() {
      const id = isWatch() ? currentVideoId() : null;
      ensureUi();
      if (id !== videoId) {
        videoId = id;
        tab = id ? ctx.storage.get('tab:' + id, {}) || {} : {};
        unloadFrame();
        if (popup && popup.closed) popup = null;
        refreshButton();
        // The window stays open from video to video if you left it open, but only where there's a tab to show.
        const show = !!(id && tab.url && win && ctx.storage.get('open', false));
        if (win) win.hidden = !show;
        if (show) { place(savedBox()); load(); }
      }
      refreshHead();
    }
    const timer = setInterval(poll, 500);
    on(document, 'yt-navigate-finish', poll);
    poll();

    return () => {
      clearInterval(timer);
      clearTimeout(readyTimer);
      for (const d of disposers) d();
      if (btn) btn.remove();
      if (win) win.remove();
      closePopup();
    };
  },
});
