// @flow

import { base16, base64 } from 'rfc4648'

import {
  type EdgeCreateCurrencyWalletOptions,
  type EdgeWalletInfo
} from '../../types/types.js'
import { encrypt, hmacSha256 } from '../../util/crypto/crypto.js'
import { utf8 } from '../../util/encoding.js'
import { waitForCurrencyWallet } from '../currency/currency-selectors.js'
import { applyKit } from '../login/login.js'
import { getCurrencyTools } from '../plugins/plugins-selectors.js'
import { type ApiInput } from '../root-pixie.js'
import {
  type AppIdMap,
  type LoginKit,
  type LoginTree,
  type StorageKeys,
  type StorageWalletInfo
} from './login-types.js'

/**
 * Returns the first keyInfo with a matching type.
 */
export function findFirstKey (keyInfos: Array<EdgeWalletInfo>, type: string) {
  return keyInfos.find(info => info.type === type)
}

export function makeAccountType (appId: string) {
  return appId === ''
    ? 'account-repo:co.airbitz.wallet'
    : `account-repo:${appId}`
}

/**
 * Assembles the key metadata structure that is encrypted within a keyBox.
 * @param idKey Used to derive the wallet id. It's usually `dataKey`.
 */
export function makeKeyInfo (type: string, keys: {}, idKey: Uint8Array) {
  return {
    id: base64.stringify(hmacSha256(utf8.parse(type), idKey)),
    type,
    keys
  }
}

/**
 * Makes keys for accessing an encrypted Git repo.
 */
export function makeStorageKeyInfo (
  ai: ApiInput,
  type: string,
  keys: StorageKeys = {}
) {
  const { io } = ai.props
  if (keys.dataKey == null) keys.dataKey = base64.stringify(io.random(32))
  if (keys.syncKey == null) keys.syncKey = base64.stringify(io.random(20))

  return makeKeyInfo(type, keys, base64.parse(keys.dataKey))
}

/**
 * Assembles all the resources needed to attach new keys to the account.
 */
export function makeKeysKit (
  ai: ApiInput,
  login: LoginTree,
  ...keyInfos: Array<StorageWalletInfo>
): LoginKit {
  const { io } = ai.props
  const keyBoxes = keyInfos.map(info =>
    encrypt(io, utf8.parse(JSON.stringify(info)), login.loginKey)
  )
  const newSyncKeys: Array<string> = []
  for (const info of keyInfos) {
    if (info.keys.syncKey != null) {
      const data = base64.parse(info.keys.syncKey)
      newSyncKeys.push(base16.stringify(data).toLowerCase())
    }
  }

  return {
    serverPath: '/v2/login/keys',
    server: { keyBoxes, newSyncKeys },
    stash: { keyBoxes },
    login: { keyInfos },
    loginId: login.loginId
  }
}

/**
 * Flattens an array of key structures, removing duplicates.
 */
export function mergeKeyInfos (keyInfos: Array<EdgeWalletInfo>) {
  const out = []
  const ids = {} // Maps ID's to output array indexes

  for (const keyInfo of keyInfos) {
    const { id, type, keys } = keyInfo
    if (id == null || base64.parse(id).length !== 32) {
      throw new Error(`Key integrity violation: invalid id ${id}`)
    }

    if (ids[id] != null) {
      // We have already seen this id, so check for conflicts:
      const old = out[ids[id]]
      if (old.type !== type) {
        throw new Error(
          `Key integrity violation for ${id}: type ${type} does not match ${
            old.type
          }`
        )
      }
      for (const key of Object.keys(keys)) {
        if (old.keys[key] != null && old.keys[key] !== keys[key]) {
          throw new Error(
            `Key integrity violation for ${id}: ${key} keys do not match`
          )
        }
      }

      // Do the update:
      out[ids[id]] = { id, type, keys: { ...old.keys, ...keys } }
    } else {
      // We haven't seen this id, so insert it:
      ids[id] = out.length
      out.push(keyInfo)
    }
  }

  return out
}

/**
 * Returns all the wallet infos accessible from this login object,
 * as well as a map showing which wallets are in which applications.
 */
export function getAllWalletInfos (
  login: LoginTree,
  legacyWalletInfos: Array<EdgeWalletInfo> = []
) {
  const appIdMap: AppIdMap = {}
  const walletInfos: Array<EdgeWalletInfo> = []

  // Add the legacy wallets first:
  for (const info of legacyWalletInfos) {
    walletInfos.push(info)
    if (appIdMap[info.id] == null) appIdMap[info.id] = [login.appId]
    else appIdMap[info.id].push(login.appId)
  }

  function getAllWalletInfosLoop (login: LoginTree) {
    // Add our own walletInfos:
    for (const info of login.keyInfos) {
      walletInfos.push(info)
      if (appIdMap[info.id] == null) appIdMap[info.id] = [login.appId]
      else appIdMap[info.id].push(login.appId)
    }

    // Add our children's walletInfos:
    if (login.children) {
      for (const child of login.children) {
        getAllWalletInfosLoop(child)
      }
    }
  }
  getAllWalletInfosLoop(login)

  return { appIdMap, walletInfos: mergeKeyInfos(walletInfos) }
}

