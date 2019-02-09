// @flow

import { makeContext } from './core/core.js'
import { makeBrowserIo } from './io/browser/browser-io.js'
import * as error from './types/error.js'
import { type EdgeContext, type EdgeContextOptions } from './types/types.js'

export { error, makeBrowserIo }
export {
  destroyAllContexts,
  fakeUser,
  fakeUser1,
  makeFakeContexts,
  makeFakeIos
} from './core/core.js'
export * from './types/types.js'

export function makeEdgeContext (
  opts: EdgeContextOptions
): Promise<EdgeContext> {
  return makeContext(makeBrowserIo(), opts)
}
