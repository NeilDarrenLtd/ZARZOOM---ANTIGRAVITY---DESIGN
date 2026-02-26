"use client";

import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";

interface Props {
  show: boolean;
}

export default function UploadPostSuccessBanner({ show }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-green-600 text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">Accounts connected successfully</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-1 rounded-full p-0.5 hover:bg-green-500 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
