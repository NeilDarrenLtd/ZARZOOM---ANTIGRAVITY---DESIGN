"use client";

import { Suspense } from "react";
import UploadPostReturnContent from "./content";

// Mark as dynamic since this page requires the 'state' query parameter from OAuth redirects
export const dynamic = "force-dynamic";

export default function UploadPostReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="flex flex-col items-center text-center max-w-sm">
            <p className="text-sm text-muted-foreground">Verifying connection…</p>
          </div>
        </div>
      }
    >
      <UploadPostReturnContent />
    </Suspense>
  );
}
