// The leagues store on Firestore. Only ids the function generated (32 hex, checked by ownedLeague) reach a path.
// leagues/{id} (organizerId, slug, name, location, sport, season, weeks, allowTies, createdAt)
// leagues/{id}/entrants/{id} (name, position)   slugs/{slug} -> {leagueId}
// leagues/{id}/schedule/current (generation, games: [{week, slot, homeId, awayId, homeScore, awayScore}])
function createStore(db) {
  const leagueRef = (id) => db.collection("leagues").doc(id);
  const scheduleRef = (id) => leagueRef(id).collection("schedule").doc("current");
  const withId = (doc) => ({ id: doc.id, ...doc.data() });

  return {
    async getLeague(id) {
      const doc = await leagueRef(id).get();
      return doc.exists ? withId(doc) : null;
    },

    /** The league whose public slug this is (slugs/{slug} holds its id), or null. Only a slug-shaped string may be passed. */
    async getLeagueBySlug(slug) {
      const slugDoc = await db.collection("slugs").doc(slug).get();
      return slugDoc.exists ? this.getLeague(slugDoc.data().leagueId) : null;
    },

    async listLeagues(organizerId) {
      const snap = await db.collection("leagues").where("organizerId", "==", organizerId).get();
      return snap.docs.map(withId);
    },

    /** Create the league and claim its slug in one transaction; false if the slug is taken. */
    createLeague({ id, ...fields }) {
      const slugRef = db.collection("slugs").doc(fields.slug);
      return db.runTransaction(async (tx) => {
        if ((await tx.get(slugRef)).exists) return false;
        tx.set(slugRef, { leagueId: id });
        tx.set(leagueRef(id), fields);
        return true;
      });
    },

    async listEntrants(leagueId) {
      const snap = await leagueRef(leagueId).collection("entrants").get();
      return snap.docs.map(withId);
    },

    /** decide(existing) returns the new {id, name, position} or throws; the read and the insert are one transaction. */
    addEntrant(leagueId, decide) {
      const entrants = leagueRef(leagueId).collection("entrants");
      return db.runTransaction(async (tx) => {
        const existing = (await tx.get(entrants)).docs.map(withId);
        const { id, ...fields } = decide(existing);
        tx.set(entrants.doc(id), fields);
        return { id, ...fields };
      });
    },

    async getSchedule(leagueId) {
      const doc = await scheduleRef(leagueId).get();
      return doc.exists ? doc.data() : null;
    },

    /**
     * One transaction: read the league, entrants and schedule, call decide({league, entrants, schedule}),
     * then write the schedule it returns and the league's weeks. decide throws to refuse; nothing is written then.
     */
    generateSchedule(leagueId, decide) {
      return db.runTransaction(async (tx) => {
        const [league, entrants, schedule] = await Promise.all([
          tx.get(leagueRef(leagueId)), tx.get(leagueRef(leagueId).collection("entrants")), tx.get(scheduleRef(leagueId)),
        ]);
        const out = decide({ league: league.data(), entrants: entrants.docs.map(withId), schedule: schedule.exists ? schedule.data() : null });
        tx.set(scheduleRef(leagueId), out.schedule);
        tx.update(leagueRef(leagueId), { weeks: out.weeks });
        return out;
      });
    },

    /** One transaction on the schedule document: decide(schedule|null) returns {schedule, result}; a null schedule writes nothing. */
    updateSchedule(leagueId, decide) {
      return db.runTransaction(async (tx) => {
        const doc = await tx.get(scheduleRef(leagueId));
        const out = decide(doc.exists ? doc.data() : null);
        if (out.schedule) tx.set(scheduleRef(leagueId), out.schedule);
        return out.result;
      });
    },
  };
}

module.exports = { createStore };
