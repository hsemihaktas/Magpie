"use client";

/**
 * CollectionFilter — sidebar panel for filtering the feed by collection.
 *
 * Navigates by pushing URL updates via the Next.js router, preserving any
 * existing `?q=` search param so text search and collection filters compose.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigate to the feed filtered by the given collection id, or to the
   * unfiltered feed when no id is supplied. Retains the `?q=` param so that
   * an active keyword search is not lost when the user switches collections.
   *
   * Requirement 16.2, 16.3, 16.4
   */
  function navigate(collectionId?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (collectionId) {
      params.set("collection", collectionId);
    } else {
      params.delete("collection");
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <aside
      aria-label="Collection filter"
      className="w-52 flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 h-fit sticky top-8"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3 px-1">
        Collections
      </h2>
      <ul className="space-y-0.5">
        {/* "All" option is always present — Requirement 16.1, 16.3 */}
        <li>
          <button
            type="button"
            onClick={() => navigate()}
            aria-current={!activeId ? "page" : undefined}
            className={
              !activeId
                ? "w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400"
                : "w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            }
          >
            All
          </button>
        </li>

        {collections.length === 0 ? (
          /* Requirement 16.5: empty state message */
          <li className="text-gray-400 text-xs italic px-3 py-2">
            No collections yet
          </li>
        ) : (
          collections.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(c.id)}
                aria-current={activeId === c.id ? "page" : undefined}
                className={
                  activeId === c.id
                    ? "w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400"
                    : "w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                }
              >
                {c.name}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
