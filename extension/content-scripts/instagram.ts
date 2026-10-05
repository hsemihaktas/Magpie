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

// ── Button Injection ───────────────────────────────────────────────────────

/**
 * Injects a save button onto the given post element.
 * Skips the element immediately if a button has already been injected,
 * keeping the operation idempotent (Requirement 4.5).
 *
 * Stub — full implementation in task 9.3.
 *
 * Requirements: 4.1, 4.5
 */
function injectSaveButton(el: Element): void {
  if (el.querySelector('[data-saver-injected="true"]')) return;
  // stub - implementation in task 9.3
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
