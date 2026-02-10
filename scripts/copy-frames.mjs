import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const srcDir = join(process.cwd(), "Images", "Hero Images");
const destDir = join(process.cwd(), "public", "sequence");

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

for (let i = 0; i <= 191; i++) {
  const padded = i.toString().padStart(3, "0");
  // Try both delay variants
  const variants = [
    `frame_${padded}_delay-0.042s.jpg`,
    `frame_${padded}_delay-0.041s.jpg`,
  ];

  let copied = false;
  for (const variant of variants) {
    const src = join(srcDir, variant);
    if (existsSync(src)) {
      copyFileSync(src, join(destDir, `${padded}.jpg`));
      copied = true;
      break;
    }
  }

  if (copied) {
    console.log(`Copied frame ${padded}`);
  } else {
    console.warn(`Missing frame ${padded}`);
  }
}

console.log("Done copying frames to public/sequence/");
