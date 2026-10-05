/**
 * Instagram Content Script
 *
 * Responsibilities (to be implemented in tasks 9–10):
 *  - Detect Instagram post, reel, and story card elements in the DOM
 *  - Inject a save button onto each element (idempotent via data-saver-injected attribute)
 *  - Observe DOM mutations with MutationObserver to handle SPA navigation and lazy-loaded content
 *  - Extract post metadata and route save requests through the Background Service Worker
 *
 * Requirements: 4.1–4.6, 7.1–7.13
 */

import type { PostMetadata } from "../shared/types/domain";
import { openModal, setOnSaveSuccessCallback } from "./modal";
import { showToast } from "./toast";

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that fires at most once per `ms` milliseconds
 * (trailing-edge). Subsequent calls within the window reset the timer.
 */
function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (...args: A): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

// ── DOM Selectors ──────────────────────────────────────────────────────────

/**
 * CSS selectors that identify Instagram post, reel, and story card elements.
 * Structural/semantic selectors are used here because Instagram's generated
 * class names change with every deploy.
 */
const INSTAGRAM_POST_SELECTORS: string[] = [
  'article[role="presentation"]', // Feed post / reel card
  'div[role="dialog"] article', // Post modal / lightbox
];

/**
 * Selectors scoped to the interior of a single post/reel/story card element.
 * Structural and semantic selectors are preferred over generated class names
 * since Instagram's class names change with every deploy (Requirements 7.2, 7.3).
 */
const WITHIN_POST = {
  postLink: 'a[href*="/p/"]',
  reelLink: 'a[href*="/reel/"]',
  storyLink: 'a[href*="/stories/"]',
  authorLink: 'header a[href^="/"][href$="/"]',
  authorAvatar: "header img",
  authorDisplay: "header span:not([aria-label])",
  timestamp: "time[datetime]",
  caption: 'ul li span, div[class*="_a9zs"] span, div[class*="caption"] span',
  mediaImages: 'div[role="button"] img, div[class*="_aagv"] img',
  mediaVideos: "video source",
  actionBar:
    'section[class*="_ae2s"], section[class*="coreSpriteDesktopNavProfile"], div[role="group"]',
} as const;

/**
 * Detects whether a post card element represents a reel, story, or regular post
 * by checking for the most specific anchor link patterns first (Requirement 4.6).
 */
function detectInstagramPostType(el: Element): "post" | "reel" | "story" {
  if (el.querySelector(WITHIN_POST.reelLink)) return "reel";
  if (el.querySelector(WITHIN_POST.storyLink)) return "story";
  if (el.querySelector(WITHIN_POST.postLink)) return "post";
  return "post"; // Default fallback (Requirement 4.6)
}

// ── Metadata Extraction ────────────────────────────────────────────────────

/**
 * Extracts post metadata from a post card element using the `WITHIN_POST`
 * selector map. Returns `null` if a post URL cannot be located, which signals
 * the caller to abort the save (Requirement 7.13).
 *
 * All fields other than `post_url` are set to their zero/null value when the
 * corresponding DOM element is absent — this function never throws
 * (Requirement 7.12).
 *
 * Requirements: 7.1–7.13
 */
