create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games(id),
  name       text not null check (char_length(name) between 1 and 12),
  score      integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_idx    on public.scores (created_at desc);

alter table public.scores enable row level security;

create policy "scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "scores can be inserted by everyone"
  on public.scores for insert
  to anon, authenticated
  with check (true);

create view public.game_stats with (security_invoker = true) as
  select game_id, max(score) as best, count(*)::int as plays
  from public.scores
  group by game_id;
