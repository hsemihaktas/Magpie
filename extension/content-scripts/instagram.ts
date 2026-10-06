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
  // Feed posts — any visible article with content
  'article',
  // Post/Reel modal opened from feed
  'div[role="dialog"] article',
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
  // Caption: multiple fallback patterns for feed posts, modals, and Reels
  caption: [
    'div[class*="_a9zs"] span',        // Feed post caption wrapper
    'span[class*="_aacl"]',             // Another caption variant
    'div[class*="caption"] span',       // Caption div
    'ul li > span',                     // Caption in comment list
    'div[data-testid="post-comment-root"] span', // Post detail caption
    'h1 + span',                        // Reel title area
    'h1',                               // Reel h1 title (some reels)
  ].join(", "),
  // Media images: fbcdn.net is Instagram/Meta's CDN (covers both feed posts and Reels)
  mediaImages: 'div[role="button"] img, div[class*="_aagv"] img, img[src*="fbcdn.net"]',
  mediaVideos: "video source",
  videoPoster: "video[poster]",  // Reel thumbnail via poster attribute
  // Instagram uses div[role="button"] (not <button> elements!)
  likeSvg: 'svg[aria-label="Beğen"], svg[aria-label="Like"], svg[aria-label="Beğeniyi geri al"], svg[aria-label="Unlike"]',
  shareSvg: 'svg[aria-label="Paylaş"], svg[aria-label="Share"]',
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

  // Clean the post URL: remove sub-paths like /liked_by/, /comments/, etc.
  // Instagram sometimes wraps the like count as an anchor to /liked_by/
  const rawUrl = new URL(postLinkEl.href, window.location.origin);
  // Keep only the canonical post path: /p/{id}/ or /reel/{id}/
  const pathParts = rawUrl.pathname.split("/").filter(Boolean);
  const typeIdx = pathParts.findIndex((p) => p === "p" || p === "reel" || p === "stories");
  const cleanPath = typeIdx >= 0 ? "/" + pathParts.slice(typeIdx, typeIdx + 2).join("/") + "/" : rawUrl.pathname;
  const post_url = rawUrl.origin + cleanPath;

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
  // Also capture video poster attribute (Reel thumbnails)
  const videoPosterEls = Array.from(
    el.querySelectorAll<HTMLVideoElement>(WITHIN_POST.videoPoster),
  );
  const media_urls = [
    ...imageEls
      .map((i) => i.src)
      .filter((src) => src && src !== author_avatar_url && src.includes("http")),
    ...videoEls.map((v) => v.src).filter((src) => !!src),
    ...videoPosterEls.map((v) => v.poster).filter((src) => !!src && src !== author_avatar_url),
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
 * Saves a post directly to a known collection via the Background Service Worker.
 * Used when a default collection is already stored — bypasses the modal entirely.
 * On success, shows a toast with a "Change collection" button.
 */
async function saveToDefaultCollection(
  metadata: Partial<PostMetadata>,
  defaultCol: { id: string; name: string },
  postEl: Element,
): Promise<void> {
  if (!metadata.post_url) return;
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "SAVE_POST",
      payload: {
        post_url: metadata.post_url,
        collection_id: defaultCol.id,
        post_type: metadata.post_type ?? "post",
        platform: metadata.platform ?? "instagram",
        author_username: metadata.author_username ?? null,
        author_display_name: metadata.author_display_name ?? null,
        author_avatar_url: metadata.author_avatar_url ?? null,
        content_text: metadata.content_text ?? null,
        media_urls: metadata.media_urls ?? null,
        post_timestamp: metadata.post_timestamp ?? null,
        raw_metadata: metadata.raw_metadata ?? null,
      },
    })) as { success: boolean; error?: string };

    if (response.success) {
      showToast({
        message: `Saved to ${defaultCol.name} \u2713`,
        platform: "instagram",
        onChangeCollection: () => void openCollectionPicker(postEl, true),
      });
    } else {
      // Collection may have been deleted — clear the default so next click opens the modal
      await chrome.storage.local.remove("magpie_default_collection").catch(() => {});
      showToast({
        message: "Save failed — please pick a collection.",
        platform: "instagram",
      });
    }
  } catch {
    showToast({ message: "Save failed. Please try again.", platform: "instagram" });
  }
}