function extractInstagramMetadata(el: Element): Partial<PostMetadata> | null {
  // 1. Locate post URL — abort if missing (Requirement 7.13)
  const postLinkEl =
    el.querySelector<HTMLAnchorElement>(WITHIN_POST.postLink) ??
    el.querySelector<HTMLAnchorElement>(WITHIN_POST.reelLink) ??
    el.querySelector<HTMLAnchorElement>(WITHIN_POST.storyLink);

  if (!postLinkEl?.href) return null; // Requirement 7.13: abort save

  const post_url = new URL(postLinkEl.href, window.location.origin).href;

  // 2. Extract author username from link path
  const authorLinkEl = el.querySelector<HTMLAnchorElement>(
    WITHIN_POST.authorLink,
  );
  const author_username = authorLinkEl
    ? authorLinkEl.pathname.replace(/\//g, "") || null
    : null;

  // 3. Avatar URL (exclude from media_urls)
  const avatarEl = el.querySelector<HTMLImageElement>(WITHIN_POST.authorAvatar);
  const author_avatar_url = avatarEl?.src ?? null;

  // 4. Display name
  const displayEl = el.querySelector(WITHIN_POST.authorDisplay);
  const author_display_name = displayEl?.textContent?.trim() ?? null;

  // 5. Caption/content text
  const captionEl = el.querySelector(WITHIN_POST.caption);
  const content_text = captionEl?.textContent?.trim() ?? null;

  // 6. Timestamp
  const timeEl = el.querySelector<HTMLTimeElement>(WITHIN_POST.timestamp);
  const post_timestamp = timeEl?.getAttribute("datetime") ?? null;

  // 7. Media URLs (exclude avatar)
  const imageEls = Array.from(
    el.querySelectorAll<HTMLImageElement>(WITHIN_POST.mediaImages),
  );
  const videoEls = Array.from(
    el.querySelectorAll<HTMLSourceElement>(WITHIN_POST.mediaVideos),
  );
  const media_urls = [
    ...imageEls
      .map((i) => i.src)
      .filter((src) => src && src !== author_avatar_url),
    ...videoEls.map((v) => v.src).filter((src) => !!src),
  ];

  return {
    post_url,
    post_type: detectInstagramPostType(el),
    platform: "instagram",
    author_username,
    author_display_name,
    author_avatar_url,
    content_text,
    media_urls,
    post_timestamp,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
    },
  };
}

// ── Button Injection ───────────────────────────────────────────────────────

/**
 * Opens the Collection Picker Modal for the post element that was clicked.
 *
 * Extracts metadata first — if the post URL cannot be resolved the save is
 * aborted and an inline error toast is shown instead (Requirement 7.13).
 *
 * Before opening the modal, a one-shot callback is registered via
 * `setOnSaveSuccessCallback`. The modal's `performSave` invokes this callback
 * (with the resolved `collection_id`) after a successful save. The callback
 * shows the platform-specific confirmation toast here, in the content script,
 * keeping the modal decoupled from platform UI (Requirements 11.1–11.5, 11.7).
 *
 * @param postEl    The post card element whose save button was clicked.
 * @param isUpdate  Pass `true` when re-opening after a "Change collection"
 *                  click so the toast reads "Collection updated ✓" instead of
 *                  "Saved to Magpie ✓" (Requirement 11.7).
 *
 * Requirements: 6.1, 7.12, 7.13, 11.4, 11.5, 11.7, 11.8
 */
function openCollectionPicker(
  postEl: Element,
  isUpdate: boolean = false,
): void {
  const metadata = extractInstagramMetadata(postEl);

  if (!metadata) {
    // Requirement 7.13: abort save and surface an error to the user
    console.error(
      "[Magpie] Could not determine post URL. Try navigating directly to the post page.",
    );
    showToast({
      message:
        "Could not determine the post URL. Try navigating directly to the post page.",
      platform: "instagram",
    });
    return;
  }

  // Register a one-shot callback so the modal notifies us on successful save.
  // Each call overwrites the previous registration — only one modal is open at
  // a time so this is safe.
  setOnSaveSuccessCallback(() => {
    // Requirement 11.7: first saves say "Saved to Magpie ✓"; re-saves after
    // "Change collection" say "Collection updated ✓".
    showToast({
      message: isUpdate
        ? "Collection updated \u2713"
        : "Saved to Magpie \u2713",
      platform: "instagram",
      // Requirements 11.4, 11.5: "Change collection" button re-opens the
      // modal for the exact same post, flagged as an update so the next
      // successful save shows the "Collection updated ✓" message.
      onChangeCollection: () => openCollectionPicker(postEl, true),
    });
  });

  // Requirement 6.1: delegate to the modal which owns the full picker flow
  openModal(metadata);
}

