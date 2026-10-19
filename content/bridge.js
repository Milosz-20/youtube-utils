// Runs in the extension's isolated world. Page-world modules can't use browser.storage,
// so this forwards the saved settings to them (and again whenever they change).
(() => {
  // Page-world modules can't look up the extension's own address, which modules/tab-player.js needs.
  document.documentElement.dataset.ytuBase = browser.runtime.getURL('');

  async function send() {
    const { settings = {} } = await browser.storage.local.get('settings');
    // Pass a string: objects don't cross the isolated/page boundary cleanly in Firefox.
    document.dispatchEvent(new CustomEvent('ytu:settings', { detail: JSON.stringify(settings) }));
  }

  document.addEventListener('ytu:hello', send);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) send();
  });
  send();
})();
