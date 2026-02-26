# Upload-Post Integration — Migration Map

Produced by codebase audit on 2026-02-26.
Lists every file that is part of the Upload-Post / social-connect integration, what it currently does, and any known issues.

---

## 1. Connect Launcher Page (user-facing)

**File:** `app/dashboard/connect-accounts/page.tsx`

Server component. Reads the `returnTo` search-param, sanitises it via `sanitizeReturnTo()`, then renders `<UploadPostConnectFrame returnTo={...} />` inside a `<Suspense>` boundary. Entry point for all three call-sites: `/dashboard`, `/dashboard/profile`, and `/onboarding`.

---

## 2. Iframe Component

**File:** `components/connect/UploadPostConnectFrame.tsx`

Client component. On mount, calls `GET /api/upload-post/connect-url?returnTo=…`, receives an `accessUrl`, and renders it in an `<iframe>`. Manages four UI states: `loading`, `ready`, `error`, `timeout`. Includes a 15-second load timeout with a "open in new tab" fallback. Currently contains diagnostic `console.log("[v0]")` lines from debugging — these should be removed once the integration is stable.

---

## 3. Connect-URL API Route

**File:** `app/api/upload-post/connect-url/route.ts`

`GET` handler. Authenticates the Supabase user, resolves the Upload-Post API key from `public.app_settings` (with env-var fallback), calls `POST /api/uploadposts/users` (create/ensure user, `ApiKey` auth scheme), builds a signed HMAC state token via `createState()`, calls `POST /api/uploadposts/users/generate-jwt` to obtain `accessUrl`, upserts an audit row into `public.upload_post_mapping`, and returns `{ accessUrl }`. Base URL is `https://app.upload-post.com` (overridable via `UPLOAD_POST_BASE_URL` env var). Contains diagnostic `console.log("[v0]")` lines.

---

## 4. Callback Route

**File:** `app/dashboard/connect-accounts/callback/route.ts`

`GET` handler. After the user finishes connecting accounts in the iframe/tab, Upload-Post redirects back here with a `?state=…` param. Verifies the HMAC signature and TTL via `verifyState()`, optionally checks the token's `userId` against the current Supabase session, sanitises `returnTo` a second time, and issues a final redirect to the originating page. Falls back to `/dashboard` on any failure.

---

## 5. Admin Settings Page

**File:** `app/admin/integrations/upload-post/page.tsx`

Client page under the admin layout. Renders `<UploadPostSettingsForm />` with a header. Reachable at `/admin/integrations/upload-post`. Linked from the admin sidebar (`app/admin/layout.tsx`) and the admin dashboard card (`app/admin/page.tsx`).

**Form component:** `components/admin/UploadPostSettingsForm.tsx`

Full settings form. Loads current settings via SWR (`GET /api/admin/settings/upload-post`), allows editing API key (password input, never pre-filled), branding fields, and default platforms. Includes a "Test Connection" button (`POST /api/admin/settings/upload-post/test`) that hits Upload-Post's `/api/health` endpoint. Saves via `POST /api/admin/settings/upload-post`.

---

## 6. Admin Settings API Routes

**File:** `app/api/admin/settings/upload-post/route.ts`

- `GET` — Returns current settings from `public.app_settings`. Returns `hasApiKey: boolean` rather than the raw key. Upserts the singleton row on read to guarantee it exists.
- `POST` — Upserts settings. Only overwrites `upload_post_api_key` if a non-empty value is provided (preserves existing key when field is left blank).

**File:** `app/api/admin/settings/upload-post/test/route.ts`

`POST` handler. Reads the stored API key from `public.app_settings`, calls `GET https://app.upload-post.com/api/health` with `Authorization: ApiKey …`, and returns success/failure.

Both routes are guarded by `requireAdminApi()` (`lib/auth/admin.ts`).

---

## 7. Supabase Tables Used for Upload-Post Config

### `public.app_settings`

**Script:** `scripts/009_app_settings.sql`

Single-row table (`CHECK (id = 1)`). Stores the Upload-Post API key and all branding/UI overrides. RLS: service role only. Read and written via the raw `@supabase/supabase-js` admin client (not the cookie-based SSR client).

Columns relevant to Upload-Post:
| Column | Type | Purpose |
|---|---|---|
| `upload_post_api_key` | text | API key for the Upload-Post service |
| `upload_post_logo_url` | text | Logo URL injected into the connect UI |
| `upload_post_connect_title` | text | Title shown in the connect UI |
| `upload_post_connect_description` | text | Description shown in the connect UI |
| `upload_post_redirect_button_text` | text | Button label on the redirect step |
| `upload_post_default_platforms` | text | CSV of default platform IDs |

