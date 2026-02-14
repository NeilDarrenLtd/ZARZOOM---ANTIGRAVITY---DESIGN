# ZARZOOM API & Architecture Reference

## Overview

ZARZOOM is a Next.js 15 (App Router) application using Supabase for authentication, database, and OAuth management. The application is structured into a public marketing site, a user-facing auth/dashboard flow, and a protected admin panel.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [API Routes](#2-api-routes)
3. [Server Actions](#3-server-actions)
4. [Middleware & Route Protection](#4-middleware--route-protection)
5. [Supabase Client Setup](#5-supabase-client-setup)
6. [Database Schema](#6-database-schema)
7. [Admin Functions](#7-admin-functions)
8. [Environment Variables](#8-environment-variables)

---

## 1. Authentication

ZARZOOM uses Supabase Auth with both email/password and OAuth (social) login.

### Auth Flow

```
User visits /auth
  -> Login (email/password) -> signInWithEmail() -> redirect to /dashboard
  -> Register (email/password) -> signUpWithEmail() -> redirect to /auth/verify
      -> User clicks email link -> /auth/callback -> /auth/verified -> /dashboard
  -> OAuth (Google, Facebook, LinkedIn, X/Twitter) -> signInWithOAuth()
      -> Supabase OAuth redirect -> /auth/callback -> /dashboard
```

### Password Requirements (Registration)

| Rule              | Requirement                                |
|-------------------|--------------------------------------------|
| Minimum length    | 8 characters                               |
| Uppercase         | At least 1 uppercase letter                |
| Lowercase         | At least 1 lowercase letter                |
| Number            | At least 1 digit                           |
| Special character | At least 1 of `!@#$%^&*(),.?":{}|<>`      |

### Admin Auth Flow

```
Admin visits /admin/login
  -> signInAdmin(email, password)
  -> Checks user_metadata.is_admin OR profiles.is_admin
  -> If admin: redirect to /admin
  -> If not admin: sign out + error message
```

---

## 2. API Routes

### `GET /api/auth/providers`

Returns which OAuth providers are currently enabled in the Supabase project.

**Response:**

```json
{
  "providers": {
    "google": true,
    "facebook": false,
    "linkedin": true,
    "twitter": false
  }
}
```

**Caching:** Revalidates every 60 seconds (`revalidate = 60`).

**Error Response:**

```json
{
  "providers": {}
}
```

---

### `GET /auth/callback`

OAuth/email verification callback handler. Exchanges a Supabase `code` for a session.

**Query Parameters:**

| Parameter | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `code`    | string | Yes      | Authorization code from Supabase               |
| `next`    | string | No       | Redirect path after auth (default: `/dashboard`)|

**Behaviour:**
- On success: redirects to `next` path (default `/dashboard`)
- On failure: redirects to `/auth/error`

---

## 3. Server Actions

All server actions are defined in `app/auth/actions.ts` and `app/admin/actions.ts` and use the `"use server"` directive.

### User Auth Actions (`app/auth/actions.ts`)

#### `signInWithEmail(email, password)`

Signs in a user with email and password via Supabase Auth.

| Parameter  | Type   | Description        |
|------------|--------|--------------------|
| `email`    | string | User email address |
| `password` | string | User password      |

**Returns:** `{ success: true }` or `{ error: string }`

---

#### `signUpWithEmail(email, password)`

Registers a new user. Sends a verification email with a redirect to `/auth/callback?next=/auth/verified`.

| Parameter  | Type   | Description        |
|------------|--------|--------------------|
| `email`    | string | User email address |
| `password` | string | User password      |

**Returns:** `{ success: true }` or `{ error: string }`

---

#### `signInWithOAuth(provider)`

Initiates OAuth sign-in with one of the supported providers.

| Parameter  | Type   | Description                                          |
|------------|--------|------------------------------------------------------|
| `provider` | string | One of: `google`, `facebook`, `twitter`, `linkedin_oidc` |

**Returns:** `{ url: string }` (redirect URL) or `{ error: string }`

---

#### `resendVerificationEmail(email)`

Resends the email verification link.

| Parameter | Type   | Description        |
|-----------|--------|--------------------|
| `email`   | string | User email address |

**Returns:** `{ success: true }` or `{ error: string }`

---

#### `signInAdmin(email, password)`

Signs in an admin. Validates admin status via `user_metadata.is_admin` or the `profiles.is_admin` column. Signs the user out if they are not an admin.

| Parameter  | Type   | Description        |
|------------|--------|--------------------|
| `email`    | string | Admin email        |
| `password` | string | Admin password     |

**Returns:** `{ success: true }` or `{ error: string }`

---

### Admin Actions (`app/admin/actions.ts`)

All admin actions call `requireAdmin()` internally, which verifies the current user is an authenticated admin before executing.

#### `getSettings(prefix)`

Reads site settings from the `site_settings` table filtered by key prefix. Encrypted values are returned as empty strings.

| Parameter | Type   | Description                       |
|-----------|--------|-----------------------------------|
| `prefix`  | string | Key prefix filter (e.g. `smtp_`)  |

**Returns:** `{ settings: Record<string, string> }` or `{ error: string, settings: {} }`

---

#### `saveSettings(entries)`

Upserts site settings. Skips empty encrypted entries (preserves existing secrets).

| Parameter | Type   | Description                                                 |
|-----------|--------|-------------------------------------------------------------|
| `entries` | Array  | `{ key: string, value: string, encrypted?: boolean }[]`     |

**Returns:** `{ success: true }` or `{ error: string }`

---

#### `configureSupabaseOAuthProvider(providerId, clientId, clientSecret, enabled)`

Configures an OAuth provider directly in Supabase Auth via the Supabase Management API.

| Parameter      | Type    | Description                                              |
|----------------|---------|----------------------------------------------------------|
| `providerId`   | string  | Provider ID: `google`, `facebook`, `linkedin`, `twitter` |
| `clientId`     | string  | OAuth client ID                                          |
| `clientSecret` | string  | OAuth client secret                                      |
| `enabled`      | boolean | Enable or disable the provider                           |

**Returns:** `{ success: true }` or `{ error: string }`

**Requires:** `SUPABASE_ACCESS_TOKEN` environment variable.

---

#### `getSupabaseOAuthStatus()`

Reads the current OAuth provider configuration from Supabase Auth.

**Returns:**

```json
{
  "providers": {
    "google":   { "enabled": true,  "hasClientId": true  },
    "facebook": { "enabled": false, "hasClientId": false },
    "linkedin": { "enabled": true,  "hasClientId": true  },
    "twitter":  { "enabled": false, "hasClientId": false }
  }
}
```

---

#### `sendTestEmail(recipientEmail)`

Sends a test email via the SMTP settings stored in `site_settings`.

| Parameter        | Type   | Description              |
|------------------|--------|--------------------------|
| `recipientEmail` | string | Email to send the test to|

**Returns:** `{ success: true }` or `{ error: string }`

**SMTP Settings Keys:** `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from_email`, `smtp_from_name`, `smtp_encryption`

---

#### `getUsers()`

Returns all user profiles from the `profiles` table, ordered by `created_at` descending.

**Returns:** `{ users: ProfileRow[] }` or `{ error: string, users: [] }`

---

#### `updateUserRole(userId, isAdmin)`

Toggles admin status for a user.

| Parameter | Type    | Description                       |
|-----------|---------|-----------------------------------|
| `userId`  | string  | UUID of the user                  |
| `isAdmin` | boolean | Set to `true` to grant admin role |

**Returns:** `{ success: true }` or `{ error: string }`

---

#### `getEnabledProviders()`

Returns which OAuth providers are enabled. Used by the auth page to conditionally show social login buttons. Tries the Supabase Management API first, falls back to `site_settings`.

**Returns:** `{ providers: Record<string, boolean> }`

---

## 4. Middleware & Route Protection

Defined in `middleware.ts` and `lib/supabase/middleware.ts`.

### Protected Routes

| Route Pattern       | Protection Level | Redirect if Unauthorized |
|---------------------|------------------|--------------------------|
| `/dashboard/*`      | Authenticated    | `/auth`                  |
| `/admin/*`          | Admin            | `/admin/login`           |
| `/admin/login`      | Public           | N/A                      |
| All other routes    | Public           | N/A                      |

### Middleware Behaviour

1. **Public routes** skip Supabase auth entirely (no performance overhead).
2. **`/dashboard`** routes require an authenticated user; unauthenticated users are redirected to `/auth`.
3. **`/admin`** routes (except `/admin/login`) require an authenticated user; unauthenticated users go to `/admin/login`.
4. Authenticated non-admin users on `/admin` routes are redirected to `/dashboard`.
5. Admin check in middleware uses `user_metadata.is_admin` (JWT claim, no DB query).

### Matcher Pattern

```
/((?!_next/static|_next/image|favicon.ico|sequence|images|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

Static assets, images, and Next.js internal routes are excluded.

---

## 5. Supabase Client Setup

### Browser Client (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'
createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

Used in client components (`"use client"`).

### Server Client (`lib/supabase/server.ts`)

Two clients are available:

| Function             | Key Used              | Purpose                              |
|----------------------|-----------------------|--------------------------------------|
| `createClient()`     | `ANON_KEY`            | Standard server-side operations       |
| `createAdminClient()`| `SERVICE_ROLE_KEY`    | Bypass RLS for admin operations       |

Both use `@supabase/ssr` with cookie-based session management.

---

## 6. Database Schema

### Core Tables

#### `profiles`

| Column       | Type      | Description                  |
|--------------|-----------|------------------------------|
| `id`         | uuid (PK) | Matches Supabase auth user ID|
| `email`      | text      | User email                   |
| `display_name`| text    | Display name                 |
| `is_admin`   | boolean   | Admin flag                   |
| `created_at` | timestamptz | Created timestamp          |
| `updated_at` | timestamptz | Updated timestamp          |

**RLS Policies:** Users can read/update own profile. Admins can select/update all profiles.

#### `site_settings`

| Column      | Type      | Description                    |
|-------------|-----------|--------------------------------|
| `id`        | uuid (PK) | Primary key                   |
| `key`       | text      | Setting key (unique)          |
| `value`     | text      | Setting value                 |
| `encrypted` | boolean   | Whether value is a secret     |
| `updated_at`| timestamptz | Last updated               |

**RLS Policies:** Admin-only CRUD.

### Multi-Tenant Tables

The database supports multi-tenancy with tenant-scoped data:

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `tenant_memberships`        | Maps users to tenants with roles          |
| `tenant_settings`           | Per-tenant configuration (e.g. language)  |
| `tenant_subscriptions`      | Billing subscriptions per tenant          |
| `subscription_plans`        | Available plans (public read)             |
| `plan_prices`               | Pricing per plan/interval (public read)   |
| `billing_usage_counters`    | Usage tracking per billing period         |
| `usage_counters`            | General usage metrics per tenant          |

### AI / Content Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `jobs`                      | Background job queue                      |
| `artefacts`                 | Generated content/artefacts               |
| `prompt_templates`          | AI prompt templates                       |
| `prompt_template_versions`  | Versioned prompt templates                |
| `provider_secrets`          | Encrypted API keys per provider           |
| `provider_secrets_metadata` | Non-sensitive key metadata (view)         |

### Social Media Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `social_profiles`           | Connected social media accounts           |
| `social_posts`              | Scheduled/published social posts          |
| `social_webhook_events`     | Incoming webhook events                   |

### Infrastructure Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `admin_audit`               | Admin action audit log                    |
| `idempotency_keys`          | Prevents duplicate job processing         |
| `rate_limits`               | Request rate limiting per tenant          |

---

## 7. Admin Functions

### Admin Panel Pages

| Route                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `/admin`                    | Dashboard with links to settings sections |
| `/admin/login`              | Admin-specific login page                 |
| `/admin/users`              | User management (view, search, toggle admin)|
| `/admin/settings`           | Redirects to `/admin/settings/email`      |
| `/admin/settings/email`     | SMTP configuration + test email           |
| `/admin/settings/oauth`     | OAuth provider management (Google, Facebook, LinkedIn, X)|

### Admin Auth Guard

All admin server actions use the `requireAdmin()` function which:

1. Checks for an authenticated user via `supabase.auth.getUser()`
2. First checks `user.user_metadata.is_admin` (fast, no DB query)
3. Falls back to querying `profiles.is_admin` via admin client (bypasses RLS)
4. Throws if not authenticated or not an admin

---

## 8. Environment Variables

### Required

| Variable                         | Description                               |
|----------------------------------|-------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anonymous/public key             |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service role key (server-only)   |

### Optional

| Variable                              | Description                               |
|---------------------------------------|-------------------------------------------|
| `SUPABASE_ACCESS_TOKEN`               | Supabase Management API token (for OAuth config) |
| `NEXT_PUBLIC_SITE_URL`                | Explicit site URL for redirects           |
| `VERCEL_PROJECT_PRODUCTION_URL`       | Auto-set by Vercel (production URL)       |
| `VERCEL_URL`                          | Auto-set by Vercel (preview/branch URL)   |

### URL Resolution Priority

The app resolves its base URL for OAuth/email redirects in this order:

1. `NEXT_PUBLIC_SITE_URL` (explicit, set by admin)
2. `VERCEL_PROJECT_PRODUCTION_URL` (auto, Vercel production)
3. `VERCEL_URL` (auto, Vercel preview)
4. Request `origin` header (fallback)

---

## Application Routes Summary

### Public (Site)

| Route           | Description               |
|-----------------|---------------------------|
| `/`             | Landing page              |
| `/login-launch` | Pre-launch login page     |
| `/privacy`      | Privacy policy            |
| `/terms-user`   | User terms of service     |
| `/terms-website` | Website terms of use     |
| `/cookies`      | Cookie policy             |
| `/support`      | Support page              |

### Auth

| Route              | Description                            |
|--------------------|----------------------------------------|
| `/auth`            | Login / Register page                  |
| `/auth/verify`     | Email verification pending page        |
| `/auth/verified`   | Email verified success page            |
| `/auth/error`      | Auth error page                        |
| `/auth/callback`   | OAuth/email callback handler (route)   |

### User (Protected)

| Route          | Description       |
|----------------|-------------------|
| `/dashboard`   | User dashboard    |

### Admin (Protected + Admin Only)

| Route                      | Description                |
|----------------------------|----------------------------|
| `/admin`                   | Admin dashboard            |
| `/admin/login`             | Admin login                |
| `/admin/users`             | User management            |
| `/admin/settings`          | Settings redirect          |
| `/admin/settings/email`    | SMTP email configuration   |
| `/admin/settings/oauth`    | OAuth provider management  |

---

## 9. API Service Layer Architecture

The `lib/api/` directory contains the shared service layer that powers all
`/api/v1/*` route handlers. Every module is designed to work with the existing
Supabase database tables and RLS policies.

### Module Inventory

| Module              | File                    | Responsibility                                                        |
|---------------------|-------------------------|-----------------------------------------------------------------------|
| Environment         | `lib/api/env.ts`        | Zod-validated, typed access to required env vars. Fails fast on boot. |
| Request ID          | `lib/api/request-id.ts` | Generates or inherits `X-Request-Id` correlation IDs.                 |
| HTTP Responses      | `lib/api/http-responses.ts` | Standardised JSON response helpers (`ok`, `created`, `accepted`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `serverError`). |
| Errors              | `lib/api/errors.ts`     | Typed error classes (`ApiError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `QuotaExceededError`, `ValidationError`). |
| Authentication      | `lib/api/auth.ts`       | Extracts Bearer token or session cookies, calls `supabase.auth.getUser()`. |
| Tenancy             | `lib/api/tenancy.ts`    | Resolves the user's active tenant via `tenant_memberships` table.     |
| Roles               | `lib/api/roles.ts`      | Role hierarchy check (`super_admin > admin > member > viewer`).       |
| Rate Limiting       | `lib/api/rate-limit.ts` | Sliding-window counter using the `rate_limits` table.                 |
| Idempotency         | `lib/api/idempotency.ts`| Deduplication via `idempotency_keys` table with response replay.      |
| Quotas              | `lib/api/quotas.ts`     | Usage tracking via `billing_usage_counters` + `subscription_plans.quota_policy`. |
| Job Queue           | `lib/api/queue.ts`      | Enqueues background work into the `jobs` table.                       |
| Language            | `lib/api/language.ts`   | Resolves `Accept-Language` / query param / tenant default.            |
| Handler Factory     | `lib/api/handler.ts`    | `createApiHandler()` -- wires all cross-cutting concerns together.    |
| Barrel Export       | `lib/api/index.ts`      | Re-exports everything for clean imports: `import { ... } from "@/lib/api"`. |

### Request Lifecycle

Every request through `createApiHandler` follows this pipeline:

```
Incoming Request
  |
  v
1. Generate / inherit X-Request-Id
  |
  v
2. Authenticate (Bearer token or session cookie)
   - Calls supabase.auth.getUser()
   - Skipped if auth: false
  |
  v
3. Resolve Tenant
   - Queries tenant_memberships for user's active tenant
   - Supports X-Tenant-Id header for multi-tenant users
  |
  v
4. Check Role
   - Compares user's role against requiredRole config
   - Uses hierarchy: super_admin > admin > member > viewer
  |
  v
5. Enforce Rate Limit
   - Sliding-window counter in rate_limits table
   - Per-tenant, per-endpoint
  |
  v
6. Resolve Language
   - ?lang= param > Accept-Language header > tenant default > "en"
  |
  v
7. Execute Handler
   - Handler receives ApiContext with user, membership, language, etc.
  |
  v
8. Return Response
   - Attaches X-Request-Id, X-RateLimit-* headers
   - On error: structured JSON { error: { code, message, requestId } }
```

### Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Invalid or expired authentication credentials",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "details": {}
  }
}
```

Standard error codes: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`RATE_LIMITED`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, `BAD_REQUEST`,
`INTERNAL_ERROR`.

### How to Add a New Endpoint

1. Create a route file, e.g. `app/api/v1/posts/route.ts`.
2. Import from the barrel: `import { createApiHandler, ok, accepted, enqueueJob } from "@/lib/api"`.
3. Define and export the handler:

```typescript
import { createApiHandler, ok } from "@/lib/api";

export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const { data } = await ctx.supabase!
      .from("artefacts")
      .select("*")
      .eq("tenant_id", ctx.membership!.tenantId);

    return ok({ artefacts: data }, ctx.requestId);
  },
});
```

4. For async/long-running work, use the 202 pattern:

```typescript
import { createApiHandler, accepted, enqueueJob } from "@/lib/api";

export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const { jobId } = await enqueueJob(
      ctx.membership!.tenantId,
      "generate_content",
      body
    );

    return accepted(
      { jobId, statusUrl: `/api/v1/jobs/${jobId}` },
      ctx.requestId
    );
  },
});
```

### Middleware Integration

API v1 routes (`/api/v1/*`) bypass the Supabase session middleware and handle
their own authentication via `authenticateRequest()`. This is configured in
`middleware.ts` with an early return for the `/api/v1` path prefix.

### API Routes

| Route                | Method | Auth     | Description          |
|----------------------|--------|----------|----------------------|
| `/api/v1/health`     | GET    | Public   | Health check         |
