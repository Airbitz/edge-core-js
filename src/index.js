import { makeCurrencyWallet } from './currencyWallets/api.js'
import { makeStorageWallet } from "./storage/storageApi";
import { makeContext } from './io/context.js'

// Sub-module exports:
import * as error from './error.js'
import * as internal from './internal.js'
export { error }
export { internal }

// Ancillary exports:
export * from './error.js'
export { makeBrowserIo } from './io/browser'
export { makeFakeIos } from './io/fake'

/**
 * Initializes the Airbitz core library.
 *
 * @param opts A object with the following options:
 * - apiKey: Auth server API key
 * - appId: The global identifier for this application
 * - authServer: Alternative auth server to use (optional).
 * - io: Platform-specific IO resources (optional).
 *       Defaults to browser IO if not provided.
 * @return An Airbitz core library instance.
 */
export { makeContext }

/**
 * Same thing as `makeContext`, but corresponding to the documentation.
 */
export function makeABCContext (apiKey, appId, opts) {
  return makeContext({ apiKey, appId, ...opts })
}

/**
 * Creates a new wallet object based on a set of keys.
 */
export { makeCurrencyWallet }

/**
 * Creates a new wallet object based on a set of keys.
 */
export { makeStorageWallet}
