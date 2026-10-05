/**
 * Web Viewer domain types.
 *
 * These types are local to the web-viewer package and mirror the
 * shared domain types from the extension, extended with joined relations
 * returned by Supabase queries.
 */

// ── Base entity ──────────────────────────────────────────────────────────────

/**
 * A single archived social media post as stored in `saved_posts`.
 * Mirrors the database table defined in Requirement 14.2.
 */
export interface SavedPost {
  id: string;
  user_id: string;
  post_url: string | null;
  post_type: "post" | "reel" | "story" | "tweet" | null;
  platform: "instagram" | "x" | null;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content_text: string | null;
  media_urls: string[] | null;
  post_timestamp: string | null;
  saved_at: string;
  collection_id: string | null;
  raw_metadata: Record<string, unknown> | null;
}

/**
 * A user-defined named group for organising SavedPosts.
 * Mirrors the `collections` database table (Requirement 14.1).
 */
export interface Collection {
  id: string;
  name: string;
}

// ── Query result type ────────────────────────────────────────────────────────

/**
 * A SavedPost enriched with the joined collection name.
 *
 * Returned by the Supabase query:
 *   `supabase.from('saved_posts').select('*, collections(name)')`
 *
 * The `collections` field is `null` when the post has no assigned collection
 * or the collection was deleted (ON DELETE SET NULL — Requirement 14.5).
 */
export interface FeedPost extends SavedPost {
  collections: { name: string } | null;
}
