"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { openBlankCenteredPopup, navigatePopup } from "@/lib/ui/popup";

/* ── Types ───────────────────────────────────────────────────────────────── */

type UIState =
  | "idle"
  | "mobile_redirecting"
  | "desktop_waiting"
  | "success"
  | "error";

interface Props {
  returnTo: string;
  originLabel?: string;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function HybridUploadPostConnect({ returnTo, originLabel }: Props) {
  const router = useRouter();
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
      router.refresh();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  /* ── Poll popup closed (desktop) ───────────────────────────────────────── */

  useEffect(() => {
    if (uiState !== "desktop_waiting") return;

    const interval = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(interval);
        // If no success message arrived, show soft error
        setUiState((prev) =>
          prev === "desktop_waiting" ? "error" : prev
        );
        setErrorMsg("Window was closed before completing the connection.");
      }
    }, 500);

    return () => clearInterval(interval);
  }, [uiState]);

  /* ── Fetch access URL ──────────────────────────────────────────────────── */

  const fetchAccessUrl = useCallback(async (): Promise<string | null> => {
    try {
      const params = new URLSearchParams({ returnTo });
      const res = await fetch(`/api/upload-post/connect-url?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.accessUrl) throw new Error("No access URL returned.");
      setAccessUrl(json.accessUrl);
      return json.accessUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setUiState("error");
      return null;
    }
  }, [returnTo]);

  /* ── Main connect handler ──────────────────────────────────────────────── */

  const handleConnect = useCallback(async () => {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      setUiState("mobile_redirecting");
      const url = await fetchAccessUrl();
      if (url) window.location.href = url;
      return;
    }

    // Desktop: open popup synchronously (must be inside click handler)
    const popup = openBlankCenteredPopup("uploadpost-connect");
    popupRef.current = popup;

    if (!popup) {
      // Blocked — fetch URL and offer fallback link
      const url = await fetchAccessUrl();
      if (url) {
        setUiState("error");
        setErrorMsg(
          "Your browser blocked the popup. Use the link below to continue."
        );
      }
      return;
    }

    setUiState("desktop_waiting");
    const url = await fetchAccessUrl();

    if (url) {
      navigatePopup(popup, url);
    } else {
      // fetchAccessUrl already set error state
      popup.close();
    }
  }, [fetchAccessUrl]);

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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      {/* Origin label */}
      {originLabel && (
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {originLabel}
        </p>
      )}

      {/* ── IDLE ── */}
      {uiState === "idle" && (
        <>
          <h1 className="text-2xl font-bold text-foreground">
            Connect your accounts
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
            Link your social media accounts to start posting automatically.
          </p>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={handleConnect}
              className="w-full rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Connect Accounts
            </button>
            <button
              onClick={() => router.push(returnTo)}
              className="w-full rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}

      {/* ── MOBILE REDIRECTING ── */}
      {uiState === "mobile_redirecting" && (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Redirecting to connect…
          </p>
        </>
      )}

      {/* ── DESKTOP WAITING ── */}
      {uiState === "desktop_waiting" && (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Popup opened — complete the connection in that window.
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
            Once you finish, this page will update automatically.
          </p>
          {accessUrl && (
            <a
              href={accessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              If nothing happens, click here to continue
            </a>
          )}
        </>
      )}

      {/* ── SUCCESS ── */}
      {uiState === "success" && (
        <>
          <CheckCircle2 className="w-10 h-10 text-green-600" />
          <h2 className="text-lg font-semibold text-foreground">
            Accounts connected
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
            Your social accounts have been linked successfully.
          </p>
          <button
            onClick={handleContinue}
            className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Continue
          </button>
        </>
      )}

      {/* ── ERROR ── */}
      {uiState === "error" && (
        <>
          <AlertCircle className="w-8 h-8 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            Connection not completed
          </h2>
          {errorMsg && (
            <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>
          )}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={handleRetry}
              className="w-full rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            {accessUrl && (
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
            )}
            <button
              onClick={() => router.push(returnTo)}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
