# YouTube Utils

A Firefox extension that bundles YouTube tweaks as switchable modules, plus Tampermonkey-style user scripts.

## Built-in modules

| Module | What it does |
| --- | --- |
| **Shorts filter** | Mode *Subscriptions only*: Home, search and the watch-page sidebar show Shorts only from channels you follow. Mode *Hide all*: all Shorts, shelves and the channel Shorts tab are hidden, and Shorts links open as normal videos. The Subscriptions feed and channel pages are never filtered. Sidebar "Shorts" tab hidden. |
| **One Short at a time** | Opening a Short plays only that one: scrolling, swiping, arrow keys and auto-advance can't move to the next Short, and no neighbouring Short peeks in at the bottom. Adds a back arrow (and Esc) to leave the Short, since the player has none. Ambient mode's glow around the Short is hidden by default. Works on its own, whether or not the feed filter is on. |
| **Precise playback speed** | `Shift + >` / `Shift + <` changes speed in 0.05× steps with an on-video indicator. Step, min and max are configurable. |
| **Default video quality** | Every new video starts in your chosen quality (e.g. 1080p) instead of Auto, falling back to the next lower one. Optional for Shorts. |
| **SponsorBlock** | Skips sponsor segments from the community [SponsorBlock](https://sponsor.ajay.app) database — automatically (with an *Undo* notice) or via a *Skip* button in the player. Categories are selectable; segments are marked on the progress bar. Privacy: only a 4-character hash prefix of the video ID is sent. |
| **Count-in** | Off until you switch it on for a video (in the player panel), so R and G stay free elsewhere. For playing along: counts "1 2 3 4" with metronome clicks, then starts the video on the beat. Press `R` on every beat while the song plays, starting on bar 1 — that sets both the tempo and where bar 1 is (taps are measured in video time, so it works on a slowed-down video too). `G` counts in from bar 1, `Shift+G` from the bar you are at. The count can span several bars (e.g. 8 clicks in bars of 4), each bar starting with a higher click. Tempo, bar 1, count length and beats per bar can be fine-tuned from the metronome button in the player. The count is played on drumsticks, hi-hat, woodblock, cowbell or a plain beep, picked (and previewed) in the panel. Clicks follow the playback speed; settings are remembered per video. |
| **Block the Shift + ? shortcuts menu** | Stops Shift + ? from opening YouTube's keyboard shortcuts overlay (typing "?" in text fields still works). |

Each module has an on/off switch and its own settings on the options page. Changes apply to open YouTube tabs immediately.

## Install (Firefox 128+)

**For development** (removed when Firefox restarts):

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json`

**Permanently:** Firefox only installs signed extensions. Either

- sign it for free as an *unlisted* add-on on [addons.mozilla.org](https://addons.mozilla.org/developers/) (upload a zip of this folder, you get a signed `.xpi` back), or
- use Firefox Developer Edition / Nightly, set `xpinstall.signatures.required` to `false` in `about:config`, zip the folder contents and install the zip via `about:addons` → ⚙ → *Install Add-on From File*.

If nothing happens on YouTube, open the Extensions menu (puzzle icon) and make sure YouTube Utils is allowed on youtube.com.

## Releasing an update

1. Change the code.
2. `.\package.ps1` (patch bump) — also `minor`, `major`, `-Version 1.4.2` or `-NoBump`. It writes the new version into `manifest.json` and builds `..\youtube-utils-<version>.zip` with correct zip paths.
3. Upload that zip at [addons.mozilla.org](https://addons.mozilla.org/developers/addon/youtube-utils/versions/submit/), pick **On your own**, source code **No**, submit.
4. When signing finishes, download the `.xpi` from *Manage Status & Versions* and install it via `about:addons` → ⚙ → *Install Add-on From File*.

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

2. Add `"modules/my-feature.js"` to the page-world `content_scripts` entry in `manifest.json`, **before** `core/boot.js`.
3. Reload the extension in `about:debugging`.

Add `popup: true` to a setting to also show it in the toolbar popup.

### Avoiding a flash of unstyled YouTube

Settings live in the extension's async storage, so a module starts a beat after the page does — long enough
for YouTube to paint the thing you are hiding. If your module hides or restyles anything, put those rules in
a `css` property on the definition, as a string or a function of the settings:

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

`core/boot.js` injects it at `document_start` using the settings it cached in `localStorage` last time, then
drops that copy once the real settings arrive and your module has added its own stylesheet.

The options page reads the module list from `manifest.json`, so the new card and its settings appear automatically.

Modules run in YouTube's own page context (like a `@grant none` userscript): they can call YouTube's player API (`#movie_player`) and `fetch` YouTube endpoints with your session. Don't use `innerHTML` in modules — YouTube enforces Trusted Types and it throws; build elements with `createElement`. Always return a cleanup function so the module can be switched off without reloading the page.

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
