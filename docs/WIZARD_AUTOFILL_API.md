# Wizard Autofill API Documentation

Complete documentation for the wizard autofill endpoints that analyze websites and files using OpenRouter AI.

## Overview

The wizard autofill feature extracts brand information from external sources (websites or uploaded documents) and automatically populates the onboarding wizard fields. It uses:

1. **SSRF-safe website fetching** - Validates URLs and blocks private IPs
2. **Document text extraction** - Parses PDF/DOC/DOCX files
3. **OpenRouter AI analysis** - Structured extraction using admin-configured prompts
4. **Zod validation** - Ensures response matches expected schema
5. **Automatic persistence** - Updates `onboarding_profiles` table
6. **Audit logging** - Tracks all autofill attempts

---

## API Endpoints

### POST /api/v1/onboarding/autofill/website

Analyzes a website URL and populates wizard fields with extracted brand information.

**Authentication:** Required (Supabase Auth session)

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Success Response (200):**
```json
{
  "status": "success" | "partial",
  "message": "Successfully extracted all available information from the website.",
  "missingFields": [],
  "fieldsPopulated": 12,
  "confidence": {
    "brand": 0.95,
    "goals": 0.80,
    "plan": 0.60,
    "connect": 0.40
  },
  "processingTime": 8432
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "status": "fail",
  "message": "Unauthorized",
  "error": "Please sign in"
}

// 422 Invalid URL or SSRF blocked
{
  "status": "fail",
  "message": "Invalid URL",
  "error": "This URL cannot be accessed for security reasons"
}

// 422 Insufficient content
{
  "status": "fail",
  "message": "Could not extract enough content from the website",
  "error": "The website did not have enough readable text to analyze"
}

// 500 Analysis failed
{
  "status": "fail",
  "message": "Failed to analyze website",
  "error": "OpenRouter API error: Rate limit exceeded",
  "processingTime": 3214
}

// 504 Timeout
{
  "status": "fail",
  "message": "Website took too long to respond",
  "error": "The website request timed out. Please try again."
}
```

---

### POST /api/v1/onboarding/autofill/file

Analyzes extracted text from an uploaded file and populates wizard fields.

**Authentication:** Required (Supabase Auth session)

**Request Body:**
```json
{
  "storageFilePath": "user-id/filename.pdf",
  "extractedText": "Full text content extracted from the file...",
  "fileName": "brand-guidelines.pdf"
}
```

**Success Response (200):**
```json
{
  "status": "success" | "partial",
  "message": "Successfully extracted all available information from the file.",
  "missingFields": ["target_platforms", "posting_frequency"],
  "fieldsPopulated": 15,
  "confidence": {
    "brand": 0.98,
    "goals": 0.85,
    "plan": 0.70,
    "connect": 0.50
  },
  "processingTime": 6721
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "status": "fail",
  "message": "Unauthorized",
  "error": "Please sign in"
}

// 403 File access denied
{
  "status": "fail",
  "message": "File not found or access denied",
  "error": "Could not verify file ownership"
}

// 422 Insufficient text
{
  "status": "fail",
  "message": "Could not extract enough content from the file",
  "error": "The file did not contain enough readable text to analyze"
}

// 500 Analysis failed
{
  "status": "fail",
  "message": "Failed to analyze file",
  "error": "Invalid JSON response from AI",
  "processingTime": 4123
}

// 503 AI service unavailable
{
  "status": "fail",
  "message": "AI analysis service unavailable",
  "error": "The AI service is temporarily unavailable. Please try again later."
}
```

---

## Processing Flow

### Website Autofill Flow

```
1. User submits URL
   ↓
2. Authenticate user via Supabase Auth
   ↓
3. Validate URL format and SSRF rules
   ↓
4. Fetch website content (up to 5 pages, 2MB max)
   ↓
5. Extract readable text from HTML
   ↓
6. Load admin-configured website prompt
   ↓
7. Call OpenRouter with prompt + content + schema
   ↓
8. Validate JSON response with Zod
   ↓
9. Map AI response to onboarding schema
   ↓
10. Update onboarding_profiles table
   ↓
11. Log to wizard_autofill_audit
   ↓
12. Return status + populated fields
```

