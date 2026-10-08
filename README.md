<div align="center">
  <img src="web-viewer/app/icon-512.png" alt="Magpie" width="120" height="120" />

  # Magpie

  **Sosyal medya postlarını arşivleyen Chrome uzantısı ve web görüntüleyicisi.**
  Instagram ve X'ten istediğin postları koleksiyonlarına sessizce kaydet,
  web arayüzünden dilediğin zaman gözbat. Paylaş, ortak çalış.

  ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
  ![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
  ![Supabase](https://img.shields.io/badge/Supabase-Postgres+Auth+RLS-3fcf8e?logo=supabase)
  ![Chrome MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285f4?logo=googlechrome&logoColor=white)
</div>

---

## İçindekiler

- [Özellikler](#özellikler)
- [Mimari](#mimari)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [Koleksiyon Türleri](#koleksiyon-türleri)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Geliştirme](#geliştirme)

---

## Özellikler

### Chrome Uzantısı
- **Instagram desteği** — feed, `/p/` (dialog ve doğrudan URL), Reels, hikayeler
- **X / Twitter desteği** — tweetler, video poster thumbnail, alinti tweet metni
- **Tek tıkla kaydet** — gönderinin üzerinde beliren arşiv butonu
- **Varsayılan koleksiyon** — doğrudan kaydeder, gerek yoksa picker'ı görmezsin
- **Akıllı metadata çıkarma** — caption, yazar, thumbnail (video frame dahil)
- **Tekrar kaydetme koruması** — aynı postu iki kez eklemez

### Web Görüntüleyici
- **Koleksiyon yönetimi** — oluştur, yeniden adlandır, varsayılan belirle
- **Toplu silme** — birden fazla postu seç ve tek seferde sil
- **Arama** — caption içinde tam metin arama
- **Koleksiyon filtreleme** — sol kenar çubuğundan tek tıkla
- **Karanlık mod** — sistem tercihin otomatik uygulanır

### Paylaşım & İşbirliği
- **Paylaşımlı Koleksiyon** — tek kullanımlık 24 saatlik davet kodu, sadece okuma erişimi
- **Ortak Koleksiyon** — post ekleyebilir, kendi postunu silebilir, yeni ortak davet edebilir
- **Erişim iptali** — istediğin zaman herhangi bir üyeyi kaldır
- **RLS koruması** — yetki kontrolleri Postgres RLS ile de uygulanır

---

## Mimari

```
+---------------------------+   +------------------------+
|     Chrome Uzantısı       |   |   Web Görüntüleyici    |
|   (MV3 / TypeScript)     |   |  (Next.js 14 App)      |
|                          |   |                        |
|  content-scripts/        |   |  app/actions.ts        |
|  +- instagram/           |   |  components/           |
|  |  +- button-injector   |   |  +- CollectionFilter   |
|  |  +- metadata-extractor|   |  +- PostCard           |
|  |  +- observer          |   |  +- ShareModal         |
|  |  +- route-listener    |   |  +- JoinModal          |
|  +- x.ts                 |   |  +- ManageMembersModal |
|  background/sw.ts        |   |  lib/supabase.ts       |
+---------------------------+   +------------------------+
              |                          |
              v                          v
+----------------------------------------------------------+
|                       Supabase                          |
|  Postgres DB         Auth              Storage          |
|  +- collections      +- Google OAuth   +- thumbnails/  |
|  +- saved_posts      +- Email                          |
|  +- collection_invites                                  |
|  +- collection_members                                  |
|                                                         |
|  SECURITY DEFINER fonksiyonlar:                         |
|  +- redeem_invite()                                     |
|  +- get_members_with_email()                            |
|  +- get_shared_collections_with_owner()                 |
+----------------------------------------------------------+
```

---

## Proje Yapısı

```
magpie/
+-- extension/                    Chrome Uzantısı (MV3)
|   +-- manifest.json
|   +-- build.mjs                 esbuild yapılandırması
|   +-- content-scripts/
|   |   +-- instagram/            Modüler Instagram içerik scripti
|   |   |   +-- button-injector.ts
|   |   |   +-- metadata-extractor.ts
|   |   |   +-- observer.ts       MutationObserver (SPA desteği)
|   |   |   +-- route-listener.ts, permalink.ts, storage.ts...
|   |   +-- x.ts, modal.ts, toast.ts
|   +-- background/service-worker.ts
|   +-- popup/, shared/, icons/
|
+-- web-viewer/                   Next.js 14 Web Uygulaması
|   +-- app/actions.ts            Tüm sunucu aksiyonları
|   +-- app/feed/page.tsx         Ana feed sayfası
|   +-- components/
|   |   +-- CollectionFilter.tsx, PostCard.tsx, PostCardList.tsx
|   |   +-- ShareModal.tsx, JoinCollectionModal.tsx
|   |   +-- ManageMembersModal.tsx, SearchBar.tsx, ThemeToggle.tsx
|   +-- lib/supabase.ts, types.ts, invite-code.ts
|
+-- supabase/migrations/
    +-- 001_collections_table.sql
    +-- 002_saved_posts_table.sql
    +-- 003_rls_policies.sql
    +-- 004_storage_bucket.sql
    +-- 005_collections_is_default.sql
    +-- 006_backfill_is_default.sql
    +-- 007_collection_sharing_tables.sql
    +-- 008_collection_sharing_rls.sql
    +-- 009_collaborative_collection.sql
```

---

## Kurulum

### Ön Gereksinimler

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`
- Google Chrome

### 1. Supabase Projesi

```bash
supabase link --project-ref <proje-ref>
supabase db push
```

Dashboard → Settings → API:
- **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` *(yalnızca sunucu tarafı)*

### 2. Chrome Uzantısı

```bash
cd extension
cp .env.example .env
npm install
npm run build
```

`chrome://extensions` → Geliştirici modu → Paketlenmemişi yükle → `extension/` seç.

### 3. Web Görüntüleyici

```bash
cd web-viewer
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

---

## Kurulum

### Ön Gereksinimler

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google Chrome

### 1. Supabase Projesi

```bash
supabase link --project-ref <proje-ref>
supabase db push
```

Dashboard → Settings → API:
- **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` *(yalnızca sunucu tarafı)*

### 2. Chrome Uzantısı

```bash
cd extension
cp .env.example .env
npm install
npm run build
```

`chrome://extensions` → Geliştirici modu → Paketlenmemişi yükle → `extension/` seç.

### 3. Web Görüntüleyici

```bash
cd web-viewer
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

---

## Kullanım

### Uzantıyla Post Kaydetme

1. Instagram veya X'te bir postun üzerine gel.
2. Sağ üst köşede beliren **arşiv butonuna** tıkla.
3. İlk kullanımda koleksiyon seçici açılır.
4. Sonraki kaydetmelerde varsayılan koleksiyona doğrudan gider.
5. Toast'taki **"Değiştir"** linki ile koleksiyon değiştirilebilir.

### Web Görüntüleyicide Yönetim

| Eylem | Nasıl |
|---|---|
| Koleksiyon yeniden adlandır | Kenar çubuğunda üzerine gel → kalem ikonu |
| Varsayılan değiştir | üzerine gel → yıldız ikonu |
| Post sil | Kartın üzerine gel → kirmizi çöp ikonu |
| Birden fazla sil | **Seç** → kartlara tıkla → **Sil** |
| Koleksiyona filtrele | Sol kenarda koleksiyon adına tıkla |
| Arama | Üsteki arama çubuğu |
| Koleksiyon paylaş | Paylaş ikonu → kodu kopyala |
| Koleksiyona katıl | Kenar çubuğu altı → **Koleksiyona Katıl** |

---

## Koleksiyon Türleri

### Kişisel Koleksiyon
Yalnızca sahibi görür, ekler, siler.

### Paylaşımlı Koleksiyon (Görüntüleyici)
- Sahip tek kullanımlık 24 saatlik davet kodu üretir.
- Davet edilen kişi yalnızca **okuyabilir** — ekleyemez, silemez.
- Sahip herhangi bir üyeyi istediği zaman kaldırabilir.

### Ortak Koleksiyon (Collaborator)
- Sahip **"Ortak"** rolü seçip davet kodu üretir.
- Ortak üye:
  - Post **ekleyebilir** (uzantısıyla bu koleksiyonu varsayılan yaparak)
  - Yalnızca **kendi** eklediğini **silebilir**
  - Yeni ortak **davet edebilir**
- RLS politikaları bu kuralları veritabanı seviyesinde de uygular.

---

## Veritabanı Şeması

```sql
-- Koleksiyonlar
collections (id, user_id, name, is_default, created_at)

-- Kaydedilen postlar
saved_posts (id, user_id, collection_id, post_url, post_type,
             platform, author_username, author_display_name,
             author_avatar_url, content_text, media_urls,
             thumbnail_url, post_timestamp, saved_at, raw_metadata)

-- Davet kodları (24 saat, tek kullanım)
collection_invites (id, collection_id, created_by,
                    code CHAR(8) UNIQUE,
                    grants_role TEXT,   -- 'viewer' | 'collaborator'
                    expires_at, used_at, used_by)

-- Koleksiyon üyeliği
collection_members (id, collection_id, member_user_id,
                    member_role TEXT,   -- 'viewer' | 'collaborator'
                    joined_at)
```

### RLS Politikaları (özet)

| Tablo | Erişim |
|---|---|
| `collections` | Sahip: tam · Üye: SELECT |
| `saved_posts` | Sahip: tam · viewer: SELECT · collaborator: SELECT + INSERT/DELETE (kendi) |
| `collection_invites` | Sahip: SELECT · Yazma: admin client |
| `collection_members` | Üye: kendi · Sahip: koleksiyonundaki hepsi |

---

## Geliştirme

```bash
# Uzantı — derleme
cd extension && npm run build

# Uzantı — izleme modunda
cd extension && npm run watch

# Web — geliştirme sunucusu
cd web-viewer && npm run dev

# Tip denetimi
cd web-viewer && npx tsc --noEmit

# Yeni migration
supabase migration new <isim> && supabase db push
```

---

## Ortam Değişkenleri

### `extension/.env`

| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'si |
| `SUPABASE_ANON_KEY` | Anonim (public) anahtar |
| `WEB_VIEWER_URL` | Web goruntleyici URL |

### `web-viewer/.env.local`

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonim (public) anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Servis rolü — **yalnızca sunucu tarafı** |

---

<div align="center">
  <sub>Magpie — parlak şeyleri toplayan saksağan gibi, senin için toplar.</sub>
</div>
---

## Lisans

Copyright © 2024 Semih Aktaş. Tüm hakları saklıdır.

Bu kaynak kodu yalnızca inceleme ve eğitim amaçlı paylaşılmaktadır.
İzin alınmadan kullanılamaz, kopyalanamaz, dağıtılamaz veya ticari amaçlarla kullanılamaz.

İzin talepleri için: info.hsemihaktas@gmail.com
