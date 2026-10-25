-- start.sh applies every file in this folder, in order, on each start,
-- so a migration must be safe to run again (create ... if not exists, drop policy if exists + create policy).
-- Accounts need no table of our own: Supabase Auth (GoTrue) owns auth.users.
--
-- Row-level security is the ownership check. The Edge Function talks to PostgREST with the
-- organizer's own access token (role "authenticated", auth.uid() = their id), so a league that
-- isn't theirs simply returns no rows. The anonymous role gets nothing; the public page (US07)
-- reads through the service role inside the function.

set client_min_messages = warning; -- no "policy does not exist, skipping" notices on a first run

-- Ids are 32 hex characters, like FastAPI's uuid4().hex; they are text, so a malformed id is
-- just "not found", never a cast error.
create table if not exists public.leagues (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  location text not null,
  sport text not null default '',
  season text not null default '',
  weeks integer not null,
  allow_ties boolean not null default false,
  -- lists are oldest first, so a league remembers when it was made
  created_at timestamptz not null default now()
);
create index if not exists leagues_organizer_idx on public.leagues (organizer_id, created_at, id);

create table if not exists public.entrants (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  league_id text not null references public.leagues (id) on delete cascade,
  name text not null,
  position integer not null,
  -- the target of games' composite foreign keys below
  constraint entrants_league_id_id_key unique (league_id, id)
);
create index if not exists entrants_league_idx on public.entrants (league_id, position);

-- Used from Task 3 (schedule, scores); created here so all three tables share one set of policies.
create table if not exists public.games (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  league_id text not null references public.leagues (id) on delete cascade,
  week integer not null,
  slot integer not null,
  home_id text not null,
  away_id text, -- null for a bye
  home_score integer,
  away_score integer,
  -- A game's entrants must belong to the game's own league. Foreign-key checks bypass RLS, so a
  -- plain reference to entrants(id) would let a game point at an entrant of any league.
  constraint games_home_entrant_fkey foreign key (league_id, home_id)
    references public.entrants (league_id, id) on delete cascade,
  constraint games_away_entrant_fkey foreign key (league_id, away_id)
    references public.entrants (league_id, id) on delete cascade
);

-- Bring a database made by the first version of this file (single-column references) up to date.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entrants_league_id_id_key') then
    alter table public.entrants add constraint entrants_league_id_id_key unique (league_id, id);
  end if;
  alter table public.games drop constraint if exists games_home_id_fkey;
  alter table public.games drop constraint if exists games_away_id_fkey;
  if not exists (select 1 from pg_constraint where conname = 'games_home_entrant_fkey') then
    alter table public.games add constraint games_home_entrant_fkey foreign key (league_id, home_id)
      references public.entrants (league_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'games_away_entrant_fkey') then
    alter table public.games add constraint games_away_entrant_fkey foreign key (league_id, away_id)
      references public.entrants (league_id, id) on delete cascade;
  end if;
end
$$;
create index if not exists games_league_idx on public.games (league_id, week, slot);

alter table public.leagues enable row level security;
alter table public.entrants enable row level security;
alter table public.games enable row level security;

-- Supabase's default privileges grant every new public table to anon and authenticated, TRUNCATE
-- included (which RLS does not cover); take that back and grant only what the policies govern.
revoke all on public.leagues, public.entrants, public.games from anon, authenticated;
grant select, insert, update, delete on public.leagues, public.entrants, public.games to authenticated;
grant all on public.leagues, public.entrants, public.games to service_role;

drop policy if exists leagues_owner on public.leagues;
create policy leagues_owner on public.leagues
  for all to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists entrants_owner on public.entrants;
create policy entrants_owner on public.entrants
  for all to authenticated
  using (exists (select 1 from public.leagues l where l.id = league_id and l.organizer_id = auth.uid()))
  with check (exists (select 1 from public.leagues l where l.id = league_id and l.organizer_id = auth.uid()));

drop policy if exists games_owner on public.games;
create policy games_owner on public.games
  for all to authenticated
  using (exists (select 1 from public.leagues l where l.id = league_id and l.organizer_id = auth.uid()))
  with check (exists (select 1 from public.leagues l where l.id = league_id and l.organizer_id = auth.uid()));
