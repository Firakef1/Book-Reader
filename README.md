# BookReader

**BookReader** is a local-first mobile reading app for people who want to open their phone and land back on the right page—without accounts, cloud lock-in, or fighting a cluttered UI.

Built with **Expo (SDK 57)** and **React Native**, it runs on Android and iOS (Expo Go or a development build), imports your own **PDF**, **EPUB**, and **TXT** files, and keeps progress, highlights, and preferences on the device.

---

## Why this exists

Most reading apps solve *some* of the problem: a pretty library, or sync, or a PDF viewer. The everyday friction is smaller and more annoying:

- You lose your place when switching between books.
- Progress doesn’t survive font-size changes or reopens reliably.
- PDFs often get handed off to another app or need the network for a viewer.
- Highlights and stats live in separate places—or nowhere.
- “Smart” features usually mean your library lives on someone else’s server.

BookReader was built around one product promise from the PRD:

> **Open the app. You’re already on the right page.**

Everything else—library, themes, highlights, stats, offline PDF—supports that loop: import → read → leave → come back exactly where you were.

---

## What you get

### Reading & resume

- **Smart resume** — last page (and scroll position for text), auto-saved while you read and when the app backgrounds.
- **Open last book on launch** (optional in Settings) — jump straight into what you were reading.
- **Stable text progress** — character offset so changing font size doesn’t throw you to the wrong “page.”
- **Keep screen awake** while a book is open (toggle in Settings).
- **Reader chrome** — tap to show back, title, page count, ETA when available, progress bar.
- **Go / TOC / Find / Aa** in the reader — jump to page, chapter/outline, in-book search (EPUB/TXT), and type/page-turn controls without leaving the book.
- **Scroll or flip** page-turn modes for both text and PDF.

### Library

- Import **one or many** local files (PDF, EPUB, TXT).
- Search by title/author; filter by **status** and **format**; sort by recent, A–Z, added, or progress.
- Filters and sort are **remembered** across launches.
- Manual status: **Reading / To Read / Done** (sticky—won’t get silently overwritten).
- Continue card, recently read carousel, progress on each cover.
- Duplicate detection on import (same name/title/size skipped with a clear summary).
- Edit title/author; delete removes the library entry **and** the stored file.
- EPUB cover extraction when the file includes a cover image.

### Highlights & bookmarks

- **EPUB/TXT:** long-press a paragraph → five highlight colors.
- **PDF:** long-press a page → page bookmark (honestly labeled as such).
- Highlights tab: filter by color/book, open the location, copy filtered highlights to the clipboard.

### Themes & typography

- Four reading themes: **Ink (dark)**, **Paper (light)**, **Parchment (sepia)**, **Lamp (dark sepia)**.
- Optional match-system theme.
- Font size, Literata / Source Sans / mono, line height, alignment, letter spacing.
- Live preview in Settings; quick **Aa** panel in the reader.

### Stats

- Pages today, reading streak, books completed, average session length, total time.
- Per-book progress and recent daily activity.

### Offline & data

- **Fully local** — no login required for core reading.
- **PDF.js is bundled** in the app (not loaded from a CDN), so PDF viewing works offline.
- Book text for EPUB/TXT is stored on disk; metadata/progress/highlights use AsyncStorage via Zustand.
- **Export / restore backup** (JSON) for library metadata, progress, highlights, and preferences. Book *files* stay on device; after a wipe you may need to re-import files.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Expo ~57, React Native, TypeScript |
| Navigation | Expo Router (file-based) |
| State | Zustand + AsyncStorage persist |
| PDF | Bundled Mozilla PDF.js inside `react-native-webview` |
| EPUB | JSZip + local HTML→text extraction |
| Files | `expo-document-picker`, `expo-file-system` |
| UI fonts | Literata + Source Sans 3 |
| Icons | Local SVG tab icons (`react-native-svg`) |

Intentional product/tech decisions (vs the original PRD) are documented in [`docs/ADJUSTMENTS.md`](docs/ADJUSTMENTS.md). Full requirements live in [`docs/BookReader_PRD.md`](docs/BookReader_PRD.md).

