// @flow
import { buildReducer, filterReducer, memoizeReducer } from 'redux-keto'
import type { RootAction } from '../../actions.js'
import type { RootState } from '../../rootReducer.js'
import { hasCurrencyPlugin } from '../../currency/currency-selectors.js'
import type { WalletInfoMap } from '../login-types.js'

export interface ActiveLoginState {
  allWalletInfos: WalletInfoMap;
  currencyWalletIds: Array<string>;
  appId: string;
  loginKey: Uint8Array;
  username: string;
}

export interface ActiveLoginProps {
  id: string;
  peers: ActiveLoginState;
  state: RootState;
}

const activeLogin = buildReducer(
  {
    allWalletInfos (
      state: WalletInfoMap = {},
      action: RootAction
    ): WalletInfoMap {
      if (action.type === 'ACCOUNT_KEYS_LOADED') {
        const out = {}
        for (const info of action.payload.walletInfos) {
          out[info.id] = info
        }
        return out
      }
      return state
    },

    currencyWalletIds: memoizeReducer(
      (props: ActiveLoginProps) => props.peers.allWalletInfos,
      (props: ActiveLoginProps) => props.state.currency.infos,
      (allWalletInfos, currencyInfos) => {
        return Object.keys(allWalletInfos).filter(walletId => {
          const info = allWalletInfos[walletId]
          return !info.deleted && hasCurrencyPlugin(currencyInfos, info.type)
        })
      }
    ),

    appId (state: string, action: RootAction) {
      return action.type === 'LOGIN' ? action.payload.appId : state
    },

    loginKey (state: Uint8Array, action: RootAction) {
      return action.type === 'LOGIN' ? action.payload.loginKey : state
    },

    username (state: string, action: RootAction) {
      return action.type === 'LOGIN' ? action.payload.username : state
    }
  },
  ({ id, state }, peers: ActiveLoginState): ActiveLoginProps => ({
    id,
    state,
    peers
  })
)

export default filterReducer(
  activeLogin,
  (action: RootAction, props: ActiveLoginProps) => {
    if (
      (action.type === 'ACCOUNT_KEYS_LOADED' &&
        action.payload.activeLoginId === props.id) ||
      (action.type === 'LOGIN' &&
        props.state.login.lastActiveLoginId === props.id)
    ) {
      return action
    }
  }
)
