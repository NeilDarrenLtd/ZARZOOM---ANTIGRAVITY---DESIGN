"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Status = "verifying" | "success_popup" | "success_redirect" | "error";

export default function UploadPostReturnContent() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const state = searchParams.get("state") ?? "";

    if (!state) {
      setErrorMsg(t("connect.returnErrorDefault"));
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/upload-post/verify-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error ?? t("connect.returnErrorDefault"));
          setStatus("error");
          return;
        }

        const returnTo: string = data.returnTo ?? "/dashboard";
        const separator = returnTo.includes("?") ? "&" : "?";
        const destination = `${returnTo}${separator}uploadpost=success`;

        if (typeof window !== "undefined" && window.opener) {
          try {
            window.opener.postMessage(
              { type: "UPLOADPOST_CONNECTED", success: true, returnTo },
              window.location.origin
            );
          } catch {
            // opener on a different origin -- ignore
          }

          setStatus("success_popup");

          setTimeout(() => {
            try {
              window.close();
            } catch {
              // Some browsers block window.close()
            }
          }, 600);

          return;
        }

        setStatus("success_redirect");
        window.location.replace(destination);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("connect.returnErrorDefault");
        setErrorMsg(msg);
        setStatus("error");
      }
    })();
  }, [searchParams, t]);

  if (status === "verifying") {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("connect.returnVerifying")}</p>
      </Shell>
    );
  }

  if (status === "success_popup") {
    return (
      <Shell>
        <CheckCircle2 className="w-10 h-10 text-green-600 mb-3" />
        <p className="text-base font-medium text-foreground">
          {t("connect.returnSuccessPopup")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("connect.returnSuccessPopupHint")}
        </p>
      </Shell>
    );
  }

  if (status === "success_redirect") {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("connect.returnRedirecting")}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-base font-medium text-foreground">
        {t("connect.returnErrorTitle")}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {errorMsg || t("connect.returnErrorDefault")}
      </p>
      <Link
        href="/dashboard/connect-accounts"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
      >
        {t("connect.returnBackToConnect")}
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        {children}
      </div>
    </div>
  );
}
