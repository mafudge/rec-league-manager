import { assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { ALPHABET, newSlug } from './slugs.ts'

Deno.test('the slug alphabet is FastAPI\'s: no i, l, o, 0, 1', () => {
  assertEquals(ALPHABET, 'abcdefghjkmnpqrstuvwxyz23456789')
})

Deno.test('a slug is 6 characters from the alphabet', () => {
  for (let i = 0; i < 500; i++) assertMatch(newSlug(), /^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/)
})

Deno.test('every character of the alphabet can be drawn (bytes beyond the last whole cycle are redrawn)', () => {
  // A byte source that walks 0..255: 248..255 would bias the first 8 letters, so they are skipped.
  let n = 0
  const bytes = (buf: Uint8Array) => { for (let i = 0; i < buf.length; i++) buf[i] = n++ % 256; return buf }
  const seen = new Set<string>()
  for (let i = 0; i < 60; i++) for (const c of newSlug(bytes)) seen.add(c)
  assertEquals(seen.size, ALPHABET.length)
  // the first slug comes from bytes 0..5
  n = 0
  assertEquals(newSlug(bytes), 'abcdef')
  // bytes 248..255 are skipped: 247 is the last whole cycle (247 % 31 = 30 -> '9'), then 0..4
  n = 247
  assertEquals(newSlug(bytes), '9abcde')
})
