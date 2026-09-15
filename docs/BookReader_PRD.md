# Product Requirements Document: BookReader Mobile App

## 1. Executive Summary

**Product Name:** BookReader  
**Platform:** React Native (iOS & Android)  
**Version:** 1.0  
**Last Updated:** September 2026

BookReader is a mobile reading application designed to eliminate friction from the book-reading experience. It automatically tracks reading progress, remembers the exact page and position for each book, and provides a distraction-free reading environment with modern features like text highlighting and theme customization.

---

## 2. Problem Statement

**User Pain Points:**
- Readers waste time navigating through their phone to find and open reading apps
- Constant context-switching between books causes friction when returning to a specific title
- Users forget which page they stopped reading on and have to search through the book
- No unified way to track reading progress across multiple books
- Existing reading apps lack essential features like text highlighting and theme switching
- Visual fatigue from bright screens during evening reading

**Goal:** Provide a frictionless reading experience where users open the app and immediately access their book exactly where they left off.

---

## 3. Product Vision

BookReader will become the go-to reading app for casual and serious readers by combining intelligent progress tracking with a beautifully designed, distraction-free reading interface.

---

## 4. Core Features & Requirements

### 4.1 Smart Reading Resume (MVP Priority: CRITICAL)

**Feature Description:**  
When users open the app, they immediately see their last-read book at the exact page and reading position they left off.

**Requirements:**
- Store reading progress (current book, page number, scroll position, timestamp)
- Load the last book automatically on app launch
- Display visual indicator showing "Last read 2 hours ago" or similar
- Support resuming from any position within a book (not just page numbers)
- Persist data across app sessions using local storage

**User Stories:**
- As a reader, I want to open BookReader and immediately see my book at the last page I read
- As a reader, I want the app to remember exactly where I was scrolled to on that page
- As a reader, I want to know when I last read this book

### 4.2 Multi-Book Management (MVP Priority: CRITICAL)

**Feature Description:**  
Users can switch between multiple books, each maintaining its own reading position.

**Requirements:**
- Display a library/bookshelf view showing all imported books with thumbnails
- Show reading progress percentage for each book on the bookshelf
- Display current page/total pages for each book
- Implement quick-access carousel showing recently-read books
- Tap any book to open it at the exact page left off
- Support organizing books into categories/collections
- Allow sorting by: Most Recently Read, Alphabetical, Recently Added, Progress

**User Stories:**
- As a reader, I want to switch from Book A to Book B and then back to Book A without losing my place
- As a reader, I want to see all my books on a bookshelf with visual progress indicators
- As a reader, I want to quickly access my most recently-read books from the home screen

### 4.3 Text Highlighting (MVP Priority: HIGH)

**Feature Description:**  
Users can highlight passages of text for later review and note-taking.

**Requirements:**
- Long-press to select text and display highlighting options
- Support multiple highlight colors (Yellow, Green, Blue, Pink, Orange)
- Store highlights with:
  - Text content
  - Color used
  - Page number / chapter location
  - Timestamp created
- Display highlight density indicator (shows where on the page highlights exist)
- Create a "Highlights" view to review all highlights from a book
- Export highlights as text or to clipboard
- Allow deleting individual highlights
- Persist highlights across sessions

**User Stories:**
- As a reader, I want to highlight important passages while reading
- As a reader, I want to review all my highlights from a book in one place
- As a reader, I want to use different colors to categorize my highlights (e.g., important, interesting, to-follow-up)

### 4.4 Dark & Light Mode (MVP Priority: HIGH)

**Feature Description:**  
Toggle between light and dark reading themes with customizable background and text colors.

**Requirements:**
- Provide 3-4 preset themes:
  - **Light:** White background, black text (standard reading)
  - **Dark:** Pure black background, white text (minimal eye strain)
  - **Sepia:** Cream background, brown text (paper-like feel)
  - **Dark Sepia:** Dark brown background, tan text (warm dark mode)
- Allow theme switching from settings without losing reading position
- Auto-detect system theme preference and offer to sync
- Persist theme preference across sessions
- Apply theme consistently to all UI elements (navigation, menus, buttons)

**User Stories:**
- As a reader, I want to switch to dark mode in the evening to reduce eye strain
- As a reader, I want the app to remember my preferred theme
- As a reader, I want a sepia/paper-like theme for a more natural reading experience

### 4.5 Text Customization (MVP Priority: MEDIUM)

**Feature Description:**  
Allow readers to customize text appearance for optimal readability.

**Requirements:**
- Adjustable font size (with visual slider and preview)
- Font family options: Serif (default), Sans-serif, Monospace
- Line height adjustment: Compact, Normal, Spacious
- Text alignment options: Left, Justified
- Letter spacing adjustment
- Show live preview of changes
- Store preferences and apply across all books

**User Stories:**
- As a reader with vision needs, I want to increase font size for better readability
- As a reader, I want to customize line spacing for my preferred reading style
- As a reader, I want to see how my changes look before confirming

