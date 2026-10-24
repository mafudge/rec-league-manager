// US07: the public page. No token: anyone with the link reads the league, schedule and standings; nothing writes.
// This is the one route that uses the service-role client (RLS would hide other organizers' leagues from anon by
// design), so it reads by slug only and never returns the database id or organizer_id.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail, json, type Route } from './http.ts'
import { type League, leagueJson, problem } from './leagues.ts'
import { gameJson, type GameRecord } from './schedule.ts'
import { computeStandings, type Game, isPlayed, playedCount, standingsJson } from './standings.ts'

/** Lowest week with an unplayed non-bye game; the last week once everything is played; null with no games. */
export function currentWeek(games: Game[]): number | null {
  if (games.length === 0) return null
  const open = games.filter((g) => g.away_id !== null && !isPlayed(g)).map((g) => g.week)
  return open.length ? Math.min(...open) : Math.max(...games.map((g) => g.week))
}

export function publicRoutes({ clientFor }: { clientFor: () => SupabaseClient }): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/public/:slug',
      handler: async (_req, _url, { slug }) => {
        const db = clientFor()
        const { data: row, error } = await db
          .from('leagues').select('id, slug, name, location, sport, season, weeks, allow_ties').eq('slug', slug).maybeSingle()
        if (error && String(error.code ?? '').startsWith('22')) return fail(404, 'League not found')
        if (error) return problem('public league lookup', error)
        if (!row) return fail(404, 'League not found')
        const league = row as League
        const { data: entrants, error: eErr } = await db
          .from('entrants').select('id, name').eq('league_id', league.id).order('position')
        if (eErr) return problem('public entrants', eErr)
        const { data: games, error: gErr } = await db
          .from('games').select('id, week, home_id, away_id, home_score, away_score')
          .eq('league_id', league.id).order('week').order('slot')
        if (gErr) return problem('public games', gErr)
        const ents = entrants as { id: string; name: string }[]
        const rows = games as GameRecord[]
        const names = new Map(ents.map((e) => [e.id, e.name]))
        const { id: _private, ...publicLeague } = leagueJson(league) // the database id stays private
        return json({
          league: publicLeague,
          current_week: currentWeek(rows),
          games: rows.map((g) => gameJson(g, names)),
          standings: standingsJson(computeStandings(ents, rows), playedCount(rows)),
        })
      },
    },
  ]
}
