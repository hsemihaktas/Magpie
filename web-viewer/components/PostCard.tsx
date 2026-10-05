"use client";

/**
 * PostCard — displays a single saved post with all required elements.
 *
 * Elements rendered (Requirements 15.2, 15.5, 15.6):
 * 1. Platform icon (Instagram or X SVG)
 * 2. Author avatar with fallback
 * 3. Author username
 * 4. Content text truncated to 280 chars
 * 5. Thumbnail (first media_urls item or thumbnail_url when available)
 * 6. Collection name badge
 * 7. saved_at date formatted with toLocaleDateString()
 * 8. "Go to Original" link / disabled button
 */

import type { FeedPost } from "@/lib/types";

// ── Platform icons ────────────────────────────────────────────────────────────

function InstagramIcon() {
  return (
    <svg
      aria-label="Instagram"
      role="img"
      viewBox="0 0 24 24"
      fill="none"
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        ry="5"
        stroke="url(#ig-gradient)"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        stroke="url(#ig-gradient)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-gradient)" />
      <defs>
        <linearGradient id="ig-gradient" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      aria-label="X (Twitter)"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5 text-black dark:text-white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L2.002 2.25h6.351l4.266 5.643L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTENT_MAX_LENGTH = 280;

function truncate(text: string | null): string {
  if (!text) return "";
  if (text.length <= CONTENT_MAX_LENGTH) return text;
  return text.slice(0, CONTENT_MAX_LENGTH) + "...";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
}

export default function PostCard({ post }: PostCardProps) {
  // 5. Thumbnail: prefer thumbnail_url (added in task 21.4), fall back to first media_urls item
  const thumbnailUrl =
    (post as FeedPost & { thumbnail_url?: string | null }).thumbnail_url ??
    post.media_urls?.[0] ??
    null;

  // 7. Formatted save date
  const savedAtLabel = new Date(post.saved_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      {thumbnailUrl && (
        <div className="relative w-full aspect-video bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt="Post media"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header: avatar + username + platform icon */}
        <div className="flex items-center gap-3">
          {/* 2. Author avatar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.author_avatar_url ?? "/default-avatar.png"}
            alt={post.author_username ? `${post.author_username} avatar` : "User avatar"}
            className="w-9 h-9 rounded-full object-cover bg-gray-200 flex-shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
            }}
          />

          <div className="flex-1 min-w-0">
            {/* 3. Author username */}
            <p className="text-sm font-semibold text-gray-900 truncate">
              {post.author_username ?? "Unknown"}
            </p>

            {/* 7. Saved at date */}
            <p className="text-xs text-gray-400">{savedAtLabel}</p>
          </div>

          {/* 1. Platform icon */}
          <span className="flex-shrink-0">
            {post.platform === "instagram" ? <InstagramIcon /> : <XIcon />}
          </span>
        </div>

        {/* 4. Content text (truncated to 280 chars) */}
        {post.content_text && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {truncate(post.content_text)}
          </p>
        )}

        {/* Footer: collection badge + action button */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          {/* 6. Collection name badge */}
          {post.collections?.name ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[160px]">
              {post.collections.name}
            </span>
          ) : (
            <span />
          )}

          {/* 8. Go to Original */}
          {post.post_url ? (
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              Go to Original
              <svg
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed flex-shrink-0"
            >
              Go to Original
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