### 4.6 Progress Tracking (MVP Priority: MEDIUM)

**Feature Description:**  
Visualize reading progress and track reading statistics.

**Requirements:**
- Display progress bar showing percentage of book completed
- Show current page / total pages
- Display estimated time to finish based on reading speed
- Show reading statistics:
  - Total pages read today
  - Total books completed
  - Average reading session duration
  - Streak counter (consecutive days read)
- Generate reading insights (e.g., "You're a 30% faster reader than average")

**User Stories:**
- As a reader, I want to know how far I am through the book
- As a reader, I want to see my reading statistics and get motivated by streaks
- As a reader, I want to know approximately how long until I finish a book

### 4.7 Book Management (MVP Priority: MEDIUM)

**Feature Description:**  
Import and organize books with metadata and cover images.

**Requirements:**
- Support importing books via:
  - File system browser (pick .epub, .pdf, .txt files)
  - Cloud storage integration (optional Phase 2)
- Auto-extract book metadata (title, author, cover image)
- Manual editing of book information
- Search and filter books by title, author, or genre
- Mark books as "Currently Reading," "To Read," "Completed"
- Delete books from library with confirmation
- Sort library by custom order

**User Stories:**
- As a reader, I want to import books from my phone's file storage
- As a reader, I want books to automatically show cover images and metadata
- As a reader, I want to organize books by reading status

### 4.8 Bookmarks & Notes (MVP Priority: LOW - Phase 2)

**Feature Description:**  
Quick bookmarking and lightweight note-taking without leaving the reading flow.

**Requirements:**
- One-tap bookmark placement on current page
- Bookmark management view showing all bookmarks with context snippets
- Add brief notes to bookmarks (optional)
- Quick navigation to bookmarked pages
- Delete bookmarks individually

**User Stories:**
- As a reader, I want to quickly bookmark important pages
- As a reader, I want to jump to all my bookmarks

### 4.9 Search Within Book (MVP Priority: LOW - Phase 2)

**Feature Description:**  
Find specific text within the current book.

**Requirements:**
- Search bar with instant results as user types
- Highlight matching text in the book
- Navigation between search results
- Show result count and current position
- Case-sensitive/insensitive toggle

**User Stories:**
- As a reader, I want to quickly find a specific passage I remember
- As a reader, I want to navigate between all instances of a search term

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React Native |
| State Management | Redux Toolkit or Zustand |
| Local Storage | AsyncStorage + SQLite |
| Book Parsing | EPub.js / react-native-pdf |
| UI Components | React Native Paper / Custom Components |
| Navigation | React Navigation |
| Analytics | Segment or Mixpanel (optional) |

### 5.2 Data Models

#### Book Schema
```
{
  id: string (UUID),
  title: string,
  author: string,
  coverImage: string (base64 or URI),
  filePath: string,
  fileType: enum (epub, pdf, txt),
  totalPages: number,
  addedDate: timestamp,
  status: enum (reading, toRead, completed)
}
```

#### Reading Progress Schema
```
{
  id: string (UUID),
  bookId: string (foreign key),
  currentPage: number,
  scrollPosition: number (0-1 decimal),
  lastReadDate: timestamp,
  totalTimeRead: number (minutes),
  readingSessions: [{
    startTime: timestamp,
    endTime: timestamp,
    pagesRead: number
  }]
}
```

#### Highlight Schema
```
{
  id: string (UUID),
  bookId: string (foreign key),
  page: number,
  text: string,
  color: enum (yellow, green, blue, pink, orange),
  createdDate: timestamp,
  note: string (optional)
}
```

### 5.3 Database Strategy

- **SQLite** for persistent storage (book library, highlights, progress)
- **AsyncStorage** for app preferences and theme settings
- **Local file system** for book files

### 5.4 File Format Support

**MVP Priority:**
1. EPUB (most common format)
2. PDF (popular for technical books)

**Future:**
- Plain text (.txt)
- MOBI (Amazon Kindle format)

---

## 6. User Flow Diagrams

### 6.1 First Launch Flow
```
App Launch → Check for existing library → 
  No books? → Show onboarding with import instructions → 
  Import book → Book added to library → Home screen
```

### 6.2 Reading Session Flow
```
App Launch → Load last-read book at saved position → 
  Display book at exact page/scroll position → 
  User reads and scrolls → 
  Auto-save progress every 30 seconds → 
  User opens another book → 
  Progress saved, new book loaded at its position
```

### 6.3 Highlighting Flow
```
User selects text (long-press) → 
  Highlight menu appears → 
  User selects color → 
  Highlight applied and saved → 
  User continues reading
```

---

## 7. User Interface Specifications

### 7.1 Key Screens

#### Home Screen / Library
- Hero section: "Currently Reading" with last book (large tap area)
- Quick access carousel: "Recently Read Books"
- Full library grid/list view below
- Bottom tab navigation: Library, Highlights, Stats, Settings

