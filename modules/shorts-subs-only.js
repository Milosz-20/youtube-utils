// Shorts from subscriptions only, or no Shorts at all.
YTU.register({
  id: 'shorts-subs-only',
  name: 'Shorts filter',
  description: 'Show Shorts only from channels you follow, or turn them off completely. Feeds, search results and the sidebar are filtered; the Subscriptions feed and channel pages are left alone.',
  settings: {
    mode: {
      type: 'select',
      label: 'Mode',
      default: 'subs',
      popup: true,
      options: [
        { value: 'subs', label: 'Subscriptions only' },
        { value: 'off', label: 'Hide all' },
      ],
    },
    filterFeeds: { type: 'boolean', label: 'Hide Shorts from channels I don\'t follow (Home, search, sidebar)', default: true },
    hideShortsTab: { type: 'boolean', label: 'Hide the "Shorts" tab in the sidebar', default: true },
    cacheHours: { type: 'number', label: 'Refresh subscription list every (hours)', default: 12, min: 1, max: 168, step: 1 },
    refreshSubs: { type: 'action', label: 'Refresh subscription list now' },
  },

  // Also used by boot.js at document_start, from the settings it saw last time.
  css(s) {
    // Not on the pages you open on purpose, and not when the subscription list failed to load
    // ("data-ssf-nosubs") — without it we can't tell a subscribed Short from any other, and
    // hiding every Short is worse than showing them.
    const NOT_FEED = 'html:not([data-ssf-feed]):not([data-ssf-nosubs])';
    const hide = ['[data-ssf-hidden]'];
    if (s.filterFeeds) {
      // Cards stay hidden until verified, so random Shorts never flash on screen.
      hide.push(
        `${NOT_FEED} ytm-shorts-lockup-view-model:not([data-ssf-ok])`,
        `${NOT_FEED} ytm-shorts-lockup-view-model-v2:not([data-ssf-ok])`,
        // Shorts shelves stay hidden until every card in them has been checked, so the row
        // doesn't appear empty, vanish and come back. "settled" is set by updateShelves();
        // hiding by its absence means the rule already holds on the very first frame.
        `${NOT_FEED} ytd-rich-section-renderer:has(a[href^="/shorts/"]):not([data-ssf-settled])`,
        `${NOT_FEED} ytd-reel-shelf-renderer:not([data-ssf-settled])`,
        `${NOT_FEED} grid-shelf-view-model:has(a[href^="/shorts/"]):not([data-ssf-settled])`,
      );
    }
    if (s.hideShortsTab) {
      hide.push('ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]');
    }
    if (s.mode === 'off') {
      // Everywhere, including the Subscriptions feed and channel pages.
      hide.push(
        'ytm-shorts-lockup-view-model',
        'ytm-shorts-lockup-view-model-v2',
        'ytd-reel-shelf-renderer',
        'ytd-rich-shelf-renderer[is-shorts]',
        'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
        'grid-shelf-view-model:has(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)',
        'ytd-guide-entry-renderer:has(a[title="Shorts"])',
        'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
        'yt-tab-shape[tab-title="Shorts"]',
      );
    }
    return `${hide.join(',\n')} { display: none !important; }`;
  },

  run(ctx) {
    const def = this; // boot.js calls def.run(ctx), so `this` is this definition
    const s = ctx.settings;
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    // -------------------------------------------------------------- CSS
    // "data-ssf-feed" marks pages where you look at Shorts on purpose:
    // the Subscriptions feed and channel pages. Filtering is skipped there.
    const style = document.createElement('style');
    style.id = 'ytu-shorts-style';
    (document.head || document.documentElement).appendChild(style);
    disposers.push(() => style.remove());

    function renderCss() { style.textContent = def.css(s); }

    // -------------------------------------------------------------- helpers
    // Normalises a channel URL/path to "/@handle" or "/channel/uc..." etc.
    function normPath(u) {
      try {
        const p = decodeURIComponent(new URL(u, location.origin).pathname).toLowerCase();
        const seg = p.split('/').filter(Boolean);
        if (!seg.length) return '';
        if (seg[0].startsWith('@')) return '/' + seg[0];
        return '/' + seg.slice(0, 2).join('/');
      } catch {
        return '';
      }
    }

    // Pulls a JSON object literal that follows `marker` out of an HTML page.
    function extractJson(text, marker) {
      let i = text.indexOf(marker);
      if (i < 0) return null;
      i = text.indexOf('{', i);
      let depth = 0, inStr = false, esc = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return JSON.parse(text.slice(i, j + 1));
      }
      return null;
    }

    async function apiHeaders() {
      const h = { 'Content-Type': 'application/json', 'X-Origin': location.origin, 'X-Goog-AuthUser': '0' };
      const m = document.cookie.match(/(?:^|;\s*)SAPISID=([^;]+)/) ||
                document.cookie.match(/(?:^|;\s*)__Secure-3PAPISID=([^;]+)/);
      if (m) {
        const ts = Math.floor(Date.now() / 1000);
        const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${m[1]} ${location.origin}`));
        const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
        h.Authorization = `SAPISIDHASH ${ts}_${hex}`;
      }
      return h;
    }

    // Walks YouTube's JSON, collecting channel ids/handles/names. Returns a continuation token if any.
    function collect(root, keys, names) {
      let token = null;
      const stack = [root];
      while (stack.length) {
        const o = stack.pop();
        if (!o || typeof o !== 'object') continue;
        if (Array.isArray(o)) { for (const v of o) stack.push(v); continue; }

        const be = o.browseEndpoint;
        if (be && typeof be.browseId === 'string' && be.browseId.startsWith('UC')) {
          keys.add('/channel/' + be.browseId.toLowerCase());
          if (be.canonicalBaseUrl) keys.add(normPath(be.canonicalBaseUrl));
        }
        if (typeof o.channelId === 'string' && o.channelId.startsWith('UC')) {
          keys.add('/channel/' + o.channelId.toLowerCase());
          const t = o.title && (o.title.simpleText || (o.title.runs || []).map(r => r.text).join(''));
          if (t) names.add(t.trim().toLowerCase());
        }
        if (o.continuationCommand && o.continuationCommand.token) token = o.continuationCommand.token;

        for (const k in o) stack.push(o[k]);
      }
      return token;
    }

    // -------------------------------------------------------------- subscriptions
    let subs = null; // { keys:Set, names:Set, ts }
    let fetching = null;
    const toRuntime = c => ({ keys: new Set(c.keys), names: new Set(c.names), ts: c.ts });
    const ttl = () => s.cacheHours * 60 * 60 * 1000;

    async function fetchSubs() {
      const html = await (await fetch('/feed/channels', { credentials: 'include' })).text();
      const data = extractJson(html, 'var ytInitialData = ') || extractJson(html, 'window["ytInitialData"] = ');
      if (!data) throw new Error('could not read /feed/channels — are you logged in?');

      const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
      const clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20260901.00.00';

      const keys = new Set(), names = new Set();
      let token = collect(data.contents, keys, names);

      for (let page = 0; token && page < 200; page++) {
        const res = await fetch(`/youtubei/v1/browse?prettyPrint=false${apiKey ? '&key=' + apiKey : ''}`, {
          method: 'POST',
          credentials: 'include',
          headers: await apiHeaders(),
          body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'en' } }, continuation: token }),
        });
        if (!res.ok) break;
        const j = await res.json();
        token = collect(j.onResponseReceivedActions || j.continuationContents || [], keys, names);
      }

      keys.delete('');
      if (!keys.size) throw new Error('no subscriptions found — are you logged in?');
      const c = { keys: [...keys], names: [...names], ts: Date.now() };
      ctx.storage.set('subs', c);
      ctx.log(`loaded ${names.size || keys.size} subscribed channels`);
      return toRuntime(c);
    }

    function getSubs(force = false) {
      if (!force && subs && Date.now() - subs.ts < ttl()) return Promise.resolve(subs);
      const cached = ctx.storage.get('subs');
      if (!force && cached && cached.keys && Date.now() - cached.ts < ttl()) {
        return Promise.resolve(subs = toRuntime(cached));
      }
      if (!fetching) {
        fetching = fetchSubs()
          .then(r => { subsFailed(false); return (subs = r); })
          .catch(err => {
            // Stale list is better than nothing.
            if (cached && cached.keys) { subsFailed(false); return (subs = toRuntime(cached)); }
            subsFailed(true, err);
            throw err;
          })
          .finally(() => { fetching = null; scheduleFilter(); });
      }
      return fetching;
    }

    const NOSUBS = 'data-ssf-nosubs';
    function subsFailed(failed, err) {
      if (document.documentElement.hasAttribute(NOSUBS) === failed) return;
      document.documentElement.toggleAttribute(NOSUBS, failed);
      if (failed) ctx.log('showing Shorts unfiltered: ' + (err ? err.message : 'no subscription list'));
      resetCards();
      scheduleFilter();
    }

    const isSubscribed = (owner, list) =>
      !!owner && !!list && ((owner.key && list.keys.has(owner.key)) || (owner.name && list.names.has(owner.name)));

    // -------------------------------------------------------------- short owner lookup
    const ownerCache = new Map();
    const oembedPending = new Map();

    // Looks up a video's channel via YouTube's oEmbed endpoint. Cached; failures aren't cached.
    function oembedOwner(id) {
      if (ownerCache.has(id)) return Promise.resolve(ownerCache.get(id));
      if (oembedPending.has(id)) return oembedPending.get(id);
      const p = fetch('/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/shorts/' + id))
        .then(r => (r.ok ? r.json() : null))
        .then(j => {
          if (!j) return null;
          const owner = { key: normPath(j.author_url || ''), name: (j.author_name || '').trim().toLowerCase() };
          ownerCache.set(id, owner);
          return owner;
        })
        .catch(() => null)
        .finally(() => oembedPending.delete(id));
      oembedPending.set(id, p);
      return p;
    }

    const shortIdFromUrl = () => (location.pathname.match(/^\/shorts\/([\w-]+)/) || [])[1] || null;

    // -------------------------------------------------------------- feed filtering
    // Every Short card is checked individually: kept if it's from a subscription, hidden otherwise.
    const WRAPPER_SEL = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer';
    const LOCKUP_SEL = 'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, yt-lockup-view-model';
    const SHELF_SEL = 'ytd-rich-section-renderer, ytd-reel-shelf-renderer, grid-shelf-view-model';

    const cardOf = a => a.closest(WRAPPER_SEL) || a.closest('ytm-shorts-lockup-view-model-v2') || a.closest(LOCKUP_SEL);

    // Lockups are nested (…-v2 > …), so mark every level, not just the nearest one.
    function setItemState(item, lockup, keep) {
      item.toggleAttribute('data-ssf-hidden', !keep);
      const lockups = [...item.querySelectorAll(LOCKUP_SEL)];
      if (item.matches(LOCKUP_SEL)) lockups.push(item);
      for (let el = lockup; el && el !== item; el = el.parentElement) {
        if (el.matches(LOCKUP_SEL)) lockups.push(el);
      }
      for (const l of lockups) l.toggleAttribute('data-ssf-ok', keep);
    }

    function filterItems() {
      const off = s.mode === 'off';
      if (shortIdFromUrl()) return;
      if (!off && (!s.filterFeeds || document.documentElement.hasAttribute('data-ssf-feed'))) return;

      for (const a of document.querySelectorAll('a[href^="/shorts/"]')) {
        const lockup = a.closest(LOCKUP_SEL);
        const item = cardOf(a);
        if (!item) continue;
        const id = (a.getAttribute('href').match(/^\/shorts\/([\w-]+)/) || [])[1];
        if (!id) continue;

        // YouTube recycles cards, so re-check whenever the card's video changes.
        if (item.dataset.ssfId === id && item.dataset.ssfDone) continue;
        item.dataset.ssfId = id;
        delete item.dataset.ssfDone;

        if (off) { setItemState(item, lockup, false); item.dataset.ssfDone = '1'; continue; }
        // Hide until verified, unless the list failed to load — then nothing is going to verify them.
        if (!subs) { if (!document.documentElement.hasAttribute(NOSUBS)) setItemState(item, lockup, false); continue; }

        const ch = item.querySelector('a[href^="/@"], a[href^="/channel/"]');
        if (ch) {
          const owner = { key: normPath(ch.getAttribute('href')), name: ch.textContent.trim().toLowerCase() };
          setItemState(item, lockup, isSubscribed(owner, subs));
          item.dataset.ssfDone = '1';
          continue;
        }

        // Shelf cards usually don't include the channel, so look it up.
        setItemState(item, lockup, false);
        oembedOwner(id).then(owner => {
          if (stopped || item.dataset.ssfId !== id) return;
          setItemState(item, lockup, isSubscribed(owner, subs));
          item.dataset.ssfDone = '1';
          updateShelves();
        });
      }
      updateShelves();
    }

    // Hides a Shorts shelf once none of its cards are left visible.
    // Cards resolve one at a time — the ones without a channel link need a lookup — so a shelf would
    // visibly grow card by card. Hold it back until they're all done; SETTLE_MS caps the wait so one
    // stuck lookup can't hide a shelf for good.
    const SETTLE_MS = 4000;
    let settleTimer = null;

    function updateShelves() {
      let waiting = false;
      for (const shelf of document.querySelectorAll(SHELF_SEL)) {
        const cards = [...shelf.querySelectorAll('a[href^="/shorts/"]')].map(cardOf).filter(Boolean);
        if (!cards.length) continue;
        shelf.toggleAttribute('data-ssf-hidden', cards.every(c => c.hasAttribute('data-ssf-hidden')));
        if (!shelf.dataset.ssfSince) shelf.dataset.ssfSince = String(Date.now());
        const settled = cards.every(c => c.dataset.ssfDone) || Date.now() - Number(shelf.dataset.ssfSince) >= SETTLE_MS;
        shelf.toggleAttribute('data-ssf-settled', settled);
        waiting = waiting || !settled;
      }
      if (waiting && !settleTimer) settleTimer = setTimeout(() => { settleTimer = null; updateShelves(); }, 250);
    }

    // Removes every mark this module put on the page.
    function resetCards() {
      for (const el of document.querySelectorAll('[data-ssf-hidden], [data-ssf-ok], [data-ssf-id], [data-ssf-settled]')) {
        el.removeAttribute('data-ssf-hidden');
        el.removeAttribute('data-ssf-ok');
        el.removeAttribute('data-ssf-settled');
        delete el.dataset.ssfId;
        delete el.dataset.ssfDone;
        delete el.dataset.ssfSince;
      }
    }

    let filterTimer = null;
    function scheduleFilter() {
      if (filterTimer) return;
      filterTimer = setTimeout(() => { filterTimer = null; filterItems(); }, 200);
    }

    // -------------------------------------------------------------- navigation loop
    function updatePageFlags() {
      const p = location.pathname;
      const feed = p.startsWith('/feed/subscriptions') || /^\/(@|channel\/|c\/|user\/)/.test(p);
      document.documentElement.toggleAttribute('data-ssf-feed', feed);
    }

    let stopped = false;
    let lastHref = null;
    function tick() {
      const sid = shortIdFromUrl();
      // Shorts off: a Shorts link opens as a normal video instead of the Shorts player.
      if (s.mode === 'off' && sid) { location.replace('/watch?v=' + sid); return; }
      if (location.href === lastHref) return;
      lastHref = location.href;
      updatePageFlags();
      scheduleFilter();
    }

    const interval = setInterval(tick, 200);
    disposers.push(() => clearInterval(interval));
    on(document, 'yt-navigate-finish', tick);

    let observer = null;
    function observe() {
      observer = new MutationObserver(scheduleFilter);
      observer.observe(document.body, { childList: true, subtree: true });
      tick();
    }
    if (document.body) observe();
    else on(document, 'DOMContentLoaded', observe, { once: true });
    disposers.push(() => observer && observer.disconnect());

    renderCss();
    if (s.mode === 'subs') getSubs().catch(err => ctx.log(err.message));

    ctx.onChange(changed => {
      renderCss();
      if (changed.includes('mode')) {
        resetCards();
        scheduleFilter();
        if (s.mode === 'subs') getSubs().catch(err => ctx.log(err.message));
      }
      if (changed.includes('refreshSubs')) getSubs(true).catch(err => ctx.log(err.message));
      if (changed.includes('filterFeeds')) { resetCards(); scheduleFilter(); }
    });

    return () => {
      stopped = true;
      clearTimeout(filterTimer);
      clearTimeout(settleTimer);
      for (const d of disposers) d();
      resetCards();
      document.documentElement.removeAttribute(NOSUBS);
      document.documentElement.removeAttribute('data-ssf-feed');
    };
  },
});
