# OpenRouter Client Documentation

## Overview

The OpenRouter client is a server-only wrapper for calling OpenRouter's AI API with built-in retry logic, timeout handling, JSON parsing, and error management.

## Security

**CRITICAL**: This module is SERVER-ONLY. Never import in client components.

- The `OPENROUTER_API_KEY` must NEVER be exposed to the browser
- Only import from server-side code (API routes, Server Actions, Server Components)
- The API key is validated at startup to fail fast if missing

## Setup

### 1. Add API Key

Add the OpenRouter API key to your environment variables:

**Local Development** (`.env.local`):
```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

**Vercel Deployment**:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `OPENROUTER_API_KEY` with value `sk-or-v1-...`
3. Redeploy your application

### 2. Get an API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up / Log in
3. Go to Settings → API Keys
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-`)

## Usage

### Basic Usage

```typescript
import { callOpenRouter } from "@/lib/openrouter";

const response = await callOpenRouter({
  prompt: "Extract business information from the following website content.",
  input: "Website HTML content here...",
  model: "openai/gpt-4o-mini", // Optional, uses default if not specified
});

console.log(response.data); // Parsed JSON object
console.log(response.tokensUsed); // Number of tokens consumed
console.log(response.model); // Model that was used
```

### Type-Safe Usage with Zod

```typescript
import { callOpenRouterTyped, websiteInvestigationSchema } from "@/lib/openrouter";

const response = await callOpenRouterTyped(
  websiteInvestigationSchema,
  {
    prompt: "Extract business information...",
    input: "Website content...",
  }
);

// response.data is fully typed according to the schema!
const { business_name, brand_color_hex, suggested_styles } = response.data;
```

### Custom Schema

```typescript
import { z } from "zod";
import { callOpenRouterTyped } from "@/lib/openrouter";

const mySchema = z.object({
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
});

const response = await callOpenRouterTyped(mySchema, {
  prompt: "Summarize this article and extract keywords.",
  input: "Article content...",
});

// Fully typed!
const { title, summary, keywords } = response.data;
```

### With JSON Schema Hint

Provide a JSON schema hint to guide the model's output structure:

```typescript
const response = await callOpenRouter({
  prompt: "Extract product information.",
  input: "Product page HTML...",
  jsonSchemaHint: `{
    "name": "string",
    "price": "number",
    "inStock": "boolean"
  }`,
});
```

### Advanced Options

```typescript
const response = await callOpenRouter({
  model: "anthropic/claude-3.5-sonnet", // Use different model
  prompt: "Your prompt...",
  input: "Your input...",
  temperature: 0.7, // Increase randomness (0-1)
  jsonSchemaHint: "...", // Optional structure hint
});
```

## Error Handling

The client provides structured error handling with `OpenRouterError`:

```typescript
import { callOpenRouter, OpenRouterError } from "@/lib/openrouter";

try {
  const response = await callOpenRouter({
    prompt: "...",
    input: "...",
  });
  
  // Success
  console.log(response.data);
} catch (error) {
  if (error instanceof OpenRouterError) {
    switch (error.code) {
      case "MISSING_API_KEY":
        console.error("API key not configured");
        break;
      case "RATE_LIMIT":
        console.error("Rate limit exceeded:", error.message);
        break;
      case "TIMEOUT":
        console.error("Request timed out");
        break;
      case "INVALID_JSON":
        console.error("Model returned invalid JSON:", error.rawResponse);
        break;
      case "API_ERROR":
        console.error(`API error (${error.statusCode}):`, error.message);
        break;
      default:
        console.error("Unexpected error:", error.message);
    }
  } else {
    console.error("Unknown error:", error);
  }
}
```

### Error Codes

