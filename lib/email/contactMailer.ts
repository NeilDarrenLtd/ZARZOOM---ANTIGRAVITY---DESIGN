import { createAdminClient } from "@/lib/supabase/server";
import { queueEmail } from "@/lib/email/queue";

/**
 * Contact form email handler.
 * Emails are enqueued into the email_queue table for later delivery
 * by the external sending engine. The SMTP test flow is not affected.
 */

interface ContactEmailParams {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Get the support recipient email with fallback chain:
 * 1. support_recipient_email from support_settings
 * 2. smtp_user from site_settings
 * 3. smtp_from_email from site_settings
 */
async function getRecipientEmail(): Promise<string | null> {
  const supabase = await createAdminClient();

  const { data: supportSettings } = await supabase
    .from("support_settings")
    .select("support_recipient_email")
    .single();

  if (supportSettings?.support_recipient_email) {
    return supportSettings.support_recipient_email;
  }

  const { data: rows } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["smtp_user", "smtp_from_email"]);

  const settings: Record<string, string> = {};
  for (const row of rows || []) {
    settings[row.key] = row.value ?? "";
  }

  return settings.smtp_user || settings.smtp_from_email || null;
}

/**
 * Email template wrapper
 */
function createEmailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
            <div style="background: #16a34a; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">ZARZOOM</h1>
            </div>
            <div style="padding: 24px;">
              ${content}
            </div>
            <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                This message was sent via the ZARZOOM Contact Form
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Enqueue a contact form submission for later delivery.
 */
export async function sendContactFormEmail(params: ContactEmailParams): Promise<{ success: boolean; error?: string }> {
  console.log("[ContactMailer] Processing contact form from:", params.email);

  const primaryRecipient = await getRecipientEmail();
  if (!primaryRecipient) {
    console.error("[ContactMailer] No recipient email configured");
    return { success: false, error: "Email system not configured. Please try again later." };
  }

  const subject = `Contact Form: ${params.subject}`;

  const html = createEmailWrapper(`
    <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">New Contact Form Submission</h2>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">From:</p>
      <p style="margin: 0; color: #111827;">${params.name}</p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${params.email}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: #374151;">Subject:</p>
      <p style="margin: 0; color: #111827;">${params.subject}</p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Message:</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; color: #374151; white-space: pre-wrap;">${params.message}</div>
    </div>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        Reply directly to this email to respond to ${params.name}.
      </p>
    </div>
  `);

  const text = `
New Contact Form Submission

From: ${params.name} <${params.email}>
Subject: ${params.subject}

Message:
${params.message}

Reply to: ${params.email}
  `.trim();

  const queued = await queueEmail({
    toEmail: primaryRecipient,
    toName: params.name,
    subject,
    htmlBody: html,
    textBody: text,
    emailType: "contact_form",
    relatedType: "contact_form",
  });

  if (queued) {
    return { success: true };
  }

  return { success: false, error: "Failed to queue email. Please try again later or contact us directly." };
}