/**
 * Upgrades legacy wallet info structures into the new format.
 *
 * Wallets normally have `wallet:pluginName` as their type,
 * but some legacy wallets also put format information into the wallet type.
 * This routine moves the information out of the wallet type into the keys.
 *
 * It also provides some other default values as a historical accident,
 * but the bitcoin plugin can just provide its own fallback values if
 * `format` or `coinType` are missing. Please don't make the problem worse
 * by adding more code here!
 */
export function fixWalletInfo (walletInfo: EdgeWalletInfo): EdgeWalletInfo {
  const { id, keys, type } = walletInfo

  // Wallet types we need to fix:
  const defaults = {
    // BTC:
    'wallet:bitcoin-bip44': { format: 'bip44', coinType: 0 },
    'wallet:bitcoin-bip49': { format: 'bip49', coinType: 0 },
    // BCH:
    'wallet:bitcoincash-bip32': { format: 'bip32' },
    'wallet:bitcoincash-bip44': { format: 'bip44', coinType: 145 },
    // BCH testnet:
    'wallet:bitcoincash-bip44-testnet': { format: 'bip44', coinType: 1 },
    // BTC testnet:
    'wallet:bitcoin-bip44-testnet': { format: 'bip44', coinType: 1 },
    'wallet:bitcoin-bip49-testnet': { format: 'bip49', coinType: 1 },
    // DASH:
    'wallet:dash-bip44': { format: 'bip44', coinType: 5 },
    // DOGE:
    'wallet:dogecoin-bip44': { format: 'bip44', coinType: 3 },
    // LTC:
    'wallet:litecoin-bip44': { format: 'bip44', coinType: 2 },
    'wallet:litecoin-bip49': { format: 'bip49', coinType: 2 },
    // FTC:
    'wallet:feathercoin-bip49': { format: 'bip49', coinType: 8 },
    'wallet:feathercoin-bip44': { format: 'bip44', coinType: 8 },
    // QTUM:
    'wallet:qtum-bip44': { format: 'bip44', coinType: 2301 },
    // UFO:
    'wallet:ufo-bip49': { format: 'bip49', coinType: 202 },
    'wallet:ufo-bip84': { format: 'bip84', coinType: 202 },
    // XZC:
    'wallet:zcoin-bip44': { format: 'bip44', coinType: 136 },

    // The plugin itself could handle these lines, but they are here
    // as a historical accident. Please don't add more:
    'wallet:bitcoin-testnet': { format: 'bip32' },
    'wallet:bitcoin': { format: 'bip32' },
    'wallet:bitcoincash-testnet': { format: 'bip32' },
    'wallet:litecoin': { format: 'bip32', coinType: 2 },
    'wallet:zcoin': { format: 'bip32', coinType: 136 }
  }

  if (defaults[type]) {
    return {
      id,
      keys: { ...defaults[type], ...keys },
      type: type.replace(/-bip[0-9]+/, '')
    }
  }

  return walletInfo
}

export async function createCurrencyWallet (
  ai: ApiInput,
  accountId: string,
  walletType: string,
  opts: EdgeCreateCurrencyWalletOptions
) {
  const { login, loginTree } = ai.props.state.accounts[accountId]

  // Make the keys:
  const tools = await getCurrencyTools(ai, walletType)
  let keys
  if (opts.keys != null) {
    keys = opts.keys
  } else if (opts.importText != null) {
    if (tools.importKey == null) {
      throw new Error('This wallet does not support importing keys')
    }
    keys = await tools.importKey(opts.importText, opts.keyOptions)
  } else {
    keys = await tools.createPrivateKey(opts.keyOptions)
  }

  const walletInfo = makeStorageKeyInfo(ai, walletType, keys)
  const kit = makeKeysKit(ai, login, fixWalletInfo(walletInfo))

  // Add the keys to the login:
  await applyKit(ai, loginTree, kit)
  const wallet = await waitForCurrencyWallet(ai, walletInfo.id)

  if (opts.name) await wallet.renameWallet(opts.name)
  if (opts.fiatCurrencyCode) {
    await wallet.setFiatCurrencyCode(opts.fiatCurrencyCode)
  }

  return wallet
}
