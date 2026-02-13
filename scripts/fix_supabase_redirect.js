/**
 * Updates the Supabase project's Site URL and Redirect URLs
 * so OAuth redirects work correctly instead of going to localhost.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

if (!SUPABASE_URL || !ACCESS_TOKEN || !SITE_URL) {
  console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_SITE_URL");
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
if (!projectRef) {
  console.error("Could not extract project ref from SUPABASE_URL:", SUPABASE_URL);
  process.exit(1);
}

async function main() {
  console.log("Project ref:", projectRef);
  console.log("Setting Site URL to:", SITE_URL);

  // Step 1: Read current auth config
  const getRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "GET",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  if (!getRes.ok) {
    console.error("Failed to read auth config:", getRes.status, await getRes.text());
    process.exit(1);
  }

  const currentConfig = await getRes.json();
  console.log("Current site_url:", currentConfig.site_url);
  console.log("Current uri_allow_list:", currentConfig.uri_allow_list);

  // Step 2: Update the Site URL and add our app URL to the redirect allow list
  const siteUrlClean = SITE_URL.replace(/\/$/, "");
  const redirectUrls = [
    `${siteUrlClean}/auth/callback`,
    `${siteUrlClean}/**`,
  ];

  // Merge with existing redirect URLs if any
  const existingUrls = currentConfig.uri_allow_list
    ? currentConfig.uri_allow_list.split(",").map(u => u.trim()).filter(Boolean)
    : [];

  const allUrls = [...new Set([...existingUrls, ...redirectUrls])];

  console.log("\nPatching with:", JSON.stringify({
    site_url: siteUrlClean,
    uri_allow_list: allUrls.join(","),
  }, null, 2));

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_url: siteUrlClean,
      uri_allow_list: allUrls.join(","),
    }),
  });

  if (!patchRes.ok) {
    console.error("Failed to update auth config:", patchRes.status, await patchRes.text());
    process.exit(1);
  }

  const updatedConfig = await patchRes.json();
  console.log("\nUpdate response status:", patchRes.status);
  console.log("New site_url:", updatedConfig.site_url);
  console.log("New uri_allow_list:", updatedConfig.uri_allow_list);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
