"use client";
import { ModalPortal } from "@/components/ModalPortal";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import type { Collection, Tag } from "@/lib/types";
import {
  movePost,
  updatePostNote,
  addTagToPost,
  removeTagFromPost,
  createTagAndAddToPost,
} from "@/app/actions";
import type { FeedPost } from "@/lib/types";
import { deletePost } from "@/app/actions";

// ── Platform icons ────────────────────────────────────────────────────────────

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      aria-label="Instagram"
      role="img"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke="url(#ig-g)"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        stroke="url(#ig-g)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-g)" />
      <defs>
        <linearGradient id="ig-g" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      aria-label="X"
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L2.002 2.25h6.351l4.266 5.643L18.244 2.25z" />
    </svg>
  );
}

// ── Highlight helper ──────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!terms.length) return text;

  const re = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(re);

  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-yellow-200/80 dark:bg-yellow-500/30 text-inherit rounded-[2px] not-italic"
      >
        {part}
      </mark>
    ) : (
      part || null
    ),
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

const MAX_LEN = 240;
const POST_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  tweet: "Tweet",
};

// ── DeleteDialog ──────────────────────────────────────────────────────────────

function DeleteDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[320px] p-6 flex flex-col gap-5 border border-gray-100 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0 ring-1 ring-red-100 dark:ring-red-900/40">
              <svg
                className="w-5 h-5 text-red-500"
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
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                Bu kaydı sil?
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Arşivinden kaldırılacak, geri alınamaz.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors shadow-sm"
            >
              Sil
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── NoteEditor ────────────────────────────────────────────────────────────────

interface NoteEditorProps {
  postId: string;
  initialNote: string | null;
  noteType: "note" | "public_note";
  onNoteChange: (note: string | null) => void;
  onClose: () => void;
  label: string;
  placeholder: string;
}

