"use client";

/**
 * CollectionFilter — sidebar panel for filtering the feed by collection.
 *
 * This is a stub component. The full implementation is in task 16.1.
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

import type { Collection } from "@/lib/types";

interface CollectionFilterProps {
  /** All collections belonging to the authenticated user. */
  collections: Collection[];
  /** The currently active collection UUID, or undefined for "All". */
  activeId?: string;
}

export default function CollectionFilter({
  collections,
  activeId,
}: CollectionFilterProps) {
  // Stub: renders a placeholder until task 16.1 implements the full component.
  return (
    <aside aria-label="Collection filter">
      {collections.length === 0 ? (
        <p>No collections yet</p>
      ) : (
        <ul>
          <li aria-current={!activeId ? "page" : undefined}>All</li>
          {collections.map((c) => (
            <li key={c.id} aria-current={activeId === c.id ? "page" : undefined}>
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
