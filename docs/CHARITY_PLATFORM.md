# SlidesEdu Charity Platform

SlidesEdu is a free educational slide builder for teachers and students. This document covers the charity platform model, public gallery, launch operations, and phase status.

## Mission

Provide free, classroom-ready slide decks that teachers can discover, view, remix, and customize — funded as a charitable initiative with no ads or payments in v1.

## Sharing Model

SlidesEdu is a **public utility**. All completed decks are shared automatically — there is no private option.

| State | Behavior |
| ----- | -------- |
| **Completed** | Listed in Explore, shareable at `/share/{token}`, remixable |
| **Generating / failed** | Not shareable until generation completes |

Public previews strip speaker notes and non-search images. Only Brave-sourced search images appear on share pages.

## Gallery Architecture

- **Index collection:** `publicDecks/{shareToken}` — server-written only (deny client writes in Firestore rules)
- **Sync trigger:** `onProjectUpdate` upserts or deletes index when status changes
- **API:** `GET /gallery` — paginated, filterable by grade/subject, sort by recent or popular
- **Frontend:** `/explore` grid + landing Featured section (`limit=6&sort=recent`)

## Cost Policy

- AI image generation is disabled in production (`IMAGE_GENERATION_ENABLED = false`)
- Image search uses Brave API (one-time per slide)
- No payments or ads in v1

## Phase Status

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Cost floor — disable image gen | Shipped |
| 2 | Always-public sharing (no private option) | Shipped |
| 3 | Explore gallery, `publicDecks` index, triggers | Shipped |
| 4 | Explore-first landing, FeaturedDecks, analytics | Shipped |
| 5 | Seed legacy decks, sitemap, SEO, report flow, docs | **This phase** |

## Launch Operations

### Prerequisites

1. Firestore composite indexes on `publicDecks` deployed
2. Phase 3–4 frontend and functions live
3. Service account credentials for backfill script ([SETUP-SERVICE-ACCOUNT.md](../scripts/SETUP-SERVICE-ACCOUNT.md))

### Deploy Order

```bash
# 1. Firestore rules (galleryReports deny-all)
firebase deploy --only firestore:rules

# 2. Cloud Functions (sitemap, crawler, report endpoints)
firebase deploy --only functions

# 3. Vercel production deploy
#    Set env vars: PRODUCTION_API_URL + VITE_PRODUCTION_API_URL (same Cloud Run URL)

# 4. Verify endpoints
curl -sI https://www.slidesedu.org/sitemap.xml
curl -sI https://www.slidesedu.org/robots.txt
curl -s "https://api-osqb5umzra-uc.a.run.app/share/crawler?token={valid-token}" | head -20

# 5. Dry-run backfill (no writes)
npm run backfill-public-decks -- --dry-run

# 6. Production backfill
npm run backfill-public-decks

# 7. Wait 30s for triggers, then verify orphans
sleep 30 && npm run backfill-public-decks -- --verify-only
# Expect: verify.orphans=0, verify.healed=0
```

### Backfill Script

```bash
npm run backfill-public-decks -- --dry-run          # log only
npm run backfill-public-decks                       # prod run
npm run backfill-public-decks -- --verify-only      # heal orphans only
npm run backfill-public-decks -- --limit=3          # test subset
npm run backfill-public-decks -- --batch-size=25    # default batch size
npm run backfill-public-decks -- --verbose          # per-deck logging
```

**Idempotency:** Skips when `publicDecks/{shareToken}` exists with matching `projectId`. Re-runs are safe.

**Rollback:** Admin deletes erroneous `publicDecks` docs. Re-run script after fix.

### Search Console (Manual)

1. Verify property `https://www.slidesedu.org` (DNS or HTML file)
2. Submit sitemap: `https://www.slidesedu.org/sitemap.xml`
3. Optionally request indexing for `/explore`
4. Monitor Coverage report after 48–72 hours

### Post-Launch Verification

- `publicDecks` count ≈ 99 (Firestore console)
- `GET /gallery?limit=50` returns ≥50 items
- Landing Featured shows 1–6 real decks
- Sitemap includes `/`, `/explore`, and `/share/{token}` URLs
- Share pages: JSON-LD validates in [Google Rich Results Test](https://search.google.com/test/rich-results)
- Report form submits on live share pages
- Footer trust copy on landing, explore, FAQ, and share pages

## API Endpoints (Phase 5)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/sitemap.xml` | No | Dynamic XML sitemap (1h cache) |
| GET | `/share/crawler?token=` | No | Bot-friendly HTML with OG + JSON-LD |
| POST | `/gallery/report` | No | Report problematic deck (5 req/hour/IP) |

### Report Request

```json
{
  "token": "uuid",
  "reason": "inappropriate" | "copyright" | "inaccurate" | "other",
  "details": "optional, max 500 chars"
}
```

Reports stored in `galleryReports/{autoId}` with `reporterIpHash` (sha256) and truncated `userAgent`. No reporter email collected in v1.

## SEO

- **Sitemap:** `GET /sitemap.xml` on Cloud Functions, rewritten via Vercel
- **robots.txt:** `Sitemap: https://www.slidesedu.org/sitemap.xml`
- **Client meta:** `usePageMeta` injects per-deck OG + JSON-LD on share pages
- **Bot meta:** Vercel Edge Middleware proxies bot UAs to `/share/crawler`

## Storage Audit

The backfill script samples 20 decks and classifies image URLs. Phase 2 verified Brave-only images in preview path. If Firebase Storage URLs are found in search-sourced images, document as known limitation; v1.1 may add signed-URL proxy. No `storage.rules` change expected for launch.

## Out of Scope (v1.1)

- Full-text `q` search on gallery
- GA4 Measurement Protocol
- Admin UI for `galleryReports`
- Automated Search Console ping
- Featured deck manual curation
- SSR/prerender for `/explore`
