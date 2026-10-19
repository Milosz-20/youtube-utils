// Reads a Songsterr tab the way songsterr.com's own page does: the song's metadata from the page,
// then one JSON file per track from Songsterr's CDN. Runs in the extension page, where the host
// permissions let it fetch across sites.
const Songsterr = (() => {
  const CDNS = ['https://dqsljvtekg760.cloudfront.net', 'https://d3d3l6a6rcgkaf.cloudfront.net'];
  const ORIGINS = ['*://www.songsterr.com/*', ...CDNS.map(c => c + '/*')];

  // Only Songsterr tab pages, normalised to https://www.songsterr.com/<path>.
  function parseLink(text) {
    let u;
    try { u = new URL(String(text).trim()); } catch { return null; }
    if (!/^(www\.)?songsterr\.com$/.test(u.hostname) || !/^https?:$/.test(u.protocol)) return null;
    if (!/-s\d+/.test(u.pathname)) return null;
    return 'https://www.songsterr.com' + u.pathname;
  }

  // "…-tab-s5355403t1": the track the link was opened on, when it names one.
  function linkedTrack(url) {
    const m = /-s\d+t(\d+)$/.exec(new URL(url).pathname);
    return m ? Number(m[1]) : null;
  }

  async function fetchOk(url, as) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw Object.assign(new Error(`${res.status} from ${new URL(url).host}`), { status: res.status });
    return as === 'json' ? res.json() : res.text();
  }

  async function meta(url) {
    const html = await fetchOk(url, 'text');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const state = doc.getElementById('state');
    let current = null;
    try { current = JSON.parse(state.textContent).meta.current; } catch { /* below */ }
    if (!current || !current.songId || !current.revisionId || !current.image) {
      throw new Error('Songsterr\'s page didn\'t have the tab data where it used to. Songsterr may have changed its site.');
    }
    return current;
  }

  async function part(current, track) {
    let lastErr = null;
    for (const cdn of CDNS) {
      try {
        return await fetchOk(`${cdn}/${current.songId}/${current.revisionId}/${current.image}/${track.partId}.json`, 'json');
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  // -> { meta, score } with every track of the tab, in Songsterr's order.
  async function load(url) {
    const current = await meta(url);
    const tracks = (current.tracks || []).filter(t => typeof t.partId === 'number');
    const revisions = await Promise.all(tracks.map(async trackMeta => ({ trackMeta, revision: await part(current, trackMeta) })));
    const built = globalThis.songsterrToScore(current, revisions);
    // The converter is made for writing Guitar Pro files; reading its own file back is what fills in
    // what alphaTab needs to draw drums.
    const file = new alphaTab.exporter.Gp7Exporter().export(built.score, built.settings);
    return { meta: current, score: alphaTab.importer.ScoreLoader.loadScoreFromBytes(file, built.settings) };
  }

  return { ORIGINS, parseLink, linkedTrack, load };
})();
