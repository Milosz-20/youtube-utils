(async () => {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(c => c != null));
    return node;
  };

  const isPopup = new URLSearchParams(location.search).has('popup');
  if (isPopup) {
    document.body.classList.add('popup');
    $('#open-options').hidden = false;
    $('#open-options').onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
  }

  // ---------------------------------------------------------------- load module definitions
  // The module list lives in manifest.json only; read it from there so adding a module is one edit.
  const moduleFiles = browser.runtime.getManifest().content_scripts
    .flatMap(cs => cs.js)
    .filter(f => f.startsWith('modules/'));

  for (const file of moduleFiles) {
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = '/' + file;
      s.onload = s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------- settings storage
  let { settings = {} } = await browser.storage.local.get('settings');
  settings.modules = settings.modules || {};

  function defaultsOf(def) {
    const out = { enabled: def.enabledByDefault !== false };
    for (const [key, s] of Object.entries(def.settings || {})) if ('default' in s) out[key] = s.default;
    return out;
  }

  const current = def => ({ ...defaultsOf(def), ...(settings.modules[def.id] || {}) });

  async function save(def, key, value) {
    settings.modules[def.id] = { ...(settings.modules[def.id] || {}), [key]: value };
    await browser.storage.local.set({ settings });
  }

  // ---------------------------------------------------------------- module cards
  function switchInput(checked, onChange, label) {
    const input = el('input', { type: 'checkbox', checked });
    input.setAttribute('aria-label', label);
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: 'switch' }, input, el('span'));
  }

  function renderField(def, key, spec, cfg) {
    if (spec.type === 'boolean') {
      return el('div', { className: 'field' },
        el('span', { textContent: spec.label }),
        switchInput(!!cfg[key], v => save(def, key, v), spec.label));
    }
    if (spec.type === 'number') {
      const input = el('input', { type: 'number', value: cfg[key], min: spec.min ?? '', max: spec.max ?? '', step: spec.step ?? 'any' });
      input.setAttribute('aria-label', spec.label);
      input.addEventListener('change', () => {
        let v = parseFloat(input.value);
        if (Number.isNaN(v)) v = spec.default;
        if (spec.min != null) v = Math.max(spec.min, v);
        if (spec.max != null) v = Math.min(spec.max, v);
        input.value = v;
        save(def, key, v);
      });
      return el('label', { className: 'field' }, el('span', { textContent: spec.label }), input);
    }
    if (spec.type === 'action') {
      const btn = el('button', { className: 'secondary', textContent: spec.label });
      btn.onclick = async () => {
        await save(def, key, Date.now()); // modules react to the value changing
        btn.textContent = 'Done ✓';
        setTimeout(() => { btn.textContent = spec.label; }, 1500);
      };
      return el('div', { className: 'row' }, btn);
    }
    return null;
  }

  function renderModules() {
    const root = $('#modules');
    root.replaceChildren();
    for (const def of YTU.modules) {
      const cfg = current(def);
      const card = el('div', { className: 'card' + (cfg.enabled ? '' : ' disabled') });
      const head = el('div', { className: 'card-head' },
        el('div', {}, el('h3', { textContent: def.name }), el('p', { textContent: def.description || '' })),
        switchInput(cfg.enabled, async v => {
          card.classList.toggle('disabled', !v);
          await save(def, 'enabled', v);
        }, `Enable ${def.name}`));
      card.append(head);

      const fields = Object.entries(def.settings || {}).map(([k, spec]) => renderField(def, k, spec, cfg)).filter(Boolean);
      if (fields.length && !isPopup) card.append(el('div', { className: 'card-body' }, ...fields));
      root.append(card);
    }
  }

  renderModules();
  if (isPopup) return;

  // ---------------------------------------------------------------- user scripts
  const TEMPLATE = `// ==UserScript==
// @name         My script
// @match        https://www.youtube.com/*
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  console.log('Hello from my script');
})();
`;

  const ALLOWED_MATCH = /^(\*|https?):\/\/(\*\.)?([\w-]+\.)*youtube\.com\//;

  function parseHeader(code) {
    const block = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!block) throw new Error('Missing // ==UserScript== header.');
    const meta = { name: '', matches: [], runAt: 'document-idle' };
    for (const line of block[1].split('\n')) {
      const m = line.match(/^\s*\/\/\s*@(\S+)\s+(.+?)\s*$/);
      if (!m) continue;
      const [, key, value] = m;
      if (key === 'name' && !meta.name) meta.name = value;
      if (key === 'match' || key === 'include') meta.matches.push(value);
      if (key === 'run-at') meta.runAt = value;
    }
    if (!meta.name) throw new Error('Add a @name line.');
    if (!meta.matches.length) throw new Error('Add at least one @match line, e.g. https://www.youtube.com/*');
    const bad = meta.matches.filter(m => !ALLOWED_MATCH.test(m));
    if (bad.length) throw new Error(`This extension only runs on youtube.com. Unsupported @match:\n${bad.join('\n')}`);
    return meta;
  }

  const hasApi = () => typeof browser.userScripts !== 'undefined';
  const hasPermission = () => browser.permissions.contains({ permissions: ['userScripts'] });

  async function refreshPermissionUi() {
    const granted = await hasPermission();
    $('#us-permission').hidden = granted;
    $('#us-unsupported').hidden = !granted || hasApi();
  }

  $('#us-grant').onclick = async () => {
    // Must be called straight from the click for Firefox to show the prompt.
    let ok = false;
    try {
      ok = await browser.permissions.request({ permissions: ['userScripts'] });
    } catch (err) {
      console.warn('[YouTube Utils] permission request failed', err);
    }
    if (ok) {
      await browser.runtime.sendMessage({ type: 'sync-user-scripts' });
      refreshPermissionUi();
    } else {
      $('#us-grant-help').hidden = false;
    }
  };

  // Picks up the permission when it's granted or revoked in about:addons.
  browser.permissions.onAdded.addListener(refreshPermissionUi);
  browser.permissions.onRemoved.addListener(refreshPermissionUi);

  let editingId = null;

  async function loadScripts() {
    const { userScripts = [], userScriptErrors = {} } = await browser.storage.local.get(['userScripts', 'userScriptErrors']);
    return { scripts: userScripts, errors: userScriptErrors };
  }

  async function saveScripts(scripts) {
    await browser.storage.local.set({ userScripts: scripts });
  }

  async function renderScripts() {
    const { scripts, errors } = await loadScripts();
    const root = $('#us-list');
    root.replaceChildren();
    if (!scripts.length) root.append(el('p', { className: 'hint', textContent: 'No user scripts yet.' }));

    for (const script of scripts) {
      const edit = el('button', { className: 'secondary', textContent: 'Edit' });
      edit.onclick = () => openEditor(script);
      const del = el('button', { className: 'danger', textContent: 'Delete' });
      del.onclick = async () => {
        if (!confirm(`Delete "${script.name}"?`)) return;
        await saveScripts(scripts.filter(s => s.id !== script.id));
        renderScripts();
      };

      root.append(el('div', { className: 'card' + (script.enabled ? '' : ' disabled') },
        el('div', { className: 'card-head' },
          el('div', {},
            el('h3', { textContent: script.name }),
            el('p', { className: 'meta', textContent: `${script.matches.join(', ')} · ${script.runAt}` }),
            errors[script.id] ? el('p', { className: 'error', textContent: errors[script.id] }) : null),
          switchInput(script.enabled, async v => {
            script.enabled = v;
            await saveScripts(scripts);
            renderScripts();
          }, `Enable ${script.name}`)),
        el('div', { className: 'row' }, edit, del)));
    }
  }

  function openEditor(script) {
    editingId = script ? script.id : null;
    $('#us-code').value = script ? script.code : TEMPLATE;
    $('#us-error').hidden = true;
    $('#us-editor').hidden = false;
    $('#us-new').hidden = true;
    $('#us-code').focus();
  }

  function closeEditor() {
    editingId = null;
    $('#us-editor').hidden = true;
    $('#us-new').hidden = false;
  }

  $('#us-new').onclick = () => openEditor(null);
  $('#us-cancel').onclick = closeEditor;

  $('#us-editor').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#us-code').value;
    let meta;
    try {
      meta = parseHeader(code);
    } catch (err) {
      $('#us-error').textContent = err.message;
      $('#us-error').hidden = false;
      return;
    }
    const { scripts } = await loadScripts();
    const existing = scripts.find(s => s.id === editingId);
    if (existing) Object.assign(existing, meta, { code });
    else scripts.push({ id: 'us-' + Date.now().toString(36), enabled: true, code, ...meta });
    await saveScripts(scripts);
    closeEditor();
    renderScripts();
  });

  // Tab key inserts spaces instead of leaving the editor.
  $('#us-code').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const t = e.target;
    const { selectionStart: a, selectionEnd: b } = t;
    t.value = t.value.slice(0, a) + '  ' + t.value.slice(b);
    t.selectionStart = t.selectionEnd = a + 2;
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.userScriptErrors) renderScripts();
  });

  refreshPermissionUi();
  renderScripts();
})();
