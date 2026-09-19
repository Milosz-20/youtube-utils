# YouTube Utils

A Firefox extension that bundles YouTube tweaks as switchable modules, plus Tampermonkey-style user scripts.

## Built-in modules

| Module | What it does |
| --- | --- |
| **Shorts: subscriptions only** | Home, search and the watch-page sidebar show Shorts only from channels you follow. Opening a Short plays just that one: no swiping, arrow keys, auto-advance or peeking at the next Short. Sidebar "Shorts" tab hidden. |
| **Block the Shift + ? shortcuts menu** | Stops Shift + ? from opening YouTube's keyboard shortcuts overlay (typing "?" in text fields still works). |
| **Default video quality** | Every new video starts in your chosen quality (e.g. 1080p) instead of Auto, falling back to the next lower one. Optional for Shorts. |
| **Precise playback speed** | `Shift + >` / `Shift + <` changes speed in 0.05× steps with an on-video indicator. Step, min and max are configurable. |

Each module has an on/off switch and its own settings on the options page. Changes apply to open YouTube tabs immediately.

## Install (Firefox 128+)

**For development** (removed when Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json`

**Permanently:** Firefox only installs signed extensions. Either

- sign it for free as an *unlisted* add-on on [addons.mozilla.org](https://addons.mozilla.org/developers/) (upload a zip of this folder, you get a signed `.xpi` back), or
- use Firefox Developer Edition / Nightly, set `xpinstall.signatures.required` to `false` in `about:config`, zip the folder contents and install the zip via `about:addons` → ⚙ → *Install Add-on From File*.

If nothing happens on YouTube, open the Extensions menu (puzzle icon) and make sure YouTube Utils is allowed on youtube.com.

## Adding a module

1. Create `modules/my-feature.js`:

   ```js
   YTU.register({
     id: 'my-feature',
     name: 'My feature',
     description: 'One sentence shown on the options page.',
     enabledByDefault: true,
     settings: {
       loud:   { type: 'boolean', label: 'Be loud', default: false },
       volume: { type: 'number',  label: 'Volume', default: 50, min: 0, max: 100, step: 5 },
       mode:   { type: 'select',  label: 'Mode', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
       reset:  { type: 'action',  label: 'Reset something now' },
     },
     run(ctx) {
       // ctx.settings        live settings object (always current values)
       // ctx.onChange(fn)    fn(changedKeys, settings) on every change; 'action' settings fire here when clicked
       // ctx.storage         get(key, fallback) / set(key, value) / remove(key), per-module, JSON
       // ctx.log(...)        console.log with the module's name
       const onKey = e => { /* ... */ };
       window.addEventListener('keydown', onKey, true);
       return () => window.removeEventListener('keydown', onKey, true); // cleanup when switched off
     },
   });
   ```

2. Add `"modules/my-feature.js"` to the page-world `content_scripts` entry in `manifest.json`, **before** `core/boot.js`.
3. Reload the extension in `about:debugging`.

The options page reads the module list from `manifest.json`, so the new card and its settings appear automatically.

Modules run in YouTube's own page context (like a `@grant none` userscript): they can call YouTube's player API (`#movie_player`) and `fetch` YouTube endpoints with your session. Always return a cleanup function so the module can be switched off without reloading the page.

## User scripts

Options page → **User scripts** → **Allow user scripts** (one-time Firefox permission, Firefox 136+) → **New script**, then paste a normal userscript. `@name`, `@match`/`@include` and `@run-at` are read from the header. Matches must be on `youtube.com`.

Scripts run in the page context. Available Tampermonkey functions: `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_addStyle`, `GM_log`, `unsafeWindow` (`GM_registerMenuCommand` is accepted but does nothing). Scripts that need `GM_xmlhttpRequest` or other privileged APIs won't work.

Good candidates for turning into a proper module once they've stuck around.

## Layout

```
manifest.json          module list lives in content_scripts
background.js          registers user scripts with Firefox
content/bridge.js      isolated world: forwards saved settings to the page
core/runtime.js        YTU.register() registry
core/boot.js           starts/stops/reconfigures modules
modules/*.js           features
options/               options page + toolbar popup
```