/**
 * Injects a Magpie save button into the action bar of a post element.
 * Idempotent: skips immediately if a button is already present (Requirement 4.5).
 * The button uses an archive-box SVG icon that is visually distinct from any
 * native Instagram control (Requirement 4.4).
 *
 * Requirements: 4.4, 4.5
 */
function injectSaveButton(postEl: Element): void {
  if (postEl.querySelector('[data-saver-injected="true"]')) return; // Req 4.5

  // Try multiple selectors for the action bar
  const actionBar = postEl.querySelector<HTMLElement>(WITHIN_POST.actionBar);
  if (!actionBar) return; // Skip if no action bar found

  const btn = document.createElement("button");
  btn.setAttribute("data-saver-injected", "true"); // Sentinel (Req 4.5)
  btn.setAttribute("aria-label", "Save to Magpie archive");
  btn.setAttribute("type", "button");
  btn.className = "magpie-save-btn";
  // Archive box SVG icon — distinct from any Instagram native icon (Req 4.4)
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z"/></svg>`;
  btn.style.cssText =
    "background:none;border:none;cursor:pointer;padding:4px;display:inline-flex;align-items:center;opacity:0.7;color:#262626;";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    openCollectionPicker(postEl);
  });

  actionBar.appendChild(btn);
}

// ── DOM Scanning ───────────────────────────────────────────────────────────

/**
 * Queries `root` for all elements matching `INSTAGRAM_POST_SELECTORS` and
 * calls `injectSaveButton` on each. Also checks whether `root` itself matches
 * a selector so newly-added top-level post nodes are not missed.
 *
 * Requirements: 4.1, 4.2
 */
function scanAndInject(root: Element): void {
  // Check root itself first (handles case where the added node IS a post element)
  for (const sel of INSTAGRAM_POST_SELECTORS) {
    if (root.matches(sel)) {
      injectSaveButton(root);
      break;
    }
  }

  // Then scan all matching descendants
  const combinedSelector = INSTAGRAM_POST_SELECTORS.join(",");
  root.querySelectorAll(combinedSelector).forEach((el) => injectSaveButton(el));
}

// ── MutationObserver ───────────────────────────────────────────────────────

const DEBOUNCE_MS = 100;

/**
 * Debounced MutationObserver callback.
 *
 * Two-pass strategy on every mutation batch:
 *  1. Scan `addedNodes` from each record for newly inserted post elements.
 *  2. Re-check every document-level selector match so buttons stripped by
 *     Instagram's SPA reconciliation (virtual DOM diffing) are immediately
 *     re-injected (Requirement 4.3).
 *
 * The entire body is wrapped in try/catch so a single runtime error cannot
 * halt mutation handling for subsequent DOM changes.
 *
 * Requirements: 4.1, 4.2, 4.3
 */
const observer = new MutationObserver(
  debounce((mutations: MutationRecord[]) => {
    try {
      // Pass 1: inject into newly added nodes
      for (const mutation of mutations) {
        Array.from(mutation.addedNodes).forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          scanAndInject(node as Element);
        });
      }

      // Pass 2: re-inject on any post element whose button was stripped by a
      // SPA re-render (Instagram may remove and re-add article elements during
      // client-side route transitions without triggering a full page load)
      const combinedSelector = INSTAGRAM_POST_SELECTORS.join(",");
      document.querySelectorAll(combinedSelector).forEach((el) => {
        if (!el.querySelector('[data-saver-injected="true"]')) {
          injectSaveButton(el);
        }
      });
    } catch (err) {
      // Swallow errors so future mutations are still handled
      console.error("[Saver] MutationObserver callback error:", err);
    }
  }, DEBOUNCE_MS),
);

observer.observe(document.body, { childList: true, subtree: true });

// ── Initial Scan ───────────────────────────────────────────────────────────

// Inject buttons on any post elements already in the DOM when the
// content script first loads (Requirement 4.1)
scanAndInject(document.body);
