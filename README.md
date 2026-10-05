# Magpie

> Save what matters from Instagram and X - silently, privately, yours forever.

Magpie is a two-part personal content archiving system. A Chrome Extension quietly saves posts, reels, stories, and tweets to your own Supabase database without triggering any native platform interaction. A companion Web Viewer lets you browse, search, and revisit everything you saved.

## Why Magpie?

Social media algorithms learn from every interaction. Liking or saving a post tells the platform what to show you more of - which gradually warps your feed. Magpie lets you collect what genuinely interests you without feeding that data back to the platform.

Like the magpie bird that collects shiny things for its own nest, you collect the content you care about - for yourself.

## Features

### Chrome Extension
- Injected save button on every Instagram post, reel, story and X/Twitter tweet
- Collection picker modal (inspired by Instagram save-to-collection UI)
- Change collection shortcut in the success toast
- Popup collection manager: create, rename, delete collections
- Google OAuth login synced across Chrome instances via chrome.storage.sync
- Secure: credentials never touch content scripts; all API calls go through the Background Service Worker

### Web Viewer
- Private feed gated behind Google login
- Collection filter sidebar
- Full-text keyword search across captions and tweet text
- Go to Original: one-click jump to the original post
- Persistent thumbnails cached to Supabase Storage

## Tech Stack

| Component | Technology |
|-----------|------------|
| Chrome Extension | Manifest V3, TypeScript, esbuild |
| Web Viewer | Next.js 14+ App Router, TypeScript, Tailwind CSS |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions, Storage) |
| Edge Functions | Deno, TypeScript |
| Rate Limiting | Deno KV sliding window per-user |
| Testing | fast-check, Jest/Vitest, Deno test |

## Architecture

Chrome Browser
  Content Script (instagram.js / x.js)
    Injects save button, scrapes metadata, renders modal & toast
  Background Service Worker
    Manages Google OAuth session via chrome.storage.sync
    Handles JWT lifecycle + proactive refresh
    Sole caller of Supabase Edge Functions
  Extension Popup
    Login view (Google OAuth)
    Collection management (CRUD)

Supabase Project
  Auth: Google OAuth provider
  Edge Functions: save-post, manage-collection (JWT + rate limiting)
  PostgreSQL: collections, saved_posts tables with RLS
  Storage: thumbnails bucket (async media caching)

Web Viewer (Next.js 14+)
  /login          - Google OAuth sign-in
  /feed           - Saved posts grid with collection filter + text search
  /auth/callback  - OAuth callback handler

## Security Model

| Layer | Component | Enforcement |
|-------|-----------|-------------|
| Browser | Content Script | Zero trust - messages only, no secrets |
| Extension | Background Service Worker | Sole holder of JWT + sole caller of Edge Functions |
| Server | Edge Functions | JWT verify + ownership check + rate limit |
| Database | PostgreSQL RLS | user_id = auth.uid() |

Rate limiting: 60 req/min (save-post), 30 req/min (manage-collection) per user.
Service role key never leaves Edge Functions.

## Project Structure

```
extension/
  manifest.json                -- MV3, permissions, content scripts       [DONE]
  package.json + build.mjs     -- esbuild TypeScript toolchain             [DONE]
  tsconfig.json                -- Strict TS, ES2020                        [DONE]
  background/service-worker.ts          -- JWT storage with sync/local fallback [DONE]
  content-scripts/instagram.ts -- Instagram button injection + scraping    [DONE]
  content-scripts/x.ts         -- X/Twitter injection                      [DONE]
  popup/popup.html             -- Base HTML shell                           [DONE]
  popup/popup.ts               -- Login + collections UI                   [DONE]
  shared/types/domain.ts       -- Collection, SavedPost, PostMetadata...   [DONE]
  shared/types/messages.ts     -- Message protocol + ErrorCode             [DONE]
  styles/modal.css + toast.css -- Overlay styles                           [DONE]
  icons/icon16,48,128.png      -- Placeholder icons                        [DONE]

web-viewer/
  package.json                 -- Next.js 14, Tailwind, Supabase deps      [DONE]
  app/layout.tsx               -- Root layout with Tailwind                [DONE]
  app/page.tsx                 -- Redirect to /feed or /login              [DONE]
  app/login/page.tsx             -- Google OAuth login page [DONE]
  app/feed/page.tsx              -- Feed server component + queries [DONE]
  app/auth/callback/route.ts   -- OAuth callback handler [DONE]
  components/                  -- PostCard, CollectionFilter, SearchBar    [DONE]
  lib/supabase.ts              -- Server/middleware/browser helpers        [DONE]
  lib/filters.ts               -- Text search + collection filter          [DONE]

supabase/
  migrations/001_collections_table.sql -- collections table + pgcrypto    [DONE]
  migrations/002_saved_posts_table.sql -- saved_posts + UNIQUE + GIN      [DONE]
  functions/save-post/index.ts          -- JWT verify + upsert (partial) [DONE]
  functions/manage-collection/index.ts -- CRUD (list+create done) [DONE]
  functions/shared/rate-limit.ts       -- Deno KV sliding window [DONE]
```

## Setup

### 1 - Supabase Database
Run migrations in order in the Supabase SQL editor:
```
supabase/migrations/001_collections_table.sql
supabase/migrations/002_saved_posts_table.sql
```

### 2 - Chrome Extension
```bash
cd extension
npm install
npm run build   # output goes to extension/dist/
# Load unpacked in chrome://extensions - select the extension/ folder
```

### 3 - Web Viewer
```bash
cd web-viewer
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Platform Support

| Platform | Status | Post Types |
|----------|--------|------------|
| Instagram | Phase 1 | Posts, Reels, Stories |
| X (Twitter) | Phase 2 | Tweets, Media tweets, Retweets |

## Spec & Planning

Full planning documents in .kiro/specs/social-content-saver/ (local only, not tracked by git):
- requirements.md -- 19 requirements with EARS-format acceptance criteria
- design.md -- System architecture, component design, 14 correctness properties
- tasks.md -- 21 implementation tasks with property-based test coverage

  migrations/004_storage_bucket.sql    -- thumbnails bucket creation        [DONE]
