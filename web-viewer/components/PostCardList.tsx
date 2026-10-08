"use client";
import React from "react";
import { ModalPortal } from "@/components/ModalPortal";

import { useState, useTransition } from "react";
import type { FeedPost } from "@/lib/types";
import PostCard from "@/components/PostCard";
import { deletePosts } from "@/app/actions";

function BulkDeleteDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[320px] p-6 flex flex-col gap-5 border border-gray-100 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0 ring-1 ring-red-100 dark:ring-red-900/40">
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <div className="pt-0.5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {count} kaydı sil?
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Seçilen kayıtlar arşivinden kaldırılacak, geri alınamaz.
            </p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Vazgeç
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors shadow-sm">
            Sil
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

export default function PostCardList({
  posts: initialPosts,
  currentUserId,
  isCollaborativeView = false,
}: {
  posts: FeedPost[];
  currentUserId?: string;
  isCollaborativeView?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);

  // Sync when parent re-renders with new posts (collection filter / search navigation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { setPosts(initialPosts); }, [JSON.stringify(initialPosts.map(p => p.id))]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const confirmBulkDelete = () => {
    setShowDialog(false);
    startTransition(async () => {
      const ids = Array.from(selectedIds);
      const { error } = await deletePosts(ids);
      if (!error) {
        const deleted = new Set(ids);
        setPosts((prev) => prev.filter((p) => !deleted.has(p.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
      }
    });
  };

  const allSelected = posts.length > 0 && selectedIds.size === posts.length;

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-500 dark:text-gray-400">No results found</p>
        <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Try adjusting your search or save some posts first.</p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar row */}
      <div className="flex items-center justify-between min-h-[32px]">
        {selectMode ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
            >
              {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {selectedIds.size > 0 ? `${selectedIds.size} seçildi` : ""}
            </span>
          </div>
        ) : (
          <span />
        )}

        {selectMode ? (
          <button
            type="button"
            onClick={exitSelectMode}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            İptal
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Seç
          </button>
        )}
      </div>

      {/* Grid */}
      <ul className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              selectMode={selectMode}
              isSelected={selectedIds.has(post.id)}
              onToggleSelect={() => toggleSelect(post.id)}
              currentUserId={currentUserId}
              isCollaborativeView={isCollaborativeView}
            />
          </li>
        ))}
      </ul>

      {/* Floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
            {selectedIds.size} kayıt seçildi
          </span>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Sil
          </button>
        </div>
      )}

      {/* Bulk delete dialog */}
      {showDialog && (
        <BulkDeleteDialog
          count={selectedIds.size}
          onCancel={() => setShowDialog(false)}
          onConfirm={confirmBulkDelete}
        />
      )}
    </>
  );
}
