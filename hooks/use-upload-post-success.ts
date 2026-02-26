"use client";

import { useEffect, useState } from "react";

/**
 * Detects `?uploadpost=success` in the URL, returns a visible flag for 4 s,
 * then cleans the param from history so it doesn't persist on refresh.
 */
export function useUploadPostSuccess(): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("uploadpost") !== "success") return;

    // Remove the param from the URL immediately so a refresh doesn't re-trigger
    params.delete("uploadpost");
    const cleaned =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", cleaned);

    setShow(true);

    // Auto-dismiss after 4 s
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return show;
}
