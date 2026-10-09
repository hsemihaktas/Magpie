"use server";


import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";


/**
 * Extracts the Supabase Storage object path from a public thumbnail URL.
 * URL format: https://xxx.supabase.co/storage/v1/object/public/thumbnails/{userId}/{postId}.{ext}
 * Returns e.g. "userId/postId.jpg" or null if not a thumbnails URL.
 */
function storagePathFromThumbnailUrl(url: string): string | null {
  try {
    const marker = "/thumbnails/";
    const idx = new URL(url).pathname.indexOf(marker);
    if (idx === -1) return null;
    return new URL(url).pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

/**
 * Deletes a saved post by ID and removes its thumbnail from Storage.
 * RLS ensures the user can only delete their own posts.
 */
export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Not authenticated" };

  // Fetch thumbnail_url before deleting so we can clean up Storage
  const { data: post } = await supabase
    .from("saved_posts")
    .select("thumbnail_url")
    .eq("id", postId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  // Delete DB row
  const { error } = await supabase
    .from("saved_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", session.user.id);

  if (error) return { error: error.message };

  // Delete thumbnail from Storage (best-effort — don't fail the whole operation)
  if (post?.thumbnail_url) {
    const storagePath = storagePathFromThumbnailUrl(post.thumbnail_url);
    if (storagePath) {
      await supabase.storage.from("thumbnails").remove([storagePath]).catch(() => {});
    }
  }

  revalidatePath("/feed");
  return { error: null };
}


/**
 * Renames a collection. RLS ensures the user can only update their own collections.
 */
export async function renameCollection(
  collectionId: string,
  newName: string
): Promise<{ error: string | null }> {
  const trimmed = newName.trim();
  if (!trimmed) return { error: "Name cannot be empty" };
  if (trimmed.length > 255) return { error: "Name too long" };

  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collections")
    .update({ name: trimmed })
    .eq("id", collectionId)
    .eq("user_id", session.user.id);

  if (error) return { error: error.message };

  revalidatePath("/feed");
  return { error: null };
}


/**
 * Designates a collection as the user's default save target.
 * Clears the previous default (at most one per user) then sets the new one.
 */
export async function setDefaultCollection(
  collectionId: string
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Not authenticated" };

  // Clear existing default for this user
  await supabase
    .from("collections")
    .update({ is_default: false })
    .eq("user_id", session.user.id)
    .eq("is_default", true);

  // Set the new default
  const { error } = await supabase
    .from("collections")
    .update({ is_default: true })
    .eq("id", collectionId)
    .eq("user_id", session.user.id);

  if (error) return { error: error.message };

  revalidatePath("/feed");
  return { error: null };
}


/**
 * Deletes multiple saved posts by ID and removes their thumbnails from Storage.
 */
export async function deletePosts(
  postIds: string[]
): Promise<{ error: string | null }> {
  if (postIds.length === 0) return { error: null };

  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Not authenticated" };

  // Fetch thumbnail_urls before deleting
  const { data: posts } = await supabase
    .from("saved_posts")
    .select("thumbnail_url")
    .in("id", postIds)
    .eq("user_id", session.user.id);

  // Delete DB rows
  const { error } = await supabase
    .from("saved_posts")
    .delete()
    .in("id", postIds)
    .eq("user_id", session.user.id);

  if (error) return { error: error.message };

  // Delete thumbnails from Storage (best-effort)
  if (posts && posts.length > 0) {
    const storagePaths = posts
      .map((p) => p.thumbnail_url ? storagePathFromThumbnailUrl(p.thumbnail_url) : null)
      .filter((p): p is string => p !== null);
    if (storagePaths.length > 0) {
      await supabase.storage.from("thumbnails").remove(storagePaths).catch(() => {});
    }
  }

  revalidatePath("/feed");
  return { error: null };
}


// ─────────────────────────────────────────────────────────────────────────────
// Shared Collection — Server Actions
// ─────────────────────────────────────────────────────────────────────────────

import { generateCode } from "@/lib/invite-code";
import type { CollectionMember, SharedCollection, ActiveInvite } from "@/lib/types";

/**
 * Generates a single-use 24-hour invite code.
 * - Owner can create viewer OR collaborator invites.
 * - Existing collaborator members can also create collaborator invites.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export async function generateInviteCode(
  collectionId: string,
  grantsRole: "viewer" | "collaborator" = "viewer"
): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  // Only the collection owner can generate invite codes
  const { data: ownedCol } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!ownedCol) {
    return { error: "Yalnızca koleksiyon sahibi davet kodu oluşturabilir." };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Retry up to 5 times on unique constraint collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("collection_invites").insert({
      collection_id: collectionId,
      created_by: session.user.id,
      code,
      expires_at: expiresAt,
      grants_role: grantsRole,
    });

    if (!error) return { code, expiresAt };
    if (error.code !== "23505") return { error: error.message };
  }

  return { error: "Kod oluşturulamadı. Tekrar deneyin." };
}

/**
 * Redeems an invite code and creates a membership.
 * Requirements: 2.1–2.8
 */
export async function joinCollectionViaCode(
  rawCode: string
): Promise<{ collectionId: string; collectionName: string; memberRole: "viewer" | "collaborator" } | { error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) return { error: "geçersiz kod" };

  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  const { data, error } = await supabase.rpc("redeem_invite", {
    p_code: code,
    p_user_id: session.user.id,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("NOT_FOUND"))      return { error: "geçersiz kod" };
    if (msg.includes("ALREADY_USED"))   return { error: "kod zaten kullanılmış" };
    if (msg.includes("EXPIRED"))        return { error: "kod süresi dolmuş" };
    if (msg.includes("IS_OWNER"))       return { error: "Kendi koleksiyonunuza üye olamazsınız" };
    if (msg.includes("ALREADY_MEMBER")) return { error: "Bu koleksiyona zaten üyesiniz" };
    return { error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/feed");
  return {
    collectionId: row.collection_id,
    collectionName: row.collection_name,
    memberRole: (row.member_role ?? "viewer") as "viewer" | "collaborator",
  };
}

/**
 * Returns the list of members for a collection the user owns.
 * Requirements: 5.3
 */
export async function getCollectionMembers(
  collectionId: string
): Promise<{ members: CollectionMember[] } | { error: string }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  const { data, error } = await supabase.rpc("get_members_with_email", {
    p_collection_id: collectionId,
  });

  if (error) return { error: error.message };
  return { members: (data as CollectionMember[]) ?? [] };
}

/**
 * Removes a member from a collection the current user owns.
 * Requirements: 5.1, 5.2, 5.4
 */
export async function revokeCollectionMember(
  collectionId: string,
  memberUserId: string
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  // Ownership check via session client (RLS applies)
  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!col) return { error: "Bu koleksiyona erişim yetkiniz yok." };

  // Session client + cm_owner_delete RLS policy enforces ownership
  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("member_user_id", memberUserId);

  if (error) return { error: error.message };
  revalidatePath("/feed");
  return { error: null };
}

/**
 * Returns active (unused, non-expired) invite codes for a collection the user owns.
 */
export async function getActiveInvites(
  collectionId: string
): Promise<{ invites: ActiveInvite[] } | { error: string }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  const { data, error } = await supabase.rpc("get_active_invites", {
    p_collection_id: collectionId,
  });

  if (error) return { error: error.message };
  return { invites: (data as ActiveInvite[]) ?? [] };
}

/**
 * Revokes (deletes) an unused invite code.
 * Only the collection owner can call this.
 */
export async function revokeInviteCode(
  inviteId: string
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  // Verify the caller owns the collection this invite belongs to
  const { data: invite } = await supabase
    .from("collection_invites")
    .select("collection_id")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { error: "Kod bulunamadı." };

  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", invite.collection_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!col) return { error: "Bu işlem için yetkiniz yok." };

  // Session client + ci_owner_delete RLS policy enforces ownership
  const { error } = await supabase
    .from("collection_invites")
    .delete()
    .eq("id", inviteId);

  if (error) return { error: error.message };
  return { error: null };
}


/**
 * Allows the current user to leave a shared collection they were invited to.
 * Members can remove themselves; they cannot remove others.
 */
export async function leaveCollection(
  collectionId: string
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum açmanız gerekiyor." };

  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("member_user_id", session.user.id);

  if (error) return { error: error.message };
  revalidatePath("/feed");
  return { error: null };
}


/**
 * Signs the current user out and redirects to /login.
 */
export async function signOut(): Promise<void> {
  const { redirect } = await import("next/navigation");
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