### File Autofill Flow

```
1. User uploads file → /api/v1/onboarding/upload-file
   ↓
2. File saved to Supabase Storage (wizard-uploads bucket)
   ↓
3. Text extracted (PDF/DOC/DOCX)
   ↓
4. User receives storageFilePath + extractedText
   ↓
5. User calls /api/v1/onboarding/autofill/file
   ↓
6. Authenticate user via Supabase Auth
   ↓
7. Verify file ownership via RLS
   ↓
8. Load admin-configured file prompt
   ↓
9. Call OpenRouter with prompt + text + schema
   ↓
10. Validate JSON response with Zod
   ↓
11. Map AI response to onboarding schema
   ↓
12. Update onboarding_profiles table
   ↓
13. Log to wizard_autofill_audit
   ↓
14. Return status + populated fields
```

---

## Server Utilities

### `lib/wizard/autofillServer.ts`

Shared utilities used by both endpoints:

#### `requireAuthenticatedUser()`
Returns authenticated Supabase client and user or throws "Unauthorized"

#### `getPromptSettings(supabase)`
Loads admin-configured prompts from `wizard_autofill_settings` table. Falls back to safe default templates if missing.

#### `analyzeContentWithOpenRouter(promptTemplate, content, sourceType)`
- Injects content and schema guidance into prompt
- Calls OpenRouter with JSON mode
- Validates response with Zod
- Returns analysis result with status, data, missing fields, confidence

#### `persistAutofillResults(supabase, userId, onboardingData, sourceType, sourceValue)`
- Updates `onboarding_profiles` with extracted data
- Sets `ai_filled=true`, `ai_filled_source`, `ai_filled_at`
- Creates profile if doesn't exist

#### `logAutofillAudit(supabase, userId, sourceType, sourceValue, status, ...)`
- Inserts record into `wizard_autofill_audit` table
- Tracks success/partial/fail status, fields populated, confidence scores
- Captures errors for debugging

---

## Response Status Meanings

### `success`
All key fields were successfully extracted. The wizard can be mostly or fully populated from the source.

### `partial`
Some fields were extracted but others are missing. User will need to fill in remaining fields manually. The `missingFields` array indicates which fields couldn't be determined.

### `fail`
Extraction completely failed. No fields were populated. Check `error` field for details.

---

## Confidence Scores

Each section (brand, goals, plan, connect) receives a confidence score from 0.0 to 1.0:

- **0.9 - 1.0**: Very confident, explicit information found
- **0.7 - 0.9**: Confident, good information available
- **0.5 - 0.7**: Moderate confidence, some inference required
- **0.3 - 0.5**: Low confidence, significant guesswork
- **0.0 - 0.3**: Very low confidence, mostly missing

---

## Database Updates

### `onboarding_profiles` Table

Fields updated by autofill:
```sql
-- Brand section
business_name, business_description, website_url,
content_language, article_styles, article_style_links,
brand_color_hex, logo_url

-- Goals section  
goals (array)

-- Plan section
plan_tier, approval_workflow

-- Connect section
(Currently not populated - requires OAuth)

-- Metadata
ai_filled (boolean)
ai_filled_source ('website' | 'file')
ai_filled_at (timestamp)
```

### `wizard_autofill_audit` Table

Each autofill attempt logs:
```sql
user_id
source_type ('website' | 'file')
source_value (URL or filename)
status ('success' | 'partial' | 'fail')
error_message (if failed)
fields_populated (count)
confidence_scores (jsonb)
created_at (timestamp)
```

---

## Admin Configuration

Admins can customize the AI prompts at:
**`/admin/settings/openrouter-prompts`**

Two prompts are configurable:
1. **Website Investigation Prompt** - Used when analyzing websites
2. **File Investigation Prompt** - Used when analyzing uploaded files

Both prompts support placeholders:
- `{CONTENT}` - Replaced with extracted text
- `{SCHEMA_GUIDANCE}` - Replaced with JSON schema specification

