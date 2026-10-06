"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Collection } from "@/lib/types";

interface CollectionFilterProps {
  collections: Collection[];
  activeId?: string;
}

export default function CollectionFilter({ collections, activeId }: CollectionFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(collectionId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (collectionId) params.set("collection", collectionId);
    else params.delete("collection");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <aside className="w-52 shrink-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3 mb-2">
        Collections
      </p>
      <nav className="space-y-0.5">
        <button
          type="button"
          onClick={() => navigate()}
          aria-current={!activeId ? "page" : undefined}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            !activeId
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          All
        </button>

        {collections.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600 italic">
            No collections yet
          </p>
        ) : (
          collections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(c.id)}
              aria-current={activeId === c.id ? "page" : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${
                activeId === c.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {c.name}
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
