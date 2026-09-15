# BookReader — PRD Adjustments Report

**Date:** September 7, 2026  
**PRD:** `docs/BookReader_PRD.md` (v1.0)  
**Build:** Expo / React Native MVP

This file lists intentional deviations from the PRD and why they were made. Features that match the PRD are not listed here.

---

## 1. Expo managed workflow (instead of bare React Native)

**PRD:** React Native frontend.  
**Adjustment:** Built with **Expo SDK 57** + **expo-router**.

**Why:** Faster setup, shared iOS/Android/web tooling, simpler font/document-picker/file APIs, and easier local development without native project scaffolding for v1.

---

## 2. Zustand + AsyncStorage (instead of Redux Toolkit + SQLite)

**PRD:** Redux Toolkit or Zustand; SQLite for library/highlights/progress + AsyncStorage for preferences.  
**Adjustment:** **Zustand** with **persist middleware** on **AsyncStorage** for books, progress, highlights, preferences, and daily stats.

**Why:** For MVP data volume (local library + highlights), a single persisted store is simpler, reliable, and still matches the PRD schemas conceptually. SQLite remains a good Phase 2 upgrade if libraries grow large or query needs become complex.

---

## 3. PDF is a first-class format (in-app WebView + PDF.js)

**PRD:** MVP formats include EPUB and PDF; noted React Native PDF rendering limits.  
**Adjustment:** **PDF import and reading stay entirely in-app** (no system PDF app handoff):
- Both Android and iOS use an embedded **PDF.js** viewer (CDN + chunked transfer into a WebView).
- Reading modes from Settings: **Scroll** (continuous pages) or **Flip** (swipe / edge-tap).
- Import still uses readable file APIs (`File.pickFileAsync` / bytes) to avoid Android DocumentPicker cache IOException.

EPUB/TXT keep paragraph highlighting; PDFs use page markers / progress when available.

**Why:** The product goal is local in-app reading. Native PDF modules need a custom dev client; PDF.js keeps phone testing in Expo Go.

---

## 4. Paragraph-level highlighting (instead of free-form text selection)

**PRD:** Long-press to select arbitrary text ranges, then highlight.  
**Adjustment:** **Long-press a paragraph** to highlight the whole passage; five colors still apply; highlights are reviewable/exportable/deletable.

**Why:** Reliable free-form selection + colored overlays across pages is awkward in native `Text` without a WebView-based engine. Paragraph highlighting keeps the feature usable and discoverable on day one. Range-level selection can move to a WebView reader later.

---

## 5. Empty library on first launch (no dummy data)

**PRD:** Empty library → onboarding → import.  
**Adjustment:** Matches the PRD — the library starts **empty**. Users import their own `.txt` / `.epub` files. No sample books are bundled.

---

## 6. Reading stats included in MVP (pulled forward)

**PRD:** Full statistics dashboard is Phase 2; basic progress is Phase 1.  
**Adjustment:** A **Stats** tab ships in MVP with pages today, streak, books completed, average session length, total time, recent daily activity, and per-book progress bars.

**Why:** Session timing and daily counters were already needed for ETA / auto-save; exposing them costs little and makes progress feel motivating early.

---

## 7. Highlight export via clipboard (not file export)

**PRD:** Export highlights as text or to clipboard; Phase 2 also lists export.  
**Adjustment:** **Copy filtered highlights to clipboard** from the Highlights screen.

**Why:** Clipboard export is universal across platforms and enough for MVP sharing/backup without file-provider complexity.

---

## 8. Collections simplified to reading status + search

**PRD:** Organize into categories/collections; custom sort order.  
**Adjustment:** Books use **status** (`reading` / `toRead` / `completed`), **search** by title/author, and sorts: Recently Read, A–Z, Recently Added, Progress. No free-form collection taxonomy yet.

**Why:** Status filters cover the main organization need for v1 without another CRUD surface. Custom collections remain Phase 2.

---

## 9. Cover art as generated color covers (not extracted images)

**PRD:** Auto-extract cover images from files; show thumbnails.  
**Adjustment:** Books get a **generated colored cover** with title/author overlay. EPUB metadata (title/author) is extracted; cover images are not.

