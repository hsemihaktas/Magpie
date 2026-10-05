import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

serve(async (req: Request): Promise<Response> => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Step 1: Extract JWT from Authorization header ──────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or malformed Authorization header' }, 401)
  }
  const jwt = authHeader.replace('Bearer ', '')

  // ── Step 2: Verify JWT via Supabase Auth ───────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable automatic session persistence in Edge Function context
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: userData, error: authError } = await supabase.auth.getUser(jwt)

  if (authError || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401)
  }

  // ── Step 3: Parse and validate request body ────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON' }, 400)
  }

  // Require non-empty post_url
  const postUrl = body['post_url']
  if (!postUrl || typeof postUrl !== 'string' || postUrl.trim() === '') {
    return jsonResponse({ error: 'post_url is required and must be a non-empty string' }, 400)
  }

  // Require collection_id to be present and non-null
  if (!('collection_id' in body) || body['collection_id'] === null || body['collection_id'] === undefined) {
    return jsonResponse({ error: 'collection_id is required and must not be null' }, 400)
  }

  // ── Step 4: Placeholder — upsert logic added in task 2.2 ──────────────────
  return jsonResponse({ message: 'validated' }, 200)
})
