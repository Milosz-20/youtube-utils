// Count-in: metronome clicks "1 2 3 4" at the song's own tempo, then the video starts right on the beat.
YTU.register({
  id: 'count-in',
  name: 'Count-in & loop',
  description: 'For playing along: counts "1 2 3 4" with metronome clicks, then starts the video right on the beat. While the song plays, press R on every beat, starting on bar 1 — that sets the tempo and where bar 1 is. G counts in from bar 1, Shift+G from the bar you\'re at. Shift+R keeps the clicks going along with the video, as a metronome. [ and ] mark a passage, \\ loops it, optionally with a count-in before every repeat. Every bar of the count-in starts with a higher click. Follows the playback speed and remembers each video.',
  settings: {
    beats: { type: 'number', label: 'Clicks before the song starts', default: 4, min: 1, max: 16, step: 1 },
    perBar: { type: 'number', label: 'Beats per bar (the first of each bar gets the higher click)', default: 4, min: 1, max: 12, step: 1 },
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
      .ytu-ci-btn.ytu-ci-disabled svg { opacity: .45; }
      .ytu-ci-panel {
        position: absolute; right: 12px; bottom: 62px; z-index: 2301; width: 304px; box-sizing: border-box;
        border-radius: 16px; overflow: hidden auto; max-height: calc(100% - 74px);
        background: rgba(30, 30, 30, .9); backdrop-filter: blur(20px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, .08); box-shadow: 0 12px 32px rgba(0, 0, 0, .45);
        color: #f1f1f1; font: 400 13px/1.35 Roboto, Arial, sans-serif; text-align: left;
      }
      .ytp-big-mode .ytu-ci-panel { bottom: 84px; }
      .ytu-ci-panel[hidden] { display: none; }
      .ytu-ci-panel * { box-sizing: border-box; }
      .ytu-ci-panel button {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 28px; padding: 0 10px; border: none; border-radius: 14px;
        background: rgba(255, 255, 255, .1); color: #f1f1f1; font: 500 12px/1 Roboto, Arial, sans-serif;
        cursor: pointer; transition: background .12s;
      }
      .ytu-ci-panel button:hover { background: rgba(255, 255, 255, .18); }
      .ytu-ci-panel button:focus-visible, .ytu-ci-panel input:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 1px; }
      .ytu-ci-key {
        padding: 2px 5px; border-radius: 4px; font: 500 10px/1 Roboto, Arial, sans-serif;
        background: rgba(255, 255, 255, .14); color: rgba(255, 255, 255, .75);
      }

      .ytu-ci-head { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px; }
      .ytu-ci-title { font-size: 15px; font-weight: 500; margin-right: auto; }
      .ytu-ci-panel button.ytu-ci-x { width: 28px; padding: 0; background: none; font-size: 18px; color: rgba(255, 255, 255, .6); }
      .ytu-ci-panel button.ytu-ci-x:hover { background: rgba(255, 255, 255, .1); color: #fff; }
      .ytu-ci-switch { position: relative; width: 36px; height: 20px; flex: none; cursor: pointer; }
      .ytu-ci-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
      .ytu-ci-switch span { position: absolute; inset: 0; border-radius: 10px; background: rgba(255, 255, 255, .22); transition: background .15s; pointer-events: none; }
      .ytu-ci-switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
      .ytu-ci-switch input:checked + span { background: #3ea6ff; }
      .ytu-ci-switch input:checked + span::after { transform: translateX(16px); }
      .ytu-ci-switch input:focus-visible + span { outline: 2px solid #fff; outline-offset: 2px; }

      .ytu-ci-off-note { display: none; padding: 0 16px 16px; color: rgba(255, 255, 255, .6); font-size: 12px; }
      .ytu-ci-panel.ytu-ci-off .ytu-ci-body { display: none; }
      .ytu-ci-panel.ytu-ci-off .ytu-ci-off-note { display: block; }

      .ytu-ci-section { padding: 10px 16px; border-top: 1px solid rgba(255, 255, 255, .08); }
      .ytu-ci-caption { display: flex; align-items: center; gap: 4px; margin-bottom: 4px;
        font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(255, 255, 255, .5); }
      .ytu-ci-caption > span { margin-right: auto; }
      .ytu-ci-panel .ytu-ci-caption button { height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11px; letter-spacing: 0; text-transform: none; }

      .ytu-ci-tempo { display: flex; align-items: center; justify-content: space-between; }
      .ytu-ci-panel button.ytu-ci-round { width: 32px; height: 32px; padding: 0; border-radius: 50%; font-size: 18px; font-weight: 400; }
      .ytu-ci-bpmbox { display: flex; flex-direction: column; align-items: center; }
      .ytu-ci-panel input.ytu-ci-bpm {
        width: 120px; padding: 0; border: none; border-radius: 8px; background: none; color: #fff; text-align: center;
        font: 500 32px/1.1 Roboto, Arial, sans-serif; font-variant-numeric: tabular-nums;
      }
      .ytu-ci-panel input.ytu-ci-bpm:hover { background: rgba(255, 255, 255, .06); }
      .ytu-ci-panel input.ytu-ci-bpm::placeholder { color: rgba(255, 255, 255, .3); }
      .ytu-ci-bpmunit { font-size: 11px; color: rgba(255, 255, 255, .5); letter-spacing: .06em; }
      .ytu-ci-panel button.ytu-ci-tap { width: 100%; height: 34px; margin-top: 8px; border-radius: 17px; font-size: 13px; }
      .ytu-ci-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, .35); transition: background .08s, transform .08s; }
      .ytu-ci-panel button.ytu-ci-flash { background: rgba(62, 166, 255, .28); }
      .ytu-ci-flash .ytu-ci-dot { background: #3ea6ff; transform: scale(1.5); }
      .ytu-ci-hint { margin-top: 6px; text-align: center; font-size: 12px; color: rgba(255, 255, 255, .55); }
      .ytu-ci-hint:empty { display: none; }

      .ytu-ci-row { display: flex; align-items: center; gap: 6px; min-height: 30px; }
      .ytu-ci-row + .ytu-ci-row { margin-top: 2px; }
      .ytu-ci-label { margin-right: auto; color: rgba(255, 255, 255, .7); }
      .ytu-ci-val { margin-right: 2px; font-variant-numeric: tabular-nums; }
      .ytu-ci-panel button.ytu-ci-small { width: 28px; padding: 0; font-size: 14px; }
      .ytu-ci-stepper { display: flex; align-items: center; height: 28px; border-radius: 14px; background: rgba(255, 255, 255, .1); }
      .ytu-ci-panel .ytu-ci-stepper button { width: 28px; padding: 0; background: none; font-size: 16px; font-weight: 400; }
      .ytu-ci-panel .ytu-ci-stepper button:hover { background: rgba(255, 255, 255, .12); }
      .ytu-ci-stepper span { min-width: 22px; text-align: center; font-weight: 500; font-variant-numeric: tabular-nums; }
      .ytu-ci-unit { min-width: 42px; color: rgba(255, 255, 255, .5); font-size: 12px; }

      .ytu-ci-panel select.ytu-ci-sound {
        appearance: none; -moz-appearance: none; width: 150px; height: 28px; padding: 0 28px 0 12px;
        border: none; border-radius: 14px; cursor: pointer;
        background: rgba(255, 255, 255, .1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23fff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 11px center;
        color: #f1f1f1; font: 500 12px/1 Roboto, Arial, sans-serif;
      }
      .ytu-ci-panel select.ytu-ci-sound:hover { background-color: rgba(255, 255, 255, .18); }
      .ytu-ci-panel select.ytu-ci-sound:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 1px; }
      .ytu-ci-panel select.ytu-ci-sound option, .ytu-ci-panel select.ytu-ci-sound optgroup { background: #282828; color: #f1f1f1; }

      .ytu-ci-actions { display: flex; gap: 8px; padding: 10px 16px 12px; border-top: 1px solid rgba(255, 255, 255, .08); }
      .ytu-ci-panel .ytu-ci-actions button { flex: 1; height: 36px; border-radius: 18px; font-size: 13px; }
      .ytu-ci-panel .ytu-ci-actions button.ytu-ci-primary { background: #f1f1f1; color: #0f0f0f; }
      .ytu-ci-panel .ytu-ci-actions button.ytu-ci-primary:hover { background: #d9d9d9; }
      .ytu-ci-primary .ytu-ci-key { background: rgba(0, 0, 0, .1); color: rgba(0, 0, 0, .6); }
      .ytu-ci-toast {
        position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 60; pointer-events: none;
        padding: 8px 14px; border-radius: 16px; background: rgba(0, 0, 0, .7);
        color: #fff; font: 500 13px/1 Roboto, Arial, sans-serif; transition: opacity .3s;
      }
      .ytu-ci-btn.ytu-ci-metro .ytu-ci-arm { animation: ytu-ci-swing 1s ease-in-out infinite alternate; transform-origin: 12px 16px; }
      @keyframes ytu-ci-swing { from { transform: rotate(-38deg); } to { transform: rotate(0deg); } }
      .ytu-ci-loopbar {
        position: absolute; top: -1px; bottom: -1px; z-index: 36; pointer-events: none; box-sizing: border-box;
        background: rgba(62, 166, 255, .22); border-left: 2px solid #3ea6ff; border-right: 2px solid #3ea6ff;
      }
      .ytu-ci-loopbar.ytu-ci-loop-active { background: rgba(62, 166, 255, .45); }
      .ytu-ci-loopbar.ytu-ci-loop-open { border-right: none; }
      .ytu-ci-loopinfo { margin-right: auto; color: rgba(255, 255, 255, .5); font-size: 12px; }
      .ytu-ci-overlay {
        position: absolute; inset: 0; z-index: 59; pointer-events: none;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
      }
      .ytu-ci-num { min-height: 110px; font: 700 110px/1 Roboto, Arial, sans-serif; color: #fff; text-shadow: 0 2px 16px rgba(0, 0, 0, .7); }
      .ytu-ci-dots { display: flex; gap: 12px; }
      .ytu-ci-dots span { width: 14px; height: 14px; border-radius: 50%; background: rgba(255, 255, 255, .3); box-shadow: 0 1px 6px rgba(0, 0, 0, .5); }
      .ytu-ci-dots span.on { background: #fff; }
      .ytu-ci-dots span.ytu-ci-accent.on { background: #3ea6ff; }
      .ytu-ci-dots span.ytu-ci-accent:not(:first-child) { margin-left: 14px; } /* gap between bars */
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
    // { bpm, start (video seconds of bar 1's first beat), beats (count-in length), perBar (beats in a bar) }
    let videoId = null;
    let song = {};
    const beatsOf = () => song.beats || s.beats;
    const perBarOf = () => song.perBar || s.perBar;
    // Off unless you switch it on for this video; videos you've already set a tempo for count as on.
    const isOn = () => (song.enabled != null ? song.enabled : !!song.bpm);
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
      if (!v || isAd() || !isOn()) return;
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
        setTimeout(() => ui.tap && ui.tap.classList.remove('ytu-ci-flash'), 120);
      }
      const fit = fitBeats(taps);
      if (fit) {
        song.bpm = Math.round((60 / fit.period) * 100) / 100;
        song.start = fit.t0;
        note = `${taps.length} taps \u00b7 steady to \u00b1${Math.round(fit.jitter * 1000)} ms`;
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

    // Drum sounds, synthesised on the spot, so there are no audio files to ship. The accent (every
    // bar's "1") is louder and, where it suits the instrument, brighter or longer.
    let noise = null;
    function noiseBuffer() {
      if (!noise) {
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return noise;
    }

    // A gain envelope: near-silent, a 1–2 ms attack, then an exponential decay to silence.
    function envelope(when, peak, decay, attack = 0.001) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
      g.connect(ac.destination);
      return g;
    }

    function noiseHit(when, filter, freq, q, peak, decay, nodes) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer();
      const f = ac.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      src.connect(f).connect(envelope(when, peak, decay));
      src.start(when);
      src.stop(when + decay + 0.05);
      nodes.push(src);
    }

    function tone(when, type, freq, peak, decay, nodes, endFreq) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, when + decay);
      osc.connect(envelope(when, peak, decay));
      osc.start(when);
      osc.stop(when + decay + 0.05);
      nodes.push(osc);
    }

    // Drum voices, shared by the sounds below.
    const kick = (when, vol, nodes) => {
      tone(when, 'sine', 150, vol, 0.22, nodes, 42);            // the boom: a pitch sweeping down
      noiseHit(when, 'lowpass', 3000, 0.7, vol * 0.35, 0.006, nodes); // the beater
    };
    const snare = (when, vol, nodes) => {
      noiseHit(when, 'highpass', 1500, 0.7, vol * 0.9, 0.16, nodes);  // the wires
      tone(when, 'triangle', 190, vol * 0.6, 0.08, nodes, 160);        // the shell
    };
    const tom = (when, high, vol, nodes) => {
      tone(when, 'sine', high ? 230 : 170, vol, 0.32, nodes, high ? 150 : 110);
      noiseHit(when, 'bandpass', 1200, 1, vol * 0.15, 0.02, nodes);
    };

    const SOUNDS = {
      // Kick on every bar's "1", snare on the rest: how a drummer's count feels.
      kit: {
        group: 'Drums',
        label: 'Kit (kick + snare)',
        play(when, accent, vol, nodes) { if (accent) kick(when, vol, nodes); else snare(when, vol * 0.85, nodes); },
      },
      kick: {
        group: 'Drums',
        label: 'Kick',
        play(when, accent, vol, nodes) { kick(when, vol, nodes); },
      },
      snare: {
        group: 'Drums',
        label: 'Snare',
        play(when, accent, vol, nodes) { snare(when, vol, nodes); },
      },
      // A higher tom for the "1", a lower one for the rest.
      tom: {
        group: 'Drums',
        label: 'Toms',
        play(when, accent, vol, nodes) { tom(when, accent, vol, nodes); },
      },
      // Two drumsticks knocked together: a bright, woody tick.
      sticks: {
        label: 'Sticks',
        play(when, accent, vol, nodes) {
          noiseHit(when, 'bandpass', accent ? 3200 : 2600, 2.5, vol * 1.6, 0.035, nodes);
          tone(when, 'triangle', accent ? 2100 : 1750, vol * 0.5, 0.025, nodes);
        },
      },
      // Closed hi-hat; the accent opens up a little.
      hihat: {
        label: 'Hi-hat',
        play(when, accent, vol, nodes) {
          noiseHit(when, 'highpass', 7000, 0.7, vol * 1.1, accent ? 0.16 : 0.05, nodes);
        },
      },
      woodblock: {
        label: 'Woodblock',
        play(when, accent, vol, nodes) {
          tone(when, 'sine', accent ? 1250 : 950, vol, 0.07, nodes, accent ? 1150 : 880);
          noiseHit(when, 'bandpass', 2000, 1, vol * 0.4, 0.008, nodes);
        },
      },
      // The classic 808-style cowbell: two detuned square waves through a band-pass.
      cowbell: {
        label: 'Cowbell',
        play(when, accent, vol, nodes) {
          const f = ac.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 800;
          f.Q.value = 1.2;
          f.connect(envelope(when, vol * 0.9, accent ? 0.35 : 0.2));
          for (const hz of [540, 800]) {
            const osc = ac.createOscillator();
            osc.type = 'square';
            osc.frequency.value = accent ? hz * 1.06 : hz;
            osc.connect(f);
            osc.start(when);
            osc.stop(when + 0.45);
            nodes.push(osc);
          }
        },
      },
      beep: {
        label: 'Beep',
        play(when, accent, vol, nodes) {
          tone(when, 'triangle', accent ? 1800 : 1200, vol, 0.07, nodes);
        },
      },
    };
    // Your pick, shared by every video. Kept here rather than in the options page, since you choose
    // it while listening, from the panel.
    let soundId = ctx.storage.get('sound', 'kit');
    if (!SOUNDS[soundId]) soundId = 'kit';

    function click(when, accent, nodes) {
      const vol = (s.volume / 100) * (accent ? 1 : 0.6);
      if (vol <= 0) return;
      SOUNDS[soundId].play(when, accent, vol, nodes);
    }

    // Plays "1 2" in the chosen sound, so you can hear it while picking.
    function preview() {
      audio().then(() => {
        const at0 = ac.currentTime + 0.05;
        click(at0, true, []);
        click(at0 + 0.35, false, []);
      });
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

    async function countIn(fromHere, opts = {}) {
      if (counting) { abort(); return; } // pressing it again cancels
      const v = video();
      if (!isWatch() || !v || isAd() || !isOn()) return;
      if (!song.bpm) {
        openPanel();
        note = 'Set the tempo first: play the song and tap R on every beat.';
        refresh();
        return;
      }
      const audioReady = audio(); // has to start inside the key press or click, or the browser keeps it muted

      const period = 60 / song.bpm;
      const beats = beatsOf();
      const perBar = perBarOf();
      let target = song.start != null ? song.start : v.currentTime;
      if (opts.target != null) target = opts.target;
      else if (!fromHere && loopReady()) target = song.loop.a; // with a loop set, G counts into the loop
      else if (fromHere && song.start != null) {
        // The bar you're in, or the next one if you're just before it.
        const bar = period * perBar;
        target = song.start + Math.max(0, Math.floor((v.currentTime - song.start) / bar + 0.1)) * bar;
      }
      target = Math.max(0, Math.min(target, (v.duration || Infinity) - 0.5));

      const job = counting = { timers: [], nodes: [], overlay: null };
      if (!opts.keepPanel) closePanel();
      showOverlay(job, beats, perBar);

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
        click(first + i * interval, i % perBar === 0, job.nodes); // higher click on every bar's "1"
        at(toPerf(first + i * interval), () => showBeat(job, i, perBar), job);
      }
      const downbeat = toPerf(first + beats * interval);
      // With the metronome on, the count-in plays the "1" of the song too, on the audio clock, and the
      // metronome carries on from the beat after it.
      const firstBeat = Math.round((target - (song.start || 0)) / period);
      if (metroOn()) click(first + beats * interval, true, job.nodes);
      at(downbeat - latency, () => {
        const base = v.currentTime;
        const called = performance.now();
        ownAction = true;
        v.play().catch(() => {}).finally(() => { ownAction = false; });
        counting = null;
        hideOverlay(job);
        if (metroOn()) { metro.nodes = []; metro.next = firstBeat + 1; }
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

    // -------------------------------------------------------------- metronome
    // Clicks along with the video on the song's beat grid (bar 1 + n beats, in video time), so it
    // stays in step through seeking, pausing and speed changes. Each pass looks at where the video
    // is now and schedules the beats of the next 150 ms on the audio clock.
    const metro = { next: null, nodes: [] }; // next: the beat number to schedule next
    const metroOn = () => isOn() && !!song.metronome && !!song.bpm;

    function metroReset() {
      for (const n of metro.nodes) { try { n.stop(); } catch { /* already played */ } }
      metro.nodes = [];
      metro.next = null;
    }

    function metroTick() {
      const v = video();
      if (!metroOn() || !v || v.paused || v.seeking || isAd() || counting || !isWatch()) {
        if (metro.next !== null || metro.nodes.length) metroReset();
        return;
      }
      if (!ac) {
        // Opened on a video that has it switched on: wait for a click or key before making sound.
        if (!(navigator.userActivation && navigator.userActivation.hasBeenActive)) return;
        audio();
      }
      if (ac.state === 'suspended') { ac.resume().catch(() => {}); return; }

      const period = 60 / song.bpm;
      const rate = v.playbackRate || 1;
      const start = song.start || 0;
      const perBar = perBarOf();
      const vt = v.currentTime;
      const now = ac.currentTime;
      if (metro.next === null) metro.next = Math.ceil((vt - start) / period - 0.02);
      for (;;) {
        const k = metro.next;
        const when = now + (start + k * period - vt) / rate;
        if (when > now + 0.15) break;
        if (when >= now - 0.01) click(Math.max(now, when), ((k % perBar) + perBar) % perBar === 0, metro.nodes);
        metro.next = k + 1;
      }
      if (metro.nodes.length > 40) metro.nodes = metro.nodes.slice(-20);
    }
    const metroTimer = setInterval(metroTick, 25);
    disposers.push(() => { clearInterval(metroTimer); metroReset(); });
    // Pausing, seeking or changing speed drops the clicks already queued; the next pass re-anchors.
    for (const type of ['pause', 'seeking', 'ratechange']) {
      on(document, type, e => { if (e.target instanceof HTMLVideoElement) metroReset(); }, true);
    }

    // -------------------------------------------------------------- loop (A-B)
    // song.loop = { a, b, on, countIn }. Playing into B jumps back to A, or pauses and counts in to A.
    // Only playback running into B triggers it: seeking past B on purpose doesn't snap you back.
    const loopOf = () => song.loop || (song.loop = { a: null, b: null, on: false, countIn: false });
    const loopReady = () => {
      const L = song.loop;
      return isOn() && !!L && !!L.on && L.a != null && L.b != null && L.b > L.a + 0.05;
    };
    let loopLast = null;
    let loopLastWall = 0;

    function loopTick() {
      const v = video();
      if (!loopReady() || !v || v.paused || v.seeking || isAd() || counting) { loopLast = null; return; }
      const { a, b } = song.loop;
      const t = v.currentTime;
      // Moving further than playback could have since the last pass is a seek, not playing into B.
      // Measured against real elapsed time, since timers slow down in a background tab.
      const wall = performance.now();
      if (loopLast != null && Math.abs(t - loopLast - ((wall - loopLastWall) / 1000) * (v.playbackRate || 1)) > 0.3) loopLast = null;
      loopLastWall = wall;
      if (loopLast != null && loopLast >= a - 0.3 && loopLast < b && t >= b - 0.015) {
        loopLast = null;
        if (song.loop.countIn && song.bpm) countIn(false, { target: a, keepPanel: true });
        else v.currentTime = a;
        return;
      }
      loopLast = t;
    }
    const loopTimer = setInterval(loopTick, 15);
    on(document, 'seeking', e => { if (e.target instanceof HTMLVideoElement) loopLast = null; }, true);
    disposers.push(() => clearInterval(loopTimer));

    function setLoopPoint(which, time) {
      const v = video();
      if (!isOn() || !v) return;
      const L = loopOf();
      L[which] = Math.max(0, time != null ? time : v.currentTime);
      if (L.a != null && L.b != null && L.b < L.a) [L.a, L.b] = [L.b, L.a];
      if (L.a != null && L.b != null && L.b - L.a < 0.05) L[which === 'a' ? 'b' : 'a'] = null;
      save();
      toast(`${which === 'a' ? 'Loop start' : 'Loop end'} ${fmtTime(L[which])}`);
    }

    function nudgeLoop(which, d) {
      const L = song.loop;
      if (!L || L[which] == null) return;
      const v = video();
      const max = v && v.duration ? v.duration : Infinity;
      const next = Math.max(0, Math.min(max, L[which] + d));
      const other = L[which === 'a' ? 'b' : 'a'];
      if (other != null && (which === 'a' ? next >= other - 0.05 : next <= other + 0.05)) return;
      L[which] = next;
      save();
    }

    // Moves A and B onto the nearest bar lines of the tapped beat grid.
    function snapLoop() {
      const L = song.loop;
      if (!L || L.a == null || !song.bpm) return;
      const bar = (60 / song.bpm) * perBarOf();
      const start = song.start || 0;
      const snap = x => start + Math.round((x - start) / bar) * bar;
      L.a = Math.max(0, snap(L.a));
      if (L.b != null) L.b = Math.max(L.a + bar, snap(L.b));
      save();
    }

    function toggleLoop() {
      if (!isOn()) return;
      const L = loopOf();
      if (L.a == null || L.b == null) {
        openPanel();
        note = 'Mark the loop first: [ at its start, ] at its end.';
        refresh();
        return;
      }
      L.on = !L.on;
      save();
      toast(L.on ? `Loop ${fmtTime(L.a)} \u2013 ${fmtTime(L.b)}` : 'Loop off');
      const v = video();
      if (!L.on || !v) return;
      audio(); // inside the key press or click, so the count-in can sound later
      // Switched on from outside the loop: start at its beginning.
      if (v.currentTime < L.a - 0.05 || v.currentTime >= L.b) {
        if (L.countIn && song.bpm) countIn(false, { target: L.a, keepPanel: true });
        else v.currentTime = L.a;
      }
    }

    // The loop on the progress bar: outlined while marked, filled while looping.
    let loopBar = null;
    function drawLoopBar() {
      const p = player();
      const host = p && p.querySelector('.ytp-progress-bar');
      const v = video();
      const L = song.loop;
      const dur = v && v.duration;
      if (!isWatch() || !host || !dur || !isFinite(dur) || isAd() || !isOn() || !L || L.a == null) {
        if (loopBar) { loopBar.remove(); loopBar = null; }
        return;
      }
      if (!loopBar) loopBar = el('div', 'ytu-ci-loopbar');
      const end = L.b != null ? L.b : L.a;
      loopBar.style.left = (L.a / dur) * 100 + '%';
      loopBar.style.width = Math.max(0.2, ((end - L.a) / dur) * 100) + '%';
      loopBar.classList.toggle('ytu-ci-loop-active', !!L.on && L.b != null);
      loopBar.classList.toggle('ytu-ci-loop-open', L.b == null);
      if (loopBar.parentElement !== host) host.appendChild(loopBar);
    }
    disposers.push(() => { if (loopBar) loopBar.remove(); });

    let toastTimer = null;
    function toast(text) {
      const p = player();
      if (!p) return;
      let box = p.querySelector('.ytu-ci-toast');
      if (!box) { box = el('div', 'ytu-ci-toast'); p.appendChild(box); }
      box.textContent = text;
      box.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { box.style.opacity = '0'; }, 1200);
    }
    disposers.push(() => { const b = document.querySelector('.ytu-ci-toast'); if (b) b.remove(); });

    function toggleMetronome() {
      if (!isOn()) return;
      if (!song.bpm) {
        openPanel();
        note = 'Set the tempo first: play the song and tap R on every beat.';
        refresh();
        return;
      }
      song.metronome = !song.metronome;
      if (song.metronome) audio(); // inside the key press or click, so the browser lets it sound
      metroReset();
      save();
      toast(song.metronome ? `Metronome on \u00b7 ${fmtBpm(song.bpm)} BPM` : 'Metronome off');
    }

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
      b.addEventListener('click', e => { e.stopPropagation(); onClick(e); });
      return b;
    };
    const row = (label, ...kids) => {
      const r = el('div', 'ytu-ci-row');
      r.append(el('span', 'ytu-ci-label', label), ...kids);
      return r;
    };

    function showOverlay(job, beats, perBar) {
      const p = player();
      if (!s.showCount || !p) return;
      const box = el('div', 'ytu-ci-overlay');
      const num = el('div', 'ytu-ci-num');
      const dots = el('div', 'ytu-ci-dots');
      for (let i = 0; i < beats; i++) dots.appendChild(el('span', i % perBar === 0 ? 'ytu-ci-accent' : ''));
      box.append(num, dots);
      p.appendChild(box);
      job.overlay = { box, num, dots };
    }

    function showBeat(job, i, perBar) {
      if (!job.overlay) return;
      job.overlay.num.textContent = String((i % perBar) + 1); // "1 2 3 4 1 2 3 4", like a drummer counts
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
      add('path', { d: 'M12 16l5-9', class: 'ytu-ci-arm' }); // pendulum
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
      // Keep the player from reading clicks in here as play/pause or fullscreen toggles.
      // (Keys are shielded in onKey: YouTube sees them before anything inside the player does.)
      for (const type of ['click', 'mousedown', 'mouseup', 'dblclick', 'wheel', 'contextmenu']) {
        p.addEventListener(type, e => e.stopPropagation());
      }
      const section = (caption, ...kids) => {
        const sec = el('div', 'ytu-ci-section');
        if (caption) sec.appendChild(caption);
        sec.append(...kids);
        return sec;
      };
      const caption = (text, ...kids) => {
        const c = el('div', 'ytu-ci-caption');
        c.append(el('span', '', text), ...kids);
        return c;
      };
      const stepper = (label, get, set, min, max) => {
        const box = el('div', 'ytu-ci-stepper');
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', label);
        const val = el('span');
        box.append(
          btnEl('\u2212', 'Fewer', () => set(Math.max(min, get() - 1))),
          val,
          btnEl('+', 'More', () => set(Math.min(max, get() + 1))),
        );
        return { box, val };
      };

      // Header: title, on/off for this video, close.
      const head = el('div', 'ytu-ci-head');
      const sw = el('label', 'ytu-ci-switch');
      sw.title = 'Count-in for this video';
      ui.on = el('input');
      ui.on.type = 'checkbox';
      ui.on.setAttribute('aria-label', 'Count-in for this video');
      ui.on.addEventListener('change', () => {
        song.enabled = ui.on.checked;
        if (!song.enabled) { abort(); taps = []; }
        save();
      });
      sw.append(ui.on, el('span'));
      head.append(el('span', 'ytu-ci-title', 'Count-in'), sw, btnEl('\u00d7', 'Close', closePanel, 'ytu-ci-x'));
      const offNote = el('div', 'ytu-ci-off-note', 'Off for this video, so R and G do nothing here. Switch it on to count in.');

      // Tempo: the number itself is editable; the round buttons nudge it by one.
      const setBpm = b => { if (b) { song.bpm = Math.round(Math.min(300, Math.max(30, b)) * 100) / 100; save(); } };
      ui.bpm = el('input', 'ytu-ci-bpm');
      Object.assign(ui.bpm, { type: 'text', inputMode: 'decimal', placeholder: '\u2014', autocomplete: 'off' });
      ui.bpm.setAttribute('aria-label', 'Tempo in BPM');
      ui.bpm.addEventListener('change', () => {
        const b = parseFloat(ui.bpm.value.replace(',', '.'));
        if (b >= 30 && b <= 300) setBpm(b); else refresh();
      });
      const bpmBox = el('div', 'ytu-ci-bpmbox');
      bpmBox.append(ui.bpm, el('span', 'ytu-ci-bpmunit', 'BPM'));
      const tempo = el('div', 'ytu-ci-tempo');
      tempo.append(
        btnEl('\u2212', 'Slower by 1 BPM', () => setBpm(Math.round(song.bpm || 121) - 1), 'ytu-ci-round'),
        bpmBox,
        btnEl('+', 'Faster by 1 BPM', () => setBpm(Math.round(song.bpm || 119) + 1), 'ytu-ci-round'),
      );
      ui.tap = btnEl('', 'Tap on every beat while the song plays, starting on bar 1', tap, 'ytu-ci-tap');
      ui.tap.append(el('span', 'ytu-ci-dot'), el('span', '', 'Tap along'), el('span', 'ytu-ci-key', 'R'));
      ui.note = el('div', 'ytu-ci-hint');

      // Where the song starts, and how the count is shaped.
      ui.start = el('span', 'ytu-ci-val');
      const nudge = d => { if (song.start != null) { song.start = Math.max(0, song.start + d); save(); } };
      const barRow = el('div', 'ytu-ci-row');
      barRow.append(
        el('span', 'ytu-ci-label', 'Bar 1 at'), ui.start,
        btnEl('\u2039', '20 ms earlier', () => nudge(-0.02), 'ytu-ci-small'),
        btnEl('\u203a', '20 ms later', () => nudge(0.02), 'ytu-ci-small'),
        btnEl('Here', 'Bar 1 starts at the current position', () => {
          const v = video();
          if (v) { song.start = v.currentTime; save(); }
        }),
      );
      ui.metro = el('input');
      ui.metro.type = 'checkbox';
      ui.metro.setAttribute('aria-label', 'Metronome along with the video');
      ui.metro.addEventListener('change', () => { if (!!song.metronome !== ui.metro.checked) toggleMetronome(); refresh(); });
      const metroSwitch = el('label', 'ytu-ci-switch');
      metroSwitch.title = 'Keep clicking along with the video';
      metroSwitch.append(ui.metro, el('span'));
      const metroRow = el('div', 'ytu-ci-row');
      metroRow.append(el('span', 'ytu-ci-label', 'Metronome'), el('span', 'ytu-ci-key', '\u21e7R'), metroSwitch);

      const clicks = stepper('Clicks before the song', beatsOf, n => { song.beats = n; save(); }, 1, 16);
      const bar = stepper('Beats per bar', perBarOf, n => { song.perBar = n; save(); }, 1, 12);
      ui.beats = clicks.val;
      ui.perBar = bar.val;
      const clicksRow = el('div', 'ytu-ci-row');
      clicksRow.append(el('span', 'ytu-ci-label', 'Count'), clicks.box, el('span', 'ytu-ci-unit', 'clicks'));
      const barLenRow = el('div', 'ytu-ci-row');
      barLenRow.append(el('span', 'ytu-ci-label', 'Bar length'), bar.box, el('span', 'ytu-ci-unit', 'beats'));

      // Sound: a dropdown (drums first), heard as soon as you pick one; ▶ plays it again.
      ui.sound = el('select', 'ytu-ci-sound');
      ui.sound.setAttribute('aria-label', 'Count-in sound');
      const groups = {};
      for (const [id, snd] of Object.entries(SOUNDS)) {
        const name = snd.group || 'Other';
        if (!groups[name]) {
          groups[name] = el('optgroup');
          groups[name].label = name;
          ui.sound.appendChild(groups[name]);
        }
        const o = el('option', '', snd.label);
        o.value = id;
        groups[name].appendChild(o);
      }
      ui.sound.addEventListener('change', () => {
        soundId = ui.sound.value;
        ctx.storage.set('sound', soundId);
        preview();
      });
      const soundRow = el('div', 'ytu-ci-row');
      soundRow.append(
        el('span', 'ytu-ci-label', 'Sound'), ui.sound,
        btnEl('\u25b6\ufe0e', 'Play it', preview, 'ytu-ci-small'),
      );

      // Loop: A and B, each nudged by 50 ms (10 ms with Shift), snapped to bars, and how it repeats.
      const loopPoint = (which, label, key) => {
        const val = el('span', 'ytu-ci-val');
        const r = el('div', 'ytu-ci-row');
        r.append(
          el('span', 'ytu-ci-label', label), val,
          btnEl('\u2039', '50 ms earlier (Shift: 10 ms)', e => nudgeLoop(which, e && e.shiftKey ? -0.01 : -0.05), 'ytu-ci-small'),
          btnEl('\u203a', '50 ms later (Shift: 10 ms)', e => nudgeLoop(which, e && e.shiftKey ? 0.01 : 0.05), 'ytu-ci-small'),
          btnEl('Set', `Set the loop ${which === 'a' ? 'start' : 'end'} to the current position`, () => setLoopPoint(which), '', key),
        );
        return { r, val };
      };
      const la = loopPoint('a', 'Start', '[');
      const lb = loopPoint('b', 'End', ']');
      ui.loopA = la.val;
      ui.loopB = lb.val;
      ui.loopOn = el('input');
      ui.loopOn.type = 'checkbox';
      ui.loopOn.setAttribute('aria-label', 'Loop');
      ui.loopOn.addEventListener('change', () => { if (!!(song.loop && song.loop.on) !== ui.loopOn.checked) toggleLoop(); refresh(); });
      const loopSwitch = el('label', 'ytu-ci-switch');
      loopSwitch.title = 'Loop between start and end (\\)';
      loopSwitch.append(ui.loopOn, el('span'));
      ui.loopCount = el('input');
      ui.loopCount.type = 'checkbox';
      ui.loopCount.setAttribute('aria-label', 'Count in before every repeat');
      ui.loopCount.addEventListener('change', () => { loopOf().countIn = ui.loopCount.checked; save(); });
      const countSwitch = el('label', 'ytu-ci-switch');
      countSwitch.append(ui.loopCount, el('span'));
      const countRow = el('div', 'ytu-ci-row');
      countRow.append(el('span', 'ytu-ci-label', 'Count in every repeat'), countSwitch);
      ui.loopInfo = el('span', 'ytu-ci-loopinfo');
      ui.snap = btnEl('Snap to bars', 'Move start and end onto the nearest bar lines', snapLoop);
      const infoRow = el('div', 'ytu-ci-row');
      infoRow.append(ui.loopInfo, ui.snap);

      const actions = el('div', 'ytu-ci-actions');
      actions.append(
        btnEl('Count in', 'Count in and play from bar 1', () => countIn(false), 'ytu-ci-primary', 'G'),
        btnEl('From here', 'Count in from the bar you are at', () => countIn(true), '', '\u21e7G'),
      );

      const body = el('div', 'ytu-ci-body');
      body.append(
        section(caption('Tempo',
          btnEl('\u00bd', 'Half the tempo', () => setBpm(song.bpm / 2)),
          btnEl('\u00d72', 'Double the tempo', () => setBpm(song.bpm * 2))),
        tempo, ui.tap, ui.note),
        section(null, metroRow, barRow, clicksRow, barLenRow, soundRow),
        section(caption('Loop', el('span', 'ytu-ci-key', '\\'), loopSwitch), la.r, lb.r, infoRow, countRow),
        actions,
      );
      p.append(head, offNote, body);
      return p;
    }

    function refresh() {
      const onHere = isOn();
      if (btn) {
        btn.classList.toggle('ytu-ci-set', onHere && !!song.bpm);
        btn.classList.toggle('ytu-ci-disabled', !onHere);
        btn.classList.toggle('ytu-ci-metro', metroOn());
        btn.title = !onHere ? 'Count-in (off for this video)' : song.bpm ? `Count-in \u00b7 ${fmtBpm(song.bpm)} BPM (G)${song.metronome ? ' \u00b7 metronome on' : ''}` : 'Count-in (G)';
      }
      if (!panel) return;
      ui.on.checked = onHere;
      panel.classList.toggle('ytu-ci-off', !onHere);
      if (document.activeElement !== ui.bpm) ui.bpm.value = song.bpm ? fmtBpm(song.bpm) : '';
      ui.beats.textContent = String(beatsOf());
      ui.perBar.textContent = String(perBarOf());
      ui.start.textContent = song.start != null ? fmtTime(song.start) : 'not set';
      ui.note.textContent = note || (song.bpm ? '' : 'Play the song and tap on every beat, from bar 1.');
      if (document.activeElement !== ui.sound) ui.sound.value = soundId;
      ui.metro.checked = !!song.metronome;
      ui.metro.disabled = !song.bpm;
      const L = song.loop || {};
      ui.loopA.textContent = L.a != null ? fmtTime(L.a) : 'not set';
      ui.loopB.textContent = L.b != null ? fmtTime(L.b) : 'not set';
      ui.loopOn.checked = !!L.on;
      ui.loopOn.disabled = L.a == null || L.b == null;
      ui.loopCount.checked = !!L.countIn;
      ui.loopCount.disabled = !song.bpm;
      ui.snap.disabled = L.a == null || !song.bpm;
      if (L.a != null && L.b != null) {
        const len = L.b - L.a;
        const bars = song.bpm ? len / ((60 / song.bpm) * perBarOf()) : null;
        ui.loopInfo.textContent = `${len.toFixed(2)} s` + (bars != null ? ` \u00b7 ${Math.round(bars * 10) / 10} bars` : '');
      } else ui.loopInfo.textContent = '';
      drawLoopBar();
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
      const ours = e.type === 'keydown' && !e.ctrlKey && !e.metaKey && !e.altKey && (k === 'g' || k === 'r' || ['[', ']', '\\'].includes(e.key));
      if (inPanel && !(ours && isOn())) {
        e.stopImmediatePropagation();
        if (e.type === 'keydown' && e.key === 'Enter' && e.target === ui.bpm) ui.bpm.blur(); // applies it
        return;
      }
      if (!ours || !isWatch() || !isOn() || (!inPanel && inTextField(e.target))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.key === '[') setLoopPoint('a');
      else if (e.key === ']') setLoopPoint('b');
      else if (e.key === '\\') toggleLoop();
      else if (k === 'r' && e.shiftKey) toggleMetronome();
      else if (k === 'r') tap();
      else countIn(e.shiftKey);
    }
    for (const type of ['keydown', 'keypress', 'keyup']) on(window, type, onKey, true);

    // -------------------------------------------------------------- page tracking
    function poll() {
      const id = isWatch() ? currentVideoId() : null;
      if (id !== videoId) {
        abort();
        metroReset();
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
