// Keeps the user scripts saved in the options page registered with Firefox's userScripts API.

const RUN_AT = { 'document-start': 'document_start', 'document-end': 'document_end', 'document-idle': 'document_idle' };

// Tiny Tampermonkey compatibility layer so simple @grant scripts keep working.
function gmShim(id) {
  const prefix = JSON.stringify(`ytu-us:${id}:`);
  return `
const unsafeWindow = window;
const GM_info = { script: { id: ${JSON.stringify(id)} } };
const GM_getValue = (k, d) => { try { const v = localStorage.getItem(${prefix} + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const GM_setValue = (k, v) => { try { localStorage.setItem(${prefix} + k, JSON.stringify(v)); } catch {} };
const GM_deleteValue = k => { try { localStorage.removeItem(${prefix} + k); } catch {} };
const GM_addStyle = css => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
const GM_registerMenuCommand = () => {};
const GM_log = (...a) => console.log(...a);
`;
}

async function syncUserScripts() {
  if (!(await browser.permissions.contains({ permissions: ['userScripts'] }))) return;
  if (!browser.userScripts) return;

  const { userScripts = [] } = await browser.storage.local.get('userScripts');

  const existing = await browser.userScripts.getScripts();
  if (existing.length) await browser.userScripts.unregister({ ids: existing.map(s => s.id) });

  const regs = userScripts
    .filter(s => s.enabled && s.matches && s.matches.length)
    .map(s => ({
      id: s.id,
      matches: s.matches,
      runAt: RUN_AT[s.runAt] || 'document_idle',
      world: 'MAIN',
      js: [{ code: `(() => {\n${gmShim(s.id)}\n${s.code}\n})();` }],
    }));

  const errors = {};
  for (const reg of regs) {
    try {
      await browser.userScripts.register([reg]);
    } catch (err) {
      errors[reg.id] = String(err && err.message || err);
    }
  }
  await browser.storage.local.set({ userScriptErrors: errors });
}

browser.runtime.onStartup.addListener(syncUserScripts);
browser.runtime.onInstalled.addListener(syncUserScripts);
browser.permissions.onAdded.addListener(syncUserScripts);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.userScripts) syncUserScripts();
});
browser.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'sync-user-scripts') return syncUserScripts().then(() => true);
});
