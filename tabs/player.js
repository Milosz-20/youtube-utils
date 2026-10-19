// The tab window's contents: draws a Songsterr tab with alphaTab and keeps its cursor on the video.
// Lives in an extension frame inside YouTube's page; modules/tab-player.js on the YouTube side sends
// the video's time and carries out the seeks, plays and pauses asked for here.
(() => {
  const YOUTUBE = 'https://www.youtube.com';
  const $ = id => document.getElementById(id);
  const ui = {
    track: $('track'), status: $('status'), b1: $('b1'), b1Time: $('b1Time'), zoom: $('zoom'), zoomVal: $('zoomVal'), bar1: $('bar1'), pin: $('pin'), reset: $('reset'), edit: $('edit'),
    note: $('note'), noteText: $('noteText'), form: $('form'), url: $('url'), grant: $('grant'), err: $('err'), remove: $('remove'),
  };

  const post = msg => window.parent.postMessage(msg, YOUTUBE);

  // -------------------------------------------------------------- per-video record
  // { url, track (index into the tab's tracks), sync: alphaTab FlatSyncPoint[] for bars after bar 1,
  //   plus bar 1 itself only while Practice has no bar 1 for this video }
  let videoId = null;
  let bar1Linked = null; // ms where Practice's bar 1 is; the one place bar 1 is set, when it's set
  let rec = {};
  const key = () => 'tab:' + videoId;
  async function readRec() {
    const got = await browser.storage.local.get(key());
    return got[key()] || {};
  }
  function saveRec() {
    if (!videoId) return;
    if (rec.url) browser.storage.local.set({ [key()]: rec });
    else browser.storage.local.remove(key());
  }

  // -------------------------------------------------------------- the video, as YouTube last reported it
  const video = { ms: 0, paused: true, rate: 1, duration: 0 };
  // alphaTab seeks when you let go of a click on a note; armed from press to just after release.
  let clicking = false;
  $('score').addEventListener('pointerdown', () => { clicking = true; });
  window.addEventListener('pointerup', () => setTimeout(() => { clicking = false; }, 100), true);

  // alphaTab drives the video through this, e.g. when you click a note.
  const handler = {
    get backingTrackDuration() { return video.duration; },
    get playbackRate() { return video.rate; },
    set playbackRate(value) { if (value !== video.rate) post({ type: 'ytu-tp:rate', rate: value }); },
    get masterVolume() { return 1; },
    set masterVolume(_) { /* the video's own volume control stays in charge */ },
    // alphaTab also seeks on its own whenever it reloads the song, changes speed or gets new sync
    // points. Only a click in the tab may move the video; otherwise put alphaTab back where the video is.
    seekTo(ms) {
      if (clicking) {
        video.ms = ms;
        post({ type: 'ytu-tp:seek', ms });
      } else {
        setTimeout(() => api.player.output.updatePosition(video.ms), 0);
      }
    },
    play() { if (video.paused) post({ type: 'ytu-tp:play' }); },
    pause() { if (!video.paused) post({ type: 'ytu-tp:pause' }); },
  };

  // -------------------------------------------------------------- alphaTab
  const api = new alphaTab.AlphaTabApi($('score'), {
    core: { fontDirectory: '../vendor/alphatab/font/', useWorkers: false },
    display: { scale: 0.9, staveProfile: alphaTab.StaveProfile.Tab },
    player: {
      playerMode: alphaTab.PlayerMode.EnabledExternalMedia,
      enableCursor: true,
      enableAnimatedBeatCursor: true,
      enableUserInteraction: true,
      scrollElement: document.querySelector('main'),
      scrollOffsetY: -40,
    },
  });
  api.player.output.handler = handler;

  let loaded = null;   // { meta, score } of the tab on screen
  let tick = 0;        // alphaTab's playback position
  api.playerPositionChanged.on(e => { tick = e.currentTick; refreshStatus(); });

  // The bars in play order (a repeated bar shows up once per time it's played).
  const playedBars = () => (api.tickCache ? api.tickCache.masterBars : []);
  function barAt(t) {
    const bars = playedBars();
    for (let i = 0; i < bars.length; i++) if (t < bars[i].end) return i;
    return bars.length - 1;
  }
  function occurrence(i) {
    const bars = playedBars();
    let n = 0;
    for (let j = 0; j < i; j++) if (bars[j].masterBar.index === bars[i].masterBar.index) n++;
    return n;
  }

  function applySync() {
    if (!loaded) return;
    const sync = [bar1Point(bar1Ms()), ...(rec.sync || []).filter(p => !isBar1(p))];
    loaded.score.applyFlatSyncPoints(sync);
    api.updateSyncPoints();
    api.player.output.updatePosition(video.ms);
  }

  // Pin the bar the cursor is in (or about to reach) to the video's current time.
  function pinBar() {
    const bars = playedBars();
    if (!loaded || !bars.length) return;
    let i = barAt(tick);
    const b = bars[i];
    // Pressed a little late or a little early, on the downbeat either way.
    if (tick - b.start > (b.end - b.start) / 2 && i + 1 < bars.length) i++;
    if (i === 0) { setBar1(video.ms); return; }
    const point = { barIndex: bars[i].masterBar.index, barOccurence: occurrence(i), barPosition: 0, millisecondOffset: video.ms };
    const same = p => p.barIndex === point.barIndex && p.barOccurence === point.barOccurence;
    rec.sync = [...(rec.sync || []).filter(p => !same(p)), point];
    saveRec();
    applySync();
    refreshStatus();
  }

  // Bar 1 is shared with Practice: setting it here moves the metronome's bar 1 and the other
  // way round. The YouTube side writes it there and reports back. Later sync points stay put.
  const isBar1 = p => p.barIndex === 0 && p.barOccurence === 0;
  const bar1Point = ms => ({ barIndex: 0, barOccurence: 0, barPosition: 0, millisecondOffset: ms });
  function bar1Ms() {
    if (bar1Linked != null) return bar1Linked;
    const p = (rec.sync || []).find(isBar1); // set here before it was shared
    return p ? p.millisecondOffset : 0;
  }
  function setBar1(ms) {
    bar1Linked = Math.max(0, Math.round(ms));
    post({ type: 'ytu-tp:bar1', ms: bar1Linked });
    applySync();
    refreshStatus();
  }
  const fmtTime = ms => {
    const t = ms / 1000;
    const m = Math.floor(t / 60);
    return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0');
  };
  // "1:02.35", "62.35" or "62,35".
  function parseTime(text) {
    const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d*)?)\s*$/.exec(text);
    return m ? ((Number(m[1]) || 0) * 60 + Number(m[2].replace(',', '.'))) * 1000 : null;
  }

  function refreshStatus() {
    if (!loaded) return;
    if (document.activeElement !== ui.b1Time) ui.b1Time.value = fmtTime(bar1Ms());
    const bars = playedBars();
    const bar = bars.length ? bars[barAt(tick)].masterBar.index + 1 : 1;
    const pins = (rec.sync || []).filter(p => !isBar1(p)).length;
    ui.status.textContent = `Bar ${bar}${pins ? ` · ${pins} more sync point${pins > 1 ? 's' : ''}` : ''}`;
  }

  // -------------------------------------------------------------- showing a tab
  function showNote(text, { form = false, grant = false, err = '' } = {}) {
    ui.note.hidden = false;
    ui.noteText.textContent = text;
    ui.form.hidden = !form;
    ui.grant.hidden = !grant;
    ui.err.textContent = err;
    ui.remove.hidden = !(form && rec.url);
    for (const b of [ui.track, ui.b1, ui.pin, ui.reset, ui.zoom]) b.hidden = true;
    ui.status.textContent = '';
    if (form) {
      ui.url.value = rec.url || '';
      setTimeout(() => ui.url.focus(), 0);
    }
  }

  function showForm(err) {
    showNote('Paste the link to this song\'s tab on Songsterr.', { form: true, err });
  }

  let loadId = 0;
  async function load() {
    const id = ++loadId;
    loaded = null;
    if (!rec.url) { showForm(); return; }
    showNote('Loading the tab…');
    let got;
    try {
      got = await Songsterr.load(rec.url);
    } catch (err) {
      if (id !== loadId) return;
      // A blocked fetch fails without a status: no permission for Songsterr's sites yet.
      if (!err.status && !(await browser.permissions.contains({ origins: Songsterr.ORIGINS }))) {
        showNote('The extension needs your permission to read tabs from Songsterr.', { grant: true });
      } else {
        showForm(`Couldn't load that tab: ${err.message}`);
      }
      return;
    }
    if (id !== loadId) return;
    loaded = got;
    ui.note.hidden = true;

    ui.track.replaceChildren(...got.score.tracks.map((t, i) => new Option(t.name || `Track ${i + 1}`, String(i))));
    if (!(rec.track >= 0 && rec.track < got.score.tracks.length)) rec.track = defaultTrack(got);
    ui.track.value = String(rec.track);
    for (const b of [ui.track, ui.b1, ui.pin, ui.reset, ui.zoom]) b.hidden = false;
    showTrack(got.score.tracks[rec.track], true);
  }

  // Tab only, except drums, which have no tab to show.
  function showTrack(track, whole) {
    const profile = track.staves[0] && track.staves[0].isPercussion ? alphaTab.StaveProfile.Default : alphaTab.StaveProfile.Tab;
    if (api.settings.display.staveProfile !== profile) {
      api.settings.display.staveProfile = profile;
      api.updateSettings();
    }
    if (whole) api.renderScore(loaded.score, [track.index]);
    else api.renderTracks([track]);
  }

  // The track the link points at, else the first guitar, else the first one.
  function defaultTrack(got) {
    const linked = Songsterr.linkedTrack(rec.url);
    if (linked != null && linked < got.score.tracks.length) return linked;
    const guitar = (got.meta.tracks || []).findIndex(t => t.instrumentId >= 24 && t.instrumentId <= 31);
    return guitar >= 0 ? guitar : 0;
  }

  // alphaTab rebuilds its timing when it renders, so the sync goes back on afterwards.
  api.midiLoaded.on(() => { applySync(); refreshStatus(); });

  // -------------------------------------------------------------- controls
  ui.form.addEventListener('submit', e => {
    e.preventDefault();
    const url = Songsterr.parseLink(ui.url.value);
    if (!url) { ui.err.textContent = 'That isn\'t a link to a Songsterr tab.'; return; }
    if (url !== rec.url) rec = { url };
    saveRec();
    load();
  });
  ui.remove.addEventListener('click', () => { rec = {}; saveRec(); showForm(); });
  // Size of the tab, the same for every video.
  const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  function setZoom(z, save = true) {
    const scale = Math.min(ZOOMS[ZOOMS.length - 1], Math.max(ZOOMS[0], z));
    ui.zoomVal.textContent = Math.round(scale * 100) + '%';
    if (save) browser.storage.local.set({ tabZoom: scale });
    if (api.settings.display.scale === scale) return;
    api.settings.display.scale = scale;
    api.updateSettings();
    if (loaded) api.render();
  }
  function stepZoom(dir) {
    const now = api.settings.display.scale;
    const next = dir > 0 ? ZOOMS.find(z => z > now + 1e-6) : [...ZOOMS].reverse().find(z => z < now - 1e-6);
    if (next != null) setZoom(next);
  }
  $('zoomOut').addEventListener('click', () => stepZoom(-1));
  $('zoomIn').addEventListener('click', () => stepZoom(1));
  document.querySelector('main').addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  setZoom(api.settings.display.scale, false);
  browser.storage.local.get('tabZoom').then(got => { if (got.tabZoom) setZoom(got.tabZoom, false); });

  ui.edit.addEventListener('click', () => { loadId++; loaded = null; showForm(); });
  ui.grant.addEventListener('click', async () => {
    if (await browser.permissions.request({ origins: Songsterr.ORIGINS })) load();
  });
  ui.track.addEventListener('change', () => {
    rec.track = Number(ui.track.value);
    saveRec();
    showTrack(loaded.score.tracks[rec.track], false);
  });
  ui.bar1.addEventListener('click', () => setBar1(video.ms));
  $('b1Minus').addEventListener('click', () => setBar1(bar1Ms() - 50));
  $('b1Plus').addEventListener('click', () => setBar1(bar1Ms() + 50));
  ui.b1Time.addEventListener('keydown', e => {
    if (e.key === 'Enter') ui.b1Time.blur();
    else if (e.key === 'Escape') { ui.b1Time.value = fmtTime(bar1Ms()); ui.b1Time.blur(); }
  });
  ui.b1Time.addEventListener('change', () => {
    const ms = parseTime(ui.b1Time.value);
    if (ms == null) ui.b1Time.value = fmtTime(bar1Ms());
    else setBar1(ms);
  });
  ui.pin.addEventListener('click', pinBar);
  ui.reset.addEventListener('click', () => { rec.sync = (rec.sync || []).filter(isBar1); saveRec(); applySync(); refreshStatus(); });

  // -------------------------------------------------------------- messages from the YouTube page
  window.addEventListener('message', async e => {
    if (e.source !== window.parent || e.origin !== YOUTUBE || !e.data) return;
    const m = e.data;
    if (m.type === 'ytu-tp:video') {
      if (m.videoId === videoId) {
        if (m.bar1Ms !== bar1Linked) { bar1Linked = m.bar1Ms; applySync(); refreshStatus(); }
        return;
      }
      bar1Linked = m.bar1Ms;
      videoId = m.videoId;
      rec = videoId ? await readRec() : {};
      load();
    } else if (m.type === 'ytu-tp:time') {
      const started = video.paused && !m.paused;
      const stopped = !video.paused && m.paused;
      Object.assign(video, { ms: m.ms, paused: m.paused, rate: m.rate, duration: m.duration });
      if (!loaded) return;
      if (api.playbackSpeed !== m.rate) api.playbackSpeed = m.rate;
      api.player.output.updatePosition(m.ms);
      if (started) api.play();
      if (stopped) api.pause();
    }
  });

  // Keys go to whichever frame has focus, so after a click in the tab YouTube wouldn't hear them.
  // Pass them to the page: H hides this window, the rest acts on the video and the extension.
  window.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) { post({ type: 'ytu-tp:toggle' }); return; }
    const { key, code, shiftKey, ctrlKey, altKey, metaKey } = e;
    post({ type: 'ytu-tp:key', key, code, shiftKey, ctrlKey, altKey, metaKey });
  });

  post({ type: 'ytu-tp:ready' });
})();
