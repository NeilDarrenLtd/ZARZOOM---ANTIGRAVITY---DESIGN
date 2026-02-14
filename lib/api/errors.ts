/**
 * Structured API error classes.
 *
 * Each carries an HTTP status code and a machine-readable `code` string so the
 * handler factory can convert any thrown error into a consistent JSON envelope.
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class AuthError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, "AUTH_REQUIRED", message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = "Resource", message?: string) {
    super(404, "NOT_FOUND", message ?? `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(429, "RATE_LIMITED", "Too many requests");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class QuotaExceededError extends ApiError {
  constructor(counterName: string) {
    super(
      402,
      "QUOTA_EXCEEDED",
      `Usage quota exceeded for "${counterName}". Please upgrade your plan.`
    );
    this.name = "QuotaExceededError";
  }
}

export class ValidationError extends ApiError {
  constructor(details: unknown) {
    super(400, "VALIDATION_ERROR", "Request validation failed", details);
    this.name = "ValidationError";
  }
}
