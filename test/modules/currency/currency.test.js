// @flow

import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  type EdgeCurrencyPluginFactory,
  makeFakeEdgeWorld
} from '../../../src/index.js'
import {
  getCurrencyMultiplier,
  hasCurrencyPlugin
} from '../../../src/modules/currency/currency-selectors.js'
import { expectRejection } from '../../expect-rejection.js'
import { fakeCurrencyInfo } from '../../fake/fake-currency-info.js'
import { makeFakeCurrency } from '../../fake/fake-currency-plugin.js'
import { fakeUser } from '../../fake/fake-user.js'

const contextOptions = { apiKey: '', appId: '' }

describe('currency selectors', function () {
  const infos = [fakeCurrencyInfo]

  it('find currency multiplier', function () {
    expect(getCurrencyMultiplier(infos, [], 'SMALL')).equals('10')
    expect(getCurrencyMultiplier(infos, [], 'TEST')).equals('100')
    expect(getCurrencyMultiplier(infos, [], 'TOKEN')).equals('1000')
    expect(getCurrencyMultiplier(infos, [], '-error-')).equals('1')
  })

  it('has currency plugin', function () {
    expect(hasCurrencyPlugin(infos, 'wallet:fakecoin')).equals(true)
    expect(hasCurrencyPlugin(infos, 'wallet:nope')).equals(false)
  })
})

describe('currency pixie', function () {
  it('adds plugins', async function () {
    const world = await makeFakeEdgeWorld([fakeUser])
    const context = await world.makeEdgeContext({
      ...contextOptions,
      plugins: [makeFakeCurrency()]
    })
    const account = await context.loginWithPIN(fakeUser.username, fakeUser.pin)

    expect(Object.keys(account.currencyConfig)).deep.equals(['testcoin'])
  })

  it('handles errors gracefully', async function () {
    const brokenPlugin: EdgeCurrencyPluginFactory = {
      pluginName: 'broken',
      pluginType: 'currency',
      makePlugin () {
        throw new Error('Expect to fail')
      }
    }
    const world = await makeFakeEdgeWorld([fakeUser])
    const context = await world.makeEdgeContext({
      ...contextOptions,
      plugins: [brokenPlugin]
    })
    return expectRejection(
      context.loginWithPIN(fakeUser.username, fakeUser.pin),
      'Error: Expect to fail'
    )
  })
})
