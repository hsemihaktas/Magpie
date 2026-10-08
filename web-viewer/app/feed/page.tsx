import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import CollectionFilter from "@/components/CollectionFilter";
import SearchBar from "@/components/SearchBar";
import PostCardList from "@/components/PostCardList";
import type { Collection, FeedPost, SharedCollection } from "@/lib/types";

interface FeedPageProps {
  searchParams: { collection?: string; q?: string };
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  let postsQuery = supabase
    .from("saved_posts")
    .select("*, collections(name)")
    .order("saved_at", { ascending: false });

  if (searchParams.collection) postsQuery = postsQuery.eq("collection_id", searchParams.collection);
  const trimmedQ = searchParams.q?.trim();
  if (trimmedQ) postsQuery = postsQuery.ilike("content_text", `%${trimmedQ}%`);

  const [{ data: posts }, { data: ownedCollections }, { data: sharedCollections }] =
    await Promise.all([
      postsQuery,
      supabase
        .from("collections")
        .select("id, name, is_default")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_shared_collections_with_owner", {
        p_user_id: session.user.id,
      }),
    ]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 flex gap-6 items-start">
      {/* Sidebar */}
      <Suspense fallback={null}>
        <div className="w-52 shrink-0 sticky top-[calc(3.5rem+1.5rem)]">
          <CollectionFilter
            ownedCollections={(ownedCollections as Collection[]) ?? []}
            sharedCollections={(sharedCollections as SharedCollection[]) ?? []}
            activeId={searchParams.collection}
          />
        </div>
      </Suspense>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <SearchBar initialQuery={searchParams.q ?? ""} />
        <PostCardList
          posts={(posts as FeedPost[]) ?? []}
          currentUserId={session.user.id}
          isCollaborativeView={
            !!(searchParams.collection &&
              (sharedCollections as { collection_id: string; member_role: string }[] ?? [])
                .find(
                  (c) =>
                    c.collection_id === searchParams.collection &&
                    c.member_role === "collaborator"
                ))
          }
        />
      </div>
    </div>
  );
}
