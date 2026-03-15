/**
 * OpenRouter API client for server-side AI requests.
 *
 * SECURITY: This module is server-only. NEVER import in client components.
 * The API key must NEVER be exposed to the browser.
 */

import { z } from "zod";

// ============================================================================
// Configuration & Validation
// ============================================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini"; // Cost-effective, fast, reliable
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 1;

/**
 * Validates OpenRouter API key at startup.
 * Throws immediately if missing so deployments fail fast.
 */
function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key || key.trim() === "") {
    throw new Error(
      "[OpenRouter] OPENROUTER_API_KEY environment variable is required but not set.\n" +
        "Please add it to your Vercel project environment variables:\n" +
        "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n" +
        '2. Add: OPENROUTER_API_KEY="sk-or-v1-..."\n' +
        "3. Redeploy your application"
    );
  }

  return key;
}

// ============================================================================
// Types
// ============================================================================

export interface OpenRouterCallOptions {
  /** OpenRouter model identifier (e.g., "openai/gpt-4o-mini") */
  model?: string;
  /** System prompt or instructions for the model */
  prompt: string;
  /** User input or content to process */
  input: string;
  /** Optional JSON schema hint to guide structured output (used only when responseType is "json") */
  jsonSchemaHint?: string;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
  /**
   * Optional API key override.
   * If provided and non-empty, this key is used instead of the OPENROUTER_API_KEY env var.
   * This is primarily used by subsystems that load the key from a secure DB settings table.
   */
  apiKeyOverride?: string;
  /**
   * When "text", the request does not send response_format and returns raw assistant text.
   * Use for free-form test prompts; avoids 400 from models that don't support json_object.
   * Default "json" preserves existing behaviour (response_format + JSON parse).
   */
  responseType?: "json" | "text";
}

export interface OpenRouterResponse<T = unknown> {
  data: T;
  tokensUsed: number;
  model: string;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MISSING_API_KEY"
      | "NETWORK_ERROR"
      | "TIMEOUT"
      | "INVALID_RESPONSE"
      | "INVALID_JSON"
      | "API_ERROR"
      | "RATE_LIMIT"
      | "UNKNOWN",
    public readonly statusCode?: number,
    public readonly rawResponse?: string
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

// ============================================================================
// Assistant content extraction and safe JSON parsing
// ============================================================================

/**
 * Normalizes OpenRouter assistant content to a single string.
 * Supports: string content, or array of { type: "text", text: string } parts.
 */
function extractAssistantContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((p): p is { type?: string; text?: string } => p != null && typeof p === "object")
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text);
    return parts.join("\n");
  }
  if (content != null && typeof content === "object" && "text" in content && typeof (content as { text: unknown }).text === "string") {
    return (content as { text: string }).text;
  }
  return String(content ?? "");
}

/**
 * Strips markdown code fences from the start/end of the string.
 * Handles: ```json\n...\n```, ```\n...\n```, ```json ... ``` (same line).
 */
function stripCodeFences(text: string): string {
  let out = text.trim();
  // Block with newlines: ```json\n...\n``` or ```\n...\n```
  const blockMatch = out.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (blockMatch) {
    out = blockMatch[1].trim();
    return out;
  }
  // Inline or same-line: ```json ... ``` or ``` ... ```
  const inlineMatch = out.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (inlineMatch) {
    out = inlineMatch[1].trim();
  }
  return out;
}

/**
 * Finds the span of the first top-level JSON object (from first { to matching }).
 * Respects string boundaries so { and } inside strings are not counted.
 */
function isolateJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new OpenRouterError("No JSON object found in response", "INVALID_JSON", undefined, text.substring(0, 300));
  let depth = 0;
  let inString: "'" | '"' | null = null;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      if (c === inString) {
        // Count backslashes immediately before this quote; if even, string ends
        let b = i - 1;
        while (b >= 0 && text[b] === "\\") b--;
        if ((i - 1 - b) % 2 === 0) inString = null;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c;
      i++;
      continue;
    }
    if (c === "{") {
      depth++;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
      i++;
      continue;
    }
    i++;
  }
  throw new OpenRouterError("Unclosed JSON object in response", "INVALID_JSON", undefined, text.substring(0, 300));
}

/**
 * Safe parser: extract assistant content → strip fences → trim → isolate JSON → parse.
 * Supports plain JSON, JSON in markdown code fences, and JSON with minor surrounding text.
 */
