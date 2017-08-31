import { hmacSha256 } from '../../crypto/crypto.js'
import { base58, utf8 } from '../../util/encoding.js'

export function getStorageWalletLastSync (state, keyId) {
  return state.storageWallets[keyId].status.lastSync
}

export function getStorageWalletFolder (state, keyId) {
  return state.storageWallets[keyId].paths.folder
}

export function getStorageWalletLocalFolder (state, keyId) {
  return state.storageWallets[keyId].localFolder
}

export function hashStorageWalletFilename (state, keyId, data) {
  const dataKey = state.storageWallets[keyId].paths.dataKey
  return base58.stringify(hmacSha256(utf8.parse(data), dataKey))
}
