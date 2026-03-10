import { execSync } from "child_process";

try {
  console.log("[v0] Running pnpm install to sync lockfile...");
  execSync("pnpm install", {
    cwd: "/vercel/share/v0-project",
    stdio: "inherit",
  });
  console.log("[v0] pnpm install completed successfully.");
} catch (err) {
  console.error("[v0] pnpm install failed:", err);
  process.exit(1);
}
