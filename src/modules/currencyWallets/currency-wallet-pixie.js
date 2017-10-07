// @flow
import { mapPixie, stopUpdates } from 'redux-pixies'
import type { PixieInput } from 'redux-pixies'
import type { ActiveLoginState } from '../login/active/active-login-reducer.js'
import type { WalletInfo } from '../login/login-types.js'
import type { RootProps } from '../root.js'
import { addCurrencyWallet } from './actions.js'

interface TempProps extends RootProps {
  login: ActiveLoginState
}

interface CurrencyWalletProps extends RootProps {
  walletInfo: WalletInfo<any>
}

function walletPixie (input: PixieInput<CurrencyWalletProps>) {
  return {
    update (props: CurrencyWalletProps) {
      props.dispatch(addCurrencyWallet(props.walletInfo))
      return stopUpdates
    },

    destroy () {}
  }
}

// Spread the wallet pixie over all accounts and wallets:
export default mapPixie(
  mapPixie(
    walletPixie,
    ({ login }: TempProps) => login.currencyWalletIds,
    (props: TempProps, id: string): CurrencyWalletProps =>
      ({
        ...props,
        walletInfo: props.login.allWalletInfos[id]
      }: any)
  ),
  ({ state }: RootProps) => state.login.activeLoginIds,
  (props: RootProps, id): TempProps => ({
    ...props,
    login: props.state.login.logins[id]
  })
)
