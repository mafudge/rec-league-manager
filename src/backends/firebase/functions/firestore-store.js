// The leagues store on Firestore. Only ids the function generated (32 hex, checked by ownedLeague) reach a path.
// leagues/{id} (organizerId, slug, name, location, sport, season, weeks, allowTies, createdAt)
// leagues/{id}/entrants/{id} (name, position)   slugs/{slug} -> {leagueId}
function createStore(db) {
  const leagueRef = (id) => db.collection("leagues").doc(id);
  const withId = (doc) => ({ id: doc.id, ...doc.data() });

  return {
    async getLeague(id) {
      const doc = await leagueRef(id).get();
      return doc.exists ? withId(doc) : null;
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
  };
}

module.exports = { createStore };
