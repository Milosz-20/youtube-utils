# Developing YouTube Utils

## Running from source

Firefox only installs signed extensions permanently. For development, load it temporarily (it is removed when Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json`
3. After every change: **Reload** next to the add-on, then refresh the YouTube tab (F5).

A temporary copy takes over from an installed signed one with the same ID until the next restart. If Firefox refuses to load it, disable the installed one in `about:addons` first.

The same folder runs in Chrome: `chrome://extensions` → **Developer mode** → **Load unpacked** → pick the folder; after a change press ↻ on the extension and refresh YouTube. One manifest serves both: Firefox uses `background.scripts` and ignores `service_worker`, Chrome the other way round, and Chrome ignores `browser_specific_settings`. Extension pages and scripts call `browser.*`; `compat.js` (and the first lines of `background.js` and `content/bridge.js`) point it at `chrome` in Chrome. Icons are PNG because Chrome doesn't take SVG; `icons/icon.svg` is their source.

## Releasing an update

1. Change the code.
2. `.\package.ps1` (patch bump) — also `minor`, `major`, `-Version 1.4.2` or `-NoBump`. It writes the new version into `manifest.json` and builds `..\youtube-utils-<version>.zip` with correct zip paths.
3. Upload that zip at [addons.mozilla.org](https://addons.mozilla.org/developers/addon/youtube-utils/versions/submit/), pick **On your own**, source code **No**, submit.
4. When signing finishes (usually a minute or two), download the `.xpi` from *Manage Status & Versions* and attach it to a GitHub release.

AMO refuses a version number it has already seen, so always bump.

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

2. Add `"modules/my-feature.js"` to the page-world `content_scripts` entry in `manifest.json`, **before** `core/boot.js`. The order there is the order on the options page and in the popup.
3. Reload the extension in `about:debugging`.

Add `popup: true` to a setting to also show it in the toolbar popup. The options page reads the module list from `manifest.json`, so the new card and its settings appear automatically.

Modules run in YouTube's own page context (like a `@grant none` userscript): they can call YouTube's player API (`#movie_player`) and `fetch` YouTube endpoints with your session. Don't use `innerHTML` in modules — YouTube enforces Trusted Types and it throws; build elements with `createElement`. Always return a cleanup function so the module can be switched off without reloading the page.

YouTube handles keys for the whole player before anything inside it sees them. If a module puts inputs inside the player, stop key events for them in a `window` capture-phase listener, or typing digits will seek the video.

### Avoiding a flash of unstyled YouTube

Settings live in the extension's async storage, so a module starts a beat after the page does — long enough for YouTube to paint the thing you are hiding. If your module hides or restyles anything, put those rules in a `css` property on the definition, as a string or a function of the settings:

```js
YTU.register({
  id: 'my-feature',
  css: s => (s.hideThing ? '.thing { display: none !important; }' : ''),
  run(ctx) {
    const def = this; // boot.js calls def.run(ctx)
    style.textContent = def.css(ctx.settings); // re-render it yourself on change
  },
});
```

`core/boot.js` injects it at `document_start` using the settings it cached in `localStorage` last time, then drops that copy once the real settings arrive and your module has added its own stylesheet.

## User scripts

Scripts run in the page context. Available Tampermonkey functions: `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM_addStyle`, `GM_log`, `unsafeWindow` (`GM_registerMenuCommand` is accepted but does nothing). Scripts that need `GM_xmlhttpRequest` or other privileged APIs won't work. `@name`, `@match`/`@include` and `@run-at` are read from the header; matches must be on `youtube.com`.

## Layout

```
manifest.json          module list lives in content_scripts
background.js          registers user scripts with Firefox
content/bridge.js      isolated world: forwards saved settings to the page
core/runtime.js        YTU.register() registry
core/boot.js           starts/stops/reconfigures modules
modules/*.js           features
tabs/                  tab player window (extension page shown inside YouTube)
vendor/                third-party code, see below
options/               options page + toolbar popup
package.ps1            version bump + zip for addons.mozilla.org
```

## Vendored code

- `vendor/alphatab/`: [alphaTab](https://www.alphatab.net) 1.8.4 (MPL-2.0), `dist/alphaTab.min.js` and the Bravura font from the `@coderline/alphatab` npm package.
- `vendor/songsterr-convert.js`: the Songsterr → alphaTab converter from [songsterr-downloader](https://github.com/Metaphysics0/songsterr-downloader) (MIT), bundled with esbuild into a plain script with `@coderline/alphatab` mapped to the global `alphaTab` and the GP7 file patches stubbed out. It exposes `songsterrToScore(meta, revisions)`, which calls the converter's `buildScore`.
