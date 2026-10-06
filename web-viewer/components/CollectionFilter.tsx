"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import type { Collection } from "@/lib/types";
import { renameCollection, setDefaultCollection } from "@/app/actions";

interface CollectionFilterProps {
  collections: Collection[];
  activeId?: string;
}

function CollectionItem({
  c,
  isActive,
  onNavigate,
}: {
  c: Collection;
  isActive: boolean;
  onNavigate: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDefaultPending, startDefaultTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(c.name);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue(c.name);
    setError(null);
  };

  const saveEdit = () => {
    if (value.trim() === c.name) { cancelEdit(); return; }
    startTransition(async () => {
      const { error } = await renameCollection(c.id, value);
      if (error) { setError(error); }
      else { setEditing(false); setError(null); }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  if (editing) {
    return (
      <div className="px-3 py-1.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={255}
            autoFocus
            className="flex-1 min-w-0 text-sm px-2 py-1 rounded-md border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={saveEdit}
            disabled={isPending}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 p-1 disabled:opacity-40"
            aria-label="Save"
          >
            {isPending ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            aria-label="Cancel"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>}
      </div>
    );
  }

  const handleSetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (c.is_default) return; // already default
    startDefaultTransition(async () => {
      await setDefaultCollection(c.id);
    });
  };

  return (
    <div className="group/item flex items-center gap-1">
      {/* Default star — filled when default, outlined on hover otherwise */}
      <button
        type="button"
        onClick={handleSetDefault}
        disabled={c.is_default || isDefaultPending}
        aria-label={c.is_default ? `${c.name} is the default collection` : `Set ${c.name} as default`}
        title={c.is_default ? "Default collection" : "Set as default"}
        className={`p-1 rounded shrink-0 transition-all ${
          c.is_default
            ? "text-amber-500 dark:text-amber-400 opacity-100"
            : "opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-amber-400 dark:text-gray-600 dark:hover:text-amber-400"
        }`}
      >
        {isDefaultPending ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={c.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => onNavigate(c.id)}
        aria-current={isActive ? "page" : undefined}
        className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        {c.name}
      </button>
      {/* Rename button — visible on hover */}
      <button
        type="button"
        onClick={startEdit}
        aria-label={`Rename ${c.name}`}
        className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  );
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
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600 italic">No collections yet</p>
        ) : (
          collections.map((c) => (
            <CollectionItem
              key={c.id}
              c={c}
              isActive={activeId === c.id}
              onNavigate={navigate}
            />
          ))
        )}
      </nav>
    </aside>
  );
}
