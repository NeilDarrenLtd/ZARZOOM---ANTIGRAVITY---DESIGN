# Wizard Auto-Fill Schema Guide

Complete reference for the `WizardAutoFillSchema` - the canonical data structure for AI-extracted brand information.

---

## Overview

The `WizardAutoFillSchema` defines the structure for data extracted by OpenRouter LLMs from websites or uploaded files. This schema ensures:

- **Type safety** with Zod validation
- **Structured extraction** with clear field definitions
- **Quality control** through confidence scoring
- **Compatibility** with the existing onboarding wizard

---

## Schema Structure

### Complete Type Definition

```typescript
type WizardAutoFillPayload = {
  brand?: {
    business_name?: string;
    short_description?: string; // 10-280 chars
    long_description?: string; // 20-2000 chars
    industry?: string;
    tone_voice?: "professional" | "casual" | "friendly" | "authoritative" | "playful" | "inspirational" | "educational" | "conversational";
    target_audience?: string;
    location?: string;
    website?: string; // URL
    brand_colours?: string[]; // Array of hex colors, max 5
    social_links?: {
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      youtube?: string;
      tiktok?: string;
    };
    content_language?: string; // ISO language code
    article_styles?: ArticleStyle[]; // From onboarding schema
    style_reference_links?: string[]; // URLs, max 3
    logo_guidance?: string; // Description if logo found
  };
  goals?: {
    primary_goals?: Goal[]; // Max 3
    secondary_goals?: Goal[]; // Max 3
    target_platforms?: ("facebook" | "twitter" | "linkedin" | "instagram" | "youtube" | "tiktok" | "blog")[];
    posting_frequency?: "daily" | "3_per_week" | "weekly" | "bi_weekly" | "monthly";
    kpis?: ("traffic" | "conversions" | "engagement" | "followers" | "revenue" | "brand_awareness")[];
  };
  plan?: {
    suggested_tier?: "basic" | "pro" | "scale";
    cadence_recommendation?: "daily" | "3_per_week" | "weekly" | "bi_weekly" | "monthly";
    approvals_workflow?: "auto" | "manual";
    collaboration_notes?: string;
  };
  connect?: {
    required_social_accounts?: ("facebook" | "twitter" | "linkedin" | "instagram" | "youtube" | "tiktok")[];
    onboarding_notes?: string;
  };
  metadata?: {
    confidence_by_section?: {
      brand?: "high" | "medium" | "low";
      goals?: "high" | "medium" | "low";
      plan?: "high" | "medium" | "low";
      connect?: "high" | "medium" | "low";
    };
    missing_fields?: string[];
    extraction_notes?: string;
    source_type?: "website" | "file";
    extracted_at?: string; // ISO datetime
  };
};
```

---

## Field Descriptions

### Brand Section

| Field | Type | Max Length | Description |
|-------|------|------------|-------------|
| `business_name` | string | 200 | Official business/company name |
| `short_description` | string | 280 | Tweet-length elevator pitch |
| `long_description` | string | 2000 | Full business description |
| `industry` | string | 100 | Industry/sector (e.g., "Technology", "Healthcare") |
| `tone_voice` | enum | - | Writing style/brand voice |
| `target_audience` | string | 500 | Ideal customer description |
| `location` | string | 200 | Geographic location |
| `website` | URL | - | Primary website URL |
| `brand_colours` | string[] | 5 items | Hex colors (e.g., ["#FF5500", "#0066CC"]) |
| `social_links` | object | - | Social media profile URLs |
| `content_language` | string | 10 | ISO language code (e.g., "en", "es") |
| `article_styles` | enum[] | 5 items | Preferred content styles |
| `style_reference_links` | URL[] | 3 items | Example articles to emulate |
| `logo_guidance` | string | 500 | Logo description if visible |

### Goals Section

| Field | Type | Max Items | Description |
|-------|------|-----------|-------------|
| `primary_goals` | Goal[] | 3 | Most important business goals |
| `secondary_goals` | Goal[] | 3 | Supporting goals |
| `target_platforms` | enum[] | 5 | Social platforms to target |
| `posting_frequency` | enum | - | Desired content cadence |
| `kpis` | enum[] | 4 | Key performance indicators |

### Plan Section

| Field | Type | Description |
|-------|------|-------------|
| `suggested_tier` | enum | Recommended subscription plan |
| `cadence_recommendation` | enum | AI-recommended posting frequency |
| `approvals_workflow` | enum | Suggested approval process |
| `collaboration_notes` | string | Team size/structure notes |

### Connect Section

| Field | Type | Description |
|-------|------|-------------|
| `required_social_accounts` | enum[] | Social accounts to connect |
| `onboarding_notes` | string | Additional setup guidance |

