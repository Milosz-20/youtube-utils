// Precise playback speed — port of github.com/Milosz-20/YtPlaybackSpeedControl
YTU.register({
  id: 'playback-speed',
  name: 'Precise playback speed',
  description: 'Shift + > / Shift + < changes the speed in small steps and shows a subtle indicator on the video.',
  settings: {
    step: { type: 'number', label: 'Step', default: 0.05, min: 0.01, max: 1, step: 0.01 },
    min: { type: 'number', label: 'Minimum speed', default: 0.05, min: 0.05, max: 1, step: 0.05 },
    max: { type: 'number', label: 'Maximum speed', default: 16, min: 1, max: 16, step: 0.25 },
    showIndicator: { type: 'boolean', label: 'Show speed indicator', default: true },
  },

  run(ctx) {
    const s = ctx.settings;

    function getPlayer() {
      return (
        (window.ytPlayer && window.ytPlayer.app && window.ytPlayer.app.getCurrentPlayer && window.ytPlayer.app.getCurrentPlayer()) ||
        document.querySelector('#movie_player')
      );
    }

    function isTyping() {
      const el = document.activeElement;
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function adjustPlayback(delta) {
      const player = getPlayer();
      if (!player) return;

      const current = typeof player.getPlaybackRate === 'function'
        ? player.getPlaybackRate()
        : player.playbackRate || 1;

      let rate = Math.min(Math.max(current + delta, s.min), s.max);
      rate = Math.round(rate * 100) / 100;

      if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(rate);
      else player.playbackRate = rate;

      if (s.showIndicator) showIndicator(rate);
    }

    let indicator = null;
    let hideTimer = null;

    function showIndicator(rate) {
      const player = document.querySelector('.html5-video-player');
      if (!player) return;
      if (!indicator) {
        indicator = document.createElement('div');
        Object.assign(indicator.style, {
          position: 'absolute',
          bottom: '12%',
          right: '3%',
          background: 'rgba(0, 0, 0, 0.65)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          fontWeight: '600',
          padding: '6px 12px',
          borderRadius: '8px',
          zIndex: '999999',
          opacity: '0',
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease',
        });
      }
      player.appendChild(indicator);
      indicator.textContent = rate.toFixed(2) + '×';
      indicator.style.opacity = '1';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { indicator.style.opacity = '0'; }, 1000);
    }

    function onKey(e) {
      if (isTyping() || e.ctrlKey || e.altKey || e.metaKey || !e.shiftKey) return;
      const inc = e.code === 'Period' || e.key === '>' || e.key === '.';
      const dec = e.code === 'Comma' || e.key === '<' || e.key === ',';
      if (!inc && !dec) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      adjustPlayback(inc ? s.step : -s.step);
    }

    window.addEventListener('keydown', onKey, true);

    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(hideTimer);
      if (indicator) indicator.remove();
    };
  },
});
