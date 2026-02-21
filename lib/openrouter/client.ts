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
  /** Optional JSON schema hint to guide structured output */
  jsonSchemaHint?: string;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
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
// JSON Repair Utilities
// ============================================================================

/**
 * Attempts to extract and repair JSON from a response that might contain
 * markdown code blocks or other wrapping.
 */
function extractAndRepairJson(rawText: string): unknown {
  // Remove markdown code blocks if present
  let cleaned = rawText.trim();

  // Strip ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Try parsing as-is
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Attempt repairs
    try {
      // Remove trailing commas (common error)
      let repaired = cleaned.replace(/,\s*([\]}])/g, "$1");

      // Try to fix unquoted keys (very basic)
      repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      return JSON.parse(repaired);
    } catch (repairError) {
      // If repair fails, throw original error with context
      throw new OpenRouterError(
        `Failed to parse JSON response. Original: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
        "INVALID_JSON",
        undefined,
        cleaned.substring(0, 500) // Include truncated response for debugging
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
  const { model = DEFAULT_MODEL, prompt, input, jsonSchemaHint, temperature = 0.3 } = options;

  // Validate API key (throws if missing)
  const apiKey = getOpenRouterApiKey();

  // Build the system prompt with JSON enforcement
  const systemPrompt = `${prompt}

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.
${jsonSchemaHint ? `\nExpected JSON structure:\n${jsonSchemaHint}` : ""}`;

  // Prepare request payload
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input },
    ],
    temperature,
    response_format: { type: "json_object" }, // Force JSON mode for supported models
  };

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

        throw new OpenRouterError(
          `OpenRouter API error: ${response.statusText}`,
          "API_ERROR",
          response.status,
          errorText
        );
      }

      // Parse response
      const responseData = await response.json();

      if (!responseData.choices?.[0]?.message?.content) {
        throw new OpenRouterError(
          "OpenRouter returned an empty or invalid response structure",
          "INVALID_RESPONSE",
          undefined,
          JSON.stringify(responseData)
        );
      }

      const rawContent = responseData.choices[0].message.content;

      // Extract and parse JSON with repair attempts
      const parsedData = extractAndRepairJson(rawContent);

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
