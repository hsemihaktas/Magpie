"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import type { Collection, SharedCollection, TagWithCount } from "@/lib/types";
import {
  renameCollection,
  setDefaultCollection,
  leaveCollection,
} from "@/app/actions";
import dynamic from "next/dynamic";
import TagFilter from "@/components/TagFilter";

const ShareModal = dynamic(() => import("@/components/ShareModal"), {
  ssr: false,
});
const ManageMembersModal = dynamic(
  () => import("@/components/ManageMembersModal"),
  { ssr: false },
);
const JoinCollectionModal = dynamic(
  () => import("@/components/JoinCollectionModal"),
  { ssr: false },
);

interface CollectionFilterProps {
  ownedCollections: Collection[];
  sharedCollections: SharedCollection[];
  activeId?: string;
  tags?: TagWithCount[];
  activeTagId?: string;
}

function CollectionItem({
  c,
  isActive,
  onNavigate,
  onShare,
  onManage,
}: {
  c: Collection;
  isActive: boolean;
  onNavigate: (id: string) => void;
  onShare: (c: Collection) => void;
  onManage: (c: Collection) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.name);
  const [isPending, startTransition] = useTransition();
  const [isDefaultPending, startDefaultTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(c.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue(c.name);
  };

  const saveEdit = () => {
    if (value.trim() === c.name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      await renameCollection(c.id, value);
      setEditing(false);
    });
  };

  const handleSetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (c.is_default) return;
    startDefaultTransition(async () => {
      await setDefaultCollection(c.id);
    });
  };

  if (editing) {
    return (
      <div className="py-1">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            maxLength={255}
            autoFocus
            className="input-sharp flex-1 min-w-0 text-xs py-1"
          />
          <button
            onClick={saveEdit}
            disabled={isPending}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      {/* Star for default */}
      <button
        onClick={handleSetDefault}
        disabled={c.is_default || isDefaultPending}
        className={`p-0.5 transition-colors ${
          c.is_default
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-500"
        }`}
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill={c.is_default ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      {/* Name */}
      <button
        onClick={() => onNavigate(c.id)}
        className={`flex-1 text-left py-1.5 text-xs transition-colors truncate ${
          isActive
            ? "text-zinc-900 dark:text-zinc-100 font-medium"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        {c.name}
      </button>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(c);
          }}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManage(c);
          }}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
        <button
          onClick={startEdit}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SharedCollectionItem({
  c,
  isActive,
  onNavigate,
  onLeave,
}: {
  c: SharedCollection;
  isActive: boolean;
  onNavigate: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  const isCollab = c.member_role === "collaborator";

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={() => onNavigate(c.collection_id)}
        className={`flex-1 text-left py-1.5 transition-colors ${
          isActive
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 shrink-0 ${isCollab ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {isCollab ? (
              <>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          <div className="min-w-0 flex-1">
            <p className={`text-xs truncate ${isActive ? "font-medium" : ""}`}>
              {c.collection_name}
            </p>
            <p className="mono text-[10px] text-zinc-400 truncate">
              {c.owner_email}
            </p>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLeave(c.collection_id);
        }}
        className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export default function CollectionFilter({
  ownedCollections,
  sharedCollections,
  activeId,
  tags = [],
  activeTagId,
}: CollectionFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shareTarget, setShareTarget] = useState<Collection | null>(null);
  const [manageTarget, setManageTarget] = useState<Collection | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [, startLeaveTransition] = useTransition();

  const handleLeave = (collectionId: string) => {
    if (!confirm("Bu koleksiyondan ayrılmak istiyor musun?")) return;
    startLeaveTransition(async () => {
      await leaveCollection(collectionId);
    });
  };

  function navigate(collectionId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (collectionId) params.set("collection", collectionId);
    else params.delete("collection");
    params.delete("tag");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const sorted = [...ownedCollections].sort(
    (a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0),
  );

  return (
    <>
      <aside className="w-48 shrink-0 space-y-8">
        {/* Collections */}
        <div className="space-y-3">
          <p className="sidebar-header">Koleksiyonlar</p>
          <nav className="space-y-0.5">
            {/* All */}
            <button
              onClick={() => navigate()}
              className={`w-full text-left py-1.5 text-xs transition-colors ${
                !activeId
                  ? "text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Tümü
            </button>

            {sorted.length === 0 ? (
              <p className="py-2 text-xs text-zinc-400 italic">
                Henüz koleksiyon yok
              </p>
            ) : (
              sorted.map((c) => (
                <CollectionItem
                  key={c.id}
                  c={c}
                  isActive={activeId === c.id}
                  onNavigate={navigate}
                  onShare={setShareTarget}
                  onManage={setManageTarget}
                />
              ))
            )}

            {/* Shared */}
            {sharedCollections.length > 0 && (
              <div className="pt-4 space-y-0.5">
                <p className="sidebar-header">Paylaşılan</p>
                {sharedCollections.map((c) => (
                  <SharedCollectionItem
                    key={c.collection_id}
                    c={c}
                    isActive={activeId === c.collection_id}
                    onNavigate={navigate}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            )}

            {/* Join - Dashed button */}
            <div className="pt-4">
              <button
                onClick={() => setJoinOpen(true)}
                className="dashed-button w-full flex items-center justify-center gap-1.5 py-2 text-xs"
              >
                <span className="mono">+</span>
                <span>KOLEKSİYONA KATIL</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Tags */}
        <TagFilter tags={tags} activeTagId={activeTagId} />
      </aside>

      {shareTarget && (
        <ShareModal
          collectionId={shareTarget.id}
          collectionName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
      {manageTarget && (
        <ManageMembersModal
          collectionId={manageTarget.id}
          collectionName={manageTarget.name}
          onClose={() => setManageTarget(null)}
        />
      )}
      {joinOpen && <JoinCollectionModal onClose={() => setJoinOpen(false)} />}
    </>
  );
}
