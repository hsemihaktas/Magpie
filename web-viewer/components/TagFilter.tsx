"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { TagWithCount } from "@/lib/types";
import { deleteTag } from "@/app/actions";

interface TagFilterProps {
  tags: TagWithCount[];
  activeTagId?: string;
}

export default function TagFilter({ tags, activeTagId }: TagFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function navigate(tagId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tagId) params.set("tag", tagId);
    else params.delete("tag");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleDelete(tagId: string, tagName: string) {
    if (
      !confirm(
        `"${tagName}" etiketini silmek istiyor musun? Tüm postlardan kaldırılacak.`,
      )
    )
      return;
    setDeletingId(tagId);
    startDeleteTransition(async () => {
      await deleteTag(tagId);
      setDeletingId(null);
      if (activeTagId === tagId) {
        navigate();
      }
    });
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 mb-2">
        Etiketler
      </p>
      <nav className="space-y-0.5">
        {/* Tag list */}
        {tags.map((tag) => {
          const isActive = activeTagId === tag.id;
          return (
            <div
              key={tag.id}
              className={`group/tag flex items-center gap-1 ${deletingId === tag.id ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                onClick={() => navigate(isActive ? undefined : tag.id)}
                aria-current={isActive ? "page" : undefined}
                disabled={deletingId === tag.id}
                className={`flex-1 min-w-0 text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                  isActive
                    ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
                }`}
              >
                {/* Tag icon or X icon on hover when active */}
                <span className="relative w-3 h-3 shrink-0">
                  {/* Tag icon - hide on hover when active */}
                  <svg
                    className={`absolute inset-0 w-3 h-3 transition-opacity ${
                      isActive
                        ? "text-teal-500 dark:text-teal-400 group-hover/tag:opacity-0"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  {/* X icon - show on hover when active */}
                  {isActive && (
                    <svg
                      className="absolute inset-0 w-3 h-3 text-teal-500 dark:text-teal-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{tag.name}</span>
                <span
                  className={`text-[10px] ml-auto shrink-0 ${
                    isActive
                      ? "text-teal-500/70 dark:text-teal-400/70"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {tag.post_count}
                </span>
              </button>

              {/* Delete button (hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(tag.id, tag.name);
                }}
                disabled={deletingId === tag.id}
                aria-label={`${tag.name} etiketini sil`}
                title="Etiketi sil"
                className="opacity-0 group-hover/tag:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0 disabled:opacity-50"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
