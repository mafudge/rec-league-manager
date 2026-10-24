// US05: recording and clearing scores, and the schedule routes (US04). Validation mirrors FastAPI's
// routes/scores.py, in the same order. Everything queries as the organizer, so RLS is the ownership check.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail, json, objectBody, type Route } from './http.ts'
import { type Deps, ownedLeague, problem } from './leagues.ts'
import { gameJson, type GameRecord, roundRobin, weeksMessage } from './schedule.ts'

const LIMIT = 2 ** 31 // int4, so every backend (Postgres included) agrees on what fits
const GAME_COLUMNS = 'id, league_id, week, home_id, away_id, home_score, away_score'

/** The score as a number if it is a whole number 0 <= n < 2^31, else null (JSON already made 21.0 into 21). */
const whole = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LIMIT ? v : null

/**
 * What a PUT body asks for: 'clear' (both scores null or absent) or the two scores to store.
 * One null beside a number is refused like any non-whole score; equal scores need allow_ties.
 */
export function scoreChange(data: Record<string, unknown>, allowTies: boolean): 'clear' | { home: number; away: number } {
  if ((data.home_score ?? null) === null && (data.away_score ?? null) === null) return 'clear'
  const home = whole(data.home_score)
  const away = whole(data.away_score)
  if (home === null || away === null) return fail(400, 'Scores must be whole numbers 0 or greater')
  if (home === away && !allowTies) return fail(400, "This league doesn't allow ties")
  return { home, away }
}

async function namesOf(db: SupabaseClient, leagueId: string): Promise<Map<string, string>> {
  const { data, error } = await db.from('entrants').select('id, name').eq('league_id', leagueId)
  if (error) return problem('entrant names', error)
  return new Map((data as { id: string; name: string }[]).map((e) => [e.id, e.name]))
}

export function scheduleRoutes({ organizerFrom, clientFor }: Deps): Route[] {
  const signedIn = async (req: Request) => clientFor((await organizerFrom(req)).token)

  return [
    {
      method: 'POST',
      path: '/api/leagues/:id/schedule',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        const league = await ownedLeague(db, id)
        const { data: entrants, error } = await db
          .from('entrants').select('id').eq('league_id', id).order('position')
        if (error) return problem('entrant list', error)
        const entrantIds = (entrants as { id: string }[]).map((e) => e.id)
        if (entrantIds.length < 2) return fail(400, 'Add at least 2 entrants first')
        const { data: scored, error: scoredError } = await db
          .from('games').select('id').eq('league_id', id).not('home_score', 'is', null).limit(1)
        if (scoredError) return problem('score lookup', scoredError)
        if ((scored as unknown[]).length > 0) return fail(409, 'Scores already recorded — clear them first')
        const rounds = roundRobin(entrantIds)
        const games = rounds.flatMap((pairs, w) =>
          pairs.map(([home_id, away_id], slot) => ({ week: w + 1, slot, home_id, away_id })))
        // delete + insert + weeks update run in one transaction inside the function
        const { error: rpcError } = await db.rpc('replace_schedule', {
          p_league: id, p_games: games, p_weeks: rounds.length,
        })
        if (rpcError) return problem('schedule replace', rpcError)
        return json({ weeks: rounds.length, message: weeksMessage(rounds.length, league.weeks) }, 201)
      },
    },
    {
      method: 'GET',
      path: '/api/leagues/:id/games',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        await ownedLeague(db, id)
        const names = await namesOf(db, id)
        const { data, error } = await db
          .from('games').select(GAME_COLUMNS).eq('league_id', id).order('week').order('slot')
        if (error) return problem('game list', error)
        return json((data as GameRecord[]).map((g) => gameJson(g, names)))
      },
    },
    {
      method: 'DELETE',
      path: '/api/leagues/:id/scores',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        await ownedLeague(db, id)
        const { data, error } = await db
          .from('games')
          .update({ home_score: null, away_score: null })
          .eq('league_id', id)
          .not('home_score', 'is', null)
          .select('id')
        if (error) return problem('clear scores', error)
        return json({ cleared: (data as unknown[]).length })
      },
    },
    {
      method: 'PUT',
      path: '/api/games/:id/score',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        const body = await objectBody(req) // the body's shape is checked before anything else
        const { data, error } = await db.from('games').select(GAME_COLUMNS).eq('id', id).maybeSingle()
        // class 22 is bad input (e.g. a NUL in the id), which no game can have
        if (error && String(error.code ?? '').startsWith('22')) return fail(404, 'Game not found')
        if (error) return problem('game lookup', error)
        if (!data) return fail(404, 'Game not found') // unknown, or in another organizer's league (RLS)
        const game = data as GameRecord & { league_id: string }
        if (game.away_id === null) return fail(400, 'A bye has no score')
        const league = await ownedLeague(db, game.league_id)
        const change = scoreChange(body, league.allow_ties)
        const scores = change === 'clear'
          ? { home_score: null, away_score: null }
          : { home_score: change.home, away_score: change.away }
        const { data: saved, error: saveError } = await db
          .from('games').update(scores).eq('id', id).select(GAME_COLUMNS).single()
        if (saveError) return problem('score save', saveError)
        return json(gameJson(saved as GameRecord, await namesOf(db, game.league_id)))
      },
    },
  ]
}