**Why:** Cover image extraction from EPUB packages varies widely and needs caching/asset management. Colored covers keep the bookshelf visually distinct without brittle media parsing.

---

## 10. No analytics SDKs

**PRD:** Segment or Mixpanel optional.  
**Adjustment:** **No analytics SDK** in this build.

**Why:** Aligns with the PRD’s local-only / privacy stance (“no tracking without explicit opt-in”). KPIs can be instrumented later behind an opt-in.

---

## 11. Navigation: expo-router file routes

**PRD:** React Navigation.  
**Adjustment:** **expo-router** (built on React Navigation) with tabs for Library / Highlights / Stats / Settings and a stack screen for the reader.

**Why:** Same navigation primitives, cleaner file-based structure for the app.

---

## 12. Design direction

**PRD:** Minimal, distraction-free, accessible; Paper or custom UI.  
**Adjustment:** UI restyled after [Digital Reading Mobile App Concept (Dribbble)](https://dribbble.com/shots/27438081-Digital-Reading-Mobile-App-Concept): **near-black monochrome chrome**, **white pill CTAs/chips**, **warm amber only in content/onboarding**, stacked covers with light glass/rivet detail, serif (**Literata**) titles + sans (**Source Sans 3**) system labels, category count cards, dash-style onboarding. Themes: Ink / Paper / Parchment / Lamp. Default theme is **Ink**.

**Why:** Matches the requested editorial reading-app look while keeping reading chrome distraction-free.

---

## 13. Book content stored in persisted state

**PRD:** Local filesystem for book files; DB for metadata/progress.  
**Adjustment:** Imported book **text is stored in AsyncStorage** with the book record. Original file URI is kept for reference.

**Why:** Simplifies resume/reopen across sessions without re-parsing every launch. Large-library optimization (store files only, parse on demand) is a natural follow-up if storage becomes a constraint.

---

## 14. IDs without UUID package dependency in runtime paths

**PRD:** UUID string IDs.  
**Adjustment:** Compact unique IDs via timestamp + random string (`createId()`). Shape remains an opaque string ID as in the schemas.

**Why:** Avoids React Native crypto/polyfill edge cases while keeping IDs unique for local use.

---

## Still aligned with Phase 1 PRD

- PDF, EPUB, and TXT reading with resume
- Smart resume + “last read X ago”
- Multi-book library with progress % and page counts
- Recently-read carousel + currently-reading hero
- Auto-save ~every 30 seconds
- Four reading themes + system sync option
- Full text customization with live preview
- Highlights list with color filter, jump-to-page, delete
- Onboarding for first launch
- Local-only data (no cloud)

## Explicitly still Phase 2+

- Bookmarks & notes
- In-book search
- Cloud backup / sync
- Free-form PDF text highlights
- Cover image extraction
- Custom collections
- Analytics / social / store features

---

## 16. Android import: DocumentPicker cache not readable (fixed)

**Observed error:**  
`ExponentFileSystem.ReadAsStringAsync … Location 'file:///…/cache/DocumentPicker/….pdf' isn't readable` (`java.io.IOException`).

**Cause:** On Android/Expo Go, the legacy FileSystem reader often cannot open the temporary DocumentPicker cache copy — this is an Expo FS limitation, not a missing storage permission grant.

**Fix:** Import now prefers `File.pickFileAsync` from the new `expo-file-system` API, then saves via `copy` / `bytes()` / `fetch` into the app document directory. DocumentPicker remains a fallback with the same multi-strategy save. Storage permission is still requested on older Android when needed.


**Observed while running the app:** Opening `/reader/[id]` threw:
`The result of getSnapshot should be cached` and `Maximum update depth exceeded`, so the reading screen stayed blank.

**Cause:** `updateReadingPosition` rebuilt the `book` object on every call, and a `useEffect` depended on `book`, so progress saves re-triggered themselves forever. Unstable highlight selectors made it worse.

**Fix:** Skip no-op progress writes, only clone a book when status actually changes, memoize highlight filtering, and stabilize PDF callbacks with refs. Verified by loading the reader in a headless browser: text content renders with no loop errors.

