// @flow
import type { ApiInput } from '../root.js'

const API_PREFIX = 'https://shapeshift.io'

export function makeShapeshiftApi (ai: ApiInput) {
  const io = ai.props.io
  const apiKey = ai.props.shapeshiftKey

  const api = {
    async get (path) {
      const reply = await io.fetch(`${API_PREFIX}${path}`)
      return reply.json()
    },
    async post (path, body) {
      const reply = await io.fetch(`${API_PREFIX}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      return reply.json()
    }
  }

  return {
    async getExchangeSwapRate (
      fromCurrency: string,
      toCurrency: string
    ): Promise<number> {
      const pair = `${fromCurrency}_${toCurrency}`
      const json = await api.get(`/rate/${pair}`)
      return +json.rate
    },

    async getSwapAddress (
      fromCurrency: string,
      toCurrency: string,
      addressFrom: string,
      addressTo: string
    ) {
      if (!apiKey) throw new Error('No Shapeshift API key provided')

      const body = {
        withdrawal: addressTo,
        pair: `${fromCurrency}_${toCurrency}`,
        returnAddress: addressFrom,
        apiKey
      }
      return api.post('/shift', body)
    }
  }
}
