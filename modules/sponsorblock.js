// SponsorBlock: skips (or offers to skip) sponsor segments submitted by the community at sponsor.ajay.app.
YTU.register({
  id: 'sponsorblock',
  name: 'SponsorBlock',
  description: 'Skips sponsored segments using the community SponsorBlock database — automatically, or with a "Skip" button in the player. Only the first 4 characters of a hash of the video ID are sent, not the video itself.',
  settings: {
    mode: {
      type: 'select',
      label: 'When a segment starts',
      default: 'auto',
      popup: true,
      options: [
        { value: 'auto', label: 'Skip automatically' },
        { value: 'manual', label: 'Show Skip button' },
      ],
    },
    sponsor: { type: 'boolean', label: 'Sponsor', default: true },
    selfpromo: { type: 'boolean', label: 'Self-promotion / merch', default: true },
    interaction: { type: 'boolean', label: 'Like & subscribe reminders', default: true },
    intro: { type: 'boolean', label: 'Intro animation', default: false },
    outro: { type: 'boolean', label: 'Endcards / credits', default: false },
    preview: { type: 'boolean', label: 'Preview / recap', default: false },
    filler: { type: 'boolean', label: 'Filler tangents', default: false },
    music_offtopic: { type: 'boolean', label: 'Non-music parts in music videos', default: false },
    showOnProgressBar: { type: 'boolean', label: 'Mark segments on the progress bar', default: true },
  },

  run(ctx) {
    const s = ctx.settings;
    const API = 'https://sponsor.ajay.app/api/skipSegments/';
    const CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'];
    const LABELS = {
      sponsor: 'sponsor', selfpromo: 'self-promotion', interaction: 'reminder', intro: 'intro',
      outro: 'endcards', preview: 'preview', filler: 'filler', music_offtopic: 'non-music',
    };
    // Softened versions of SponsorBlock's category colours (same hues, less neon).
    const COLORS = {
      sponsor: '#4caf6a', selfpromo: '#d4c24a', interaction: '#a866d1', intro: '#4bb3bd',
      outro: '#5566cc', preview: '#4a8fc2', filler: '#7d63c9', music_offtopic: '#d18f45',
    };

    const style = document.createElement('style');
    style.textContent = `
      .ytu-sb-btn {
        position: absolute; right: 12px; bottom: 72px; z-index: 60;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; border: 1px solid rgba(255,255,255,.35); border-radius: 18px;
        background: rgba(15,15,15,.8); color: #fff;
        font: 500 14px Roboto, Arial, sans-serif; cursor: pointer;
        transition: opacity .2s;
      }
      .ytu-sb-btn:hover { background: rgba(40,40,40,.9); }
      .ytu-sb-btn .ytu-sb-dot { width: 8px; height: 8px; border-radius: 50%; }
      .ytu-sb-btn .ytu-sb-undo { color: #3ea6ff; margin-left: 4px; }
      /* The × fills the whole right end of the button, so a slightly-off click still closes it. */
      .ytu-sb-btn:has(.ytu-sb-close) { padding-right: 0; }
      .ytu-sb-btn .ytu-sb-close {
        display: flex; align-items: center; justify-content: center;
        align-self: stretch; width: 34px; margin: -8px 0 -8px 2px;
        border-left: 1px solid rgba(255,255,255,.25); border-radius: 0 18px 18px 0;
        font-size: 18px; line-height: 1; color: rgba(255,255,255,.7);
      }
      .ytu-sb-btn .ytu-sb-close:hover { background: rgba(255,255,255,.12); }
      .ytu-sb-btn .ytu-sb-close:hover { color: #fff; }
      .ytp-autohide .ytu-sb-btn { bottom: 24px; }
      .ytu-sb-bar { position: absolute; inset: 0; pointer-events: none; z-index: 35; }
      .ytu-sb-bar span { position: absolute; top: 0; bottom: 0; opacity: .6; }
    `;
    (document.head || document.documentElement).appendChild(style);

    let videoId = null;
    let segments = [];            // [{ start, end, category, uuid }]
    const ignored = new Set();    // segment UUIDs you chose to watch (Undo)
    const cache = new Map();      // videoId -> Promise<segments>
    let video = null;
    let button = null;
    let noticeTimer = null;
    let bar = null;

    const player = () => document.querySelector('#movie_player');
    const enabled = () => CATEGORIES.filter(c => s[c]);
    const isAd = () => { const p = player(); return !!(p && p.classList.contains('ad-showing')); };

    async function sha256Prefix(text) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 4);
    }

    // Asks for every video whose hashed ID shares a 4-character prefix, then picks ours locally.
    function fetchSegments(id) {
      if (cache.has(id)) return cache.get(id);
      const p = (async () => {
        const prefix = await sha256Prefix(id);
        const url = API + prefix + '?categories=' + encodeURIComponent(JSON.stringify(CATEGORIES));
        const res = await fetch(url, { credentials: 'omit' });
        if (res.status === 404) return []; // no segments for any video with this prefix
        if (!res.ok) throw new Error('SponsorBlock HTTP ' + res.status);
        const list = await res.json();
        const entry = list.find(v => v.videoID === id);
        return entry ? entry.segments
          .filter(x => x.actionType === 'skip')
          .map(x => ({ start: x.segment[0], end: x.segment[1], category: x.category, uuid: x.UUID }))
          .sort((a, b) => a.start - b.start) : [];
      })().catch(err => { cache.delete(id); ctx.log(err.message); return []; });
      cache.set(id, p);
      return p;
    }

    const active = () => segments.filter(x => s[x.category] && !ignored.has(x.uuid));

    // -------------------------------------------------------------- skip button / notice
    function ensureButton() {
      const p = player();
      if (!p) return null;
      if (!button) {
        button = document.createElement('button');
        button.className = 'ytu-sb-btn';
        button.type = 'button';
      }
      if (button.parentElement !== p) p.appendChild(button);
      return button;
    }

    function hideButton() {
      clearTimeout(noticeTimer);
      if (button) { button.remove(); button.onclick = null; button.dataset.uuid = ''; }
    }

    // Builds the button contents without innerHTML — YouTube enforces Trusted Types.
    function fillButton(b, seg, text, { undo = false, close = false } = {}) {
      const dot = document.createElement('span');
      dot.className = 'ytu-sb-dot';
      dot.style.background = COLORS[seg.category];
      const label = document.createElement('span');
      label.textContent = text;
      const parts = [dot, label];
      if (undo) {
        const u = document.createElement('span');
        u.className = 'ytu-sb-undo';
        u.textContent = 'Undo';
        parts.push(u);
      }
      if (close) {
        const x = document.createElement('span');
        x.className = 'ytu-sb-close';
        x.textContent = '×';
        x.title = 'Watch this segment';
        parts.push(x);
      }
      b.replaceChildren(...parts);
    }

    function showSkipButton(seg) {
      const b = ensureButton();
      if (!b || b.dataset.uuid === seg.uuid) return;
      clearTimeout(noticeTimer);
      b.dataset.uuid = seg.uuid;
      fillButton(b, seg, `Skip ${LABELS[seg.category]} ⏭`, { close: true });
      b.onclick = e => {
        e.stopPropagation();
        if (e.target.closest('.ytu-sb-close')) {
          // Watch it: hide the button and leave this segment alone for the rest of the video.
          ignored.add(seg.uuid);
          hideButton();
          drawBar();
          return;
        }
        skip(seg, false);
      };
    }

    function showSkippedNotice(seg) {
      const b = ensureButton();
      if (!b) return;
      b.dataset.uuid = seg.uuid + ':done';
      fillButton(b, seg, `Skipped ${LABELS[seg.category]}`, { undo: true });
      b.onclick = e => {
        e.stopPropagation();
        ignored.add(seg.uuid);
        if (video) video.currentTime = seg.start;
        hideButton();
      };
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(hideButton, 4000);
    }

    function skip(seg, auto) {
      if (!video) return;
      // Segment runs to the end of the video: jump to the very end so YouTube's "ended" logic still runs.
      video.currentTime = Math.min(seg.end, (video.duration || seg.end) - 0.05);
      if (auto) showSkippedNotice(seg);
      else hideButton();
      ctx.log(`skipped ${seg.category} ${seg.start.toFixed(1)}–${seg.end.toFixed(1)}s`);
    }

    // -------------------------------------------------------------- playback check
    function check() {
      if (!video || isAd() || !segments.length) return;
      const t = video.currentTime;
      const seg = active().find(x => t >= x.start && t < x.end - 0.25);

      if (!seg) {
        // Keep a "Skipped · Undo" notice up until its timer ends.
        if (button && button.dataset.uuid && !button.dataset.uuid.endsWith(':done')) hideButton();
        return;
      }
      if (s.mode === 'auto' && !video.paused) skip(seg, true);
      else if (s.mode === 'manual') showSkipButton(seg);
    }

    // -------------------------------------------------------------- progress bar markers
    function drawBar() {
      const p = player();
      const host = p && p.querySelector('.ytp-progress-bar');
      const dur = video && video.duration;
      if (!s.showOnProgressBar || !host || !dur || !isFinite(dur) || isAd()) {
        if (bar) { bar.remove(); bar = null; }
        return;
      }
      const key = videoId + '|' + active().map(x => x.uuid).join(',');
      if (bar && bar.parentElement === host && bar.dataset.key === key) return;
      if (!bar) { bar = document.createElement('div'); bar.className = 'ytu-sb-bar'; }
      bar.dataset.key = key;
      bar.replaceChildren(...active().map(x => {
        const span = document.createElement('span');
        span.style.left = (x.start / dur) * 100 + '%';
        span.style.width = Math.max(0.2, ((x.end - x.start) / dur) * 100) + '%';
        span.style.background = COLORS[x.category];
        return span;
      }));
      host.appendChild(bar);
    }

    // -------------------------------------------------------------- video tracking
    function bindVideo() {
      const p = player();
      const v = p && p.querySelector('video.html5-main-video, video');
      if (v === video) return;
      if (video) video.removeEventListener('timeupdate', check);
      video = v;
      if (video) video.addEventListener('timeupdate', check);
    }

    function currentVideoId() {
      const p = player();
      const data = p && typeof p.getVideoData === 'function' ? p.getVideoData() : null;
      if (data && data.video_id) return data.video_id;
      return location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;
    }

    function poll() {
      bindVideo();
      const id = location.pathname === '/watch' ? currentVideoId() : null;
      if (id !== videoId) {
        videoId = id;
        segments = [];
        ignored.clear();
        hideButton();
        if (id) {
          fetchSegments(id).then(list => {
            if (videoId !== id) return;
            segments = list;
            if (list.length) ctx.log(`${list.length} segment(s) for ${id}`);
            drawBar();
          });
        }
      }
      drawBar();
    }

    const timer = setInterval(poll, 500);
    document.addEventListener('yt-navigate-finish', poll);
    poll();

    const offChange = ctx.onChange(() => { hideButton(); drawBar(); check(); });

    return () => {
      clearInterval(timer);
      document.removeEventListener('yt-navigate-finish', poll);
      if (video) video.removeEventListener('timeupdate', check);
      offChange();
      hideButton();
      if (bar) bar.remove();
      style.remove();
    };
  },
});
