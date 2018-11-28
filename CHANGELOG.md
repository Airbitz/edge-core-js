# edge-core-js

## 0.12.20

* Fix the splitting/replayProtection from bcash to bitcoinsh
* Some flow fixes
* Add metadata to replay protection transactions
* Do not await on `reloadPluginSettings`, This prevents network roundtrips from blocking login. Upwards of 30s saved on really slow networks.

## 0.12.19

* When splitting from bcash to bitcoinsv, preform a maxSpend to self to have replay protaction before splitting the wallet

## 0.12.18

* Fix detecting and throwing of ShapeShift errors due to geo location or unverified accounts

## 0.12.17

* Improve `fetchSwapQuote` error hierarchy with rich information about different possible error conditions.

## 0.12.16

* Fix getTransactions from only returning a subset of transactions
* Fix swap exchange to gracefully fallback if one exchange errors
* Properly filter out a swap provider if they don't support a getQuote currency pair

## 0.12.12

* Do not call makeEngine on wallets which are archived or deleted

## 0.12.11

* Allow createPrivateKey, derivePublicKey, parseUri, and encodeUri methods from currency plugins to be async

## 0.12.10 (2018-11-02)

* Fix a potential crash on logout.
* Allow swap plugins to be disabled.
* Add `supportEmail` to `EdgeSwapInfo`.
* Fix swapping from coins with unique id's using Changelly.
* Log more swap steps.
* Upgrade to Disklet v0.2.8.

## 0.12.9

* Remove change to types of createPrivateKey and derivePublicKey due to Flow errors

## 0.12.8

* Fix throw when user account doesn't have a Shapeshift auth token

## 0.12.7

* Fix Changelly to use legacy addresses except for DGB

## 0.12.6

* Add denomination conversion helper routines.
* Add Changelly support to the swap API.

## 0.12.5

New:
* `EdgeSwapConfig.needsActivation` for exchanges that need KYC or other data.
* `EdgeSwapQuote.networkFee` for outgoing network fee.
* `SwapBelowLimitError` & `SwapAboveLimitError` for failed quotes.

Deprecations:
* `EdgeContext.getAvailableExchangeTokens`
* `EdgeContext.getExchangeSwapInfo`
* `EdgeContext.getExchangeSwapRate`
* `EdgeCurrencyWallet.getQuote`

Renames (old names deprecated):
* `EdgeAccount.currencyTools` -> `EdgeAccount.currencyConfig`
* `EdgeAccount.exchangeTools` -> `EdgeAccount.swapConfig`
* `EdgeAccount.getExchangeCurrencies` -> `EdgeAccount.fetchSwapCurrencies`
* `EdgeAccount.getExchangeQuote` -> `EdgeAccount.fetchSwapQuote`
* `EdgeCurrencyTools.settings` -> `EdgeCurrencyConfig.userSettings`
* `EdgeCurrencyTools.changeSettings` -> `EdgeCurrencyConfig.changeUserSettings`
* `EdgeExchangeQuote.exchangeSource` -> `EdgeSwapQuote.pluginName`
* `EdgeExchangeCurrencies.exchanges` -> `EdgeSwapCurrencies.pluginNames`

## 0.12.4

* Fix a packaging issue with the client-side methods.

## 0.12.3

* Move the client-side methods into their own file.

## 0.12.2

* Add a new Shapeshift API (still experimental & subject to change).
* Rename `EdgeCurrencyTools.pluginSettings` to `EdgeCurrencyTools.settings`.
* Rename `EdgeCurrencyTools.changePluginSettings` to `EdgeCurrencyTools.changeSettings`.

## 0.12.1

* Do not use legacy address for Digibyte when using ShapeShift

## 0.12.0

* Add a `waitForCurrencyWallet` helper.
* Work around 0 block-height problem with some currency plugins.
* Update to `yaob` 0.3.0. This one changes the timing on some callbacks a bit (breaking).

## 0.11.3

* Add a fake user with several test wallets.

## 0.11.2

* Hack around weird GUI Flow bug.

