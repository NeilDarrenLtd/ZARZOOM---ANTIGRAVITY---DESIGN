# ZARZOOM API & Architecture Reference

## Overview

ZARZOOM is a Next.js 15 (App Router) application using Supabase for authentication, database, and OAuth management. The application is structured into a public marketing site, a user-facing auth/dashboard flow, a protected admin panel, and a comprehensive REST API (`/api/v1/*`) that powers social publishing, AI content generation, research, billing, and administration.

All API v1 endpoints use a shared handler factory (`createApiHandler`) that provides authentication, tenant resolution, role enforcement, rate limiting, language resolution, request ID correlation, and structured error responses.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [API Routes -- Quick Reference](#2-api-routes--quick-reference)
3. [Request Lifecycle & Handler Factory](#3-request-lifecycle--handler-factory)
4. [Error Response Format](#4-error-response-format)
5. [Health](#5-health)
6. [Jobs (Background Work)](#6-jobs-background-work)
7. [Artefacts](#7-artefacts)
8. [Assets](#8-assets)
9. [Social Media](#9-social-media)
10. [Images](#10-images)
11. [Videos](#11-videos)
12. [Research](#12-research)
13. [Writing](#13-writing)
14. [Billing](#14-billing)
15. [Admin Settings](#15-admin-settings)
16. [Webhooks (Inbound)](#16-webhooks-inbound)
17. [Server Actions (Legacy / Admin UI)](#17-server-actions-legacy--admin-ui)
18. [Middleware & Route Protection](#18-middleware--route-protection)
19. [Supabase Client Setup](#19-supabase-client-setup)
20. [Database Schema](#20-database-schema)
21. [Shared Library Modules](#21-shared-library-modules)
22. [Environment Variables](#22-environment-variables)
23. [Application Routes Summary](#23-application-routes-summary)
24. [How to Add a New Endpoint](#24-how-to-add-a-new-endpoint)

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

### API v1 Authentication

All `/api/v1/*` routes (except public ones) authenticate via:

1. **Bearer token**: `Authorization: Bearer <supabase_access_token>`
2. **Session cookie**: Supabase session cookies from SSR

The handler factory calls `supabase.auth.getUser()` to validate the token.

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

### Multi-Tenant Context

After authentication, the handler resolves the user's **active tenant** via the `tenant_memberships` table. Multi-tenant users can specify `X-Tenant-Id` header to switch context.

---

## 2. API Routes -- Quick Reference

### Public Endpoints (no auth)

| Route                        | Method | Description                          |
|------------------------------|--------|--------------------------------------|
| `/api/v1/health`             | GET    | Health check                         |
| `/api/v1/billing/plans`      | GET    | List active subscription plans       |
| `/api/auth/providers`        | GET    | OAuth provider status (cached 60s)   |

### Authenticated Endpoints (Bearer token or session)

| Route                                           | Method | Role     | Description                                |
|-------------------------------------------------|--------|----------|--------------------------------------------|
| `/api/v1/jobs`                                  | GET    | member   | List jobs (cursor pagination, filters)     |
| `/api/v1/jobs/{job_id}`                         | GET    | member   | Job detail + output assets/artefact        |
| `/api/v1/artefacts/{artefact_id}`               | GET    | member   | Read a research/article/script artefact    |
| `/api/v1/assets/{asset_id}`                     | GET    | member   | Read an asset with media URL + TTL         |
| `/api/v1/billing/subscriptions`                 | GET    | viewer   | Current tenant subscription                |
| `/api/v1/social/profiles`                       | GET    | member   | List social profiles for tenant            |
| `/api/v1/social/profiles`                       | POST   | member   | Create a social profile                    |
| `/api/v1/social/profiles/{username}/connect`    | POST   | member   | Initiate OAuth connection for profile      |
| `/api/v1/social/posts/text`                     | POST   | member   | Publish text post                          |
| `/api/v1/social/posts/photo`                    | POST   | member   | Publish photo post                         |
| `/api/v1/social/posts/video`                    | POST   | member   | Publish video post                         |
| `/api/v1/social/posts/history`                  | GET    | member   | Paginated post history                     |
| `/api/v1/social/posts/{provider_job_id}/status` | GET    | member   | Post status by provider job ID             |
| `/api/v1/social/analytics/{username}`           | GET    | member   | Post analytics for a profile               |
| `/api/v1/images/generate`                       | POST   | member   | Generate image (OpenAI DALL-E / gpt-image) |
| `/api/v1/images/edit`                           | POST   | member   | Edit image with mask/background            |
| `/api/v1/videos/generate`                       | POST   | member   | Generate video (HeyGen/Kling/Veo 3)       |
| `/api/v1/research/social`                       | POST   | member   | Start social trend research                |
| `/api/v1/research/{job_id}`                     | GET    | member   | Read research job + artefact               |
| `/api/v1/writing/article`                       | POST   | member   | Generate article from research             |
| `/api/v1/writing/script`                        | POST   | member   | Generate timed video script                |
| `/api/v1/writing/{job_id}`                      | GET    | member   | Read writing job + artefact                |

### Admin Endpoints (admin role required)

| Route                                      | Method | Description                          |
|--------------------------------------------|--------|--------------------------------------|
| `/api/v1/admin/settings/keys`              | GET    | List provider API key metadata       |
| `/api/v1/admin/settings/keys`              | PUT    | Store/rotate encrypted provider key  |
| `/api/v1/admin/settings/language-default`  | GET    | Read tenant default language         |
| `/api/v1/admin/settings/language-default`  | PUT    | Update tenant default language       |
| `/api/v1/admin/prompts`                    | GET    | List prompt templates + versions     |
| `/api/v1/admin/prompts/{template_key}`     | PUT    | Create new prompt version            |
| `/api/v1/admin/prompts/test`               | POST   | Dry-run a prompt with test input     |

### Webhook Endpoints (token-in-URL auth)

| Route                              | Method | Auth Source                   | Description               |
|------------------------------------|--------|-------------------------------|---------------------------|
| `/api/v1/webhooks/uploadpost`      | POST   | `?token=` or `x-webhook-secret` | Upload-Post callbacks     |
| `/api/v1/webhooks/heygen`          | POST   | `?token=HEYGEN_WEBHOOK_TOKEN` | HeyGen video callbacks    |
| `/api/v1/webhooks/kling`           | POST   | `?token=KLING_WEBHOOK_TOKEN`  | Kling video callbacks     |
| `/api/v1/billing/webhook`          | POST   | Stripe signature              | Stripe subscription events|

---

## 3. Request Lifecycle & Handler Factory

Every request through `createApiHandler` follows this pipeline:

```
Incoming Request
  |
  v
1. Generate / inherit X-Request-Id
   (from request header or UUID v4)
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

### Handler Config Options

```typescript
createApiHandler({
  // Set to false for public endpoints (no auth check)
  auth?: boolean;          // default: true

  // Minimum role required (hierarchy: super_admin > admin > member > viewer)
  requiredRole?: "viewer" | "member" | "admin" | "super_admin";

  // Rate limit per tenant per endpoint
  rateLimit?: {
    maxRequests: number;   // e.g. 60
    windowMs: number;      // e.g. 60_000 (1 minute)
  };

  // The handler function
  handler: (ctx: ApiContext) => Promise<Response>;
});
```

### ApiContext

```typescript
interface ApiContext {
  req: NextRequest;
  requestId: string;
  user: User | null;
  supabase: SupabaseClient | null;
  membership: {
    tenantId: string;
    role: string;
  } | null;
  language: string;  // resolved BCP-47 code
}
```

---

## 4. Error Response Format

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

### Standard Error Codes

| Code               | HTTP Status | Description                                    |
|--------------------|-------------|------------------------------------------------|
| `AUTH_REQUIRED`    | 401         | Missing or invalid authentication              |
| `FORBIDDEN`        | 403         | Insufficient role/permissions                  |
| `NOT_FOUND`        | 404         | Resource not found                             |
| `CONFLICT`         | 409         | Duplicate or conflicting operation             |
| `RATE_LIMITED`     | 429         | Too many requests (check X-RateLimit-* headers)|
| `QUOTA_EXCEEDED`   | 429         | Subscription quota exhausted                   |
| `VALIDATION_ERROR` | 400         | Invalid request body (details has field errors)|
| `BAD_REQUEST`      | 400         | General bad request                            |
| `INTERNAL_ERROR`   | 500         | Unexpected server error                        |

---

## 5. Health

### `GET /api/v1/health`

Public health-check endpoint. No authentication required.

**Response:**

```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-02-14T12:00:00.000Z",
    "version": "1.0.0"
  },
  "requestId": "..."
}
```

---

## 6. Jobs (Background Work)

All async operations (image generation, video creation, social posting, research, writing) create a **job** in the `jobs` table and return 202 with a `job_id` and `status_url`. Poll the status URL to track progress.

### `GET /api/v1/jobs`

List jobs for the authenticated tenant with filtering and cursor pagination.

**Query Parameters:**

| Parameter        | Type   | Required | Description                                           |
|------------------|--------|----------|-------------------------------------------------------|
| `type`           | string | No       | Filter by job type (e.g. `image_generate`, `video_generate`, `research_social`) |
| `provider`       | string | No       | Filter by provider in payload (e.g. `openai`, `heygen`) |
| `status`         | string | No       | One of: `pending`, `scheduled`, `running`, `completed`, `failed`, `cancelled` |
| `created_after`  | string | No       | ISO 8601 datetime filter                              |
| `created_before` | string | No       | ISO 8601 datetime filter                              |
| `cursor`         | string | No       | UUID of last item for cursor pagination               |
| `limit`          | number | No       | 1-100, default 25                                     |

**Response:**

```json
{
  "data": {
    "jobs": [
      {
        "job_id": "uuid",
        "type": "image_generate",
        "provider": "openai",
        "status": "completed",
        "progress": 100,
        "attempt": 1,
        "max_attempts": 3,
        "created_at": "...",
        "updated_at": "...",
        "scheduled_for": null,
        "error": null
      }
    ],
    "pagination": {
      "limit": 25,
      "has_more": false,
      "next_cursor": null
    }
  },
  "requestId": "..."
}
```

### `GET /api/v1/jobs/{job_id}`

Returns full detail for a single job including expanded output assets and linked artefact.

**Response:**

```json
{
  "data": {
    "job_id": "uuid",
    "type": "image_generate",
    "provider": "openai",
    "status": "completed",
    "progress": 100,
    "priority": 0,
    "attempt": 1,
    "max_attempts": 3,
    "created_at": "...",
    "completed_at": "...",
    "error": null,
    "output_assets": [],
    "output_artefact": {
      "artefact_id": "uuid",
      "title": "...",
      "kind": "research",
      "language": "en",
      "created_at": "..."
    }
  },
  "requestId": "..."
}
```

---

## 7. Artefacts

Artefacts are structured outputs from research, article generation, or script generation jobs. They contain the full content JSONB.

### `GET /api/v1/artefacts/{artefact_id}`

Returns a stored research/article/script artefact with its full content. Tenant-isolated.

**Response:**

```json
{
  "data": {
    "artefact_id": "uuid",
    "title": "YouTube Trends: Fitness Niche Q1 2026",
    "kind": "research",
    "language": "en",
    "content": { ... },
    "source_job_id": "uuid",
    "created_at": "..."
  },
  "requestId": "..."
}
```

**Artefact Kinds:** `research`, `article`, `script`

---

## 8. Assets

Assets represent media files (images, videos) stored in the system. Currently backed by the `social_posts` table.

### `GET /api/v1/assets/{asset_id}`

Returns asset metadata with a media URL and TTL hint. In production, this would return a signed URL.

**Response:**

```json
{
  "data": {
    "asset_id": "uuid",
    "text_content": "...",
    "media_url": "https://...",
    "url_ttl_seconds": 300,
    "post_type": "photo",
    "status": "completed",
    "platforms": ["instagram"],
    "platform_results": { ... },
    "schedule_at": null,
    "created_at": "...",
    "updated_at": "..."
  },
  "requestId": "..."
}
```

---

## 9. Social Media

### Profiles

#### `POST /api/v1/social/profiles`

Create a new social profile. Enqueues a job for the worker to call Upload-Post's create-profile endpoint.

**Request Body:**

```json
{
  "profile_username": "mybrand"
}
```

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "status_url": "/api/v1/jobs/{job_id}"
  },
  "requestId": "..."
}
```

**Quota:** `social_profiles`

#### `GET /api/v1/social/profiles`

List all social profiles for the authenticated tenant.

**Response:**

```json
{
  "data": {
    "profiles": [
      {
        "id": "uuid",
        "profile_username": "mybrand",
        "provider_profile_id": "...",
        "status": "connected",
        "platforms": ["instagram", "twitter"],
        "connect_url": "...",
        "metadata": { ... },
        "created_at": "...",
        "updated_at": "..."
      }
    ]
  },
  "requestId": "..."
}
```

#### `POST /api/v1/social/profiles/{username}/connect`

Initiate an OAuth-style connection for a social profile. Enqueues a job to generate a connect URL via Upload-Post.

**Request Body:**

```json
{
  "redirect_url": "https://app.zarzoom.com/dashboard/social"
}
```

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "status_url": "/api/v1/jobs/{job_id}"
  },
  "requestId": "..."
}
```

### Publishing

All publish endpoints validate via Zod, check entitlements/quota, create a `social_posts` row, enqueue a job for the Upload-Post worker, and return 202.

#### `POST /api/v1/social/posts/text`

**Request Body:**

```json
{
  "profile_username": "mybrand",
  "platforms": ["twitter", "linkedin"],
  "text": "Exciting news! We just launched...",
  "schedule_at": "2026-03-01T10:00:00Z",
  "timezone": "Europe/London",
  "callback_url": "https://myapp.com/webhook/social"
}
```

| Field              | Type     | Required | Description                                                    |
|--------------------|----------|----------|----------------------------------------------------------------|
| `profile_username` | string   | Yes      | The profile to post from                                       |
| `platforms`        | string[] | Yes      | Target platforms: `twitter`, `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `pinterest`, `threads` |
| `text`             | string   | Yes      | Post content (1-5000 chars)                                    |
| `schedule_at`      | string   | No       | ISO 8601 datetime for scheduled publishing                     |
| `timezone`         | string   | No       | IANA timezone (e.g. `Europe/London`)                           |
| `callback_url`     | string   | No       | URL to receive completion webhook                              |

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "post_id": "uuid",
    "status_url": "/api/v1/social/posts/{provider_job_id}/status"
  },
  "requestId": "..."
}
```

#### `POST /api/v1/social/posts/photo`

Same as text post, plus:

| Field            | Type   | Required | Description                              |
|------------------|--------|----------|------------------------------------------|
| `image_asset_id` | string | One of   | UUID of a previously stored image asset  |
| `image_url`      | string | One of   | Public URL of the image                  |

Either `image_asset_id` or `image_url` must be provided.

#### `POST /api/v1/social/posts/video`

Same as text post, plus:

| Field            | Type   | Required | Description                              |
|------------------|--------|----------|------------------------------------------|
| `video_asset_id` | string | One of   | UUID of a previously stored video asset  |
| `video_url`      | string | One of   | Public URL of the video                  |

Either `video_asset_id` or `video_url` must be provided.

### Post History & Status

#### `GET /api/v1/social/posts/history`

Paginated list of published/scheduled posts for a profile.

**Query Parameters:**

| Parameter          | Type   | Required | Default | Description             |
|--------------------|--------|----------|---------|-------------------------|
| `profile_username` | string | Yes      | --      | Profile to query        |
| `page`             | number | No       | 1       | Page number             |
| `limit`            | number | No       | 25      | Items per page (1-100)  |

**Response:**

```json
{
  "data": {
    "posts": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 142,
      "total_pages": 6
    }
  },
  "requestId": "..."
}
```

#### `GET /api/v1/social/posts/{provider_job_id}/status`

Returns the current status of a social post by its Upload-Post provider job ID. Also joins the internal job row for context.

**Response:**

```json
{
  "data": {
    "post_id": "uuid",
    "provider_job_id": "...",
    "post_type": "text",
    "status": "completed",
    "platforms": ["twitter"],
    "platform_results": { ... },
    "error": null,
    "job": {
      "job_id": "uuid",
      "status": "completed",
      "attempt": 1,
      "max_attempts": 3,
      "error": null,
      "updated_at": "..."
    },
    "created_at": "...",
    "updated_at": "..."
  },
  "requestId": "..."
}
```

### Analytics

#### `GET /api/v1/social/analytics/{profile_username}`

Returns aggregated post analytics for a profile.

**Query Parameters:**

| Parameter   | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `platforms` | string | No       | Comma-separated filter (e.g. `twitter,instagram`) |

**Response:**

```json
{
  "data": {
    "profile_username": "mybrand",
    "profile_status": "connected",
    "total_posts": 85,
    "by_status": { "completed": 80, "failed": 3, "scheduled": 2 },
    "by_type": { "text": 40, "photo": 30, "video": 15 },
    "by_platform": { "twitter": 60, "instagram": 45, "linkedin": 20 },
    "connected_platforms": ["twitter", "instagram", "linkedin"],
    "metadata": { ... }
  },
  "requestId": "..."
}
```

---

## 10. Images

### `POST /api/v1/images/generate`

Generate images using OpenAI DALL-E / gpt-image-1. Validates input, checks quota, enqueues a job, and returns 202.

**Request Body:**

```json
{
  "prompt": "A futuristic city skyline at sunset",
  "model": "gpt-image-1",
  "size": "1024x1024",
  "quality": "high",
  "n": 2,
  "language": "en",
  "callback_url": "https://myapp.com/webhook/image"
}
```

| Field          | Type   | Required | Default         | Description                         |
|----------------|--------|----------|-----------------|-------------------------------------|
| `prompt`       | string | Yes      | --              | Image generation prompt (1-4000)    |
| `model`        | string | No       | `gpt-image-1`   | `gpt-image-1`, `dall-e-3`, `dall-e-2` |
| `size`         | string | No       | `auto`          | `1024x1024`, `1536x1024`, `1024x1536`, `256x256`, `512x512`, `auto` |
| `quality`      | string | No       | `auto`          | `auto`, `high`, `medium`, `low`, `standard`, `hd` |
| `n`            | number | No       | 1               | Number of images (1-4)              |
| `language`     | string | No       | tenant default  | Language hint for text labels       |
| `callback_url` | string | No       | --              | Webhook for completion notification |

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "status_url": "/api/v1/jobs/{job_id}"
  },
  "requestId": "..."
}
```

**Quota metric:** `image_generations` (incremented by `n`)

### `POST /api/v1/images/edit`

Edit an existing image with a prompt, optional mask, and background settings.

**Request Body:**

```json
{
  "prompt": "Remove the background and replace with mountains",
  "model": "gpt-image-1",
  "image_asset_id": "uuid-of-source-image",
  "mask_asset_id": "uuid-of-mask-image",
  "background": "transparent",
  "input_fidelity": "high",
  "language": "en",
  "callback_url": "https://myapp.com/webhook/image"
}
```

| Field            | Type   | Required | Default       | Description                            |
|------------------|--------|----------|---------------|----------------------------------------|
| `prompt`         | string | Yes      | --            | Edit instruction (1-4000)              |
| `model`          | string | No       | `gpt-image-1` | `gpt-image-1`, `dall-e-2`             |
| `image_asset_id` | string | Yes      | --            | UUID of the source image asset         |
| `mask_asset_id`  | string | No       | --            | UUID of the mask image                 |
| `background`     | string | No       | --            | `transparent`, `opaque`, `auto`        |
| `input_fidelity` | string | No       | --            | `high`, `low`, `auto`                  |
| `language`       | string | No       | tenant default| Language hint for text labels           |
| `callback_url`   | string | No       | --            | Webhook for completion notification    |

**Quota metric:** `image_edits`

---

## 11. Videos

### `POST /api/v1/videos/generate`

Generate videos using one of three providers: HeyGen, Kling, or Veo 3. Supports optional script artefact input.

**Request Body:**

```json
{
  "provider": "heygen",
  "prompt": "An explainer about our new product features",
  "language": "en",
  "duration_seconds": 60,
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "script_artefact_id": "uuid-of-script-artefact",
  "heygen": {
    "mode": "avatar",
    "avatar_id": "avatar_abc123",
    "voice_id": "voice_xyz789"
  },
  "callback_url": "https://myapp.com/webhook/video"
}
```

| Field                | Type   | Required | Default | Description                                       |
|----------------------|--------|----------|---------|---------------------------------------------------|
| `provider`           | string | Yes      | --      | `heygen`, `kling`, or `veo3`                      |
| `prompt`             | string | Yes      | --      | Video generation prompt (1-4000)                  |
| `language`           | string | No       | tenant  | Content language                                  |
| `duration_seconds`   | number | No       | --      | Desired video duration (1-300)                    |
| `aspect_ratio`       | string | No       | `16:9`  | `16:9`, `9:16`, `1:1`                            |
| `resolution`         | string | No       | --      | e.g. `1080p`, `4k`                               |
| `script_artefact_id` | string | No       | --      | UUID of a script artefact to use as input         |
| `callback_url`       | string | No       | --      | Webhook for completion notification               |

**Provider-Specific Options:**

| Provider | Option Object | Fields                                              |
|----------|---------------|-----------------------------------------------------|
| HeyGen   | `heygen`      | `mode` (`video_agent` or `avatar`), `avatar_id`, `voice_id` |
| Kling    | `kling`       | `image_asset_id` (UUID), `motion_prompt` (string)   |
| Veo 3    | `veo3`        | `input_image_asset_id` (UUID), `gcs_output_prefix`  |

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "provider": "heygen",
    "status_url": "/api/v1/jobs/{job_id}"
  },
  "requestId": "..."
}
```

**Quota metric:** `video_heygen`, `video_kling`, or `video_veo3` (per provider)

---

## 12. Research

### `POST /api/v1/research/social`

Creates an async research job powered by OpenRouter. Performs social media trend analysis on YouTube and/or X (Twitter).

**Request Body:**

```json
{
  "platform": "youtube",
  "niche": "home fitness equipment",
  "seed_keywords": ["resistance bands", "pull-up bar", "kettlebell"],
  "geo": "US",
  "timeframe": "7d",
  "language": "en",
  "callback_url": "https://myapp.com/webhook/research"
}
```

| Field           | Type     | Required | Default | Description                              |
|-----------------|----------|----------|---------|------------------------------------------|
| `platform`      | string   | Yes      | --      | `youtube`, `x`, or `both`               |
| `niche`         | string   | Yes      | --      | Topic/niche to research (1-500)         |
| `seed_keywords` | string[] | No       | []      | Up to 20 seed keywords                  |
| `geo`           | string   | No       | --      | Country/region code (e.g. `US`, `GB`)   |
| `timeframe`     | string   | No       | `7d`    | `24h`, `7d`, `30d`, `90d`              |
| `language`      | string   | No       | tenant  | Content language                        |
| `callback_url`  | string   | No       | --      | Webhook for completion notification     |

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "status_url": "/api/v1/jobs/{job_id}",
    "artefact_url": "/api/v1/research/{job_id}"
  },
  "requestId": "..."
}
```

**Quota metric:** `research_social`

### `GET /api/v1/research/{job_id}`

Returns the research job status and, if complete, the full research artefact.

**Response (when complete):**

```json
{
  "data": {
    "job": {
      "id": "uuid",
      "status": "completed",
      "type": "research_social",
      "error": null,
      "created_at": "...",
      "updated_at": "..."
    },
    "artefact": {
      "artefact_id": "uuid",
      "title": "YouTube Fitness Trends",
      "kind": "research",
      "content": { ... },
      "language": "en",
      "created_at": "..."
    }
  },
  "requestId": "..."
}
```

---

## 13. Writing

### `POST /api/v1/writing/article`

Generate an article from research context. Can reference a previous research job or provide a summary directly.

**Request Body:**

```json
{
  "research_job_id": "uuid-of-research-job",
  "research_summary": { ... },
  "title_preferences": {
    "include": ["Top 10", "Best"],
    "avoid": ["Clickbait"]
  },
  "hashtags": ["#fitness", "#homeworkout"],
  "audience": "Health-conscious millennials aged 25-35",
  "language": "en",
  "callback_url": "https://myapp.com/webhook/article"
}
```

| Field                | Type     | Required | Default | Description                               |
|----------------------|----------|----------|---------|-------------------------------------------|
| `research_job_id`    | string   | No       | --      | UUID of a completed research job          |
| `research_summary`   | object   | No       | --      | Direct research context (skip job lookup) |
| `title_preferences`  | object   | No       | --      | `include`: preferred words, `avoid`: words to avoid |
| `hashtags`           | string[] | No       | []      | Up to 30 hashtags to include              |
| `audience`           | string   | No       | --      | Target audience description (max 500)     |
| `language`           | string   | No       | tenant  | Content language                          |
| `callback_url`       | string   | No       | --      | Webhook for completion                    |

**Quota metric:** `generate_article`

### `POST /api/v1/writing/script`

Generate a timed video script suitable for TikTok, Reels, or YouTube Shorts. Can reference a previous article job.

**Request Body:**

```json
{
  "article_job_id": "uuid-of-article-job",
  "article_text": "...",
  "hashtags": ["#fitness"],
  "duration_seconds": 30,
  "platform": "tiktok",
  "language": "en",
  "callback_url": "https://myapp.com/webhook/script"
}
```

| Field              | Type     | Required | Default | Description                                   |
|--------------------|----------|----------|---------|-----------------------------------------------|
| `article_job_id`   | string   | No       | --      | UUID of a completed article job               |
| `article_text`     | string   | No       | --      | Direct article text (max 50,000)              |
| `hashtags`         | string[] | No       | []      | Up to 30 hashtags                             |
| `duration_seconds` | number   | Yes      | --      | Must be exactly `10`, `20`, or `30`           |
| `platform`         | string   | No       | --      | `tiktok`, `reels`, or `youtube_shorts`        |
| `language`         | string   | No       | tenant  | Content language                              |
| `callback_url`     | string   | No       | --      | Webhook for completion                        |

**Quota metric:** `generate_script`

### `GET /api/v1/writing/{job_id}`

Returns the writing job status and, if complete, the article or script artefact. Same response shape as `GET /api/v1/research/{job_id}` but artefact kinds are `article` or `script`.

---

## 14. Billing

### `GET /api/v1/billing/plans`

**Public** -- Returns active subscription plans with prices. No authentication required.

**Response:**

```json
{
  "data": {
    "plans": [
      {
        "id": "uuid",
        "name": "Pro",
        "slug": "pro",
        "description": "...",
        "quota_policy": { ... },
        "prices": [ ... ]
      }
    ]
  },
  "requestId": "..."
}
```

### `GET /api/v1/billing/subscriptions`

Returns the authenticated user's tenant subscription.

**Response:**

```json
{
  "data": {
    "subscription": {
      "id": "uuid",
      "status": "active",
      "plan_id": "uuid",
      "stripe_subscription_id": "sub_...",
      "current_period_start": "...",
      "current_period_end": "...",
      "cancel_at_period_end": false
    }
  },
  "requestId": "..."
}
```

---

## 15. Admin Settings

All admin endpoints require the `admin` role and write to the `admin_audit` table.

### Provider API Keys

#### `GET /api/v1/admin/settings/keys`

List provider API key metadata for the tenant. **Never returns ciphertext or plaintext values** -- only fingerprints and status.

**Response:**

```json
{
  "data": {
    "keys": [
      {
        "provider": "openai",
        "key_name": "OPENAI_API_KEY",
        "is_set": true,
        "key_fingerprint": "a1b2c3...",
        "rotated_at": "2026-02-01T...",
        "active": true
      }
    ]
  },
  "requestId": "..."
}
```

**Supported providers:** `uploadpost`, `openai`, `heygen`, `kling`, `veo3`, `openrouter`

#### `PUT /api/v1/admin/settings/keys`

Store or rotate an encrypted provider key. Uses AES-256-GCM encryption with the `ENCRYPTION_MASTER_KEY` environment variable.

**Request Body:**

```json
{
  "provider": "openai",
  "key_name": "OPENAI_API_KEY",
  "plaintext_value": "sk-...",
  "make_active": true
}
```

| Field             | Type    | Required | Default | Description                              |
|-------------------|---------|----------|---------|------------------------------------------|
| `provider`        | string  | Yes      | --      | Provider enum (see above)                |
| `key_name`        | string  | Yes      | --      | Key identifier                           |
| `plaintext_value` | string  | Yes      | --      | The API key to encrypt and store         |
| `make_active`     | boolean | No       | true    | Deactivate previous key for this slot    |

### Default Language

#### `GET /api/v1/admin/settings/language-default`

Returns the tenant's default content language.

**Response:**

```json
{
  "data": {
    "default_language": "en",
    "tenant_id": "uuid"
  },
  "requestId": "..."
}
```

#### `PUT /api/v1/admin/settings/language-default`

Update the tenant's default content language.

**Request Body:**

```json
{
  "default_language": "es"
}
```

Must be a valid BCP-47 / ISO language code (e.g. `en`, `es`, `fr`, `de`, `pt-BR`).

### Prompt Templates

#### `GET /api/v1/admin/prompts`

List all prompt templates with their active version and version history. Resolves tenant-scoped overrides first, then falls back to global defaults.

**Response:**

```json
{
  "data": {
    "templates": [
      {
        "template_key": "research_social",
        "template": {
          "template_id": "uuid",
          "name": "Social Research",
          "description": "...",
          "is_active": true,
          "active_version_id": "uuid"
        },
        "active_version": {
          "version_id": "uuid",
          "version_number": 3,
          "system_prompt": "You are a research analyst...",
          "user_prompt_template": "Research {{niche}} trends on {{platform}}...",
          "output_schema": { ... },
          "is_active": true,
          "created_at": "..."
        },
        "versions": [
          { "version_id": "...", "version_number": 3, "is_active": true, "created_at": "..." },
          { "version_id": "...", "version_number": 2, "is_active": false, "created_at": "..." }
        ],
        "is_tenant_override": true
      }
    ]
  },
  "requestId": "..."
}
```

**Template keys:** `research_social`, `generate_article`, `generate_script`

#### `PUT /api/v1/admin/prompts/{template_key}`

Create a new version of a prompt template. Never overwrites historical versions.

**Request Body:**

```json
{
  "name": "Social Research v2",
  "description": "Improved trend analysis prompt",
  "system_prompt": "You are a social media research analyst...",
  "user_prompt_template": "Analyze {{platform}} trends for {{niche}} over {{timeframe}}...",
  "output_schema": { "type": "object", ... },
  "activate": true
}
```

| Field                  | Type    | Required | Default | Description                                |
|------------------------|---------|----------|---------|--------------------------------------------|
| `name`                 | string  | No       | --      | Template display name                      |
| `description`          | string  | No       | --      | Template description                       |
| `system_prompt`        | string  | Yes      | --      | System prompt text (1-50,000)              |
| `user_prompt_template` | string  | Yes      | --      | User prompt with `{{variable}}` placeholders (1-50,000) |
| `output_schema`        | object  | No       | --      | JSON Schema for structured output          |
| `activate`             | boolean | No       | false   | Set this version as the active version     |

**Valid template_key values:** `research_social`, `generate_article`, `generate_script`

#### `POST /api/v1/admin/prompts/test`

Dry-run a prompt template with test input variables. Enqueues a `prompt_test` job that uses OpenRouter. Test results are ephemeral and excluded from public artefact lists.

**Request Body:**

```json
{
  "template_key": "research_social",
  "test_input_json": {
    "platform": "youtube",
    "niche": "home fitness",
    "timeframe": "7d"
  },
  "language": "en"
}
```

| Field             | Type   | Required | Default | Description                                |
|-------------------|--------|----------|---------|--------------------------------------------|
| `template_key`    | string | Yes      | --      | One of the valid template keys             |
| `test_input_json` | object | Yes      | --      | Key-value pairs to fill template variables |
| `language`        | string | No       | tenant  | Language for the test run                  |

**Response (202):**

```json
{
  "data": {
    "job_id": "uuid",
    "template_key": "research_social",
    "version_id": "uuid",
    "status_url": "/api/v1/jobs/{job_id}",
    "note": "Test results are ephemeral and will not appear in public artefact lists."
  },
  "requestId": "..."
}
```

---

## 16. Webhooks (Inbound)

All inbound webhooks use token-based authentication (not Supabase user auth) and SHA-256 payload deduplication via the `social_webhook_events` table.

### `POST /api/v1/webhooks/uploadpost`

Receives webhook events from Upload-Post for social post status updates.

**Auth:** `?token=UPLOADPOST_WEBHOOK_SECRET` or `x-webhook-secret` header

**Payload:**

```json
{
  "event": "post.completed",
  "job_id": "provider-job-id",
  "status": "completed",
  "data": { ... },
  "error": null
}
```

**Behaviour:** Maps provider status to internal status (`completed`, `failed`, `running`, `pending`, `scheduled`, `cancelled`), updates both `social_posts` and `jobs` tables.

### `POST /api/v1/webhooks/heygen`

Receives HeyGen video generation status callbacks.

**Auth:** `?token=HEYGEN_WEBHOOK_TOKEN`

**Payload:**

```json
{
  "event_type": "video.completed",
  "data": {
    "video_id": "...",
    "status": "completed",
    "video_url": "https://...",
    "callback_id": "...",
    "error": null
  }
}
```

**HeyGen event mapping:**

| HeyGen Event            | Internal Status |
|-------------------------|-----------------|
| `video.completed`       | `succeeded`     |
| `video.success`         | `succeeded`     |
| `avatar_video.success`  | `succeeded`     |
| `video.failed`          | `failed`        |
| `avatar_video.failed`   | `failed`        |
| `video.processing`      | `running`       |

### `POST /api/v1/webhooks/kling`

Receives Kling video generation status callbacks. Only active if the tenant's plan supports Kling callbacks; otherwise the worker relies on polling.

**Auth:** `?token=KLING_WEBHOOK_TOKEN`

**Payload:**

```json
{
  "task_id": "kling-task-id",
  "status": "completed",
  "video_url": "https://...",
  "error_message": null
}
```

### `POST /api/v1/billing/webhook`

Stripe webhook handler. Processes subscription lifecycle events.

**Auth:** Stripe signature verification via `STRIPE_WEBHOOK_SECRET`

**Handled events:**

| Stripe Event                       | Action                              |
|------------------------------------|-------------------------------------|
| `customer.subscription.created`    | Create/update tenant subscription   |
| `customer.subscription.updated`    | Update subscription status/dates    |
| `customer.subscription.deleted`    | Mark subscription as canceled       |
| `invoice.payment_failed`           | Mark subscription as past_due       |

---

## 17. Server Actions (Legacy / Admin UI)

All server actions are defined in `app/auth/actions.ts` and `app/admin/actions.ts` using the `"use server"` directive. These power the admin panel UI.

### User Auth Actions (`app/auth/actions.ts`)

| Action                             | Parameters                       | Returns                          |
|------------------------------------|----------------------------------|----------------------------------|
| `signInWithEmail(email, password)` | email, password                  | `{ success }` or `{ error }`    |
| `signUpWithEmail(email, password)` | email, password                  | `{ success }` or `{ error }`    |
| `signInWithOAuth(provider)`        | `google\|facebook\|twitter\|linkedin_oidc` | `{ url }` or `{ error }` |
| `resendVerificationEmail(email)`   | email                            | `{ success }` or `{ error }`    |
| `signInAdmin(email, password)`     | email, password                  | `{ success }` or `{ error }`    |

### Admin Actions (`app/admin/actions.ts`)

All call `requireAdmin()` internally.

| Action                          | Description                                    |
|---------------------------------|------------------------------------------------|
| `getSettings(prefix)`           | Read site_settings filtered by key prefix      |
| `saveSettings(entries)`         | Upsert site settings (skips empty encrypted)   |
| `configureSupabaseOAuthProvider(...)` | Configure OAuth provider via Supabase Management API |
| `getSupabaseOAuthStatus()`      | Read current OAuth provider configuration      |
| `sendTestEmail(recipientEmail)` | Send SMTP test email                           |
| `getUsers()`                    | List all user profiles                         |
| `updateUserRole(userId, isAdmin)` | Toggle admin status for a user               |
| `getEnabledProviders()`         | Check which OAuth providers are enabled        |

---

## 18. Middleware & Route Protection

### Protected Routes

| Route Pattern       | Protection Level | Redirect if Unauthorized |
|---------------------|------------------|--------------------------|
| `/dashboard/*`      | Authenticated    | `/auth`                  |
| `/admin/*`          | Admin            | `/admin/login`           |
| `/admin/login`      | Public           | N/A                      |
| `/api/v1/*`         | Self-managed     | N/A (returns 401 JSON)   |
| All other routes    | Public           | N/A                      |

### Middleware Behaviour

1. **Public routes** skip Supabase auth entirely (no performance overhead).
2. **`/dashboard`** routes require an authenticated user; unauthenticated users are redirected to `/auth`.
3. **`/admin`** routes (except `/admin/login`) require an authenticated user; unauthenticated users go to `/admin/login`.
4. Authenticated non-admin users on `/admin` routes are redirected to `/dashboard`.
5. Admin check in middleware uses `user_metadata.is_admin` (JWT claim, no DB query).
6. **`/api/v1`** routes bypass session middleware entirely and handle their own authentication via `authenticateRequest()` in the handler factory.

### Matcher Pattern

```
/((?!_next/static|_next/image|favicon.ico|sequence|images|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

Static assets, images, and Next.js internal routes are excluded.

---

## 19. Supabase Client Setup

### Browser Client (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'
createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

Used in client components (`"use client"`).

### Server Client (`lib/supabase/server.ts`)

| Function             | Key Used              | Purpose                              |
|----------------------|-----------------------|--------------------------------------|
| `createClient()`     | `ANON_KEY`            | Standard server-side operations       |
| `createAdminClient()`| `SERVICE_ROLE_KEY`    | Bypass RLS for admin operations       |

Both use `@supabase/ssr` with cookie-based session management.

---

## 20. Database Schema

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

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `tenant_memberships`        | Maps users to tenants with roles (`super_admin`, `admin`, `member`, `viewer`) |
| `tenant_settings`           | Per-tenant configuration (e.g. `default_language`) |
| `tenant_subscriptions`      | Billing subscriptions per tenant (Stripe integration) |
| `subscription_plans`        | Available plans (public read)             |
| `plan_prices`               | Pricing per plan/interval (public read)   |
| `billing_usage_counters`    | Usage tracking per billing period         |
| `usage_counters`            | General usage metrics per tenant          |

### AI / Content Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `jobs`                      | Background job queue (all async operations) |
| `artefacts`                 | Generated content (research, articles, scripts) with kind, content JSONB, source_job_id |
| `prompt_templates`          | AI prompt templates with tenant override support |
| `prompt_template_versions`  | Versioned prompt template content (system_prompt, user_prompt_template, output_schema) |
| `provider_secrets`          | AES-256-GCM encrypted API keys per provider |
| `provider_secrets_metadata` | Non-sensitive key metadata view (no ciphertext) |

### Social Media Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `social_profiles`           | Connected social media accounts (via Upload-Post) |
| `social_posts`              | Scheduled/published social posts with platform results |
| `social_webhook_events`     | Incoming webhook events with SHA-256 dedup |

### Infrastructure Tables

| Table                       | Purpose                                   |
|-----------------------------|-------------------------------------------|
| `admin_audit`               | Admin action audit log (who, what, when)  |
| `idempotency_keys`          | Prevents duplicate job processing         |
| `rate_limits`               | Request rate limiting counters per tenant/endpoint |

---

## 21. Shared Library Modules

### `lib/api/` -- Service Layer

| Module              | File                    | Responsibility                                                        |
|---------------------|-------------------------|-----------------------------------------------------------------------|
| Environment         | `lib/api/env.ts`        | Zod-validated, typed access to required env vars. Fails fast on boot. |
| Request ID          | `lib/api/request-id.ts` | Generates or inherits `X-Request-Id` correlation IDs.                 |
| HTTP Responses      | `lib/api/http-responses.ts` | Standardised JSON response helpers (`ok`, `created`, `accepted`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `serverError`). |
| Errors              | `lib/api/errors.ts`     | Typed error classes (`ApiError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `QuotaExceededError`, `ValidationError`). |
| Authentication      | `lib/api/auth.ts`       | Extracts Bearer token or session cookies, calls `supabase.auth.getUser()`. |
| Tenancy             | `lib/api/tenancy.ts`    | Resolves the user's active tenant via `tenant_memberships` table. Supports `X-Tenant-Id` header. |
| Roles               | `lib/api/roles.ts`      | Role hierarchy check (`super_admin > admin > member > viewer`).       |
| Rate Limiting       | `lib/api/rate-limit.ts` | Sliding-window counter using the `rate_limits` table.                 |
| Idempotency         | `lib/api/idempotency.ts`| Deduplication via `idempotency_keys` table with response replay.      |
| Quotas              | `lib/api/quotas.ts`     | Usage tracking via `billing_usage_counters` + `subscription_plans.quota_policy`. |
| Job Queue           | `lib/api/queue.ts`      | Enqueues background work into the `jobs` table.                       |
| Language            | `lib/api/language.ts`   | Resolves `?lang=` > `Accept-Language` > tenant default > `"en"`.      |
| Handler Factory     | `lib/api/handler.ts`    | `createApiHandler()` -- wires all cross-cutting concerns together.    |
| Barrel Export       | `lib/api/index.ts`      | Re-exports everything for clean imports: `import { ... } from "@/lib/api"`. |

### `lib/social/` -- Social Media

| File                   | Exports                                                              |
|------------------------|----------------------------------------------------------------------|
| `schemas.ts`           | Zod schemas: `createProfileSchema`, `connectProfileSchema`, `textPostSchema`, `photoPostSchema`, `videoPostSchema`, `historyQuerySchema`, `analyticsQuerySchema`, `webhookPayloadSchema` |
| `config.ts`            | Upload-Post configuration (`uploadPostConfig()`)                     |
| `publish.ts`           | `publishPost()` -- shared logic for text/photo/video post creation   |

### `lib/images/` -- Image Generation

| File          | Exports                                              |
|---------------|------------------------------------------------------|
| `schemas.ts`  | `imageGenerateSchema`, `imageEditSchema` (Zod)       |

### `lib/videos/` -- Video Generation

| File          | Exports                                                                    |
|---------------|----------------------------------------------------------------------------|
| `schemas.ts`  | `videoGenerateSchema`, `heygenWebhookSchema`, `klingWebhookSchema` (Zod)  |

### `lib/research/` -- Research & Writing

| File          | Exports                                                                    |
|---------------|----------------------------------------------------------------------------|
| `schemas.ts`  | `researchSocialSchema`, `writeArticleSchema`, `writeScriptSchema` (Zod)   |
| `prompts.ts`  | `resolvePromptTemplate()` -- queries `prompt_templates` + `prompt_template_versions` with tenant-override-first fallback to global defaults |

### `lib/admin/` -- Admin Settings

| File            | Exports                                                                |
|-----------------|------------------------------------------------------------------------|
| `schemas.ts`    | `providerEnum`, `putKeySchema`, `templateKeyEnum`, `putPromptSchema`, `testPromptSchema`, `putLanguageSchema` |
| `encryption.ts` | `encryptSecret()`, `decryptSecret()`, `keyFingerprint()` -- AES-256-GCM encryption with IV-prefixed ciphertext |
| `audit.ts`      | `writeAuditLog()` -- writes to `admin_audit` table                     |

### `lib/billing/` -- Billing

| File          | Exports                                                          |
|---------------|------------------------------------------------------------------|
| `queries.ts`  | `getPlans()`, `getTenantSubscription()` -- Supabase queries      |

---

## 22. Environment Variables

### Required

| Variable                         | Description                               |
|----------------------------------|-------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anonymous/public key             |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service role key (server-only)   |

### Optional (API Features)

| Variable                         | Description                                       |
|----------------------------------|---------------------------------------------------|
| `ENCRYPTION_MASTER_KEY`          | 64-char hex (32 bytes) for AES-256-GCM provider key encryption |
| `SITE_URL`                       | Explicit site URL (default: `http://localhost:3000`) |
| `SUPABASE_ACCESS_TOKEN`          | Supabase Management API token (for OAuth config)  |
| `STRIPE_SECRET_KEY`              | Stripe secret key for billing                     |
| `STRIPE_WEBHOOK_SECRET`          | Stripe webhook signature verification             |
| `UPLOADPOST_API_KEY`             | Upload-Post API key                               |
| `UPLOADPOST_WEBHOOK_SECRET`      | Upload-Post webhook verification token            |
| `HEYGEN_WEBHOOK_TOKEN`           | HeyGen webhook verification token                 |
| `KLING_WEBHOOK_TOKEN`            | Kling webhook verification token                  |

### Vercel Auto-Set Variables

| Variable                              | Description                               |
|---------------------------------------|-------------------------------------------|
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

## 23. Application Routes Summary

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

## 24. How to Add a New Endpoint

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

5. For admin-only endpoints, set `requiredRole: "admin"` and use `writeAuditLog()` from `@/lib/admin`.

6. For webhook endpoints, skip `createApiHandler` and export a raw `POST` function with token verification and SHA-256 deduplication (see existing webhook routes for patterns).

---

## 25. Queue Integration

The queue integration decouples **Vercel route handlers** (producers) from an
**external Worker** (consumer). Vercel never executes provider calls directly;
it enqueues a signed message and returns `202 Accepted`.

### Architecture

```
Vercel Route Handler                    External Worker
       |                                     |
       | 1. Insert row into `jobs` table      |
       | 2. Sign message (HMAC-SHA256)        |
       | 3. POST to QUEUE_PUSH_URL (optional) |
       |------------------------------------->|
       |                                      | 4. Verify signature
       | <-- 202 { jobId, statusUrl } -----   | 5. Process job
       |                                      | 6. Update `jobs` row
```

**Transport modes:**

| Mode       | How it works | When to use |
|------------|-------------|-------------|
| HTTP Push  | Vercel POSTs message to `QUEUE_PUSH_URL` after DB insert. Worker receives HTTP requests. | Recommended for Vercel. Best with services like QStash, Inngest, or custom HTTP endpoint. Built-in retries and signatures. |
| DB Poll    | No `QUEUE_PUSH_URL` set. Worker polls the `jobs` table for `status = 'pending'` rows. | Alternative if you want deeper DLQ primitives or use SQS-style queues. |

Both modes persist jobs to the `jobs` table first, so the DB is always the source of truth.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QUEUE_SIGNING_SECRET` | No (falls back to `SUPABASE_SERVICE_ROLE_KEY`) | HMAC-SHA256 secret shared between Vercel and Worker. Dedicated key recommended in production. |
| `QUEUE_PUSH_URL` | No | HTTP endpoint to POST messages to. When unset, operates in pull/poll mode. |

### Queue Message Contract

Every message (whether pushed via HTTP or read from the `jobs` table) follows this exact schema:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "social.post.publish",
  "attempt": 0,
  "scheduled_for": "2026-02-14T12:00:00.000Z",
  "enqueued_at": "2026-02-14T12:00:00.000Z",
  "payload": {
    "post_id": "...",
    "profile_username": "acme",
    "text_content": "Hello world"
  },
  "max_attempts": 5,
  "priority": 100,
  "callback_url": null,
  "signature": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
}
```

#### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | UUID | Primary key in the `jobs` table. |
| `tenant_id` | UUID | Owning tenant. Used for isolation and quota tracking. |
| `type` | string | Job type -- routes to the correct worker handler. Convention: `domain.entity.action`. |
| `attempt` | integer | Zero-indexed. Producer always sends `0`. Worker increments on retry. |
| `scheduled_for` | ISO-8601 | When the job should be processed. Equals `enqueued_at` for immediate jobs. Future for delayed jobs. |
| `enqueued_at` | ISO-8601 | When the message was first created. |
| `payload` | object | Opaque job data. Worker interprets based on `type`. Queue layer never inspects this. |
| `max_attempts` | integer | Maximum delivery attempts. After this, job status becomes `failed`. |
| `priority` | integer | Lower = higher priority. Default: 100. |
| `callback_url` | string or null | Optional URL the worker should POST results to on completion. |
| `signature` | string | HMAC-SHA256 of `job_id\|tenant_id\|type\|scheduled_for` using `QUEUE_SIGNING_SECRET`. |

### Message Signing

Messages are signed using HMAC-SHA256 to prevent forged messages from being processed.

**Canonical string:** `{job_id}|{tenant_id}|{type}|{scheduled_for}`

**Signing (Vercel producer):**
```typescript
import { createHmac } from "crypto";

const canonical = `${jobId}|${tenantId}|${type}|${scheduledFor}`;
const signature = createHmac("sha256", QUEUE_SIGNING_SECRET)
  .update(canonical)
  .digest("hex");
```

**Verification (Worker consumer):**
```typescript
import { verifyQueueSignature } from "@/lib/queue";

const isValid = verifyQueueSignature(
  message.job_id,
  message.tenant_id,
  message.type,
  message.scheduled_for,
  message.signature,
  QUEUE_SIGNING_SECRET
);

if (!isValid) {
  // Reject message -- potential forgery
}
```

Verification uses constant-time comparison (`timingSafeEqual`) to prevent timing attacks.

### Producer API

Import from `@/lib/queue`:

```typescript
import { enqueueNow, enqueueDelayed } from "@/lib/queue";
```

#### `enqueueNow(tenantId, type, payload, options?)`

Enqueue a job for immediate processing.

```typescript
const { jobId, status, message } = await enqueueNow(
  ctx.membership!.tenantId,
  "images.generate",
  { prompt: "A sunset over mountains", model: "gpt-image-1" }
);
// status === "pending"
```

#### `enqueueDelayed(tenantId, type, payload, options)`

Enqueue a job for future processing. Supports two modes:

```typescript
// Delay by milliseconds (e.g., poll in 30 seconds)
const result = await enqueueDelayed(
  tenantId,
  "social.post.poll",
  { post_id: "..." },
  { delayMs: 30_000 }
);

// Schedule for a specific time
const result = await enqueueDelayed(
  tenantId,
  "email.send",
  { template: "welcome" },
  { scheduledFor: new Date("2026-03-01T09:00:00Z") }
);
// status === "scheduled"
```

**Common delay patterns for polling:**

| Step | Delay | Use case |
|------|-------|----------|
| 1st poll | 30s | Fast check after initial submission |
| 2nd poll | 2m | Provider still processing |
| 3rd poll | 5m | Longer operations (video encoding) |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `priority` | number | 100 | Lower = higher priority |
| `callbackUrl` | string | null | URL to POST results to |
| `maxAttempts` | number | From `RETRY_DEFAULTS` | Override max retry attempts |
| `delayMs` | number | -- | Delay in ms (enqueueDelayed only) |
| `scheduledFor` | Date | -- | Absolute time (enqueueDelayed only) |

### Backward Compatibility

The existing `enqueueJob()` function from `@/lib/api` continues to work unchanged. It delegates to the new producer internally:

```typescript
// This still works -- no changes needed to existing route handlers
import { enqueueJob } from "@/lib/api";
const { jobId } = await enqueueJob(tenantId, "images.generate", payload);
```

### Retry Configuration

Retry config is defined per job type with exponential backoff:

| Job type prefix | Max attempts | Base delay | Max delay |
|----------------|-------------|-----------|----------|
| `default` | 3 | 5s | 5m |
| `social.post` | 5 | 10s | 10m |
| `images.generate` | 3 | 15s | 5m |
| `images.edit` | 3 | 15s | 5m |
| `videos.generate` | 3 | 30s | 10m |
| `research.social` | 3 | 10s | 5m |
| `writing.article` | 3 | 10s | 5m |
| `writing.script` | 3 | 10s | 5m |
| `prompt_test` | 1 | 0 | 0 |

**Backoff formula:** `delay = min(baseDelayMs * 2^attempt + jitter, maxDelayMs)`

Resolution order: exact match -> prefix match -> `default`.

```typescript
import { getRetryConfig, calculateBackoff } from "@/lib/queue";

const config = getRetryConfig("social.post.publish");
// Matches "social.post" prefix -> { maxAttempts: 5, baseDelayMs: 10_000, maxDelayMs: 600_000 }

const delay = calculateBackoff(2, config);
// ~40_000ms (10_000 * 2^2 + jitter)
```

### Worker Contract

The worker is an external service (not deployed on Vercel). It must:

1. **Receive messages** -- either via HTTP POST (push mode) or by polling the `jobs` table.
2. **Verify the signature** before processing (see Signing section above).
3. **Update the `jobs` row** on completion:
   - Success: `status = 'completed'`, `result = { ... }`
   - Failure: increment `attempt`, set `error`, re-enqueue with backoff delay if `attempt < max_attempts`, otherwise `status = 'failed'`.
4. **Lock the job** during processing: set `locked_by = worker_id`, `locked_until = now + timeout`.
5. **Call the callback URL** (if set) with the result on completion.
6. **Never modify the payload** -- it is immutable from the producer's perspective.

### Job Lifecycle

```
Producer (Vercel)                       Worker
     |                                    |
     | INSERT status=pending/scheduled    |
     |                                    |
     | POST message to QUEUE_PUSH_URL --> |
     |                                    | Verify signature
     |                                    | Lock job (locked_by, locked_until)
     |                                    | Process based on type + payload
     |                                    |
     |                            Success | UPDATE status=completed, result={...}
     |                                    | POST callback_url (if set)
     |                                    |
     |                            Failure | IF attempt < max_attempts:
     |                                    |   UPDATE attempt++, error=...
     |                                    |   Re-enqueue with backoff delay
     |                                    | ELSE:
     |                                    |   UPDATE status=failed, error=...
     |                                    |   POST callback_url with error
```

### Module Inventory

| File | Description |
|------|-------------|
| `lib/queue/types.ts` | Zod schema for `QueueMessage`, `RetryConfig`, `RETRY_DEFAULTS`, `getRetryConfig()`, `calculateBackoff()` |
| `lib/queue/signing.ts` | `signMessage()` and `verifyQueueSignature()` using HMAC-SHA256 |
| `lib/queue/producer.ts` | `enqueueNow()` and `enqueueDelayed()` -- persists to DB + optional HTTP push |
| `lib/queue/index.ts` | Barrel export for all queue functions and types |
| `lib/api/queue.ts` | Backward-compatible `enqueueJob()` wrapper (delegates to `lib/queue/producer`) |
