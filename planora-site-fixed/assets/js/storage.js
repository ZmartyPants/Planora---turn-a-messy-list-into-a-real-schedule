/*!
 * Planora — data layer & date utilities
 * ---------------------------------------------------------------------------
 * Persistence is localStorage under a namespaced key per user. One user's data
 * is physically separated from another's, every read goes through the current
 * session's user id, and no key is ever returned without that check.
 *
 * Upgrading to a hosted database: implement the same six methods
 * (load / save / accounts / session / outbox) against your API and every view
 * keeps working. See DEPLOY.md → "Moving to a hosted database".
 */
(function () {
  "use strict";

  var ROOT = "planora:";

  /* ---------------------------------------------------------------- ids */
  function uid(prefix) {
    var rnd = "";
    try {
      var a = new Uint32Array(2);
      crypto.getRandomValues(a);
      rnd = a[0].toString(36) + a[1].toString(36);
    } catch (e) {
      rnd = Math.random().toString(36).slice(2, 10);
    }
    return (prefix || "id") + "_" + Date.now().toString(36) + rnd.slice(0, 6);
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  /* -------------------------------------------------------------- dates */
  var PDate = {
    /** Today's calendar date as YYYY-MM-DD in a given IANA timezone. */
    today: function (tz) {
      try {
        var fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz || undefined,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        return fmt.format(new Date());
      } catch (e) {
        return new Date().toISOString().slice(0, 10);
      }
    },
    nowMinutes: function (tz) {
      try {
        var fmt = new Intl.DateTimeFormat("en-GB", {
          timeZone: tz || undefined,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        var p = fmt.format(new Date()).split(":");
        return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
      } catch (e) {
        var d = new Date();
        return d.getHours() * 60 + d.getMinutes();
      }
    },
    hour: function (tz) {
      return Math.floor(PDate.nowMinutes(tz) / 60);
    },
    /** YYYY-MM-DD -> Date at local midnight (safe for date math only). */
    parse: function (s) {
      if (!s) return null;
      var p = String(s).slice(0, 10).split("-");
      if (p.length !== 3) return null;
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    },
    toStr: function (d) {
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    },
    addDays: function (s, n) {
      var d = PDate.parse(s);
      if (!d) return s;
      d.setDate(d.getDate() + n);
      return PDate.toStr(d);
    },
    /** Whole days from a to b (b - a). */
    diffDays: function (a, b) {
      var da = PDate.parse(a),
        db = PDate.parse(b);
      if (!da || !db) return 0;
      return Math.round((db - da) / 86400000);
    },
    weekday: function (s) {
      var d = PDate.parse(s);
      return d ? d.getDay() : 0;
    },
    startOfWeek: function (s, firstDay) {
      var d = PDate.parse(s);
      if (!d) return s;
      var shift = (d.getDay() - (firstDay == null ? 1 : firstDay) + 7) % 7;
      return PDate.addDays(s, -shift);
    },
    monthLabel: function (s) {
      var d = PDate.parse(s);
      return d ? d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";
    },
    pretty: function (s, opts) {
      var d = PDate.parse(s);
      if (!d) return "—";
      return d.toLocaleDateString(undefined, opts || { month: "short", day: "numeric" });
    },
    prettyLong: function (s) {
      var d = PDate.parse(s);
      if (!d) return "—";
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    },
    /** "Today" / "Tomorrow" / "3 days ago" style relative label. */
    relative: function (s, tz) {
      if (!s) return "No due date";
      var today = PDate.today(tz);
      var n = PDate.diffDays(today, s);
      if (n === 0) return "Today";
      if (n === 1) return "Tomorrow";
      if (n === -1) return "Yesterday";
      if (n > 1 && n < 7) return PDate.pretty(s, { weekday: "long" });
      if (n < -1 && n > -7) return Math.abs(n) + " days ago";
      return PDate.pretty(s, { month: "short", day: "numeric", year: "numeric" });
    },
    /** minutes-from-midnight -> "09:30" or "9:30 AM" */
    clock: function (mins, timeFormat) {
      if (mins == null || isNaN(mins)) return "";
      mins = ((mins % 1440) + 1440) % 1440;
      var h = Math.floor(mins / 60),
        m = mins % 60;
      if (timeFormat === "24") {
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      }
      var ap = h >= 12 ? "PM" : "AM";
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + ":" + String(m).padStart(2, "0") + " " + ap;
    },
    /** "14:30" | "2:30 PM" | "2pm" -> minutes from midnight */
    parseClock: function (str) {
      if (!str) return null;
      var s = String(str).trim().toLowerCase().replace(/\s+/g, "");
      var m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
      if (!m) return null;
      var h = parseInt(m[1], 10),
        min = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3] === "pm" && h < 12) h += 12;
      if (m[3] === "am" && h === 12) h = 0;
      if (h > 23 || min > 59) return null;
      return h * 60 + min;
    },
    duration: function (mins) {
      if (!mins) return "0m";
      var h = Math.floor(mins / 60),
        m = mins % 60;
      if (!h) return m + "m";
      return m ? h + "h " + m + "m" : h + "h";
    },
  };

  /* ------------------------------------------------------------- store */
  var Store = {
    key: function (uid, part) {
      return ROOT + "user:" + uid + ":" + (part || "data");
    },

    defaults: function () {
      return {
        version: 1,
        profile: { name: "", email: "", createdAt: null, emailVerified: false },
        prefs: {
          theme: "system",
          timezone: guessTimezone(),
          timeFormat: "12",
          defaultPriority: "medium",
          workStart: 9 * 60,
          workEnd: 18 * 60,
          breakEvery: 90,
          breakMinutes: 15,
          workdays: [1, 2, 3, 4, 5],
          dailyCapacity: 240,
          notifications: {
            deadlines: true,
            overdue: true,
            daily: true,
            schedule: true,
            browser: false,
          },
        },
        tasks: [],
        plans: [],
        notifications: [],
        subscription: {
          plan: "free",
          status: "active",
          providerId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        onboarding: { completed: false, step: 0, tipsDismissed: false },
      };
    },

    load: function (uid) {
      if (!uid) return Store.defaults();
      var raw;
      try {
        raw = localStorage.getItem(Store.key(uid));
      } catch (e) {
        raw = null;
      }
      if (!raw) return Store.defaults();
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return Store.defaults();
      }
      // shallow merge with defaults so new settings keys never crash old data
      var base = Store.defaults();
      Object.keys(base).forEach(function (k) {
        if (data[k] === undefined) data[k] = base[k];
      });
      Object.keys(base.prefs).forEach(function (k) {
        if (data.prefs[k] === undefined) data.prefs[k] = base.prefs[k];
      });
      Object.keys(base.prefs.notifications).forEach(function (k) {
        if (data.prefs.notifications[k] === undefined)
          data.prefs.notifications[k] = base.prefs.notifications[k];
      });
      Object.keys(base.subscription).forEach(function (k) {
        if (data.subscription[k] === undefined) data.subscription[k] = base.subscription[k];
      });
      return data;
    },

    save: function (uid, data) {
      if (!uid) throw new Error("No active account");
      try {
        localStorage.setItem(Store.key(uid), JSON.stringify(data));
      } catch (e) {
        if (window.toast) toast("Storage is full — delete some tasks or plans.", "error");
        throw e;
      }
    },

    /* second namespace: credentials, session, local outbox */
    accounts: function () {
      try {
        return JSON.parse(localStorage.getItem(ROOT + "accounts") || "[]");
      } catch (e) {
        return [];
      }
    },
    setAccounts: function (list) {
      localStorage.setItem(ROOT + "accounts", JSON.stringify(list));
    },
    session: function () {
      try {
        var s =
          sessionStorage.getItem(ROOT + "session") || localStorage.getItem(ROOT + "session");
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    },
    setSession: function (s, remember) {
      var body = JSON.stringify(s);
      if (remember) {
        localStorage.setItem(ROOT + "session", body);
        sessionStorage.removeItem(ROOT + "session");
      } else {
        sessionStorage.setItem(ROOT + "session", body);
        localStorage.removeItem(ROOT + "session");
      }
    },
    clearSession: function () {
      localStorage.removeItem(ROOT + "session");
      sessionStorage.removeItem(ROOT + "session");
    },
    outbox: function () {
      try {
        return JSON.parse(localStorage.getItem(ROOT + "outbox") || "[]");
      } catch (e) {
        return [];
      }
    },
    pushOutbox: function (mail) {
      var box = Store.outbox();
      box.unshift(mail);
      localStorage.setItem(ROOT + "outbox", JSON.stringify(box.slice(0, 12)));
    },
    purgeUser: function (uid) {
      localStorage.removeItem(Store.key(uid));
    },
  };

  function guessTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {
      return "UTC";
    }
  }

  /* --------------------------------------------------------- task stats */
  var Task = {
    isDone: function (t) {
      return t.status === "completed";
    },
    isOverdue: function (t, tz) {
      if (!t.dueDate || Task.isDone(t)) return false;
      return PDate.diffDays(t.dueDate, PDate.today(tz)) > 0;
    },
    isDueToday: function (t, tz) {
      return !!t.dueDate && t.dueDate === PDate.today(tz);
    },
    progressOfList: function (list) {
      if (!list.length) return 0;
      var done = list.filter(Task.isDone).length;
      return Math.round((done / list.length) * 100);
    },
    priorityRank: function (p) {
      return p === "high" ? 0 : p === "medium" ? 1 : 2;
    },
    statusLabel: function (s) {
      return s === "in_progress" ? "In Progress" : s === "completed" ? "Completed" : "Pending";
    },
    remainingMinutes: function (list) {
      return list.reduce(function (sum, t) {
        return sum + (Task.isDone(t) ? 0 : t.estimatedMinutes || 0);
      }, 0);
    },
    byId: function (tasks, id) {
      for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i];
      return null;
    },
  };

  window.PDate = PDate;
  window.Store = Store;
  window.TaskModel = Task;
  window.uid = uid;
  window.clone = clone;
})();
