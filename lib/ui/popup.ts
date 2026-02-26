/**
 * lib/ui/popup.ts
 *
 * Popup utilities designed to survive browser popup blockers.
 *
 * Key rule: window.open() MUST be called synchronously inside a user-gesture
 * event handler (click, keydown, etc.). Any async work (fetching a URL, signing
 * a token) must happen AFTER the popup is already open, then navigate it with
 * navigatePopup().
 *
 * Usage pattern:
 *
 *   async function handleConnectClick() {
 *     // 1. Open blank popup synchronously — still inside the click event.
 *     const popup = openBlankCenteredPopup("connect-accounts");
 *     if (!popup) { fallbackToTab(); return; }
 *
 *     // 2. Do async work (fetch signed URL, etc.).
 *     const { accessUrl } = await fetchConnectUrl();
 *
 *     // 3. Navigate the already-open popup to the real URL.
 *     navigatePopup(popup, accessUrl);
 *   }
 */

/**
 * Opens a blank centered popup synchronously from within a click handler.
 * Returns null if the browser blocks it (user should be notified to allow popups).
 *
 * @param name  - Window name (reuses an existing window with the same name).
 * @param w     - Popup width in pixels (default 520).
 * @param h     - Popup height in pixels (default 720).
 */
export function openBlankCenteredPopup(
  name: string,
  w = 520,
  h = 720
): Window | null {
  const screenLeft = window.screenLeft ?? window.screenX ?? 0;
  const screenTop = window.screenTop ?? window.screenY ?? 0;
  const screenWidth =
    window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
  const screenHeight =
    window.innerHeight ??
    document.documentElement.clientHeight ??
    screen.height;

  const left = Math.round(screenLeft + (screenWidth - w) / 2);
  const top = Math.round(screenTop + (screenHeight - h) / 2);

  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
    "status=no",
    "toolbar=no",
    "menubar=no",
    "location=no",
  ].join(",");

  const popup = window.open("about:blank", name, features);

  // Some browsers return a non-null but immediately closed window.
  if (!popup || popup.closed) {
    return null;
  }

  return popup;
}

/**
 * Navigates an already-open popup window to the given URL.
 * Safe to call after async work — the popup is already trusted by the browser.
 *
 * @param popup - The Window reference returned by openBlankCenteredPopup.
 * @param url   - The destination URL to load.
 */
export function navigatePopup(popup: Window, url: string): void {
  if (!popup || popup.closed) {
    // Popup was closed by the user before we could navigate — nothing to do.
    return;
  }
  popup.location.href = url;
  popup.focus();
}
