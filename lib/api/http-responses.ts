import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Standard JSON response helpers                                     */
/* ------------------------------------------------------------------ */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

/* ---------- Success helpers ---------- */

export function ok(data: Record<string, unknown>, requestId: string) {
  return json(data, 200, requestId);
}

export function created(data: Record<string, unknown>, requestId: string) {
  return json(data, 201, requestId);
}

export function accepted(
  data: Record<string, unknown>,
  requestId: string
) {
  return json(data, 202, requestId);
}

/* ---------- Error helpers ---------- */

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
  extraHeaders?: Record<string, string>
) {
  const body: ErrorBody = {
    error: { code, message, requestId, ...(details ? { details } : {}) },
  };
  return json(body as unknown as Record<string, unknown>, status, requestId, extraHeaders);
}

export function badRequest(
  requestId: string,
  message = "Bad request",
  details?: unknown
) {
  return errorResponse(400, "BAD_REQUEST", message, requestId, details);
}

export function unauthorized(
  requestId: string,
  message = "Authentication required"
) {
  return errorResponse(401, "AUTH_REQUIRED", message, requestId);
}

export function forbidden(
  requestId: string,
  message = "Insufficient permissions"
) {
  return errorResponse(403, "FORBIDDEN", message, requestId);
}

export function notFound(
  requestId: string,
  message = "Resource not found"
) {
  return errorResponse(404, "NOT_FOUND", message, requestId);
}

export function conflict(
  requestId: string,
  message = "Resource already exists"
) {
  return errorResponse(409, "CONFLICT", message, requestId);
}

export function tooManyRequests(
  requestId: string,
  retryAfterSeconds: number,
  message = "Too many requests"
) {
  return errorResponse(429, "RATE_LIMITED", message, requestId, undefined, {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Remaining": "0",
  });
}

export function serverError(
  requestId: string,
  message = "Internal server error"
) {
  return errorResponse(500, "INTERNAL_ERROR", message, requestId);
}
