# Ear Bench

An ear-training web app for pianists. Train relative pitch and work out the chords of real songs.

## Running it on your computer

- **Quickest:** double-click `index.html`. Everything works except "Install app" and offline caching.
- **Recommended:** double-click `start-server.bat`. It runs a small local web server (needs Python or Node.js) and opens http://localhost:8000.
  This also lets Chrome/Edge install Ear Bench as a desktop app (install icon in the address bar).

Use **Chrome or Edge** if you want to connect a MIDI keyboard (Firefox and Safari don't support Web MIDI well).

## Installing on Android

Android can only install the app from an `https://` address, so host the folder online once:

1. Create a free GitHub account, make a new public repository, and upload everything in this folder (keep the `js` and `icons` folders).
2. In the repository go to **Settings → Pages**, set Source to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
3. After a minute the app is live at `https://<your-username>.github.io/<repo-name>/`.
4. Open that address in **Chrome on Android**, tap the ⋮ menu and choose **Install app** (or *Add to Home screen*).

It then opens full-screen from its own icon and works offline once you've used it. The piano samples are cached after the first play.
A USB MIDI keyboard also works on Android through a USB-C OTG adapter in Chrome.
Netlify Drop (drag the folder onto app.netlify.com/drop) is an alternative to GitHub Pages.

When you change the files, upload them again. The app picks up the new version on the next launch.

The first time you play a sound, the app downloads a recorded grand piano (Salamander samples, about 4 MB).
If you're offline it falls back to a built-in synthesized piano. You can switch between them under **Sound**.

## Ways to play

- **MIDI keyboard**: plug it in by USB and click *Connect MIDI*. Leave "Play sound for MIDI input" off if your piano makes its own sound.
- **On-screen keyboard**: click or tap the keys.
- **Computer keys**: `A W S E D F T G Y H U J K` play from middle C. `Z` and `X` shift the octave.
- **Shortcuts**: `Space` replays, `Enter` goes to the next question, `1`–`9` pick answers.

## Training modes

| Mode | What you train |
|---|---|
| Intervals | Name the distance between two notes, played up, down or together. Find the second note on the keys to answer. Each interval comes with a reference tune. |
| Scale degrees | A cadence sets the key, then one note plays. Name its scale degree (1–7, plus chromatic). The note then resolves to the tonic so you learn how each degree pulls. This is the core relative-pitch skill. |
| Chords | Chord qualities from major/minor up to sevenths, 9ths and sus chords, with optional inversions. |
| Progressions | Hear a progression with piano voicing (left-hand bass, voice-led right hand) and write it in Roman numerals. Bass-line playback and "Hear my answer" let you compare your guess with the real thing. Major and minor, including borrowed chords and secondary dominants. |
| Melody echo | Hear a short melody and play it back on the keys. |
| Song workshop | Tools for working out real songs: a chord finder that names whatever you play (with inversions), a chord palette for the song's key, a progression notebook with looping, transposing and key guessing, a tonic drone, saved songs, and a library of common progressions. |
| Progress | Accuracy per item (weakest first), a practice calendar, day streak and daily goal. |

The practice adapts to you. Items you miss come up more often, and when you hold 85% over 20 answers the app offers the next level.

Progress and saved songs are stored in your browser (localStorage), on this computer only.

## Files

- `index.html`: page structure
- `styles.css`: styles
- `js/theory.js`: music theory (intervals, chords, Roman numerals, voice leading, chord and key detection)
- `js/audio.js`: piano sound engine
- `js/app.js`: keyboard, MIDI, and all training modes
- `manifest.webmanifest`, `sw.js`, `icons/`: make it installable and offline-capable
- `start-server.bat`: local web server for Windows