Default prompts are defined in `lib/wizard/autofillServer.ts`

---

## Security

### SSRF Protection
- Blocks localhost, 127.0.0.1, 0.0.0.0
- Blocks private IP ranges: 10/8, 172.16/12, 192.168/16
- Blocks link-local: 169.254/16
- Blocks IPv6 loopback and private ranges
- Only allows http:// and https://
- Rejects embedded credentials in URLs

### File Access Control
- Files stored in user-scoped folders: `{user_id}/filename`
- RLS policies enforce user can only access their own files
- File ownership verified before analysis
- Files auto-deleted after 24 hours

### Rate Limiting
OpenRouter calls are subject to:
- API key rate limits (configured in OpenRouter dashboard)
- Retry logic with exponential backoff
- 30-second timeout per request

---

## Error Handling

All errors are logged with `console.error` and `[v0]` prefix for debugging.

Common errors:
- **"Unauthorized"** - User not signed in
- **"SSRF blocked"** - URL not allowed
- **"Insufficient content"** - Not enough text to analyze
- **"OpenRouter API error"** - AI service failure
- **"Validation failed"** - AI response didn't match schema
- **"Rate limit exceeded"** - Too many requests to OpenRouter

---

## Testing

### Manual Testing

**Website Autofill:**
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/autofill/website \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-{project}-auth-token={token}" \
  -d '{"url": "https://vercel.com"}'
```

**File Autofill:**
```bash
# First upload file
curl -X POST http://localhost:3000/api/v1/onboarding/upload-file \
  -H "Cookie: sb-{project}-auth-token={token}" \
  -F "file=@brand-guide.pdf"

# Then analyze
curl -X POST http://localhost:3000/api/v1/onboarding/autofill/file \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-{project}-auth-token={token}" \
  -d '{
    "storageFilePath": "user-id/filename.pdf",
    "extractedText": "...",
    "fileName": "brand-guide.pdf"
  }'
```

### Unit Tests

```bash
# Run URL validation tests
npm test -- urlValidator.test.ts

# Run content extraction tests
npm test -- contentExtractor.test.ts
```

---

## Monitoring

### Check Audit Logs

```sql
-- Recent autofill attempts
SELECT 
  user_id,
  source_type,
  source_value,
  status,
  fields_populated,
  created_at
FROM wizard_autofill_audit
ORDER BY created_at DESC
LIMIT 50;

-- Success rate by source type
SELECT 
  source_type,
  status,
  COUNT(*) as attempts,
  AVG(fields_populated) as avg_fields
FROM wizard_autofill_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_type, status;

-- Failed attempts with errors
SELECT 
  user_id,
  source_type,
  source_value,
  error_message,
  created_at
FROM wizard_autofill_audit
WHERE status = 'fail'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### No fields populated (partial status)

**Cause:** AI couldn't extract information confidently
**Solution:** 
- Check if source has enough content
- Review AI confidence scores
- Adjust admin prompts for better extraction

### "Validation failed" errors

**Cause:** AI response doesn't match Zod schema
**Solution:**
- Check OpenRouter logs for actual response
- Verify schema guidance is included in prompt
- Ensure JSON mode is enabled

### Timeouts

**Cause:** Website slow to respond or OpenRouter delays
**Solution:**
- Increase timeout in `fetchSiteContent` options
- Check website availability
- Verify OpenRouter API status

### SSRF blocks legitimate URLs

**Cause:** URL contains private IP or resolves to private network
**Solution:**
- Verify URL is publicly accessible
- Check DNS resolution
- Review SSRF rules if over-blocking

---

## Future Enhancements

- [ ] Support for more file formats (TXT, RTF, etc.)
- [ ] Image OCR for logos and brand colors
- [ ] Screenshot capture for visual brand analysis
- [ ] Batch processing for multiple URLs
- [ ] Confidence threshold configuration
- [ ] Manual field override UI
- [ ] A/B testing of different prompts
- [ ] Token usage tracking and optimization
