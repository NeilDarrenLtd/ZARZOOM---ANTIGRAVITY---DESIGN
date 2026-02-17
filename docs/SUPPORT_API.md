# Support Ticket API Documentation

This document describes the REST API endpoints for the internal support ticket system.

## Table of Contents

- [Authentication](#authentication)
- [User Endpoints](#user-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Testing](#testing)

---

## Authentication

All endpoints require authentication via:
- **Session cookies** (browser-initiated requests)
- **Bearer token** in `Authorization` header (API/machine-to-machine)

Admin endpoints require the user to have the `admin` role.

---

## User Endpoints

### List User's Tickets

```http
GET /api/v1/support/tickets
```

Returns a list of tickets created by the authenticated user.

**Response:**
```json
{
  "tickets": [
    {
      "ticket_id": "uuid",
      "subject": "Cannot access dashboard",
      "status": "open",
      "priority": "high",
      "category": "technical",
      "last_activity_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-15T09:00:00Z"
    }
  ]
}
```

**Rate Limit:** 60 requests per minute

---

### Create Ticket

```http
POST /api/v1/support/tickets
```

Creates a new support ticket with an initial comment.

**Request Body:**
```json
{
  "subject": "Cannot access dashboard",
  "description": "When I try to log in, I get a 404 error.",
  "category": "technical",
  "priority": "high"
}
```

**Validation:**
- `subject`: Required, 1-200 characters
- `description`: Required, 1-10000 characters
- `category`: Optional, one of: `technical`, `billing`, `feature_request`, `bug_report`, `general`, `other`
- `priority`: Optional, one of: `low`, `medium`, `high`, `urgent` (default: `medium`)

**Response:**
```json
{
  "ticket": {
    "ticket_id": "uuid",
    "subject": "Cannot access dashboard",
    "status": "open",
    "priority": "high",
    "category": "technical",
    "created_at": "2024-01-15T09:00:00Z",
    "first_comment_id": "uuid"
  }
}
```

**Rate Limit:** 10 requests per minute

---

### Get Ticket Details

```http
GET /api/v1/support/tickets/{id}
```

Returns ticket details with all comments and attachment metadata.

**Response:**
```json
{
  "ticket": {
    "ticket_id": "uuid",
    "subject": "Cannot access dashboard",
    "status": "investigating",
    "priority": "high",
    "category": "technical",
    "last_activity_at": "2024-01-15T11:00:00Z",
    "created_at": "2024-01-15T09:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "comments": [
    {
      "comment_id": "uuid",
      "message": "When I try to log in, I get a 404 error.",
      "author_role": "user",
      "created_at": "2024-01-15T09:00:00Z",
      "support_attachments": [
        {
          "attachment_id": "uuid",
          "file_name": "error-screenshot.png",
          "file_type": "image/png",
          "file_size": 245760,
          "created_at": "2024-01-15T09:05:00Z"
        }
      ]
    },
    {
      "comment_id": "uuid",
      "message": "We're investigating this issue. Can you clear your cache?",
      "author_role": "admin",
      "created_at": "2024-01-15T10:30:00Z",
      "support_attachments": []
    }
  ]
}
```

**Rate Limit:** 60 requests per minute

---

### Add Comment to Ticket

```http
POST /api/v1/support/tickets/{id}/comments
```

Adds a comment to an existing ticket.

**Request Body:**
```json
{
  "message": "I cleared the cache but still getting the error."
}
```

**Validation:**
- `message`: Required, 1-10000 characters

**Response:**
```json
{
  "comment": {
    "comment_id": "uuid",
    "message": "I cleared the cache but still getting the error.",
    "author_role": "user",
    "created_at": "2024-01-15T11:00:00Z"
  }
}
```

**Rate Limit:** 30 requests per minute

---

### Upload Attachments

```http
POST /api/v1/support/tickets/{ticketId}/comments/{commentId}/attachments
```

Uploads screenshot attachments for a comment (server-side multipart upload).

**Request:** `multipart/form-data`

```
file1: <file>
file2: <file>
file3: <file>
```

**Validation:**
- Maximum 3 files per request
- Allowed types: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
- Maximum file size: 5MB per file

**Response:**
```json
{
  "attachments": [
    {
      "attachment_id": "uuid",
      "file_name": "screenshot1.png",
      "file_type": "image/png",
      "file_size": 245760,
      "created_at": "2024-01-15T11:05:00Z"
    }
  ]
}
```

**Rate Limit:** 20 requests per minute

**Note:** Files are uploaded to Supabase Storage bucket `support-attachments` with private access.

---

### Get Attachment Signed URL

```http
GET /api/v1/support/attachments/{attachmentId}/signed-url
```

Generates a signed download URL for an attachment (5-minute expiry).

**Response:**
```json
{
  "signedUrl": "https://storage.supabase.co/...",
  "expiresIn": 300
}
```

**Rate Limit:** 100 requests per minute

---

## Admin Endpoints

### List All Tickets (Admin)

```http
GET /api/v1/admin/support/tickets
```

Lists all tickets with optional filters.

**Query Parameters:**
- `status`: Filter by status (`open`, `investigating`, `waiting_on_user`, `resolved`, `closed`)
- `priority`: Filter by priority (`low`, `medium`, `high`, `urgent`)
- `category`: Filter by category
- `search`: Search in ticket ID, subject, or user email
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Example:**
```http
GET /api/v1/admin/support/tickets?status=open&priority=high&page=1&limit=20
```

**Response:**
```json
{
  "tickets": [
    {
      "ticket_id": "uuid",
      "subject": "Cannot access dashboard",
      "status": "open",
      "priority": "high",
      "category": "technical",
      "last_activity_at": "2024-01-15T11:00:00Z",
      "created_at": "2024-01-15T09:00:00Z",
      "user_id": "uuid",
      "profiles": {
        "email": "user@example.com",
        "full_name": "John Doe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Rate Limit:** 60 requests per minute

---

### Update Ticket (Admin)

```http
PATCH /api/v1/admin/support/tickets/{id}
```

Updates ticket fields (status, priority, category).

**Request Body:**
```json
{
  "status": "investigating",
  "priority": "high",
  "category": "technical"
}
```

**Validation:**
- All fields optional
- `status`: One of: `open`, `investigating`, `waiting_on_user`, `resolved`, `closed`
- `priority`: One of: `low`, `medium`, `high`, `urgent`
- `category`: One of: `technical`, `billing`, `feature_request`, `bug_report`, `general`, `other`

**Response:**
```json
{
  "ticket": {
    "ticket_id": "uuid",
    "subject": "Cannot access dashboard",
    "status": "investigating",
    "priority": "high",
    "category": "technical",
    "updated_at": "2024-01-15T12:00:00Z",
    "last_activity_at": "2024-01-15T12:00:00Z"
  }
}
```

**Rate Limit:** 30 requests per minute

---

### Add Admin Comment

```http
POST /api/v1/admin/support/tickets/{id}/comments
```

Adds an admin comment to a ticket.

**Request Body:**
```json
{
  "message": "We've identified the issue and are working on a fix."
}
```

**Response:**
```json
{
  "comment": {
    "comment_id": "uuid",
    "message": "We've identified the issue and are working on a fix.",
    "author_role": "admin",
    "created_at": "2024-01-15T12:00:00Z"
  }
}
```

**Rate Limit:** 30 requests per minute

---

### Get Support Settings (Admin)

```http
GET /api/v1/admin/support/settings
```

Retrieves the current support recipient email configuration.

**Response:**
```json
{
  "settings": {
    "support_recipient_email": "support@company.com",
    "updated_at": "2024-01-10T08:00:00Z"
  }
}
```

**Rate Limit:** 30 requests per minute

---

### Update Support Settings (Admin)

```http
PUT /api/v1/admin/support/settings
```

Updates the support recipient email.

**Request Body:**
```json
{
  "support_recipient_email": "support@company.com"
}
```

**Validation:**
- `support_recipient_email`: Required, valid email format

**Response:**
```json
{
  "settings": {
    "support_recipient_email": "support@company.com",
    "updated_at": "2024-01-15T12:30:00Z"
  }
}
```

**Rate Limit:** 10 requests per minute

---

## Error Handling

All errors follow a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "subject": ["support.validation.subjectRequired"]
    },
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 402 | Usage quota exceeded |

### Translation Keys

Error messages use translation keys for i18n support:

- `support.validation.subjectRequired`
- `support.validation.descriptionRequired`
- `support.validation.messageRequired`
- `support.validation.invalidFileType`
- `support.validation.fileTooLarge`
- `support.validation.tooManyFiles`
- `support.validation.noFilesProvided`
- `support.validation.invalidEmail`
- `support.validation.emailRequired`
- `support.validation.noUpdatesProvided`

---

## Rate Limits

Rate limits are applied per tenant:

| Endpoint Type | Limit |
|---------------|-------|
| List/Get | 60 requests/minute |
| Create Ticket | 10 requests/minute |
| Add Comment | 30 requests/minute |
| Upload Attachments | 20 requests/minute |
| Download Attachments | 100 requests/minute |
| Admin Updates | 30 requests/minute |
| Admin Settings | 10 requests/minute (PUT) |

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1705318800
```

---

## Testing

### Manual Testing with cURL

**Create a ticket:**
```bash
curl -X POST http://localhost:3000/api/v1/support/tickets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test ticket",
    "description": "This is a test",
    "priority": "medium",
    "category": "technical"
  }'
```

**Upload attachment:**
```bash
curl -X POST http://localhost:3000/api/v1/support/tickets/TICKET_ID/comments/COMMENT_ID/attachments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file1=@screenshot.png"
```

### Automated Testing

Run the smoke test script:

```bash
# Set environment variables
export TEST_USER_TOKEN="your_user_token"
export TEST_ADMIN_TOKEN="your_admin_token"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Run tests
npx tsx scripts/support-api-smoke.ts
```

---

## Storage Bucket Setup

Create the Supabase Storage bucket manually:

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `support-attachments`
3. Set as **private** (not public)
4. Add RLS policies as documented in `SUPPORT_TICKET_SYSTEM.md`

---

## Database Schema

See `docs/SUPPORT_TICKET_SYSTEM.md` for complete database schema documentation including:
- Table structures
- RLS policies
- Triggers and constraints
- Migration script

---

## Support

For issues or questions about the API, please create a support ticket using the system itself or contact the development team.
