"use server";
/**
 * posts.ts — Saved post actions.
 * Handles single and bulk post deletion including Storage cleanup
 * (thumbnail and avatar files in the Supabase 'thumbnails' bucket).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema = z.string().uuid("Geçersiz post ID.");
const uuidArraySchema = z.array(uuidSchema).min(1, "En az bir post seçilmeli.");

// ── Storage helpers ───────────────────────────────────────────────────────────
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

function collectStoragePaths(post: {
  thumbnail_url?: string | null;
  author_avatar_url?: string | null;
}): string[] {
  const paths: string[] = [];
  if (post.thumbnail_url) {
    const p = storagePathFromThumbnailUrl(post.thumbnail_url);
    if (p) paths.push(p);
  }
  if (post.author_avatar_url?.includes("/thumbnails/")) {
    const p = storagePathFromThumbnailUrl(post.author_avatar_url);
    if (p) paths.push(p);
  }
  return paths;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function deletePost(postId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(postId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { data: post } = await supabase
      .from("saved_posts")
      .select("thumbnail_url, author_avatar_url")
      .eq("id", postId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);

    if (post) {
      const paths = collectStoragePaths(post);
      if (paths.length > 0)
        await supabase.storage.from("thumbnails").remove(paths).catch(() => {});
    }

    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Silme başarısız.");
  }
}

export async function deletePosts(postIds: string[]): Promise<ActionResult> {
  const parsed = uuidArraySchema.safeParse(postIds);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  if (parsed.data.length === 0) return ok(undefined);

  try {
    const { supabase, session } = await requireAuth();

    const { data: posts } = await supabase
      .from("saved_posts")
      .select("thumbnail_url, author_avatar_url")
      .in("id", parsed.data)
      .eq("user_id", session.user.id);

    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .in("id", parsed.data)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);

    if (posts?.length) {
      const storagePaths = posts.flatMap(collectStoragePaths);
      if (storagePaths.length > 0)
        await supabase.storage.from("thumbnails").remove(storagePaths).catch(() => {});
    }

    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Toplu silme başarısız.");
  }
}
