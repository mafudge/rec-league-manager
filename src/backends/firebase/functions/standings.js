// Standings helpers shared by the score and standings routes.

/** A played game is a non-bye game with both scores. */
const isPlayed = (g) => g.awayId !== null && g.homeScore !== null && g.awayScore !== null;

const playedCount = (games) => games.filter(isPlayed).length;

module.exports = { isPlayed, playedCount };
