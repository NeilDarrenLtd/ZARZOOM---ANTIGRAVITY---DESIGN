# Create workspace tables (fix "Could not find the table 'public.tenants'")

The **Add Workspace** feature needs the `tenants` and `tenant_memberships` tables in your Supabase database. Apply one of the options below.

---

## Option A — Full migration (recommended)

1. Open your **Supabase** project → **SQL Editor**.
2. Open the file **`scripts/015_workspace_foundation.sql`** in this repo and copy its full contents.
3. Paste into the SQL Editor and click **Run**.
4. If it succeeds, **Add Workspace** will work. Existing users get one workspace each from the backfill.

If you see an error like **`relation "public.profiles" does not exist`**, use **Option B** instead (creates only the workspace tables, no backfill).

---

## Option B — Workspace tables only (no backfill)

Use this if the full migration fails because `public.profiles` does not exist or the backfill step errors.

1. Open **Supabase** → **SQL Editor**.
2. Copy and run the SQL in **`scripts/015_workspace_tables_only.sql`** (see below or that file in the repo).
3. Then try **Add Workspace** again. Existing users will need to use **Add Workspace** once to get their first workspace.

---

## After running

- Try **Add Workspace** again from the dashboard.
- If you still see an error, check the exact message in the red banner and fix any missing tables or columns it mentions.
