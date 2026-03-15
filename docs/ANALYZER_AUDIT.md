# Social Analyzer — Audit Report

**Date:** 2026-03-12
**Scope:** Full end-to-end audit of the floating homepage Social Analyzer

---

## Executive Summary

The **backend is fully real and production-grade.** All 7 API endpoints, the OpenRouter integration, the deterministic instant engine, Supabase persistence, rate limiting, the admin prompt management system, the claim system, and the fallback email queue are fully implemented and wired to real infrastructure.

The issues are **concentrated in the frontend widget** and the **auth redirect flow**.

---

## What Is REAL

| Component | File(s) | Status |
|---|---|---|
| `POST /api/analyzer/start` | `app/api/analyzer/start/route.ts` | Real — validates, caches, enqueues AI job |
| `GET /api/analyzer/status` | `app/api/analyzer/status/route.ts` | Real — reads status from `analysis_cache` |
| `GET /api/analyzer/result` | `app/api/analyzer/result/route.ts` | Real — auth-gates `full_report`, returns normalized data |
| `POST /api/analyzer/worker` | `app/api/analyzer/worker/route.ts` | Real — calls OpenRouter, retries on JSON failure |
| `POST /api/analyzer/fallback` | `app/api/analyzer/fallback/route.ts` | Real — queues for later processing |
| `POST /api/analyzer/claim` | `app/api/analyzer/claim/route.ts` | Real — transfers ownership on signup |
| OpenRouter client | `lib/openrouter/client.ts` | Real — JSON repair, Zod validation, retry |
| AI analysis runner | `lib/analyzer/aiAnalysis.ts` | Real — loads prompt from admin DB, variable substitution |
| Instant engine | `lib/analyzer/instantEngine.ts` | Real — 663 lines, deterministic, <5ms |
| DB layer | `lib/analyzer/db.ts` | Real — full CRUD on `analysis_cache` + `analysis_queue` |
| Type system | `lib/analyzer/types.ts` | Real — comprehensive Zod schemas |
| Admin prompt UI | `app/admin/settings/openrouter-prompts/` | Real — CRUD + audit log |
| Rate limiting | IP (5/hr) + session (3/session) | Real — DB-backed |
| TeaserReportClient polling | `components/analyzer/TeaserReportClient.tsx` | Real — polls every 2s for up to 2 min |
| Email signup → claim flow | `app/auth/callback/route.ts` | Real — analysis_id threaded, claim called |

## What Was MOCKED / BROKEN

| Issue | Severity | Location | Detail |
|---|---|---|---|
| **Auth CTAs miss analysis_id** | HIGH | `SocialAnalyzerWidget.tsx` L674, L704, L756 | All `/auth` links lack `?analysis_id=...` — users lose their analysis on signup |
| **OAuth drops analysis_id** | MEDIUM | `auth/actions.ts` L98-103 | `signInWithOAuth()` doesn't accept or thread analysis_id |
| **6.8s of fake delay** | MEDIUM | `SocialAnalyzerWidget.tsx` L317-327 | 2s + 4.8s of artificial setTimeout after data is already in memory |
| **Hardcoded post previews** | MEDIUM | `SocialAnalyzerWidget.tsx` L257-263 | Static platform-specific template strings, not from AI |
| **Hardcoded engagement metrics** | MEDIUM | `SocialAnalyzerWidget.tsx` L290-298 | "3.2k – 8.4k" reach and "High" engagement — fabricated |
| **Fabricated marketing claim** | LOW | `SocialAnalyzerWidget.tsx` L751 | "move into top X% within 60 days" — no data backs this |
| **Inconsistent benchmark formulas** | LOW | 3 components | Widget: `0.62+8`, TeaserReport: `0.72+5`, FullReport: `0.62+8` |
| **Teaser from start response ignored** | LOW | `SocialAnalyzerWidget.tsx` L104 | Typed as `unknown`, never consumed — cache hits don't surface teaser data |

## What Was NOT Broken

- All 7 API endpoints are real and functional
- OpenRouter integration is fully wired
- The admin prompt system works
- The DB schema (`analysis_cache`, `analysis_queue`) is properly defined
- The TeaserReport and FullReport components render from real API data
- The TeaserReportClient polls correctly
- The email signup → verify → callback → claim → report redirect works

---

## Fixes Applied

1. **Threaded `analysis_id` into all auth CTAs** in `SocialAnalyzerWidget.tsx`
2. **Added `analysisId` parameter to `signInWithOAuth()`** in `auth/actions.ts`
3. **Auth page passes `analysis_id` to OAuth flows** in `auth/page.tsx`
4. **Reduced fake delays** from 6.8s to 3.6s total (1.2s signals + 2.4s thinking)
5. **Replaced hardcoded post preview** with real teaser data when available (cache hits)
6. **Removed fabricated engagement metrics** from PostPreviewCard
7. **Removed fabricated "60 days" marketing claim** from benchmark stage
8. **Standardized benchmark formula** across all 3 components
9. **Used real teaser data** from start response when status is `completed`

