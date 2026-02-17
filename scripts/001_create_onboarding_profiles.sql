-- =============================================================
-- ZARZOOM Onboarding Profiles table
-- Stores all onboarding wizard state & user preferences
-- =============================================================

-- 1. Create the table
create table if not exists public.onboarding_profiles (
  -- identity
  user_id             uuid primary key references auth.users(id) on delete cascade,

  -- wizard state
  onboarding_status   text not null default 'not_started'
                        check (onboarding_status in ('not_started','in_progress','skipped','completed')),
  onboarding_step     integer check (onboarding_step between 1 and 5),
  onboarding_completed_at timestamptz,

  -- step 1: business info
  business_name       text,
  website_url         text,
  business_description text,

  -- step 2: content preferences
  content_language    text not null default 'en',
  auto_publish        boolean not null default true,
  article_styles      text[] default array['let_zarzoom_decide'],
  article_style_links text[],

  -- step 3: brand
  brand_color_hex     text check (brand_color_hex is null or brand_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url            text,

  -- step 4: goals
  goals               text[],
  website_or_landing_url  text,
  product_or_sales_url    text,

  -- step 5: plan & settings
  selected_plan       text check (selected_plan is null or selected_plan in ('basic','pro','scale')),
  discount_opt_in     boolean not null default true,
  approval_preference text not null default 'auto'
                        check (approval_preference in ('auto','manual')),

  -- social
  uploadpost_profile_username text,
  socials_connected   boolean not null default false,

  -- misc
  additional_notes    text,

  -- timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.onboarding_profiles enable row level security;

-- 3. RLS policies: users can only access their own row
create policy "onboarding_select_own"
  on public.onboarding_profiles for select
  using (auth.uid() = user_id);

create policy "onboarding_insert_own"
  on public.onboarding_profiles for insert
  with check (auth.uid() = user_id);

create policy "onboarding_update_own"
  on public.onboarding_profiles for update
  using (auth.uid() = user_id);

-- Service role bypass for server-side operations
create policy "onboarding_service_role"
  on public.onboarding_profiles for all
  using (current_setting('role') = 'service_role');

-- 4. Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_profiles_updated_at on public.onboarding_profiles;

create trigger onboarding_profiles_updated_at
  before update on public.onboarding_profiles
  for each row
  execute function public.set_updated_at();

-- 5. Indexes for common lookups
create index if not exists idx_onboarding_profiles_status
  on public.onboarding_profiles (onboarding_status);