function NoteEditor({
  postId,
  initialNote,
  noteType,
  onNoteChange,
  onClose,
  label,
  placeholder,
}: NoteEditorProps) {
  const [value, setValue] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const saveNote = useCallback(
    async (note: string) => {
      setSaving(true);
      setSaved(false);
      const result = await updatePostNote(postId, note || null, noteType);
      setSaving(false);
      if (result.ok) {
        setSaved(true);
        onNoteChange(note || null);
        setTimeout(() => setSaved(false), 1500);
      }
    },
    [postId, noteType, onNoteChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNote(newValue);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mt-2 space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Kaydediliyor...
            </span>
          )}
          {saved && !saving && (
            <span className="text-[10px] text-emerald-500 dark:text-emerald-400">
              ✓
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {value.length}/2000
          </span>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={2000}
        rows={2}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

// ── TagPicker ─────────────────────────────────────────────────────────────────

interface TagPickerProps {
  postId: string;
  currentTags: Tag[];
  allTags: Tag[];
  onTagAdded: (tag: Tag) => void;
  onTagRemoved: (tagId: string) => void;
  onClose: () => void;
}

function TagPicker({
  postId,
  currentTags,
  allTags,
  onTagAdded,
  onTagRemoved,
  onClose,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = allTags.filter(
    (t) =>
      !currentTagIds.has(t.id) &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );
  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreateOption = query.trim() && !exactMatch;

  const handleAddTag = (tag: Tag) => {
    startTransition(async () => {
      const result = await addTagToPost(postId, tag.id);
      if (result.ok) {
        onTagAdded(tag);
        setQuery("");
      }
    });
  };

  const handleCreateAndAdd = () => {
    if (!query.trim()) return;
    startTransition(async () => {
      const result = await createTagAndAddToPost(postId, query.trim());
      if (result.ok) {
        onTagAdded(result.data);
        setQuery("");
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      const result = await removeTagFromPost(postId, tagId);
      if (result.ok) {
        onTagRemoved(tagId);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && showCreateOption) {
      e.preventDefault();
      handleCreateAndAdd();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      className="mt-2 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Current tags */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {currentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={isPending}
                className="hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search/create input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Etiket ara veya oluştur..."
          maxLength={50}
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-transparent transition-shadow"
        />
        {isPending && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <svg
              className="w-4 h-4 animate-spin text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {(availableTags.length > 0 || showCreateOption) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg max-h-32 overflow-y-auto">
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateAndAdd}
              disabled={isPending}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                &ldquo;{query.trim()}&rdquo;
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs">
                oluştur
              </span>
            </button>
          )}
          {availableTags.slice(0, 5).map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleAddTag(tag)}
              disabled={isPending}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  currentUserId?: string;
  isCollaborativeView?: boolean;
  searchQuery?: string;
  ownedCollections?: Collection[];
  onMovePost?: (
    postId: string,
    collectionId: string | null,
    collectionName: string | null,
  ) => void;
  allTags?: Tag[];
  onTagsChanged?: (postId: string, tags: Tag[]) => void;
}

export default function PostCard({
  post,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  currentUserId,
  isCollaborativeView = false,
  searchQuery,
  ownedCollections,
  onMovePost,
  allTags = [],
  onTagsChanged,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [movePending, startMoveTransition] = useTransition();
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showPublicNoteEditor, setShowPublicNoteEditor] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [localNote, setLocalNote] = useState(post.note ?? null);
  const [localPublicNote, setLocalPublicNote] = useState(
    post.public_note ?? null,
  );
  const [localTags, setLocalTags] = useState<Tag[]>(post.tags ?? []);
  const [tagRemovePending, startTagRemoveTransition] = useTransition();

  const thumbnailUrl = thumbError
    ? null
    : safeUrl(post.thumbnail_url ?? post.media_urls?.[0] ?? null);
  const contentText = post.content_text ?? "";
  const isLong = contentText.length > MAX_LEN;
  const display =
    isLong && !expanded ? contentText.slice(0, MAX_LEN) + "…" : contentText;

  const contentNode =
    searchQuery && display ? highlight(display, searchQuery) : display;

  const date = new Date(post.saved_at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const postTypeLabel = post.post_type
    ? (POST_TYPE_LABELS[post.post_type] ?? post.post_type)
    : null;
  const displayName = post.author_display_name || post.author_username;

  const isOwnPost = post.user_id === currentUserId;

  const confirmDelete = () => {
    setShowDeleteDialog(false);
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (result.ok) setDeleted(true);
      else alert("Silme başarısız: " + result.error);
    });
  };

  const handleCollectionChange = (collectionId: string | null) => {
    setShowCollectionPicker(false);
    const col = collectionId
      ? ownedCollections?.find((c) => c.id === collectionId)
      : null;
    startMoveTransition(async () => {
      const result = await movePost(post.id, collectionId);
      if (result.ok) {
        onMovePost?.(post.id, collectionId, col?.name ?? null);
      }
    });
  };

  const handleTagAdded = (tag: Tag) => {
    const newTags = [...localTags, tag];
    setLocalTags(newTags);
    onTagsChanged?.(post.id, newTags);
  };

  const handleTagRemoved = (tagId: string) => {
    const newTags = localTags.filter((t) => t.id !== tagId);
    setLocalTags(newTags);
    onTagsChanged?.(post.id, newTags);
  };

  // Remove tag directly from display (without opening picker)
  const handleQuickRemoveTag = (tagId: string) => {
    startTagRemoveTransition(async () => {
      const result = await removeTagFromPost(post.id, tagId);
      if (result.ok) {
        handleTagRemoved(tagId);
      }
    });
  };

  if (deleted) return null;

  return (
    <div className="relative">
      {showDeleteDialog && (
        <DeleteDialog
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={confirmDelete}
        />
      )}

      <article
        onClick={selectMode ? onToggleSelect : undefined}
        className={[
          "group relative flex flex-col bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden transition-all duration-200",
          selectMode ? "cursor-pointer select-none" : "",
          isSelected
            ? "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 dark:ring-indigo-400/30"
            : "border-gray-200 dark:border-gray-800",
          isPending
            ? "opacity-50 pointer-events-none"
            : !selectMode
              ? "hover:shadow-lg dark:hover:shadow-black/30 hover:-translate-y-0.5"
              : "hover:shadow-md",
        ].join(" ")}
      >
        {/* Select mode checkbox */}
        {selectMode && (
          <div
            className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected
                ? "bg-indigo-500 border-indigo-500 shadow-md"
                : "bg-white/80 dark:bg-gray-900/80 border-gray-300 dark:border-gray-600 backdrop-blur-sm"
            }`}
          >
            {isSelected && (
              <svg
                className="w-3.5 h-3.5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Single delete button */}
        {!selectMode &&
          (!isCollaborativeView || post.user_id === currentUserId) && (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="Delete post"
              className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-all duration-150"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}

        {/* Thumbnail */}
        {thumbnailUrl ? (
          <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              onError={() => setThumbError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="absolute top-2 left-2 flex gap-1.5">
              {postTypeLabel && !selectMode && (
                <span className="bg-black/40 backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
                  {postTypeLabel}
                </span>
              )}
            </div>
            <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm rounded-lg p-1">
              {post.platform === "instagram" ? (
                <InstagramIcon className="w-3.5 h-3.5" />
              ) : (
                <XIcon className="w-3.5 h-3.5 text-white" />
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex flex-col items-center justify-center gap-2 px-4">
            {post.platform === "instagram" ? (
              <InstagramIcon className="w-8 h-8 opacity-20" />
            ) : (
              <XIcon className="w-8 h-8 opacity-20 text-gray-500" />
            )}
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">
              Görsel yüklenemedi
            </p>
            {safeUrl(post.post_url) && (
              <a
                href={safeUrl(post.post_url)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                Orijinal postu aç
                <svg
                  className="w-2.5 h-2.5"
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
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 flex flex-col gap-3 flex-1">
          {/* Author */}
          <div className="flex items-center gap-2.5">
            {safeUrl(post.author_avatar_url) && !avatarError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeUrl(post.author_avatar_url)!}
                alt=""
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-gray-700 shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0 flex items-center justify-center text-white text-xs font-bold">
                {displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {displayName && (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                  {displayName}
                </p>
              )}
              {post.author_username && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate leading-tight">
                  @{post.author_username}
                </p>
              )}
            </div>
          </div>

          {/* Caption */}
          {contentText ? (
            <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <p className="whitespace-pre-wrap break-words">{contentNode}</p>
              {isLong && !selectMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className="mt-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-600 italic">
              No caption
            </p>
          )}

          {/* Tags display (with hover delete) */}
          {localTags.length > 0 && !showTagPicker && (
            <div className="flex flex-wrap gap-1.5">
              {localTags.map((tag) => (
                <span
                  key={tag.id}
                  className="group/tag inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50 transition-colors"
                >
                  <svg
                    className="w-2.5 h-2.5 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  {tag.name}
                  {isOwnPost && !selectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickRemoveTag(tag.id);
                      }}
                      disabled={tagRemovePending}
                      className="opacity-0 group-hover/tag:opacity-100 -mr-0.5 p-0.5 hover:text-red-500 dark:hover:text-red-400 transition-all disabled:opacity-50"
                    >
                      <svg
                        className="w-2.5 h-2.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Public note preview */}
          {localPublicNote && !showPublicNoteEditor && (
            <div
              className="group/note flex items-start gap-2 rounded-lg px-3 py-2 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 cursor-pointer hover:border-sky-300/80 dark:hover:border-sky-700/60 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (isOwnPost && !selectMode) setShowPublicNoteEditor(true);
              }}
            >
              <svg
                className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-500/70 dark:text-sky-400/60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="flex-1 text-xs text-sky-800/80 dark:text-sky-200/70 whitespace-pre-wrap line-clamp-2 leading-relaxed">
                {localPublicNote}
              </p>
            </div>
          )}

          {/* Private note preview (only for own posts) */}
          {localNote && isOwnPost && !showNoteEditor && (
            <div
              className="group/note flex items-start gap-2 rounded-lg px-3 py-2 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 cursor-pointer hover:border-violet-300/80 dark:hover:border-violet-700/60 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (!selectMode) setShowNoteEditor(true);
              }}
            >
              <svg
                className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-500/70 dark:text-violet-400/60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="flex-1 text-xs text-violet-800/80 dark:text-violet-200/70 whitespace-pre-wrap line-clamp-2 leading-relaxed">
                {localNote}
              </p>
            </div>
          )}

          {/* Note editors (inline) */}
          {showNoteEditor && isOwnPost && !selectMode && (
            <NoteEditor
              postId={post.id}
              initialNote={localNote}
              noteType="note"
              onNoteChange={setLocalNote}
              onClose={() => setShowNoteEditor(false)}
              label="Kişisel Not"
              placeholder="Sadece sen görebilirsin..."
            />
          )}

          {showPublicNoteEditor && isOwnPost && !selectMode && (
            <NoteEditor
              postId={post.id}
              initialNote={localPublicNote}
              noteType="public_note"
              onNoteChange={setLocalPublicNote}
              onClose={() => setShowPublicNoteEditor(false)}
              label="Herkese Açık Not"
              placeholder="Koleksiyon üyeleri görebilir..."
            />
          )}

          {/* Tag picker (inline) */}
          {showTagPicker && isOwnPost && !selectMode && (
            <TagPicker
              postId={post.id}
              currentTags={localTags}
              allTags={allTags}
              onTagAdded={handleTagAdded}
              onTagRemoved={handleTagRemoved}
              onClose={() => setShowTagPicker(false)}
            />
          )}

          {/* Saved date + action buttons */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>

            {/* Note & Tag buttons (only for own posts) */}
            {isOwnPost && !selectMode && (
              <div className="flex items-center gap-0.5">
                {/* Public note button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPublicNoteEditor(!showPublicNoteEditor);
                    setShowNoteEditor(false);
                    setShowTagPicker(false);
                  }}
                  title={
                    localPublicNote
                      ? "Herkese açık notu düzenle"
                      : "Herkese açık not ekle"
                  }
                  className={`p-1.5 rounded-md transition-colors ${
                    localPublicNote
                      ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>

                {/* Private note button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNoteEditor(!showNoteEditor);
                    setShowPublicNoteEditor(false);
                    setShowTagPicker(false);
                  }}
                  title={
                    localNote ? "Kişisel notu düzenle" : "Kişisel not ekle"
                  }
                  className={`p-1.5 rounded-md transition-colors ${
                    localNote
                      ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </button>

                {/* Tag button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTagPicker(!showTagPicker);
                    setShowNoteEditor(false);
                    setShowPublicNoteEditor(false);
                  }}
                  title="Etiket ekle"
                  className={`p-1.5 rounded-md transition-colors ${
                    localTags.length > 0
                      ? "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
            {/* Collection badge */}
            {!selectMode && ownedCollections && ownedCollections.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCollectionPicker((v) => !v);
                }}
                disabled={movePending}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 max-w-[140px] hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-50"
              >
                <span className="truncate">
                  {post.collections?.name ?? "Koleksiyonsuz"}
                </span>
                <svg
                  className="w-2.5 h-2.5 shrink-0 opacity-60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : post.collections?.name ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 truncate max-w-[130px]">
                {post.collections.name}
              </span>
            ) : (
              <span />
            )}

            {safeUrl(post.post_url) && !selectMode ? (
              <a
                href={safeUrl(post.post_url)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-1 shrink-0"
              >
                View original
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
              <span />
            )}
          </div>
        </div>
      </article>

      {/* Collection picker dropdown */}
      {showCollectionPicker && !selectMode && ownedCollections && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowCollectionPicker(false)}
          />
          <div className="absolute bottom-14 left-3 z-50 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-1 min-w-[160px]">
            {ownedCollections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => handleCollectionChange(col.id)}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {post.collection_id === col.id ? (
                  <svg
                    className="w-3 h-3 shrink-0 text-indigo-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="w-3 h-3 shrink-0" />
                )}
                <span
                  className={`truncate ${post.collection_id === col.id ? "font-semibold text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {col.name}
                  {col.is_default ? " ★" : ""}
                </span>
              </button>
            ))}
            <div className="mx-3 my-0.5 border-t border-gray-100 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => handleCollectionChange(null)}
              className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {!post.collection_id ? (
                <svg
                  className="w-3 h-3 shrink-0 text-indigo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="w-3 h-3 shrink-0" />
              )}
              <span
                className={`${!post.collection_id ? "font-semibold text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}
              >
                Koleksiyonsuz
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
