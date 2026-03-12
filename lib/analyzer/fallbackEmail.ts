/**
 * lib/analyzer/fallbackEmail.ts
 *
 * Email template + send helper for the analyzer fallback flow.
 * Called by /api/analyzer/fallback-notify after a fallback queue row
 * has been processed.
 *
 * Subject: "Your ZARZOOM Social Growth Report is Ready"
 */

import { sendEmailDirect } from "@/lib/email/sender";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FallbackEmailParams {
  to: string;
  profile_url: string;
  /** The analysis_id if one was created, so the user can be linked to the report */
  analysis_id?: string | null;
  /** App base URL e.g. https://zarzoom.com */
  base_url?: string;
}

export interface FallbackEmailResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML template
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(params: FallbackEmailParams): string {
  const { profile_url, analysis_id, base_url = "https://zarzoom.com" } = params;

  const reportHref = analysis_id
    ? `${base_url}/en/analyzer/${analysis_id}`
    : `${base_url}/en/analyzer`;

  const platformLabel = (() => {
    const url = profile_url.toLowerCase();
    if (url.includes("instagram.com")) return "Instagram";
    if (url.includes("tiktok.com")) return "TikTok";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
    if (url.includes("linkedin.com")) return "LinkedIn";
    if (url.includes("x.com") || url.includes("twitter.com")) return "X (Twitter)";
    if (url.includes("facebook.com")) return "Facebook";
    if (url.includes("pinterest.com")) return "Pinterest";
    if (url.includes("threads.net")) return "Threads";
    if (url.includes("reddit.com")) return "Reddit";
    if (url.includes("bsky.app")) return "Bluesky";
    return "Social";
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ZARZOOM Social Growth Report is Ready</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;border-radius:16px;overflow:hidden;background:#0e1117;border:1px solid rgba(255,255,255,0.08);" cellpadding="0" cellspacing="0">

          <!-- Header bar -->
          <tr>
            <td style="background:#16a34a;padding:18px 32px;">
              <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">ZARZOOM</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Your ${platformLabel} Growth Report is Ready
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                We promised to let you know when your AI social profile analysis was complete.
                Your personalized growth strategy is waiting for you below.
              </p>

              <!-- Profile URL pill -->
              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;margin-bottom:28px;word-break:break-all;">
                <span style="font-size:11px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:3px;">Profile analysed</span>
                <span style="font-size:13px;color:rgba(255,255,255,0.7);">${profile_url}</span>
              </div>

              <!-- What's inside -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.07em;">What's inside your report</span>
                  </td>
                </tr>
                ${[
                  "Creator Score with detailed breakdown",
                  "Identified strengths and growth opportunities",
                  "30-day content strategy",
                  "Best posting times for your niche",
                  "AI-generated post ideas ready to publish",
                ].map(item => `
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:rgba(255,255,255,0.65);">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a34a;vertical-align:middle;margin-right:10px;"></span>
                    ${item}
                  </td>
                </tr>`).join("")}
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:12px;background:#16a34a;">
                    <a href="${reportHref}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.01em;">
                      View My Growth Report &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${reportHref}" style="color:rgba(22,163,74,0.7);word-break:break-all;">${reportHref}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
                You received this email because you requested a social profile analysis on ZARZOOM.
                &copy; ${new Date().getFullYear()} ZARZOOM. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(params: FallbackEmailParams): string {
  const { profile_url, analysis_id, base_url = "https://zarzoom.com" } = params;
  const reportHref = analysis_id
    ? `${base_url}/en/analyzer/${analysis_id}`
    : `${base_url}/en/analyzer`;

  return [
    "Your ZARZOOM Social Growth Report is Ready",
    "",
    "We promised to let you know when your AI social profile analysis was complete.",
    "",
    `Profile analysed: ${profile_url}`,
    "",
    "What's inside:",
    "- Creator Score with detailed breakdown",
    "- Identified strengths and growth opportunities",
    "- 30-day content strategy",
    "- Best posting times for your niche",
    "- AI-generated post ideas ready to publish",
    "",
    `View your report: ${reportHref}`,
    "",
    "---",
    "You received this because you requested a social profile analysis on ZARZOOM.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported send function
// ─────────────────────────────────────────────────────────────────────────────

export async function sendFallbackEmail(
  params: FallbackEmailParams
): Promise<FallbackEmailResult> {
  if (!params.to || !params.to.includes("@")) {
    return { success: false, error: "Invalid recipient email address" };
  }

  return sendEmailDirect({
    to: params.to,
    subject: "Your ZARZOOM Social Growth Report is Ready",
    html: buildHtml(params),
    text: buildText(params),
  });
}
