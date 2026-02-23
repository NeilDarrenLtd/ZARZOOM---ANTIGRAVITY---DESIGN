import { createAdminClient } from "@/lib/supabase/server";

/**
 * Contact form email handler with fallback support
 * Uses SMTP settings and support recipient email with fallback chain
 */

interface ContactEmailParams {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Get SMTP configuration from site_settings
 */
async function getSmtpConfig() {
  const supabase = await createAdminClient();
  const { data: rows, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", "smtp_%");

  if (error) {
    console.error("[ContactMailer] Failed to fetch SMTP settings:", error);
    return null;
  }

  const smtp: Record<string, string> = {};
  for (const row of rows || []) {
    smtp[row.key] = row.value ?? "";
  }

  if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
    console.warn("[ContactMailer] SMTP not configured");
    return null;
  }

  return smtp;
}

/**
 * Get the support recipient email with fallback chain:
 * 1. support_recipient_email from support_settings
 * 2. smtp_user from site_settings
 * 3. smtp_from_email from site_settings
 */
async function getRecipientEmail(): Promise<string | null> {
  const supabase = await createAdminClient();
  
  // Try support_settings first
  const { data: supportSettings } = await supabase
    .from("support_settings")
    .select("support_recipient_email")
    .single();

  if (supportSettings?.support_recipient_email) {
    console.log("[ContactMailer] Using support recipient email:", supportSettings.support_recipient_email);
    return supportSettings.support_recipient_email;
  }

  // Fallback to SMTP settings
  const smtp = await getSmtpConfig();
  if (smtp?.smtp_user) {
    console.log("[ContactMailer] Using SMTP username as fallback:", smtp.smtp_user);
    return smtp.smtp_user;
  }

  if (smtp?.smtp_from_email) {
    console.log("[ContactMailer] Using SMTP from email as fallback:", smtp.smtp_from_email);
    return smtp.smtp_from_email;
  }

  return null;
}

/**
 * Send email with retry logic
 */
async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const smtp = await getSmtpConfig();
  if (!smtp) {
    console.error("[ContactMailer] Cannot send email: SMTP not configured");
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");

    const port = parseInt(smtp.smtp_port || "587", 10);
    const secure = smtp.smtp_encryption === "ssl" || port === 465;

    const transporter = nodemailer.default.createTransport({
      host: smtp.smtp_host,
      port,
      secure,
      auth: {
        user: smtp.smtp_user,
        pass: smtp.smtp_pass,
      },
      ...(smtp.smtp_encryption === "tls" && !secure ? { requireTLS: true } : {}),
    });

    await transporter.sendMail({
      from: `"${smtp.smtp_from_name || "ZARZOOM"}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("[ContactMailer] Email sent successfully to:", to);
    return true;
  } catch (err) {
    console.error("[ContactMailer] Failed to send email to", to, "Error:", err);
    return false;
  }
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
 * Send contact form submission with retry logic
 */
export async function sendContactFormEmail(params: ContactEmailParams): Promise<{ success: boolean; error?: string }> {
  console.log("[ContactMailer] Processing contact form from:", params.email);

  // Get primary recipient
  const primaryRecipient = await getRecipientEmail();
  if (!primaryRecipient) {
    console.error("[ContactMailer] No recipient email configured");
    return { success: false, error: "Email system not configured. Please try again later." };
  }

  // Build email content
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

  // Try primary recipient
  console.log("[ContactMailer] Attempting to send to primary recipient:", primaryRecipient);
  const primarySuccess = await sendEmail(primaryRecipient, subject, text, html);
  
  if (primarySuccess) {
    return { success: true };
  }

  // If failed and primary was from support_settings, try SMTP from email as fallback
  const smtp = await getSmtpConfig();
  if (smtp?.smtp_from_email && smtp.smtp_from_email !== primaryRecipient) {
    console.log("[ContactMailer] Primary failed, retrying with SMTP from email:", smtp.smtp_from_email);
    const fallbackSuccess = await sendEmail(smtp.smtp_from_email, subject, text, html);
    
    if (fallbackSuccess) {
      return { success: true };
    }
  }

  console.error("[ContactMailer] All email attempts failed");
  return { success: false, error: "Failed to send email. Please try again later or contact us directly." };
}
