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
      .ytu-tp-edge { position: absolute; z-index: 1; }
      .ytu-tp-edge[data-e="l"] { left: 0; top: 26px; bottom: 0; width: 6px; cursor: ew-resize; }
      .ytu-tp-edge[data-e="r"] { right: 0; top: 26px; bottom: 0; width: 6px; cursor: ew-resize; }
      .ytu-tp-edge[data-e="b"] { left: 0; right: 0; bottom: 0; height: 6px; cursor: ns-resize; }
      .ytu-tp-edge[data-e="lb"] { left: 0; bottom: 0; width: 16px; height: 16px; cursor: nesw-resize; }
      .ytu-tp-max .ytu-tp-edge { display: none; }
      .ytu-tp-grip { position: absolute; z-index: 2; right: 0; bottom: 0; width: 20px; height: 20px; cursor: nwse-resize;
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
    const ui = {};
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
    // Maximised: the whole browser window bar a small margin, until you restore it.
    const fullBox = () => ({ x: 12, y: 12, w: window.innerWidth - 24, h: window.innerHeight - 24 });
    const isMax = () => !!ctx.storage.get('max', false);
    function markMax(max) {
      ctx.storage.set('max', max);
      win.classList.toggle('ytu-tp-max', max);
      ui.maxBtn.textContent = max ? '❐' : '□';
      ui.maxBtn.title = max ? 'Restore' : 'Maximise (or double-click the title bar)';
    }
    function setMax(max) {
      markMax(max);
      place(max ? fullBox() : savedBox());
    }
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
        let moved = false;
        const move = ev => {
          const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; // a click (or double-click), not a drag
          moved = true;
          place(apply(start, dx, dy));
        };
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          win.classList.remove('ytu-tp-dragging');
          if (!moved) return;
          if (isMax()) markMax(false); // dragged out of the maximised window: it stays where you left it
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
      close.title = 'Hide (H)';
      close.addEventListener('click', e => { e.stopPropagation(); setOpen(false); });
      ui.maxBtn = el('button', null, '□');
      ui.maxBtn.type = 'button';
      ui.maxBtn.addEventListener('click', e => { e.stopPropagation(); setMax(!isMax()); });
      head.addEventListener('dblclick', e => { if (!e.target.closest('button')) setMax(!isMax()); });
      head.append(el('span', null, 'Tab'), ui.maxBtn, close);
      const grip = el('div', 'ytu-tp-grip');
      // Resize from either side, the bottom, or the bottom corners.
      const edges = ['l', 'r', 'b', 'lb'].map(e => { const d = el('div', 'ytu-tp-edge'); d.dataset.e = e; return d; });
      w.append(head, ...edges, grip);
      win = w;
      dragger(head, (b, dx, dy) => ({ ...b, x: b.x + dx, y: b.y + dy }));
      dragger(grip, (b, dx, dy) => ({ ...b, w: b.w + dx, h: b.h + dy }));
      const fromLeft = (b, dx) => { const nw = Math.max(320, b.w - dx); return { x: b.x + b.w - nw, w: nw }; };
      dragger(edges[0], (b, dx) => ({ ...b, ...fromLeft(b, dx) }));
      dragger(edges[1], (b, dx) => ({ ...b, w: b.w + dx }));
      dragger(edges[2], (b, dx, dy) => ({ ...b, h: b.h + dy }));
      dragger(edges[3], (b, dx, dy) => ({ ...b, ...fromLeft(b, dx), h: b.h + dy }));
      return w;
    }

    function setOpen(open) {
      ctx.storage.set('open', open);
      if (!win) return;
      win.hidden = !open;
      // Hidden, not closed: the tab stays loaded, so it's back at once.
      if (!open) {
        // Keys pressed in the hidden frame would go nowhere; hand them back to the player.
        if (frame && document.activeElement === frame) (player() || document.body).focus({ preventScroll: true });
        return;
      }
      setMax(isMax());
      if (!frame && playerUrl()) {
        frame = el('iframe');
        frame.title = 'Tab';
        frame.src = playerUrl();
        win.insertBefore(frame, win.children[1]);
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
      } else if (m.type === 'ytu-tp:toggle') {
        setOpen(false);
      } else if (m.type === 'ytu-tp:key') {
        pageKey(m);
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

    // H shows or hides the window. Its keys only reach this page; the tab window sends its own here.
    on(window, 'keydown', e => {
      if (e.key !== 'h' && e.key !== 'H' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !isWatch()) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(!isOpen());
    }, true);

    // Keys pressed while the tab window has focus. Play/pause and seeking are done here, since YouTube
    // may ignore made-up key presses; the rest (Count-in's G, R, [ ] and so on) is passed on as one.
    function pageKey(m) {
      const v = video();
      if (!v) return;
      const k = m.key.length === 1 ? m.key.toLowerCase() : m.key;
      const plain = !m.ctrlKey && !m.metaKey && !m.altKey && !m.shiftKey;
      if (plain && (k === ' ' || k === 'k')) { if (v.paused) v.play(); else v.pause(); return; }
      const seek = plain && { arrowleft: -5, arrowright: 5, j: -10, l: 10 }[k.toLowerCase()];
      if (seek) { v.currentTime = Math.max(0, v.currentTime + seek); return; }
      const ev = new KeyboardEvent('keydown', { ...m, bubbles: true, cancelable: true });
      (document.activeElement && document.activeElement !== frame ? document.activeElement : document.body).dispatchEvent(ev);
    }

    // Keep the window on screen when the browser window shrinks.
    on(window, 'resize', () => { if (isOpen()) place(isMax() ? fullBox() : boxFromStyle()); });

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
      add('path', { d: 'M9 8.5v7l6-3.5z', fill: '#fff', stroke: '#fff', 'stroke-linejoin': 'round' }); // play mark
      return svg;
    }

    function buildButton() {
      const b = el('button', 'ytp-button ytu-tp-btn');
      b.type = 'button';
      b.setAttribute('aria-label', 'Tab');
      b.title = 'Tab (H)';
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
