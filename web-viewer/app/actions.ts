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
