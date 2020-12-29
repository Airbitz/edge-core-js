// @flow

import { type PixieInput, type TamePixie, filterPixie } from 'redux-pixies'

import { type EdgeRateHint, type EdgeRatePlugin } from '../../types/types.js'
import { type RootProps } from '../root-pixie.js'
import { type ExchangePair } from './exchange-reducer.js'

const savedRateHints: EdgeRateHint[] = []

export function addHint(fromCurrency: string, toCurrency: string) {
  savedRateHints.push({ fromCurrency, toCurrency })
}

export const exchange: TamePixie<RootProps> = filterPixie(
  (input: PixieInput<RootProps>) => {
    let started: boolean = false
    let stopped: boolean = false
    let timeout: TimeoutID | void

    function gatherHints(): EdgeRateHint[] {
      const rateHints: EdgeRateHint[] = [...savedRateHints]
      const wallets = input.props.state.currency.wallets
      if (Object.keys(wallets).length === 0)
        return [
          { fromCurrency: 'BTC', toCurrency: 'iso:EUR' },
          { fromCurrency: 'BTC', toCurrency: 'iso:USD' },
          { fromCurrency: 'ETH', toCurrency: 'iso:EUR' },
          { fromCurrency: 'ETH', toCurrency: 'iso:USD' },
          { fromCurrency: 'BCH', toCurrency: 'iso:EUR' },
          { fromCurrency: 'BCH', toCurrency: 'iso:USD' }
        ]
      for (const wallet in wallets) {
        const fiat = wallets[wallet].fiat
        for (const cc in wallets[wallet].balances) {
          const currencyPair = { fromCurrency: cc, toCurrency: fiat }
          if (rateHints.length === 0) {
            rateHints.push(currencyPair)
          } else {
            let uniquePair = true
            for (const hint of rateHints) {
              if (
                hint.fromCurrency === currencyPair.fromCurrency &&
                hint.toCurrency === currencyPair.toCurrency
              ) {
                uniquePair = false
                break
              }
            }
            if (uniquePair) rateHints.push(currencyPair)
          }
        }
      }
      return rateHints
    }

    function dispatchPairs(pairs: ExchangePair[], source: string): void {
      input.props.log.warn(`Exchange rates updated (${source})`)
      if (pairs.length > 0) {
        input.props.dispatch({
          type: 'EXCHANGE_PAIRS_FETCHED',
          payload: pairs
        })
      }
    }

    function doFetch(): void {
      // Quit early if there is nothing to do:
      const pluginIds = Object.keys(input.props.state.plugins.rate)
      if (pluginIds.length === 0) return

      const hintPairs = gatherHints()

      // Gather pairs for up to five seconds, then send what we have:
      let wait: boolean = true
      let waitingPairs: ExchangePair[] = []
      function sendWaitingPairs(done?: boolean): void {
        wait = false
        dispatchPairs(waitingPairs, done ? 'complete' : 'some pending')
      }
      const waitTimeout = setTimeout(sendWaitingPairs, 5000)

      // Initiate all requests:
      let finishedPairs: number = 0
      const timestamp = Date.now() / 1000
      const promises = pluginIds.map(pluginId => {
        const plugin = input.props.state.plugins.rate[pluginId]
        return fetchPluginRates(plugin, hintPairs, pluginId, timestamp)
          .then(pairs => {
            if (wait) waitingPairs = [...waitingPairs, ...pairs]
            else dispatchPairs(pairs, pluginId)
          })
          .catch(error => {
            input.props.log.error(
              `Rate provider ${pluginId} failed: ${String(error)}`
            )
          })
          .then(() => {
            // There is no need to keep waiting if all plugins are done:
            if (wait && ++finishedPairs >= pluginIds.length) {
              clearTimeout(waitTimeout)
              sendWaitingPairs(true)
            }
          })
      })

      // Wait for everyone to finish before doing another round:
      Promise.all(promises).then(() => {
        if (!stopped) timeout = setTimeout(doFetch, 30 * 1000)
      })
    }

    return {
      update(props: RootProps): void {
        // Kick off the initial fetch if we don't already have one running
        // and the plugins are ready:
        if (!started && props.state.plugins.locked) {
          started = true
          doFetch()
        }
      },

      destroy() {
        stopped = true
        if (timeout != null) clearTimeout(timeout)
      }
    }
  },
  props => (props.state.paused ? undefined : props)
)

/**
 * Fetching exchange rates can fail in exciting ways,
 * so performs a fetch with maximum paranoia.
 */
function fetchPluginRates(
  plugin: EdgeRatePlugin,
  hintPairs: EdgeRateHint[],
  source: string,
  timestamp: number
): Promise<ExchangePair[]> {
  try {
    return plugin.fetchRates(hintPairs).then(pairs =>
      pairs.map(pair => {
        const { fromCurrency, toCurrency, rate } = pair
        if (
          typeof fromCurrency !== 'string' ||
          typeof toCurrency !== 'string' ||
          typeof rate !== 'number'
        ) {
          throw new TypeError('Invalid data format')
        }
        return {
          fromCurrency,
          toCurrency,
          rate,
          source,
          timestamp
        }
      })
    )
  } catch (error) {
    return Promise.reject(error)
  }
}