### `public.upload_post_mapping`

**Script:** `scripts/013_upload_post_mapping.sql`

One row per user. Upserted each time `connect-url` generates a URL. Provides a minimal audit trail. FK to `auth.users(id) ON DELETE CASCADE`.

Columns:
| Column | Type | Purpose |
|---|---|---|
| `user_id` | uuid PK | FK to auth.users |
| `upload_post_username` | text | Username used on Upload-Post (currently same as `user.id`) |
| `last_connect_url_generated_at` | timestamptz | Timestamp of most recent URL generation |
| `created_at` | timestamptz | Row creation time |

---

## 8. Supporting Library Files

| File | Purpose |
|---|---|
| `lib/upload-post/config.ts` | Server-only. `requireEnv()`, `getBaseUrl()`, `getDefaultPlatforms()`, `getUploadPostUiConfig()` |
| `lib/upload-post/state.ts` | Server-only. `createState()` / `verifyState()` — HMAC-SHA256 signed, 10-min TTL state tokens |
| `lib/upload-post/returnTo.ts` | `sanitizeReturnTo()` — open-redirect guard with explicit allow-list |
| `lib/auth/admin.ts` | `requireAdminApi()` — checks `is_admin` metadata + `ADMIN_EMAILS` env var |
| `lib/supabase/server.ts` | `createAdminClient()` — raw `@supabase/supabase-js` client using service-role key (no cookies), fixes RLS service-role evaluation |

---

## 9. Entry-Point Wiring (where users are sent to the connect flow)

| Origin | Target URL |
|---|---|
| `app/dashboard/page.tsx` — Connected Accounts card | `/dashboard/connect-accounts?returnTo=/dashboard` |
| `app/dashboard/profile/page.tsx` — Social Connections panel | `/dashboard/connect-accounts?returnTo=/dashboard/profile` |
| `components/onboarding/Step5Connect.tsx` — Step 5 button | `/dashboard/connect-accounts?returnTo=/onboarding` |

---

## 10. Environment Variable Configuration

### Required for Upload-Post to function:

| Variable | Purpose | Example Values |
|---|---|---|
| `UPLOAD_POST_API_KEY` | Upload-Post API key (fallback source) | Your API key from Upload-Post dashboard |
| `UPLOAD_POST_STATE_SECRET` | HMAC key for signing OAuth state tokens | Generated via `openssl rand -hex 32` |
| `APP_BASE_URL` | **CRITICAL for Vercel:** base URL for redirect_url | **Production:** `https://zarzoom.com` |
| | | **Staging:** `https://staging.zarzoom.com` |
| | | **Local dev:** `http://localhost:3000` (or unset) |

### How APP_BASE_URL resolution works:

1. If `APP_BASE_URL` is set, use it (trim trailing slash)
2. Else if `VERCEL_URL` is set, use `https://${VERCEL_URL}` (automatically set by Vercel on each deployment)
3. Else (local dev only) use `http://localhost:3000`

**SAFETY:** On Vercel deployments (when `VERCEL=1` or `VERCEL_URL` is set), if the resolved base URL contains "localhost", the `/api/upload-post/connect-url` route will throw an error at runtime. This prevents misconfiguration from embedding localhost URLs in OAuth callbacks sent to Upload-Post.

### Recommended setup:

- **Production (zarzoom.com):** `APP_BASE_URL=https://zarzoom.com`
- **Staging:** `APP_BASE_URL=https://staging.zarzoom.com`
- **Local development:** Leave `APP_BASE_URL` unset (defaults to http://localhost:3000)

---

## 11. Known Issues / Notes

## 11. Known Issues / Notes

- **APP_BASE_URL is critical for production** — without it set, the `redirect_url` passed to Upload-Post will contain `localhost`, causing users to be redirected to localhost after connecting accounts. Always set `APP_BASE_URL` to your production domain on Vercel.
- **`UPLOAD_POST_STATE_SECRET`** must be set as an env var for `createState()` / `verifyState()` to work. If unset, the connect-url route will throw at the state-creation step.
- **`getUploadPostUiConfig()`** currently reads branding values from env vars only, not from `public.app_settings`. The connect-url route injects UI config from env vars while the admin form saves branding to the DB. These two sources should be unified — the route should read branding from `app_settings` alongside the API key.