function extractAndRepairJson(rawText: string): unknown {
  // 1. Trim
  let cleaned = rawText.trim();
  if (!cleaned) throw new OpenRouterError("Empty assistant content", "INVALID_RESPONSE", undefined, "");

  // 2. Strip code fences
  cleaned = stripCodeFences(cleaned).trim();

  // 3. Isolate likely JSON object (first { ... })
  let jsonSlice: string;
  try {
    jsonSlice = isolateJsonObject(cleaned);
  } catch (e) {
    if (e instanceof OpenRouterError) throw e;
    throw new OpenRouterError(
      `Could not isolate JSON: ${e instanceof Error ? e.message : String(e)}`,
      "INVALID_JSON",
      undefined,
      cleaned.substring(0, 500)
    );
  }

  // 4. Parse JSON
  try {
    return JSON.parse(jsonSlice);
  } catch (firstError) {
    // 5. Optional repair: trailing commas, then re-parse
    try {
      const repaired = jsonSlice.replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(repaired);
    } catch {
      throw new OpenRouterError(
        `Failed to parse JSON: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
        "INVALID_JSON",
        undefined,
        jsonSlice.substring(0, 500)
      );
    }
  }
}

// ============================================================================
// Core Client Function
// ============================================================================

/**
 * Calls OpenRouter API with the specified prompt and input.
 *
 * Enforces JSON-only responses and automatically parses the result.
 * Includes timeout, retry logic, and structured error handling.
 *
 * @throws {OpenRouterError} On API errors, timeouts, or invalid responses
 */
export async function callOpenRouter<T = unknown>(
  options: OpenRouterCallOptions
): Promise<OpenRouterResponse<T>> {
  const {
    model = DEFAULT_MODEL,
    prompt,
    input,
    jsonSchemaHint,
    temperature = 0.3,
    apiKeyOverride,
    responseType = "json",
  } = options;

  // Resolve API key:
  // 1. If apiKeyOverride is provided and non-empty, use it.
  // 2. Otherwise, fall back to env-based OPENROUTER_API_KEY (throws if missing).
  const apiKey =
    apiKeyOverride && apiKeyOverride.trim() !== ""
      ? apiKeyOverride.trim()
      : getOpenRouterApiKey();

  const isTextMode = responseType === "text";

  // Build the system prompt (with optional JSON enforcement)
  const systemPrompt = isTextMode
    ? prompt
    : `${prompt}

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.
${jsonSchemaHint ? `\nExpected JSON structure:\n${jsonSchemaHint}` : ""}`;

  // Prepare request payload (omit response_format in text mode so all models work)
  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input },
    ],
    temperature,
  };
  if (!isTextMode) {
    payload.response_format = { type: "json_object" };
  }

  // Retry logic
  let lastError: OpenRouterError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "ZARZOOM AI Wizard",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to read error response");

        if (response.status === 429) {
          throw new OpenRouterError(
            "OpenRouter rate limit exceeded. Please try again later.",
            "RATE_LIMIT",
            429,
            errorText
          );
        }

        // JSON mode: many models don't support response_format.json_object and return 400. Retry once without it.
        if (response.status === 400 && !isTextMode && payload.response_format) {
          try {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.response_format;
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT_MS);
            const retryRes = await fetch(OPENROUTER_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                "X-Title": "ZARZOOM AI Wizard",
              },
              body: JSON.stringify(fallbackPayload),
              signal: controller2.signal,
            });
            clearTimeout(timeoutId2);
            if (retryRes.ok) {
              const responseData = await retryRes.json();
              const message = responseData.choices?.[0]?.message;
              if (!message) {
                throw new OpenRouterError(
                  "OpenRouter returned an empty or invalid response structure",
                  "INVALID_RESPONSE",
                  undefined,
                  JSON.stringify(responseData)
                );
              }
              const rawContent = extractAssistantContent(message.content);
              const parsedData = extractAndRepairJson(rawContent);
              const tokensUsed =
                (responseData.usage?.prompt_tokens || 0) + (responseData.usage?.completion_tokens || 0);
              return {
                data: parsedData as T,
                tokensUsed,
                model: responseData.model || model,
              };
            }
          } catch (_fallbackErr) {
            // Fall through to throw original 400
          }
        }

        throw new OpenRouterError(
          `OpenRouter API error: ${response.statusText}`,
          "API_ERROR",
          response.status,
          errorText
        );
      }

      // Parse response
      const responseData = await response.json();

      // ──── TEMPORARY DEBUG CHECKPOINT ────
      console.log("🔴 [5] FLOATING_ANALYZER_OPENROUTER_RAW_RESPONSE", {
        hasChoices: !!responseData.choices,
        choicesLength: responseData.choices?.length ?? 0,
        hasMessage: !!responseData.choices?.[0]?.message,
        contentType: typeof responseData.choices?.[0]?.message?.content,
        contentLength: typeof responseData.choices?.[0]?.message?.content === "string"
          ? responseData.choices[0].message.content.length
          : Array.isArray(responseData.choices?.[0]?.message?.content)
            ? responseData.choices[0].message.content.length
            : 0,
        rawContentFirst200: typeof responseData.choices?.[0]?.message?.content === "string"
          ? responseData.choices[0].message.content.substring(0, 200)
          : JSON.stringify(responseData.choices?.[0]?.message?.content)?.substring(0, 200),
        model: responseData.model,
        tokensPrompt: responseData.usage?.prompt_tokens,
        tokensCompletion: responseData.usage?.completion_tokens,
        httpStatus: response.status,
        timestamp: new Date().toISOString(),
      });
      // ──── END TEMPORARY DEBUG CHECKPOINT ────

      const message = responseData.choices?.[0]?.message;
      if (!message) {
        throw new OpenRouterError(
          "OpenRouter returned an empty or invalid response structure",
          "INVALID_RESPONSE",
          undefined,
          JSON.stringify(responseData)
        );
      }

      // Extract assistant content (string or array of text parts)
      const rawContent = extractAssistantContent(message.content);

      // In text mode, return raw content without JSON parsing (avoids 400 for models that don't support response_format)
      if (isTextMode) {
        const tokensUsed =
          (responseData.usage?.prompt_tokens || 0) + (responseData.usage?.completion_tokens || 0);
        return {
          data: rawContent as T,
          tokensUsed,
          model: responseData.model || model,
        };
      }

      // ──── TEMPORARY DEBUG CHECKPOINT ────
      console.log("🔴 [6] FLOATING_ANALYZER_PARSE_STARTED", {
        rawContentLength: rawContent.length,
        rawContentFirst200: rawContent.substring(0, 200),
        timestamp: new Date().toISOString(),
      });
      // ──── END TEMPORARY DEBUG CHECKPOINT ────

      // Safe parse: strip fences, isolate JSON object, parse, then Zod validates in callOpenRouterTyped
      let parsedData: unknown;
      try {
        parsedData = extractAndRepairJson(rawContent);
      } catch (parseErr) {
        // ──── TEMPORARY DEBUG CHECKPOINT ────
        console.error("🔴 [8] FLOATING_ANALYZER_PARSE_FAILED", {
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
          rawContentFirst500: rawContent.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
        // ──── END TEMPORARY DEBUG CHECKPOINT ────
        throw parseErr;
      }

      // ──── TEMPORARY DEBUG CHECKPOINT ────
      console.log("🔴 [7] FLOATING_ANALYZER_PARSE_SUCCESS", {
        parsedKeys: parsedData && typeof parsedData === "object" ? Object.keys(parsedData as Record<string, unknown>) : "not_an_object",
        timestamp: new Date().toISOString(),
      });
      // ──── END TEMPORARY DEBUG CHECKPOINT ────

      // Calculate token usage
      const tokensUsed =
        (responseData.usage?.prompt_tokens || 0) + (responseData.usage?.completion_tokens || 0);

      return {
        data: parsedData as T,
        tokensUsed,
        model: responseData.model || model,
      };
    } catch (error) {
      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new OpenRouterError(
          `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
          "TIMEOUT"
        );
      }
      // Handle fetch network errors
      else if (error instanceof Error && error.message.includes("fetch")) {
        lastError = new OpenRouterError(
          `Network error connecting to OpenRouter: ${error.message}`,
          "NETWORK_ERROR"
        );
      }
      // Re-throw OpenRouterErrors
      else if (error instanceof OpenRouterError) {
        lastError = error;
      }
      // Wrap unknown errors
      else {
        lastError = new OpenRouterError(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          "UNKNOWN"
        );
      }

      // If we have retries left and error is retryable, continue
      if (
        attempt < MAX_RETRIES &&
        (lastError.code === "NETWORK_ERROR" || lastError.code === "TIMEOUT")
      ) {
        console.warn(`[OpenRouter] Attempt ${attempt + 1} failed, retrying...`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }

      // Otherwise, throw the error
      throw lastError;
    }
  }

  // If we exhausted retries, throw the last error
  throw lastError!;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type-safe wrapper for callOpenRouter with Zod schema validation.
 *
 * Example:
 * ```ts
 * const schema = z.object({ name: z.string(), colors: z.array(z.string()) });
 * const result = await callOpenRouterTyped(schema, { prompt: "...", input: "..." });
 * // result.data is fully typed!
 * ```
 */
export async function callOpenRouterTyped<T>(
  schema: z.ZodType<T>,
  options: OpenRouterCallOptions
): Promise<OpenRouterResponse<T>> {
  const response = await callOpenRouter<T>(options);

  try {
    const validated = schema.parse(response.data);
    return { ...response, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new OpenRouterError(
        `OpenRouter returned data that doesn't match expected schema: ${JSON.stringify(error.errors)}`,
        "INVALID_RESPONSE",
        undefined,
        JSON.stringify(response.data)
      );
    }
    throw error;
  }
}

/**
 * Checks if OpenRouter API key is configured.
 * Useful for feature flags or startup checks.
 */
export function isOpenRouterConfigured(): boolean {
  try {
    getOpenRouterApiKey();
    return true;
  } catch {
    return false;
  }
}