#### Reading Screen
- Full-screen book content
- Progress bar at bottom (can be hidden)
- Top bar with: Back button, book title, settings (collapsible)
- Swipe to navigate pages (or tap edges)
- Long-press to highlight
- Floating action button: Quick access to library

#### Highlights Screen
- List of all highlights from current book
- Filter by color
- Export option
- Click highlight to jump to that location in book

#### Settings Screen
- Theme selector with live preview
- Font customization controls
- About / Help / Feedback
- Data management (export highlights, backup)

### 7.2 Design Principles

- **Minimalism:** Remove all non-essential UI elements while reading
- **Discoverability:** Make common actions immediately obvious
- **Consistency:** Use familiar patterns from popular reading apps
- **Accessibility:** Support larger fonts, high contrast, screen readers
- **Performance:** Instant app launch and page transitions

---

## 8. Non-Functional Requirements

### 8.1 Performance
- App launch time: < 2 seconds
- Book loading: < 1 second
- Page transitions: Smooth 60 FPS
- Memory usage: < 150MB for average book
- Storage: Books stored efficiently without unnecessary duplication

### 8.2 Reliability
- Auto-save progress every 30 seconds to prevent data loss
- Graceful handling of corrupted book files
- Recovery mechanism if app crashes mid-session
- Regular data validation and integrity checks

### 8.3 Security
- Local-only data storage (no cloud required initially)
- User's book library is private and not transmitted
- No tracking of reading behavior without explicit opt-in
- Secure file deletion when books are removed

### 8.4 Compatibility
- iOS 13+ and Android 8+
- Support landscape and portrait orientations
- Responsive design for various screen sizes (phones and tablets)

---

## 9. Success Metrics (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | Track growth | Analytics |
| Average Reading Session | 20+ minutes | Session duration |
| Books Completed | Track per user | Progress tracking |
| Feature Usage | 60%+ use highlights | Analytics |
| App Retention | 40% 30-day retention | Analytics |
| Crash Rate | < 0.1% | Crash reporting |
| Performance | Page load < 1s | Performance monitoring |

---

## 10. Development Roadmap

### Phase 1: MVP (Weeks 1-8)
- [x] Core reading interface with book file support
- [x] Reading progress tracking and persistence
- [x] Multi-book management and library view
- [x] Text highlighting with color options
- [x] Dark/Light/Sepia themes
- [x] Text customization (font size, family, line height)
- [x] Basic progress tracking

### Phase 2: Enhancement (Weeks 9-14)
- [ ] Bookmarks and notes
- [ ] Search within book
- [ ] Reading statistics dashboard
- [ ] Export highlights feature
- [ ] Cloud backup (optional)
- [ ] Book recommendations (optional)

### Phase 3: Advanced (Future)
- [ ] Social features (share highlights)
- [ ] Book reviews and ratings
- [ ] Integration with Goodreads
- [ ] Audiobook support
- [ ] Dictionary and translation
- [ ] Custom dictionaries

---

## 11. Out of Scope (Phase 1)

- Cloud synchronization across devices
- Social sharing and community features
- Audiobook support
- DRM-protected books (e.g., Amazon Kindle files)
- Real-time language translation
- AI-powered recommendations
- Web version

---

## 12. Assumptions & Constraints

### Assumptions
- Users have books in EPUB or PDF format
- Users prefer privacy and local-only storage initially
- Users want a distraction-free reading experience
- Target audience: Frequent readers aged 18-55

### Constraints
- Single-device experience (no cloud sync in MVP)
- React Native limitations for complex PDF rendering
- App store guidelines for content distribution
- Device storage limitations for large libraries

---

## 13. Open Questions & Decisions

1. **Book Source:** Will BookReader include a built-in book store, or only support locally imported files?
   - **Decision:** Local import only for MVP. Store integration deferred to Phase 2.

2. **Cloud Backup:** Should reading progress sync across devices?
   - **Decision:** Local storage only for MVP. Consider adding in Phase 2 after user testing.

3. **DRM Support:** Should we support DRM-protected books from retailers?
   - **Decision:** No DRM support in MVP due to legal complexity.

4. **Monetization:** Will this be free, freemium, or paid?
   - **Decision:** Free with optional premium features in future (TBD).

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **EPUB** | Open standard file format for digital books |
| **PDF** | Portable Document Format for fixed-layout documents |
| **Progress Tracking** | Storing the user's current reading position |
| **Highlights** | Text passages selected by the user for emphasis |
| **Sepia** | Warm, yellowish tone mimicking aged paper |
| **Theme** | Pre-configured color scheme for the app |
| **Session** | Continuous period of reading |

---

## 15. Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | [Your Name] | Sept 2026 | _______ |
| Technical Lead | [Engineer] | Sept 2026 | _______ |
| Designer | [Designer] | Sept 2026 | _______ |

---

**Document Version:** 1.0  
**Last Updated:** September 7, 2026  
**Next Review:** October 2026
