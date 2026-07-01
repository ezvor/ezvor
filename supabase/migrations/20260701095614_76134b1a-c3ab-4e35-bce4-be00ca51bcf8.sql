-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat threads ------------------------------------------------------------
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_threads to authenticated;
grant all on public.chat_threads to service_role;
alter table public.chat_threads enable row level security;
create policy "Users manage own threads - select" on public.chat_threads
  for select to authenticated using (auth.uid() = user_id);
create policy "Users manage own threads - insert" on public.chat_threads
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users manage own threads - update" on public.chat_threads
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own threads - delete" on public.chat_threads
  for delete to authenticated using (auth.uid() = user_id);
create index chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);

-- Chat messages -----------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "Users manage own messages - select" on public.chat_messages
  for select to authenticated using (auth.uid() = user_id);
create policy "Users manage own messages - insert" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users manage own messages - delete" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id);
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);