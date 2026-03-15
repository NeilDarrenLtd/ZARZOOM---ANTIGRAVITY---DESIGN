/**
 * Dev server wrapper that suppresses the webpack PackFileCacheStrategy
 * ENOENT warning emitted by Next.js's internal `client-development-fallback`
 * compiler. That compiler bypasses the user-facing `webpack` config callback,
 * so `config.cache = { type: "memory" }` cannot be applied to it via
 * next.config.mjs. Intercepting `process.emitWarning` here — before Next.js
 * loads — is the only reliable way to silence the message.
 *
 * Also pre-creates the webpack cache directories so the atomic rename
 * (*.pack.gz_ -> *.pack.gz) never fails with ENOENT on first write.
 */

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Pre-create all known webpack cache subdirectories.
for (const name of [
  "client-development",
  "client-development-fallback",
  "server-development",
]) {
  try {
    mkdirSync(join(root, ".next/cache/webpack", name), { recursive: true });
  } catch {
    // Already exists or read-only — safe to ignore.
  }
}

// Suppress the PackFileCacheStrategy ENOENT warning at the process level.
// All other warnings are passed through unchanged.
const _originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  const msg = typeof warning === "string" ? warning : (warning?.message ?? "");
  if (msg.includes("PackFileCacheStrategy") && msg.includes("ENOENT")) {
    return;
  }
  return _originalEmitWarning(warning, ...args);
};

// Also patch console.warn for webpack versions that use it directly.
const _originalWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args.join(" ");
  if (msg.includes("PackFileCacheStrategy") && msg.includes("ENOENT")) {
    return;
  }
  return _originalWarn(...args);
};

// Start Next.js dev server by calling the same entry point the next CLI uses.
const { nextDev } = await import("next/dist/cli/next-dev.js");
await nextDev({ port: 3000, hostname: "0.0.0.0" }, "default");