### Metadata Section

| Field | Type | Description |
|-------|------|-------------|
| `confidence_by_section` | object | Confidence level per section |
| `missing_fields` | string[] | Fields AI couldn't extract |
| `extraction_notes` | string | Internal notes about extraction |
| `source_type` | enum | Whether from website or file |
| `extracted_at` | datetime | When extraction occurred |

---

## Usage Examples

### 1. Validating AI Response

```typescript
import { validateAndNormaliseAutoFill } from "@/lib/validation/wizardAutofillSchema";

// Raw response from OpenRouter
const aiResponse = await openRouterClient.chat(/* ... */);

// Validate and normalize
const result = validateAndNormaliseAutoFill(aiResponse);

if (result.success) {
  console.log("✓ Valid data extracted");
  console.log("Partial extraction:", result.isPartial);
  console.log("Missing fields:", result.missingFields);
  
  // Use the validated data
  const data = result.data;
} else {
  console.error("✗ Validation failed:", result.errors);
}
```

### 2. Mapping to Onboarding Format

```typescript
import { mapAutoFillToOnboarding } from "@/lib/validation/wizardAutofillMapper";

const result = validateAndNormaliseAutoFill(aiResponse);

if (result.success && result.data) {
  // Transform to wizard format
  const wizardData = mapAutoFillToOnboarding(result.data);
  
  // Update wizard state
  onChange(wizardData);
}
```

### 3. Merging with Existing Data

```typescript
import { mergeWithExistingState } from "@/lib/validation/wizardAutofillMapper";

const currentState = { business_name: "Acme Corp", /* ... */ };
const aiData = mapAutoFillToOnboarding(validatedPayload);

// Merge without overwriting user edits
const merged = mergeWithExistingState(
  currentState,
  aiData,
  false // Don't overwrite existing values
);

onChange(merged);
```

### 4. Generating User Feedback

```typescript
import { 
  generateExtractionSummary,
  generateConfidenceReport 
} from "@/lib/validation/wizardAutofillSchema";

const result = validateAndNormaliseAutoFill(aiResponse);

if (result.success && result.data) {
  // Show summary to user
  const summary = generateExtractionSummary(result);
  console.log(summary); // "Partial extraction: Brand (7 fields), Goals (3 fields)"
  
  // Show confidence levels
  const confidence = generateConfidenceReport(result.data);
  console.log(`Overall confidence: ${confidence.overall}`);
  console.log(`Brand: ${confidence.details.brand}`);
}
```

---

## LLM Prompt Integration

The schema includes a pre-formatted JSON schema guidance string for OpenRouter prompts:

```typescript
import { WIZARD_AUTOFILL_JSON_SCHEMA_GUIDANCE } from "@/lib/validation/wizardAutofillSchema";

const systemPrompt = `
You are an AI assistant that extracts brand information from websites.

${WIZARD_AUTOFILL_JSON_SCHEMA_GUIDANCE}

Now analyze the following website content...
`;
```

This guidance string:
- Defines the exact JSON structure expected
- Lists all valid enum values
- Provides validation rules (lengths, formats)
- Includes extraction best practices
- Emphasizes quality over quantity

---

## Validation Rules

### Automatic Validation

The schema automatically validates:

- **String lengths** - Min/max character counts
- **URL formats** - Must be valid URLs with protocol
- **Hex colors** - Must match `#RRGGBB` format
- **Enum values** - Must be from predefined lists
- **Array limits** - Max items enforced
- **Required formats** - Datetime strings, language codes

### Custom Validation

The `validateAndNormaliseAutoFill` function provides:

- **Partial detection** - Identifies incomplete extractions
- **Missing field tracking** - Lists what couldn't be extracted
- **Confidence scoring** - Uses metadata to assess quality
- **Error details** - Zod validation errors for debugging

---

## Confidence Levels

### Definition

- **High (90%+)** - Very confident in extracted data
- **Medium (60-89%)** - Reasonably confident, may need review
- **Low (<60%)** - Uncertain, user should verify

### Setting Confidence

The AI should set confidence based on:

1. **Source quality** - Clear vs ambiguous content
2. **Field specificity** - Direct mention vs inference
3. **Consistency** - Corroborated across multiple sources
4. **Completeness** - Full data vs partial information

### Using Confidence

```typescript
const confidence = generateConfidenceReport(payload);

if (confidence.overall === "high") {
  // Auto-fill directly
} else if (confidence.overall === "medium") {
  // Fill with user review prompt
} else {
  // Show as suggestions only
}
```

---

## Error Handling

### Validation Errors

