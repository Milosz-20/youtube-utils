// Picks your preferred quality whenever a new video starts, instead of YouTube's "Auto".
YTU.register({
  id: 'default-quality',
  name: 'Default video quality',
  description: 'Every new video starts in your chosen quality. If it isn\'t available, the next lower one is used. You can still change it per video from the ⚙ menu.',
  settings: {
    quality: {
      type: 'select',
      label: 'Preferred quality',
      default: 'hd1080',
      options: [
        { value: 'max', label: 'Highest available' },
        { value: 'hd2160', label: '2160p (4K)' },
        { value: 'hd1440', label: '1440p' },
        { value: 'hd1080', label: '1080p' },
        { value: 'hd720', label: '720p' },
        { value: 'large', label: '480p' },
        { value: 'medium', label: '360p' },
        { value: 'small', label: '240p' },
        { value: 'tiny', label: '144p' },
      ],
    },
    includeShorts: { type: 'boolean', label: 'Apply to Shorts too', default: true },
  },

  run(ctx) {
    const s = ctx.settings;
    // Best first. YouTube's internal names for each resolution.
    const ORDER = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
    const rank = q => ORDER.indexOf(q);

    // Wanted quality if available, otherwise the best one below it, otherwise the lowest there is.
    function pick(levels) {
      const avail = levels.filter(l => rank(l) >= 0).sort((a, b) => rank(a) - rank(b));
      if (!avail.length) return null;
      if (s.quality === 'max') return avail[0];
      return avail.find(l => rank(l) >= rank(s.quality)) || avail[avail.length - 1];
    }

    // Remembers which video each player was already set for, so a manual change sticks.
    const applied = new WeakMap();

    function apply() {
      const players = [document.querySelector('#movie_player')];
      if (s.includeShorts) players.push(document.querySelector('#shorts-player'));

      for (const p of players) {
        if (!p || typeof p.getAvailableQualityLevels !== 'function') continue;
        if (p.classList.contains('ad-showing')) continue; // wait for the ad to finish
        const data = typeof p.getVideoData === 'function' ? p.getVideoData() : null;
        const videoId = data && data.video_id;
        if (!videoId || applied.get(p) === videoId) continue;

        const levels = p.getAvailableQualityLevels();
        if (!levels || !levels.length) continue; // player not ready yet
        const q = pick(levels);
        if (!q) continue;

        if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange(q, q);
        if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality(q);
        applied.set(p, videoId);
        ctx.log(`set ${q} for ${videoId}`);
      }
    }

    const timer = setInterval(apply, 1000);
    document.addEventListener('yt-navigate-finish', apply);

    // New preference: re-apply to the video that's playing now.
    const offChange = ctx.onChange(() => {
      for (const sel of ['#movie_player', '#shorts-player']) {
        const p = document.querySelector(sel);
        if (p) applied.delete(p);
      }
      apply();
    });

    return () => {
      clearInterval(timer);
      document.removeEventListener('yt-navigate-finish', apply);
      offChange();
    };
  },
});
