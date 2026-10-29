-- CodeTribe Supabase schema
create extension if not exists pgcrypto;
create table if not exists public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Developer' check (char_length(display_name) between 1 and 120),
 avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 title text not null check (char_length(title) between 2 and 80),
 description text not null check (char_length(description) between 10 and 500),
 project_url text not null check (project_url ~* '^https?://github[.]com/[^/]+/[^/]+/?([?#].*)?$'),
 tech_stack text[] not null default '{}',
 screenshot_url text check (screenshot_url is null or screenshot_url ~* '^https?://'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists projects_created_at_idx on public.projects(created_at desc);
create index if not exists projects_user_id_idx on public.projects(user_id);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 sender_id uuid not null references public.users(id) on delete cascade,
 recipient_id uuid not null references public.users(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(), constraint messages_not_self check (sender_id <> recipient_id)
);
create index if not exists messages_project_created_idx on public.messages(project_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_recipient_idx on public.messages(recipient_id);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.users(id, display_name, avatar_url)
 values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email,'@',1), 'Developer'),120),
 left(new.raw_user_meta_data ->> 'avatar_url',1000))
 on conflict (id) do update set display_name=excluded.display_name, avatar_url=excluded.avatar_url, updated_at=now();
 return new;
end; $$;
drop trigger if exists on_auth_user_created_codetribe on auth.users;
create trigger on_auth_user_created_codetribe after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at before update on public.users for each row execute procedure public.touch_updated_at();
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects for each row execute procedure public.touch_updated_at();

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.messages enable row level security;
drop policy if exists "Public profiles are readable" on public.users;
create policy "Public profiles are readable" on public.users for select to anon, authenticated using (true);
drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile" on public.users for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "Projects are publicly readable" on public.projects;
create policy "Projects are publicly readable" on public.projects for select to anon, authenticated using (true);
drop policy if exists "Signed-in users can submit their own projects" on public.projects;
create policy "Signed-in users can submit their own projects" on public.projects for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Owners can update their own projects" on public.projects;
create policy "Owners can update their own projects" on public.projects for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Owners can delete their own projects" on public.projects;
create policy "Owners can delete their own projects" on public.projects for delete to authenticated using (auth.uid()=user_id);

drop policy if exists "Participants can read their messages" on public.messages;
create policy "Participants can read their messages" on public.messages for select to authenticated using (auth.uid()=sender_id or auth.uid()=recipient_id);
drop policy if exists "Visitors can message project owners" on public.messages;
create policy "Visitors can message project owners" on public.messages for insert to authenticated with check (
 auth.uid()=sender_id and sender_id<>recipient_id and exists (
  select 1 from public.projects p where p.id=project_id and p.user_id=recipient_id
 )
);
drop policy if exists "Recipients can reply to existing conversations" on public.messages;
create policy "Recipients can reply to existing conversations" on public.messages for insert to authenticated with check (
 auth.uid()=sender_id and sender_id<>recipient_id
 and exists (select 1 from public.projects p where p.id=project_id and p.user_id=sender_id)
 and exists (select 1 from public.messages prior where prior.project_id=messages.project_id and prior.sender_id=messages.recipient_id and prior.recipient_id=messages.sender_id)
);
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
end $$;
-- Browser code must use only the public anon/publishable key, never service_role.
