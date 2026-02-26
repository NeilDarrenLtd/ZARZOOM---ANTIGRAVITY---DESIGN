"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "verifying" | "success_popup" | "success_redirect" | "error";

export default function UploadPostReturnPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const state = searchParams.get("state") ?? "";

    if (!state) {
      setErrorMsg("Missing state parameter.");
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
          setErrorMsg(data.error ?? "Connection could not be verified.");
          setStatus("error");
          return;
        }

        const returnTo: string = data.returnTo ?? "/dashboard";
        const separator = returnTo.includes("?") ? "&" : "?";
        const destination = `${returnTo}${separator}uploadpost=success`;

        // Try popup path first
        if (typeof window !== "undefined" && window.opener) {
          try {
            window.opener.postMessage(
              { type: "UPLOADPOST_CONNECTED", success: true, returnTo },
              window.location.origin
            );
          } catch {
            // opener on a different origin — ignore
          }

          setStatus("success_popup");

          // Give postMessage a moment to deliver, then attempt close
          setTimeout(() => {
            try {
              window.close();
            } catch {
              // Some browsers block window.close() — show fallback UI
            }
          }, 300);

          return;
        }

        // Same-tab / mobile path
        setStatus("success_redirect");
        window.location.replace(destination);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        setErrorMsg(msg);
        setStatus("error");
      }
    })();
  }, [searchParams]);

  // ── Render ──────────────────────────────────────────────────────────

  if (status === "verifying") {
    return (
      <VerifyShell>
        <p className="text-sm text-muted-foreground">Verifying connection…</p>
      </VerifyShell>
    );
  }

  if (status === "success_popup") {
    return (
      <VerifyShell>
        <p className="text-base font-medium text-foreground">
          Accounts connected successfully.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You can close this window and return to the app.
        </p>
      </VerifyShell>
    );
  }

  if (status === "success_redirect") {
    return (
      <VerifyShell>
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </VerifyShell>
    );
  }

  // error
  return (
    <VerifyShell>
      <p className="text-base font-medium text-foreground">
        Connection not completed
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {errorMsg || "The connection could not be verified. Please try again."}
      </p>
      <Link
        href="/dashboard/connect-accounts"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
      >
        Back to Connect Accounts
      </Link>
    </VerifyShell>
  );
}

function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        {children}
      </div>
    </div>
  );
}
