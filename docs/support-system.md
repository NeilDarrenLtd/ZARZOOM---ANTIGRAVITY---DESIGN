# Support Ticket System - Documentation

## Overview

The ZARZOOM support system allows users to create and manage support tickets with a complete admin management console. The system includes email notifications, file attachments, status management, and comprehensive RBAC security.

## Routes

### User Routes (`/dashboard/support`)

| Route | Description |
|-------|-------------|
| `/dashboard/support` | Support landing page with action cards |
| `/dashboard/support/tickets` | List of user's tickets |
| `/dashboard/support/tickets/new` | Create new ticket form |
| `/dashboard/support/tickets/[id]` | Ticket detail with comment thread |

### Admin Routes (`/admin/support`)

| Route | Description |
|-------|-------------|
| `/admin/support` | Admin ticket list with filters and search |
| `/admin/support/tickets/[id]` | Admin ticket detail with status controls |
| `/admin/support/settings` | Configure support recipient email |

## API Routes

### User API Endpoints

```
GET    /api/v1/support/tickets                                      # List user's tickets
POST   /api/v1/support/tickets                                      # Create new ticket
GET    /api/v1/support/tickets/[id]                                 # Get ticket details
POST   /api/v1/support/tickets/[id]/comments                        # Add comment
POST   /api/v1/support/tickets/[id]/comments/[commentId]/attachments # Upload attachments
GET    /api/v1/support/attachments/[attachmentId]/signed-url        # Get signed download URL
```

### Admin API Endpoints

```
GET    /api/v1/admin/support/tickets                         # List all tickets (with filters)
PATCH  /api/v1/admin/support/tickets/[id]                    # Update ticket (status/priority/category)
POST   /api/v1/admin/support/tickets/[id]/comments           # Add admin comment
GET    /api/v1/admin/support/settings                        # Get support settings
PUT    /api/v1/admin/support/settings                        # Update support settings
```

## Status Lifecycle

Tickets progress through the following statuses:

1. **open** - New ticket created by user
2. **investigating** - Admin is looking into the issue
3. **waiting_on_user** - Admin needs more info from user
4. **resolved** - Issue has been fixed/answered
5. **closed** - Ticket is closed (no further action)

**Status Transitions:**
- Users can only create tickets (status: `open`)
- Only admins can change ticket status
- Status changes trigger email notifications to users

## Priority Levels

- **low** - Non-urgent inquiry
- **medium** - Standard support request (default)
- **high** - Important issue affecting functionality
- **urgent** - Critical issue requiring immediate attention

## Categories

- **technical** - Technical issues or bugs
- **billing** - Billing and subscription questions
- **account** - Account management
- **feature_request** - Feature suggestions
- **other** - General inquiries

## File Attachments

### Constraints

- **Allowed types:** PNG, JPG/JPEG, WebP
- **Max file size:** 5MB per file
- **Max files per comment:** 3 files
- **Storage:** Supabase Storage bucket `support-attachments`

### Security

- Server-side validation enforces file type, size, and count limits
- Orphan prevention: Files deleted if database insert fails
- Signed URLs required for viewing (5-minute expiry)
- RLS policies ensure users can only access their own ticket attachments

## Email Notifications

Emails are sent automatically for:

1. **New Ticket Created** - Sent to support recipient email
2. **User Comment Added** - Sent to support team
3. **Admin Reply** - Sent to ticket owner
4. **Status Changed** - Sent to ticket owner

### Configure Support Email

1. Log in as admin
2. Navigate to **Admin → Support Console → Settings** (`/admin/support/settings`)
3. Enter the support recipient email address
4. Click **Save Settings**

This email will receive notifications for all new tickets and user comments.

## RBAC & Security

### Row Level Security (RLS)

All database tables have RLS enabled:

**support_tickets:**
- Users can SELECT/INSERT only their own tickets
- Admins can SELECT/UPDATE all tickets

**support_comments:**
- Users can SELECT/INSERT comments only on their own tickets
- Admins can SELECT/INSERT comments on any ticket

**support_attachments:**
- Users can SELECT/INSERT attachments only for their own tickets
- Admins can SELECT all attachments

**support_settings:**
- Only admins can SELECT/INSERT/UPDATE

### API Security

- All routes require authentication (`auth: true`)
- Rate limiting applied to all endpoints
- Server-side RBAC checks using `is_admin()` function
- Ownership verification for user routes
- Zod validation on all request bodies

## Database Schema

### Tables

1. **support_settings** - Support configuration (recipient email)
2. **support_tickets** - Main ticket records
3. **support_comments** - Comment thread for tickets
4. **support_attachments** - File attachment metadata

### Automatic Updates

- **last_activity_at** - Updated via database trigger on comment creation
- **updated_at** - Updated via trigger on ticket/settings changes

## Testing Attachments

### Upload Test

1. Create a test ticket as a user
2. Add a comment with 1-3 screenshot files (PNG/JPG/WebP, under 5MB each)
3. Submit the comment
4. Verify files appear as thumbnails
5. Click thumbnail to view full-size image via signed URL

### Validation Test

Try these to test server-side validation:
- Upload 4 files (should fail - max 3)
- Upload a 6MB file (should fail - max 5MB)
- Upload a PDF or TXT file (should fail - wrong type)

### Orphan Prevention Test

1. Upload files to a comment
2. Simulate a database failure (disconnect database temporarily)
3. Verify uploaded files are cleaned up (not orphaned in storage)

## Admin Workflow

### Responding to Tickets

1. Navigate to **Admin → Support Console**
2. View tickets filtered by status
3. Click **View** on a ticket
4. Review ticket details and conversation
5. Update status/priority/category as needed
6. Reply to user via admin comment form
7. Attach screenshots if needed
8. Mark as **Resolved** when complete

### Managing Settings

- Set support recipient email in **Settings** tab
- This email receives all new ticket notifications
- Update anytime; change takes effect immediately

## Translations

All UI strings use translation keys from `locales/en.json` under:
- `support.*` - User-facing strings
- `adminSupport.*` - Admin-facing strings
- `support.validation.*` - Validation error messages
- `support.status.*` - Status labels
- `support.category.*` - Category labels
- `support.priority.*` - Priority labels

## Troubleshooting

### Emails Not Sending

1. Check SMTP settings in **Admin → Settings → Email**
2. Verify support recipient email in **Admin → Support → Settings**
3. Check server logs for email errors (prefixed with `[Support]`)

### Attachments Not Uploading

1. Verify Supabase Storage bucket `support-attachments` exists
2. Check storage RLS policies are configured
3. Verify file size < 5MB and type is PNG/JPG/WebP
4. Check browser console for upload errors

### Users Can't See Tickets

1. Verify RLS policies are enabled on all support tables
2. Check user is authenticated
3. Verify `is_admin()` function exists in database
4. Check database logs for permission errors

## Architecture

```
User Flow:
  Create Ticket → Email to Support → Admin Responds → Email to User → Status Updated → Email to User

Admin Flow:
  View All Tickets → Filter/Search → Open Ticket → Update Status → Reply → Close Ticket

Email Flow:
  Trigger Event → supportMailer.ts → SMTP Client → Recipient Email

Storage Flow:
  Upload File → Server Validation → Supabase Storage → DB Record → Signed URL on View
```

## Future Enhancements

- Ticket assignment to specific admin users
- Internal notes (admin-only comments)
- Canned responses for common issues
- Ticket merge functionality
- Customer satisfaction ratings
- Advanced analytics and reporting
