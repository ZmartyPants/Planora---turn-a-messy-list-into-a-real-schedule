/*!
 * Planora — application shell, router and core views
 */
(function () {
  "use strict";

  var UI = window.PlanoraUI;
  var $ = UI.$, $$ = UI.$$, icon = UI.icon, esc = UI.esc, D = PDate, T = TaskModel;

  var P = (window.Planora = {
    data: null,
    user: null,
    views: {},
    cfg: window.PLANORA_CONFIG || {},
  });
  P.go = function (hash) {
    if (location.hash === hash) renderView();
    else location.hash = hash;
  };
  P.save = function (mutator, opts) {
    opts = opts || {};
    Auth.update(function (d) { if (mutator) mutator(d); });
    P.data = Auth.data();
    if (!opts.silent) renderView();
  };
  P.plan = function () {
    var plans = (P.data.plans || []).slice().sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    return plans[0] || null;
  };

  /* ------------------------------------------------------------- helpers */
  function prefs() { return P.data.prefs; }
  function tz() { return prefs().timezone || "UTC"; }
  function today() { return D.today(tz()); }
  function clock(m) { return D.clock(m, prefs().timeFormat); }
  function tasks() { return P.data.tasks || []; }
  function openTasks() { return tasks().filter(function (t) { return t.status !== "completed"; }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmtDate(iso) { return iso ? D.pretty(iso, { month: "short", day: "numeric" }) : "No date"; }

  function greeting() {
    var h = D.hour(tz());
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  function priorityPill(p) {
    return '<span class="pill pill-' + p + '">' + cap(p) + "</span>";
  }

  function dueLabel(task) {
    if (!task.dueDate) return '<span class="faint">No due date</span>';
    var overdue = T.isOverdue(task, tz());
    return '<span style="color:' + (overdue ? "var(--danger)" : "inherit") + '">' +
      esc(D.relative(task.dueDate, tz())) + "</span>";
  }

  function scheduledFor(taskId, date) {
    var plan = P.plan();
    if (!plan) return null;
    for (var i = 0; i < plan.days.length; i++) {
      if (plan.days[i].date !== date) continue;
      var slots = plan.days[i].slots;
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].kind === "task" && slots[j].taskId === taskId) return slots[j];
      }
    }
    return null;
  }

  function scheduledDatesFor(taskId) {
    var plan = P.plan();
    if (!plan) return [];
    var out = [];
    plan.days.forEach(function (d) {
      d.slots.forEach(function (s) {
        if (s.kind === "task" && s.taskId === taskId) out.push(s);
      });
    });
    return out;
  }

  function taskRow(t, opts) {
    opts = opts || {};
    var done = t.status === "completed";
    var overdue = T.isOverdue(t, tz());
    var slot = opts.date ? scheduledFor(t.id, opts.date) : null;
    var timeLabel = slot ? clock(slot.start) + "–" + clock(slot.end) : "";
    return (
      '<div class="task-row ' + (done ? "done " : "") + (overdue ? "overdue" : "") + '" data-id="' + t.id + '">' +
      '<button class="check ' + (done ? "on" : "") + '" data-act="toggle" data-id="' + t.id + '" ' +
      'role="checkbox" aria-checked="' + done + '" aria-label="' + (done ? "Reopen " : "Complete ") + esc(t.title) + '">' +
      icon("check") + "</button>" +
      '<div class="task-main">' +
      '<div class="task-title">' + esc(t.title) + "</div>" +
      '<div class="task-meta">' +
      (timeLabel ? "<span>" + timeLabel + "</span><span class=\"dot\"></span>" : "") +
      priorityPill(t.priority) +
      dueLabel(t) +
      (t.estimatedMinutes ? '<span class="dot"></span><span>' + D.duration(t.estimatedMinutes) + "</span>" : "") +
      (t.category ? '<span class="dot"></span><span>' + esc(t.category) + "</span>" : "") +
      "</div></div>" +
      '<div class="task-actions">' +
      '<button class="btn btn-icon btn-sm btn-ghost" data-act="edit" data-id="' + t.id + '" aria-label="Edit task">' + icon("edit") + "</button>" +
      '<button class="btn btn-icon btn-sm btn-ghost" data-act="remove" data-id="' + t.id + '" aria-label="Delete task">' + icon("trash") + "</button>" +
      "</div></div>"
    );
  }

  function emptyState(iconName, title, text, action) {
    return (
      '<div class="empty"><span class="icon-box">' + icon(iconName) + "</span>" +
      "<h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>" +
      (action || "") + "</div>"
    );
  }

  function statCard(k, v, d, cls) {
    return (
      '<div class="stat ' + (cls || "") + '"><span class="k">' + k + "</span>" +
      '<span class="v mono">' + v + "</span>" +
      (d ? '<span class="d">' + d + "</span>" : "") + "</div>"
    );
  }

  /* ------------------------------------------------------------- sidebar */
  var ROUTES = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "tasks", label: "My Tasks", icon: "tasks", count: function () { return openTasks().length; } },
    { id: "today", label: "Today", icon: "today", count: function () { return todaysTasks().filter(function (t) { return t.status !== "completed"; }).length; } },
    { id: "upcoming", label: "Upcoming", icon: "upcoming" },
    { id: "calendar", label: "Calendar", icon: "calendar" },
    { id: "planner", label: "AI Planner", icon: "planner", premium: true },
    { id: "completed", label: "Completed", icon: "completed" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  function routeId() {
    var h = location.hash.replace(/^#\/?/, "");
    return (h.split("?")[0] || "dashboard").toLowerCase();
  }

  function renderSidebar() {
    var active = routeId();
    var premium = Auth.isPremium();
    var html = '<div class="side-label">Workspace</div>';
    ROUTES.forEach(function (r) {
      var count = r.count ? r.count() : 0;
      var locked = r.premium && !premium;
      html +=
        '<a class="side-link ' + (active === r.id ? "active" : "") + '" href="#/' + r.id + '">' +
        icon(r.icon) + "<span>" + r.label + "</span>" +
        (locked
          ? '<span class="lock">' + icon("lock") + "</span>"
          : count
          ? '<span class="count">' + count + "</span>"
          : "") +
        "</a>";
    });
    $("#side-nav").innerHTML = html;

    var p = P.data.subscription || {};
    var planCard = premium
      ? '<div class="plan-card"><div class="row gap-8"><span class="pill pill-primary pill-dot">Premium</span></div>' +
        '<p>AI Planner unlocked. ' +
        (p.currentPeriodEnd ? "Renews " + D.pretty(String(p.currentPeriodEnd).slice(0, 10)) : "") +
        "</p><a class=\"btn btn-sm btn-outline\" href=\"#/billing\">Manage plan</a></div>"
      : '<div class="plan-card"><div class="row gap-8"><span class="pill">Free plan</span></div>' +
        "<p>Manual planning is yours forever. Add the AI Planner for $4/month.</p>" +
        '<a class="btn btn-sm btn-primary" href="#/billing?upgrade=1">Upgrade</a></div>';

    var u = P.user || {};
    $("#side-foot").innerHTML =
      planCard +
      '<button class="user-chip" id="user-chip">' +
      '<span class="avatar">' + esc(UI.initials(u.name)) + "</span>" +
      '<span style="min-width:0;flex:1"><span class="nm truncate" style="display:block">' + esc(u.name || "Your account") + "</span>" +
      '<span class="em truncate" style="display:block">' + esc(u.email || "") + "</span></span>" +
      icon("chevronRight") +
      "</button>";
    var chip = $("#user-chip");
    if (chip) chip.addEventListener("click", function () { P.go("#/settings"); });
  }

  function renderBottomNav() {
    var active = routeId();
    var items = [
      { id: "dashboard", label: "Home", icon: "dashboard" },
      { id: "today", label: "Today", icon: "today" },
      { id: "tasks", label: "Tasks", icon: "tasks" },
      { id: "calendar", label: "Calendar", icon: "calendar" },
      { id: "planner", label: "Planner", icon: "planner" },
    ];
    $("#bottom-nav").innerHTML = items
      .map(function (i) {
        return '<a href="#/' + i.id + '" class="' + (active === i.id ? "active" : "") + '">' +
          icon(i.icon) + "<span>" + i.label + "</span></a>";
      })
      .join("");
  }

  function updateVerifyChip() {
    var el = $("#verify-chip");
    if (!el) return;
    if (P.user && !P.user.emailVerified) {
      el.innerHTML = '<a class="pill pill-medium" href="verify-email.html" title="Your email is not verified yet">Verify email</a>';
    } else {
      el.innerHTML = "";
    }
  }

  /* --------------------------------------------------------- notifications */
  function badgeCount() {
    return (P.data.notifications || []).filter(function (n) { return !n.read; }).length;
  }
  function updateNotifBadge() {
    var n = badgeCount();
    var btn = $("#notif-btn");
    if (!btn) return;
    btn.innerHTML = icon("bell") + (n ? '<span class="badge">' + (n > 9 ? "9+" : n) + "</span>" : "");
  }

  function renderNotifPanel() {
    var list = (P.data.notifications || []).slice(0, 20);
    var body = list.length
      ? list.map(function (n) {
          return '<div class="notif-item ' + (n.read ? "" : "unread") + '">' +
            '<span class="icon-box" style="width:26px;height:26px;border-radius:7px">' + icon(n.type === "billing" ? "card" : n.type === "overdue" ? "alert" : n.type === "plan" ? "spark" : "bell") + "</span>" +
            '<div style="min-width:0"><b>' + esc(n.title) + "</b><p>" + esc(n.message) + "</p>" +
            "<time>" + esc(D.relative(String(n.createdAt).slice(0, 10), tz())) + "</time></div></div>";
        }).join("")
      : '<div class="empty" style="padding:28px"><p class="small muted">Nothing to report. Deadlines and schedule changes will appear here.</p></div>';

    $("#notif-slot").innerHTML =
      '<div class="notif-panel" id="notif-panel">' +
      '<div class="notif-head"><b style="font-size:13px">Notifications</b>' +
      '<div class="row gap-8"><button class="btn btn-sm btn-ghost" id="mark-read">Mark all read</button>' +
      '<button class="btn btn-icon btn-sm btn-ghost" id="notif-close" aria-label="Close">' + icon("x") + "</button></div></div>" +
      '<div class="notif-list">' + body + "</div></div>";

    $("#notif-close").addEventListener("click", closeNotifs);
    var mr = $("#mark-read");
    if (mr) mr.addEventListener("click", function () {
      P.save(function (d) { d.notifications.forEach(function (n) { n.read = true; }); }, { silent: true });
      renderNotifPanel();
      updateNotifBadge();
    });
  }
  function closeNotifs() {
    $("#notif-slot").innerHTML = "";
    var b = $("#notif-btn");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  function scanNotifications() {
    if (!P.data) return;
    var changed = false;
    var t = today();
    var n = prefs().notifications || {};
    function push(key, title, message, type) {
      if (P.data.notifications.some(function (x) { return x.key === key; })) return;
      P.data.notifications.unshift({
        id: uid("ntf"), key: key, title: title, message: message, type: type || "info",
        read: false, createdAt: new Date().toISOString(),
      });
      changed = true;
    }
    tasks().forEach(function (task) {
      if (task.status === "completed" || !task.dueDate) return;
      var delta = D.diffDays(task.dueDate, t); // positive = past
      if (delta > 0 && n.overdue) {
        push("overdue:" + task.id + ":" + t, "Overdue: " + task.title,
          "This was due " + esc(D.relative(task.dueDate, tz())) + ". Reschedule it or complete it to clear the flag.", "overdue");
      } else if (delta === 0 && n.deadlines) {
        push("due:" + task.id + ":" + t, "Due today: " + task.title,
          "It is on today's list" + (task.estimatedMinutes ? " — about " + D.duration(task.estimatedMinutes) + " of work." : "."), "deadline");
      } else if (delta === -1 && n.deadlines) {
        push("due1:" + task.id + ":" + t, "Due tomorrow: " + task.title,
          "Plan a slot for it today if tomorrow is already busy.", "deadline");
      }
    });
    var todays = todaysTasks().filter(function (x) { return x.status !== "completed"; });
    if (n.daily && todays.length) {
      push("daily:" + t, "Today's plan", todays.length + " task" + (todays.length > 1 ? "s" : "") +
        " on the list, about " + D.duration(T.remainingMinutes(todays)) + " of work.", "daily");
    }
    if (changed) {
      P.data.notifications = P.data.notifications.slice(0, 60);
      Auth.update(function (d) { d.notifications = P.data.notifications; });
      updateNotifBadge();
      if (n.browser && "Notification" in window && Notification.permission === "granted") {
        var latest = P.data.notifications[0];
        try { new Notification(latest.title, { body: latest.message, icon: "assets/img/favicon.svg" }); } catch (e) {}
      }
    }
  }

  /* ------------------------------------------------------------- task CRUD */
  function newTask(partial) {
    var now = new Date().toISOString();
    return Object.assign({
      id: uid("tsk"), title: "", description: "", dueDate: null, priority: "medium",
      status: "pending", estimatedMinutes: 30, category: "", notes: "",
      createdAt: now, updatedAt: now, completedAt: null,
    }, partial || {});
  }

  function saveTask(task, isNew) {
    P.save(function (d) {
      if (isNew) d.tasks.unshift(task);
      else {
        for (var i = 0; i < d.tasks.length; i++) {
          if (d.tasks[i].id === task.id) d.tasks[i] = task;
        }
      }
    });
    UI.toast(isNew ? "Task added" : "Task updated", "success");
    scanNotifications();
  }

  function confirmDelete(task) {
    UI.confirm({
      title: "Delete this task?",
      message: '“' + task.title + '” will be removed permanently, along with its scheduled blocks. This cannot be undone.',
      confirmText: "Delete task",
      danger: true,
    }).then(function (ok) {
      if (!ok) return;
      P.save(function (d) {
        d.tasks = d.tasks.filter(function (t) { return t.id !== task.id; });
        d.plans.forEach(function (p) {
          p.days.forEach(function (day) {
            day.slots = day.slots.filter(function (s) { return s.taskId !== task.id; });
          });
          p.unscheduled = (p.unscheduled || []).filter(function (u) { return u.taskId !== task.id; });
        });
      });
      UI.toast("Task deleted", "success");
    });
  }

  P.openTask = function (existing, defaults) {
    var isNew = !existing;
    var t = existing ? JSON.parse(JSON.stringify(existing)) : newTask(defaults);
    var cats = Array.from(new Set(tasks().map(function (x) { return x.category; }).filter(Boolean)));
    var catList = cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
    var d = UI.dialog({
      title: isNew ? "New task" : "Edit task",
      wide: false,
      body:
        '<form id="task-form" class="stack gap-14" novalidate>' +
        '<div class="field"><label class="label" for="f-title">Title</label>' +
        '<input class="input" id="f-title" value="' + esc(t.title) + '" placeholder="What needs doing?" required maxlength="160"></div>' +
        '<div class="field"><label class="label" for="f-desc">Description</label>' +
        '<textarea class="textarea" id="f-desc" rows="2" placeholder="Optional detail, links, context…">' + esc(t.description) + "</textarea></div>" +
        '<div class="row gap-12 wrap" style="align-items:flex-start">' +
        '<div class="field grow" style="min-width:140px"><label class="label" for="f-due">Due date</label>' +
        '<input class="input" id="f-due" type="date" value="' + (t.dueDate || "") + '"></div>' +
        '<div class="field grow" style="min-width:120px"><label class="label" for="f-pri">Priority</label>' +
        '<select class="select" id="f-pri">' +
        ['high', 'medium', 'low'].map(function (p) {
          return '<option value="' + p + '"' + (t.priority === p ? " selected" : "") + ">" + cap(p) + "</option>";
        }).join("") + "</select></div>" +
        '<div class="field grow" style="min-width:120px"><label class="label" for="f-status">Status</label>' +
        '<select class="select" id="f-status">' +
        [["pending", "Pending"], ["in_progress", "In Progress"], ["completed", "Completed"]].map(function (s) {
          return '<option value="' + s[0] + '"' + (t.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>";
        }).join("") + "</select></div></div>" +
        '<div class="row gap-12 wrap" style="align-items:flex-start">' +
        '<div class="field grow" style="min-width:140px"><label class="label" for="f-est">Estimate (minutes)</label>' +
        '<input class="input" id="f-est" type="number" min="0" max="720" step="15" value="' + (t.estimatedMinutes || 0) + '">' +
        '<span class="hint">Used by the AI Planner to time-box the work.</span></div>' +
        '<div class="field grow" style="min-width:140px"><label class="label" for="f-cat">Category</label>' +
        '<input class="input" id="f-cat" list="cat-list" value="' + esc(t.category) + '" placeholder="Study, Work, Home…">' +
        '<datalist id="cat-list">' + catList + "</datalist></div></div>" +
        '<div class="field"><label class="label" for="f-notes">Notes</label>' +
        '<textarea class="textarea" id="f-notes" rows="2" placeholder="Anything else you want to remember">' + esc(t.notes) + "</textarea></div>" +
        '<div id="task-error" class="form-error hide"></div>' +
        "</form>",
      footer:
        (isNew ? "" : '<button class="btn btn-danger" id="task-delete" type="button">Delete</button>') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-outline" data-close type="button">Cancel</button>' +
        '<button class="btn btn-primary" id="task-save" type="button">' + (isNew ? "Add task" : "Save changes") + "</button>",
      onMount: function (root, close) {
        var form = $("#task-form", root);
        form.addEventListener("submit", function (e) { e.preventDefault(); save(); });
        $("#task-save", root).addEventListener("click", save);
        var del = $("#task-delete", root);
        if (del) del.addEventListener("click", function () { close(); confirmDelete(existing); });

        function save() {
          var title = $("#f-title", root).value.trim();
          var err = $("#task-error", root);
          if (!title) {
            err.className = "form-error";
            err.textContent = "A task needs a title.";
            return;
          }
          var est = parseInt($("#f-est", root).value, 10);
          var updated = Object.assign({}, t, {
            title: title,
            description: $("#f-desc", root).value.trim(),
            dueDate: $("#f-due", root).value || null,
            priority: $("#f-pri", root).value,
            status: $("#f-status", root).value,
            estimatedMinutes: isNaN(est) ? 0 : Math.max(0, Math.min(720, est)),
            category: $("#f-cat", root).value.trim(),
            notes: $("#f-notes", root).value.trim(),
            updatedAt: new Date().toISOString(),
          });
          if (updated.status === "completed" && !updated.completedAt) updated.completedAt = new Date().toISOString();
          if (updated.status !== "completed") updated.completedAt = null;
          close();
          saveTask(updated, isNew);
        }
      },
    });
    void d;
    setTimeout(function () {
      var f = $("#f-title");
      if (f) { f.focus(); f.select(); }
    }, 60);
  };

  /* --------------------------------------------------------- delegation */
  function bindView(root) {
    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-act]");
      if (!el) return;
      var id = el.getAttribute("data-id");
      var act = el.getAttribute("data-act");
      var task = T.byId(tasks(), id);
      if (!task) return;
      if (act === "toggle") { e.preventDefault(); toggleTask(task); }
      else if (act === "edit") { e.preventDefault(); P.openTask(task); }
      else if (act === "remove") { e.preventDefault(); confirmDelete(task); }
    });
  }

  function toggleTask(task) {
    var done = task.status === "completed";
    P.save(function (d) {
      for (var i = 0; i < d.tasks.length; i++) {
        if (d.tasks[i].id === task.id) {
          d.tasks[i].status = done ? "pending" : "completed";
          d.tasks[i].completedAt = done ? null : new Date().toISOString();
          d.tasks[i].updatedAt = new Date().toISOString();
        }
      }
    });
    UI.toast(done ? "Task reopened" : "Nice — task completed", "success", 2000);
  }

  /* ------------------------------------------------------------- today set */
  function todaysTasks() {
    var t = today();
    var plan = P.plan();
    var scheduledIds = {};
    if (plan) {
      plan.days.forEach(function (d) {
        if (d.date !== t) return;
        d.slots.forEach(function (s) { if (s.kind === "task" && s.taskId) scheduledIds[s.taskId] = true; });
      });
    }
    return tasks().filter(function (task) {
      return task.dueDate === t || scheduledIds[task.id];
    });
  }

  /* =============================================================== VIEWS */
  P.views.dashboard = {
    title: "Dashboard",
    sub: function () { return D.prettyLong(today()); },
    render: function () {
      var all = tasks();
      var pending = all.filter(function (t) { return t.status !== "completed"; });
      var completed = all.filter(function (t) { return t.status === "completed"; });
      var overdue = all.filter(function (t) { return T.isOverdue(t, tz()); });
      var todays = todaysTasks();
      var doneToday = todays.filter(function (t) { return t.status === "completed"; }).length;
      var pct = todays.length ? Math.round((doneToday / todays.length) * 100) : 0;
      var upcoming = pending.filter(function (t) { return t.dueDate && D.diffDays(today(), t.dueDate) >= 0; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).slice(0, 5);
      var name = (P.user && P.user.name ? P.user.name.split(" ")[0] : "there");
      var premium = Auth.isPremium();

      var html =
        '<div class="greet"><h2>' + greeting() + ", " + esc(name) + "</h2>" +
        "<p>" + (pending.length
          ? pending.length + " task" + (pending.length > 1 ? "s" : "") + " open · about " +
            D.duration(T.remainingMinutes(pending)) + " of work left"
          : "Everything is clear. Enjoy it.") + "</p></div>";

      html += '<div class="stat-grid" style="margin-bottom:16px">' +
        statCard("Total tasks", all.length, "all time") +
        statCard("Pending", pending.length, "still open") +
        statCard("Completed", completed.length, "ticked off", "good") +
        statCard("Overdue", overdue.length, overdue.length ? "needs attention" : "nothing late", overdue.length ? "warn" : "") +
        "</div>";

      html += '<div class="dash-grid">';

      /* left column */
      html += '<div class="stack gap-16">';

      html += '<section class="card"><div class="card-head"><span class="card-title">Today\'s progress</span>' +
        '<span class="small muted mono">' + doneToday + " of " + todays.length + " · " + pct + "%</span></div>" +
        '<div class="card-body" style="display:grid;gap:14px">' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="row gap-8 wrap">' +
        '<a class="btn btn-sm btn-outline" href="#/today">Open Today</a>' +
        '<a class="btn btn-sm btn-ghost" href="' + (premium ? "#/planner" : "#/billing?upgrade=1") + '">' +
        icon("spark") + (premium ? " Re-plan my day" : " Unlock AI Planner") + "</a>" +
        "</div></div></section>";

      html += '<section class="card"><div class="card-head"><span class="card-title">Today\'s tasks</span>' +
        '<a class="small link" href="#/today">View all</a></div>';
      if (!todays.length) {
        html += emptyState("sun", "Nothing scheduled for today",
          "Add a task with today's date, or accept an AI plan and it will appear here.",
          '<button class="btn btn-primary btn-sm" data-quick="new">Add a task</button>');
      } else {
        html += '<div class="task-list">' + todays.slice(0, 6).map(function (t) { return taskRow(t, { date: today() }); }).join("") + "</div>";
      }
      html += "</section>";

      /* quick actions */
      html += '<section class="card card-pad"><h3 class="card-title" style="margin-bottom:12px">Quick actions</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">' +
        '<button class="btn btn-outline" data-quick="new">' + icon("plus") + " Add task</button>" +
        '<a class="btn btn-outline" href="#/tasks">' + icon("list") + " All tasks</a>" +
        '<a class="btn btn-outline" href="' + (premium ? "#/planner" : "#/billing?upgrade=1") + '">' + icon("spark") + " AI Planner</a>" +
        '<a class="btn btn-outline" href="#/calendar">' + icon("calendar") + " Calendar</a>" +
        "</div></section>";

      html += "</div>";

      /* right column */
      html += '<div class="stack gap-16">';

      html += '<section class="card"><div class="card-head"><span class="card-title">Upcoming deadlines</span>' +
        '<a class="small link" href="#/upcoming">All</a></div>' +
        (upcoming.length
          ? '<div class="task-list">' + upcoming.map(function (t) { return taskRow(t); }).join("") + "</div>"
          : '<div class="empty" style="padding:28px"><p class="small muted">No dated tasks ahead. Add a due date to see deadlines here.</p></div>') +
        "</section>";

      if (!premium) {
        html += '<section class="card card-pad" style="background:radial-gradient(520px 160px at 100% 0%, color-mix(in srgb,var(--primary) 12%, transparent), transparent 70%), var(--surface)">' +
          '<div class="row gap-10" style="margin-bottom:8px"><span class="icon-box">' + icon("spark") + "</span>" +
          '<span class="pill pill-primary">Premium</span></div>' +
          '<h3 class="card-title" style="font-size:15px">Let Planora schedule the week</h3>' +
          '<p class="small muted" style="margin-top:6px;line-height:1.6">Describe everything on your plate in one paragraph. Get a time-boxed schedule that respects your deadlines, working hours and breaks.</p>' +
          '<a class="btn btn-primary btn-block" style="margin-top:14px" href="#/billing?upgrade=1">Upgrade for $4/month</a></section>';
      } else {
        var plan = P.plan();
        html += '<section class="card"><div class="card-head"><span class="card-title">Active plan</span>' +
          (plan ? '<a class="small link" href="#/planner">Open</a>' : "") + "</div>" +
          (plan
            ? '<div class="card-body"><div class="small strong">' + esc(plan.name) + "</div>" +
              '<div class="small muted" style="margin-top:2px">' + D.pretty(plan.startDate) + " – composer " + D.pretty(plan.endDate) + "</div>" +
              '<div class="summary-grid" style="margin-top:12px">' +
              '<div class="sum-item"><b>' + (plan.stats ? plan.stats.scheduledTasks : 0) + "</b><span>Scheduled</span></div>" +
              '<div class="sum-item"><b>' + D.duration(plan.stats ? plan.stats.totalMinutes : 0) + "</b><span>Focus time</span></div>" +
              "</div></div>"
            : '<div class="empty" style="padding:26px"><p class="small muted">No active plan yet.</p><a class="btn btn-sm btn-primary" href="#/planner">Generate one</a></div>') +
          "</section>";
      }

      html += "</div></div>";
      return html;
    },
    mount: function (root) {
      $$("[data-quick=new]", root).forEach(function (b) {
        b.addEventListener("click", function () { P.openTask(null, { dueDate: today() }); });
      });
    },
  };

  /* --------------------------------------------------------------- tasks */
  var filterState = { q: "", priority: "", status: "", category: "", sort: "due", view: "all" };

  P.views.tasks = {
    title: "My tasks",
    sub: function () { return openTasks().length + " open · " + tasks().length + " total"; },
    render: function () {
      var all = tasks();
      var cats = Array.from(new Set(all.map(function (t) { return t.category; }).filter(Boolean))).sort();
      var q = filterState.q.toLowerCase();
      var list = all.filter(function (t) {
        if (q && (t.title + " " + (t.description || "") + " " + (t.notes || "")).toLowerCase().indexOf(q) < 0) return false;
        if (filterState.priority && t.priority !== filterState.priority) return false;
        if (filterState.status && t.status !== filterState.status) return false;
        if (filterState.category && t.category !== filterState.category) return false;
        return true;
      });
      var sort = filterState.sort;
      list.sort(function (a, b) {
        if (sort === "due") {
          if (!a.dueDate && !b.dueDate) return (b.createdAt || "").localeCompare(a.createdAt || "");
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
        }
        if (sort === "priority") return T.priorityRank(a.priority) - T.priorityRank(b.priority);
        if (sort === "created") return (b.createdAt || "").localeCompare(a.createdAt || "");
        if (sort === "alpha") return a.title.localeCompare(b.title);
        return 0;
      });

      var html =
        '<div class="toolbar">' +
        '<div class="search-box">' + icon("search") +
        '<input class="input" id="task-search" placeholder="Search tasks, notes, descriptions…" value="' + esc(filterState.q) + '" aria-label="Search tasks"></div>' +
        '<select class="select select-sm" id="f-status-sel" aria-label="Filter by status" style="width:auto">' +
        [["", "All statuses"], ["pending", "Pending"], ["in_progress", "In progress"], ["completed", "Completed"]]
          .map(function (o) { return '<option value="' + o[0] + '"' + (filterState.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        "</select>" +
        '<select class="select select-sm" id="f-pri-sel" aria-label="Filter by priority" style="width:auto">' +
        [["", "All priorities"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]
          .map(function (o) { return '<option value="' + o[0] + '"' + (filterState.priority === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        "</select>" +
        '<select class="select select-sm" id="f-cat-sel" aria-label="Filter by category" style="width:auto">' +
        '<option value="">All categories</option>' +
        cats.map(function (c) { return '<option value="' + esc(c) + '"' + (filterState.category === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") +
        "</select>" +
        '<select class="select select-sm" id="f-sort-sel" aria-label="Sort tasks" style="width:auto;margin-left:auto">' +
        [["due", "Due date"], ["priority", "Priority"], ["created", "Recently created"], ["alpha", "Alphabetical"]]
          .map(function (o) { return '<option value="' + o[0] + '"' + (filterState.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        "</select>" +
        '<button class="btn btn-primary btn-sm" data-quick="new">' + icon("plus") + " New task</button>" +
        "</div>";

      if (!all.length) {
        return html + '<div class="card">' + emptyState("tasks", "No tasks yet",
          "Everything starts with one task. Add it, or load a small sample set to see how the app behaves.",
          '<div class="row gap-10 wrap" style="justify-content:center"><button class="btn btn-primary btn-sm" data-quick="new">Add your first task</button>' +
          '<button class="btn btn-outline btn-sm" id="load-sample">Load sample data</button></div>') + "</div>";
      }
      if (!list.length) {
        return html + '<div class="card">' + emptyState("search", "No matches",
          "Nothing fits those filters. Try clearing the search or choosing a different priority.",
          '<button class="btn btn-outline btn-sm" id="clear-filters">Clear filters</button>') + "</div>";
      }

      var groups = { high: [], medium: [], low: [] };
      var noDate = [];
      list.forEach(function (t) {
        if (sort === "due" && !t.dueDate) noDate.push(t);
        else groups[t.priority] ? groups[t.priority].push(t) : noDate.push(t);
      });

      if (sort !== "due") {
        html += '<div class="card"><div class="task-list">' + list.map(function (t) { return taskRow(t); }).join("") + "</div></div>";
      } else {
        html += '<div class="card" style="overflow:hidden">';
        ["high", "medium", "low"].forEach(function (p) {
          if (!groups[p].length) return;
          html += '<div style="padding:9px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">' +
            cap(p) + " priority · " + groups[p].length + "</div>";
          html += groups[p].map(function (t) { return taskRow(t); }).join("");
        });
        if (noDate.length) {
          html += '<div style="padding:9px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">No due date · ' + noDate.length + "</div>";
          html += noDate.map(function (t) { return taskRow(t); }).join("");
        }
        html += "</div>";
      }

      html += '<p class="small faint" style="margin-top:14px">' + list.length + " of " + all.length + " tasks shown" +
        (filterState.q || filterState.priority || filterState.status || filterState.category ? " · filters active" : "") + "</p>";
      return html;
    },
    mount: function (root) {
      var search = $("#task-search", root);
      if (search) {
        search.addEventListener("input", UI.debounce(function () {
          filterState.q = search.value;
          renderView();
          var s = $("#task-search");
          if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
        }, 220));
      }
      [["#f-status-sel", "status"], ["#f-pri-sel", "priority"], ["#f-cat-sel", "category"], ["#f-sort-sel", "sort"]].forEach(function (pair) {
        var el = $(pair[0], root);
        if (el) el.addEventListener("change", function () { filterState[pair[1]] = el.value; renderView(); });
      });
      $$("[data-quick=new]", root).forEach(function (b) {
        b.addEventListener("click", function () { P.openTask(null, { dueDate: null }); });
      });
      var clear = $("#clear-filters", root);
      if (clear) clear.addEventListener("click", function () {
        filterState = { q: "", priority: "", status: "", category: "", sort: "due", view: "all" };
        renderView();
      });
      var sample = $("#load-sample", root);
      if (sample) sample.addEventListener("click", loadSample);
    },
  };

  /* --------------------------------------------------------------- today */
  P.views.today = {
    title: "Today",
    sub: function () { return D.prettyLong(today()); },
    render: function () {
      var list = todaysTasks();
      var pending = list.filter(function (t) { return t.status !== "completed"; });
      var done = list.filter(function (t) { return t.status === "completed"; });
      var overdue = openTasks().filter(function (t) { return T.isOverdue(t, tz()); });
      var pct = list.length ? Math.round((done.length / list.length) * 100) : 0;

      var html = '<div class="stat-grid" style="margin-bottom:16px">' +
        statCard("On today's list", list.length, "due or scheduled") +
        statCard("Completed", done.length, "of " + list.length, "good") +
        statCard("Remaining", D.duration(T.remainingMinutes(pending)), "estimated effort") +
        statCard("Overdue", overdue.length, overdue.length ? "carried over" : "clear", overdue.length ? "warn" : "") +
        "</div>";

      html += '<div class="card" style="margin-bottom:16px"><div class="card-head"><span class="card-title">Progress</span>' +
        '<span class="small muted mono">' + pct + "%</span></div><div class=\"card-body\">" +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div></div></div>';

      if (overdue.length) {
        html += '<div class="card" style="margin-bottom:16px;border-color:color-mix(in srgb,var(--danger) 30%, transparent)">' +
          '<div class="card-head"><span class="card-title" style="color:var(--danger)">Carried over · ' + overdue.length + "</span></div>" +
          '<div class="task-list">' + overdue.map(function (t) { return taskRow(t); }).join("") + "</div></div>";
      }

      html += '<div class="card"><div class="card-head"><span class="card-title">Today</span>' +
        '<button class="btn btn-sm btn-ghost" data-quick="new">' + icon("plus") + " Add</button></div>";
      if (!list.length) {
        html += emptyState("sun", "A clear day", "Nothing is due or scheduled for today. Add something, or use the AI Planner to build a plan.",
          '<button class="btn btn-primary btn-sm" data-quick="new">Add a task for today</button>');
      } else {
        html += '<div class="task-list">' + pending.map(function (t) { return taskRow(t, { date: today() }); }).join("") +
          done.map(function (t) { return taskRow(t); }).join("") + "</div>";
      }
      html += "</div>";
      return html;
    },
    mount: function (root) {
      $$("[data-quick=new]", root).forEach(function (b) {
        b.addEventListener("click", function () { P.openTask(null, { dueDate: today(), priority: prefs().defaultPriority }); });
      });
    },
  };

  /* ------------------------------------------------------------ upcoming */
  P.views.upcoming = {
    title: "Upcoming",
    sub: function () { return "Next 30 days"; },
    render: function () {
      var t = today();
      var list = openTasks().filter(function (x) {
        if (!x.dueDate) return false;
        var d = D.diffDays(t, x.dueDate);
        return d > 0 && d <= 30;
      }).sort(function (a, b) {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return T.priorityRank(a.priority) - T.priorityRank(b.priority);
      });
      var undated = openTasks().filter(function (x) { return !x.dueDate; });

      if (!list.length && !undated.length) {
        return '<div class="card">' + emptyState("upcoming", "Nothing coming up",
          "You have no dated tasks in the next 30 days. That is either very good news or a missing due date.",
          '<button class="btn btn-primary btn-sm" data-quick="new">Add a task</button>') + "</div>";
      }

      var groups = {};
      list.forEach(function (x) { (groups[x.dueDate] = groups[x.dueDate] || []).push(x); });
      var html = "";
      Object.keys(groups).sort().forEach(function (date) {
        var d = D.diffDays(t, date);
        var label = d === 1 ? "Tomorrow" : D.prettyLong(date);
        html += '<div class="card" style="margin-bottom:14px;overflow:hidden">' +
          '<div class="card-head" style="background:var(--surface-2)">' +
          '<span class="card-title" style="font-size:13.5px">' + esc(label) + "</span>" +
          '<span class="small muted">' + groups[date].length + " task" + (groups[date].length > 1 ? "s" : "") +
          " · " + D.duration(T.remainingMinutes(groups[date])) + "</span></div>" +
          '<div class="task-list">' + groups[date].map(function (x) { return taskRow(x); }).join("") + "</div></div>";
      });
      if (!html) html += '<div class="card">' + emptyState("upcoming", "Nothing dated ahead", "The next 30 days are clear of deadlines.",
        '<button class="btn btn-primary btn-sm" data-quick="new">Add a task</button>') + "</div>";
      if (undated.length) {
        html += '<div class="card" style="overflow:hidden"><div class="card-head" style="background:var(--surface-2)">' +
          '<span class="card-title" style="font-size:13.5px">No due date</span>' +
          '<span class="small muted">' + undated.length + "</span></div>" +
          '<div class="task-list">' + undated.map(function (x) { return taskRow(x); }).join("") + "</div></div>";
      }
      return html;
    },
    mount: function (root) {
      $$("[data-quick=new]", root).forEach(function (b) {
        b.addEventListener("click", function () { P.openTask(null, { dueDate: D.addDays(today(), 1) }); });
      });
    },
  };

  /* ------------------------------------------------------------- completed */
  P.views.completed = {
    title: "Completed",
    sub: function () {
      return tasks().filter(function (t) { return t.status === "completed"; }).length + " tasks finished";
    },
    render: function () {
      var done = tasks().filter(function (t) { return t.status === "completed"; })
        .sort(function (a, b) { return String(b.completedAt || b.updatedAt).localeCompare(String(a.completedAt || a.updatedAt)); });
      if (!done.length) {
        return '<div class="card">' + emptyState("completed", "Nothing completed yet",
          "Finished tasks collect here so you can see what you actually got done — and reopen anything by mistake.",
          '<a class="btn btn-outline btn-sm" href="#/tasks">Go to my tasks</a>') + "</div>";
      }
      var byDay = {};
      done.forEach(function (t) {
        var key = String(t.completedAt || t.updatedAt || "").slice(0, 10) || "unknown";
        (byDay[key] = byDay[key] || []).push(t);
      });
      var html = '<div class="stat-grid" style="margin-bottom:16px">' +
        statCard("Completed", done.length, "all time", "good") +
        statCard("This week", done.filter(function (t) {
          var c = String(t.completedAt || "").slice(0, 10);
          return c && D.diffDays(c, today()) <= 0 && D.diffDays(c, today()) > -7;
        }).length, "last 7 days", "good") +
        statCard("Today", done.filter(function (t) { return String(t.completedAt || "").slice(0, 10) === today(); }).length, "ticked off") +
        "</div>";
      Object.keys(byDay).sort().reverse().forEach(function (day) {
        html += '<div class="card" style="margin-bottom:14px;overflow:hidden"><div class="card-head" style="background:var(--surface-2)">' +
          '<span class="card-title" style="font-size:13.5px">' + esc(day === "unknown" ? "Earlier" : D.relative(day, tz())) + "</span>" +
          '<span class="small muted">' + byDay[day].length + "</span></div>" +
          '<div class="task-list">' + byDay[day].map(function (t) { return taskRow(t); }).join("") + "</div></div>";
      });
      return html;
    },
  };

  /* ------------------------------------------------------- sample data */
  function loadSample() {
    var t = today();
    var demo = [
      { title: "Finish the mathematics assignment", dueDate: D.addDays(t, 2), priority: "high", estimatedMinutes: 90, category: "Study" },
      { title: "Study Java — chapter 4", dueDate: D.addDays(t, 1), priority: "medium", estimatedMinutes: 120, category: "Study" },
      { title: "Prepare the client presentation", dueDate: D.addDays(t, 4), priority: "high", estimatedMinutes: 75, category: "Work" },
      { title: "Clean the room", dueDate: t, priority: "low", estimatedMinutes: 30, category: "Home" },
      { title: "Revise for the science test", dueDate: D.addDays(t, 3), priority: "medium", estimatedMinutes: 60, category: "Study" },
      { title: "Reply to Sam about the group project", dueDate: t, priority: "high", estimatedMinutes: 15, category: "Work" },
      { title: "30 minutes of exercise", dueDate: null, priority: "low", estimatedMinutes: 30, category: "Health" },
    ];
    P.save(function (d) {
      demo.forEach(function (x) { d.tasks.unshift(newTask(x)); });
    });
    UI.toast("Sample tasks added — edit or delete them freely", "success");
    scanNotifications();
  }

  /* ------------------------------------------------------------- router */
  function renderView() {
    if (!Auth.isSignedIn()) return;
    P.data = Auth.data();
    P.user = Auth.account();
    var id = routeId();
    var view = P.views[id] || P.views.dashboard;
    var viewEl = $("#view");
    var title = typeof view.title === "function" ? view.title() : view.title;
    var sub = typeof view.sub === "function" ? view.sub() : view.sub;
    $("#page-title").textContent = title;
    $("#page-sub").textContent = sub || "";
    document.title = title + " — Planora";
    viewEl.innerHTML = view.render();
    viewEl.classList.remove("hide");
    if (view.mount) view.mount(viewEl);
    renderSidebar();
    renderBottomNav();
    updateVerifyChip();
    updateNotifBadge();
    $$(".faq-item").forEach(function () {});
    var sidebar = $("#sidebar");
    if (sidebar) sidebar.classList.remove("open");
    var scrim = $("#scrim");
    if (scrim) scrim.classList.remove("open");
    document.body.style.overflow = "";
  }
  window.renderView = renderView;

  /* --------------------------------------------------------------- boot */
  function boot() {
    if (!Auth.isSignedIn()) {
      var next = "app.html" + (location.hash || "#/dashboard");
      location.replace("login.html?next=" + encodeURIComponent(next));
      return;
    }
    P.data = Auth.data();
    P.user = Auth.account();
    UI.Theme.apply(P.data.prefs.theme || "light");
    $("#theme-btn").innerHTML = icon(UI.Theme.get() === "dark" ? "sun" : "moon");

    bindView($("#view"));

    if (!location.hash) {
      var pending = P.data.onboarding && !P.data.onboarding.completed;
      location.replace("app.html#" + (pending ? "/onboarding" : "/dashboard"));
      return;
    }

    scanNotifications();
    renderView();

    setInterval(function () { if (Auth.isSignedIn()) scanNotifications(); }, 60000);

    $("#add-task-btn").addEventListener("click", function () {
      P.openTask(null, { dueDate: null, priority: prefs().defaultPriority });
    });
    $("#theme-btn").addEventListener("click", function () {
      var next = UI.Theme.toggle();
      $("#theme-btn").innerHTML = icon(next === "dark" ? "sun" : "moon");
      P.data = Auth.data();
    });
    $("#notif-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      var panel = $("#notif-panel");
      if (panel) { closeNotifs(); return; }
      renderNotifPanel();
      $("#notif-btn").setAttribute("aria-expanded", "true");
    });
    document.addEventListener("click", function (e) {
      var panel = $("#notif-panel");
      if (!panel) return;
      if (e.target.closest("#notif-panel") || e.target.closest("#notif-btn")) return;
      closeNotifs();
    });
    $("#menu-btn").addEventListener("click", function () {
      $("#sidebar").classList.add("open");
      $("#scrim").classList.add("open");
    });
    $("#scrim").addEventListener("click", function () {
      $("#sidebar").classList.remove("open");
      $("#scrim").classList.remove("open");
    });
    var sideClose = $("#side-close");
    if (sideClose) sideClose.addEventListener("click", function () {
      $("#sidebar").classList.remove("open");
      $("#scrim").classList.remove("open");
    });

    window.addEventListener("hashchange", renderView);

    document.addEventListener("keydown", function (e) {
      if (e.key === "n" && !/input|textarea|select/i.test((e.target.tagName || "")) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        P.openTask(null, { dueDate: null, priority: prefs().defaultPriority });
      }
      if (e.key === "Escape") {
        $("#sidebar").classList.remove("open");
        $("#scrim").classList.remove("open");
        closeNotifs();
      }
    });
  }

  P.today = today;
  P.tz = tz;
  P.prefs = prefs;
  P.scanNotifications = scanNotifications;
  P.loadSample = loadSample;
  P.taskRow = taskRow;
  P.emptyState = emptyState;
  P.statCard = statCard;
  P.todaysTasks = todaysTasks;
  P.openTasks = openTasks;

  document.addEventListener("DOMContentLoaded", boot);
})();
