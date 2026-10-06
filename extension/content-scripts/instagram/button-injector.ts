/**
 * button-injector.ts
 * Medya container'larına "Kaydet" butonu ekler.
 * Tıklamada: yeni extraction modülleri ile metadata çıkarır,
 * mevcut BSW + modal + toast akışıyla Supabase'e kaydeder.
 */

import type { ButtonState, SourceContext } from "./types";
import { findAllMediaRoots, findMediaRoot } from "./media-root";
import { findNormalizedLinkInRoot } from "./permalink";
import { extractMetadata } from "./metadata-extractor";
import { fillMissingFields } from "./page-fallback";
import { detectSourceContext } from "./route-listener";
import type { PostMetadata } from "../../shared/types/domain";
import { openModal, setOnSaveSuccessCallback } from "../modal";
import { showToast } from "../toast";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const BUTTON_ATTR = "data-magpie-save-button";
const BUTTON_SELECTOR = `[${BUTTON_ATTR}]`;
const DEFAULT_COL_KEY = "magpie_default_collection";

const ACTION_BAR_SELECTORS: ReadonlyArray<string> = [
  "section",
  "[role='group']",
];

// ---------------------------------------------------------------------------
// Buton oluşturma
// ---------------------------------------------------------------------------

function getButtonIcon(state: ButtonState): string {
  if (state === "loading") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" opacity=".25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-width="2.5">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".75s" repeatCount="indefinite"/>
      </path></svg>`;
  }
  // idle / saved / error / duplicate → archive-box icon
  const opacity = state === "saved" || state === "duplicate" ? "" : "";
  const color = state === "duplicate" ? "color:#0095f6;" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" style="${color}"><path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z" ${state === "saved" || state === "duplicate" ? 'opacity=".5"' : ''}/></svg>`;
}

function setButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

function createSaveButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.setAttribute("aria-label", "Save to Magpie");
  btn.setAttribute("type", "button");
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
  btn.innerHTML = getButtonIcon("idle");
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
  return btn;
}

// ---------------------------------------------------------------------------
// Injection konumu
// ---------------------------------------------------------------------------

function injectButtonIntoRoot(btn: HTMLButtonElement, root: Element): void {
  if (root.querySelector(BUTTON_SELECTOR)) return;

  // Action bar araması
  for (const sel of ACTION_BAR_SELECTORS) {
    try {
      const bar = root.querySelector(sel);
      if (bar?.parentElement) {
        bar.parentElement.appendChild(btn);
        return;
      }
    } catch { /* geçersiz selector */ }
  }

  // Fallback
  root.appendChild(btn);
}

// ---------------------------------------------------------------------------
// Metadata → PostMetadata dönüşümü
// ---------------------------------------------------------------------------

function buildPostMetadata(
  canonicalUrl: string,
  extracted: ReturnType<typeof extractMetadata>,
  root: Element,
): Partial<PostMetadata> {
  // media_urls: ilk olarak thumbnailUrl, sonra mediaUrl
  const media_urls: string[] = [];
  if (extracted.thumbnailUrl) media_urls.push(extracted.thumbnailUrl);
  if (extracted.mediaUrl && extracted.mediaUrl !== extracted.thumbnailUrl) {
    media_urls.push(extracted.mediaUrl);
  }

  // post_type
  const path = new URL(canonicalUrl).pathname;
  const postType: PostMetadata["post_type"] =
    path.includes("/reel/") ? "reel" :
    path.includes("/tv/") ? "reel" :
    "post";

  return {
    post_url: canonicalUrl,
    post_type: postType,
    platform: "instagram",
    author_username: extracted.authorUsername ?? null,
    author_display_name: null, // display name ayrıca gerekirse eklenebilir
    author_avatar_url: null,
    content_text: extracted.caption ?? null,
    media_urls,
    post_timestamp: extracted.publishedAt ?? null,
    raw_metadata: { page_url: window.location.href, extracted_at: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Default collection akışı (mevcut instagram.ts'ten adapte edilmiş)
// ---------------------------------------------------------------------------

interface DefaultCollection { id: string; name: string; }

async function getDefaultCollection(): Promise<DefaultCollection | undefined> {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_COL_KEY);
    return stored[DEFAULT_COL_KEY] as DefaultCollection | undefined;
  } catch { return undefined; }
}

async function resolveDefaultFromServer(): Promise<DefaultCollection | undefined> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) { resolve(undefined); return; }
    chrome.runtime.sendMessage(
      { type: "GET_COLLECTIONS" },
      (response: { success: boolean; data?: unknown }) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve(undefined); return;
        }
        const d = response.data as { collections?: Array<{ id: string; name: string; is_default?: boolean }> };
        const cols = Array.isArray(d?.collections) ? d.collections : [];
        if (cols.length === 0) { resolve(undefined); return; }
        const chosen = cols.find((c) => c.is_default) ?? cols[0];
        chrome.storage.local
          .set({ [DEFAULT_COL_KEY]: { id: chosen.id, name: chosen.name } })
          .catch(() => {});
        resolve({ id: chosen.id, name: chosen.name });
      },
    );
  });
}

