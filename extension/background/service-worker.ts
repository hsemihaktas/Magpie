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

import type { StoredSession } from "../shared/types/domain";

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
