"use client";

/**
 * PostCardList — renders the list of saved posts in the feed.
 *
 * This is a stub component. The full PostCard implementation is in task 15.2.
 * Requirements: 15.1, 15.2
 */

import type { FeedPost } from "@/lib/types";

interface PostCardListProps {
  /** Saved posts enriched with their collection name. */
  posts: FeedPost[];
}

export default function PostCardList({ posts }: PostCardListProps) {
  if (posts.length === 0) {
    return <p>No results found</p>;
  }

  // Stub: renders minimal post info until task 15.2 implements the full PostCard.
  return (
    <ul aria-label="Saved posts">
      {posts.map((post) => (
        <li key={post.id}>
          <article>
            <p>{post.author_username ?? "Unknown author"}</p>
            <p>{post.content_text ?? ""}</p>
            {post.post_url ? (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Go to Original
              </a>
            ) : (
              <button type="button" disabled>
                Go to Original
              </button>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
