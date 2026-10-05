"use client";

/**
 * PostCardList — renders the saved-post feed as a responsive grid.
 *
 * Requirements: 15.1, 15.2, 15.5, 15.6
 */

import type { FeedPost } from "@/lib/types";
import PostCard from "@/components/PostCard";

interface PostCardListProps {
  /** Saved posts enriched with their collection name. */
  posts: FeedPost[];
}

export default function PostCardList({ posts }: PostCardListProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg
          className="w-12 h-12 text-gray-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-gray-500 text-sm font-medium">No results found</p>
        <p className="text-gray-400 text-xs mt-1">
          Try adjusting your filters or save some posts first.
        </p>
      </div>
    );
  }

  return (
    <ul
      aria-label="Saved posts"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} />
        </li>
      ))}
    </ul>
  );
}
