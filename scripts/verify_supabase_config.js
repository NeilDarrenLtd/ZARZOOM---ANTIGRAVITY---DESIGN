/**
 * Reads the current Supabase auth config to verify Site URL and redirect settings
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];

async function main() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "GET",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  const config = await res.json();

  // Print all keys that look relevant to redirect/site URL
  const relevantKeys = Object.keys(config).filter(k =>
    k.includes("SITE") || k.includes("URI") || k.includes("REDIRECT") || k.includes("site") || k.includes("uri") || k.includes("redirect")
  );

  console.log("All redirect-related config keys:");
  for (const key of relevantKeys) {
    console.log(`  ${key}: ${JSON.stringify(config[key])}`);
  }

  // Also print all keys for debugging
  console.log("\nAll config keys:", Object.keys(config).join(", "));
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