- `MISSING_API_KEY` - API key not configured
- `NETWORK_ERROR` - Network connectivity issue
- `TIMEOUT` - Request exceeded 30 seconds
- `INVALID_RESPONSE` - API returned unexpected format
- `INVALID_JSON` - Failed to parse JSON from response
- `API_ERROR` - OpenRouter API returned an error
- `RATE_LIMIT` - Rate limit exceeded (429)
- `UNKNOWN` - Unexpected error

## Features

### 1. Automatic JSON Parsing

The client enforces JSON-only responses and automatically parses them:

```typescript
// Model returns: {"name": "ACME Corp", "color": "#FF5733"}
const response = await callOpenRouter({...});
console.log(response.data.name); // "ACME Corp"
```

### 2. Markdown Code Block Removal

Handles cases where models wrap JSON in markdown:

```
Input: ```json\n{"key": "value"}\n```
Output: {"key": "value"}
```

### 3. JSON Repair

Attempts to fix common JSON errors:
- Trailing commas
- Unquoted keys (basic cases)

### 4. Retry Logic

Automatically retries failed requests:
- 1 retry attempt with exponential backoff
- Only retries on network/timeout errors
- Skips retry for API errors (4xx/5xx)

### 5. Timeout Protection

Requests timeout after 30 seconds to prevent hanging.

### 6. Configuration Check

Check if OpenRouter is configured before calling:

```typescript
import { isOpenRouterConfigured } from "@/lib/openrouter";

if (isOpenRouterConfigured()) {
  // Safe to call OpenRouter
} else {
  // Show feature unavailable message
}
```

## Available Models

The client includes pre-configured model constants:

```typescript
import { OPENROUTER_MODELS } from "@/lib/openrouter";

// Fast and cost-effective (default)
OPENROUTER_MODELS.DEFAULT // "openai/gpt-4o-mini"

// Most capable, more expensive
OPENROUTER_MODELS.PREMIUM // "openai/gpt-4o"

// Alternative: Anthropic Claude
OPENROUTER_MODELS.CLAUDE // "anthropic/claude-3.5-sonnet"
```

