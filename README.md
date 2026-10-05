# Magpie 🪶

> Save what matters from Instagram and X — silently, privately, yours forever.

Magpie is a two-part personal content archiving system. A **Chrome Extension** quietly saves posts, reels, stories, and tweets to your own Supabase database without triggering any native platform interaction (no likes, no bookmarks, no algorithm signal). A companion **Web Viewer** lets you browse, search, and revisit everything you saved.

---

## Why Magpie?

Social media algorithms learn from every interaction. Liking or saving a post tells the platform what to show you more of — which gradually warps your feed. Magpie lets you collect what genuinely interests you without feeding that data back to the platform.

Like the magpie bird that collects shiny things for its own nest, you collect the content you care about — for yourself.

---

## Features

### Chrome Extension
- **Injected save button** on every Instagram post, reel, story and X/Twitter tweet — no native platform interaction triggered
- **Collection picker modal** — assign content to a collection or create one inline, inspired by Instagram's save-to-collection UI
- **Change collection** shortcut in the success toast — fix a mis-assignment instantly
- **Popup collection manager** — create, rename, delete collections from the toolbar icon
- **Google OAuth login** — one-click sign-in, session synced across all Chrome instances via `chrome.storage.sync`
- **Secure architecture** — credentials never touch content scripts; all API calls go through the Background Service Worker

### Web Viewer
- **Private feed** — browse all saved content, gated behind Google login
- **Collection filter** — click a collection in the sidebar to focus on a specific category
- **Full-text search** — search by keyword across all captions and tweet text
- **Go to Original** — one-click jump to the original post on the platform
- **Persistent thumbnails** — media cached to Supabase Storage so images never break from expired CDN URLs

---

## Architecture

```
Chrome Browser
├── Content Script (instagram.js / x.js)
│   └── Injects save button, scrapes metadata, renders modal & toast
├── Background Service Worker
│   ├── Manages Google OAuth session (chrome.storage.sync)
│   ├── Handles JWT lifecycle + proactive refresh
│   └── Sole caller of Supabase Edge Functions
└── Extension Popup
    ├── Login view (Google OAuth)
    └── Collection management (CRUD)

Supabase Project
├── Auth — Google OAuth provider
├── Edge Functions
│   ├── save-post     — JWT verification + upsert with rate limiting
│   └── manage-collection — CRUD with JWT verification + rate limiting
├── PostgreSQL
│   ├── collections (id, user_id, name, created_at)
│   └── saved_posts (id, user_id, collection_id, platform, post_url,
│       post_type, author_username, author_display_name, author_avatar_url,
│       content_text, media_urls[], post_timestamp, saved_at,
│       thumbnail_url, raw_metadata)
├── Row Level Security — user_id = auth.uid() on all tables
└── Storage — thumbnails bucket (async media caching)

Web Viewer (Next.js 14+)
├── /login    — Google OAuth sign-in
├── /feed     — Saved posts grid with collection filter + text search
└── /auth/callback — OAuth callback handler
```

### Security Model

| Layer | Component | Enforcement |
|-------|-----------|-------------|
| Browser | Content Script | Zero trust — messages only; holds no secrets |
| Extension | Background Service Worker | Sole holder of JWT; sole caller of Edge Functions |
| Server | Edge Functions | JWT verification + ownership check + rate limiting |
| Database | PostgreSQL RLS | `user_id = auth.uid()` — last line of defence |

All database write operations go through Edge Functions. Content scripts communicate with the Background Service Worker via `chrome.runtime.sendMessage` only.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Chrome Extension | Manifest V3, TypeScript, esbuild |
| Background Service Worker | TypeScript, `@supabase/supabase-js` |
| Web Viewer | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions, Storage) |
| Edge Functions | Deno, TypeScript |
| Rate Limiting | Deno KV (sliding window, per-user) |
| Testing | fast-check (property-based), Jest/Vitest, Deno test |

---

## Project Structure

```
Magpie/
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.ts   # Auth + JWT lifecycle + API calls
│   ├── content-scripts/
│   │   ├── instagram.ts        # Instagram button injection + scraping
│   │   └── x.ts                # X/Twitter button injection + scraping
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.ts            # Login view + collection management
│   ├── shared/
│   │   └── types/
│   │       ├── domain.ts       # Collection, SavedPost, PostMetadata...
│   │       └── messages.ts     # Message protocol types + ErrorCode
│   └── styles/
│       ├── modal.css
│       └── toast.css
│
├── web-viewer/                 # Next.js Web Viewer
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── feed/page.tsx
│   │   └── auth/callback/route.ts
│   ├── components/
│   │   ├── PostCard.tsx
│   │   ├── CollectionFilter.tsx
│   │   └── SearchBar.tsx
│   └── lib/
│       ├── supabase.ts
│       └── filters.ts
│
└── supabase/
    ├── functions/
    │   ├── save-post/index.ts
    │   ├── manage-collection/index.ts
    │   └── shared/rate-limit.ts
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Data Flow — Saving a Post

```
1. User clicks save button (injected by content script)
2. Content script scrapes post metadata from DOM
3. Content script sends SAVE_POST message to Background Service Worker
4. BSW reads JWT from chrome.storage.sync, checks expiry
5. BSW POSTs to save-post Edge Function with Authorization: Bearer {jwt}
6. Edge Function: rate limit check → JWT verify → collection ownership check → UPSERT
7. Edge Function fires async thumbnail upload to Supabase Storage
8. Edge Function returns 201/200 to BSW
9. BSW returns success to content script
10. Content script shows platform-native toast with "Change collection" option
```

---

## Platform Support

| Platform | Status | Post Types |
|----------|--------|------------|
| Instagram | Phase 1 | Posts, Reels, Stories |
| X (Twitter) | Phase 2 | Tweets, Media tweets, Retweets |

---

## Multi-User Safety

Magpie is designed for multi-user deployment from day one:

- Every row in every table is scoped to a `user_id`
- PostgreSQL RLS enforces isolation at the database level — no query from user A can ever return data from user B
- Edge Functions independently verify JWT and collection ownership
- Rate limiting (60 req/min for save-post, 30 req/min for manage-collection) prevents abuse
- The service role key never leaves Edge Functions

---

## Spec & Planning

Full planning documents are located in `.kiro/specs/social-content-saver/`:

- `requirements.md` — 19 requirements with EARS-format acceptance criteria
- `design.md` — System architecture, component design, 14 correctness properties
- `tasks.md` — 21 implementation tasks with property-based test coverage
