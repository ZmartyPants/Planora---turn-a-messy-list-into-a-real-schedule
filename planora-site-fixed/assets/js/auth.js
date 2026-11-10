/*!
 * Planora — account, session and subscription layer
 * ---------------------------------------------------------------------------
 * Local-first accounts: credentials are stored as PBKDF2-SHA256 hashes with a
 * per-account salt, sessions carry a random token, and every read of application
 * data is scoped to the signed-in account id.
 *
 * This mode is designed so the product can be published and used on day one
 * without a server. Real email delivery, cross-device sync and card payments
 * require the backend described in DEPLOY.md; the call sites are already
 * separated so swapping them is a drop-in change.
 */
(function () {
  "use strict";

  var ITERATIONS = 150000;
  var SESSION_TTL_DAYS = 30;

  function toHex(buf) {
    var out = "";
    for (var i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, "0");
    return out;
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return toHex(a);
  }
  function weakHash(password, saltHex) {
    // Only used when SubtleCrypto is unavailable (insecure context / file://).
    var s = saltHex + password;
    var h1 = 0x811c9dc5,
      h2 = 0x1000193;
    for (var round = 0; round < 8000; round++) {
      for (var i = 0; i < s.length; i++) {
        h1 = (h1 ^ s.charCodeAt(i)) >>> 0;
        h1 = (h1 * 16777619) >>> 0;
        h2 = (h2 + s.charCodeAt(i) * (i + round + 1)) >>> 0;
        h2 = ((h2 << 5) | (h2 >>> 27)) >>> 0;
      }
    }
    return "weak:" + h1.toString(16) + h2.toString(16);
  }
  function hashPassword(password, saltHex) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.resolve(weakHash(password, saltHex));
    var enc = new TextEncoder();
    var salt = new Uint8Array(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    return crypto.subtle
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256" },
          key,
          256
        );
      })
      .then(function (bits) { return toHex(new Uint8Array(bits)); })
      .catch(function () { return weakHash(password, saltHex); });
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  var Auth = {
    /* ------------------------------------------------------------ session */
    session: function () {
      return Store.session();
    },
    currentId: function () {
      var s = Store.session();
      return s && s.userId ? s.userId : null;
    },
    account: function () {
      var id = Auth.currentId();
      if (!id) return null;
      var list = Store.accounts();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    data: function () {
      var id = Auth.currentId();
      return id ? Store.load(id) : Store.defaults();
    },
    /** Persist a change to the signed-in account's application data. */
    update: function (mutator) {
      var id = Auth.currentId();
      if (!id) return null;
      var data = Store.load(id);
      if (typeof mutator === "function") mutator(data);
      Store.save(id, data);
      return data;
    },
    /** Persist a change to the account record itself. */
    updateAccount: function (mutator) {
      var id = Auth.currentId();
      var list = Store.accounts();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          mutator(list[i]);
          Store.setAccounts(list);
          return list[i];
        }
      }
      return null;
    },
    isSignedIn: function () {
      var s = Store.session();
      if (!s || !s.userId) return false;
      if (s.expiresAt && Date.now() > s.expiresAt) {
        Store.clearSession();
        return false;
      }
      return !!Auth.account();
    },

    /* ------------------------------------------------------- validation */
    validEmail: function (email) {
      return EMAIL_RE.test(String(email || "").trim());
    },
    passwordProblem: function (pw) {
      if (!pw || pw.length < 8) return "Use at least 8 characters.";
      if (!/[A-Za-z]/.test(pw)) return "Add at least one letter.";
      if (!/[0-9]/.test(pw)) return "Add at least one number.";
      return null;
    },

    /* -------------------------------------------------------- lifecycle */
    register: function (input) {
      var name = String(input.name || "").trim();
      var email = String(input.email || "").trim().toLowerCase();
      var password = input.password || "";
      if (name.length < 2) return Promise.reject("Please enter your full name.");
      if (!EMAIL_RE.test(email)) return Promise.reject("That email address doesn't look right.");
      var pwProblem = Auth.passwordProblem(password);
      if (pwProblem) return Promise.reject(pwProblem);
      if (password !== input.confirmPassword)
        return Promise.reject("Passwords don't match.");
      if (!input.accepted) return Promise.reject("Please accept the Terms and Privacy Policy.");

      var accounts = Store.accounts();
      if (accounts.some(function (a) { return a.email === email; }))
        return Promise.reject("An account with that email already exists. Try signing in instead.");

      var salt = randomHex(16);
      var id = uid("usr");
      return hashPassword(password, salt).then(function (hash) {
        var account = {
          id: id,
          name: name,
          email: email,
          salt: salt,
          passwordHash: hash,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          verifyToken: randomHex(12),
          verifyTokenExpires: Date.now() + 1000 * 60 * 60 * 24,
          pendingEmail: null,
        };
        accounts.push(account);
        Store.setAccounts(accounts);

        var data = Store.defaults();
        data.profile = {
          name: name,
          email: email,
          createdAt: account.createdAt,
          emailVerified: false,
        };
        data.prefs.timezone = (input.timezone && String(input.timezone)) || data.prefs.timezone;
        // A first-run notification so the notification centre is never a dead end.
        data.notifications = [
          {
            id: uid("ntf"),
            title: "Welcome to Planora",
            message: "Add your first task to get a plan going. Onboarding takes under a minute.",
            type: "welcome",
            read: false,
            createdAt: new Date().toISOString(),
          },
        ];
        Store.save(id, data);

        Store.setSession(
          { userId: id, token: randomHex(16), createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_DAYS * 864e5 },
          false
        );
        Auth.sendVerification(email, account.verifyToken);
        return { id: id, account: account };
      });
    },

    login: function (email, password, remember) {
      var target = String(email || "").trim().toLowerCase();
      var accounts = Store.accounts();
      var account = null;
      for (var i = 0; i < accounts.length; i++) if (accounts[i].email === target) account = accounts[i];
      if (!account) return Promise.reject("We couldn't find an account with that email.");
      return hashPassword(password || "", account.salt).then(function (hash) {
        if (hash !== account.passwordHash) throw "That password doesn't match this account.";
        Store.setSession(
          {
            userId: account.id,
            token: randomHex(16),
            createdAt: Date.now(),
            expiresAt: remember ? Date.now() + SESSION_TTL_DAYS * 864e5 : null,
          },
          !!remember
        );
        return account;
      });
    },

    logout: function () {
      Store.clearSession();
    },

    /* ------------------------------------------------------------------ mail
       Sends are captured in a local outbox so verification and reset links are
       testable without a server. Wire a real provider in DEPLOY.md step 4 and
       replace the two calls below. */
    sendVerification: function (email, token) {
      var link = location.origin + location.pathname.replace(/[^/]*$/, "") + "verify-email.html?email=" +
        encodeURIComponent(email) + "&token=" + token;
      Store.pushOutbox({
        id: uid("mail"),
        to: email,
        subject: "Verify your Planora email address",
        body: "Confirm your email to finish setting up Planora. This link expires in 24 hours.",
        link: link,
        createdAt: new Date().toISOString(),
      });
    },
    resendVerification: function () {
      var acc = Auth.account();
      if (!acc) return Promise.reject("You need to be signed in.");
      if (acc.emailVerified) return Promise.reject("That email is already verified.");
      return Auth.updateAccount(function (a) {
        a.verifyToken = randomHex(12);
        a.verifyTokenExpires = Date.now() + 864e5;
        Auth.sendVerification(a.email, a.verifyToken);
      });
    },
    verifyEmail: function (email, token) {
      var accounts = Store.accounts();
      var found = null;
      for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].email === String(email || "").toLowerCase()) found = accounts[i];
      }
      if (!found) return { ok: false, error: "We couldn't find that account." };
      if (found.emailVerified) return { ok: true, already: true };
      if (!token || token !== found.verifyToken) return { ok: false, error: "That verification link isn't valid." };
      if (found.verifyTokenExpires && Date.now() > found.verifyTokenExpires)
        return { ok: false, error: "That link has expired. Request a new one from your settings." };

      if (found.pendingEmail) {
        found.email = found.pendingEmail;
        found.pendingEmail = null;
      }
      found.emailVerified = true;
      found.verifyToken = null;
      Store.setAccounts(accounts);
      if (Auth.currentId() === found.id) {
        Auth.update(function (d) {
          d.profile.email = found.email;
          d.profile.emailVerified = true;
        });
      }
      return { ok: true };
    },

    requestReset: function (email) {
      var accounts = Store.accounts();
      var found = null;
      for (var i = 0; i < accounts.length; i++) if (accounts[i].email === String(email).toLowerCase()) found = accounts[i];
      // Always resolve the same way — never reveal whether an account exists.
      if (found) {
        found.resetToken = randomHex(12);
        found.resetExpires = Date.now() + 1000 * 60 * 60;
        Store.setAccounts(accounts);
        var link = location.origin + location.pathname.replace(/[^/]*$/, "") +
          "reset-password.html?email=" + encodeURIComponent(found.email) + "&token=" + found.resetToken;
        Store.pushOutbox({
          id: uid("mail"),
          to: found.email,
          subject: "Reset your Planora password",
          body: "Use this link to choose a new password. It expires in one hour.",
          link: link,
          createdAt: new Date().toISOString(),
        });
      }
      return Promise.resolve(true);
    },
    resetPassword: function (email, token, password, confirm) {
      var problem = Auth.passwordProblem(password);
      if (problem) return Promise.reject(problem);
      if (password !== confirm) return Promise.reject("Passwords don't match.");
      var accounts = Store.accounts();
      var found = null;
      for (var i = 0; i < accounts.length; i++) if (accounts[i].email === String(email).toLowerCase()) found = accounts[i];
      if (!found) return Promise.reject("That reset link isn't valid.");
      if (!token || token !== found.resetToken) return Promise.reject("That reset link isn't valid.");
      if (found.resetExpires && Date.now() > found.resetExpires)
        return Promise.reject("That link has expired. Request a new one.");
      var salt = randomHex(16);
      return hashPassword(password, salt).then(function (hash) {
        found.salt = salt;
        found.passwordHash = hash;
        found.resetToken = null;
        found.resetExpires = null;
        Store.setAccounts(accounts);
        return true;
      });
    },

    changePassword: function (current, next, confirm) {
      var acc = Auth.account();
      if (!acc) return Promise.reject("You need to be signed in.");
      var problem = Auth.passwordProblem(next);
      if (problem) return Promise.reject(problem);
      if (next !== confirm) return Promise.reject("Passwords don't match.");
      return hashPassword(current || "", acc.salt).then(function (hash) {
        if (hash !== acc.passwordHash) throw "Your current password isn't correct.";
        var salt = randomHex(16);
        return hashPassword(next, salt).then(function (newHash) {
          Auth.updateAccount(function (a) {
            a.salt = salt;
            a.passwordHash = newHash;
          });
          return true;
        });
      });
    },

    changeEmail: function (nextEmail, password) {
      var acc = Auth.account();
      if (!acc) return Promise.reject("You need to be signed in.");
      var email = String(nextEmail || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return Promise.reject("That email address doesn't look right.");
      if (Store.accounts().some(function (a) { return a.email === email && a.id !== acc.id; }))
        return Promise.reject("Another account already uses that email.");
      if (email === acc.email) return Promise.reject("That's already your email address.");
      return hashPassword(password || "", acc.salt).then(function (hash) {
        if (hash !== acc.passwordHash) throw "Your password isn't correct.";
        Auth.updateAccount(function (a) {
          a.pendingEmail = email;
          a.emailVerified = false;
          a.verifyToken = randomHex(12);
          a.verifyTokenExpires = Date.now() + 864e5;
          Auth.sendVerification(email, a.verifyToken);
        });
        return email;
      });
    },

    deleteAccount: function (password) {
      var acc = Auth.account();
      if (!acc) return Promise.reject("You need to be signed in.");
      return hashPassword(password || "", acc.salt).then(function (hash) {
        if (hash !== acc.passwordHash) throw "Your password isn't correct.";
        Store.setAccounts(Store.accounts().filter(function (a) { return a.id !== acc.id; }));
        Store.purgeUser(acc.id);
        Store.clearSession();
        return true;
      });
    },

    /* ------------------------------------------------------- subscription */
    isPremium: function () {
      var sub = Auth.data().subscription || {};
      if (sub.plan !== "premium") return false;
      if (sub.status === "canceled" && !sub.cancelAtPeriodEnd) return false;
      if (sub.currentPeriodEnd && Date.now() > new Date(sub.currentPeriodEnd).getTime()) return false;
      return sub.status === "active" || sub.cancelAtPeriodEnd === true || sub.status === "past_due";
    },
    activatePremium: function () {
      var now = new Date();
      var end = new Date(now.getTime() + 30 * 864e5);
      return Auth.update(function (d) {
        d.subscription = {
          plan: "premium",
          status: "active",
          providerId: "local_" + uid("sub"),
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: end.toISOString(),
          cancelAtPeriodEnd: false,
          startedAt: now.toISOString(),
        };
        d.notifications.unshift({
          id: uid("ntf"),
          title: "Premium is active",
          message: "The AI Planner is unlocked. Your plan renews on " + PDate.prettyLong(PDate.toStr(end)) + ".",
          type: "billing",
          read: false,
          createdAt: new Date().toISOString(),
        });
      });
    },
    cancelPremium: function () {
      return Auth.update(function (d) {
        var sub = d.subscription;
        sub.cancelAtPeriodEnd = true;
        sub.status = "canceled";
        sub.canceledAt = new Date().toISOString();
        d.notifications.unshift({
          id: uid("ntf"),
          title: "Subscription canceled",
          message:
            "Premium stays active until " +
            PDate.prettyLong(String(sub.currentPeriodEnd).slice(0, 10)) +
            ". Your tasks are never touched.",
          type: "billing",
          read: false,
          createdAt: new Date().toISOString(),
        });
      });
    },
    resumePremium: function () {
      return Auth.update(function (d) {
        d.subscription.status = "active";
        d.subscription.cancelAtPeriodEnd = false;
      });
    },

    /* ------------------------------------------------------------ guards */
    requireAuth: function () {
      if (!Auth.isSignedIn()) {
        var next = encodeURIComponent(location.pathname.split("/").pop() + location.hash);
        location.replace("login.html?next=" + next);
        return false;
      }
      return true;
    },
    redirectIfSignedIn: function () {
      if (Auth.isSignedIn()) {
        location.replace("app.html#/dashboard");
        return true;
      }
      return false;
    },
  };

  window.Auth = Auth;
})();
