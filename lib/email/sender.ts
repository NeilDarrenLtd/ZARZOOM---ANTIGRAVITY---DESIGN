import { createAdminClient } from "@/lib/supabase/server";

export interface DirectSendParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface DirectSendResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email immediately via SMTP using the admin-configured settings.
 * Returns { success: true } on delivery, or { success: false, error } on failure.
 * Never throws.
 */
export async function sendEmailDirect(
  params: DirectSendParams
): Promise<DirectSendResult> {
  try {
    const supabase = await createAdminClient();
    const { data: rows, error: fetchErr } = await supabase
      .from("site_settings")
      .select("key, value")
      .like("key", "smtp_%");

    if (fetchErr) {
      return { success: false, error: fetchErr.message };
    }

    const smtp: Record<string, string> = {};
    for (const row of rows || []) {
      smtp[row.key] = row.value ?? "";
    }

    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
      return { success: false, error: "SMTP is not configured" };
    }

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
      ...(smtp.smtp_encryption === "tls" && !secure
        ? { requireTLS: true }
        : {}),
    });

    await transporter.sendMail({
      from: `"${smtp.smtp_from_name || "ZARZOOM"}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    });

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send email";
    console.error("[SMTP] Direct send error:", message);
    return { success: false, error: message };
  }
}
