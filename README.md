# YouTube Utils

Firefox extension with YouTube tweaks. Every feature has its own on/off switch in the toolbar popup.

## Install

Requires Firefox 140+.

1. Download the `.xpi` from [Releases](../../releases/latest).
2. Firefox → `Ctrl+Shift+A` → ⚙ → **Install Add-on From File…** → pick the file → **Add**.
3. Refresh open YouTube tabs.

To update, install the newer `.xpi` the same way. Settings are kept.

## Features

| Feature | What it does |
| --- | --- |
| **Shorts filter** | Shows Shorts only from your subscriptions, or hides them all. Requires being signed in to YouTube. |
| **One Short at a time** | No scrolling to the next Short. Leave with the **←** button or `Esc`. |
| **Video quality** | Every video starts in your chosen quality instead of Auto. |
| **Precise playback speed** | `Shift + >` / `Shift + <` change speed in 0.05× steps. |
| **SponsorBlock** | Skips sponsor segments automatically or shows a Skip button. |
| **Count-in & loop** | Count-in, metronome and A–B loop for playing along. See below. |
| **Tab player** | A Songsterr tab next to the video, drawn by the extension, with the cursor following the video. See below. |
| **Songsterr tabs** | The song's Songsterr tab in a window next to the video, following along bar by bar. See below. |
| **Block Shift + ?** | Disables YouTube's shortcuts overlay. |

## Count-in & loop

Click the **metronome icon** in the player bar and switch it on for the video.

1. Play the song and press `R` on every beat from bar 1, 4–8 times. This sets the tempo and the song's start.
   Or set it manually: type the BPM in the panel, pause on the song's first beat and click **Here** next to *Bar 1*.
2. Press `G`: the video jumps to bar 1, counts *1 2 3 4* and starts on the beat.

| Key | Action |
| --- | --- |
| `R` | Tap tempo |
| `G` | Count in from bar 1, or from the loop start |
| `Shift + G` | Count in from the current bar |
| `Shift + R` | Metronome along with the video |
| `[` / `]` | Set loop start / end |
| `\` | Loop on / off |

In the panel: adjust tempo and bar 1, number of clicks, beats per bar, sound, nudge loop ends (‹ ›, Shift = 10 ms), **Snap to bars**, **Count in every repeat**. Saved per video.

## Songsterr tabs

1. Click the **tab icon** in the player bar, paste the song's Songsterr link and press **Save**. The link is remembered for that video, and the tab opens in a window of its own showing only the tab. Place it next to YouTube however suits you.
2. Next time, the tab icon opens that window straight away. The small panel on YouTube can be dragged by its title bar; **×** closes both.
3. Set the tempo and bar 1 in *Count-in & loop* (above). From then on the tab's cursor moves bar by bar with the video: at any speed, after seeking, and around the loop.

If the tab has bars before the song's bar 1 that the video doesn't (or the other way round), shift it with **− / +** in the title bar. The tab gets its own window because Songsterr refuses to be shown inside other pages, and Zen enforces that even for extensions.

## Troubleshooting

- Nothing happens: refresh the tab; check the extension is allowed on youtube.com (🧩 icon).
- No sound: click the page once first; check *Click volume* in settings.

## Privacy

No data is collected. SponsorBlock receives only a 4-character hash prefix of the video ID.

Development: [DEVELOPING.md](DEVELOPING.md)

## Tab player

Click the **tab icon** in the player bar, paste the link to the song on Songsterr and click **Load**. The first time, Firefox asks to let the extension read Songsterr.

- Pick the track (guitar, bass, drums…) in the window. The link, track and sync are remembered for the video.
- Bar 1 is the same one Count-in & loop uses, so set it in either place. In the window, type its time, nudge it with **−**/**+**, or press **Here** on its first beat. If the cursor drifts later in the song, press **Pin bar** on the first beat of the bar it should be in.
- Click a note to jump the video there. Speed changes and seeks are followed.
- Make the tab bigger or smaller with **− / +** next to the percentage, or Ctrl + mouse wheel over it. Drag the window by its title bar and resize it from the bottom-right corner.
