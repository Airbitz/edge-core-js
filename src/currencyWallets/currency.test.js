// @flow
import {add} from 'biggystring'
import { fakeUser, makeFakeContexts } from '../indexABC.js'
import { makeAssertLog } from '../test/assertLog.js'
import {
  makeFakeCurrency,
  makeFakeCurrencyStore
} from '../test/fakeCurrency.js'
import { fakeExchangePlugin } from '../test/fakeExchange.js'
import { awaitState } from '../util/redux/reaction.js'
import { PRECISION } from './api'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { describe, it } from 'mocha'
import { createStore } from 'redux'

chai.use(chaiAsPromised)

const { assert } = chai

async function makeFakeCurrencyWallet (store, callbacks) {
  const plugin = makeFakeCurrency(store)

  // Use `onKeyListChanged` to trigger checking for wallets:
  const trigger = createStore(state => null)
  callbacks = {
    ...callbacks,
    onKeyListChanged () {
      trigger.dispatch({ type: 'DUMMY' })
    }
  }

  const [context] = makeFakeContexts({
    localFakeUser: true,
    plugins: [plugin, fakeExchangePlugin]
  })
  const account = await context.loginWithPIN(fakeUser.username, fakeUser.pin, {
    callbacks
  })

  // Wait for the wallet to load:
  const walletId = account.getFirstWallet('wallet:fakecoin').id
  return awaitState(trigger, state => account.currencyWallets[walletId])
}

describe('currency wallets', function () {
  it('can be created', function () {
    return makeFakeCurrencyWallet().then(wallet =>
      assert.equal(wallet.name, 'Fake Wallet')
    )
  })

  it('can be renamed', function () {
    return makeFakeCurrencyWallet().then(wallet =>
      wallet
        .renameWallet('Another Name')
        .then(() => assert.equal(wallet.name, 'Another Name'))
    )
  })

  it('triggers callbacks', function () {
    const log = makeAssertLog(true)
    const store = makeFakeCurrencyStore()

    const callbacks = {
      onBalanceChanged (walletId, currencyCode, balance) {
        log('balance', currencyCode, balance)
      },
      onBlockHeightChanged (walletId, blockHeight) {
        log('blockHeight', blockHeight)
      },
      onNewTransactions (walletId, txs) {
        txs.map(tx => log('new', tx.txid))
      },
      onTransactionsChanged (walletId, txs) {
        txs.map(tx => log('changed', tx.txid))
      }
    }
    return makeFakeCurrencyWallet(store, callbacks).then(wallet => {
      let txState = []
      log.assert(['balance TEST 0', 'blockHeight 0'])

      store.dispatch({ type: 'SET_BALANCE', payload: 20 })
      log.assert(['balance TEST 20'])

      store.dispatch({ type: 'SET_BLOCK_HEIGHT', payload: 200 })
      log.assert(['blockHeight 200'])
      assert.equal(wallet.getBlockHeight(), 200)

      // New transactions:
      txState = [
        { txid: 'a', amountSatoshi: 1 },
        { txid: 'b', nativeAmount: '100' }
      ]
      store.dispatch({ type: 'SET_TXS', payload: txState })
      log.assert(['new a', 'new b'])

      // Should not trigger:
      store.dispatch({ type: 'SET_TXS', payload: txState })
      log.assert([])

      // Changed transactions:
      txState = [
        ...txState,
        { txid: 'a', nativeAmount: '2' },
        { txid: 'c', nativeAmount: '200' }
      ]
      store.dispatch({ type: 'SET_TXS', payload: txState })
      log.assert(['changed a', 'new c'])

      return null
    })
  })

  it('handles tokens', function () {
    const store = makeFakeCurrencyStore()

    return makeFakeCurrencyWallet(store).then(wallet => {
      const txs = [
        { txid: 'a', currencyCode: 'TEST', nativeAmount: '2' },
        { txid: 'b', currencyCode: 'TOKEN', nativeAmount: '200' }
      ]
      store.dispatch({ type: 'SET_TXS', payload: txs })

      return Promise.resolve()
        .then(() =>
          wallet.getTransactions({}).then(txs => {
            assert.equal(txs.length, 1)
            assert.equal(txs[0].txid, 'a')
            assert.strictEqual(txs[0].nativeAmount, '2')
            assert.strictEqual(txs[0].amountSatoshi, 2)
            return null
          })
        )
        .then(() =>
          wallet.getTransactions({ currencyCode: 'TOKEN' }).then(txs => {
            assert.equal(txs.length, 1)
            assert.equal(txs[0].txid, 'b')
            assert.strictEqual(txs[0].nativeAmount, '200')
            assert.strictEqual(txs[0].amountSatoshi, 200)
            return null
          })
        )
    })
  })

  it('getMaxSpendable', async function () {
    const store = makeFakeCurrencyStore()
    store.dispatch({ type: 'SET_BALANCE', payload: 50 })

    const wallet = await makeFakeCurrencyWallet(store)
    const maxSpendable = await wallet.getMaxSpendable({currencyCode: 'TEST', spendTargets: [{}]})

    assert.isFulfilled(wallet.makeSpend({spendTargets: [{ nativeAmount: maxSpendable }]}))
    assert.isRejected(wallet.makeSpend({spendTargets: [{ nativeAmount: add(maxSpendable, PRECISION) }]}))

    return null
  })

  // it('can have metadata', function () {
  //   const store = makeFakeCurrencyStore()
  //
  //   return makeFakeCurrencyWallet(store).then(wallet => {
  //     const tx = { txid: 'a', metadata: { name: 'me' } }
  //     store.dispatch({
  //       type: 'SET_TXS',
  //       payload: [{ txid: 'a', nativeAmount: '25' }]
  //     })
  //     return wallet.saveTx(tx).then(() =>
  //       wallet.getTransactions({}).then(txs => {
  //         assert.equal(txs.length, 1)
  //         assert.strictEqual(txs[0].metadata.name, tx.metadata.name)
  //         assert.strictEqual(txs[0].metadata.amountFiat, 0.75)
  //         assert.strictEqual(txs[0].amountSatoshi, 25)
  //         assert.strictEqual(txs[0].nativeAmount, '25')
  //         return null
  //       })
  //     )
  //   })
  // })
})
