import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VALID_OPERATIONS = ["list", "create", "rename", "delete"] as const;
type Operation = (typeof VALID_OPERATIONS)[number];

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Validates that a collection name is 1–255 characters and contains at least
 * one non-whitespace character, as required by Requirements 9.4 and 9.9.
 */
function isValidName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 255;
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Step 1: Extract JWT from Authorization header ──────────────────────────
  // Requirement 9.2: verify JWT before performing any operation
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
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !userData?.user) {
    // Requirement 9.7: missing/invalid/expired JWT → HTTP 401
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  const userId = userData.user.id;

  // ── Step 3: Parse request body ─────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  const {
    operation,
    collection_id: _collection_id,
    name,
  } = body as {
    operation?: unknown;
    collection_id?: unknown;
    name?: unknown;
  };
  // _collection_id is parsed here but used in task 3.2 (rename / delete)

  // ── Step 4: Validate operation ─────────────────────────────────────────────
  // Requirement 9.11: operation not in [list, create, rename, delete] → HTTP 400
  if (!operation || !VALID_OPERATIONS.includes(operation as Operation)) {
    return jsonResponse(
      { error: `operation must be one of: ${VALID_OPERATIONS.join(", ")}` },
      400,
    );
  }

  const op = operation as Operation;

  // ── Step 5: Dispatch to operation handlers ─────────────────────────────────

  // ── list ──────────────────────────────────────────────────────────────────
  if (op === "list") {
    // Requirement 9.3: return all collections for the authenticated user,
    // ordered by created_at ASC
    const { data: collections, error: listError } = await supabase
      .from("collections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (listError) {
      return jsonResponse({ error: "Failed to fetch collections" }, 500);
    }

    return jsonResponse({ collections }, 200);
  }

  // ── create ─────────────────────────────────────────────────────────────────
  if (op === "create") {
    // Requirement 9.9: missing or invalid name → HTTP 400
    if (!isValidName(name)) {
      return jsonResponse(
        { error: "name must be 1-255 non-empty characters" },
        400,
      );
    }

    // Requirement 9.4: INSERT new collection with user_id from JWT
    const { data: collection, error: insertError } = await supabase
      .from("collections")
      .insert({ user_id: userId, name: (name as string).trim() })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: "Failed to create collection" }, 500);
    }

    return jsonResponse({ collection }, 201);
  }

  // ── rename — placeholder until task 3.2 ──────────────────────────────────
  if (op === "rename") {
    return jsonResponse({ message: "not implemented" }, 200);
  }

  // ── delete — placeholder until task 3.2 ──────────────────────────────────
  if (op === "delete") {
    return jsonResponse({ message: "not implemented" }, 200);
  }

  // Unreachable, but satisfies TypeScript exhaustiveness
  return jsonResponse({ error: "Unexpected error" }, 500);
});
