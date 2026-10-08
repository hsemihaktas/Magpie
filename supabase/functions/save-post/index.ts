import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../shared/rate-limit.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

interface SavePostBody {
  post_url: string;
  collection_id: string;
  post_type?: string | null;
  platform?: string | null;
  author_username?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  content_text?: string | null;
  media_urls?: string[] | null;
  post_timestamp?: string | null;
  raw_metadata?: Record<string, unknown> | null;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

// ── Thumbnail Upload (Requirements 19.1, 19.2, 19.4) ──────────────────────────
// Downloads the first media URL and persists it to Supabase Storage.
// All errors are silently swallowed so failures never affect the main response.
async function uploadThumbnail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  postId: string,
  mediaUrls: string[],
): Promise<void> {
  try {
    // Requirement 19.1: only proceed when there is at least one media URL
    if (!mediaUrls.length || !mediaUrls[0]) {
      return;
    }

    // Derive file extension from URL, defaulting to 'jpg'
    const rawUrl = mediaUrls[0].split("?")[0]; // strip query string
    const urlParts = rawUrl.split(".");
    const ext = urlParts.length > 1 ? urlParts[urlParts.length - 1] : "jpg";

    // Storage path: {userId}/{postId}.{ext}
    const storagePath = `${userId}/${postId}.${ext}`;

    // Download the media — include browser-like headers so Instagram's CDN
    // does not reject the request as a crawler/hotlink attempt.
    const mediaRes = await fetch(mediaUrls[0], {
      headers: {
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    });
    if (!mediaRes.ok) {
      return;
    }

    const blob = await mediaRes.blob();

    // Upload to the 'thumbnails' bucket (Requirement 19.2)
    const { error: uploadError } = await supabase.storage
      .from("thumbnails")
      .upload(storagePath, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return;
    }

    // Retrieve the public URL for the uploaded object
    const { data: urlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(storagePath);

    // Persist the public URL back to the saved_posts record
    await supabase
      .from("saved_posts")
      .update({ thumbnail_url: urlData.publicUrl })
      .eq("id", postId);
  } catch {
    // Requirement 19.4: all errors are silently swallowed
  }
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Rate Limiting (Requirements 18.1, 18.3, 18.4) ─────────────────────────
  // Extract raw JWT (unverified) just to build a stable per-user bucket key.
  // Fall back to IP for unauthenticated requests.
  const rawJwt =
    req.headers.get("Authorization")?.replace("Bearer ", "") ?? null;
  const rateLimitKey = `save-post:${rawJwt ?? req.headers.get("x-forwarded-for") ?? "unknown"}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, {
    maxRequests: 60,
    windowSeconds: 60,
  });
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.retryAfterSeconds);
  }

  // ── Step 1: Extract JWT from Authorization header ──────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Missing or malformed Authorization header" },
      401,
    );
  }
  const jwt = authHeader.replace("Bearer ", "");

  // ── Step 2: Verify JWT via Supabase Auth ───────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable automatic session persistence in Edge Function context
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !userData?.user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  // ── Step 3: Parse and validate request body ────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  // Require non-empty post_url
  const postUrl = body["post_url"];
  if (!postUrl || typeof postUrl !== "string" || postUrl.trim() === "") {
    return jsonResponse(
      { error: "post_url is required and must be a non-empty string" },
      400,
    );
  }

  // Require collection_id to be present and non-null
  if (
    !("collection_id" in body) ||
    body["collection_id"] === null ||
    body["collection_id"] === undefined
  ) {
    return jsonResponse(
      { error: "collection_id is required and must not be null" },
      400,
    );
  }

  const user = userData.user;
  const collectionId = body["collection_id"] as string;

  // ── Step 4: Verify collection ownership OR collaborator membership ──────────
  const { data: ownedCollection, error: collectionError } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (collectionError) {
    return jsonResponse(
      { error: "Failed to verify collection ownership" },
      500,
    );
  }

  let hasCollectionAccess = !!ownedCollection;

  if (!hasCollectionAccess) {
    // Also allow collaborator members to save to shared collections
    const { data: membership } = await supabase
      .from("collection_members")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("member_user_id", user.id)
      .eq("member_role", "collaborator")
      .maybeSingle();
    hasCollectionAccess = !!membership;
  }

  if (!hasCollectionAccess) {
    return jsonResponse({ error: "collection_id not accessible by user" }, 403);
  }

  // ── Step 5: Check if (user_id, post_url) already exists ───────────────────
  // Query before upserting so we can distinguish insert (201) from update (200)
  const { data: existingPost } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_url", postUrl.trim())
    .maybeSingle();

  const isExistingPost = existingPost !== null;

  // ── Step 6: Build upsert payload from validated body fields ───────────────
  const typedBody = body as SavePostBody;
  const upsertPayload = {
    post_url: typedBody.post_url.trim(),
    collection_id: collectionId,
    post_type: typedBody.post_type ?? null,
    platform: typedBody.platform ?? null,
    author_username: typedBody.author_username ?? null,
    author_display_name: typedBody.author_display_name ?? null,
    author_avatar_url: typedBody.author_avatar_url ?? null,
    content_text: typedBody.content_text ?? null,
    media_urls: typedBody.media_urls ?? null,
    post_timestamp: typedBody.post_timestamp ?? null,
    raw_metadata: typedBody.raw_metadata ?? null,
  };

  // ── Step 7: Upsert into saved_posts (Requirements 8.3, 8.4) ──────────────
  const { data: upsertedPost, error: upsertError } = await supabase
    .from("saved_posts")
    .upsert(
      {
        ...upsertPayload,
        user_id: user.id,
        saved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,post_url", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (upsertError || !upsertedPost) {
    return jsonResponse(
      { error: upsertError?.message ?? "Failed to save post" },
      500,
    );
  }

  // ── Step 8: Fire-and-forget thumbnail upload (Requirements 19.1, 19.4) ───
  // The Promise is intentionally not awaited to avoid delaying the response
  uploadThumbnail(
    supabase,
    user.id,
    upsertedPost.id,
    typedBody.media_urls ?? [],
  ).catch(() => {});

  // ── Step 9: 201 for new rows, 200 for existing rows ───────────────────────
  if (isExistingPost) {
    return jsonResponse({ id: upsertedPost.id, status: "updated" }, 200);
  } else {
    return jsonResponse({ id: upsertedPost.id, status: "created" }, 201);
  }
});
