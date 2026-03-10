"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  XCircle,
  Link2,
} from "lucide-react";
import { openBlankCenteredPopup, navigatePopup } from "@/lib/ui/popup";
import { useI18n } from "@/lib/i18n";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";

/* ── Types ───────────────────────────────────────────────────────────────── */

type UIState =
  | "idle"
  | "mobile_redirecting"
  | "desktop_waiting"
  | "success"
  | "cancelled"
  | "subscription_required"
  | "error";

interface Props {
  returnTo: string;
  originLabel?: string;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function HybridUploadPostConnect({ returnTo, originLabel }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  /* ── postMessage listener ──────────────────────────────────────────────── */

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "UPLOADPOST_CONNECTED") return;
      setUiState("success");
      syncConnectionStatus();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  /* ── Sync connection status with backend ────────────────────────────── */

  const syncConnectionStatus = useCallback(() => {
    const tenantId = getActiveWorkspaceIdFromCookie();
    const headers: HeadersInit = tenantId ? { "X-Tenant-Id": tenantId } : {};
    fetch("/api/v1/onboarding/social-connect/status", { method: "GET", headers })
      .catch(() => {})
      .finally(() => router.refresh());
  }, [router]);

  /* ── Poll popup closed (desktop) ───────────────────────────────────────── */

  useEffect(() => {
    if (uiState !== "desktop_waiting") return;

    const interval = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(interval);
        if (uiState !== "desktop_waiting") return;

        const tenantId = getActiveWorkspaceIdFromCookie();
        const headers: HeadersInit = tenantId ? { "X-Tenant-Id": tenantId } : {};
        fetch("/api/v1/onboarding/social-connect/status", { method: "GET", headers })
          .then((res) => res.json())
          .then((body) => {
            const connected = body?.data?.connected === true;
            if (connected) {
              setUiState("success");
            } else {
              setUiState("cancelled");
            }
            router.refresh();
          })
          .catch(() => {
            setUiState("cancelled");
          });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [uiState, router]);

  /* ── Fetch access URL (with locale for localized JWT fields) ─────────── */

  const fetchAccessUrl = useCallback(async (): Promise<string | null> => {
    try {
      const params = new URLSearchParams({ returnTo });

      const localeCookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith("locale="));
      const locale = localeCookie
        ? decodeURIComponent(localeCookie.split("=")[1])
        : "en";
      params.set("locale", locale);

      const tenantId = getActiveWorkspaceIdFromCookie();
      const headers: HeadersInit = tenantId ? { "X-Tenant-Id": tenantId } : {};
      const res = await fetch(`/api/upload-post/connect-url?${params}`, { headers });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = body?.error ?? {};

        if (err.code === "SUBSCRIPTION_REQUIRED") {
          setUiState("subscription_required");
          return null;
        }

        let msg: string;
        if (err.code === "NOT_CONFIGURED") {
          msg = err.message ?? t("connect.errorTitle");
        } else if (err.code === "PROVIDER_ERROR") {
          msg = `${err.message ?? t("connect.errorTitle")}${err.hint ? ` (${err.hint})` : ""}`;
        } else {
          msg = err.message ?? t("connect.errorTitle");
        }

        throw new Error(msg);
      }

      if (!body.accessUrl) throw new Error(t("connect.errorTitle"));
      setAccessUrl(body.accessUrl);
      return body.accessUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setUiState("error");
      return null;
    }
  }, [returnTo, t]);

  /* ── Main connect handler ──────────────────────────────────────────────── */

  const handleConnect = useCallback(async () => {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      setUiState("mobile_redirecting");
      const url = await fetchAccessUrl();
      if (url) window.location.href = url;
      return;
    }

    const popup = openBlankCenteredPopup("uploadpost-connect");
    popupRef.current = popup;

    if (!popup) {
      const url = await fetchAccessUrl();
      if (url) {
        setUiState("error");
        setErrorMsg(t("connect.popupBlocked"));
      }
      return;
    }

    setUiState("desktop_waiting");
    const url = await fetchAccessUrl();

    if (url) {
      navigatePopup(popup, url);
    } else {
      popup.close();
    }
  }, [fetchAccessUrl, t]);

  /* ── Continue handler ──────────────────────────────────────────────────── */

  const handleContinue = useCallback(() => {
    router.push(returnTo);
  }, [router, returnTo]);

  /* ── Retry ─────────────────────────────────────────────────────────────── */

  const handleRetry = useCallback(() => {
    setUiState("idle");
    setErrorMsg("");
    setAccessUrl(null);
    popupRef.current = null;
  }, []);

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {originLabel && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {originLabel}
        </p>
      )}

      {/* ── IDLE ── */}
      {uiState === "idle" && (
        <div className="flex flex-col items-center gap-5 w-full">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
            <Link2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("connect.heading")}
            </h2>
            <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
              {t("connect.subheading")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-sm mt-1">
            <button
              onClick={handleConnect}
              className="w-full rounded-xl px-8 py-3.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors active:scale-[0.98]"
            >
              {t("connect.connectAccounts")}
            </button>
            <button
              onClick={() => router.push(returnTo)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("connect.back")}
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE REDIRECTING ── */}
      {uiState === "mobile_redirecting" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("connect.redirecting")}
          </p>
        </div>
      )}

      {/* ── DESKTOP WAITING ── */}
      {uiState === "desktop_waiting" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 className="w-7 h-7 animate-spin text-green-600" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("connect.popupWaiting")}
            </h2>
            <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
              {t("connect.popupWaitingHint")}
            </p>
          </div>
          {accessUrl && (
            <a
              href={accessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("connect.popupFallbackLink")}
            </a>
          )}
        </div>
      )}

      {/* ── SUCCESS ── */}
      {uiState === "success" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("connect.successTitle")}
            </h2>
            <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
              {t("connect.successBody")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-1">
            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              {t("connect.continue")}
            </button>
            <button
              onClick={handleRetry}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("connect.connectMore")}
            </button>
          </div>
        </div>
      )}

      {/* ── CANCELLED (user closed popup without completing) ── */}
      {uiState === "cancelled" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("connect.cancelledTitle")}
            </h2>
            <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
              {t("connect.cancelledBody")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-1">
            <button
              onClick={handleRetry}
              className="w-full rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              {t("connect.cancelledRetry")}
            </button>
            <button
              onClick={() => router.push(returnTo)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("connect.back")}
            </button>
          </div>
        </div>
      )}

      {/* ── SUBSCRIPTION REQUIRED ── */}
      {uiState === "subscription_required" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("connect.subscriptionRequired")}
            </h2>
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-1">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              {t("connect.viewPlans")}
            </button>
            <button
              onClick={() => router.push(returnTo)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("connect.back")}
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {uiState === "error" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("connect.errorTitle")}
            </h2>
            {errorMsg && (
              <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground leading-relaxed">
                {errorMsg}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-1">
            <button
              onClick={handleRetry}
              className="w-full rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              {t("connect.retry")}
            </button>
            {accessUrl && (
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t("connect.openNewTab")}
              </a>
            )}
            <button
              onClick={() => router.push(returnTo)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("connect.back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
