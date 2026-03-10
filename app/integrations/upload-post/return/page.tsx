"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import UploadPostReturnContent from "./content";

export const dynamic = "force-dynamic";

export default function UploadPostReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="flex flex-col items-center text-center max-w-sm">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <UploadPostReturnContent />
    </Suspense>
  );
}
