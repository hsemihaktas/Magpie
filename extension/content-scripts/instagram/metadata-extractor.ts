/**
 * metadata-extractor.ts
 * Media root container'ından metadata çıkarır.
 * DOM scraping ile OG/meta tag kullanmaz; yalnızca render edilmiş DOM'u okur.
 */

import type { ExtractedMetadata, NormalizedMediaLink } from "./types";

// ---------------------------------------------------------------------------
// Sabitler — güncellenmesi gerekebilecek selector fallback zincirleri
// ---------------------------------------------------------------------------

/**
 * Caption selector'ları — öncelik sırasıyla.
 * NOT: Instagram class adları build'e göre değişebilir.
 * Semantic ve role tabanlı selector'lar daha kararlıdır.
 */
const CAPTION_SELECTORS: ReadonlyArray<string> = [
  // Tekil post/reel sayfasında caption genellikle h1 içinde render edilir
  "h1",
  // Feed post caption wrapper (semantik olmayan, değişebilir)
  "div[class*='_a9zs'] span",
  // Yorum-like yapıda caption
  "ul li span[dir]",
  // Genel span ile dir attribute'u (Arapça/RTL dil desteği de buradan)
  "article span[dir='auto']",
  // Erişilebilirlik: role=dialog içindeki ilk geniş metin
  "[role='dialog'] span[dir]",
];

/**
 * Author link selector'ları.
 * Sistem path'leri hariç tutulur: /explore/, /p/, /reel/, /accounts/, /direct/
 */
const SYSTEM_PATHS = new Set([
  "explore", "p", "reel", "reels", "tv", "accounts", "direct",
  "stories", "ar", "en", "tr", "tags", "locations",
]);

/**
 * Avatar image selector'ları — öncelik sırasıyla.
 * Yalnızca post header alanındaki avatar alınmalı.
 */
const AVATAR_AREA_SELECTORS: ReadonlyArray<string> = [
  "header img",
  "header canvas + img",
  // dialog'da header yoksa: caption/action bar'ın üstündeki ilk küçük img
];

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Bir URL path'inin Instagram sistem path'i olmadığını doğrular. */
function isUserPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  return !SYSTEM_PATHS.has(segments[0]);
}

/**
 * Container içindeki ilk görseli veya video poster'ını döndürür.
 * Carousel için ilk görünür öğe kullanılır.
 * Avatar gibi küçük resimleri filtreler (naturalWidth < 200).
 */
function extractMediaUrl(root: Element): { thumbnailUrl?: string; mediaUrl?: string } {
  // 1. Video element (Reel)
  const video = root.querySelector<HTMLVideoElement>("video");
  if (video) {
    const mediaUrl = video.currentSrc || video.src || undefined;
    const thumbnailUrl = video.poster || undefined;
    return { thumbnailUrl, mediaUrl };
  }

  // 2. <img> — avatar değil, içerik görseli
  const images = root.querySelectorAll<HTMLImageElement>("img");
  for (const img of Array.from(images)) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:")) continue;

    // Küçük görselleri (avatar) atla — naturalWidth sıfırsa bilinmiyor, dahil et
    const w = img.naturalWidth;
    if (w > 0 && w < 200) continue;

    // alt="...'in profil resmi" gibi avatar pattern'lerini atla
    const altLower = (img.alt ?? "").toLowerCase();
    if (altLower.includes("profil resmi") || altLower.includes("profile picture")) {
      continue;
    }

    return { thumbnailUrl: src };
  }

  return {};
}

/**
 * Container içindeki caption metnini çıkarır.
 * Fallback zinciri kullanır; bulunamazsa undefined döner.
 */
function extractCaption(root: Element): string | undefined {
  for (const selector of CAPTION_SELECTORS) {
    try {
      const el = root.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length > 0) return text;
      }
    } catch {
      // Geçersiz selector — sessizce atla
    }
  }
  return undefined;
}

/**
 * Container içinden yazar bilgisini çıkarır.
 * Sistem path'lerine sahip linkler yazar olarak kabul edilmez.
 */
function extractAuthor(
  root: Element,
  _link: NormalizedMediaLink,
): { authorUsername?: string; authorUrl?: string } {
  // Strateji: h1 (caption) element'ini referans al, onun üstündeki profile link'i bul
  const h1El = root.querySelector("h1");

  // Tüm profile link'lerini tara
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href^='/'][href$='/']");

  let bestLink: HTMLAnchorElement | null = null;

  for (const anchor of Array.from(anchors)) {
    const pathname = new URL(anchor.href, "https://www.instagram.com").pathname;
    if (!isUserPath(pathname)) continue;

    const slug = pathname.replace(/\//g, "");
    if (!slug || slug.length > 50) continue;

    if (h1El) {
      // Caption'ın üstündeki link'i tercih et
      const pos = anchor.compareDocumentPosition(h1El);
      // DOCUMENT_POSITION_FOLLOWING (4): h1 anchor'dan sonra geliyorsa anchor önce demektir
      const anchorBeforeH1 = Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
      if (anchorBeforeH1) {
        bestLink = anchor;
        break; // İlk eşleşme yeterli
      }
    } else {
      // h1 yoksa (feed post): header içindeki ilk profile link
      const inHeader = anchor.closest("header") !== null;
      if (inHeader) {
        bestLink = anchor;
        break;
      }
    }
  }

  if (!bestLink) return {};

  const pathname = new URL(bestLink.href, "https://www.instagram.com").pathname;
  const authorUsername = pathname.replace(/\//g, "") || undefined;
  const authorUrl = authorUsername
    ? `https://www.instagram.com/${authorUsername}/`
    : undefined;

  return { authorUsername, authorUrl };
}

/**
 * post timestamp'ini çıkarır.
 * <time datetime="..."> elementi önceliklidir.
 */
function extractPublishedAt(root: Element): string | undefined {
  const timeEl = root.querySelector<HTMLTimeElement>("time[datetime]");
  return timeEl?.getAttribute("datetime") ?? undefined;
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

/**
 * Bir medya container'ından mümkün olan tüm metadata'yı çıkarır.
 * Herhangi bir alan eksik olursa hata fırlatmaz; undefined olarak kalır.
 *
 * @param root  findMediaRoot() ile bulunan container element'i
 * @param link  Normalize edilmiş canonical link (shortcode için)
 */
export function extractMetadata(
  root: Element,
  link: NormalizedMediaLink,
): ExtractedMetadata {
  try {
    const { thumbnailUrl, mediaUrl } = extractMediaUrl(root);
    const caption = extractCaption(root);
    const { authorUsername, authorUrl } = extractAuthor(root, link);
    const publishedAt = extractPublishedAt(root);

    return {
      authorUsername,
      authorUrl,
      caption,
      thumbnailUrl,
      mediaUrl,
      publishedAt,
    };
  } catch (err) {
    console.warn("[Magpie] Metadata çıkarılamadı:", err);
    return {};
  }
}
