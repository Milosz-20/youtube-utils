// Locks the Shorts player to the Short you opened: no swiping, no arrow keys, no auto-advance.
YTU.register({
  id: 'shorts-lock-player',
  name: 'Lock Shorts player',
  description: 'Opening a Short plays only that one. Scrolling, swiping, the arrow keys and auto-advance can\'t move to the next Short, and no neighbouring Short peeks in at the bottom of the screen.',

  run(ctx) {
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    // -------------------------------------------------------------- CSS
    const style = document.createElement('style');
    style.id = 'ytu-shorts-lock-style';
    style.textContent = `
      ytd-shorts .navigation-container,
      ytd-shorts #navigation-button-up,
      ytd-shorts #navigation-button-down { display: none !important; }
      ytd-shorts #shorts-inner-container {
        overflow: hidden !important;
        overscroll-behavior: none !important;
        touch-action: none !important;
      }`;
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

    // The player stacks Shorts in slots, so the next one peeks in at the bottom.
    // Hide every slot except the one centred on screen.
    function slots() {
      const box = document.querySelector('ytd-shorts #shorts-inner-container');
      return box ? [...box.children].filter(k => k.classList.contains('reel-video-in-sequence-new') || /^\d+$/.test(k.id)) : [];
    }

    function hideNeighbours() {
      const all = slots();
      const mid = innerHeight / 2;
      let current = null, best = Infinity;
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < best) { best = d; current = el; }
      }
      for (const el of all) {
        const v = el === current ? '' : 'hidden';
        if (el.style.visibility !== v) el.style.visibility = v;
      }
    }

    function showNeighbours() {
      for (const el of slots()) el.style.visibility = '';
    }

    // -------------------------------------------------------------- input blocking
    const inTextField = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    function blockScroll(e) {
      if (!shortIdFromUrl()) return;
      const t = e.target;
      // Comments / description panels keep scrolling normally.
      if (t.closest && t.closest('#shorts-panel-container, ytd-engagement-panel-section-list-renderer')) return;
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

    on(window, 'wheel', blockScroll, { capture: true, passive: false });
    on(window, 'touchmove', blockScroll, { capture: true, passive: false });
    on(window, 'keydown', blockKeys, true);

    // -------------------------------------------------------------- navigation loop
    let lastHref = null;
    function tick() {
      if (shortIdFromUrl()) hideNeighbours();
      if (location.href === lastHref) return;
      lastHref = location.href;
      updateLock();
    }

    const interval = setInterval(tick, 200);
    disposers.push(() => clearInterval(interval));
    on(document, 'yt-navigate-finish', tick);
    tick();

    return () => {
      for (const d of disposers) d();
      showNeighbours();
    };
  },
});
