import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const srcDir = join(process.cwd(), "Images", "Hero Images");
const destDir = join(process.cwd(), "public", "sequence");

// Check if source directory exists
if (!existsSync(srcDir)) {
  console.error("Source directory not found:", srcDir);
  // List what's in the project root to find the frames
  const rootFiles = readdirSync(process.cwd());
  console.log("Root directory contents:", rootFiles);
  process.exit(1);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

let copiedCount = 0;
let missingCount = 0;

for (let i = 0; i <= 191; i++) {
  const padded = i.toString().padStart(3, "0");
  const variants = [
    `frame_${padded}_delay-0.042s.jpg`,
    `frame_${padded}_delay-0.041s.jpg`,
    `frame_${padded}_delay-0.04s.jpg`,
  ];

  let copied = false;
  for (const variant of variants) {
    const src = join(srcDir, variant);
    if (existsSync(src)) {
      copyFileSync(src, join(destDir, `${padded}.jpg`));
      copied = true;
      copiedCount++;
      break;
    }
  }

  if (!copied) {
    missingCount++;
    if (missingCount <= 5) {
      console.warn(`Missing frame ${padded}`);
    }
  }
}

console.log(`Done. Copied ${copiedCount} frames, ${missingCount} missing.`);
