// @flow

import { type Disklet } from 'disklet'
import {
  type PixieInput,
  type TamePixie,
  combinePixies,
  stopUpdates
} from 'redux-pixies'
import { update } from 'yaob'

import {
  type EdgeCurrencyEngine,
  type EdgeCurrencyPlugin,
  type EdgeCurrencyTools,
  type EdgeCurrencyWallet,
  type EdgeWalletInfo
} from '../../../types/types.js'
import {
  getCurrencyPlugin,
  getCurrencyTools
} from '../../plugins/plugins-selectors.js'
import { type ApiInput, type RootProps } from '../../root-pixie.js'
import {
  addStorageWallet,
  syncStorageWallet
} from '../../storage/storage-actions.js'
import {
  getStorageWalletLocalDisklet,
  makeStorageWalletLocalEncryptedDisklet
} from '../../storage/storage-selectors.js'
import { makeCurrencyWalletApi } from './currency-wallet-api.js'
import {
  makeCurrencyWalletCallbacks,
  watchCurrencyWallet
} from './currency-wallet-callbacks.js'
import { loadAllFiles } from './currency-wallet-files.js'
import { type CurrencyWalletState } from './currency-wallet-reducer.js'

export type CurrencyWalletOutput = {
  +api: EdgeCurrencyWallet | void,
  +plugin: EdgeCurrencyPlugin | void,
  +engine: EdgeCurrencyEngine | void,
  +engineStarted: boolean | void,
  +syncTimer: void
}

export type CurrencyWalletProps = RootProps & {
  +id: string,
  +selfState: CurrencyWalletState,
  +selfOutput: CurrencyWalletOutput
}

export type CurrencyWalletInput = PixieInput<CurrencyWalletProps>

const PUBLIC_KEY_CACHE = 'publicKey.json'