## 0.11.1

* Update the readme file.
* Work around a GUI crash.

## 0.11.0

* Make the core API bridgeable using Yaob.
* Add a private key hiding mode.
* Add a user list to the context object.

* Remove the ability to pass a node-style callback to any asynchronous API method instead of getting a promise.
* Fail earlier if the `apiKey` is missing.
* Rename `EdgeEdgeLoginRequest` to `EdgePendingEdgeLogin`

## 0.10.5

* Fix the git server list again.

## 0.10.4

* Fix the git server list.

## 0.10.3

* Upgrade disklet dependency.
* Add more git servers.

## 0.10.2

* Fix a type error that Flow somehow doesn't catch when run in this repo, but does catch when this library is in somebody else's `node_modules`.

## 0.10.1

* Expose the wallet sync ratio as a property
* Rename the account data store API
* Many, many code cleanups & fixes:
  * Fix an edge login race condition.
  * Do not allow users to delete logged-in accounts from disk.
  * Fix a hang if anything goes wrong creating wallets (redux-pixies upgrade).

## 0.10.0

* Remove deprecated context properties & options
* Remove `EdgeContext.io`
* Remove `EdgeContext.getCurrencyPlugins`
* Make many methods async:
  * `EdgeCurrencyWallet.getNumTransactions`
  * `EdgeAccount.listSplittableWalletTypes`
  * `EdgeCurrencyWallet.dumpData`
  * `EdgeCurrencyWallet.parseUri`
  * `EdgeCurrencyWallet.encodeUri`
* Add wallet properties for balances, block heights, and seeds

## 0.9.15

* Fix QBO & CSV export crash

## 0.9.14

* Another fix to QBO export 255-character limit (memo field)

## 0.9.13

* Pass options to `EdgeCurrencyPlugin.createPrivateKeys`.

## 0.9.12

* Fix QBO export error.
* Fix minor Flow bug.

## 0.9.11

* Upgrade Flow.
* Improve Flow types in currency wallet code.
* Fix bug where Edge could not edit Airbitz metadata.
* Add a basic `EdgeAccount.currencyTools` API.
* Fix QBO export bug.
* Fix more incorrect wallet key types.

## 0.9.10

* Add a `NoAmountSpecifiedError`.

## 0.9.9

* Fix a return value error in `listSplittableWalletTypes`.

## 0.9.8

* Fix Flow type bugs
* Fix incorrect platform detection on Web.

## 0.9.7

* Fix payment request Flow types.
* Implement plugin data API.

## 0.9.5

* Fix Edge login unhandled promise rejection error.
* Fix the Flow type for the transaction export denomination.
* Export the `Error` types directly.

## 0.9.4

* Fix Shapeshifting XMR and XRP.
* Add `EdgeCurrencyInfo.requiredConfirmations` and associated `PendingFundsError` types.

## 0.9.3

* Move the unit tests out of the `src` directory.

## 0.9.2

* Replace flow-copy-source with rollup-plugin-flow-entry to fix a packaging bug.
* Add `uniqueIdentifier` to `EdgeParsedUri`.

## 0.9.1
* Improve various flow typing issues, both inside and outside the core
* Add `getTxids` & related callback to the CurrencyEngine.

## 0.9.0-beta.1
* Auto-correct mis-typed 2fa secrets
* Expose hmacSha256 for the CLI
* Fixed spelling mistake
* Storage and Wallet flow coverage
* Rename storage and exchange related files
* Change createPrivateKey and derivePublicKey to Object instead of {}
* Remove empty strings in the QBO export

## 0.8.1

* Flow type fix

## 0.8.0

* Add QBO & CSV export
* Add private key sweeping
* Add `EdgeCurrencyWallet.getNumTransactions`
* Remove deprecated methods
* Throttle wallet callbacks

## 0.7.2

* Do not crash on really long passwords when running in the web.

## 0.7.1

* Fix Edge login race conditions.

## 0.7.0

* Support Shapeshift precise transactions

## 0.6.7

