import { execSync } from "child_process";

execSync("pnpm install", {
  cwd: "/vercel/share/v0-project",
  stdio: "inherit",
});
