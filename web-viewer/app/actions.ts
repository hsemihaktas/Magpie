"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";

/**
 * Deletes a saved post by ID. RLS ensures the user can only delete their own posts.
 */
export async function deletePost(postId: string): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  // Safety: verify session exists
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("saved_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", session.user.id); // Extra safety on top of RLS

  if (error) return { error: error.message };

  revalidatePath("/feed"); // Refresh the feed after deletion
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