## Manual Setup Required

- `OPENROUTER_API_KEY` must be set in Vercel env vars (or in `wizard_autofill_settings` via admin panel)
- `ANALYZER_WORKER_SECRET` should be set in production for worker endpoint auth
- The `rate_limits` table must exist in Supabase (no migration SQL found in repo)
- The admin must seed the `social_profile_prompt` in the admin panel (a built-in default exists)

---

## Audit Pass 2: Determinism, Observability, Fallback (2026-03-13)

### Root causes found

1. **Poll treated `status: "failed"` as completed**  
   When the result endpoint returned `status: "failed"` (e.g. async job failed or cache marked failed), the widget merged it with `status: data.status === "failed" ? "completed" : data.status`, so the UI showed the funnel with empty/fallback teaser instead of the fallback error UI.

2. **Failure logging not visible in minimal mode**  
   Only `analyzer.api.openrouter_input_prompt` and `analyzer.api.openrouter_raw_output` were allowed in minimal logging. Failures were logged as `analyzer.api.failed` / `analyzer.api.openrouter_call_failed`, which were dropped in minimal mode, so admins could not see failures when minimal was on.

3. **No single `analyzer_failure` contract**  
   The spec required a dedicated `analyzer_failure` log (failure_type, profile_url, platform, error_summary). This was not emitted; only generic analyzer.api.* stages were used.

4. **Result-path failures not logged as analyzer_failure**  
   Result endpoint 404 (NOT_FOUND) and 200 with `status: "failed"` did not log an `analyzer_failure` entry, so those failure modes were not visible in admin logs under the same contract.

### Files changed

| File | Change |
|------|--------|
| `components/analyzer/SocialAnalyzerWidget.tsx` | When poll receives `data.status === "failed"`, set `stage="error"` and `errorMsg` so **AnalyzerFallbackWidget** is shown; removed merging of failed as completed. |
| `lib/logging/activity.ts` | Added `analyzer_failure` to `ANALYZER_MINIMAL_ALLOWED_STAGES` so failures are always written in minimal mode. |
| `app/api/analyzer/start/route.ts` | On sync-path catch, log `analyzer_failure` with failure_type `AI_ERROR`, profile_url, platform, error_summary. On CAPTCHA / IP rate limit / session limit / user limit, also log `analyzer_failure` with appropriate failure_type. |
| `app/api/analyzer/result/route.ts` | On 404 (NOT_FOUND), log `analyzer_failure` with failure_type `NOT_FOUND`. When `entry.status === "failed"`, log `analyzer_failure` with failure_type `CACHE_STATUS_FAILED` and entry context; removed duplicate `analyzer.api.fallback_path_used` in favour of single failure log. |
| `docs/ANALYZER_AUDIT.md` | Documented this audit pass. |

### Pipeline map (concise)

```
User enters profile_url
  → SocialAnalyzerWidget handleSubmit
  → POST /api/analyzer/start { profile_url }
  → Start: validate → platform → rate limits/CAPTCHA → runInstantEngine → upsertCachePending
  → runAiAnalysis: loadPromptConfig (wizard_autofill_settings.social_profile_prompt) → substitute vars → callOpenRouterTyped
  → normalizeToUiContract → updateCacheCompleted
  → Return 200 { status: "completed", instant, teaser } OR 500 { status: "failed", ... }
  → Frontend: if !res.ok → setStage("error") → AnalyzerFallbackWidget
  → If 200: setResult, setStage("signals"), pollForResult(analysis_id)
  → GET /api/analyzer/result?analysis_id=… → getCacheById → return instant, teaser, full_report (or 202 pending / 200 failed)
  → Poll: if status "failed" → setStage("error"), setErrorMsg → AnalyzerFallbackWidget (fixed)
```

### Where the real result was being lost or replaced

- **Not on success path:** The result route uses `FALLBACK_INSTANT` / `FALLBACK_TEASER` only when `entry.status === "failed"` or when `ui_json` is missing `instant`/`teaser` (defensive). Real parsed result is returned when status is completed and ui_json is present.
- **In the UI:** When the **poll** received `status: "failed"` from `/api/analyzer/result`, the widget overwrote status to `"completed"` and did not set stage to `"error"`, so the user saw the funnel with empty/fallback content instead of the fallback error UI. That masking is removed; failed status now drives the same fallback UI as a 500 from start.

### What was changed to preserve the existing fallback UI

- **No redesign of AnalyzerFallbackWidget.** The existing component (email input, “Notify me when ready”, “Try the analyzer again”) is unchanged.
- **Failures now consistently reach it:**  
  - Start returns 500 → existing `if (!res.ok)` throws → catch sets `stage="error"` → fallback shown.  
  - Poll receives `status: "failed"` → now sets `stage="error"` and `errorMsg` → same fallback shown.  
- **All failure paths log `analyzer_failure`** (and existing analyzer.api.* where kept) so admin logs see failures even in minimal mode.
