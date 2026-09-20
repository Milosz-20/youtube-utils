// Locks the Shorts player to the Short you opened: no swiping, no arrow keys, no auto-advance.
YTU.register({
  id: 'shorts-lock-player',
  name: 'One Short at a time',
  description: 'Opening a Short plays only that one. Scrolling, swiping, the arrow keys and auto-advance can\'t move to the next Short, and no neighbouring Short peeks in at the bottom of the screen.',

  // boot.js puts this in at document_start, before YouTube has drawn anything.
  css: `
    ytd-shorts .navigation-container,
    ytd-shorts #navigation-button-up,
    ytd-shorts #navigation-button-down { display: none !important; }
    ytd-shorts #shorts-inner-container {
      overflow: hidden !important;
      /* Vertical only: "none" and "touch-action: none" also switch off the browser's sideways
         swipe-to-go-back, which is how you leave a Short. */
      overscroll-behavior-y: none !important;
      touch-action: pan-x !important;
    }
    /* Our own way out, since the Shorts player has no exit button of its own. */
    .ytu-shorts-exit {
      position: fixed; z-index: 2500;
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; padding: 0;
      border: none; border-radius: 50%;
      background: rgba(255, 255, 255, .12); color: #fff;
      font: 400 22px/1 Roboto, Arial, sans-serif; cursor: pointer;
    }
    .ytu-shorts-exit:hover { background: rgba(255, 255, 255, .24); }
    /* For about a second the Short plays in #initial-player-container, where the rounded corners
       belong to the container and the video sits inside it unclipped — so it starts off square.
       Round the video itself until the real slot takes over. */
    ytd-shorts #initial-player-container video,
    ytd-shorts #initial-player-container .html5-video-player {
      border-radius: 12px;
      overflow: hidden;
    }
    /* The player stacks Shorts in slots, so the next one peeks in at the bottom. Show one slot only.
       Until the script has picked one, that's slot 0 — the Short the player starts on. */
    ytd-shorts #shorts-inner-container:not([data-ytu-picked]) > .reel-video-in-sequence-new:not([id="0"]),
    ytd-shorts #shorts-inner-container[data-ytu-picked] > .reel-video-in-sequence-new:not([data-ytu-current]) {
      visibility: hidden !important;
    }`,

  run(ctx) {
    const def = this; // boot.js calls def.run(ctx), so `this` is this definition
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    const style = document.createElement('style');
    style.id = 'ytu-shorts-lock-style';
    style.textContent = def.css;
    (document.head || document.documentElement).appendChild(style);
    disposers.push(() => style.remove());

    // -------------------------------------------------------------- the locked Short
    let lockedId = null;
    const shortIdFromUrl = () => (location.pathname.match(/^\/shorts\/([\w-]+)/) || [])[1] || null;

    function updateLock() {
      const id = shortIdFromUrl();
      if (!id) { lockedId = null; return; }
      if (!lockedId) { lockedId = id; return; }
      if (id !== lockedId) {
        // Something moved the player to another Short — send it back.
        for (const v of document.querySelectorAll('ytd-shorts video')) v.pause();
        location.replace('/shorts/' + lockedId);
      }
    }

    // -------------------------------------------------------------- one visible slot
    const container = () => document.querySelector('ytd-shorts #shorts-inner-container');
    const slotsOf = box => (box ? [...box.children].filter(k => k.classList.contains('reel-video-in-sequence-new')) : []);

    // Marks the slot centred on screen; the stylesheet hides every other one.
    function pickCurrent() {
      const box = container();
      if (!box) return;
      const all = slotsOf(box);
      // Fast path: the slot we already marked is still the one on screen. One rect instead of ~30,
      // which matters because this runs on every frame the player mutates something.
      const marked = box.querySelector('.reel-video-in-sequence-new[data-ytu-current]');
      if (marked && marked.parentElement === box) {
        const m = marked.getBoundingClientRect();
        if (m.height && Math.abs((m.top + m.bottom) / 2 - innerHeight / 2) < m.height / 2) return;
      }
      const mid = innerHeight / 2;
      let current = null, best = Infinity;
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < best) { best = d; current = el; }
      }
      for (const el of all) el.toggleAttribute('data-ytu-current', el === current);
      // With nothing picked the stylesheet falls back to slot 0 instead of hiding the lot.
      box.toggleAttribute('data-ytu-picked', !!current);
    }

    function clearMarks() {
      const box = container();
      if (box) box.removeAttribute('data-ytu-picked');
      for (const el of slotsOf(box)) {
        el.removeAttribute('data-ytu-current');
        el.style.visibility = ''; // left over from older versions
      }
    }

    // The slots are built and moved around while the player boots. Re-pick in the same frame,
    // before the browser paints, so a neighbouring Short is never visible.
    let frame = 0;
    function schedulePick() {
      if (frame || !shortIdFromUrl()) return;
      frame = requestAnimationFrame(() => { frame = 0; pickCurrent(); ensureExit(); });
    }

    let observing = false;
    const observer = new MutationObserver(schedulePick);
    function syncObserver() {
      const onShort = !!shortIdFromUrl();
      if (onShort === observing) return;
      observing = onShort;
      if (onShort) observer.observe(document.documentElement, { childList: true, subtree: true });
      else { observer.disconnect(); clearMarks(); }
    }
    disposers.push(() => observer.disconnect());

    on(window, 'scroll', schedulePick, true);
    on(window, 'resize', schedulePick);

    // -------------------------------------------------------------- the way out
    let exitBtn = null;

    function leave() {
      const from = location.href;
      history.back();
      // Opened straight into a Short (new tab, pasted link): there is no feed to go back to.
      setTimeout(() => { if (location.href === from) location.assign('/'); }, 400);
    }

    function ensureExit() {
      const slot = document.querySelector('ytd-shorts #shorts-inner-container > .reel-video-in-sequence-new[data-ytu-current]')
        || document.querySelector('ytd-shorts #shorts-inner-container > .reel-video-in-sequence-new')
        || document.querySelector('ytd-shorts #initial-player-container');
      if (!shortIdFromUrl() || !slot) {
        if (exitBtn) { exitBtn.remove(); exitBtn = null; }
        return;
      }
      if (!exitBtn) {
        exitBtn = document.createElement('button');
        exitBtn.className = 'ytu-shorts-exit';
        exitBtn.type = 'button';
        exitBtn.title = 'Back to the feed (Esc)';
        exitBtn.setAttribute('aria-label', 'Back to the feed');
        exitBtn.textContent = '←';
        exitBtn.addEventListener('click', e => { e.stopPropagation(); leave(); });
      }
      if (exitBtn.parentElement !== document.body) document.body.appendChild(exitBtn);
      // Beside the Short, not on top of YouTube's own controls.
      const r = slot.getBoundingClientRect();
      const left = Math.max(12, Math.round(r.left) - 56) + 'px';
      const top = Math.max(72, Math.round(r.top) + 12) + 'px';
      if (exitBtn.style.left !== left) exitBtn.style.left = left;
      if (exitBtn.style.top !== top) exitBtn.style.top = top;
    }

    // -------------------------------------------------------------- input blocking
    const inTextField = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    function blockScroll(e) {
      if (!shortIdFromUrl()) return;
      const t = e.target;
      // Comments / description panels keep scrolling normally.
      if (t.closest && t.closest('#shorts-panel-container, ytd-engagement-panel-section-list-renderer')) return;
      // Only vertical scrolling moves to the next Short. Sideways is the touchpad's back gesture,
      // which is the way out of a Short — blocking it traps you on the page.
      if (e.type === 'wheel' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function blockKeys(e) {
      if (!shortIdFromUrl() || inTextField(e.target)) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    function exitKey(e) {
      if (e.key !== 'Escape' || !shortIdFromUrl() || inTextField(e.target) || document.fullscreenElement) return;
      leave();
    }

    on(window, 'keydown', exitKey, true);
    on(window, 'wheel', blockScroll, { capture: true, passive: false });
    on(window, 'touchmove', blockScroll, { capture: true, passive: false });
    on(window, 'keydown', blockKeys, true);

    // -------------------------------------------------------------- navigation loop
    let lastHref = null;
    function tick() {
      syncObserver();
      schedulePick();
      ensureExit();
      if (location.href === lastHref) return;
      lastHref = location.href;
      updateLock();
    }

    const interval = setInterval(tick, 200);
    disposers.push(() => clearInterval(interval));
    on(document, 'yt-navigate-finish', tick);
    tick();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const d of disposers) d();
      clearMarks();
      if (exitBtn) { exitBtn.remove(); exitBtn = null; }
    };
  },
});