/**
 * Entry point for the save button click.
 *
 * Two paths:
 *  1. Default collection exists & isUpdate=false → save directly without modal,
 *     then show toast with "Change collection" button.
 *  2. No default yet, or isUpdate=true (user clicked "Change") → open the modal.
 *     After a successful modal save, the chosen collection is stored as the new
 *     default (so the next click skips the modal).
 *     The save-post Edge Function upserts on (user_id, post_url), so re-saving
 *     with a different collection_id effectively moves the post.
 *
 * Requirements: 6.1, 7.12, 7.13, 11.4, 11.5, 11.7, 11.8
 */
async function openCollectionPicker(
  postEl: Element,
  isUpdate: boolean = false,
): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    console.warn("[Magpie] Extension context invalidated. Refresh the page.");
    return;
  }

  const metadata = extractInstagramMetadata(postEl);
  if (!metadata) {
    console.error("[Magpie] Could not determine post URL. Try navigating directly to the post page.");
    showToast({
      message: "Could not determine the post URL. Try navigating directly to the post page.",
      platform: "instagram",
    });
    return;
  }

  // ── Direct save path: use stored default collection ─────────────────────
  if (!isUpdate) {
    try {
      const stored = await chrome.storage.local.get("magpie_default_collection");
      const defaultCol = stored["magpie_default_collection"] as
        | { id: string; name: string }
        | undefined;
      if (defaultCol?.id) {
        await saveToDefaultCollection(metadata, defaultCol, postEl);
        return;
      }
    } catch {
      // Storage read failed — fall through to modal
    }
  }

  // ── Modal path: first time, or user clicked "Change" ────────────────────
  // After a successful save, store the chosen collection as the new default
  // so the next save button click skips the modal.
  setOnSaveSuccessCallback((collectionId: string, collectionName: string | null) => {
    chrome.storage.local
      .set({ magpie_default_collection: { id: collectionId, name: collectionName ?? "Magpie" } })
      .catch(() => {});

    showToast({
      message: isUpdate
        ? "Collection updated \u2713"
        : `Saved to ${collectionName ?? "Magpie"} \u2713`,
      platform: "instagram",
      onChangeCollection: () => void openCollectionPicker(postEl, true),
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

  // Skip hidden articles (Instagram pre-renders hidden articles)
  const style = window.getComputedStyle(postEl);
  if (style.display === 'none' || (postEl as HTMLElement).offsetHeight === 0) return;

  // Find the Like SVG icon — Instagram uses svg[aria-label="Beğen"/"Like"]
  const likeSvg = postEl.querySelector(WITHIN_POST.likeSvg);
  if (!likeSvg) return;

  // Find the Bookmark/Save SVG too — action bar contains both
  const bookmarkSvg = postEl.querySelector('svg[aria-label="Kaydet"], svg[aria-label="Save"], svg[aria-label="Remove"], svg[aria-label="Kaldır"]');

  // Find the common ancestor of Like and Bookmark = the full action bar row
  let actionBar: HTMLElement | null = null;
  if (bookmarkSvg) {
    let el: Element | null = likeSvg;
    while (el && el !== postEl) {
      el = el.parentElement;
      if (el && el.contains(bookmarkSvg)) {
        actionBar = el as HTMLElement;
        break;
      }
    }
  }
  // Fallback: parent of like button's parent
  if (!actionBar) {
    actionBar = (likeSvg.closest('button')?.parentElement?.parentElement ?? 
                 likeSvg.closest('button')?.parentElement) as HTMLElement | null;
  }
  if (!actionBar) return;

  // Inject our button just before the Bookmark button (or at end)
  const btn = document.createElement("button");
  btn.setAttribute("data-saver-injected", "true");
  btn.setAttribute("aria-label", "Save to Magpie");
  btn.setAttribute("type", "button");
  // Match Instagram's button style exactly
  btn.style.cssText = [
    "background:none",
    "border:none",
    "cursor:pointer",
    "padding:8px",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "color:var(--ig-primary-text,#262626)",
    "opacity:0.85",
    "transition:opacity .2s",
    "vertical-align:middle",
    "flex-shrink:0",
    "line-height:0",
  ].join(";");
  btn.addEventListener("mouseenter", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    btn.style.opacity = "1";
  });
  btn.addEventListener("mouseover", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.85"; });
  // Archive-box SVG at same size as Instagram icons (24px)
  // Archive box icon (original Magpie icon)
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z"/></svg>';

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void openCollectionPicker(postEl);
  });

  // Instagram structure (discovered via DOM inspection):
  // SVG[Paylaş] → DIV[role="button"] (share btn) → DIV wrapper → SECTION (action bar)
  //
  // We insert our button after the share wrapper (level 1 parent of share btn)
  // so it appears as a sibling in the action bar flex row
  const shareSvg = postEl.querySelector(WITHIN_POST.shareSvg);
  const shareRoleBtn = shareSvg?.closest('[role="button"]');  // div[role="button"]
  const shareWrapper = shareRoleBtn?.parentElement;  // the wrapper div

  // Determine insertion strategy based on page context
  const isReelsPage = window.location.pathname.startsWith("/reels/");

  if (isReelsPage) {
    // On Reels page: vertical action bar — insert AFTER bookmark wrapper for clean placement
    const bookmarkWrapper = bookmarkSvg?.closest('[role="button"]')?.parentElement;
    if (bookmarkWrapper && bookmarkWrapper.parentElement) {
      // Style adjustment for vertical dark Reels bar
      btn.style.cssText = [
        "background:none",
        "border:none",
        "cursor:pointer",
        "padding:6px 8px",
        "margin-top:12px",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "color:white",
        "opacity:0.9",
        "transition:opacity .2s",
        "width:100%",
        "box-sizing:border-box",
      ].join(";");
      bookmarkWrapper.insertAdjacentElement("afterend", btn);
    } else {
      actionBar.appendChild(btn);
    }
  } else if (shareWrapper) {
    // Feed: insert INSIDE share wrapper (preserves 4-item flex layout)
    shareWrapper.appendChild(btn);
  } else {
    actionBar.appendChild(btn);
  }
}

// ── DOM Scanning ───────────────────────────────────────────────────────────

/**
 * Scans for any Like SVGs on the page and injects the save button into
 * their parent post element — works for feed, post detail, and Reels pages
 * where the article selector might not match.
 */
function scanLikeSvgsDirectly(root: Element | Document): void {
  const likeSvgs = root.querySelectorAll(WITHIN_POST.likeSvg);
  likeSvgs.forEach((svg) => {
    // Walk up to find the closest article, section, or meaningful container
    let container: Element | null = svg;
    for (let i = 0; i < 15 && container && container !== document.body; i++) {
      container = container.parentElement;
      // Stop at article, dialog, or a section/div that has significant height
      if (!container) break;
      if (
        container.tagName === "ARTICLE" ||
        (container.tagName === "SECTION" && (container as HTMLElement).offsetHeight > 100) ||
        (container.getAttribute("role") === "dialog")
      ) {
        break;
      }
    }
    if (container && container !== document.body) {
      injectSaveButton(container);
    }
  });
}

/**
 * Queries `root` for all elements matching `INSTAGRAM_POST_SELECTORS` and
 * calls `injectSaveButton` on each. Also does a direct Like SVG scan as fallback.
 *
 * Requirements: 4.1, 4.2
 */
function scanAndInject(root: Element): void {
  // Primary: scan for article elements
  for (const sel of INSTAGRAM_POST_SELECTORS) {
    if (root.matches(sel)) {
      injectSaveButton(root);
      break;
    }
  }
  const combinedSelector = INSTAGRAM_POST_SELECTORS.join(",");
  root.querySelectorAll(combinedSelector).forEach((el) => injectSaveButton(el));

  // Fallback: find Like SVGs directly (works for /p/ detail and /reels/ feed)
  scanLikeSvgsDirectly(root);
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
