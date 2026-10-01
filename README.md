# YouTube Utils

A Firefox extension that makes YouTube calmer and more useful — especially if you learn music from it.

- **Shorts without the doomscroll** — see Shorts only from channels you subscribe to (or none at all), and watch one Short at a time instead of an endless feed.
- **Practice tools for musicians** — a drum count-in before the song starts, a metronome that plays along with the video, and an A–B loop for the hard bits.
- **Small fixes** — your preferred video quality every time, finer playback speed, and SponsorBlock to skip sponsor segments.

Every feature can be switched on or off on its own.

## Install

You need **Firefox 140 or newer** (desktop).

1. Go to [**Releases**](../../releases/latest) and download the `.xpi` file.
2. In Firefox, open the menu ☰ → **Add-ons and themes** (or press `Ctrl+Shift+A`).
3. Click the gear ⚙ → **Install Add-on From File…** and pick the `.xpi` you downloaded.
4. Click **Add**, then refresh any YouTube tabs you have open.

The extension is signed by Mozilla, so Firefox will install it normally.

**Updating:** download the newer `.xpi` from Releases and install it the same way. Your settings are kept. Firefox won't update it on its own.

## Getting around

Click the extension's icon in the Firefox toolbar (if you don't see it, it's under the puzzle-piece icon 🧩 — right-click it there and choose *Pin to Toolbar*). You get a list of features with a switch for each. Hover the ⓘ next to a name to see what it does.

**Open full settings** at the top takes you to the page with every option.

## Features

### Shorts filter
Home, search results and the sidebar next to a video only show Shorts from channels **you subscribe to**. Switch the dropdown in the toolbar popup to **Hide all** to get rid of Shorts completely. Your Subscriptions feed and channel pages are never filtered.

> You need to be signed in to YouTube for this, so the extension can read your subscription list.

### One Short at a time
When you open a Short, you watch **just that Short**. Scrolling, swiping and the arrow keys won't take you to the next one. To leave, click the **←** button next to the video, press **Esc**, or go back as usual in your browser.

### Video quality
Every video starts in the quality you choose (for example 1080p) instead of YouTube's "Auto". Pick it from the dropdown in the toolbar popup.

### Precise playback speed
`Shift + >` and `Shift + <` change the speed in small steps (0.05×), with a small indicator on the video. Handy for slowing a song down to learn it.

### SponsorBlock
Skips sponsor segments, using the community [SponsorBlock](https://sponsor.ajay.app) database. Choose **Skip automatically** or **Show Skip button** in the popup. The segments are marked on the progress bar.

### Count-in & loop — for practising along with a video

This one is off by default, so it never gets in the way of normal watching. Here's how to use it the first time:

1. Open the video you want to play along with.
2. Click the **metronome icon** in the player's bottom bar (next to the ⚙ gear) and turn the switch **on**. This is remembered for this video.
3. **Set the tempo:** play the song and press **`R`** on every beat, starting on the first beat of the song — like tapping your foot. After 4–8 taps the tempo appears in the panel. This also marks where the song starts ("Bar 1").
4. Press **`G`**. The video jumps back to the start of the song, a drummer counts you in *"1, 2, 3, 4"*, and the song starts right on the beat.

From there:

- **Metronome** — press **`Shift + R`** to keep the beat clicking along with the video. It stays in time when you pause, skip around or slow the video down.
- **Loop a hard part** — press **`[`** where it starts and **`]`** where it ends, then **`\`** to loop it. Fine-tune both ends with the ‹ › buttons in the panel, or press **Snap to bars** to line them up with the beat. Turn on **Count in every repeat** to get a count-in before each pass.
- **Start from the middle** — `Shift + G` counts you in from the bar you're currently at.
- **Sound** — choose a drum kit, snare, toms, sticks, hi-hat, cowbell and more in the panel. Picking one plays a preview.

If the count-in starts a little early or late, nudge **Bar 1** with the ‹ › buttons in the panel. Each video keeps its own tempo, loop and settings.

### Keyboard shortcuts

| Key | What it does |
| --- | --- |
| `Shift + >` / `Shift + <` | Faster / slower |
| `R` | Tap the tempo (count-in must be on for this video) |
| `G` | Count in and play from the start of the song, or from the start of the loop |
| `Shift + G` | Count in from the bar you're at |
| `Shift + R` | Metronome on / off |
| `[` / `]` | Mark the start / end of a loop |
| `\` | Loop on / off |
| `Esc` | Leave a Short |

The count-in keys only work on videos where you've switched the count-in on, so they never clash with anything else.

## Something not working?

- **Refresh the YouTube tab** after installing or updating — open tabs don't pick up the extension until then.
- **Nothing happens on YouTube at all:** click the puzzle-piece icon 🧩 and make sure YouTube Utils is allowed to run on youtube.com.
- **Shorts filter shows nothing, or everything:** check you're signed in to YouTube, then click **Refresh subscription list now** in the full settings.
- **No count-in sound:** click somewhere on the page once — browsers only allow sound after you've interacted with the page — and check *Click volume* in the full settings.

## Privacy

Nothing is collected or sent anywhere by this extension. Your subscription list is read from YouTube with your own login and kept in your browser. SponsorBlock lookups send only the first 4 characters of a hash of the video ID, so the server can't tell which video you're watching.

## For developers

How to run it from source, build a release or add your own feature: see [DEVELOPING.md](DEVELOPING.md). There's also a Tampermonkey-style **User scripts** section in the full settings for your own small scripts.
