"use client";

/**
 * SearchBar — debounced keyword search input for the feed.
 *
 * Client Component: manages a controlled input with a 300 ms debounce.
 * On each debounced change it calls router.push(), setting ?q= while
 * preserving the existing ?collection= param.  When the field is empty
 * or whitespace-only the ?q= param is removed entirely.
 *
 * Requirements: 17.1, 17.3
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Stable DOM id shared between <label htmlFor> and <input id>. */
const SEARCH_INPUT_ID = "search-input";

/** Milliseconds to wait after the last keystroke before navigating. */
const DEBOUNCE_MS = 300;

interface SearchBarProps {
  /** The search query pre-populated from the URL `?q=` param. */
  initialQuery: string;
}

export default function SearchBar({ initialQuery }: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  /**
   * Skip the navigation triggered on the very first render.
   * The URL already reflects `initialQuery`, so firing router.push immediately
   * would create a redundant history entry.
   */
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      /**
       * Read the live URL at callback time so any ?collection= param set by
       * the CollectionFilter is preserved exactly as-is, without needing
       * useSearchParams() as a dependency (which would cause this effect to
       * re-fire on every collection click).
       */
      const params = new URLSearchParams(window.location.search);

      const trimmed = value.trim();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        // Empty / whitespace-only → remove ?q= entirely.
        params.delete("q");
      }

      router.push(`/feed?${params.toString()}`);
    }, DEBOUNCE_MS);

    // Cancel the pending navigation if the user types again before it fires.
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <div role="search" className="w-full">
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        Search posts
      </label>
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        placeholder="Search posts…"
        aria-label="Search posts"
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
      />
    </div>
  );
}