export const walletPixie: TamePixie<CurrencyWalletProps> = combinePixies({
  // Looks up the currency plugin for this wallet:
  plugin: (input: CurrencyWalletInput) => () => {
    // There are still race conditions where this can happen:
    if (input.props.selfOutput && input.props.selfOutput.plugin) return

    const walletInfo = input.props.selfState.walletInfo
    const plugin = getCurrencyPlugin(input.props.state, walletInfo.type)
    input.onOutput(plugin)
  },

  // Starts the engine for this wallet:
  engine: (input: CurrencyWalletInput) => async () => {
    if (!input.props.selfOutput) return

    const walletInfo = input.props.selfState.walletInfo
    const plugin = input.props.selfOutput.plugin
    if (!plugin) return

    try {
      // Start the data sync:
      const ai: ApiInput = (input: any) // Safe, since input extends ApiInput
      await addStorageWallet(ai, walletInfo)
      const { selfState, state } = input.props
      const { accountId, pluginName } = selfState
      const userSettings = state.accounts[accountId].userSettings[pluginName]

      const walletLocalDisklet = getStorageWalletLocalDisklet(
        state,
        walletInfo.id
      )
      const walletLocalEncryptedDisklet = makeStorageWalletLocalEncryptedDisklet(
        state,
        walletInfo.id,
        input.props.io
      )

      const tools = await getCurrencyTools(ai, walletInfo.type)
      const publicWalletInfo = await getPublicWalletInfo(
        walletInfo,
        walletLocalDisklet,
        tools
      )
      const mergedWalletInfo = {
        id: walletInfo.id,
        type: walletInfo.type,
        keys: { ...walletInfo.keys, ...publicWalletInfo.keys }
      }
      input.props.dispatch({
        type: 'CURRENCY_WALLET_PUBLIC_INFO',
        payload: { walletInfo: publicWalletInfo, walletId: input.props.id }
      })
      const canSpend: boolean =
        tools.keyCanSpend != null ? await tools.keyCanSpend(walletInfo) : true

      // Start the engine:
      const engine = await plugin.makeCurrencyEngine(mergedWalletInfo, {
        callbacks: makeCurrencyWalletCallbacks(input),
        walletLocalDisklet,
        walletLocalEncryptedDisklet,
        userSettings
      })
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_SEEDS',
        payload: {
          walletId: walletInfo.id,
          canSpend,
          displayPrivateSeed: engine.getDisplayPrivateSeed(),
          displayPublicSeed: engine.getDisplayPublicSeed()
        }
      })
      input.onOutput(engine)

      // Grab initial state:
      const { currencyCode } = plugin.currencyInfo
      const balance = engine.getBalance({ currencyCode })
      const height = engine.getBlockHeight()
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_BALANCE',
        payload: { balance, currencyCode, walletId: input.props.id }
      })
      input.props.dispatch({
        type: 'CURRENCY_ENGINE_CHANGED_HEIGHT',
        payload: { height, walletId: input.props.id }
      })
    } catch (e) {
      input.props.onError(e)
      input.props.dispatch({ type: 'CURRENCY_ENGINE_FAILED', payload: e })
    }

    // Reload our data from disk:
    loadAllFiles(input).catch(e => input.props.onError(e))

    // Fire callbacks when our state changes:
    watchCurrencyWallet(input)

    return stopUpdates
  },

  // Starts & stops the engine for this wallet:
  engineStarted (input: CurrencyWalletInput) {
    return {
      update () {
        if (
          !input.props.selfOutput ||
          !input.props.selfOutput.api ||
          !input.props.selfState.fiatLoaded ||
          !input.props.selfState.fileNamesLoaded
        ) {
          return
        }

        const { engine, engineStarted } = input.props.selfOutput
        if (engine && !engineStarted) {
          input.onOutput(true)
          try {
            engine.startEngine()
          } catch (e) {
            input.props.onError(e)
          }
        }
      },

      destroy () {
        if (!input.props.selfOutput) return

        const { engine, engineStarted } = input.props.selfOutput
        if (engine && engineStarted) engine.killEngine()
      }
    }
  },

  // Creates the API object:
  api: (input: CurrencyWalletInput) => () => {
    if (
      !input.props.selfOutput ||
      !input.props.selfOutput.plugin ||
      !input.props.selfOutput.engine ||
      !input.props.selfState.publicWalletInfo ||
      !input.props.selfState.nameLoaded
    ) {
      return
    }

    const { plugin, engine } = input.props.selfOutput
    const { publicWalletInfo } = input.props.selfState
    const currencyWalletApi = makeCurrencyWalletApi(
      input,
      plugin,
      engine,
      publicWalletInfo
    )
    input.onOutput(currencyWalletApi)

    return stopUpdates
  },

  syncTimer (input: CurrencyWalletInput) {
    const ai: ApiInput = (input: any) // Safe, since input extends ApiInput
    let timeout: *

    function startTimer () {
      // Bail out if either the wallet or the repo aren't ready:
      const { id, state } = input.props
      if (
        !input.props.selfOutput ||
        !state.storageWallets[id] ||
        !state.storageWallets[id].status.lastSync
      ) {
        return
      }

      timeout = setTimeout(() => {
        syncStorageWallet(ai, id)
          .then(changes => startTimer())
          .catch(e => startTimer())
      }, 30 * 1000)
    }

    return {
      update () {
        // Kick off the initial sync if we don't already have one running:
        if (timeout == null) return startTimer()
      },

      destroy () {
        clearTimeout(timeout)
      }
    }
  },

  watcher (input: CurrencyWalletInput) {
    let lastState
    let lastSettings

    return () => {
      const { state, selfState, selfOutput } = input.props
      if (selfState == null || selfOutput == null) return

      // Update API object:
      if (lastState !== selfState) {
        lastState = selfState
        if (selfOutput.api != null) update(selfOutput.api)
      }

      // Update engine settings:
      const { accountId, pluginName } = selfState
      const userSettings = state.accounts[accountId].userSettings[pluginName]
      if (lastSettings !== userSettings) {
        lastSettings = userSettings
        const engine = selfOutput.engine
        if (engine != null) engine.changeUserSettings(userSettings || {})
      }
    }
  }
})

/**
 * Attempts to load/derive the wallet public keys.
 */
async function getPublicWalletInfo (
  walletInfo: EdgeWalletInfo,
  disklet: Disklet,
  tools: EdgeCurrencyTools
): Promise<EdgeWalletInfo> {
  // Try to load the cache:
  try {
    const publicKeyCache = await disklet
      .getText(PUBLIC_KEY_CACHE)
      .then(text => JSON.parse(text))
    if (
      publicKeyCache != null &&
      publicKeyCache.walletInfo != null &&
      publicKeyCache.walletInfo.keys != null &&
      publicKeyCache.walletInfo.id === walletInfo.id &&
      publicKeyCache.walletInfo.type === walletInfo.type
    ) {
      return publicKeyCache.walletInfo
    }
  } catch (e) {}

  // Derive the public keys:
  let publicKeys = {}
  try {
    if (tools.derivePublicKey != null) {
      publicKeys = await tools.derivePublicKey(walletInfo)
    }
  } catch (e) {}
  const publicWalletInfo = {
    id: walletInfo.id,
    type: walletInfo.type,
    keys: publicKeys
  }

  // Save the cache if it's not empty:
  if (Object.keys(publicKeys).length > 0) {
    await disklet.setText(
      PUBLIC_KEY_CACHE,
      JSON.stringify({ walletInfo: publicWalletInfo })
    )
  }

  return publicWalletInfo
}
