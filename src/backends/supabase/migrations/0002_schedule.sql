-- Replacing a league's schedule is three writes (delete the old games, insert the new, set leagues.weeks)
-- that must succeed or fail together. A function body runs in one transaction, so a failed insert
-- leaves the old games and weeks untouched. Called with the organizer's token via rpc.
--
-- security invoker: the function runs with the caller's rights, so row-level security still applies
-- (another organizer's league has no rows to delete and nowhere to insert).
-- p_games is a JSON array of {week, slot, home_id, away_id}; away_id is null for a bye.

create or replace function public.replace_schedule(p_league text, p_games jsonb, p_weeks int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from games where league_id = p_league;
  insert into games (league_id, week, slot, home_id, away_id)
    select p_league, g.week, g.slot, g.home_id, g.away_id
    from jsonb_to_recordset(p_games) as g(week int, slot int, home_id text, away_id text);
  update leagues set weeks = p_weeks where id = p_league;
end
$$;

revoke all on function public.replace_schedule(text, jsonb, int) from public, anon;
grant execute on function public.replace_schedule(text, jsonb, int) to authenticated;
