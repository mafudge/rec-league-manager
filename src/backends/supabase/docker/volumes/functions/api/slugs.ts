// Public-link slugs, as FastAPI's app/slugs.py: 6 characters that are easy to read aloud and type.
// Uniqueness is the database's job (leagues.slug is unique); leagues.ts draws again on a clash.
export const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no i, l, o, 0, 1
export const LENGTH = 6

type Bytes = (buf: Uint8Array) => Uint8Array
const cryptoBytes: Bytes = (buf) => crypto.getRandomValues(buf)

/** A random slug. Bytes from 248 up are redrawn, so every character is equally likely (248 = 8 × 31). */
export function newSlug(bytes: Bytes = cryptoBytes): string {
  const limit = 256 - (256 % ALPHABET.length)
  let slug = ''
  while (slug.length < LENGTH) {
    for (const b of bytes(new Uint8Array(LENGTH))) {
      if (b < limit && slug.length < LENGTH) slug += ALPHABET[b % ALPHABET.length]
    }
  }
  return slug
}
