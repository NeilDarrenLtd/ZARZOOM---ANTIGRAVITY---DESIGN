/**
 * Shared client-side logging helper for the analyzer UI.
 *
 * Sends structured events to /api/analyzer/log via sendBeacon (or fetch
 * fallback). Fire-and-forget — never blocks or throws into calling code.
 */

export function logAnalyzerUiEvent(
  stage: string,
  payload?: {
    analysisId?: string | null;
    sessionId?: string | null;
    profileUrl?: string | null;
    platform?: string | null;
    details?: Record<string, unknown>;
  }
) {
  try {
    if (typeof window === "undefined") return;

    const body = JSON.stringify({
      stage,
      level: "info",
      analysis_id: payload?.analysisId ?? null,
      session_id: payload?.sessionId ?? null,
      profile_url: payload?.profileUrl ?? null,
      platform: payload?.platform ?? null,
      details: payload?.details ?? undefined,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analyzer/log", blob);
    } else {
      void fetch("/api/analyzer/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Swallow logging errors on the client.
  }
}
