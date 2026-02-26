/**
 * Upload-Post API HTTP client
 *
 * Official host: https://api.upload-post.com
 * Auth header:   Authorization: ApiKey <key>
 *
 * All requests explicitly set method: "POST" and redirect: "follow"
 * so no call ever silently becomes a GET or HEAD.
 */

const UPLOAD_POST_HOST = "https://api.upload-post.com";
const UPLOAD_POST_BASE =
  (process.env.UPLOAD_POST_BASE_URL?.replace(/\/$/, "") || UPLOAD_POST_HOST) +
  "/api/uploadposts";

const upDebug = process.env.UPLOAD_POST_DEBUG === "true";

function upLog(...args: unknown[]) {
  if (upDebug) console.log("[upload-post]", ...args);
}
function upError(...args: unknown[]) {
  console.error("[upload-post]", ...args);
}

export interface UploadPostResponse<T> {
  ok: boolean;
  status: number;
  contentType: string;
  data: T | null;
  /** First 200 chars of body on error, undefined on success */
  errorSnippet?: string;
}

async function upPost<T>(
  op: string,
  path: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<UploadPostResponse<T>> {
  const url = `${UPLOAD_POST_BASE}${path}`;

  upLog(`request op=${op} method=POST url=${url}`);

  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "unknown";
  upLog(`response op=${op} status=${res.status} content-type=${contentType}`);

  if (!res.ok) {
    const rawSnippet = (await res.text().catch(() => "")).slice(0, 200);
    // Strip HTML tags so nginx 405 pages don't bleed into UI error messages
    const isHtml = contentType.includes("text/html") || rawSnippet.trimStart().startsWith("<");
    const snippet = isHtml
      ? `Unexpected HTML response (HTTP ${res.status}) — check Upload-Post API host and credentials.`
      : rawSnippet;
    upError(`non-2xx op=${op} status=${res.status} body=${rawSnippet.slice(0, 200)}`);
    return { ok: false, status: res.status, contentType, data: null, errorSnippet: snippet };
  }

  const text = await res.text().catch(() => "");
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    upError(`op=${op} response is not valid JSON`);
    return { ok: false, status: res.status, contentType, data: null, errorSnippet: text.slice(0, 200) };
  }

  return { ok: true, status: res.status, contentType, data };
}

// ── Typed endpoint wrappers ──────────────────────────────────────────────────

export interface CreateUserBody {
  username: string;
  [key: string]: unknown;
}

export interface CreateUserResult {
  success?: boolean;
}

/**
 * POST /api/uploadposts/users
 * Idempotent — 409 means the user already exists and should be treated as success.
 */
export async function createUploadPostUser(
  apiKey: string,
  body: CreateUserBody
): Promise<UploadPostResponse<CreateUserResult>> {
  return upPost<CreateUserResult>("create-user", "/users", apiKey, body);
}

export interface GenerateJwtBody {
  username: string;
  redirect_url: string;
  show_calendar?: boolean;
  logo_image?: string;
  connect_title?: string;
  connect_description?: string;
  redirect_button_text?: string;
  platforms?: string[];
  [key: string]: unknown;
}

export interface GenerateJwtResult {
  accessUrl?: string;
  access_url?: string;
}

/**
 * POST /api/uploadposts/users/generate-jwt
 * Returns a short-lived signed URL that embeds or redirects to the Upload-Post connect UI.
 */
export async function generateUploadPostJwt(
  apiKey: string,
  body: GenerateJwtBody
): Promise<UploadPostResponse<GenerateJwtResult>> {
  return upPost<GenerateJwtResult>("generate-jwt", "/users/generate-jwt", apiKey, body);
}

/** Expose the resolved base URL for logging in callers. */
export { UPLOAD_POST_BASE };
