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

// ── Button Injection ───────────────────────────────────────────────────────

/**
 * Stub — will be wired to metadata extraction and the Collection Picker Modal
 * in task 10.2.
 */
function openCollectionPicker(postEl: Element): void {
  console.log("[Magpie] Save button clicked on:", postEl);
  // Full implementation in task 10.2
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
