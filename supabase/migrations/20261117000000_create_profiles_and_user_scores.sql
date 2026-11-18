-- SPEC 15: profiles (unique username), scores.user_id, new scores RLS, signup trigger.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles can be inserted by their owner"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;

drop policy "scores can be inserted by everyone" on public.scores;

-- Guests (user_id null) keep the SPEC 06 limits (table checks). Logged-in
-- inserts must use their own id and their profile username as name.
create policy "scores can be inserted by guests or their owner"
  on public.scores for insert
  to anon, authenticated
  with check (
    user_id is null
    or (
      user_id = (select auth.uid())
      and name = (select p.username from public.profiles p where p.id = (select auth.uid()))
    )
  );

-- Email signup: create the profile from the username in user metadata.
-- OAuth signups have no username and choose one later.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'username' ~ '^[A-Za-z0-9_]{3,12}$' then
    insert into public.profiles (id, username)
    values (new.id, new.raw_user_meta_data ->> 'username');
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
