# Support Ticket Email Notifications

This document describes the email notification system for support tickets.

## Overview

The support ticket system sends automatic email notifications for key events using the existing SMTP infrastructure configured in the admin panel (`/admin/settings/email`).

## Email Triggers

### 1. User Creates Ticket
**Trigger:** User submits a new support ticket  
**Recipient:** Support team (configured in `/admin/support/settings`)  
**Subject:** `New Support Ticket #[ticket_id]: [subject]`  
**Content:**
- Ticket ID
- Subject
- User email
- First message (truncated to 500 chars if needed)
- Deep link to admin panel: `/admin/support/tickets/[id]`

**API Route:** `POST /api/v1/support/tickets`

### 2. User Adds Comment
**Trigger:** User adds a comment to their ticket  
**Recipient:** Support team (configured in `/admin/support/settings`)  
**Subject:** `New Comment on Ticket #[ticket_id]: [subject]`  
**Content:**
- Ticket ID
- Subject
- User email
- Comment text (truncated to 500 chars if needed)
- Note about attachments if present
- Deep link to admin panel: `/admin/support/tickets/[id]`

**API Route:** `POST /api/v1/support/tickets/[id]/comments`

### 3. Admin Adds Comment
**Trigger:** Admin replies to a ticket  
**Recipient:** Ticket owner (user email)  
**Subject:** `Support Team replied to your ticket #[ticket_id]`  
**Content:**
- Ticket ID
- Subject
- Admin response (truncated to 500 chars if needed)
- Note about viewing attachments in ticket
- Deep link to user dashboard: `/dashboard/support/tickets/[id]`

**API Routes:** 
- `POST /api/v1/support/tickets/[id]/comments` (when admin is authenticated)
- `POST /api/v1/admin/support/tickets/[id]/comments`

### 4. Admin Changes Status
**Trigger:** Admin updates ticket status  
**Recipient:** Ticket owner (user email)  
**Subject:** `Your ticket #[ticket_id] status changed to [new_status]`  
**Content:**
- Ticket ID
- Subject
- Status change (old → new) with visual indicator
- Deep link to user dashboard: `/dashboard/support/tickets/[id]`

**API Route:** `PATCH /api/v1/admin/support/tickets/[id]`

## Configuration

### SMTP Settings
Configure SMTP in the admin panel: `/admin/settings/email`

Required settings:
- SMTP Host
- SMTP Port (default: 587)
- SMTP Username
- SMTP Password
- From Email
- From Name (default: "ZARZOOM")
- Encryption (TLS/SSL/None)

### Support Recipient Email
Configure the support team email address in: `/admin/support/settings`

This is the email address that receives notifications when users create tickets or add comments.

### Base URL
The system uses `SITE_URL` environment variable (or falls back to `NEXT_PUBLIC_APP_URL`) to generate absolute deep links in emails.

**Environment Variable:**
```env
SITE_URL=https://your-domain.com
```

## Email Templates

All emails use a consistent HTML template with:
- ZARZOOM branding (green theme)
- Responsive design
- Plain text fallback
- Branded header with white text on green background
- Content area with structured information
- Call-to-action button with deep link
- Footer with automated message note

### Template Structure
```html
<!DOCTYPE html>
<html>
  <body style="background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto;">
      <div style="background: white; border-radius: 12px;">
        <div style="background: #16a34a; padding: 24px;">
          <h1>ZARZOOM Support</h1>
        </div>
        <div style="padding: 24px;">
          [Email Content]
        </div>
        <div style="background: #f9fafb;">
          [Footer]
        </div>
      </div>
    </div>
  </body>
</html>
```

## Implementation Details

### Module Location
`/lib/email/supportMailer.ts`

### Functions

#### `sendNewTicketNotification(params)`
Sends email when user creates a ticket.

**Parameters:**
```typescript
{
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  firstMessage: string;
}
```

#### `sendUserCommentNotification(params)`
Sends email when user adds a comment.

**Parameters:**
```typescript
{
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  commentText: string;
}
```

#### `sendAdminCommentNotification(params)`
Sends email when admin replies to a ticket.

**Parameters:**
```typescript
{
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  adminComment: string;
}
```

#### `sendStatusChangeNotification(params)`
Sends email when admin changes ticket status.

**Parameters:**
```typescript
{
  ticketId: string;
  ticketSubject: string;
  userEmail: string;
  oldStatus: string;
  newStatus: string;
}
```

### Error Handling
- Email sending is asynchronous and doesn't block API responses
- Errors are logged to console but don't cause API failures
- If SMTP is not configured, warnings are logged but API continues
- Missing support recipient email logs warning and skips notification

## Attachments

**Important:** Email attachments are NOT included in notification emails.

Instead:
- Emails mention "View attachments in the ticket"
- Users/admins must click the deep link to view attachments
- Attachments are served via signed URLs from Supabase Storage

This approach:
- Prevents email size bloat
- Maintains security (attachments require authentication)
- Reduces server load

## Testing

### Test Email Flow

1. **Configure SMTP** (if not already done):
   - Go to `/admin/settings/email`
   - Enter SMTP credentials
   - Click "Send Test Email" to verify configuration

2. **Configure Support Email**:
   - Go to `/admin/support/settings`
   - Enter support recipient email
   - Save settings

3. **Test User Ticket Creation**:
   - Create a new ticket as a user
   - Check support inbox for "New Support Ticket" email
   - Verify deep link works

4. **Test User Comment**:
   - Add a comment to an existing ticket as a user
   - Check support inbox for "New Comment" email
   - Verify deep link works

5. **Test Admin Reply**:
   - Reply to a ticket as admin
   - Check user's email inbox for "Support Team replied" email
   - Verify deep link works

6. **Test Status Change**:
   - Change ticket status as admin
   - Check user's email inbox for "status changed" email
   - Verify status indicators and deep link work

## Security Considerations

### No Cross-User Data Leakage
- User emails only show their own ticket data
- Admin emails show full ticket details but only to configured support team
- All deep links require authentication to access

### Email Content
- Messages are truncated to 500 characters to prevent email size issues
- No sensitive data (passwords, API keys) are ever included
- User emails are only visible to admins, not other users

### SMTP Credentials
- Stored encrypted in `site_settings` table
- Never returned to client after saving
- Only accessible via admin server actions with SECURITY DEFINER

## Troubleshooting

### Emails Not Sending

1. **Check SMTP Configuration**:
   - Admin panel → Email Settings
   - Verify all fields are correct
   - Use "Send Test Email" button

2. **Check Support Recipient Email**:
   - Admin panel → Support → Settings
   - Ensure email address is configured

3. **Check Server Logs**:
   ```
   [SupportMailer] SMTP not configured
   [SupportMailer] No support recipient email configured
   [SupportMailer] Failed to send email: [error]
   ```

4. **Check Environment Variables**:
   ```bash
   # Verify SITE_URL is set
   echo $SITE_URL
   ```

### Deep Links Not Working

1. **Verify SITE_URL**:
   - Must be absolute URL (https://domain.com)
   - Should match your production domain
   - No trailing slash

2. **Check Authentication**:
   - Users must be logged in to access their tickets
   - Admins must have admin role to access admin panel

### Wrong Recipient

- User emails go to the user who created the ticket
- Admin/system emails go to `support_recipient_email` from settings
- Verify support settings are correctly configured

## Future Enhancements

Potential improvements:
- Email templates with user-customizable branding
- Email digest (daily summary instead of per-event)
- Email preferences (let users opt out of certain notifications)
- Rich text formatting in emails
- Inline attachment previews (thumbnails)
- CC/BCC support for multiple support team members
