/*!
 * Planora — settings, billing and onboarding
 */
(function () {
  "use strict";
  var UI = window.PlanoraUI;
  var $ = UI.$, $$ = UI.$$, icon = UI.icon, esc = UI.esc, D = PDate;
  var T = window.TaskModel;

  function P() { return window.Planora; }
  function prefs() { return P().data.prefs; }
  function data() { return P().data; }
  function today() { return P().today(); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function cfg() { return window.PLANORA_CONFIG || {}; }

  var tab = "profile";
  var TABS = [
    ["profile", "Profile"],
    ["preferences", "Preferences"],
    ["notifications", "Notifications"],
    ["subscription", "Subscription"],
    ["account", "Account"],
  ];

  function timezones() {
    var list;
    try { list = Intl.supportedValuesOf("timeZone"); } catch (e) { list = null; }
    if (!list) list = ["UTC", "Europe/London", "Europe/Amsterdam", "Europe/Berlin", "Europe/Madrid",
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Kolkata",
      "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
    var cur = prefs().timezone;
    if (list.indexOf(cur) < 0) list = [cur].concat(list);
    return list;
  }

  function setPref(mutator, msg) {
    P().save(function (d) { mutator(d.prefs || (d.prefs = {}), d); });
    if (msg) UI.toast(msg, "success", 1800);
  }

  /* ------------------------------------------------------------- profile */
  function profilePanel() {
    var u = P().user || {};
    var verified = !!u.emailVerified;
    var pending = u.pendingEmail;
    return '<div class="card card-pad"><h2 class="card-title">Your profile</h2>' +
      '<p class="small muted" style="margin-top:4px">This is how Planora greets you and where account mail is sent.</p>' +
      '<div class="row gap-16" style="margin-top:18px">' +
      '<span class="avatar avatar-lg">' + esc(UI.initials(u.name)) + "</span>" +
      '<div><div class="strong">' + esc(u.name) + "</div>" +
      '<div class="small muted">' + esc(u.email) + "</div>" +
      '<div style="margin-top:6px">' + (verified
        ? '<span class="pill pill-ok pill-dot">Email verified</span>'
        : '<span class="pill pill-medium pill-dot">Not verified</span> <a class="small link" href="verify-email.html">Verify now</a>') +
      (pending && !verified ? '<span class="pill" style="margin-left:6px">Pending: ' + esc(pending) + "</span>" : "") +
      "</div></div></div>" +
      '<div class="divider" style="margin:20px 0"></div>' +
      '<form class="stack gap-14" id="profile-form">' +
      '<div class="field"><label class="label" for="pf-name">Full name</label>' +
      '<input class="input" id="pf-name" value="' + esc(u.name) + '" maxlength="80"></div>' +
      '<div class="field"><label class="label">Email address</label>' +
      '<input class="input" value="' + esc(u.email) + '" disabled></div>' +
      '<div id="profile-status" class="hide"></div>' +
      '<div><button class="btn btn-primary" type="submit">Save changes</button></div>' +
      "</form></div>" +
      '<div class="card card-pad"><h2 class="card-title">Change email address</h2>' +
      '<p class="small muted" style="margin-top:4px">We send a verification link to the new address before it becomes active.</p>' +
      '<form class="stack gap-14" id="email-form" style="margin-top:16px">' +
      '<div class="field"><label class="label" for="em-new">New email address</label>' +
      '<input class="input" id="em-new" type="email" placeholder="new@example.com"></div>' +
      '<div class="field"><label class="label" for="em-pw">Confirm with your password</label>' +
      '<input class="input" id="em-pw" type="password" autocomplete="current-password"></div>' +
      '<div id="email-status" class="hide"></div>' +
      '<div><button class="btn btn-outline" type="submit">Send verification to new address</button></div>' +
      "</form></div>" +
      '<div class="card card-pad"><h2 class="card-title">Password</h2>' +
      '<form class="stack gap-14" id="pw-form" style="margin-top:14px">' +
      '<div class="field"><label class="label" for="pw-cur">Current password</label>' +
      '<input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>' +
      '<div class="row gap-12 wrap"><div class="field grow"><label class="label" for="pw-new">New password</label>' +
      '<input class="input" id="pw-new" type="password" autocomplete="new-password"></div>' +
      '<div class="field grow"><label class="label" for="pw-cf">Confirm</label>' +
      '<input class="input" id="pw-cf" type="password" autocomplete="new-password"></div></div>' +
      '<div id="pw-status" class="hide"></div>' +
      '<div><button class="btn btn-outline" type="submit">Update password</button></div>' +
      "</form></div>";
  }

  /* --------------------------------------------------------- preferences */
  function prefPanel() {
    var p = prefs();
    var theme = p.theme || "system";
    return '<div class="card card-pad"><h2 class="card-title">Appearance</h2>' +
      '<div class="set-row"><div><div class="t">Theme</div><div class="d">System follows your device setting.</div></div>' +
      '<div class="ctl"><div class="seg">' +
      ["light", "dark", "system"].map(function (m) {
        return '<button data-theme-set="' + m + '" class="' + (theme === m ? "on" : "") + '">' + cap(m) + "</button>";
      }).join("") + "</div></div></div>" +
      '<div class="set-row"><div><div class="t">Time format</div><div class="d">Used across the planner, calendar and task lists.</div></div>' +
      '<div class="ctl"><div class="seg">' +
      [["12", "12-hour"], ["24", "24-hour"]].map(function (m) {
        return '<button data-tf="' + m[0] + '" class="' + (p.timeFormat === m[0] ? "on" : "") + '">' + m[1] + "</button>";
      }).join("") + "</div></div></div></div>" +

      '<div class="card card-pad"><h2 class="card-title">Planning</h2>' +
      '<div class="set-row"><div><div class="t">Timezone</div><div class="d">“Today”, deadlines and plans use this timezone.</div></div>' +
      '<div class="ctl"><select class="select select-sm" id="pref-tz" style="max-width:240px">' +
      timezones().map(function (z) { return '<option value="' + esc(z) + '"' + (p.timezone === z ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="set-row"><div><div class="t">Working hours</div><div class="d">The window the AI Planner is allowed to use.</div></div>' +
      '<div class="ctl row gap-8"><input class="input" id="pref-ws" type="time" style="width:118px" value="' + D.clock(p.workStart, "24") + '">' +
      '<span class="muted small">to</span><input class="input" id="pref-we" type="time" style="width:118px" value="' + D.clock(p.workEnd, "24") + '"></div></div>' +
      '<div class="set-row"><div><div class="t">Daily focus cap</div><div class="d">Maximum scheduled work per day. Protects you from heroic plans.</div></div>' +
      '<div class="ctl"><select class="select select-sm" id="pref-cap">' +
      [60, 90, 120, 180, 240, 300, 360, 420, 480].map(function (m) {
        return '<option value="' + m + '"' + (p.dailyCapacity === m ? " selected" : "") + ">" + D.duration(m) + "</option>";
      }).join("") + "</select></div></div>" +
      '<div class="set-row"><div><div class="t">Breaks</div><div class="d">Inserted automatically between focus blocks.</div></div>' +
      '<div class="ctl row gap-8"><select class="select select-sm" id="pref-be" style="width:auto">' +
      [45, 60, 75, 90, 120, 150, 180].map(function (m) {
        return '<option value="' + m + '"' + (p.breakEvery === m ? " selected" : "") + ">" + D.duration(m) + "</option>";
      }).join("") + '</select><span class="muted small">then</span><select class="select select-sm" id="pref-bm" style="width:auto">' +
      [0, 5, 10, 15, 20, 30].map(function (m) {
        return '<option value="' + m + '"' + (p.breakMinutes === m ? " selected" : "") + ">" + (m ? m + "m" : "none") + "</option>";
      }).join("") + "</select></div></div>" +
      '<div class="set-row"><div><div class="t">Working days</div><div class="d">Days the planner may use.</div></div>' +
      '<div class="ctl row gap-4 wrap">' +
      ["M", "T", "W", "T", "F", "S", "S"].map(function (d, i) {
        var wd = i === 6 ? 0 : i + 1;
        var on = (p.workdays || []).indexOf(wd) >= 0;
        return '<button class="filter-chip ' + (on ? "on" : "") + '" data-wd="' + wd + '" style="padding:0 9px;height:30px">' + d + "</button>";
      }).join("") + "</div></div>" +
      '<div class="set-row"><div><div class="t">Default priority for new tasks</div><div class="d">Applied when you add a task without choosing one.</div></div>' +
      '<div class="ctl"><select class="select select-sm" id="pref-pri">' +
      ["high", "medium", "low"].map(function (x) {
        return '<option value="' + x + '"' + (p.defaultPriority === x ? " selected" : "") + ">" + cap(x) + "</option>";
      }).join("") + "</select></div></div></div>";
  }

  /* ------------------------------------------------------- notifications */
  function notifPanel() {
    var n = prefs().notifications || {};
    function row(key, title, desc) {
      return '<div class="set-row"><div><div class="t">' + title + '</div><div class="d">' + desc + "</div></div>" +
        '<div class="ctl"><button class="switch ' + (n[key] ? "on" : "") + '" data-switch="' + key + '" role="switch" aria-checked="' + !!n[key] + '" aria-label="' + title + '"></button></div></div>';
    }
    return '<div class="card card-pad"><h2 class="card-title">In-app notifications</h2>' +
      '<p class="small muted" style="margin-top:4px">Delivered to the bell in the top bar. Nothing here is marketing.</p>' +
      '<div style="margin-top:12px">' +
      row("deadlines", "Upcoming deadlines", "A nudge the day before a task is due, and on the day.") +
      row("overdue", "Overdue tasks", "Flagged once per day while a task stays past its deadline.") +
      row("daily", "Daily reminder", "A morning summary of what is on your list.") +
      row("schedule", "Schedule changes", "When an accepted plan is regenerated or tasks move.") +
      "</div></div>" +
      '<div class="card card-pad"><h2 class="card-title">Browser notifications</h2>' +
      '<p class="small muted" style="margin-top:4px">Optional. Planora asks your browser for permission first, and you can revoke it at any time in your browser settings.</p>' +
      '<div class="set-row" style="border-bottom:0"><div><div class="t">Desktop notifications</div>' +
      '<div class="d" id="perm-state">' + (("Notification" in window) ? "Permission: " + Notification.permission : "Not supported in this browser") + "</div></div>" +
      '<div class="ctl"><button class="switch ' + (n.browser ? "on" : "") + '" data-switch-browser role="switch" aria-checked="' + !!n.browser + '"></button></div></div></div>';
  }

  /* -------------------------------------------------------- subscription */
  function subPanel() {
    var s = data().subscription || {};
    var premium = Auth.isPremium();
    var local = (cfg().billing && cfg().billing.mode) === "local";
    var next = s.currentPeriodEnd ? String(s.currentPeriodEnd).slice(0, 10) : null;

    return '<div class="card card-pad">' +
      '<div class="between wrap gap-12"><h2 class="card-title">Current subscription</h2>' +
      (local ? '<span class="pill pill-medium">Test mode</span>' : '<span class="pill pill-ok pill-dot">Live billing</span>') + "</div>" +
      '<div class="row gap-16 wrap" style="margin-top:18px">' +
      '<div style="flex:1;min-width:200px"><div class="price-name" style="color:var(--muted)">' + (premium ? "Premium" : "Free") + "</div>" +
      '<div class="price-amount" style="margin:6px 0 0"><b style="font-size:34px">$' + (premium ? cfg().pricing.premium : 0) + "</b>" +
      '<span>' + (premium ? "/month" : "forever") + "</span></div>" +
      '<div class="small muted" style="margin-top:6px">' +
      (premium
        ? (s.cancelAtPeriodEnd
            ? "Cancels on " + (next ? D.prettyLong(next) : "the end of this period") + " — access continues until then."
            : "Renews automatically" + (next ? " on " + D.prettyLong(next) : "") + ".")
        : "Manual task management, unlimited tasks, calendar and dashboard.") +
      "</div></div>" +
      '<div style="text-align:right"><div class="small muted">Status</div>' +
      '<div class="pill ' + (premium ? "pill-ok" : "") + '" style="margin-top:4px">' + esc(premium ? (s.cancelAtPeriodEnd ? "Cancels at period end" : "Active") : "Active · free") + "</div>" +
      (s.providerId ? '<div class="tiny faint" style="margin-top:8px">Ref ' + esc(s.providerId) + "</div>" : "") +
      "</div></div>" +
      (local
        ? '<div class="note-box" style="margin-top:18px"><b>Test mode.</b> Payments are simulated on this device so the whole upgrade flow can be exercised end to end. No card is charged and no real subscription is created. Connect your payment provider (see DEPLOY.md) and set <span class="kbd">billing.mode</span> to <span class="kbd">stripe</span> to take real payments.</div>'
        : "") +
      '<div class="row gap-10 wrap" style="margin-top:18px">' +
      (premium
        ? (s.cancelAtPeriodEnd
            ? '<button class="btn btn-primary" id="resume-btn">Resume subscription</button>'
            : '<button class="btn btn-outline" id="cancel-btn">Cancel subscription</button>')
        : '<button class="btn btn-primary" id="upgrade-btn">' + icon("spark") + " Upgrade to Premium</button>") +
      '<a class="btn btn-ghost" href="pricing.html" target="_blank" rel="noopener">Compare plans</a>' +
      "</div></div>" +
      '<div class="card card-pad"><h2 class="card-title">Billing details</h2>' +
      '<table class="data-table" style="margin-top:10px"><tbody>' +
      '<tr><td class="muted">Plan</td><td>' + (premium ? "Premium" : "Free") + "</td></tr>" +
      '<tr><td class="muted">Price</td><td>$' + (premium ? cfg().pricing.premium : 0) + " USD / month</td></tr>" +
      '<tr><td class="muted">Billing interval</td><td>Monthly, billed in advance</td></tr>' +
      '<tr><td class="muted">Current period</td><td>' +
      (s.currentPeriodStart ? D.pretty(String(s.currentPeriodStart).slice(0, 10)) + " – " + D.pretty(next) : "—") + "</td></tr>" +
      '<tr><td class="muted">Next payment</td><td>' + (premium ? (s.cancelAtPeriodEnd ? "None — cancelled" : (next ? D.prettyLong(next) : "—")) : "None") + "</td></tr>" +
      '<tr><td class="muted">Payment method</td><td>' + (local ? "Simulated (test mode)" : "Managed by payment provider") + "</td></tr>" +
      "</tbody></table>" +
      '<p class="small faint" style="margin-top:12px">Cancelling never deletes tasks, notes or saved plans. They all stay on the Free plan.</p></div>';
  }

  /* -------------------------------------------------------------- account */
  function accountPanel() {
    return '<div class="card card-pad"><h2 class="card-title">Your data</h2>' +
      '<p class="small muted" style="margin-top:4px">Everything in your workspace, in one JSON file. Export before deleting your account.</p>' +
      '<div class="row gap-10 wrap" style="margin-top:14px">' +
      '<button class="btn btn-outline" id="export-btn">' + icon("download") + " Export my data</button>" +
      '<button class="btn btn-outline" id="signout-btn">' + icon("logout") + " Sign out</button></div>" +
      '<div class="small muted" style="margin-top:14px">' + data().tasks.length + " tasks · " + (data().plans || []).length +
      " saved plans · " + (data().notifications || []).length + " notifications</div></div>" +

      '<div class="card card-pad"><h2 class="card-title">Onboarding</h2>' +
      '<div class="set-row"><div><div class="t">Replay the guided setup</div>' +
      '<div class="d">Walk through welcome, preferences, first task and dashboard tips again.</div></div>' +
      '<div class="ctl"><a class="btn btn-sm btn-outline" href="#/onboarding">Restart</a></div></div>' +
      '<div class="set-row" style="border-bottom:0"><div><div class="t">Delete sample data</div>' +
      '<div class="d">Remove the demo tasks added by “Load sample data”.</div></div>' +
      '<div class="ctl"><button class="btn btn-sm btn-ghost" id="clear-sample">Remove</button></div></div></div>' +

      '<div class="card card-pad" style="border-color:color-mix(in srgb,var(--danger) 32%, transparent)">' +
      '<h2 class="card-title" style="color:var(--danger)">Delete account</h2>' +
      '<p class="small muted" style="margin-top:4px">Permanently removes your account, tasks, plans and notifications. This cannot be undone.</p>' +
      '<button class="btn btn-danger" id="delete-btn" style="margin-top:14px">Delete my account</button></div>';
  }

  /* ---------------------------------------------------------------- view */
  P().views.settings = {
    title: "Settings",
    sub: function () { return "Profile, preferences, billing and account"; },
    render: function () {
      var panel = tab === "preferences" ? prefPanel()
        : tab === "notifications" ? notifPanel()
        : tab === "subscription" ? subPanel()
        : tab === "account" ? accountPanel()
        : profilePanel();
      return '<div class="settings-grid"><nav class="settings-nav" aria-label="Settings sections">' +
        TABS.map(function (t) {
          return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + t[1] + "</button>";
        }).join("") + "</nav>" +
        '<div class="settings-panel">' + panel + "</div></div>";
    },
    mount: function (root) {
      $$("[data-tab]", root).forEach(function (b) {
        b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); window.renderView(); });
      });

      /* profile */
      var pf = $("#profile-form", root);
      if (pf) pf.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = $("#pf-name").value.trim();
        var box = $("#profile-status");
        if (name.length < 2) { box.className = "form-error"; box.textContent = "Please enter your name."; return; }
        Auth.updateAccount(function (a) { a.name = name; });
        P().save(function (d) { d.profile.name = name; }, { silent: true });
        P().user = Auth.account();
        box.className = "form-ok";
        box.textContent = "Saved.";
        UI.toast("Profile updated", "success");
        window.renderView();
      });

      var emf = $("#email-form", root);
      if (emf) emf.addEventListener("submit", function (e) {
        e.preventDefault();
        var box = $("#email-status");
        var next = $("#em-new").value.trim();
        var pw = $("#em-pw").value;
        Auth.changeEmail(next, pw).then(function (addr) {
          box.className = "form-ok";
          box.textContent = "Verification sent to " + addr + ". Open the link to make it your address. Until then, " + (P().user.email) + " stays active.";
          UI.toast("Verification email sent", "success");
          window.renderView();
          setTimeout(function () { location.href = "verify-email.html"; }, 1400);
        }).catch(function (err) {
          box.className = "form-error";
          box.textContent = typeof err === "string" ? err : "Could not change the email.";
        });
      });

      var pwf = $("#pw-form", root);
      if (pwf) pwf.addEventListener("submit", function (e) {
        e.preventDefault();
        var box = $("#pw-status");
        Auth.changePassword($("#pw-cur").value, $("#pw-new").value, $("#pw-cf").value)
          .then(function () {
            box.className = "form-ok";
            box.textContent = "Password updated.";
            pwf.reset();
            UI.toast("Password updated", "success");
          })
          .catch(function (err) {
            box.className = "form-error";
            box.textContent = typeof err === "string" ? err : "Could not update the password.";
          });
      });

      /* preferences */
      $$("[data-theme-set]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var m = b.getAttribute("data-theme-set");
          UI.Theme.apply(m);
          setPref(function (p) { p.theme = m; });
          window.renderView();
        });
      });
      $$("[data-tf]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          setPref(function (p) { p.timeFormat = b.getAttribute("data-tf"); });
          window.renderView();
        });
      });
      var tzSel = $("#pref-tz", root);
      if (tzSel) tzSel.addEventListener("change", function () {
        setPref(function (p) { p.timezone = tzSel.value; }, "Timezone updated");
        window.renderView();
      });
      [["#pref-cap", "dailyCapacity", true], ["#pref-be", "breakEvery", true], ["#pref-bm", "breakMinutes", true], ["#pref-pri", "defaultPriority"]].forEach(function (x) {
        var el = $(x[0], root);
        if (!el) return;
        el.addEventListener("change", function () {
          var v = x[2] ? parseInt(el.value, 10) : el.value;
          setPref(function (p) { p[x[1]] = v; });
        });
      });
      var ws = $("#pref-ws", root), we = $("#pref-we", root);
      function saveHours() {
        var a = D.parseClock(ws.value), b = D.parseClock(we.value);
        if (a == null || b == null || b <= a) { UI.toast("End time must be after start time", "error"); return; }
        setPref(function (p) { p.workStart = a; p.workEnd = b; }, "Working hours updated");
      }
      if (ws) ws.addEventListener("change", saveHours);
      if (we) we.addEventListener("change", saveHours);
      $$("[data-wd]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var wd = parseInt(b.getAttribute("data-wd"), 10);
          setPref(function (p) {
            var i = (p.workdays || []).indexOf(wd);
            if (i >= 0) p.workdays.splice(i, 1);
            else p.workdays.push(wd);
            p.workdays.sort();
          });
          window.renderView();
        });
      });

      /* notifications */
      $$("[data-switch]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var key = b.getAttribute("data-switch");
          setPref(function (p) { p.notifications[key] = !p.notifications[key]; });
          window.renderView();
        });
      });
      var bs = $("[data-switch-browser]", root);
      if (bs) bs.addEventListener("click", function () {
        if (!("Notification" in window)) { UI.toast("This browser does not support notifications", "error"); return; }
        if (Notification.permission === "granted") {
          setPref(function (p) { p.notifications.browser = !p.notifications.browser; });
          window.renderView();
          return;
        }
        Notification.requestPermission().then(function (perm) {
          if (perm === "granted") {
            setPref(function (p) { p.notifications.browser = true; }, "Browser notifications enabled");
          } else {
            UI.toast("Permission was not granted — in-app notifications still work", "error");
          }
          window.renderView();
        });
      });

      /* subscription */
      var up = $("#upgrade-btn", root);
      if (up) up.addEventListener("click", function () { upgradeFlow(); });
      var cn = $("#cancel-btn", root);
      if (cn) cn.addEventListener("click", function () {
        var next = data().subscription.currentPeriodEnd;
        UI.confirm({
          title: "Cancel Premium?",
          message: "Your next payment stops immediately. Premium stays active until " +
            (next ? D.prettyLong(String(next).slice(0, 10)) : "the end of this period") +
            ", then your account returns to the Free plan. Your tasks are never touched.",
          confirmText: "Cancel subscription",
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          Auth.cancelPremium();
          P().data = Auth.data();
          UI.toast("Subscription cancelled — access continues until period end", "success", 4500);
          window.renderView();
        });
      });
      var rs = $("#resume-btn", root);
      if (rs) rs.addEventListener("click", function () {
        Auth.resumePremium();
        P().data = Auth.data();
        UI.toast("Subscription resumed", "success");
        window.renderView();
      });

      /* account */
      var ex = $("#export-btn", root);
      if (ex) ex.addEventListener("click", function () {
        var payload = {
          exportedAt: new Date().toISOString(),
          account: { name: P().user.name, email: P().user.email, createdAt: P().user.createdAt },
          data: data(),
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "planora-export-" + today() + ".json";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        UI.toast("Export downloaded", "success");
      });
      var so = $("#signout-btn", root);
      if (so) so.addEventListener("click", function () {
        UI.confirm({ title: "Sign out?", message: "You can sign back in at any time. Your tasks stay saved.", confirmText: "Sign out" })
          .then(function (ok) {
            if (!ok) return;
            Auth.logout();
            location.href = "index.html";
          });
      });
      var cs = $("#clear-sample", root);
      if (cs) cs.addEventListener("click", function () {
        UI.confirm({
          title: "Remove sample tasks?",
          message: "Deletes the demo tasks created by “Load sample data”. Anything you added yourself is untouched.",
          confirmText: "Remove sample tasks", danger: true,
        }).then(function (ok) {
          if (!ok) return;
          var sampleTitles = ["Finish the mathematics assignment", "Study Java — chapter 4", "Prepare the client presentation",
            "Clean the room", "Revise for the science test", "Reply to Sam about the group project", "30 minutes of exercise"];
          P().save(function (d) {
            d.tasks = d.tasks.filter(function (t) { return sampleTitles.indexOf(t.title) < 0; });
          });
          UI.toast("Sample tasks removed", "success");
        });
      });
      var del = $("#delete-btn", root);
      if (del) del.addEventListener("click", function () {
        UI.dialog({
          title: "Delete your account",
          body: '<div class="stack gap-14"><p class="small muted">This permanently removes your account, ' +
            data().tasks.length + " tasks, " + (data().plans || []).length + ' saved plans and all notifications. There is no undo.</p>' +
            '<div class="field"><label class="label" for="del-pw">Confirm with your password</label>' +
            '<input class="input" id="del-pw" type="password" autocomplete="current-password"></div>' +
            '<div id="del-status" class="hide"></div></div>',
          footer: '<button class="btn btn-outline" data-close>Keep my account</button>' +
            '<button class="btn btn-primary" id="del-confirm" style="--btn-bg:var(--danger);--btn-fg:#fff">Delete permanently</button>',
          onMount: function (root2, close) {
            $("#del-confirm", root2).addEventListener("click", function () {
              var box = $("#del-status", root2);
              Auth.deleteAccount($("#del-pw", root2).value)
                .then(function () {
                  close();
                  UI.toast("Account deleted", "success");
                  location.href = "index.html";
                })
                .catch(function (err) {
                  box.className = "form-error";
                  box.textContent = typeof err === "string" ? err : "Could not delete the account.";
                });
            });
          },
        });
      });
    },
  };

  /* ------------------------------------------------------------- upgrade */
  function upgradeFlow() {
    var price = cfg().pricing.premium;
    var local = (cfg().billing && cfg().billing.mode) === "local";
    UI.dialog({
      title: "Upgrade to Planora Premium",
      body: '<div class="stack gap-14">' +
        '<div class="between"><div><div class="price-name" style="color:var(--muted)">Premium</div>' +
        '<div class="price-amount" style="margin:4px 0 0"><b style="font-size:34px">$' + price + "</b><span>/month</span></div></div>" +
        '<span class="pill pill-primary">AI Planner</span></div>' +
        '<ul class="price-list">' + window.PLANORA_PREMIUM_FEATURES.map(function (f) {
          return "<li>" + icon("check") + "<span>" + esc(f) + "</span></li>";
        }).join("") + "</ul>" +
        '<div class="note-box">' + (local
          ? "<b>Test mode.</b> This build simulates the payment so the flow is complete end to end. No card is requested and nothing is charged. Real payments require the provider wiring described in DEPLOY.md."
          : "<b>Billing.</b> You will be redirected to our payment provider. Premium activates after the payment is confirmed on the server — never before.") + "</div>" +
        '<p class="hint">Billed monthly, cancel any time in Settings → Subscription. Your tasks stay on your account whatever happens.</p></div>',
      footer: '<button class="btn btn-outline" data-close>Not now</button>' +
        '<button class="btn btn-primary" id="do-upgrade">' + (local ? "Activate Premium (test)" : "Continue to checkout") + "</button>",
      onMount: function (root, close) {
        $("#do-upgrade", root).addEventListener("click", function () {
          var btn = $("#do-upgrade", root);
          btn.disabled = true;
          btn.textContent = "Processing…";
          if (!local && cfg().billing.checkoutEndpoint) {
            // Real provider: the endpoint returns a Checkout URL. Premium is granted
            // by the webhook, never by this redirect.
            fetch(cfg().billing.checkoutEndpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ plan: "premium" }),
            })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (j && j.url) location.href = j.url;
                else throw new Error("Checkout is not configured yet.");
              })
              .catch(function () {
                btn.disabled = false;
                btn.textContent = "Continue to checkout";
                UI.toast("Checkout is not configured — see DEPLOY.md", "error", 5000);
              });
            return;
          }
          setTimeout(function () {
            Auth.activatePremium();
            P().data = Auth.data();
            close();
            UI.toast("Premium activated — the AI Planner is unlocked", "success", 4000);
            location.hash = "#/planner";
            window.renderView();
          }, 900);
        });
      },
    });
  }

  /* -------------------------------------------------------------- billing */
  P().views.billing = {
    title: "Billing",
    sub: function () { return Auth.isPremium() ? "Premium subscription" : "Free plan"; },
    render: function () {
      return '<div style="max-width:720px;display:grid;gap:16px">' + subPanel() +
        '<p class="small faint">Questions about a charge? Use the <a class="link" href="contact.html">contact form</a> and include the reference shown above.</p></div>';
    },
    mount: function (root) {
      var up = $("#upgrade-btn", root);
      if (up) up.addEventListener("click", function () { upgradeFlow(); });
      var cn = $("#cancel-btn", root);
      if (cn) cn.addEventListener("click", function () {
        UI.confirm({
          title: "Cancel Premium?",
          message: "Your next payment stops immediately. Premium stays active until the end of the current period. Tasks and plans are untouched.",
          confirmText: "Cancel subscription", danger: true,
        }).then(function (ok) {
          if (!ok) return;
          Auth.cancelPremium();
          P().data = Auth.data();
          window.renderView();
          UI.toast("Cancelled — access continues until period end", "success", 4500);
        });
      });
      var rs = $("#resume-btn", root);
      if (rs) rs.addEventListener("click", function () {
        Auth.resumePremium();
        P().data = Auth.data();
        window.renderView();
        UI.toast("Subscription resumed", "success");
      });
      if (UI.qs("upgrade") === "1" && !Auth.isPremium()) setTimeout(upgradeFlow, 300);
    },
  };

  /* ----------------------------------------------------------- onboarding */
  var ob = { step: 0, name: "", task: { title: "", dueDate: null, priority: "medium" } };

  P().views.onboarding = {
    title: "Welcome",
    sub: function () { return "Step " + (ob.step + 1) + " of 4"; },
    render: function () {
      var p = prefs();
      var t = today();
      var body = "";
      if (ob.step === 0) {
        body = '<div class="ob-body"><span class="icon-box" style="margin:0 auto;width:48px;height:48px">' + icon("logo" in UI ? "logo" : "spark") + "</span>" +
          "<h2>Welcome to Planora</h2>" +
          "<p>Let's organise your day. Four short steps — under a minute — then everything is yours.</p>" +
          '<div class="ob-tip">' + icon("info") + "<span>You can skip any step and come back to it from Settings → Account.</span></div></div>";
      } else if (ob.step === 1) {
        body = '<div class="ob-body" style="text-align:left"><h2 style="text-align:center">How do you work?</h2>' +
          '<p style="text-align:center">These become the defaults for the AI Planner. You can change them any time.</p>' +
          '<div class="field" style="margin-top:8px"><label class="label" for="ob-tz">Timezone</label>' +
          '<select class="select" id="ob-tz">' + timezones().map(function (z) {
            return '<option value="' + esc(z) + '"' + (p.timezone === z ? " selected" : "") + ">" + esc(z) + "</option>";
          }).join("") + "</select></div>" +
          '<div class="row gap-12"><div class="field grow"><label class="label" for="ob-ws">Day starts</label>' +
          '<input class="input" id="ob-ws" type="time" value="' + D.clock(p.workStart, "24") + '"></div>' +
          '<div class="field grow"><label class="label" for="ob-we">Day ends</label>' +
          '<input class="input" id="ob-we" type="time" value="' + D.clock(p.workEnd, "24") + '"></div></div>' +
          '<div class="row gap-12"><div class="field grow"><label class="label" for="ob-tf">Time format</label>' +
          '<select class="select" id="ob-tf"><option value="12"' + (p.timeFormat === "12" ? " selected" : "") + ">12-hour (9:30 AM)</option>" +
          '<option value="24"' + (p.timeFormat === "24" ? " selected" : "") + ">24-hour (09:30)</option></select></div>" +
          '<div class="field grow"><label class="label" for="ob-be">Break every</label>' +
          '<select class="select" id="ob-be">' + [60, 75, 90, 120, 150, 180].map(function (m) {
            return '<option value="' + m + '"' + (p.breakEvery === m ? " selected" : "") + ">" + D.duration(m) + "</option>";
          }).join("") + "</select></div></div></div>";
      } else if (ob.step === 2) {
        body = '<div class="ob-body" style="text-align:left"><h2 style="text-align:center">Add your first task</h2>' +
          '<p style="text-align:center">Something real you have to do this week.</p>' +
          '<div class="field" style="margin-top:8px"><label class="label" for="ob-title">Task</label>' +
          '<input class="input" id="ob-title" placeholder="Finish the project draft" value="' + esc(ob.task.title) + '"></div>' +
          '<div class="row gap-12"><div class="field grow"><label class="label" for="ob-due">Due date</label>' +
          '<input class="input" id="ob-due" type="date" value="' + (ob.task.dueDate || D.addDays(t, 2)) + '"></div>' +
          '<div class="field grow"><label class="label" for="ob-pri">Priority</label>' +
          '<select class="select" id="ob-pri">' + ["high", "medium", "low"].map(function (x) {
            return '<option value="' + x + '"' + (ob.task.priority === x ? " selected" : "") + ">" + cap(x) + "</option>";
          }).join("") + "</select></div></div>" +
          '<div class="ob-tip">' + icon("info") + "<span>Adding an estimate is optional — the planner uses it to time-box the work.</span></div></div>";
      } else {
        var open = P().openTasks().length;
        body = '<div class="ob-body" style="text-align:left"><h2 style="text-align:center">You are set up</h2>' +
          '<p style="text-align:center">Here is where everything lives.</p>' +
          '<div class="stack gap-10">' +
          [["dashboard", "Dashboard", "Totals, today's progress and upcoming deadlines."],
           ["today", "Today", "Only what is due or scheduled today — nothing else."],
           ["calendar", "Calendar", "Day, week and month. Click a date to add a task."],
           ["planner", "AI Planner", "Describe a workload, get a schedule. Premium."]]
            .map(function (x) {
              return '<div class="ob-tip">' + icon(x[0]) + "<span><b>" + x[1] + "</b><br>" + x[2] + "</span></div>";
            }).join("") + "</div>" +
          (open ? '<p class="small muted center" style="margin-top:6px">' + open + " task" + (open === 1 ? "" : "s") + " waiting on your dashboard.</p>" : "") +
          "</div>";
      }

      return '<div class="ob-shell" style="margin:0 auto;max-width:600px">' +
        '<div class="ob-dots">' + [0, 1, 2, 3].map(function (i) {
          return '<i class="' + (ob.step >= i ? "on" : "") + '"></i>';
        }).join("") + "</div>" +
        '<div class="card" style="overflow:hidden">' + body + "</div>" +
        '<div class="ob-actions" style="padding:18px 0 0;display:flex;justify-content:space-between">' +
        '<button class="btn btn-ghost" id="ob-skip" type="button">' + (ob.step === 0 ? "Skip setup" : "Skip step") + "</button>" +
        '<div class="row gap-10">' +
        (ob.step > 0 ? '<button class="btn btn-outline" id="ob-back" type="button">Back</button>' : "") +
        '<button class="btn btn-primary" id="ob-next" type="button">' +
        (ob.step === 3 ? "Go to dashboard" : ob.step === 2 ? "Add task and continue" : "Continue") + "</button></div></div></div>";
    },
    mount: function (root) {
      function readStep() {
        if (ob.step === 1) {
          var v = function (sel, fallback) { var el = $(sel, root); return el ? el.value : fallback; };
          P().save(function (d) {
            d.prefs.timezone = v("#ob-tz", d.prefs.timezone);
            d.prefs.timeFormat = v("#ob-tf", d.prefs.timeFormat);
            d.prefs.breakEvery = parseInt(v("#ob-be", d.prefs.breakEvery), 10) || d.prefs.breakEvery;
            var a = D.parseClock(v("#ob-ws", "")); var b = D.parseClock(v("#ob-we", ""));
            if (a != null) d.prefs.workStart = a;
            if (b != null && b > a) d.prefs.workEnd = b;
          }, { silent: true });
        }
        if (ob.step === 2) {
          ob.task.title = $("#ob-title", root).value.trim();
          ob.task.dueDate = $("#ob-due", root).value || null;
          ob.task.priority = $("#ob-pri", root).value;
          if (ob.task.title) {
            var now = new Date().toISOString();
            P().save(function (d) {
              d.tasks.unshift({
                id: uid("tsk"), title: ob.task.title, description: "", dueDate: ob.task.dueDate,
                priority: ob.task.priority, status: "pending", estimatedMinutes: 60,
                category: "", notes: "", createdAt: now, updatedAt: now, completedAt: null,
              });
            }, { silent: true });
            UI.toast("First task added", "success");
            ob.task = { title: "", dueDate: null, priority: "medium" };
          }
        }
      }

      var next = $("#ob-next", root);
      if (next) next.addEventListener("click", function () {
        readStep();
        if (ob.step >= 3) { finish(); return; }
        ob.step++;
        window.renderView();
      });
      var back = $("#ob-back", root);
      if (back) back.addEventListener("click", function () {
        if (ob.step === 1) {
          var v = function (sel, fallback) { var el = $(sel, root); return el ? el.value : fallback; };
          P().save(function (d) { d.prefs.timezone = v("#ob-tz", d.prefs.timezone); }, { silent: true });
        }
        ob.step = Math.max(0, ob.step - 1);
        window.renderView();
      });
      var skip = $("#ob-skip", root);
      if (skip) skip.addEventListener("click", function () { finish(); });

      function finish() {
        P().save(function (d) {
          d.onboarding.completed = true;
          d.onboarding.completedAt = new Date().toISOString();
        }, { silent: true });
        UI.toast("Setup complete — welcome to Planora", "success");
        location.hash = "#/dashboard";
        window.renderView();
      }
    },
  };

  window.PLANORA_PREMIUM_FEATURES = [
    "AI task optimisation from plain language",
    "Automatic task breakdown and time-boxing",
    "AI-generated daily schedules",
    "Workload balancing across days",
    "Smart rescheduling by instruction",
    "Deadline conflict detection",
    "Personalised planning recommendations",
  ];
})();
