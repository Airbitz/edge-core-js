import { decrypt, encrypt } from '../crypto/crypto.js'
import { fixUsername, hashUsername } from '../io/loginStore.js'
import { makeSnrp, scrypt, userIdSnrp } from '../redux/selectors.js'
import { rejectify } from '../util/decorators.js'
import { base64 } from '../util/encoding.js'
import { applyLoginReply, makeLoginTree, syncLogin } from './login.js'

export const passwordAuthSnrp = userIdSnrp

function makeHashInput (username, password) {
  return fixUsername(username) + password
}

/**
 * Extracts the loginKey from the login stash.
 */
function extractLoginKey (io, stash, username, password) {
  const state = io.redux.getState()

  if (stash.passwordBox == null || stash.passwordKeySnrp == null) {
    throw new Error('Missing data for offline password login')
  }
  const up = makeHashInput(username, password)
  return scrypt(state, up, stash.passwordKeySnrp).then(passwordKey => {
    return decrypt(stash.passwordBox, passwordKey)
  })
}

/**
 * Fetches the loginKey from the server.
 */
function fetchLoginKey (io, username, password) {
  const state = io.redux.getState()
  const up = makeHashInput(username, password)
  const userId = hashUsername(io, username)
  const passwordAuth = scrypt(state, up, passwordAuthSnrp)

  return Promise.all([userId, passwordAuth]).then(values => {
    const [userId, passwordAuth] = values
    const request = {
      userId: base64.stringify(userId),
      passwordAuth: base64.stringify(passwordAuth)
      // "otp": null
    }
    return io.authRequest('POST', '/v2/login', request).then(reply => {
      if (reply.passwordBox == null || reply.passwordKeySnrp == null) {
        throw new Error('Missing data for online password login')
      }
      return scrypt(state, up, reply.passwordKeySnrp).then(passwordKey => {
        return {
          loginKey: decrypt(reply.passwordBox, passwordKey),
          loginReply: reply
        }
      })
    })
  })
}

/**
 * Logs a user in using a password.
 * @param username string
 * @param password string
 * @return A `Promise` for the new root login.
 */
export function loginPassword (io, username, password) {
  return io.loginStore.load(username).then(stashTree => {
    return rejectify(extractLoginKey)(io, stashTree, username, password)
      .then(loginKey => {
        const loginTree = makeLoginTree(stashTree, loginKey)

        // Since we logged in offline, update the stash in the background:
        syncLogin(io, loginTree, loginTree).catch(e => io.console.warn(e))

        return loginTree
      })
      .catch(e => {
        // If that failed, try an online login:
        return fetchLoginKey(io, username, password).then(values => {
          const { loginKey, loginReply } = values
          stashTree = applyLoginReply(stashTree, loginKey, loginReply)
          io.loginStore.save(stashTree)
          return makeLoginTree(stashTree, loginKey)
        })
      })
  })
}

/**
 * Returns true if the given password is correct.
 */
export function checkPassword (io, login, password) {
  const state = io.redux.getState()

  // Derive passwordAuth:
  const up = makeHashInput(login.username, password)
  return scrypt(state, up, passwordAuthSnrp).then(passwordAuth => {
    // Compare what we derived with what we have:
    for (let i = 0; i < passwordAuth.length; ++i) {
      if (passwordAuth[i] !== login.passwordAuth[i]) {
        return false
      }
    }
    return true
  })
}

/**
 * Verifies that a password meets our suggested rules.
 */
export function checkPasswordRules (password) {
  const tooShort = password.length < 10
  const noNumber = !/[0-9]/.test(password)
  const noLowerCase = !/[a-z]/.test(password)
  const noUpperCase = !/[A-Z]/.test(password)

  // Quick & dirty password strength estimation:
  const charset =
    10 * /[0-9]/.test(password) +
    26 * /[A-Z]/.test(password) +
    26 * /[a-z]/.test(password) +
    30 * /[^0-9A-Za-z]/.test(password)
  const secondsToCrack = Math.pow(charset, password.length) / 1e6

  return {
    secondsToCrack,
    tooShort,
    noNumber,
    noLowerCase,
    noUpperCase,
    passed: password.length >= 16 ||
      !(tooShort || noNumber || noUpperCase || noLowerCase)
  }
}

/**
 * Creates the data needed to attach a password to a login.
 */
export function makePasswordKit (io, login, username, password) {
  const up = makeHashInput(username, password)
  const state = io.redux.getState()

  // loginKey chain:
  const boxPromise = makeSnrp(state).then(passwordKeySnrp => {
    return scrypt(state, up, passwordKeySnrp).then(passwordKey => {
      const passwordBox = encrypt(io, login.loginKey, passwordKey)
      return { passwordKeySnrp, passwordBox }
    })
  })

  // authKey chain:
  const authPromise = scrypt(state, up, passwordAuthSnrp).then(passwordAuth => {
    const passwordAuthBox = encrypt(io, passwordAuth, login.loginKey)
    return { passwordAuth, passwordAuthBox }
  })

  return Promise.all([boxPromise, authPromise]).then(values => {
    const [
      { passwordKeySnrp, passwordBox },
      { passwordAuth, passwordAuthBox }
    ] = values
    return {
      serverPath: '/v2/login/password',
      server: {
        passwordAuth: base64.stringify(passwordAuth),
        passwordAuthSnrp, // TODO: Use this on the other side
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      },
      stash: {
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      },
      login: {
        passwordAuth
      },
      loginId: login.loginId
    }
  })
}