```typescript
const result = validateAndNormaliseAutoFill(payload);

if (!result.success) {
  // Access Zod validation errors
  result.errors?.issues.forEach(issue => {
    console.error(`${issue.path.join(".")}: ${issue.message}`);
  });
}
```

### Missing Data

```typescript
if (result.isPartial) {
  console.warn("Incomplete extraction");
  console.warn("Missing:", result.missingFields);
  
  // Show user what fields need manual entry
  showPartialExtractionWarning(result.missingFields);
}
```

---

## Best Practices

### For AI Prompts

1. **Be conservative** - Only extract what you're confident about
2. **Set honest confidence** - Don't inflate confidence levels
3. **List missing fields** - Help users know what to fill manually
4. **Validate URLs** - Ensure they're complete and accessible
5. **Extract brand colors** - Look for consistent design colors
6. **Infer intelligently** - Use business context for goals/plan

### For UI Integration

1. **Show confidence** - Use colors/icons to indicate quality
2. **Allow review** - Let users verify before accepting
3. **Highlight partial** - Clearly mark incomplete sections
4. **Preserve edits** - Don't overwrite user's manual entries
5. **Provide context** - Show extraction notes to help users

### For API Implementation

1. **Validate early** - Check schema before database write
2. **Log metadata** - Store confidence and extraction notes
3. **Handle failures gracefully** - Fallback to manual entry
4. **Audit extractions** - Track success rates and quality
5. **Rate limit** - Prevent excessive API calls

---

## Database Integration

### Storing Auto-Fill Data

```typescript
// Save to onboarding_profiles
const wizardData = mapAutoFillToOnboarding(validatedPayload);

await supabase
  .from("onboarding_profiles")
  .update({
    ...wizardData,
    ai_filled_at: new Date().toISOString(),
    ai_filled_source: "website", // or "file"
    ai_confidence: "high", // from metadata
  })
  .eq("user_id", userId);
```

### Audit Logging

```typescript
// Log extraction attempt
await supabase
  .from("wizard_autofill_audit")
  .insert({
    user_id: userId,
    source_type: "website",
    source_value: "https://example.com",
    status: result.isPartial ? "partial" : "success",
    extracted_fields: Object.keys(wizardData),
    confidence_score: confidence.overall,
  });
```

---

## Testing

### Example Valid Payload

```json
{
  "brand": {
    "business_name": "TechStart Solutions",
    "short_description": "We help startups build scalable software products",
    "long_description": "TechStart Solutions is a software development agency...",
    "industry": "Technology",
    "tone_voice": "professional",
    "target_audience": "Startup founders and CTOs",
    "website": "https://techstart.example.com",
    "brand_colours": ["#FF5500", "#0066CC"],
    "content_language": "en",
    "article_styles": ["how_to_guides", "case_studies"]
  },
  "goals": {
    "primary_goals": ["build_brand_authority", "get_more_subscribers_leads"],
    "target_platforms": ["linkedin", "twitter"],
    "posting_frequency": "3_per_week"
  },
  "plan": {
    "suggested_tier": "pro",
    "approvals_workflow": "manual"
  },
  "metadata": {
    "confidence_by_section": {
      "brand": "high",
      "goals": "medium"
    },
    "missing_fields": ["logo_guidance", "social_links"],
    "source_type": "website",
    "extracted_at": "2024-02-21T10:30:00Z"
  }
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Validation fails with "Must be a valid URL"
- **Cause**: Missing protocol (http/https)
- **Fix**: Ensure URLs include `https://`

**Issue**: Colors rejected with format error
- **Cause**: Invalid hex format
- **Fix**: Use exactly 6 characters: `#RRGGBB`

**Issue**: Enum validation fails
- **Cause**: Invalid enum value
- **Fix**: Check allowed values in schema definition

**Issue**: All sections show low confidence
- **Cause**: Poor quality source data
- **Fix**: Try different prompt or ask user for better source

---

## Future Enhancements

Potential schema extensions:

1. **Logo extraction** - Direct logo file upload support
2. **Competitor analysis** - Extracted competitor URLs
3. **Industry keywords** - SEO-relevant terms
4. **Content calendar** - Suggested posting schedule
5. **Audience demographics** - Age, location, interests
6. **Pricing information** - Product/service pricing

---

## Related Documentation

- [Onboarding Validation Schema](/lib/validation/onboarding.ts)
- [OpenRouter Client](/docs/OPENROUTER_CLIENT.md)
- [Database Schema](/docs/WIZARD_AUTOFILL_SCHEMA.md)
- [API Implementation](/docs/WIZARD_AUTOFILL_IMPLEMENTATION.md)
