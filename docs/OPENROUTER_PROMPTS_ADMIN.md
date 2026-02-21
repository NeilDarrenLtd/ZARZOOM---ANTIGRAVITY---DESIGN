# OpenRouter Prompts Admin Settings

## Overview

The OpenRouter Prompts admin page allows administrators to configure the AI prompts used in the wizard auto-fill feature. This page provides a simple interface to customize how the AI extracts brand information from websites and uploaded files.

## Access

- **Route:** `/admin/settings/openrouter-prompts`
- **Required Role:** Admin only
- **Authentication:** Server-side RBAC enforcement via `requireAdmin()` guard

## Features

### 1. Prompt Configuration

Two separate prompts can be configured:

- **Website Investigation Prompt** - Used when users provide a website URL
- **File Investigation Prompt** - Used when users upload a PDF or Word document

Both prompts support up to 10,000 characters and use monospace font for better readability.

### 2. Auto-save Detection

- Real-time tracking of unsaved changes
- Visual indicator when changes are pending
- Keyboard shortcut: `Cmd/Ctrl + S` to save

### 3. Reset to Defaults

- One-click reset to default prompt templates
- Confirmation step to prevent accidental resets
- Default templates include best-practice instructions for brand extraction

### 4. Metadata Display

- Last updated timestamp
- User ID of last editor
- Format: "Last updated: Feb 21, 2026 at 3:45 PM • User ID: abc12345..."

## API Endpoints

### GET `/api/v1/admin/settings/openrouter-prompts`

Fetch current prompt settings.

**Response:**
```json
{
  "data": {
    "website_prompt": "string | null",
    "file_prompt": "string | null",
    "feature_enabled": true,
    "updated_at": "2026-02-21T15:45:00Z",
    "updated_by": "user-uuid"
  }
}
```

### PUT `/api/v1/admin/settings/openrouter-prompts`

Update prompt settings.

**Request:**
```json
{
  "website_prompt": "string | null",
  "file_prompt": "string | null",
  "feature_enabled": true
}
```

**Response:** Same as GET

### POST `/api/v1/admin/settings/openrouter-prompts/reset`

Reset prompts to default templates.

**Response:** Same as GET with default values

## Security

### Server-Side RBAC

All endpoints use the `isUserAdmin()` function from `/lib/auth/rbac.ts`:

```typescript
const admin = await isUserAdmin(supabase, user.id);
if (!admin) {
  return NextResponse.json(
    { error: { message: "Forbidden: Admin access required" } },
    { status: 403 }
  );
}
```

### Database RLS Policies

The `wizard_autofill_settings` table has RLS policies that enforce admin-only access:

- **SELECT:** Only admins can read settings
- **INSERT/UPDATE:** Only admins can modify settings
- Uses `public.is_admin()` security definer function to avoid RLS recursion

### Client-Side Protection

The admin layout (`/app/admin/layout.tsx`) performs client-side checks to show/hide the settings link, but **all security enforcement happens server-side**.

## Default Prompt Templates

### Website Prompt

```
You are an AI assistant that extracts brand information from websites. 

Given a website URL and its content, extract the following information:
1. Business name
2. Business description (1-2 sentences)
3. Primary brand color (hex code)
4. Suggested article writing styles

Return your response as a JSON object with these exact keys:
{
  "business_name": "string",
  "business_description": "string",
  "brand_color_hex": "#RRGGBB",
  "article_styles": ["style1", "style2"]
}
```

### File Prompt

```
You are an AI assistant that extracts brand information from documents.

Given a document (PDF or Word), extract the following information:
1. Business name
2. Business description (1-2 sentences)
3. Primary brand color (hex code) if mentioned
4. Suggested article writing styles

Return your response as a JSON object with these exact keys:
{
  "business_name": "string",
  "business_description": "string",
  "brand_color_hex": "#RRGGBB or null",
  "article_styles": ["style1", "style2"]
}
```

## Usage in Wizard

When users click "Auto-fill from website" or "Analyse file" in the onboarding wizard:

1. Frontend sends request to auto-fill API
2. API fetches prompt settings using `get_wizard_autofill_settings()` function
3. Prompt is sent to OpenRouter API with user's website/file content
4. AI response is parsed and used to populate wizard fields
5. Audit log entry is created via `log_wizard_autofill()` function

## Reusable RBAC Guard

The `requireAdmin()` function in `/lib/auth/rbac.ts` can be used in other admin pages:

```typescript
import { requireAdmin } from "@/lib/auth/rbac";

export default async function MyAdminPage() {
  const { user, supabase } = await requireAdmin();
  
  // Page is now guaranteed to have an authenticated admin user
  // ...rest of page logic
}
```

This provides consistent, reusable admin access control across the application.

## Future Enhancements

- [ ] Add OpenRouter API key configuration (currently expects env var)
- [ ] Add prompt version history and rollback
- [ ] Add prompt testing UI to preview AI responses
- [ ] Add prompt templates library with examples
- [ ] Add usage analytics (how many times each prompt was used)