---

## Project structure

```text
app/
  _layout.tsx          # Root stack, splash, onboarding gate, open-last-book
  onboarding.tsx
  (tabs)/              # Library, Highlights, Stats, Settings
  reader/[id].tsx      # Immersive reader (PDF + text)
src/
  components/          # Covers, PDF reader, highlight picker, tab icons, …
  hooks/               # Theme hook
  services/            # Import, permissions, PDF.js loader, book content/covers
  store/               # libraryStore (books, progress, highlights, prefs, stats)
  theme/               # Colors & typography
  types/
  utils/               # Pagination, ETA, search helpers, …
assets/
  pdfjs/               # Bundled PDF.js engine (JSON modules)
docs/                  # PRD + adjustments
```

---

## Getting started

### Requirements

- Node.js 20+ recommended
- npm
- Expo Go on a phone, or an Android/iOS simulator
- For production-like splash customization and some native modules, a **development build** is better than Expo Go (Expo Go still works for day-to-day reading)

### Install & run

```bash
npm install
npm start
```

Then:

- Scan the QR code with **Expo Go**, or
- Press `a` / `i` for Android / iOS simulators, or
- Press `w` for web (PDF WebView behavior is best verified on device)

Clean Metro cache if assets or Metro config change:

```bash
npx expo start -c
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Start and open Android |
| `npm run ios` | Start and open iOS |
| `npm run web` | Start web |
| `npm run build:preview` | EAS Android APK (internal / OTA-capable) |
| `npm run update:preview` | Publish JS/asset OTA to the `preview` channel |

---

## CI / OTA updates

Pushes to `main` publish an **EAS Update** to the `preview` channel (GitHub Action). Manual native builds use **Actions → EAS Build**.

**One-time GitHub setup**

1. Create an Expo access token: https://expo.dev/settings/access-tokens  
2. Add it as a repo secret named `EXPO_TOKEN`:  
   `https://github.com/Firakef1/Book-Reader/settings/secrets/actions`

**Important:** OTA only works on installs that were built *with* EAS Update (this repo’s `updates.url` + `channel`). Your older APK cannot receive updates—install one new **preview** build, then later pushes update that install. Force-close and reopen the app twice to apply an update. Keep `version` in `app.json` the same unless you ship a new native build (`runtimeVersion` policy is `appVersion`).

---

## How reading formats work

| Format | How it’s handled |
|--------|------------------|
| **TXT** | Loaded as text, paginated in-app, paragraph highlights, search |
| **EPUB** | Unpacked with JSZip; chapters + optional cover; flattened text for reading; TOC + search |
| **PDF** | Copied into app storage; rendered with **bundled** PDF.js in a WebView (scroll/flip, virtualized scroll, outline when present) |

Import prefers the system document picker so **original filenames** are preserved (Android content URIs often look like `document/1000` otherwise).

---

## Privacy model

- No BookReader account is required to read.
- Library files, progress, highlights, and preferences stay on the device by default.
- Backup export is something **you** share (Files / share sheet)—the app does not upload your library for you.
- Restoring a backup restores **metadata**; re-import files if the binary books are gone from the device.

---

## Design notes

The UI follows a calm, editorial direction (dark “Ink” chrome by default, warm accents from covers). The first experience is onboarding → empty library → import—not demo books. Splash and adaptive icons match the Ink background (`#0A0A0A`).

---

## Roadmap-ish (not required for v1)

Ideas that still fit the product but aren’t core yet:

- Richer bookmarks with notes
- Free-form text selection (vs paragraph highlights)
- Collections / tags beyond status
- Optional cloud sync
- Stronger PDF search

See the PRD Phase 2 section for the longer list.

---

## Documentation

- [`docs/BookReader_PRD.md`](docs/BookReader_PRD.md) — product requirements and vision  
- [`docs/ADJUSTMENTS.md`](docs/ADJUSTMENTS.md) — intentional deviations from the PRD (Expo, Zustand, PDF.js, paragraph highlights, etc.)

---

## License

MIT (see [`LICENSE`](LICENSE)).
