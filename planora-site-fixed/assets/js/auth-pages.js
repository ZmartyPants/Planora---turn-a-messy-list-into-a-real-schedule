/*!
 * Planora — auth screen behaviour
 */
(function () {
  "use strict";
  var UI = window.PlanoraUI;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;

  /* ------------------------------------------------------- small helpers */
  function status(msg, kind) {
    var el = $("#form-status");
    if (!el) return;
    el.className = kind === "ok" ? "form-ok" : "form-error";
    el.textContent = msg;
    el.classList.remove("hide");
  }
  function clearStatus() {
    var el = $("#form-status");
    if (el) { el.className = "hide"; el.textContent = ""; }
  }
  function busy(btn, on, label) {
    if (!btn) return;
    btn.disabled = !!on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label || "Working…";
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }
  function scorePassword(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(3, Math.max(pw.length ? 1 : 0, s - 1));
  }
  function paintMeter(pw) {
    var m = $("#pw-meter");
    if (!m) return;
    var n = scorePassword(pw);
    $$("i", m).forEach(function (b, i) {
      b.className = i < n ? "on" + n : "";
    });
  }

  /* ------------------------------------------------------------- toggles */
  $$("[data-pw-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-pw-toggle"));
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.innerHTML = UI.icon(show ? "eyeOff" : "eye");
    });
  });
  var pwInput = $("#password");
  if (pwInput && $("#pw-meter")) {
    pwInput.addEventListener("input", function () { paintMeter(pwInput.value); });
  }

  /* --------------------------------------------------------------- outbox */
  function renderOutbox(slot, filterTo) {
    if (!slot) return;
    var mails = Store.outbox().filter(function (m) { return !filterTo || m.to === filterTo; }).slice(0, 3);
    if (!mails.length) return;
    var rows = mails.map(function (m) {
      return (
        '<div style="padding:10px 12px;border-bottom:1px solid var(--border)">' +
        '<div class="tiny" style="color:var(--faint)">To: ' + esc(m.to) + "</div>" +
        '<div class="small strong" style="margin:2px 0 4px">' + esc(m.subject) + "</div>" +
        '<div class="tiny muted" style="margin-bottom:8px">' + esc(m.body) + "</div>" +
        '<a class="btn btn-sm btn-outline" href="' + esc(m.link) + '">Open the link in this message</a>' +
        "</div>"
      );
    }).join("");
    slot.innerHTML =
      '<div class="card" style="margin-top:16px;overflow:hidden">' +
      '<div style="padding:11px 13px;background:var(--warn-soft);border-bottom:1px solid var(--border)">' +
      '<div class="small strong" style="color:var(--warn)">Local mailbox — development mode</div>' +
      '<p class="tiny" style="color:var(--warn);opacity:.9;margin-top:2px;line-height:1.5">' +
      "This deployment has no mail server configured, so the message was captured here instead of being sent. " +
      "Connect an email provider (see DEPLOY.md) and these links will arrive in your inbox.</p></div>" +
      rows + "</div>";
  }

  /* --------------------------------------------------------------- signup */
  var signupForm = $("#signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();
      var btn = $("#submit-btn");
      var name = $("#name").value.trim();
      var email = $("#email").value.trim();
      var password = $("#password").value;
      var confirm = $("#confirm").value;
      var accepted = $("#accepted").checked;

      if (!name) return status("Please enter your full name.");
      if (!Auth.validEmail(email)) return status("Please enter a valid email address.");
      var prob = Auth.passwordProblem(password);
      if (prob) return status(prob);
      if (password !== confirm) return status("Those passwords don't match.");
      if (!accepted) return status("Please accept the Terms of Service and Privacy Policy to continue.");

      busy(btn, true, "Creating account…");
      Auth.register({
        name: name, email: email, password: password,
        confirmPassword: confirm, accepted: accepted,
        timezone: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (err) { return null; } })(),
      })
        .then(function () {
          UI.toast("Account created — let's get you set up", "success");
          var plan = UI.qs("plan");
          location.href = "app.html#/onboarding" + (plan === "premium" ? "?plan=premium" : "");
        })
        .catch(function (err) {
          busy(btn, false);
          status(typeof err === "string" ? err : (err && err.message) || "Something went wrong. Please try again.");
        });
    });
  }

  /* ---------------------------------------------------------------- login */
  var loginForm = $("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();
      var btn = $("#submit-btn");
      var email = $("#email").value.trim();
      var password = $("#password").value;
      var remember = $("#remember").checked;
      if (!Auth.validEmail(email)) return status("Please enter a valid email address.");
      if (!password) return status("Please enter your password.");

      busy(btn, true, "Signing in…");
      Auth.login(email, password, remember)
        .then(function () {
          var next = UI.qs("next");
          location.href = next && next.indexOf("app.html") === 0 ? next : "app.html#/dashboard";
        })
        .catch(function (err) {
          busy(btn, false);
          status(typeof err === "string" ? err : "Something went wrong. Please try again.");
        });
    });
  }

  /* --------------------------------------------------------------- forgot */
  var forgotForm = $("#forgot-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();
      var btn = $("#submit-btn");
      var email = $("#email").value.trim();
      if (!Auth.validEmail(email)) return status("Please enter a valid email address.");
      busy(btn, true, "Sending…");
      Auth.requestReset(email).then(function () {
        busy(btn, false);
        status(
          "If an account exists for " + email + ", a reset link is on its way. It expires in one hour.",
          "ok"
        );
        renderOutbox($("#outbox-slot"), email);
        forgotForm.reset();
      });
    });
  }

  /* ---------------------------------------------------------------- reset */
  var resetForm = $("#reset-form");
  if (resetForm) {
    var email = UI.qs("email") || "";
    var token = UI.qs("token") || "";
    var intro = $("#reset-intro");
    if (intro) {
      intro.textContent = email
        ? "Choose a new password for " + email + "."
        : "This link is missing its account details. Request a new reset email below.";
    }
    if (!email || !token) {
      resetForm.querySelectorAll("input, button").forEach(function (el) { el.disabled = true; });
      status("This reset link is incomplete. Request a new one from the login page.");
    }
    resetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearStatus();
      var btn = $("#submit-btn");
      var pw = $("#password").value, cf = $("#confirm").value;
      var prob = Auth.passwordProblem(pw);
      if (prob) return status(prob);
      if (pw !== cf) return status("Those passwords don't match.");
      busy(btn, true, "Updating…");
      Auth.resetPassword(email, token, pw, cf)
        .then(function () {
          status("Password updated. Taking you to the login page…", "ok");
          setTimeout(function () { location.href = "login.html"; }, 1200);
        })
        .catch(function (err) {
          busy(btn, false);
          status(typeof err === "string" ? err : "That reset link is not valid any more.");
        });
    });
  }

  /* --------------------------------------------------------------- verify */
  if (document.getElementById("verify-title")) {
    var vEmail = UI.qs("email") || "";
    var vToken = UI.qs("token") || "";
    var note = $("#verify-note");
    var title = $("#verify-title");
    var text = $("#verify-text");

    function showResult(mark, head, body) {
      if (note) {
        note.className = mark === "ok" ? "form-ok" : "form-error";
        note.style.background = "";
        note.textContent = body;
      }
      if (head && title) title.textContent = head;
    }

    if (vEmail && vToken) {
      var res = Auth.verifyEmail(vEmail, vToken);
      if (res.ok) {
        showResult("ok", "Email verified", "Thanks — " + vEmail + " is confirmed. Your account is fully active.");
        UI.toast("Email verified", "success");
        setTimeout(function () {
          location.href = Auth.isSignedIn() ? "app.html#/dashboard" : "login.html";
        }, 1800);
      } else {
        showResult("err", "Link not valid", res.error);
      }
    } else {
      var acc = Auth.account();
      if (!acc) {
        showResult("err", "Verify your email",
          "Open the verification link from your inbox, or log in and resend it from Settings.");
      } else if (acc.emailVerified) {
        showResult("ok", "Email verified", acc.email + " is already confirmed. Nothing else to do.");
      } else {
        if (text) text.textContent = "We sent a verification link to " + (acc.pendingEmail || acc.email) + ". Confirm it to finish setting up your account.";
        showResult("err", "Awaiting confirmation",
          "Your email is not verified yet. Click the link in the message, or resend it below.");
        renderOutbox($("#outbox-slot"), acc.pendingEmail || acc.email);
      }
    }

    var resend = $("#resend-btn");
    if (resend) {
      resend.addEventListener("click", function () {
        clearStatus();
        if (!Auth.isSignedIn()) {
          status("Log in first, then resend the verification email from here or from Settings.");
          return;
        }
        busy(resend, true, "Sending…");
        Auth.resendVerification()
          .then(function () {
            busy(resend, false, "Resend verification email");
            status("Verification email resent. Check your inbox for a new link.", "ok");
            var acc2 = Auth.account();
            renderOutbox($("#outbox-slot"), acc2 ? acc2.pendingEmail || acc2.email : "");
          })
          .catch(function (err) {
            busy(resend, false, "Resend verification email");
            status(typeof err === "string" ? err : "Could not resend right now.");
          });
      });
    }
  }
})();
