// @flow
import type { AbcIo } from 'airbitz-core-types'
import { makeMemoryFolder } from 'disklet'
import { FakeServer } from './fakeServer.js'

/**
 * Silences all logging.
 */
const fakeConsole = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

/**
 * Generates deterministic "random" data for unit-testing.
 */
function makeFakeRandom () {
  let seed = 0

  return (bytes: number) => {
    const out = new Uint8Array(bytes)

    for (let i = 0; i < bytes; ++i) {
      // Simplest numbers that give a full-period generator with
      // a good mix of high & low values within the first few bytes:
      seed = (5 * seed + 3) & 0xff
      out[i] = seed
    }

    return out
  }
}

/**
 * Creates an array of io context objects.
 * Each object has its own storage, but all contexts share a server.
 * @param {number} count number of io contexts to create
 */
export function makeFakeIos (count: number): Array<AbcIo> {
  // The common server used by all contexts:
  const server = new FakeServer()
  const random = makeFakeRandom()

  // Make the io objects:
  const out = []
  for (let i = 0; i < count; ++i) {
    out[i] = {
      console: fakeConsole,
      fetch: server.fetch,
      folder: makeMemoryFolder(),
      random
    }
  }

  return out
}