async function saveDirectToCollection(
  metadata: Partial<PostMetadata>,
  col: DefaultCollection,
  postEl: Element,
): Promise<void> {
  if (!metadata.post_url) return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_POST",
      payload: {
        post_url: metadata.post_url,
        collection_id: col.id,
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
    }) as { success: boolean; error?: string };

    if (response.success) {
      showToast({
        message: `Saved to ${col.name} \u2713`,
        platform: "instagram",
        onChangeCollection: () => void openCollectionPickerFlow(postEl, metadata, true),
      });
    } else {
      await chrome.storage.local.remove(DEFAULT_COL_KEY).catch(() => {});
      showToast({ message: "Kaydetme başarısız — koleksiyon seçin.", platform: "instagram" });
    }
  } catch {
    showToast({ message: "Kaydetme başarısız. Tekrar deneyin.", platform: "instagram" });
  }
}

async function openCollectionPickerFlow(
  postEl: Element,
  metadata: Partial<PostMetadata>,
  isUpdate = false,
): Promise<void> {
  setOnSaveSuccessCallback((collectionId: string, collectionName: string | null) => {
    chrome.storage.local
      .set({ [DEFAULT_COL_KEY]: { id: collectionId, name: collectionName ?? "Magpie" } })
      .catch(() => {});
    chrome.runtime.sendMessage({
      type: "SET_DEFAULT_COLLECTION",
      payload: { collection_id: collectionId },
    }).catch(() => {});
    showToast({
      message: isUpdate
        ? "Collection updated \u2713"
        : `Saved to ${collectionName ?? "Magpie"} \u2713`,
      platform: "instagram",
      onChangeCollection: () => void openCollectionPickerFlow(postEl, metadata, true),
    });
  });
  openModal(metadata);
}

// ---------------------------------------------------------------------------
// Ana tıklama handler
// ---------------------------------------------------------------------------

async function handleSaveClick(
  btn: HTMLButtonElement,
  event: MouseEvent,
): Promise<void> {
  event.stopPropagation();
  event.preventDefault();

  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    showToast({ message: "Magpie yenilenmesi gerekiyor — F5 basın.", platform: "instagram" });
    setButtonState(btn, "error");
    return;
  }

  // 1. Container bul
  const root = findMediaRoot(btn);
  if (!root) {
    console.warn("[Magpie] Medya container bulunamadı.");
    setButtonState(btn, "error");
    return;
  }

  // 2. Permalink normalize et
  const link = findNormalizedLinkInRoot(root);
  if (!link) {
    showToast({ message: "Post URL'si bulunamadı.", platform: "instagram" });
    setButtonState(btn, "error");
    return;
  }

  setButtonState(btn, "loading");

  // 3. Metadata çıkar
  const context: SourceContext = detectSourceContext();
  const domMetadata = extractMetadata(root, link);
  const metadata = fillMissingFields(domMetadata, context);
  const postMeta = buildPostMetadata(link.canonicalUrl, metadata, root);

  // 4. Default collection akışı
  let defaultCol = await getDefaultCollection();
  if (!defaultCol) {
    defaultCol = await resolveDefaultFromServer();
  }

  if (defaultCol) {
    await saveDirectToCollection(postMeta, defaultCol, root);
    setButtonState(btn, "saved");
  } else {
    // İlk kez — modal aç
    setButtonState(btn, "idle");
    await openCollectionPickerFlow(root, postMeta, false);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function injectButtonsInScope(scope: Element | Document = document): void {
  const roots = findAllMediaRoots(scope);
  for (const root of roots) {
    if (root.querySelector(BUTTON_SELECTOR)) continue;

    const btn = createSaveButton();
    btn.addEventListener("click", (e) => {
      handleSaveClick(btn, e).catch((err) => {
        console.warn("[Magpie] Kaydetme hatası:", err);
        setButtonState(btn, "error");
      });
    });

    injectButtonIntoRoot(btn, root);
  }
}

export function removeStaleButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
