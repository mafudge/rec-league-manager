// Leagues (US02) and entrants (US03). Validation mirrors FastAPI's routes/leagues.py and entrants.py:
// same order, messages and limits. Ownership is row-level security: every query runs with the
// organizer's own token, so another organizer's league is simply not there (404).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail, json, objectBody, type Route } from './http.ts'
import type { Organizer } from './auth.ts'
import { newSlug } from './slugs.ts'

export const NAME_LIMIT = 100
export const WEEKS_MAX = 52
export const ENTRANT_LIMIT = 52 // a round robin of 53 needs 53 weeks, and a league runs at most 52

const LEAGUE_COLUMNS = 'id, slug, name, location, sport, season, weeks, allow_ties'

export type League = {
  id: string
  slug: string
  name: string
  location: string
  sport: string
  season: string
  weeks: number
  allow_ties: boolean
}
export type NewLeague = Omit<League, 'id' | 'slug'>
type PgError = { code?: string; message?: string } | null

const codePoints = (s: string) => [...s].length
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Something went wrong that isn't the caller's fault; PostgREST's body stays in the log. */
export const problem = (what: string, error: PgError): never => {
  console.error(`${what} failed`, error?.code, error?.message)
  return fail(500, 'The backend had a problem')
}

export const leagueJson = (row: League): League => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  location: row.location,
  sport: row.sport,
  season: row.season,
  weeks: row.weeks,
  allow_ties: row.allow_ties,
})

/** A POST /api/leagues body, checked in the contract's order; returns the trimmed fields to store. */
export function newLeague(data: Record<string, unknown>): NewLeague {
  const name = text(data.name)
  const location = text(data.location)
  const { weeks } = data
  const allow_ties = 'allow_ties' in data ? data.allow_ties : false
  if (!name) fail(400, 'Name is required')
  if (codePoints(name) > NAME_LIMIT) fail(400, `Name must be ${NAME_LIMIT} characters or fewer`)
  if (!location) fail(400, 'Location is required')
  // typeof rules out booleans and strings; JSON.parse already made 3.0 into 3
  if (typeof weeks !== 'number' || !Number.isInteger(weeks) || weeks < 1) fail(400, 'Weeks must be at least 1')
  if ((weeks as number) > WEEKS_MAX) fail(400, `Weeks must be between 1 and ${WEEKS_MAX}`)
  if (typeof allow_ties !== 'boolean') fail(400, 'Invalid request')
  return {
    name,
    location,
    sport: text(data.sport),
    season: text(data.season),
    weeks: weeks as number,
    allow_ties: allow_ties as boolean,
  }
}

/** An entrant's name, trimmed and stored as typed; a non-string counts as blank. */
export function entrantName(raw: unknown): string {
  const name = text(raw)
  if (!name) fail(400, 'Name is required')
  if (codePoints(name) > NAME_LIMIT) fail(400, `Name must be ${NAME_LIMIT} characters or fewer`)
  return name
}

/** Refuses a duplicate (trimmed, plain toLowerCase, not case folding), then a 53rd entrant. */
export function checkNewEntrant(name: string, existing: string[]): void {
  const lower = name.toLowerCase()
  if (existing.some((n) => n.trim().toLowerCase() === lower)) {
    fail(409, 'An entrant with that name already exists in this league')
  }
  if (existing.length >= ENTRANT_LIMIT) fail(400, `A league can have at most ${ENTRANT_LIMIT} entrants`)
}

/** The league if RLS lets this client see it; unknown and someone else's look the same (404). */
export async function ownedLeague(client: SupabaseClient, id: string): Promise<League> {
  const { data, error } = await client.from('leagues').select(LEAGUE_COLUMNS).eq('id', id).maybeSingle()
  // class 22 is bad input (e.g. a NUL in the id), which no league can have
  if (error && String(error.code ?? '').startsWith('22')) return fail(404, 'League not found')
  if (error) return problem('league lookup', error)
  if (!data) return fail(404, 'League not found')
  return data as League
}

export type Deps = {
  organizerFrom: (req: Request) => Promise<Organizer>
  clientFor: (token: string) => SupabaseClient
}

export function leagueRoutes({ organizerFrom, clientFor }: Deps): Route[] {
  const signedIn = async (req: Request) => clientFor((await organizerFrom(req)).token)
  const withOrganizer = async (req: Request) => {
    const organizer = await organizerFrom(req)
    return { organizer, db: clientFor(organizer.token) }
  }

  return [
    {
      method: 'GET',
      path: '/api/leagues',
      handler: async (req) => {
        const db = await signedIn(req)
        const { data, error } = await db.from('leagues').select(LEAGUE_COLUMNS).order('created_at').order('id')
        if (error) return problem('league list', error)
        return json((data as League[]).map(leagueJson))
      },
    },
    {
      method: 'POST',
      path: '/api/leagues',
      handler: async (req) => {
        const { organizer, db } = await withOrganizer(req)
        const fields = newLeague(await objectBody(req))
        for (let attempt = 0; attempt < 5; attempt++) { // a slug clash (unique violation) just draws another
          const { data, error } = await db
            .from('leagues')
            .insert({ ...fields, slug: newSlug(), organizer_id: organizer.id })
            .select(LEAGUE_COLUMNS)
            .single()
          if (!error) return json(leagueJson(data as League), 201)
          if (error.code !== '23505') return problem('league insert', error)
        }
        return fail(409, 'Could not create the league, try again')
      },
    },
    {
      method: 'GET',
      path: '/api/leagues/:id',
      handler: async (req, _url, { id }) => json(leagueJson(await ownedLeague(await signedIn(req), id))),
    },
    {
      method: 'GET',
      path: '/api/leagues/:id/entrants',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        await ownedLeague(db, id)
        const { data, error } = await db.from('entrants').select('id, name').eq('league_id', id).order('position')
        if (error) return problem('entrant list', error)
        return json(data)
      },
    },
    {
      method: 'POST',
      path: '/api/leagues/:id/entrants',
      handler: async (req, _url, { id }) => {
        const db = await signedIn(req)
        const body = await objectBody(req) // the body's shape is checked before the league lookup
        await ownedLeague(db, id)
        const name = entrantName(body.name)
        const { data: rows, error } = await db
          .from('entrants')
          .select('name, position')
          .eq('league_id', id)
          .order('position')
        if (error) return problem('entrant lookup', error)
        const existing = rows as { name: string; position: number }[]
        checkNewEntrant(name, existing.map((e) => e.name))
        const position = existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0
        const { data, error: insertError } = await db
          .from('entrants')
          .insert({ league_id: id, name, position })
          .select('id, name')
          .single()
        if (insertError) return problem('entrant insert', insertError)
        return json(data, 201)
      },
    },
  ]
}
