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
