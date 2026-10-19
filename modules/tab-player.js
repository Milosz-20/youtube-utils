// A Songsterr tab drawn by the extension itself in a floating window, its cursor following the video.
// The window holds tabs/player.html (an extension page, so no site can refuse to be shown in it);
// this side moves the window around and passes the video's time in and seeks/plays/pauses out.
YTU.register({
  id: 'tab-player',
  name: 'Tab player',
  description: 'Attach a Songsterr tab to a video and read it in a floating window you can drag and resize. The extension draws the tab itself, so it shows in Zen and Firefox too. The cursor follows the video at any speed; click a note to jump the video there. Bar 1 is shared with Count-in & loop: set it in either place (type it, nudge it, or press Here on the beat). Press "Pin bar" on a later downbeat if the cursor drifts.',

  run(ctx) {
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    const style = document.createElement('style');
    style.textContent = `
      .ytu-tp-btn svg { display: block; margin: auto; }
      .ytu-tp-win {
        position: fixed; z-index: 2400; display: flex; flex-direction: column; box-sizing: border-box;
        min-width: 320px; min-height: 180px; border-radius: 12px; overflow: hidden;
        background: #1e1e1e; border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 12px 32px rgba(0, 0, 0, .45);
        color: #f1f1f1; font: 500 13px/1 Roboto, Arial, sans-serif;
      }
      .ytu-tp-win[hidden] { display: none; }
      .ytu-tp-head { display: flex; align-items: center; height: 26px; padding: 0 4px 0 12px; flex: none; cursor: move; user-select: none; }
      .ytu-tp-head span { margin-right: auto; color: rgba(255, 255, 255, .7); font-size: 12px; }
      .ytu-tp-head button {
        width: 22px; height: 22px; padding: 0; border: none; border-radius: 11px; cursor: pointer;
        background: none; color: rgba(255, 255, 255, .7); font-size: 15px;
      }
      .ytu-tp-head button:hover { background: rgba(255, 255, 255, .1); color: #fff; }
      .ytu-tp-win iframe { display: block; flex: 1; width: 100%; min-height: 0; border: 0; background: #fff; }
      .ytu-tp-dragging iframe { pointer-events: none; }
      .ytu-tp-grip { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
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

    // Bar 1 is Count-in & loop's: the tab window shows and moves that one, so it's set in one place.
    const SONG = id => 'ytu:count-in:song:' + id;
    function bar1Ms(id) {
      try {
        const song = JSON.parse(localStorage.getItem(SONG(id)));
        return song && song.start != null ? Math.round(song.start * 1000) : null;
      } catch {
        return null;
      }
    }
    function setBar1(id, ms) {
      const detail = { videoId: id, start: ms / 1000, handled: false };
      document.dispatchEvent(new CustomEvent('ytu:set-bar1', { detail }));
      if (detail.handled) return;
      // Count-in & loop is switched off: keep it in its storage for when it's back.
      let song = {};
      try { song = JSON.parse(localStorage.getItem(SONG(id))) || {}; } catch { /* start fresh */ }
      song.start = detail.start;
      try { localStorage.setItem(SONG(id), JSON.stringify(song)); } catch { /* storage full/blocked */ }
    }

    // content/bridge.js puts the extension's address on the page; this world can't ask for it.
    const playerUrl = () => {
      const base = document.documentElement.dataset.ytuBase;
      return base ? base + 'tabs/player.html' : null;
    };
    const ORIGIN = () => new URL(playerUrl()).origin;

    // -------------------------------------------------------------- window
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };

    let win = null;
    let frame = null;
    let ready = false;
    let videoId = null;

    function place(box) {
      const w = Math.min(Math.max(320, box.w), window.innerWidth);
      const h = Math.min(Math.max(180, box.h), window.innerHeight);
      const x = Math.min(Math.max(0, box.x), window.innerWidth - Math.min(w, 120));
      const y = Math.min(Math.max(0, box.y), window.innerHeight - 26);
      Object.assign(win.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    }
    const savedBox = () => ctx.storage.get('box', null) || { x: window.innerWidth - 680, y: 80, w: 660, h: 420 };
    function boxFromStyle() {
      const r = win.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }

    // Drag by the title bar, resize from the corner. The frame would swallow the pointer while it
    // passes over it, so it ignores the mouse until you let go.
    function dragger(handle, apply) {
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const start = { px: e.clientX, py: e.clientY, ...boxFromStyle() };
        win.classList.add('ytu-tp-dragging');
        const move = ev => place(apply(start, ev.clientX - start.px, ev.clientY - start.py));
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          win.classList.remove('ytu-tp-dragging');
          ctx.storage.set('box', boxFromStyle());
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      });
    }

    function buildWindow() {
      const w = el('div', 'ytu-tp-win');
      w.hidden = true;
      const head = el('div', 'ytu-tp-head');
      const close = el('button', null, '×');
      close.type = 'button';
      close.title = 'Close';
      close.addEventListener('click', e => { e.stopPropagation(); setOpen(false); });
      head.append(el('span', null, 'Tab'), close);
      const grip = el('div', 'ytu-tp-grip');
      w.append(head, grip);
      win = w;
      dragger(head, (b, dx, dy) => ({ ...b, x: b.x + dx, y: b.y + dy }));
      dragger(grip, (b, dx, dy) => ({ ...b, w: b.w + dx, h: b.h + dy }));
      return w;
    }

    function setOpen(open) {
      ctx.storage.set('open', open);
      if (!win) return;
      win.hidden = !open;
      if (!open) {
        if (frame) frame.remove();
        frame = null;
        ready = false;
        return;
      }
      place(savedBox());
      if (!frame && playerUrl()) {
        frame = el('iframe');
        frame.title = 'Tab';
        frame.src = playerUrl();
        win.insertBefore(frame, win.lastChild);
      }
    }
    const isOpen = () => !!win && !win.hidden;

    // -------------------------------------------------------------- talking to the tab window
    function send(msg) {
      if (frame && ready) frame.contentWindow.postMessage(msg, ORIGIN());
    }
    let sentBar1;
    function sendVideo() {
      sentBar1 = videoId ? bar1Ms(videoId) : null;
      send({ type: 'ytu-tp:video', videoId, bar1Ms: sentBar1 });
    }
    function sendTime() {
      const v = video();
      if (!v) return;
      send({
        type: 'ytu-tp:time',
        ms: v.currentTime * 1000,
        paused: v.paused,
        rate: v.playbackRate,
        duration: (v.duration || 0) * 1000,
      });
    }
    const timeTimer = setInterval(() => { if (isOpen()) sendTime(); }, 50);
    disposers.push(() => clearInterval(timeTimer));
    for (const type of ['seeked', 'play', 'pause', 'ratechange']) {
      on(document, type, e => { if (e.target === video()) sendTime(); }, true);
    }

    on(window, 'message', e => {
      if (!frame || e.source !== frame.contentWindow || e.origin !== ORIGIN() || !e.data) return;
      const m = e.data;
      const v = video();
      if (m.type === 'ytu-tp:ready') {
        ready = true;
        sendVideo();
        sendTime();
      } else if (!v) {
        return;
      } else if (m.type === 'ytu-tp:seek') {
        v.currentTime = Math.max(0, m.ms / 1000);
      } else if (m.type === 'ytu-tp:play') {
        v.play();
      } else if (m.type === 'ytu-tp:pause') {
        v.pause();
      } else if (m.type === 'ytu-tp:bar1') {
        if (videoId) setBar1(videoId, m.ms);
        sendVideo();
      } else if (m.type === 'ytu-tp:rate') {
        v.playbackRate = m.rate;
      }
    });

    // Keep the window on screen when the browser window shrinks.
    on(window, 'resize', () => { if (isOpen()) place(boxFromStyle()); });

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
      };
      for (const y of [6, 10, 14, 18]) add('path', { d: `M3 ${y}h18` }); // strings
      add('path', { d: 'M3 6v12M21 6v12' });                            // bar lines
      add('path', { d: 'M9 8.5v7l6-3.5z', fill: '#fff', stroke: '#fff', 'stroke-linejoin': 'round' }); // play mark, unlike the Songsterr button
      return svg;
    }

    function buildButton() {
      const b = el('button', 'ytp-button ytu-tp-btn');
      b.type = 'button';
      b.setAttribute('aria-label', 'Tab');
      b.title = 'Tab';
      b.appendChild(tabIcon());
      b.addEventListener('click', e => { e.stopPropagation(); setOpen(!isOpen()); });
      return b;
    }

    function ensureUi() {
      const p = player();
      if (!isWatch() || !p) {
        if (btn) btn.remove();
        if (win) win.hidden = true;
        return;
      }
      const host = p.querySelector('.ytp-right-controls-left') || p.querySelector('.ytp-right-controls');
      if (host) {
        if (!btn) btn = buildButton();
        if (btn.parentElement !== host) host.insertBefore(btn, host.querySelector('.ytp-settings-button') || host.firstChild);
      }
      if (!win) buildWindow();
      if (win.parentElement !== document.body && document.body) document.body.appendChild(win);
    }

    // -------------------------------------------------------------- page tracking
    function poll() {
      const id = isWatch() ? currentVideoId() : null;
      ensureUi();
      if (id !== videoId) {
        videoId = id;
        // The window stays open from video to video if you left it open.
        if (id && win && win.hidden && ctx.storage.get('open', false)) setOpen(true);
        sendVideo();
      } else if (videoId && ready && bar1Ms(videoId) !== sentBar1) {
        sendVideo(); // bar 1 moved in Count-in & loop
      }
    }
    const timer = setInterval(poll, 500);
    on(document, 'yt-navigate-finish', poll);
    poll();

    return () => {
      clearInterval(timer);
      for (const d of disposers) d();
      if (btn) btn.remove();
      if (win) win.remove();
    };
  },
});