You can also use any model from [OpenRouter's model list](https://openrouter.ai/models).

## API Reference

### `callOpenRouter<T>(options: OpenRouterCallOptions): Promise<OpenRouterResponse<T>>`

Main function to call OpenRouter API.

**Parameters:**
- `options.prompt` (string, required) - System prompt/instructions
- `options.input` (string, required) - User input/content to process
- `options.model` (string, optional) - OpenRouter model ID (default: "openai/gpt-4o-mini")
- `options.jsonSchemaHint` (string, optional) - JSON structure hint for the model
- `options.temperature` (number, optional) - Response randomness 0-1 (default: 0.3)

**Returns:**
```typescript
{
  data: T;           // Parsed JSON response
  tokensUsed: number; // Total tokens consumed
  model: string;     // Model that processed the request
}
```

**Throws:** `OpenRouterError`

### `callOpenRouterTyped<T>(schema: ZodType<T>, options: OpenRouterCallOptions): Promise<OpenRouterResponse<T>>`

Type-safe wrapper with Zod validation.

**Parameters:**
- `schema` (ZodType) - Zod schema to validate response
- `options` (OpenRouterCallOptions) - Same as `callOpenRouter`

**Returns:** Same as `callOpenRouter`, but with validated types

**Throws:** `OpenRouterError` or `ZodError`

### `isOpenRouterConfigured(): boolean`

Check if OpenRouter API key is configured.

**Returns:** `true` if configured, `false` otherwise

## Best Practices

### 1. Server-Side Only

```typescript
// ✅ GOOD - API Route (server-side)
import { callOpenRouter } from "@/lib/openrouter";

export async function POST(request: Request) {
  const response = await callOpenRouter({...});
  return Response.json(response.data);
}
```

```typescript
// ❌ BAD - Client Component
"use client";
import { callOpenRouter } from "@/lib/openrouter"; // NEVER DO THIS!
```

### 2. Use Type-Safe Calls

```typescript
// ✅ GOOD - Fully typed
const response = await callOpenRouterTyped(mySchema, {...});
response.data.propertyName // TypeScript knows this exists!
```

```typescript
// ❌ BAD - Untyped
const response = await callOpenRouter({...});
response.data.propertyName // TypeScript doesn't know what this is
```

### 3. Handle Errors Gracefully

```typescript
// ✅ GOOD - Comprehensive error handling
try {
  const response = await callOpenRouter({...});
  return { success: true, data: response.data };
} catch (error) {
  if (error instanceof OpenRouterError) {
    console.error(`[OpenRouter] ${error.code}:`, error.message);
    return { success: false, error: error.message };
  }
  throw error;
}
```

### 4. Provide Clear Prompts

```typescript
// ✅ GOOD - Clear, specific prompt
const prompt = `Extract the business name, brand color (as hex), and content style from the website.

Business name: The company or organization name
Brand color: Primary color as hex code (e.g., #FF5733)
Content style: One of: professional, casual, technical, creative`;
```

```typescript
// ❌ BAD - Vague prompt
const prompt = "Get info from the site";
```

## Examples

### Example 1: Website Investigation

```typescript
import { callOpenRouterTyped, websiteInvestigationSchema } from "@/lib/openrouter";

async function investigateWebsite(htmlContent: string, url: string) {
  try {
    const response = await callOpenRouterTyped(
      websiteInvestigationSchema,
      {
        prompt: `Extract business information from the website content.
        
        Business name: Company name
        Business description: Brief description of what the company does
        Brand color: Primary brand color as hex
        Content style: Array of applicable styles (e.g., ["professional", "technical"])
        Language: Primary content language (e.g., "en", "es")`,
        input: `URL: ${url}\n\nContent:\n${htmlContent}`,
      }
    );

    return {
      success: true,
      data: response.data,
      tokensUsed: response.tokensUsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

### Example 2: File Analysis

```typescript
import { callOpenRouterTyped, fileInvestigationSchema } from "@/lib/openrouter";

async function analyzeDocument(text: string) {
  const response = await callOpenRouterTyped(
    fileInvestigationSchema,
    {
      prompt: "Extract brand information from this document...",
      input: text,
      temperature: 0.1, // Lower temperature for more consistent extraction
    }
  );

  return response.data;
}
```

## Troubleshooting

### Error: "OPENROUTER_API_KEY environment variable is required"

**Solution:** Add the API key to your environment variables (see Setup section).

### Error: "Request timed out after 30000ms"

**Cause:** OpenRouter API is slow or unresponsive.

**Solution:** 
- Check OpenRouter status
- Reduce input size
- Try again later (automatic retry included)

### Error: "Failed to parse JSON response"

**Cause:** Model returned invalid JSON despite instructions.

**Solution:**
- Check `error.rawResponse` to see what was returned
- Try a different model (e.g., `OPENROUTER_MODELS.PREMIUM`)
- Refine your prompt to be more explicit about JSON format

### Error: "Rate limit exceeded"

**Cause:** Too many requests to OpenRouter.

**Solution:**
- Implement request throttling
- Wait before retrying
- Check your OpenRouter account limits

## Performance Tips

1. **Use the default model** (`gpt-4o-mini`) for most tasks - it's fast and cost-effective
2. **Keep prompts concise** - shorter prompts = fewer tokens = lower cost
3. **Use lower temperature** (0.1-0.3) for extraction tasks - more consistent results
4. **Cache results** when possible - avoid re-analyzing the same content

## Cost Considerations

OpenRouter charges based on tokens used. Approximate costs (as of 2024):

- `gpt-4o-mini`: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- `gpt-4o`: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
- `claude-3.5-sonnet`: ~$3 per 1M input tokens, ~$15 per 1M output tokens

**Tip:** Monitor `response.tokensUsed` to track costs.

## Related Documentation

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [Wizard Auto-fill Implementation](./WIZARD_AUTOFILL_IMPLEMENTATION.md)
