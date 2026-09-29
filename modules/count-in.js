// Count-in: metronome clicks "1 2 3 4" at the song's own tempo, then the video starts right on the beat.
YTU.register({
  id: 'count-in',
  name: 'Count-in',
  description: 'For playing along: counts "1 2 3 4" with metronome clicks, then starts the video right on the beat. While the song plays, press R on every beat, starting on bar 1 — that sets the tempo and where bar 1 is. G counts in from bar 1, Shift+G from the bar you\'re at. Follows the playback speed and remembers each video.',
  settings: {
    beats: { type: 'number', label: 'Clicks before the song starts', default: 4, min: 1, max: 16, step: 1 },
    volume: { type: 'number', label: 'Click volume (%)', default: 70, min: 0, max: 100, step: 5 },
    showCount: { type: 'boolean', label: 'Show the count on the video', default: true },
  },

  run(ctx) {
    const s = ctx.settings;
    const disposers = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      disposers.push(() => target.removeEventListener(type, fn, opts));
    };

    const style = document.createElement('style');
    style.textContent = `
      .ytu-ci-btn svg { display: block; margin: auto; }
      .ytu-ci-btn.ytu-ci-set .ytu-ci-weight { fill: #3ea6ff; }
      .ytu-ci-panel {
        position: absolute; right: 12px; bottom: 62px; z-index: 2301; width: 292px;
        padding: 12px 14px; border-radius: 12px; box-sizing: border-box;
        background: rgba(20, 20, 20, .9); backdrop-filter: blur(16px);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .4);
        color: #fff; font: 400 13px/1.3 Roboto, Arial, sans-serif; text-align: left;
      }
      .ytp-big-mode .ytu-ci-panel { bottom: 84px; }
      .ytu-ci-panel[hidden] { display: none; }
      .ytu-ci-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 14px; font-weight: 500; }
      .ytu-ci-row { display: flex; align-items: center; gap: 6px; margin: 8px 0; }
      .ytu-ci-label { flex: none; width: 46px; color: rgba(255, 255, 255, .7); }
      .ytu-ci-val { min-width: 62px; font-variant-numeric: tabular-nums; }
      .ytu-ci-unit { color: rgba(255, 255, 255, .7); margin-right: auto; }
      .ytu-ci-panel button {
        border: none; border-radius: 14px; padding: 4px 9px;
        background: rgba(255, 255, 255, .12); color: #fff; font: inherit; cursor: pointer;
      }
      .ytu-ci-panel button:hover { background: rgba(255, 255, 255, .22); }
      .ytu-ci-panel button.ytu-ci-primary { background: #fff; color: #0f0f0f; font-weight: 500; }
      .ytu-ci-panel button.ytu-ci-primary:hover { background: #d9d9d9; }
      .ytu-ci-panel button.ytu-ci-x { background: none; padding: 0 4px; font-size: 18px; line-height: 1; color: rgba(255, 255, 255, .7); }
      .ytu-ci-panel button.ytu-ci-flash { background: rgba(62, 166, 255, .6); }
      .ytu-ci-panel input {
        width: 58px; padding: 4px 6px; border: none; border-radius: 6px;
        background: rgba(255, 255, 255, .1); color: #fff; font: inherit;
      }
      .ytu-ci-key { opacity: .6; margin-left: 4px; }
      .ytu-ci-hint { flex: 1; color: rgba(255, 255, 255, .6); font-size: 12px; line-height: 1.25; }
      .ytu-ci-panel button.ytu-ci-tap { flex: none; }
      .ytu-ci-actions { display: flex; gap: 6px; margin-top: 10px; }
      .ytu-ci-actions button { flex: 1; padding: 7px 9px; }
      .ytu-ci-overlay {
        position: absolute; inset: 0; z-index: 59; pointer-events: none;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
      }
      .ytu-ci-num { min-height: 110px; font: 700 110px/1 Roboto, Arial, sans-serif; color: #fff; text-shadow: 0 2px 16px rgba(0, 0, 0, .7); }
      .ytu-ci-dots { display: flex; gap: 12px; }
      .ytu-ci-dots span { width: 14px; height: 14px; border-radius: 50%; background: rgba(255, 255, 255, .3); box-shadow: 0 1px 6px rgba(0, 0, 0, .5); }
      .ytu-ci-dots span.on { background: #fff; }
      .ytu-ci-dots span.ytu-ci-accent.on { background: #3ea6ff; }
    `;
    (document.head || document.documentElement).appendChild(style);
    disposers.push(() => style.remove());

    const player = () => document.querySelector('#movie_player');
    const video = () => { const p = player(); return p && p.querySelector('video'); };
    const isWatch = () => location.pathname === '/watch';
    const isAd = () => { const p = player(); return !!(p && p.classList.contains('ad-showing')); };
    const inTextField = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    function currentVideoId() {
      const p = player();
      const data = p && typeof p.getVideoData === 'function' ? p.getVideoData() : null;
      return (data && data.video_id) || new URLSearchParams(location.search).get('v');
    }

    const fmtBpm = b => String(Math.round(b * 10) / 10);
    const fmtTime = t => {
      const m = Math.floor(t / 60);
      return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0');
    };

    // -------------------------------------------------------------- per-video song data
    // { bpm, start (video seconds of bar 1's first beat), beats (count-in length) }
    let videoId = null;
    let song = {};
    const beatsOf = () => song.beats || s.beats;
    function save() {
      if (videoId) ctx.storage.set('song:' + videoId, song);
      refresh();
    }

    // -------------------------------------------------------------- tap tempo
    // Taps are recorded in *video* time, not wall-clock time, so the tempo is the song's own
    // even when the video is slowed down. The fit also gives the time of the first tapped beat.
    let taps = [];
    let lastTap = 0;
    let note = '';

    function fitBeats(ts) {
      if (ts.length < 4) return null;
      const gaps = [];
      for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > 0.15) gaps.push(ts[i] - ts[i - 1]);
      if (gaps.length < 3) return null;
      const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      // Number each tap by beats since the first one, so a skipped beat doesn't bend the fit.
      const pts = [];
      for (const t of ts) {
        const k = Math.round((t - ts[0]) / typical);
        if (!pts.length || k > pts[pts.length - 1].k) pts.push({ k, t });
      }
      if (pts.length < 4) return null;
      // Least squares through (beat number, time): slope is the beat length, intercept is beat 0.
      const n = pts.length;
      const mk = pts.reduce((a, p) => a + p.k, 0) / n;
      const mt = pts.reduce((a, p) => a + p.t, 0) / n;
      let sxy = 0, sxx = 0;
      for (const p of pts) { sxy += (p.k - mk) * (p.t - mt); sxx += (p.k - mk) ** 2; }
      const period = sxy / sxx;
      if (!(period > 0.2 && period < 2)) return null; // 30–300 BPM
      const t0 = mt - period * mk;
      const jitter = Math.sqrt(pts.reduce((a, p) => a + (p.t - (t0 + p.k * period)) ** 2, 0) / n);
      return { period, t0, jitter };
    }

    function tap() {
      const v = video();
      if (!v || isAd()) return;
      openPanel();
      if (v.paused) {
        note = 'Play the song first, then tap R on every beat.';
        refresh();
        return;
      }
      const now = performance.now();
      if (now - lastTap > 2500) taps = [];
      lastTap = now;
      taps.push(v.currentTime);
      if (ui.tap) {
        ui.tap.classList.add('ytu-ci-flash');
        setTimeout(() => ui.tap && ui.tap.classList.remove('ytu-ci-flash'), 90);
      }
      const fit = fitBeats(taps);
      if (fit) {
        song.bpm = Math.round((60 / fit.period) * 100) / 100;
        song.start = fit.t0;
        note = `${taps.length} taps, off by ±${Math.round(fit.jitter * 1000)} ms on average`;
        save();
      } else {
        note = taps.length < 4 ? `${taps.length} of 4 taps…` : 'Uneven taps — keep going';
        refresh();
      }
    }

    // -------------------------------------------------------------- sound
    let ac = null;
    // Resolves once the audio clock is running. It starts suspended, and clicks scheduled against a
    // frozen clock would all come late by however long it took to start. If the browser won't start
    // it at all, give up after a second: the count on screen and the downbeat still work.
    function audio() {
      if (!ac) ac = new AudioContext({ latencyHint: 'interactive' });
      if (ac.state !== 'suspended') return Promise.resolve();
      return Promise.race([ac.resume().catch(() => {}), new Promise(r => setTimeout(r, 1000))]);
    }
    disposers.push(() => { if (ac) ac.close(); });

    function click(when, accent, nodes) {
      const vol = (s.volume / 100) * (accent ? 1 : 0.7);
      if (vol <= 0) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = accent ? 1800 : 1200;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(vol, when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
      osc.connect(gain).connect(ac.destination);
      osc.start(when);
      osc.stop(when + 0.08);
      nodes.push(osc);
    }

    // -------------------------------------------------------------- count-in
    let counting = null;   // { timers, nodes, overlay } while a count-in runs
    let ownAction = false; // our own pause/seek/play, which the abort listeners must ignore
    // Time from play() to the video actually moving. Measured after every count-in and carried
    // over, so the downbeat lands on time on this machine.
    let latency = ctx.storage.get('latency', 45);

    // Runs fn at a performance.now() time. setTimeout alone drifts by 4–15 ms, so the precise
    // ones sleep until just before and busy-wait the rest.
    function at(when, fn, job, precise = false) {
      const delay = when - performance.now() - (precise ? 12 : 0);
      job.timers.push(setTimeout(() => {
        if (precise) while (performance.now() < when) { /* a few ms at most */ }
        fn();
      }, Math.max(0, delay)));
    }

    // Seeks through YouTube's own player so it doesn't follow up with a seek of its own, then waits
    // until the video sits at the target and can play straight away (that keeps play() latency
    // steady). "Sits there" means for 150 ms: on a long video YouTube may still nudge the position
    // while it loads the new spot.
    function seek(v, t) {
      const p = player();
      if (p && typeof p.seekTo === 'function') p.seekTo(t, true);
      else v.currentTime = t;
      return new Promise(resolve => {
        const began = performance.now();
        let steadySince = 0;
        const poll = setInterval(() => {
          const now = performance.now();
          if (!v.paused) v.pause(); // YouTube may resume after its seek; the count-in plays it later
          const there = !v.seeking && v.readyState >= 3 && Math.abs(v.currentTime - t) < 0.1;
          steadySince = there ? steadySince || now : 0;
          if ((steadySince && now - steadySince >= 150) || now - began > 8000) {
            clearInterval(poll);
            resolve();
          }
        }, 15);
      });
    }

    async function countIn(fromHere) {
      if (counting) { abort(); return; } // pressing it again cancels
      const v = video();
      if (!isWatch() || !v || isAd()) return;
      if (!song.bpm) {
        openPanel();
        note = 'Set the tempo first: play the song and tap R on every beat.';
        refresh();
        return;
      }
      const audioReady = audio(); // has to start inside the key press or click, or the browser keeps it muted

      const period = 60 / song.bpm;
      const beats = beatsOf();
      let target = song.start != null ? song.start : v.currentTime;
      if (fromHere && song.start != null) {
        // The bar you're in, or the next one if you're just before it.
        const bar = period * beats;
        target = song.start + Math.max(0, Math.floor((v.currentTime - song.start) / bar + 0.1)) * bar;
      }
      target = Math.max(0, Math.min(target, (v.duration || Infinity) - 0.5));

      const job = counting = { timers: [], nodes: [], overlay: null };
      closePanel();
      showOverlay(job, beats);

      job.target = target;
      ownAction = true;
      v.pause();
      await Promise.all([seek(v, target), audioReady]);
      ownAction = false;
      if (counting !== job) return; // cancelled while seeking

      const rate = v.playbackRate || 1;
      const interval = period / rate;
      const ctxNow = ac.currentTime;
      const perfNow = performance.now();
      const toPerf = c => perfNow + (c - ctxNow) * 1000;
      const first = ctxNow + 0.15;
      for (let i = 0; i < beats; i++) {
        click(first + i * interval, i === 0, job.nodes);
        at(toPerf(first + i * interval), () => showBeat(job, i), job);
      }
      const downbeat = toPerf(first + beats * interval);
      at(downbeat - latency, () => {
        const base = v.currentTime;
        const called = performance.now();
        ownAction = true;
        v.play().catch(() => {}).finally(() => { ownAction = false; });
        counting = null;
        hideOverlay(job);
        calibrate(v, base, called, rate);
      }, job, true);
    }

    function abort() {
      const job = counting;
      if (!job) return;
      counting = null;
      for (const t of job.timers) clearTimeout(t);
      for (const n of job.nodes) { try { n.stop(); } catch { /* already stopped */ } }
      hideOverlay(job);
    }

    // Measures when the video really started moving and adjusts `latency` for next time.
    function calibrate(v, base, called, rate) {
      const began = performance.now();
      const check = () => {
        if (v.paused || performance.now() - began > 2000) return;
        if (v.currentTime < base + 0.1) { requestAnimationFrame(check); return; }
        const started = performance.now() - ((v.currentTime - base) / rate) * 1000;
        const measured = started - called;
        if (measured < 0 || measured > 400) return;
        latency = Math.round(latency * 0.6 + measured * 0.4);
        ctx.storage.set('latency', latency);
        ctx.log(`video started ${Math.round(measured)} ms after play(); compensating ${latency} ms next time`);
      };
      requestAnimationFrame(check);
    }

    // Your own play or seek during a count-in cancels it; a seek also restarts tap tempo.
    function onMedia(e) {
      if (!(e.target instanceof HTMLVideoElement) || ownAction) return;
      // YouTube re-seeks on its own while it loads the spot we jumped to; those land on our target.
      if (e.type === 'seeking' && counting && Math.abs(e.target.currentTime - counting.target) < 0.5) return;
      if (e.type === 'seeking') taps = [];
      if (counting) abort();
    }
    on(document, 'play', onMedia, true);
    on(document, 'seeking', onMedia, true);

    // -------------------------------------------------------------- UI
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    const btnEl = (text, title, onClick, cls, key) => {
      const b = el('button', cls, text);
      b.type = 'button';
      if (title) b.title = title;
      if (key) b.appendChild(el('span', 'ytu-ci-key', key));
      b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      return b;
    };
    const row = (label, ...kids) => {
      const r = el('div', 'ytu-ci-row');
      r.append(el('span', 'ytu-ci-label', label), ...kids);
      return r;
    };

    function showOverlay(job, beats) {
      const p = player();
      if (!s.showCount || !p) return;
      const box = el('div', 'ytu-ci-overlay');
      const num = el('div', 'ytu-ci-num');
      const dots = el('div', 'ytu-ci-dots');
      for (let i = 0; i < beats; i++) dots.appendChild(el('span', i === 0 ? 'ytu-ci-accent' : ''));
      box.append(num, dots);
      p.appendChild(box);
      job.overlay = { box, num, dots };
    }

    function showBeat(job, i) {
      if (!job.overlay) return;
      job.overlay.num.textContent = String(i + 1);
      [...job.overlay.dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    }

    function hideOverlay(job) {
      if (job.overlay) { job.overlay.box.remove(); job.overlay = null; }
    }

    let btn = null;
    let panel = null;
    const ui = {};

    function metronomeIcon() {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      const attrs = { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: '#fff', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
      const add = (tag, a) => {
        const n = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
        svg.appendChild(n);
      };
      add('path', { d: 'M9.2 3h5.6l3.7 18H5.5z' }); // body
      add('path', { d: 'M6.6 16h10.8' });           // base
      add('path', { d: 'M12 16l5-9' });             // pendulum
      add('circle', { class: 'ytu-ci-weight', cx: '14.8', cy: '11', r: '1.7', fill: '#fff', stroke: 'none' });
      return svg;
    }

    function buildButton() {
      const b = el('button', 'ytp-button ytu-ci-btn');
      b.type = 'button';
      b.setAttribute('aria-label', 'Count-in');
      b.appendChild(metronomeIcon());
      b.addEventListener('click', e => { e.stopPropagation(); togglePanel(); });
      return b;
    }

    function buildPanel() {
      const p = el('div', 'ytu-ci-panel');
      p.hidden = true;
      // Keep the player from reading clicks and keys in here as play/pause, fullscreen or seeking.
      for (const type of ['click', 'mousedown', 'mouseup', 'dblclick', 'keydown', 'keyup', 'wheel', 'contextmenu']) {
        p.addEventListener(type, e => e.stopPropagation());
      }

      const head = el('div', 'ytu-ci-head');
      head.append(el('span', '', 'Count-in'), btnEl('×', 'Close', closePanel, 'ytu-ci-x'));

      ui.bpm = el('input');
      Object.assign(ui.bpm, { type: 'number', min: '30', max: '300', step: '0.1', placeholder: '—' });
      ui.bpm.setAttribute('aria-label', 'Tempo in BPM');
      ui.bpm.addEventListener('change', () => {
        const b = parseFloat(ui.bpm.value);
        if (b >= 30 && b <= 300) { song.bpm = b; save(); } else refresh();
      });
      const setBpm = b => { if (b) { song.bpm = Math.min(300, Math.max(30, b)); save(); } };

      ui.start = el('span', 'ytu-ci-val');
      const nudge = d => { if (song.start != null) { song.start = Math.max(0, song.start + d); save(); } };

      ui.beats = el('input');
      Object.assign(ui.beats, { type: 'number', min: '1', max: '16', step: '1' });
      ui.beats.setAttribute('aria-label', 'Clicks before the song starts');
      ui.beats.addEventListener('change', () => {
        const n = parseInt(ui.beats.value, 10);
        if (n >= 1 && n <= 16) { song.beats = n; save(); } else refresh();
      });

      ui.tap = btnEl('Tap', 'Tap on every beat while the song plays, starting on bar 1', tap, 'ytu-ci-tap', 'R');
      ui.note = el('div', 'ytu-ci-hint');

      const actions = el('div', 'ytu-ci-actions');
      actions.append(
        btnEl('Count in', 'Count in and play from bar 1', () => countIn(false), 'ytu-ci-primary', 'G'),
        btnEl('From here', 'Count in from the bar you are at', () => countIn(true), '', '⇧G'),
      );

      const tapRow = el('div', 'ytu-ci-row');
      tapRow.append(el('span', 'ytu-ci-label'), ui.tap, ui.note);

      p.append(
        head,
        row('Tempo', ui.bpm, el('span', 'ytu-ci-unit', 'BPM'),
          btnEl('½', 'Half the tempo', () => setBpm(song.bpm / 2)),
          btnEl('×2', 'Double the tempo', () => setBpm(song.bpm * 2))),
        tapRow,
        row('Bar 1', ui.start,
          btnEl('‹', '20 ms earlier', () => nudge(-0.02)),
          btnEl('›', '20 ms later', () => nudge(0.02)),
          btnEl('Here', 'Bar 1 starts at the current position', () => {
            const v = video();
            if (v) { song.start = v.currentTime; save(); }
          })),
        row('Clicks', ui.beats),
        actions,
      );
      return p;
    }

    function refresh() {
      if (btn) {
        btn.classList.toggle('ytu-ci-set', !!song.bpm);
        btn.title = song.bpm ? `Count-in · ${fmtBpm(song.bpm)} BPM (G)` : 'Count-in (G)';
      }
      if (!panel) return;
      if (document.activeElement !== ui.bpm) ui.bpm.value = song.bpm ? fmtBpm(song.bpm) : '';
      if (document.activeElement !== ui.beats) ui.beats.value = String(beatsOf());
      ui.start.textContent = song.start != null ? fmtTime(song.start) : 'not set';
      ui.note.textContent = note || (song.bpm ? '' : 'Play the song and tap R on every beat, starting on bar 1.');
    }

    function ensureUi() {
      const p = player();
      if (!isWatch() || !p) {
        if (btn) btn.remove();
        if (panel) panel.remove();
        return;
      }
      const host = p.querySelector('.ytp-right-controls-left') || p.querySelector('.ytp-right-controls');
      if (host) {
        if (!btn) btn = buildButton();
        if (btn.parentElement !== host) host.insertBefore(btn, host.querySelector('.ytp-settings-button') || host.firstChild);
      }
      if (!panel) panel = buildPanel();
      if (panel.parentElement !== p) p.appendChild(panel);
    }

    function openPanel() {
      ensureUi();
      if (!panel) return;
      panel.hidden = false;
      refresh();
    }
    function closePanel() { if (panel) panel.hidden = true; }
    function togglePanel() { if (panel && !panel.hidden) closePanel(); else openPanel(); }

    // Close on a click anywhere else, like YouTube's own settings menu.
    on(document, 'mousedown', e => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !(btn && btn.contains(e.target))) closePanel();
    }, true);

    // -------------------------------------------------------------- keys
    // YouTube reads keys for the whole player before they reach anything inside it, so typing "5"
    // into the tempo field would jump the video to 50%. Stopping them on window in the capture phase
    // runs ahead of YouTube's handler, and the typing itself (the default action) still happens.
    function onKey(e) {
      const inPanel = !!panel && panel.contains(e.target);
      const k = (e.key || '').toLowerCase();
      const ours = e.type === 'keydown' && !e.ctrlKey && !e.metaKey && !e.altKey && (k === 'g' || (k === 'r' && !e.shiftKey));
      if (inPanel && !ours) { e.stopImmediatePropagation(); return; }
      if (!ours || !isWatch() || (!inPanel && inTextField(e.target))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (k === 'r') tap();
      else countIn(e.shiftKey);
    }
    for (const type of ['keydown', 'keypress', 'keyup']) on(window, type, onKey, true);

    // -------------------------------------------------------------- page tracking
    function poll() {
      const id = isWatch() ? currentVideoId() : null;
      if (id !== videoId) {
        abort();
        videoId = id;
        song = id ? ctx.storage.get('song:' + id, {}) || {} : {};
        taps = [];
        note = '';
        closePanel();
      }
      ensureUi();
      refresh();
    }
    const timer = setInterval(poll, 500);
    on(document, 'yt-navigate-finish', poll);
    poll();

    disposers.push(ctx.onChange(refresh));

    return () => {
      abort();
      clearInterval(timer);
      for (const d of disposers) d();
      if (btn) btn.remove();
      if (panel) panel.remove();
    };
  },
});
