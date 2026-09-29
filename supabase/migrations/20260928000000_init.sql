-- Ezvor schema (run once on a fresh Supabase project: SQL Editor → paste → Run,
-- or `supabase db push`).
--
-- Trust model
--   * Anything a user can fake (solved problems, submissions) is written only by
--     the server with the service-role key after it judged the code itself.
--   * Self-reported data (roadmap checkboxes, targets, notes, settings) is
--     owner-writable through RLS.
--   * Public proof profiles expose rows only when the owner opted in.

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  handle text check (handle is null or handle ~ '^[a-zA-Z0-9_-]{3,30}$'),
  headline text check (headline is null or char_length(headline) <= 160),
  location text check (location is null or char_length(location) <= 80),
  bio text check (bio is null or char_length(bio) <= 600),
  github text check (github is null or char_length(github) <= 80),
  linkedin text check (linkedin is null or char_length(linkedin) <= 120),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_handle_key on public.profiles (lower(handle)) where handle is not null;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "profiles: owner read" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: public read" on public.profiles
  for select to anon, authenticated using (is_public);
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: owner update" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Create a profile row automatically for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------- AI advisor chats
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
grant select, insert, update, delete on public.chat_threads, public.chat_messages to authenticated;
grant all on public.chat_threads, public.chat_messages to service_role;

create policy "threads: owner" on public.chat_threads
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "messages: owner" on public.chat_messages
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------- judged activity (server-only)
create table public.code_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_slug text not null,
  problem_title text,
  status text not null,
  language text not null,
  passed int not null default 0,
  total int not null default 0,
  runtime_ms int,
  memory_kb int,
  code text check (code is null or char_length(code) <= 60000),
  engine text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index code_submissions_user_created_idx on public.code_submissions (user_id, created_at desc);
create index code_submissions_user_slug_idx on public.code_submissions (user_id, problem_slug, created_at desc);

create table public.solved_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id text not null,
  problem_title text not null,
  difficulty text not null,
  topic text,
  language text,
  runtime_ms int,
  memory_kb int,
  solved_at timestamptz not null default now(),
  unique (user_id, problem_id)
);
create index solved_problems_user_idx on public.solved_problems (user_id, solved_at desc);

alter table public.code_submissions enable row level security;
alter table public.solved_problems enable row level security;
grant select on public.code_submissions to authenticated;
grant select on public.solved_problems to anon, authenticated;
grant delete on public.solved_problems to authenticated;
grant all on public.code_submissions, public.solved_problems to service_role;

create policy "submissions: owner read" on public.code_submissions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "solved: owner read" on public.solved_problems
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "solved: owner delete" on public.solved_problems
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "solved: public read" on public.solved_problems
  for select to anon, authenticated using (
    exists (select 1 from public.profiles p where p.user_id = solved_problems.user_id and p.is_public)
  );

-- --------------------------------------------- self-reported progress & targets
create table public.roadmap_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  roadmap_id text not null,
  stage_title text not null,
  item text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, roadmap_id, item)
);

create table public.career_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  roadmap_id text not null,
  role_label text not null,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger career_targets_updated_at before update on public.career_targets
  for each row execute function public.set_updated_at();

alter table public.roadmap_progress enable row level security;
alter table public.career_targets enable row level security;
grant select on public.roadmap_progress, public.career_targets to anon;
grant select, insert, update, delete on public.roadmap_progress, public.career_targets to authenticated;
grant all on public.roadmap_progress, public.career_targets to service_role;

create policy "roadmap: owner" on public.roadmap_progress
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "roadmap: public read" on public.roadmap_progress
  for select to anon, authenticated using (
    exists (select 1 from public.profiles p where p.user_id = roadmap_progress.user_id and p.is_public)
  );
create policy "target: owner" on public.career_targets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "target: public read" on public.career_targets
  for select to anon, authenticated using (
    exists (select 1 from public.profiles p where p.user_id = career_targets.user_id and p.is_public)
  );

-- ------------------------------------- synced user data (notes, lists, settings)
-- Key/value documents mirrored from the browser's local store, e.g.
--   notes, bookmarks, review_queue, editor_settings, list_progress.
create table public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_.:-]{1,80}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  check (pg_column_size(value) <= 512000)
);
create trigger user_data_updated_at before update on public.user_data
  for each row execute function public.set_updated_at();

alter table public.user_data enable row level security;
grant select, insert, update, delete on public.user_data to authenticated;
grant all on public.user_data to service_role;
create policy "user_data: owner" on public.user_data
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------- shared problem caches (server-only)
create table public.problem_statements (
  slug text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create table public.problem_harnesses (
  slug text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create table public.problem_solutions (
  slug text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.problem_statements enable row level security;
alter table public.problem_harnesses enable row level security;
alter table public.problem_solutions enable row level security;
grant all on public.problem_statements, public.problem_harnesses, public.problem_solutions to service_role;

-- --------------------------------------------------- live opportunity tracker
create table public.opportunity_status (
  opp_id text primary key,
  status text not null,
  status_note text,
  source_url text,
  source_title text,
  reason text,
  confidence text,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_status_log (
  id uuid primary key default gen_random_uuid(),
  opp_id text not null,
  old_status text,
  new_status text not null,
  reason text,
  source_url text,
  changed_at timestamptz not null default now()
);
create index status_log_opp_idx on public.opportunity_status_log (opp_id, changed_at desc);
create index status_log_changed_idx on public.opportunity_status_log (changed_at desc);

alter table public.opportunity_status enable row level security;
alter table public.opportunity_status_log enable row level security;
grant select on public.opportunity_status, public.opportunity_status_log to anon, authenticated;
grant all on public.opportunity_status, public.opportunity_status_log to service_role;
create policy "status: public read" on public.opportunity_status for select using (true);
create policy "status log: public read" on public.opportunity_status_log for select using (true);

-- ------------------------------------------------------------- leaderboard
-- Only users who made their profile public appear. security_invoker keeps RLS in force.
create view public.leaderboard with (security_invoker = true) as
select
  p.handle,
  p.display_name,
  p.avatar_url,
  count(s.*)::int as solved,
  count(s.*) filter (where s.difficulty = 'Easy')::int as easy,
  count(s.*) filter (where s.difficulty = 'Medium')::int as medium,
  count(s.*) filter (where s.difficulty = 'Hard')::int as hard,
  (count(s.*) filter (where s.difficulty = 'Easy')
    + 2 * count(s.*) filter (where s.difficulty = 'Medium')
    + 4 * count(s.*) filter (where s.difficulty = 'Hard'))::int as score,
  max(s.solved_at) as last_solved_at
from public.profiles p
join public.solved_problems s on s.user_id = p.user_id
where p.is_public and p.handle is not null
group by p.user_id, p.handle, p.display_name, p.avatar_url;

grant select on public.leaderboard to anon, authenticated;
