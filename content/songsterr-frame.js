// Runs on songsterr.com, but only inside the tab window that modules/songsterr.js opens from YouTube.
// It hides everything but the tab and moves Songsterr's cursor to the bar YouTube asks for, so the
// tab follows the video.
//
// Songsterr's markup is theirs and changes; every selector it depends on is in SEL below.
(() => {
  const NAME = 'ytu-songsterr'; // window name modules/songsterr.js gives the frame or popup
  const host = window.opener;
  if (window.name !== NAME || !host) return;
  const YT_ORIGIN = 'https://www.youtube.com';

  const SEL = {
    // Everything around the tab: header, ad banner, nav bar, side panels, player toolbar, popups.
    chrome: [
      '#header', '#showroom', '#promo', '#tablist', '[class*="_bottomBarWide"]', '[class*="_sidebar"]',
      'main[id^="panel-"]', '#controls', '[data-controls-top-panel]', '[data-id="notification"]',
      '[class*="_controlsBlocker"]', '[class*="_controlsBlurOverlay"]', '[class*="_tabBlurOverlay"]',
    ],
    tablature: '#tablature, [data-testid="tablature"]',
    toStart: '#to-tab-start',
    play: '#control-play', // aria-pressed="true" while Songsterr itself is playing
  };

  const style = document.createElement('style');
  style.textContent = `
    html.ytu-tab-only :is(${SEL.chrome.join(', ')}) { display: none !important; }
    html.ytu-tab-only, html.ytu-tab-only body { --controls-panel-width-plus-paddings: 0px; }
  `;
  document.documentElement.classList.add('ytu-tab-only');
  (document.head || document.documentElement).appendChild(style);

  // -------------------------------------------------------------- cursor
  // Songsterr moves its cursor one bar with the arrow keys; the start button (or Home) puts it on bar 1.
  // We don't read where the cursor is, so we keep count ourselves: `bar` is where we last put it,
  // null when we don't know (a fresh page, or you clicked in the tab).
  let bar = null;

  function key(k, code, keyCode) {
    const target = document.activeElement && document.activeElement !== document.documentElement ? document.activeElement : document.body;
    for (const type of ['keydown', 'keyup']) {
      const e = new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true, composed: true });
      // Older handlers read keyCode, which the constructor can't set.
      Object.defineProperty(e, 'keyCode', { get: () => keyCode });
      Object.defineProperty(e, 'which', { get: () => keyCode });
      target.dispatchEvent(e);
    }
  }

  function pauseSongsterr() {
    const play = document.querySelector(SEL.play);
    if (play && play.getAttribute('aria-pressed') === 'true') play.click();
  }

  function toStart() {
    const btn = document.querySelector(SEL.toStart);
    if (btn) btn.click();
    else key('Home', 'Home', 36);
    bar = 1;
  }

  function goTo(target) {
    if (!document.body) return;
    pauseSongsterr(); // the cursor follows YouTube, not Songsterr's own playback
    if (bar == null || Math.abs(target - bar) > 64) toStart();
    while (bar < target) { key('ArrowRight', 'ArrowRight', 39); bar++; }
    while (bar > target) { key('ArrowLeft', 'ArrowLeft', 37); bar--; }
  }

  // A click in the tab moves the cursor somewhere we can't see, so start counting afresh next time.
  document.addEventListener('mousedown', () => { bar = null; }, true);

  // -------------------------------------------------------------- messages from YouTube
  window.addEventListener('message', e => {
    if (e.source !== host || e.origin !== YT_ORIGIN) return;
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ytu-tab:config') {
      document.documentElement.classList.toggle('ytu-tab-only', !!msg.tabOnly);
    } else if (msg.type === 'ytu-tab:goto' && Number.isInteger(msg.bar) && msg.bar >= 1) {
      goTo(msg.bar);
    } else if (msg.type === 'ytu-tab:reset') {
      bar = null;
    }
  });

  // Tell YouTube we're here (it uses this to know the page loaded), and again once the tab has rendered:
  // arrow keys sent before Songsterr built its cursor are lost, so YouTube re-sends the bar.
  const hello = () => { bar = null; host.postMessage({ type: 'ytu-tab:ready' }, YT_ORIGIN); };
  hello();
  let waited = 0;
  const waitForTab = setInterval(() => {
    waited += 250;
    if (document.querySelector(SEL.tablature) || waited >= 5000) {
      clearInterval(waitForTab);
      hello();
    }
  }, 250);
})();
