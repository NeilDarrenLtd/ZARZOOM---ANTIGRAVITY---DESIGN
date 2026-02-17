"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { X, Loader2, Wifi, WifiOff, ExternalLink } from "lucide-react";

/**
 * Traps focus inside a container element.
 * Returns a ref to attach to the container.
 */
function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"]), iframe';

    function getFocusable() {
      return Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => el.offsetParent !== null);
    }

    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleTab);

    return () => {
      container.removeEventListener("keydown", handleTab);
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
}

interface UploadPostConnectModalProps {
  open: boolean;
  onClose: (connected: boolean) => void;
}

/**
 * Full-screen modal overlay that:
 *  1. Calls POST /api/v1/onboarding/social-connect to create the profile
 *     and obtain a connect_url.
 *  2. Renders the connect_url in an <iframe> (no browser chrome / URL bar).
 *  3. On close, polls GET /api/v1/onboarding/social-connect/status to
 *     determine whether social accounts were connected.
 *
 * If Upload-Post is not configured (demo_mode), shows a fallback UI
 * explaining that the feature is not yet available.
 */
export default function UploadPostConnectModal({
  open,
  onClose,
}: UploadPostConnectModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const focusTrapRef = useFocusTrap(open);

  // Initiate the connection when modal opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError("");
    setConnectUrl(null);
    setDemoMode(false);

    async function initConnect() {
      try {
        const res = await fetch("/api/v1/onboarding/social-connect", {
          method: "POST",
        });

        if (!res.ok) {
          setError(t("onboarding.modal.errorGeneric"));
          setLoading(false);
          return;
        }

        const body = await res.json();
        const data = body.data;

        if (data.demo_mode) {
          setDemoMode(true);
          setLoading(false);
          return;
        }

        if (data.connect_url) {
          setConnectUrl(data.connect_url);
        } else {
          setError(t("onboarding.modal.errorNoUrl"));
        }
      } catch {
        setError(t("onboarding.modal.errorGeneric"));
      } finally {
        setLoading(false);
      }
    }

    initConnect();
  }, [open, t]);

  // Check connection status on close
  const handleClose = useCallback(async () => {
    setChecking(true);

    try {
      const res = await fetch("/api/v1/onboarding/social-connect/status");
      if (res.ok) {
        const body = await res.json();
        onClose(body.data?.connected ?? false);
        return;
      }
    } catch {
      // If status check fails, assume not connected
    }

    setChecking(false);
    onClose(false);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex flex-col bg-gray-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.modal.title")}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-gray-200">
            {t("onboarding.modal.title")}
          </span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {checking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("onboarding.modal.checking")}
            </>
          ) : (
            <>
              <X className="w-3.5 h-3.5" />
              {t("onboarding.modal.close")}
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            <p className="text-sm text-gray-400">
              {t("onboarding.modal.loading")}
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950 px-6">
            <WifiOff className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300 text-center max-w-sm leading-relaxed">
              {error}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 rounded-lg bg-gray-700 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
            >
              {t("onboarding.modal.close")}
            </button>
          </div>
        )}

        {/* Demo mode fallback */}
        {!loading && demoMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gray-950 px-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <Wifi className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-lg font-bold text-gray-100 mb-2">
                {t("onboarding.modal.demoTitle")}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t("onboarding.modal.demoDescription")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-5 py-2.5 rounded-lg bg-gray-700 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
              >
                {t("onboarding.modal.skipConnect")}
              </button>
            </div>
          </div>
        )}

        {/* Iframe with connect URL */}
        {!loading && !error && !demoMode && connectUrl && (
          <>
            <iframe
              ref={iframeRef}
              src={connectUrl}
              className="w-full h-full border-0"
              title={t("onboarding.a11y.socialConnectorTitle")}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              allow="clipboard-write"
            />
            {/* Fallback link if iframe won't load */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <a
                href={connectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900/90 text-xs text-gray-300 hover:text-white transition-colors backdrop-blur-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("onboarding.modal.openInNewTab")}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
