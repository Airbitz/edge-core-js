import { uncleaner } from 'cleaners'
import { makeMemoryDisklet } from 'disklet'
import { base16, base64 } from 'rfc4648'
import { bridgifyObject, close } from 'yaob'

import { fixUsername } from '../../client-side'
import { asLoginPayload } from '../../types/server-cleaners'
import {
  EdgeAccount,
  EdgeContext,
  EdgeFakeContextOptions,
  EdgeFakeUser,
  EdgeFakeWorld,
  EdgeIo
} from '../../types/types'
import { base58 } from '../../util/encoding'
import { makeFetch } from '../../util/http/http-to-fetch'
import { LogBackend } from '../log/log'
import { applyLoginPayload } from '../login/login'
import { asLoginStash } from '../login/login-stash'
import { PluginIos } from '../plugins/plugins-actions'
import { makeContext } from '../root'
import { makeRepoPaths, saveChanges } from '../storage/repo'
import { FakeDb } from './fake-db'
import { makeFakeServer } from './fake-server'

const wasLoginStash = uncleaner(asLoginStash)

async function saveUser(io: EdgeIo, user: EdgeFakeUser): Promise<void> {
  const { loginId, loginKey, username } = user

  // Save the stash:
  const stash = applyLoginPayload(
    {
      appId: '',
      lastLogin: user.lastLogin,
      loginId: '',
      pendingVouchers: [],
      username: fixUsername(username)
    },
    base64.parse(loginKey),
    asLoginPayload(user.server)
  )
  const path = `logins/${base58.stringify(base64.parse(loginId))}.json`
  await io.disklet.setText(path, JSON.stringify(wasLoginStash(stash)))

  // Save the repos:
  await Promise.all(
    Object.keys(user.repos).map(async syncKey => {
      const paths = makeRepoPaths(io, base16.parse(syncKey), new Uint8Array(0))
      await saveChanges(paths.dataDisklet, user.repos[syncKey])
      await paths.baseDisklet.setText(
        'status.json',
        JSON.stringify({ lastSync: 1, lastHash: null })
      )
    })
  )
}

/**
 * Creates a fake Edge server for unit testing.
 */
export function makeFakeWorld(
  ios: PluginIos,
  logBackend: LogBackend,
  users: EdgeFakeUser[]
): EdgeFakeWorld {
  const { io, nativeIo } = ios
  const fakeDb = new FakeDb()
  const fakeServer = makeFakeServer(fakeDb)
  for (const user of users) fakeDb.setupFakeUser(user)

  const contexts: EdgeContext[] = []

  const out = {
    async close() {
      await Promise.all(contexts.map(context => context.close()))
      close(out)
    },

    async makeEdgeContext(opts: EdgeFakeContextOptions): Promise<EdgeContext> {
      const fakeIo = {
        ...io,
        disklet: makeMemoryDisklet(),
        fetch: makeFetch(fakeServer)
      }

      // Populate the stashes:
      if (!opts.cleanDevice) {
        await Promise.all(users.map(async user => await saveUser(fakeIo, user)))
      }

      fakeIo.disklet
        .setText(
          'rateHintCache.json',
          JSON.stringify([{ fromCurrency: 'FAKE', toCurrency: 'TOKEN' }])
        )
        .catch(() => undefined)

      const out = await makeContext({ io: fakeIo, nativeIo }, logBackend, {
        ...opts
      })
      contexts.push(out)
      return out
    },

    async goOffline(offline: boolean = true): Promise<void> {
      fakeServer.offline = offline
    },

    async dumpFakeUser(account: EdgeAccount): Promise<EdgeFakeUser> {
      if (account.appId !== '') {
        throw new Error('Only root logins are dumpable.')
      }
      const loginId = base64.stringify(base58.parse(account.rootLoginId))

      // Find the data on the server:
      const login = fakeDb.getLoginById(loginId)
      if (login == null) throw new Error(`Cannot find user ${account.username}`)

      // Figure out which repos to use:
      const syncKeys = account.allKeys
        .filter(info => info.keys != null && info.keys.syncKey != null)
        .map(info =>
          base16.stringify(base64.parse(info.keys.syncKey)).toLowerCase()
        )
      const repos = {}
      for (const syncKey of syncKeys) repos[syncKey] = fakeDb.repos[syncKey]

      return {
        lastLogin: account.lastLogin,
        loginId,
        loginKey: base64.stringify(base58.parse(account.loginKey)),
        repos,
        server: fakeDb.dumpLogin(login),
        username: account.username
      }
    }
  }
  bridgifyObject(out)

  return out
}
