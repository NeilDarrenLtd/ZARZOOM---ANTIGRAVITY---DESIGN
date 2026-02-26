# Upload-Post Integration

This document describes all environment variables required to integrate with the Upload-Post social publishing provider.

---

## Environment Variables

### Server-Only (never expose to the client bundle)

| Variable | Required | Description |
|---|---|---|
| `UPLOAD_POST_API_KEY` | Yes | API key issued by Upload-Post. Used to authenticate server-to-server API calls. |
| `UPLOAD_POST_STATE_SECRET` | Yes | Secret used to sign and verify OAuth state parameters, preventing CSRF attacks during the social connect flow. |
| `APP_BASE_URL` | Recommended | Canonical base URL of this application (e.g. `https://app.zarzoom.com`). Used to construct OAuth redirect/callback URLs. Falls back to `https://$VERCEL_URL` on Vercel or `http://localhost:3000` locally. |

> These variables are read exclusively in server-side code (`lib/upload-post/config.ts`). They must **never** be prefixed with `NEXT_PUBLIC_` and must never be imported by any client component.

---

### Public / UI Config (server components only)

These variables are not secret but should still only be read server-side and passed down as props — do not reference them from client components directly.

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPLOAD_POST_LOGO_URL` | No | `null` | URL of the Upload-Post provider logo shown in connect UI. |
| `UPLOAD_POST_CONNECT_TITLE` | No | `"Connect Social Accounts"` | Heading shown on the social connect screen. |
| `UPLOAD_POST_CONNECT_DESCRIPTION` | No | `"Link your social media accounts to enable publishing."` | Subtitle shown on the social connect screen. |
| `UPLOAD_POST_REDIRECT_BUTTON_TEXT` | No | `"Connect Accounts"` | Label for the button that initiates the connect flow. |
| `UPLOAD_POST_DEFAULT_PLATFORMS` | No | `undefined` | Comma-separated list of platforms pre-selected when creating a post (e.g. `instagram,facebook,tiktok`). |

---

## Usage

```ts
// Server component or API route only
import {
  requireEnv,
  getBaseUrl,
  getDefaultPlatforms,
  getUploadPostUiConfig,
} from "@/lib/upload-post/config";

// Fail fast if a required secret is missing
const apiKey = requireEnv("UPLOAD_POST_API_KEY");

// Canonical app URL for building OAuth callback URIs
const callbackUrl = `${getBaseUrl()}/api/v1/social/connect/callback`;

// Optional default platforms
const platforms = getDefaultPlatforms(); // string[] | undefined

// UI configuration (non-secret, server use only)
const ui = getUploadPostUiConfig();
// { logoUrl, connectTitle, connectDescription, redirectButtonText, defaultPlatforms }
```

---

## Security Notes

- `UPLOAD_POST_API_KEY` and `UPLOAD_POST_STATE_SECRET` must only ever appear in server-side code.
- Do **not** prefix them with `NEXT_PUBLIC_` as this would expose them in the client bundle.
- The `getUploadPostUiConfig()` helper reads non-secret vars but should still only be called from Server Components or API routes and passed as props to any client components that need them.
