// Stops Shift + ? from opening YouTube's keyboard shortcuts overlay.
YTU.register({
  id: 'block-shortcuts-help',
  name: 'Block the Shift + ? shortcuts menu',
  description: 'Pressing Shift + ? no longer opens YouTube\'s keyboard shortcuts overlay. Typing "?" in text fields still works.',

  run(ctx) {
    function onKey(e) {
      if (e.key !== '?' || !e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  },
});
