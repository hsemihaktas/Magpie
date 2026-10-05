"use client";

/**
 * SearchBar — debounced keyword search input for the feed.
 *
 * This is a stub component. The full implementation is in task 17.1.
 * Requirements: 17.1, 17.3
 */

interface SearchBarProps {
  /** The search query pre-populated from the URL `?q=` param. */
  initialQuery: string;
}

export default function SearchBar({ initialQuery }: SearchBarProps) {
  // Stub: renders a static input until task 17.1 implements debounce and routing.
  return (
    <div role="search">
      <label htmlFor="search-input" className="sr-only">
        Search posts
      </label>
      <input
        id="search-input"
        type="search"
        defaultValue={initialQuery}
        maxLength={200}
        placeholder="Search posts…"
        aria-label="Search posts"
      />
    </div>
  );
}
