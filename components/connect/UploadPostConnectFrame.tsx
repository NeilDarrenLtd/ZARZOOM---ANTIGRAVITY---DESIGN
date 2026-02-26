"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  WifiOff,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface UploadPostConnectFrameProps {
  returnTo: string;
}

const IFRAME_TIMEOUT_MS = 15_000;

export default function UploadPostConnectFrame({
  returnTo,
}: UploadPostConnectFrameProps) {
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "timeout">(
    "loading"
  );
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLoad = useRef(false);

  const fetchUrl = useCallback(async () => {
    setStatus("loading");
    setAccessUrl(null);
    setErrorMessage("");
    didLoad.current = false;

    try {
      const params = new URLSearchParams({ returnTo });
      const res = await fetch(`/api/upload-post/connect-url?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMessage(
          body?.error?.message ?? "Failed to load the connect page."
        );
        setStatus("error");
        return;
      }

      const { accessUrl: url } = await res.json();

      if (!url) {
        setErrorMessage("No connect URL returned. Please try again.");
        setStatus("error");
        return;
      }

      setAccessUrl(url);

      // Start iframe load timeout
      timeoutRef.current = setTimeout(() => {
        if (!didLoad.current) {
          setStatus("timeout");
        }
      }, IFRAME_TIMEOUT_MS);
    } catch {
      setErrorMessage("Could not reach the server. Check your connection.");
      setStatus("error");
    }
  }, [returnTo]);

  useEffect(() => {
    fetchUrl();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchUrl]);

  function handleIframeLoad() {
    didLoad.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("ready");
  }

  function handleBack() {
    router.push(returnTo);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-10">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="h-4 w-px bg-border" />

        <span className="text-sm font-semibold text-foreground">
          Connect Accounts
        </span>

        {status === "loading" && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 relative">
        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background animate-in fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading connect page...
            </p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background px-6">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <WifiOff className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-semibold text-foreground mb-1">
                Something went wrong
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={fetchUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Timeout fallback — iframe loaded too slowly */}
        {status === "timeout" && accessUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background px-6">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <ExternalLink className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-semibold text-foreground mb-1">
                Taking longer than expected
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The connect page is taking a while to load. Open it directly in
                a new tab to continue.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Go back
              </button>
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
            </div>
          </div>
        )}

        {/* iframe — rendered as soon as accessUrl is available */}
        {accessUrl && status !== "error" && (
          <iframe
            ref={iframeRef}
            src={accessUrl}
            onLoad={handleIframeLoad}
            title="Connect social accounts"
            allow="clipboard-read; clipboard-write; fullscreen"
            className={`w-full border-0 transition-opacity duration-300 ${
              status === "ready" ? "opacity-100" : "opacity-0 absolute inset-0"
            }`}
            style={{ height: status === "ready" ? "100%" : 0 }}
          />
        )}
      </div>
    </div>
  );
}
