var Account = require('./account').Account
var loginEdge = require('./login/edge.js')
var loginCreate = require('./login/create.js')
var loginPassword = require('./login/password.js')
var loginPin = require('./login/pin.js')
var loginRecovery2 = require('./login/recovery2.js')
var userMap = require('./userMap.js')
var UserStorage = require('./userStorage.js').UserStorage

// var serverRoot = 'https://auth.airbitz.co/api'
var serverRoot = 'https://test-auth.airbitz.co/api'

/**
 * @param authRequest function (method, uri, body, callback (err, status, body))
 * @param localStorage an object compatible with the Web Storage API.
 */
function Context (authRequest, localStorage, accountType) {
  this.accountType = accountType || 'account:repo:co.airbitz.wallet'

  /**
   * Wraps the raw authRequest function in something more friendly.
   * @param body JSON object
   * @param callback function (err, reply JSON object)
   */
  this.authRequest = function (method, uri, body, callback) {
    authRequest(method, serverRoot + uri, body, function (err, status, body) {
      if (err) return callback(err)
      try {
        var reply = JSON.parse(body)
      } catch (e) {
        return callback(Error('Non-JSON reply, HTTP status ' + status))
      }

      // Look at the Airbitz status code:
      switch (reply['status_code']) {
        case 0:
          return callback(null, reply.results)
        default:
          return callback(Error(status + ' ' + body))
      }
    })
  }

  this.localStorage = localStorage
}

Context.prototype.usernameList = function () {
  var map = userMap.load(this.localStorage)
  var out = []
  for (var username in map) {
    if (map.hasOwnProperty(username)) {
      out.push(username)
    }
  }
  return out
}
Context.prototype.listUsernames = Context.prototype.usernameList

Context.prototype.fixUsername = userMap.normalize

Context.prototype.usernameAvailable = function (username, callback) {
  return loginCreate.usernameAvailable(this, username, callback)
}

/**
 * Creates a login, then creates and attaches an account to it.
 */
Context.prototype.accountCreate = function (username, password, callback) {
  var ctx = this
  return loginCreate.create(ctx, username, password, {}, function (err, login) {
    if (err) return callback(err)
    try {
      login.accountFind(ctx.accountType)
    } catch(e) {
      // If the login doesn't have the correct account type, add it first:
      return login.accountCreate(ctx, ctx.accountType, function (err) {
        if (err) return callback(err)
        callback(null, new Account(ctx, login))
      })
    }

    // Otherwise, we have the correct account type, and can simply return:
    callback(null, new Account(ctx, login))
  })
}
Context.prototype.createAccount = function (username, password, pin, opts, callback) {
  var ctx = this
  return loginCreate.create(ctx, username, password, function (err, login) {
    if (err) return callback(err)
    loginPin.setup(ctx, login, pin, function (err) {
      if (err) return callback(err)
      callback(null, new Account(ctx, login))
    })
  })
}

Context.prototype.passwordLogin = function (username, password, callback) {
  var ctx = this
  return loginPassword.login(ctx, username, password, function (err, login) {
    if (err) return callback(err)
    callback(null, new Account(ctx, login))
  })
}
Context.prototype.loginWithPassword = function (username, password, otp, opts, callback) {
  return loginPassword.login(this, username, password, callback)
}

Context.prototype.pinExists = function (username) {
  return loginPin.exists(this, username)
}
Context.prototype.pinLoginEnabled = function (username) {
  return loginPin.exists(this, username)
}

Context.prototype.pinLogin = function (username, pin, callback) {
  var ctx = this
  return loginPin.login(ctx, username, pin, function (err, login) {
    if (err) return callback(err)
    callback(null, new Account(ctx, login))
  })
}
Context.prototype.loginWithPIN = function (username, pin, opts, callback) {
  return loginPin.login(this, username, pin, callback)
}

Context.prototype.getRecovery2Key = function (username, callback) {
  var userStorage = new UserStorage(this.localStorage, username)
  var recovery2Key = userStorage.getItem('recovery2Key')
  if (recovery2Key) {
    callback(null, recovery2Key)
  } else {
    callback(new Error('No recovery key stored locally.'))
  }
}

Context.prototype.loginWithRecovery2 = function (recovery2Key, username, answers, otp, options, callback) {
  var ctx = this
  return loginRecovery2.login(ctx, recovery2Key, username, answers, function (err, login) {
    if (err) return callback(err)
    callback(null, new Account(ctx, login))
  })
}

Context.prototype.fetchRecovery2Questions = function (recovery2Key, username, callback) {
  return loginRecovery2.questions(this, recovery2Key, username, callback)
}

Context.prototype.checkPasswordRules = function (password) {
  var tooShort = password.length < 10
  var noNumber = password.match(/\d/) == null
  var noUpperCase = password.match(/[A-Z]/) == null
  var noLowerCase = password.match(/[a-z]/) == null

  return {
    'tooShort': tooShort,
    'noNumber': noNumber,
    'noUpperCase': noUpperCase,
    'noLowerCase': noLowerCase,
    'passed': !(tooShort || noNumber || noUpperCase || noLowerCase)
  }
}

Context.prototype.requestEdgeLogin = function (opts, callback) {
  var ctx = this
  var onLogin = opts.onLogin
  opts.onLogin = function (err, login) {
    if (err) return onLogin(err)
    onLogin(null, new Account(ctx, login))
  }
  opts.type = opts.type || ctx.accountType
  loginEdge.create(this, opts, callback)
}

exports.Context = Context
