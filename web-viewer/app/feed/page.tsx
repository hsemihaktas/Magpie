/**
 * FeedPage — the main browsing view of the Web Viewer.
 *
 * Server Component: queries Supabase server-side so no credentials are
 * exposed to the browser. URL search params drive collection filtering and
 * keyword search, making the feed fully bookmarkable.
 *
 * Requirements: 15.1, 16.1, 17.1
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import CollectionFilter from "@/components/CollectionFilter";
import SearchBar from "@/components/SearchBar";
import PostCardList from "@/components/PostCardList";
import type { Collection, FeedPost } from "@/lib/types";

interface FeedPageProps {
  searchParams: {
    /** UUID of the collection to filter by; absent means "All". */
    collection?: string;
    /** Keyword search query (case-insensitive substring match). */
    q?: string;
  };
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const supabase = createServerClient();

  // Safety check: middleware handles the primary redirect, but guard here too
  // so a direct server render never leaks data for unauthenticated users.
  // Requirements: 3.1, 3.2
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // ── Build the posts query with optional filters ──────────────────────────

  // Base query: all saved posts for the authenticated user, newest first.
  // The joined `collections(name)` brings in the collection name for the badge.
  // Requirements: 15.1, 15.2
  let postsQuery = supabase
    .from("saved_posts")
    .select("*, collections(name)")
    .order("saved_at", { ascending: false });

  // Requirement 16.2: filter by collection when the param is present.
  if (searchParams.collection) {
    postsQuery = postsQuery.eq("collection_id", searchParams.collection);
  }

  // Requirement 17.2: case-insensitive substring search on content_text.
  const trimmedQ = searchParams.q?.trim();
  if (trimmedQ) {
    postsQuery = postsQuery.ilike("content_text", `%${trimmedQ}%`);
  }

  // ── Run both queries in parallel ─────────────────────────────────────────

  // Requirements: 15.1, 16.1
  const [{ data: posts }, { data: collections }] = await Promise.all([
    postsQuery,
    supabase
      .from("collections")
      .select("id, name")
      .order("created_at", { ascending: true }),
  ]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-6 items-start">
          {/* Requirement 16.1: collection filter sidebar.
              Wrapped in Suspense because CollectionFilter uses useSearchParams(). */}
          <Suspense fallback={null}>
            <CollectionFilter
              collections={(collections as Collection[]) ?? []}
              activeId={searchParams.collection}
            />
          </Suspense>

          {/* Main content area */}
          <main className="flex-1 min-w-0 flex flex-col gap-5">
            {/* Requirement 17.1: search input */}
            <SearchBar initialQuery={searchParams.q ?? ""} />

            {/* Requirements 15.1, 17.5: post grid or "No results found" empty state */}
            <PostCardList posts={(posts as FeedPost[]) ?? []} />
          </main>
        </div>
      </div>
    </div>
  );
}
