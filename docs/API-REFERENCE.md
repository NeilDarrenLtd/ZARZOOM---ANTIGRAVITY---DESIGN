# ZARZOOM Antigravity Design - Complete API & System Reference

> **Purpose**: This document describes every endpoint, server action, middleware rule, database table, and client-side interaction surface in the ZARZOOM project. It is written so that another LLM (or developer) can understand how to call, extend, or integrate with every part of the system.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Database Schema](#3-database-schema)
4. [Supabase Client Setup](#4-supabase-client-setup)
5. [Middleware & Route Protection](#5-middleware--route-protection)
6. [HTTP API Routes](#6-http-api-routes)
7. [Server Actions - Auth](#7-server-actions---auth)
8. [Server Actions - Admin](#8-server-actions---admin)
9. [Client-Side Auth Flows](#9-client-side-auth-flows)
10. [Internationalisation (i18n)](#10-internationalisation-i18n)
11. [Page Map & Navigation](#11-page-map--navigation)
12. [Row Level Security (RLS) Policies](#12-row-level-security-rls-policies)
13. [Error Handling Patterns](#13-error-handling-patterns)
14. [How to Extend](#14-how-to-extend)

---

## 1. Architecture Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) | All pages use `"use client"` directive |
| Auth | Supabase Auth | Email/password + OAuth (Google, Facebook, LinkedIn, X/Twitter) |
| Database | Supabase (PostgreSQL) | 22 tables with RLS policies |
| Server Logic | Next.js Server Actions (`"use server"`) | No traditional REST controllers; actions are invoked directly from React |
| HTTP Routes | 2 route handlers | `/api/auth/providers` and `/auth/callback` |
| Styling | Tailwind CSS | Utility-first classes |
| i18n | Custom client-side system | 25 languages, JSON translation files in `/locales/` |
| Icons | Lucide React | Consistent icon library |

### Request Flow

```
Browser Request
  -> middleware.ts (session refresh + route protection)
    -> If protected & unauthenticated -> redirect to /auth or /admin/login
    -> If /admin & not admin user -> redirect to /dashboard
    -> Otherwise -> Next.js page renders

Server Action Call (from client component)
  -> "use server" function in actions.ts
    -> Creates Supabase client (user-scoped or admin/service-role)
    -> Performs DB operation or auth operation
    -> Returns { success, error, data } object
```

---

## 2. Environment Variables

### Required (Set Automatically by Supabase Integration)

| Variable | Description | Used In |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client, Server, Middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Client, Server, Middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Server Actions (admin operations) |
| `SUPABASE_JWT_SECRET` | JWT signing secret | Token verification |

### Optional

| Variable | Description | Used In |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (e.g. `https://zarzoom.com`) | OAuth redirects, email verification links |
| `VERCEL_PROJECT_PRODUCTION_URL` | Auto-set by Vercel on production | Fallback for redirect URLs |
| `VERCEL_URL` | Auto-set by Vercel on preview/branch deploys | Fallback for redirect URLs |
| `SUPABASE_ACCESS_TOKEN` | Supabase Personal Access Token | Admin OAuth provider configuration via Supabase Management API |

### URL Resolution Priority

When constructing redirect URLs (OAuth, email verification), the system resolves the base URL in this order:

1. `NEXT_PUBLIC_SITE_URL` (if set)
2. `https://${VERCEL_PROJECT_PRODUCTION_URL}` (if set)
3. `https://${VERCEL_URL}` (if set)
4. Request `origin` header (fallback)

---

## 3. Database Schema

### 3.1 `profiles` (Core User Table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Matches `auth.users.id` from Supabase Auth |
| `email` | `text` | User's email address |
| `display_name` | `text` (nullable) | Optional display name |
| `is_admin` | `boolean` | Whether the user has admin privileges |
| `created_at` | `timestamptz` | Account creation timestamp |
| `updated_at` | `timestamptz` | Last profile update timestamp |

**RLS Policies:**
- `profiles_select_own` (SELECT) - Users can read their own profile
- `profiles_insert_own` (INSERT) - Users can create their own profile
- `profiles_update_own` (UPDATE) - Users can update their own profile
- `profiles_admin_select` (SELECT) - Admins can read all profiles
- `profiles_admin_update` (UPDATE) - Admins can update all profiles

### 3.2 `site_settings` (Admin Configuration Store)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` (PK) | Auto-generated |
| `key` | `text` (unique) | Setting identifier (e.g. `smtp_host`, `oauth_google_client_id`) |
| `value` | `text` | Setting value |
| `encrypted` | `boolean` | If true, value is never returned to client after save |
| `updated_at` | `timestamptz` | Last update timestamp |

**Key Naming Conventions:**
- `smtp_*` - SMTP/email settings (e.g. `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from_email`, `smtp_from_name`, `smtp_encryption`)
- `oauth_*` - OAuth provider backup settings (e.g. `oauth_google_client_id`, `oauth_google_client_secret`, `oauth_google_enabled`)

**RLS Policies:**
- `settings_admin_select` (SELECT) - Only admins can read
- `settings_admin_insert` (INSERT) - Only admins can insert
- `settings_admin_update` (UPDATE) - Only admins can update
- `settings_admin_delete` (DELETE) - Only admins can delete

### 3.3 Other Tables (Multi-Tenant SaaS Infrastructure)

These tables exist in the schema but are not yet consumed by the current UI. They represent a multi-tenant SaaS backend:

| Table | Purpose |
|-------|---------|
| `tenant_memberships` | Links users to tenants with roles |
| `tenant_settings` | Per-tenant configuration |
| `tenant_subscriptions` | Billing/subscription state per tenant |
| `subscription_plans` | Available plans (name, features, entitlements) |
| `plan_prices` | Pricing tiers per plan |
| `billing_usage_counters` | Metered billing counters |
| `usage_counters` | General usage tracking |
| `jobs` | Background job queue |
| `artefacts` | Generated content/outputs |
| `social_posts` | Social media post management |
| `social_profiles` | Connected social media accounts |
| `social_webhook_events` | Inbound social webhook payloads |
| `prompt_templates` | AI prompt templates |
| `prompt_template_versions` | Versioned prompt template content |
| `provider_secrets` | Encrypted API keys for third-party providers |
| `provider_secrets_metadata` | Non-sensitive metadata view of secrets |
| `rate_limits` | Rate limiting windows |
| `idempotency_keys` | Request deduplication |
| `admin_audit` | Admin action audit log |

---

## 4. Supabase Client Setup

### 4.1 Browser Client (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

**When to use:** In `"use client"` components for client-side auth operations (sign out, get current user, real-time subscriptions).

### 4.2 Server Client (`lib/supabase/server.ts`)

```typescript
// User-scoped client (respects RLS based on logged-in user)
export async function createClient()

// Admin client (uses service role key, bypasses ALL RLS)
export async function createAdminClient()
```

**When to use:**
- `createClient()` - In Server Actions or Route Handlers where you want RLS to apply based on the authenticated user's session.
- `createAdminClient()` - In Server Actions that need to bypass RLS (e.g. admin reading all profiles, updating settings). **Never expose to client code.**

---

## 5. Middleware & Route Protection

**File:** `middleware.ts` + `lib/supabase/middleware.ts`

### Matcher Pattern

```
/((?!_next/static|_next/image|favicon.ico|sequence|images|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

This runs the middleware on all routes **except** static assets, images, and the `/sequence/` and `/images/` directories.

### Protection Rules

| Route Pattern | Rule | Redirect Target |
|---------------|------|-----------------|
| `/dashboard/*` | Requires authenticated user | `/auth` |
| `/admin/*` (except `/admin/login`) | Requires authenticated user | `/admin/login` |
| `/admin/*` (authenticated, non-admin) | Requires `is_admin` in user metadata | `/dashboard` |
| All other routes | Public, no auth check | N/A |

### Session Refresh

For protected routes, the middleware refreshes the Supabase session by calling `supabase.auth.getUser()`, which ensures cookies are kept up to date.

For public routes, the middleware skips Supabase auth entirely to avoid blocking page loads.

---

## 6. HTTP API Routes

### 6.1 `GET /api/auth/providers`

**Purpose:** Returns which OAuth providers are currently enabled in the Supabase project.

**Authentication:** None required (public endpoint).

**Caching:** Revalidates every 60 seconds (`revalidate = 60`).

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

**Error Response:**

```json
{
  "providers": {}
}
```

**Implementation:** Calls `getEnabledProviders()` server action internally, which queries the Supabase Management API to check which external providers are enabled.

---

### 6.2 `GET /auth/callback`

**Purpose:** OAuth callback handler. Supabase redirects here after a user completes OAuth sign-in with a provider.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | The authorization code from OAuth provider |
| `next` | `string` | No | Where to redirect after successful auth (default: `/dashboard`) |

**Flow:**
1. Extracts `code` from query params
2. Calls `supabase.auth.exchangeCodeForSession(code)` to trade the code for a session
3. On success: redirects to `{baseUrl}{next}` (default `/dashboard`)
4. On failure: redirects to `{baseUrl}/auth/error`

**Note:** This is also used for email verification links. The signup email contains a link that redirects through Supabase to `/auth/callback?next=/auth/verified`.

---

## 7. Server Actions - Auth

**File:** `app/auth/actions.ts`

All functions are marked `"use server"` and can be called directly from client components.

### 7.1 `signInWithEmail(email, password)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `email` | `string` | User's email |
| `password` | `string` | User's password |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Calls `supabase.auth.signInWithPassword()`. On success, sets session cookies automatically via the Supabase SSR client.

---

### 7.2 `signUpWithEmail(email, password)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `email` | `string` | User's email |
| `password` | `string` | User's password |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Calls `supabase.auth.signUp()` with `emailRedirectTo` set to `{baseUrl}/auth/callback?next=/auth/verified`. Supabase sends a verification email. User must click the link to verify.

---

### 7.3 `signInWithOAuth(provider)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `provider` | `"google" \| "facebook" \| "twitter" \| "linkedin_oidc"` | OAuth provider identifier |

**Returns:**
```typescript
{ url: string } | { error: string }
```

**Behaviour:** Calls `supabase.auth.signInWithOAuth()` which returns a redirect URL. The client must navigate to this URL (`window.location.href = result.url`). After the OAuth flow, Supabase redirects to `/auth/callback`.

---

### 7.4 `resendVerificationEmail(email)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `email` | `string` | User's email to resend verification to |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Calls `supabase.auth.resend({ type: "signup", email })` with the same `emailRedirectTo` as sign-up.

---

### 7.5 `signInAdmin(email, password)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `email` | `string` | Admin's email |
| `password` | `string` | Admin's password |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:**
1. Signs in with `supabase.auth.signInWithPassword()`
2. Checks `user.user_metadata.is_admin` (fast, no DB query)
3. If not in metadata, falls back to querying `profiles.is_admin` using the admin client (bypasses RLS)
4. If not admin, signs the user back out and returns an error

---

## 8. Server Actions - Admin

**File:** `app/admin/actions.ts`

All functions are marked `"use server"` and protected by `requireAdmin()` which verifies the caller is an authenticated admin.

### 8.1 Admin Guard: `requireAdmin()`

**Internal function** (not exported). Called at the start of every admin action.

**Behaviour:**
1. Gets current user via `supabase.auth.getUser()`
2. If no user: throws `"Not authenticated"`
3. Checks `user.user_metadata.is_admin` (fast JWT check)
4. If not in metadata, queries `profiles.is_admin` using admin client
5. If not admin: throws `"Not authorised"`
6. Returns the user object

---

### 8.2 `getSettings(prefix)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `prefix` | `string` | Key prefix to filter (e.g. `"smtp_"`, `"oauth_"`) |

**Returns:**
```typescript
{ settings: Record<string, string> } | { error: string, settings: {} }
```

**Behaviour:** Queries `site_settings` where key `LIKE '{prefix}%'`. For rows where `encrypted = true`, returns an empty string (never exposes secrets).

---

### 8.3 `saveSettings(entries)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `entries` | `Array<{ key: string, value: string, encrypted?: boolean }>` | Settings to upsert |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Upserts each entry into `site_settings` (conflict on `key`). Skips entries where `encrypted = true` and `value` is empty (preserves existing secret).

---

### 8.4 `configureSupabaseOAuthProvider(providerId, clientId, clientSecret, enabled)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `providerId` | `string` | Provider identifier (`"google"`, `"facebook"`, `"linkedin"`, `"twitter"`) |
| `clientId` | `string` | OAuth client ID |
| `clientSecret` | `string` | OAuth client secret |
| `enabled` | `boolean` | Whether to enable or disable the provider |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Calls the Supabase Management API (`PATCH /v1/projects/{ref}/config/auth`) to directly configure the OAuth provider in Supabase Auth. Requires `SUPABASE_ACCESS_TOKEN` environment variable.

**Provider Mapping:**
| Input | Supabase Field |
|-------|---------------|
| `google` | `external_google_*` |
| `facebook` | `external_facebook_*` |
| `linkedin` | `external_linkedin_oidc_*` |
| `twitter` | `external_twitter_*` |

---

### 8.5 `getSupabaseOAuthStatus()`

**Parameters:** None.

**Returns:**
```typescript
{
  providers: {
    google: { enabled: boolean, hasClientId: boolean },
    facebook: { enabled: boolean, hasClientId: boolean },
    linkedin: { enabled: boolean, hasClientId: boolean },
    twitter: { enabled: boolean, hasClientId: boolean }
  }
} | { error: string, providers: {} }
```

**Behaviour:** Reads the current Supabase Auth config via the Management API (`GET /v1/projects/{ref}/config/auth`) and extracts the enabled/configured status for each provider.

---

### 8.6 `getUsers()`

**Parameters:** None.

**Returns:**
```typescript
{
  users: Array<{
    id: string,
    email: string,
    display_name: string | null,
    is_admin: boolean,
    created_at: string,
    updated_at: string
  }>
} | { error: string, users: [] }
```

**Behaviour:** Reads all rows from `profiles` table using admin client (bypasses RLS), ordered by `created_at` descending.

---

### 8.7 `updateUserRole(userId, isAdmin)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `userId` | `string` | UUID of the user |
| `isAdmin` | `boolean` | Whether to grant or revoke admin |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:** Updates `profiles.is_admin` for the given user ID using admin client.

---

### 8.8 `sendTestEmail(recipientEmail)`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `recipientEmail` | `string` | Email address to send the test to |

**Returns:**
```typescript
{ success: true } | { error: string }
```

**Behaviour:**
1. Reads SMTP settings from `site_settings` (keys prefixed `smtp_`)
2. Validates that `smtp_host`, `smtp_user`, and `smtp_pass` are configured
3. Creates a Nodemailer transporter with the configured SMTP settings
4. Sends a test email with HTML content
5. Supports TLS (port 587), SSL (port 465), and no encryption

---

### 8.9 `getEnabledProviders()`

**Parameters:** None.

**Returns:**
```typescript
{
  providers: {
    google: boolean,
    facebook: boolean,
    linkedin: boolean,
    twitter: boolean
  }
}
```

**Behaviour:**
1. If `SUPABASE_ACCESS_TOKEN` is available: queries the Supabase Management API for live provider status
2. If not: falls back to reading `oauth_*_enabled` keys from `site_settings`
3. Cached for 60 seconds when called via the `/api/auth/providers` route

---

## 9. Client-Side Auth Flows

### 9.1 Email Sign-In Flow

```
User submits login form
  -> Client calls signInWithEmail(email, password) server action
  -> Server action calls supabase.auth.signInWithPassword()
  -> On success: client calls router.push("/dashboard")
  -> On error: displays error message
```

### 9.2 Email Registration Flow

```
User submits register form
  -> Client validates password (8+ chars, uppercase, lowercase, number, special char)
  -> Client validates passwords match
  -> Client calls signUpWithEmail(email, password) server action
  -> Server action calls supabase.auth.signUp() with emailRedirectTo
  -> Client redirects to /auth/verify?email={email}
  -> User receives verification email
  -> User clicks link -> Supabase redirects to /auth/callback?code=xxx&next=/auth/verified
  -> Callback exchanges code for session
  -> User lands on /auth/verified (success page)
```

### 9.3 OAuth Sign-In Flow

```
User clicks social login button (Google/Facebook/LinkedIn/X)
  -> Client calls signInWithOAuth(provider) server action
  -> Server action calls supabase.auth.signInWithOAuth() -> returns redirect URL
  -> Client navigates to URL (window.location.href = url)
  -> User authenticates with provider
  -> Provider redirects to Supabase callback URL: {SUPABASE_URL}/auth/v1/callback
  -> Supabase processes the token
  -> Supabase redirects to app callback: {APP_URL}/auth/callback?code=xxx
  -> /auth/callback route handler exchanges code for session
  -> User is redirected to /dashboard
```

### 9.4 Admin Sign-In Flow

```
Admin navigates to /admin/login
  -> Submits email + password
  -> Client calls signInAdmin(email, password) server action
  -> Server action:
    1. Signs in with password
    2. Checks user_metadata.is_admin
    3. Falls back to profiles table check
    4. If not admin: signs out and returns error
  -> On success: client calls router.push("/admin")
```

### 9.5 Sign-Out Flow

```
User clicks logout
  -> Client calls supabase.auth.signOut()
  -> Client navigates to "/" (window.location.href = "/")
```

### 9.6 Password Requirements

Registration enforces all of the following:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (`!@#$%^&*(),.?":{}|<>`)

---

## 10. Internationalisation (i18n)

### System Architecture

- **Provider:** `I18nProvider` wraps the entire app in `app/layout.tsx`
- **Hook:** `useI18n()` returns `{ locale, setLocale, t, translations }`
- **Translation files:** `/locales/{code}.json` (e.g. `en.json`, `fr.json`, `es.json`)
- **Language detection:** On first visit, detects browser language; stores preference in `localStorage` under key `zarzoom-locale`
- **Translation loading:** English is bundled statically; other languages are loaded dynamically via `import()` and cached in memory

### Supported Languages (25)

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `fr` | French | LTR |
| `es` | Spanish | LTR |
| `de` | German | LTR |
| `it` | Italian | LTR |
| `pt` | Portuguese | LTR |
| `nl` | Dutch | LTR |
| `pl` | Polish | LTR |
| `sv` | Swedish | LTR |
| `da` | Danish | LTR |
| `no` | Norwegian | LTR |
| `fi` | Finnish | LTR |
| `ru` | Russian | LTR |
| `uk` | Ukrainian | LTR |
| `tr` | Turkish | LTR |
| `ar` | Arabic | RTL |
| `he` | Hebrew | RTL |
| `hi` | Hindi | LTR |
| `zh` | Chinese | LTR |
| `ja` | Japanese | LTR |
| `ko` | Korean | LTR |
| `th` | Thai | LTR |
| `vi` | Vietnamese | LTR |
| `id` | Indonesian | LTR |
| `ms` | Malay | LTR |

### Translation Key Structure

Keys use dot notation matching the JSON structure. Example translation keys:

```
auth.tabLogin, auth.tabCreateAccount, auth.loginTitle, auth.loginSubtitle,
auth.email, auth.password, auth.confirmPassword, auth.rememberMe,
auth.forgotLogin, auth.login, auth.register, auth.orContinueWith,
auth.continueWithGoogle, auth.continueWithFacebook, auth.continueWithLinkedIn,
auth.continueWithX, auth.noAccount, auth.hasAccount, auth.switchToRegister,
auth.switchToLogin, auth.passwordMinLength, auth.passwordUppercase,
auth.passwordLowercase, auth.passwordNumber, auth.passwordSpecial,
auth.passwordsNoMatch, auth.verifyTitle, auth.verifySubtitle,
auth.verifyResend, auth.verifyResent, auth.verifyBack,
auth.verifiedTitle, auth.verifiedSubtitle, auth.verifiedContinue,
auth.authError, auth.authErrorMessage, auth.tryAgain,
auth.adminLogin, auth.adminLoginSubtitle, auth.adminSignIn,
auth.backToLogin, auth.signUpSuccess, auth.signUpSuccessMessage,

nav.home, nav.login, nav.logout, nav.support, nav.privacy,

dashboard.title, dashboard.welcome, dashboard.overview,
dashboard.comingSoon, dashboard.accountSettings, dashboard.memberSince,
dashboard.connectedAccounts,

admin.title, admin.settingsDashboard, admin.manageSettings,
admin.userManagement, admin.users, admin.emailSettings,
admin.emailSettingsDesc, admin.oauthKeys, admin.oauthSettingsDesc,
admin.settings, admin.save, admin.saved, admin.settingsSaving,
admin.saveProvider, admin.accessDenied, admin.accessDeniedMessage,
admin.smtpHost, admin.smtpPort, admin.smtpUser, admin.smtpPass,
admin.smtpFrom, admin.smtpFromName, admin.smtpEncryption,
admin.smtpEncryptionTLS, admin.smtpEncryptionSSL, admin.smtpEncryptionNone,
admin.sendTestEmail, admin.testEmailRecipient, admin.testEmailSent,
admin.testEmailFailed, admin.secretsHidden, admin.oauthClientId,
admin.oauthClientSecret, admin.oauthEnabled, admin.oauthDisabled,
admin.rbacNote, admin.userSearch, admin.noUsersFound, admin.email,
admin.userRole, admin.userRoleAdmin, admin.userRoleUser,
admin.userCreated, admin.userActions, admin.removeAdmin, admin.makeAdmin,

footer.*, site.*, testimonials.*, cta.*
```

### Usage in Components

```typescript
import { useI18n } from "@/lib/i18n";

function MyComponent() {
  const { t, locale, setLocale } = useI18n();
  
  return <h1>{t("auth.loginTitle")}</h1>;
}
```

---

## 11. Page Map & Navigation

### Public Pages

| Path | Description | Layout |
|------|-------------|--------|
| `/` | Landing page with hero rocket animation, testimonials, CTA | Root layout |
| `/auth` | Login/Register with tabbed interface + social OAuth | SiteNavbar + Footer |
| `/auth/verify?email=...` | Email verification pending screen | SiteNavbar + Footer |
| `/auth/verified` | Email verified success screen | SiteNavbar + Footer |
| `/auth/error` | Auth error page | Navbar + Footer |
| `/auth/callback` | OAuth/email callback handler (route handler, not a page) | N/A |
| `/login-launch` | Alternative login/register page (separate sections, no tabs) | Navbar + Footer |
| `/privacy` | Privacy policy | Site layout (SiteNavbar + Footer) |
| `/terms-website` | Website terms | Site layout |
| `/terms-user` | User terms | Site layout |
| `/cookies` | Cookie policy | Site layout |
| `/support` | Support page | Site layout |

### Protected Pages (Require Authentication)

| Path | Description | Redirect If Unauth |
|------|-------------|-------------------|
| `/dashboard` | User dashboard with account overview | `/auth` |

### Admin Pages (Require `is_admin = true`)

| Path | Description | Redirect If Not Admin |
|------|-------------|----------------------|
| `/admin` | Admin dashboard with quick-access cards | `/admin/login` or `/dashboard` |
| `/admin/login` | Admin-specific login page | N/A (public) |
| `/admin/users` | User management table (search, role toggle) | `/admin/login` or `/dashboard` |
| `/admin/settings` | Redirects to `/admin/settings/email` | - |
| `/admin/settings/email` | SMTP configuration + test email | - |
| `/admin/settings/oauth` | OAuth provider configuration (Google, Facebook, LinkedIn, X) | - |

### Navbar Components

| Component | Used On | Features |
|-----------|---------|----------|
| `Navbar` | Landing page, login-launch, auth error | Logo, minimal navigation |
| `SiteNavbar` | Auth pages, dashboard, admin login, legal pages | Logo, nav links, language switcher, login/logout |
| Admin sidebar | Admin pages | Sidebar nav with collapsible settings, mobile bottom nav |

---

## 12. Row Level Security (RLS) Policies

### `profiles` Table

| Policy | Action | Rule |
|--------|--------|------|
| `profiles_select_own` | SELECT | `auth.uid() = id` |
| `profiles_insert_own` | INSERT | `auth.uid() = id` |
| `profiles_update_own` | UPDATE | `auth.uid() = id` |
| `profiles_admin_select` | SELECT | User has `is_admin = true` in their profile |
| `profiles_admin_update` | UPDATE | User has `is_admin = true` in their profile |

### `site_settings` Table

| Policy | Action | Rule |
|--------|--------|------|
| `settings_admin_select` | SELECT | Admin only |
| `settings_admin_insert` | INSERT | Admin only |
| `settings_admin_update` | UPDATE | Admin only |
| `settings_admin_delete` | DELETE | Admin only |

### Important Note on RLS Bypass

The admin server actions use `createAdminClient()` (service role key) to bypass RLS entirely. This is necessary because:
1. Admin profile checks via RLS would cause circular queries
2. Settings and user management need unrestricted access
3. The `requireAdmin()` guard provides application-level authorization before any service-role operations

---

## 13. Error Handling Patterns

### Server Actions

All server actions return a consistent shape:

```typescript
// Success
{ success: true }
// or with data
{ users: [...] }
{ settings: {...} }
{ url: "https://..." }
{ providers: {...} }

// Error
{ error: "Human-readable error message" }
```

### Client Error Display

Errors are displayed as inline alerts:
```tsx
{error && (
  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
    {error}
  </p>
)}
```

### Middleware Errors

If the Supabase auth check fails in middleware (network error, invalid token), the user is redirected to `/auth`.

---

## 14. How to Extend

### Adding a New Server Action

1. Create the function in the appropriate `actions.ts` file with `"use server"` directive
2. For admin actions: call `requireAdmin()` at the start
3. Use `createClient()` for user-scoped operations or `createAdminClient()` for admin operations
4. Return `{ success: true }` or `{ error: string }`
5. Call directly from client components

### Adding a New Protected Page

1. Create the page in `app/{route}/page.tsx`
2. Add the route pattern to the middleware protection rules in `lib/supabase/middleware.ts`
3. The middleware will automatically redirect unauthenticated users

### Adding a New OAuth Provider

1. Add the provider to the `PROVIDERS` array in `app/admin/settings/oauth/page.tsx`
2. Add the provider mapping in `configureSupabaseOAuthProvider()` in `app/admin/actions.ts`
3. Add the sign-in button in `app/auth/page.tsx`
4. Update `getSupabaseOAuthStatus()` and `getEnabledProviders()` to include the new provider

### Adding a New Translation Key

1. Add the key/value to `/locales/en.json` first
2. Add translations to all other locale files in `/locales/`
3. Use `t("your.new.key")` in components

### Adding a New Database Table

1. Create a migration SQL script in `/scripts/`
2. Execute it via the Supabase dashboard or CLI
3. Add appropriate RLS policies
4. Create server actions in the relevant `actions.ts` file
5. Build UI components that call those actions

### Adding a New Admin Settings Section

1. Create a new page at `app/admin/settings/{section}/page.tsx`
2. Use `getSettings("{prefix}_")` and `saveSettings([...])` from admin actions
3. Add the nav link to the settings items in `app/admin/layout.tsx`
4. Store settings with a consistent key prefix (e.g. `mysection_host`, `mysection_port`)

---

## Appendix: Complete File Tree

```
app/
  layout.tsx                          # Root layout with I18nProvider
  page.tsx                            # Landing page (hero animation, testimonials, CTA)
  not-found.tsx                       # 404 page
  
  auth/
    page.tsx                          # Login/Register (tabbed)
    actions.ts                        # Auth server actions
    callback/route.ts                 # OAuth callback handler
    verify/page.tsx                   # Email verification pending
    verified/page.tsx                 # Email verified success
    error/page.tsx                    # Auth error page
  
  dashboard/
    page.tsx                          # User dashboard
  
  admin/
    layout.tsx                        # Admin layout with sidebar
    page.tsx                          # Admin dashboard
    actions.ts                        # Admin server actions
    login/page.tsx                    # Admin login
    users/page.tsx                    # User management
    settings/
      page.tsx                        # Redirect to email settings
      email/page.tsx                  # SMTP configuration
      oauth/page.tsx                  # OAuth provider configuration
  
  login-launch/
    page.tsx                          # Alternative login/register page
  
  (site)/
    layout.tsx                        # Shared layout for legal pages
    privacy/page.tsx
    terms-website/page.tsx
    terms-user/page.tsx
    cookies/page.tsx
    support/page.tsx
  
  api/
    auth/
      providers/route.ts             # GET - enabled OAuth providers

components/
  Navbar.tsx                          # Landing page navbar
  SiteNavbar.tsx                      # Authenticated pages navbar
  Footer.tsx                          # Global footer
  RocketCanvas.tsx                    # Hero scroll-driven animation
  TestimonialGrid.tsx                 # Customer testimonials
  FinalCTA.tsx                        # Call-to-action section
  LanguageSwitcher.tsx                # Language selector dropdown
  DynamicSEO.tsx                      # Dynamic meta tags

lib/
  utils.ts                            # Utility functions (cn)
  i18n.tsx                            # Re-export (legacy)
  i18n/
    index.ts                          # i18n exports
    context.tsx                       # I18nProvider + useI18n hook
    languages.ts                      # Supported languages list
  supabase/
    client.ts                         # Browser Supabase client
    server.ts                         # Server Supabase clients (user + admin)
    middleware.ts                      # Session management + route protection

middleware.ts                         # Root middleware entry point

locales/
  en.json, fr.json, es.json, ...     # Translation files (25 languages)
```