* Do not report transactions that have been dropped

## 0.6.6

* Fix incorrect array dereference when saving transaction metadata

## 0.6.5

* Optimize getTransactions to only decrypt data for the range queried
* Prevent bitcoin segwit wallets from being split to bitcoin cash

## 0.6.3

* Add legacyAddress to EdgeEncodeUri

## 0.6.2

* Fix git sync on timer after login

## 0.6.1

* Fix wallet splitting issues
* Fix git syncing issues for large wallets
* Add a `listSplittableWaleltTypes` function

## 0.6.0

* Renamed the library to edge-core-js

## 0.5.6

* Fix build issues on React Native & web.
* Properly handle Shapeshift HTTP error codes.
* Add a `getAvailableExchangeTokens` function to the context.

## 0.5.5

* Fix login checksum errors exposed by previous release.
* Fall back on the app name for unnamed wallets.

## 0.5.4

* Fixes exchange rate multipliers for custom tokens.
* Handle plugin errors more gracefully.
* Make PIN changes fully recursive across all apps
* Allow the PIN to be enabled / disabled

## 0.5.3

* Fixes to Flow types, including brand-new flow types for EdgeCurrencyWallet.
* Fixes for Shapeshift spends (Bitcoin Cash addresses, proper fees).
* Redux state cleanups

## 0.5.2

* Fix accelerated crypto on React Native.

## 0.5.1

* Remove core-js polyfill. The main GUI needs to pull this in, if needed, since including it too late in the setup process can break React.
* Switch to regenerator instead of nodent for async / await support. This is slower but more compatible.

## 0.5.0

Renamed the library to edge-login, massive development work.

## 0.3.5

Fixes:
* Logging into partner apps works again (round 2)

## 0.3.4

Fixes:
* Logging into partner apps works again

## 0.3.3

New:
* New plugin format
* Exchange rate cache
* `looginWithKey` method
* Store transaction metadata on first detection

Fixes:
* Code cleanup & reorganization
* Fixes to the transaction list
* Fixes to the transaction metadata format

Breaking changes:
* No longer expose the internal `login` or `loginTree` on the account.

## 0.3.2

New:
* Currency wallet support
* Wallet sort / archive / delete support
* Support for legacy wallet keys

Breaking changes:
* Fix the wallet id derivation algorithm

## 0.3.1

Fixes:
* The library explicitly depends on `buffer` now, fixing React Native
* Build system cleanups
* Many, many code cleanups

New:
* Error types all have a `name` property, which will replace the `type`
* Use the `disklet` library for all storage needs
* Expose `hashUsername` for the CLI

Breaking changes:
* api: Make `removeUsername` async
* The on-disk repo format has changed, requiring a re-sync

## 0.3.0

New:
* Accept the `io` object as a `makeContext` option

Breaking changes:
* Move the CLI tool to its own package
* api: Make `usernameAvailable` produce a bool
* api: Make `listUsernames` async
* api: Make `pinExists` & `pinLoginEnabled` async
* api: Remove deprecated exports
* api: Remove obsolete C++ error code system
* api: Remove platform-specific context constructors

## 0.2.1

* Make the auth server configurable
* Switch back to the production auth server by default

## 0.2.0

Breaking changes:
* Edge login v2
* New on-disk storage format

## 0.1.1

* Quick fix to package.json to exclude nodeisms from the browser

## 0.1.0

Breaking changes:
* Make `checkPassword` async
* Remove `runScryptTimingWithParameters`

New:
* Add a `removeUsername` method to the context
* `makeContext` accepts a `random` function
* Add a `makeRandomGenerator` helper for RN
* Many CLI improvements
* Better error types

Fixes:
* Faster scrypt
* Switch to the `fetch` API
* Troublesome dependencies are now bundled and isolated

## 0.0.11

* Port project to ES2015

## 0.0.10

Fixes:
* Sync server rotation support
* HTTPS connections to sync servers
* Removed asmcrypto.js
* Made the CLI executable & installable
* Pruned the list of files we publish to NPM
