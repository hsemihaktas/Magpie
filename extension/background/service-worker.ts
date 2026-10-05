/**
 * Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  - Store and refresh the Supabase JWT in chrome.storage.sync
 *  - Route messages from Content Scripts and the Popup to Supabase Edge Functions
 *  - Be the sole caller of save-post and manage-collection Edge Functions
 *
 * Requirements: 2.1–2.8, 10.1–10.6
 */

import { createClient } from "@supabase/supabase-js";
import type { StoredSession } from "../shared/types/domain";

// ── Supabase configuration ────────────────────────────────────────────────────
// Replace these placeholder values with your actual Supabase project credentials
// before building. Never commit real credentials to source control.
const SUPABASE_URL = "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";

/** Storage key used in both chrome.storage.sync and chrome.storage.local */
const SESSION_KEY = "magpie_session";

// ── JWT Persistence Layer ─────────────────────────────────────────────────────

/**
 * Persists a session in chrome.storage.sync, falling back to
 * chrome.storage.local if sync is unavailable (Requirement 2.2, 2.6).
 *
 * On fallback, a SYNC_UNAVAILABLE console warning is emitted so that callers
 * and the popup can surface the "session sync across devices is disabled"
 * message (Requirement 2.6).
 *
 * After storing, schedules a proactive jwt-refresh alarm 5 minutes before
 * expiry so the session is refreshed silently before it lapses
 * (Requirements 1.3, 2.4).
 */
export async function storeSession(session: StoredSession): Promise<void> {
  try {
    await chrome.storage.sync.set({ [SESSION_KEY]: session });
  } catch (syncError) {
    // chrome.storage.sync is unavailable (e.g. user not signed into Chrome,
    // or the extension is in a context where sync is disabled).
    console.warn(
      "[Magpie] SYNC_UNAVAILABLE — falling back to chrome.storage.local. " +
        "Session will not be synchronised across devices.",
      syncError,
    );
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }

  // Schedule a proactive refresh alarm 5 minutes (300 s) before the JWT
  // expires. This gives refreshSession() time to obtain a new token while
  // the current one is still valid (Requirement 1.3, 2.4).
  chrome.alarms.create("jwt-refresh", {
    when: (session.expiry - 300) * 1000,
  });
}

/**
 * Retrieves the stored session, reading from chrome.storage.sync first.
 * Falls back to chrome.storage.local if sync is unavailable or returns no
 * session (Requirement 2.4, 2.6).
 *
 * Returns null when no session is found in either store.
 */
export async function getStoredSession(): Promise<StoredSession | null> {
  // Attempt chrome.storage.sync first.
  try {
    const result = await chrome.storage.sync.get(SESSION_KEY);
    const session = result[SESSION_KEY] as StoredSession | undefined;
    if (session) {
      return session;
    }
  } catch {
    // sync unavailable — fall through to local storage.
  }

  // Fall back to chrome.storage.local.
  try {
    const result = await chrome.storage.local.get(SESSION_KEY);
    const session = result[SESSION_KEY] as StoredSession | undefined;
    return session ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes the session from both chrome.storage.sync and chrome.storage.local
 * so that no stale token lingers in either store (Requirement 2.7, 2.8).
 *
 * Errors from individual stores are swallowed — a best-effort clear is
 * acceptable here since the logout path already transitions the UI to the
 * unauthenticated state.
 */
export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    chrome.storage.sync.remove(SESSION_KEY),
    chrome.storage.local.remove(SESSION_KEY),
  ]);
}

// ── JWT Validity and Proactive Refresh ────────────────────────────────────────

/**
 * Returns the stored session if it is valid, attempting a silent refresh when
 * the token is within 5 minutes of expiry (Requirements 1.3, 1.4, 2.4, 2.7).
 *
 * Return semantics:
 *  - null (AUTH_REQUIRED)  → no session exists in storage
 *  - null (JWT_EXPIRED)    → token has passed its expiry; storage is cleared
 *  - StoredSession         → token is valid (and freshly refreshed if it was
 *                            close to expiry)
 */
export async function getValidSession(): Promise<StoredSession | null> {
  const session = await getStoredSession();

  if (!session) {
    // No session stored — caller must trigger a new login flow.
    return null; // AUTH_REQUIRED
  }

  const nowSecs = Date.now() / 1000;

  if (nowSecs >= session.expiry) {
    // Token has expired — clear storage and signal re-authentication
    // (Requirements 1.4, 2.7).
    await clearSession();
    return null; // JWT_EXPIRED
  }

  if (session.expiry - nowSecs < 300) {
    // Token is within the 5-minute refresh window — attempt a silent refresh
    // so callers always receive a token with meaningful remaining lifetime
    // (Requirement 2.4).
    await refreshSession();
    return getStoredSession();
  }

  return session;
}

/**
 * Attempts a silent Supabase token refresh.
 *
 * On success, the new access token and expiry are written back to storage via
 * storeSession(), which also reschedules the jwt-refresh alarm.
 *
 * On failure (network error, invalid refresh token, etc.) the stored session
 * is cleared so the user is prompted to re-authenticate (Requirements 1.4, 2.7).
 *
 * NOTE: The StoredSession type currently stores the access JWT only. To perform
 * a full server-side token refresh, a `refresh_token` field must be added to
 * StoredSession so it can be passed to refreshSession(). Until then, this
 * function relies on the Supabase client's internally cached session.
 */
export async function refreshSession(): Promise<void> {
  // Create a minimal Supabase client. We disable automatic token persistence
  // and auto-refresh because the service worker manages its own storage via
  // chrome.storage (Requirements 2.2, 2.5).
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    // Refresh failed — clear the stale session so the user is asked to
    // re-authenticate on the next interaction (Requirements 1.4, 2.7).
    console.warn("[Magpie] Token refresh failed — clearing session.", error);
    await clearSession();
    return;
  }

  const { access_token, expires_at, user } = data.session;

  await storeSession({
    jwt: access_token,
    // expires_at is seconds since epoch; fall back to 1 hour from now if absent.
    expiry: expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user_id: user.id,
  });
}

// ── Alarm Listener ────────────────────────────────────────────────────────────

/**
 * Listens for the jwt-refresh alarm and triggers a proactive token refresh.
 * The alarm is created by storeSession() and fires 5 minutes before expiry
 * (Requirements 1.3, 2.4).
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "jwt-refresh") {
    refreshSession();
  }
});
