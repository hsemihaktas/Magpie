"use client";

import { useState } from "react";
import type { FeedPost } from "@/lib/types";

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-label="Instagram" role="img" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-g)" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-g)" strokeWidth="2" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-g)"/>
      <defs><linearGradient id="ig-g" x1="0" y1="24" x2="24" y2="0">
        <stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/>
        <stop offset="100%" stopColor="#bc1888"/>
      </linearGradient></defs>
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg aria-label="X" role="img" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L2.002 2.25h6.351l4.266 5.643L18.244 2.25z"/>
    </svg>
  );
}

const MAX_LEN = 240;

const POST_TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", tweet: "Tweet"
};

export default function PostCard({ post }: { post: FeedPost }) {
  const [expanded, setExpanded] = useState(false);
  const thumbnailUrl = post.thumbnail_url ?? post.media_urls?.[0] ?? null;
  const contentText = post.content_text ?? "";
  const isLong = contentText.length > MAX_LEN;
  const display = isLong && !expanded ? contentText.slice(0, MAX_LEN) + "…" : contentText;
  const date = new Date(post.saved_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  const postTypeLabel = post.post_type ? POST_TYPE_LABELS[post.post_type] ?? post.post_type : null;
  const displayName = post.author_display_name || post.author_username;

  return (
    <article className="group flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-lg dark:hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-200">
      
      {/* Thumbnail */}
      {thumbnailUrl ? (
        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {/* Platform badge overlay */}
          <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded-lg p-1">
            {post.platform === "instagram" ? <InstagramIcon className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5 text-white" />}
          </div>
          {/* Post type pill */}
          {postTypeLabel && (
            <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
              {postTypeLabel}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-850 flex flex-col items-center justify-center gap-2 relative">
          {post.platform === "instagram" ? (
            <InstagramIcon className="w-10 h-10 opacity-20" />
          ) : (
            <XIcon className="w-10 h-10 opacity-20 text-gray-500" />
          )}
          {postTypeLabel && (
            <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-600">{postTypeLabel}</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        
        {/* Author */}
        <div className="flex items-center gap-2.5">
          {post.author_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-gray-700 shrink-0 ring-1 ring-gray-200 dark:ring-gray-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0 flex items-center justify-center text-white text-xs font-bold">
              {(displayName)?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {displayName && (
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                {displayName}
              </p>
            )}
            {post.author_username && post.author_display_name && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate leading-tight">@{post.author_username}</p>
            )}
            {!post.author_display_name && post.author_username && (
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">@{post.author_username}</p>
            )}
          </div>
        </div>

        {/* Caption */}
        {contentText ? (
          <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            <p className="whitespace-pre-wrap break-words">{display}</p>
            {isLong && (
              <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">No caption</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{date}</span>
          {post.post_timestamp && (
            <>
              <span>·</span>
              <span>Posted {new Date(post.post_timestamp).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-100 dark:border-gray-800">
          {post.collections?.name ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 truncate max-w-[130px]">
              {post.collections.name}
            </span>
          ) : <span />}

          {post.post_url ? (
            <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-1 shrink-0">
              View original
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ) : <span className="text-xs text-gray-300 dark:text-gray-600">No link</span>}
        </div>
      </div>
    </article>
  );
}
