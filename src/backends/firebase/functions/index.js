// The Rec League Manager REST contract (ADR 003), served as one Cloud Function.
// Hosting rewrites /api/** to it (firebase.json), so API_URL = http://localhost:5000
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { handler } = require("./http");
const { createAuth } = require("./auth");
const { createRoutes } = require("./routes");
const { createLeagues } = require("./leagues");
const { createSchedule } = require("./schedule");
const { createScores } = require("./scores");
const { createSlugs } = require("./slugs");
const { createStore } = require("./firestore-store");

admin.initializeApp(); // the emulator sets the env, so it accepts emulator tokens

const auth = createAuth({
  fetch: (url, init) => fetch(url, init),
  host: () => process.env.FIREBASE_AUTH_EMULATOR_HOST,
  verifyIdToken: (token) => admin.auth().verifyIdToken(token),
});

const store = createStore(admin.firestore());
const leagues = createLeagues({ store, newSlug: createSlugs().newSlug });
const schedule = createSchedule({ store, leagues });
const scores = createScores({ store, leagues });

// cors: true answers preflights and allows any origin; browser frontends run on another port.
exports.api = onRequest({ cors: true }, handler(createRoutes(auth, leagues, schedule, scores)));
