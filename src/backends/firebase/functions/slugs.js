// Public-link slugs: 6 characters, no i, l, o, 0, 1 (easy to read aloud and type), as every backend.
const crypto = require("node:crypto");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 6;

function createSlugs(randomInt = crypto.randomInt) {
  const newSlug = () => Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return { newSlug };
}

module.exports = { ALPHABET, LENGTH, createSlugs };
