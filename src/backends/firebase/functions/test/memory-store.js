// An in-memory stand-in for the Firestore store: same interface as firestore-store.js.
function memoryStore() {
  const leagues = new Map();
  const entrants = new Map();
  const schedules = new Map();
  const slugs = new Set();
  const calls = [];
  const rec = (name, fn) => (...a) => { calls.push(name); return fn(...a); };
  const copy = (v) => structuredClone(v);
  return {
    calls,
    getLeague: rec("getLeague", async (id) => leagues.get(id) ?? null),
    listLeagues: rec("listLeagues", async (uid) => [...leagues.values()].filter((l) => l.organizerId === uid)),
    createLeague: rec("createLeague", async (league) => {
      if (slugs.has(league.slug)) return false;
      slugs.add(league.slug);
      leagues.set(league.id, league);
      return true;
    }),
    listEntrants: rec("listEntrants", async (id) => entrants.get(id) ?? []),
    addEntrant: rec("addEntrant", async (id, decide) => {
      const list = entrants.get(id) ?? [];
      const e = decide(list);
      entrants.set(id, [...list, e]);
      return e;
    }),
    getSchedule: rec("getSchedule", async (id) => copy(schedules.get(id) ?? null)),
    // decide({league, entrants, schedule}) returns {schedule, weeks}; both are written, or nothing if it throws.
    generateSchedule: rec("generateSchedule", async (id, decide) => {
      const out = decide({ league: copy(leagues.get(id)), entrants: copy(entrants.get(id) ?? []), schedule: copy(schedules.get(id) ?? null) });
      schedules.set(id, copy(out.schedule));
      leagues.get(id).weeks = out.weeks;
      return out;
    }),
    // decide(schedule|null) returns {schedule, result}; schedule null means write nothing. Returns result.
    updateSchedule: rec("updateSchedule", async (id, decide) => {
      const out = decide(copy(schedules.get(id) ?? null));
      if (out.schedule) schedules.set(id, copy(out.schedule));
      return out.result;
    }),
  };
}

module.exports = { memoryStore };
