/*!
 * Planora — AI Planner view
 */
(function () {
  "use strict";
  var UI = window.PlanoraUI;
  var $ = UI.$, $$ = UI.$$, icon = UI.icon, esc = UI.esc, D = PDate;
  var PE = window.PlanoraPlanner;

  function P() { return window.Planora; }
  function prefs() { return P().data.prefs; }
  function clock(m) { return D.clock(m, prefs().timeFormat); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  var S = {
    stage: "input",
    text: "",
    extracted: [],
    plan: null,
    notes: [],
    recs: [],
    includeExisting: true,
    constraints: null,
    busy: false,
  };

  function constraints() {
    if (!S.constraints) {
      var p = prefs();
      S.constraints = {
        workStart: p.workStart == null ? 540 : p.workStart,
        workEnd: p.workEnd == null ? 1080 : p.workEnd,
        dailyCapacity: p.dailyCapacity || 240,
        workdays: (p.workdays || [1, 2, 3, 4, 5]).slice(),
        breakEvery: p.breakEvery || 90,
        breakMinutes: p.breakMinutes == null ? 15 : p.breakMinutes,
        unavailableDays: [],
        commitments: [],
      };
    }
    return S.constraints;
  }

  var ENGINE_LABEL = (function () {
    var ep = (window.PLANORA_CONFIG && window.PLANORA_CONFIG.ai && window.PLANORA_CONFIG.ai.endpoint) || null;
    return ep ? "Your configured AI endpoint" : "Planora Engine (built-in, runs on your device)";
  })();

  /* ------------------------------------------------------------ paywall */
  function paywall() {
    return '<div class="paywall"><span class="icon-box" style="margin:0 auto 14px;width:48px;height:48px">' + icon("spark") + "</span>" +
      '<h2 class="h2" style="font-size:1.55rem">The AI Planner is part of Premium</h2>' +
      '<p class="lede" style="margin:10px auto 0;max-width:520px;font-size:14.5px">Describe everything on your plate in one paragraph. Planora extracts the tasks, reads the deadlines and durations, and fits them into the hours you actually have — flagging anything that does not fit.</p>' +
      '<div class="row gap-10" style="justify-content:center;margin-top:20px;flex-wrap:wrap">' +
      '<a class="btn btn-primary" href="#/billing?upgrade=1">Upgrade for $4/month</a>' +
      '<a class="btn btn-outline" href="#/tasks">Keep using free planning</a></div>' +
      '<p class="small faint" style="margin-top:16px">Cancel at any time. Your tasks stay exactly as they are.</p></div>';
  }

  /* ------------------------------------------------------ constraint card */
  function constraintCard() {
    var c = constraints();
    var t = P().today();
    var dayChips = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map(function (d, i) {
        var wd = i + 1 === 7 ? 0 : i + 1;
        return '<button type="button" class="filter-chip ' + (c.workdays.indexOf(wd) >= 0 ? "on" : "") +
          '" data-day="' + wd + '">' + d + "</button>";
      }).join("");

    var commitRows = c.commitments.length
      ? c.commitments.map(function (x, i) {
          return '<div class="row gap-8 small" style="padding:7px 0;border-bottom:1px solid var(--border)">' +
            '<span class="grow truncate">' + esc(x.title) + "</span>" +
            '<span class="muted mono" style="font-size:12px">' + D.pretty(x.date) + " " + clock(x.start) + "–" + clock(x.end) + "</span>" +
            '<button class="btn btn-icon btn-sm btn-ghost" data-commit-del="' + i + '" aria-label="Remove commitment">' + icon("x") + "</button></div>";
        }).join("")
      : '<p class="small muted">No fixed commitments. Add anything already in your week — meetings, classes, appointments.</p>';

    return '<section class="card"><div class="card-head"><span class="card-title">Scheduling preferences</span>' +
      '<span class="small muted">Applied to the next generation</span></div><div class="card-body stack gap-16">' +
      '<div class="row gap-12 wrap">' +
      '<div class="field" style="min-width:110px"><label class="label" for="c-start">Shift starts</label>' +
      '<input class="input" id="c-start" type="time" value="' + D.clock(c.workStart, "24") + '"></div>' +
      '<div class="field" style="min-width:110px"><label class="label" for="c-end">Shift ends</label>' +
      '<input class="input" id="c-end" type="time" value="' + D.clock(c.workEnd, "24") + '"></div>' +
      '<div class="field grow" style="min-width:140px"><label class="label" for="c-cap">Daily focus cap</label>' +
      '<select class="select" id="c-cap">' +
      [60, 90, 120, 180, 240, 300, 360, 420, 480].map(function (m) {
        return '<option value="' + m + '"' + (c.dailyCapacity === m ? " selected" : "") + ">" + D.duration(m) + "</option>";
      }).join("") + "</select></div></div>" +
      '<div class="field"><label class="label">Working days</label>' +
      '<div class="row gap-8 wrap">' + dayChips + "</div></div>" +
      '<div class="row gap-12 wrap">' +
      '<div class="field" style="min-width:150px"><label class="label" for="c-be">Break after</label>' +
      '<select class="select" id="c-be">' +
      [60, 75, 90, 120, 150, 180].map(function (m) {
        return '<option value="' + m + '"' + (c.breakEvery === m ? " selected" : "") + ">" + D.duration(m) + " of focus</option>";
      }).join("") + "</select></div>" +
      '<div class="field" style="min-width:120px"><label class="label" for="c-bm">Break length</label>' +
      '<select class="select" id="c-bm">' +
      [0, 5, 10, 15, 20, 30].map(function (m) {
        return '<option value="' + m + '"' + (c.breakMinutes === m ? " selected" : "") + ">" + (m ? m + " min" : "No breaks") + "</option>";
      }).join("") + "</select></div></div>" +
      '<div class="field"><div class="between"><label class="label">Fixed commitments</label>' +
      '<button class="btn btn-sm btn-ghost" id="add-commit" type="button">' + icon("plus") + " Add</button></div>" +
      '<div id="commit-list">' + commitRows + "</div></div>" +
      '<div class="field"><label class="label" for="c-off">Days off</label>' +
      '<div class="row gap-8 wrap">' +
      '<input class="input" id="c-off" type="date" value="' + t + '" style="max-width:180px">' +
      '<button class="btn btn-outline btn-sm" id="add-off" type="button">Block this day</button></div>' +
      (c.unavailableDays.length
        ? '<div class="row gap-8 wrap" style="margin-top:8px">' + c.unavailableDays.map(function (d, i) {
            return '<span class="pill">' + esc(D.prettyLong(d)) +
              ' <button class="btn btn-icon btn-sm btn-ghost" data-off-del="' + i + '" aria-label="Unblock">' + icon("x") + "</button></span>";
          }).join("") + "</div>"
        : "") +
      "</div></div></section>";
  }

  /* ----------------------------------------------------------- stage 1 */
  function stageInput() {
    return '<div class="planner-grid"><div class="stack gap-16">' +
      '<section class="card card-pad">' +
      '<div class="between wrap gap-12" style="margin-bottom:12px">' +
      '<div><h2 class="card-title" style="font-size:17px">What do you need to get done?</h2>' +
      '<p class="small muted" style="margin-top:3px">Write it however you think. Deadlines and durations are picked up automatically.</p></div>' +
      '<span class="pill pill-primary">' + icon("spark") + " Premium</span></div>" +
      '<label class="sr-only" for="nl-input">Describe your tasks</label>' +
      '<textarea class="nl-area" id="nl-input" placeholder="I need to finish my mathematics assignment by Wednesday, study Java for two hours, prepare a presentation for Friday, clean my room, and revise for my science test.">' + esc(S.text) + "</textarea>" +
      '<div class="example-chips">' +
      ["Finish the report by Friday, 2 hours", "Gym three times this week", "Study Java for two hours and clean my room", "Call the bank tomorrow, 20 minutes urgent"].map(function (x) {
        return '<button class="example-chip" data-example="' + esc(x) + '">' + esc(x) + "</button>";
      }).join("") + "</div>" +
      '<div class="between wrap gap-12" style="margin-top:18px">' +
      '<label class="checkbox" style="font-size:13px"><input type="checkbox" id="inc-existing"' + (S.includeExisting ? " checked" : "") + ">" +
      "<span>Also place my " + P().openTasks().length + " existing open task" + (P().openTasks().length === 1 ? "" : "s") + "</span></label>" +
      '<div class="row gap-10"><button class="btn btn-outline" id="clear-text" type="button">Clear</button>' +
      '<button class="btn btn-primary" id="extract-btn" type="button">Extract tasks ' + icon("arrowRight") + "</button></div></div>" +
      '<p class="hint" style="margin-top:12px">Engine: ' + esc(ENGINE_LABEL) + ". Nothing leaves your device unless an AI endpoint is configured.</p>" +
      "</section>" +
      constraintCard() +
      "</div>" +
      '<aside class="stack gap-16">' +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">How this works</h3>' +
      '<div class="stack gap-12" style="margin-top:12px">' +
      [["list", "You describe the work"], ["search", "Planora extracts tasks, dates and durations"], ["calendar", "It fits them into your real hours"], ["alert", "It tells you what does not fit"]]
        .map(function (x) {
          return '<div class="row gap-10 small"><span class="icon-box" style="width:26px;height:26px;border-radius:7px">' + icon(x[0]) + "</span><span class=\"muted\">" + x[1] + "</span></div>";
        }).join("") + "</div></section>" +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Your defaults</h3>' +
      '<p class="small muted" style="margin-top:8px;line-height:1.6">' + D.clock(constraints().workStart, prefs().timeFormat) + "–" +
      D.clock(constraints().workEnd, prefs().timeFormat) + " · " + D.duration(constraints().dailyCapacity) + " per day · breaks every " +
      D.duration(constraints().breakEvery) + ".</p>" +
      '<a class="btn btn-sm btn-outline" style="margin-top:10px" href="#/settings">Change in settings</a></section>' +
      "</aside></div>";
  }

  /* ----------------------------------------------------------- stage 2 */
  function stageReview() {
    var rows = S.extracted.map(function (t, i) {
      return '<div class="extracted-row" data-row="' + i + '">' +
        '<input class="input etitle" data-f="title" value="' + esc(t.title) + '" aria-label="Task title">' +
        '<input class="input" data-f="dueDate" type="date" value="' + (t.dueDate || "") + '" aria-label="Due date">' +
        '<input class="input" data-f="estimatedMinutes" type="number" min="15" max="720" step="15" value="' + t.estimatedMinutes + '" aria-label="Minutes">' +
        '<select class="select" data-f="priority" aria-label="Priority">' +
        ["high", "medium", "low"].map(function (p) {
          return '<option value="' + p + '"' + (t.priority === p ? " selected" : "") + ">" + cap(p) + "</option>";
        }).join("") + "</select>" +
        '<button class="btn btn-icon btn-sm btn-ghost" data-del="' + i + '" aria-label="Remove">' + icon("x") + "</button>" +
        "</div>";
    }).join("");

    var reasons = S.extracted.filter(function (t) { return t._reasons && t._reasons.length; }).length;

    return '<div class="planner-grid"><div class="stack gap-16">' +
      '<section class="card"><div class="card-head">' +
      '<div><span class="card-title">Review what was extracted</span>' +
      '<p class="small muted" style="margin-top:2px">' + S.extracted.length + " task" + (S.extracted.length === 1 ? "" : "s") +
      " found" + (reasons ? " · " + reasons + " with inferred dates or durations" : "") + "</p></div>" +
      '<div class="row gap-8"><button class="btn btn-sm btn-ghost" id="back-to-input">' + icon("arrowLeft") + " Edit text</button>" +
      '<button class="btn btn-sm btn-outline" id="add-row">' + icon("plus") + " Add row</button></div></div>" +
      '<div class="table-wrap"><div class="extracted-row" style="background:var(--surface-2);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">' +
      "<span>Task</span><span>Due</span><span>Minutes</span><span>Priority</span><span></span></div>" +
      (rows || '<div class="empty" style="padding:30px"><p class="small muted">Nothing left. Go back and describe your work.</p></div>') +
      "</div></section>" +
      constraintCard() +
      "</div>" +
      '<aside class="stack gap-16">' +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Generate</h3>' +
      '<p class="small muted" style="margin-top:8px;line-height:1.6">' + (S.includeExisting ? "Your existing open tasks are included. " : "") +
      "Total work: <b>" + D.duration(S.extracted.reduce(function (s, t) { return s + (Number(t.estimatedMinutes) || 0); }, 0)) + "</b> across " +
      S.extracted.length + " task" + (S.extracted.length === 1 ? "" : "s") + ".</p>" +
      '<button class="btn btn-primary btn-block" id="generate-btn" style="margin-top:16px"' +
      (S.extracted.length ? "" : " disabled") + ">" + icon("spark") + " Generate schedule</button>" +
      '<p class="hint" style="margin-top:10px">Nothing is saved to your task list until you accept the plan.</p></section>' +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Assumptions in play</h3>' +
      '<ul class="price-list" style="margin-top:10px">' +
      [
        "Shift " + D.clock(constraints().workStart, prefs().timeFormat) + "–" + D.clock(constraints().workEnd, prefs().timeFormat),
        D.duration(constraints().dailyCapacity) + " focus cap per day",
        constraints().workdays.length + " working days per week",
        constraints().breakMinutes ? "Breaks: " + constraints().breakMinutes + "m every " + D.duration(constraints().breakEvery) : "No breaks scheduled",
        constraints().commitments.length + " fixed commitment" + (constraints().commitments.length === 1 ? "" : "s"),
        constraints().unavailableDays.length + " day" + (constraints().unavailableDays.length === 1 ? "" : "s") + " off",
      ].map(function (x) { return "<li>" + icon("check") + "<span>" + esc(x) + "</span></li>"; }).join("") +
      "</ul></section></aside></div>";
  }

  /* ----------------------------------------------------------- stage 3 */
  function stagePlan() {
    var plan = S.plan;
    if (!plan) return stageInput();
    var planned = plan.days.filter(function (d) { return d.slots.length > 0; });

    var daysHtml = planned.map(function (day) {
      var load = day.scheduledMinutes;
      return '<div class="plan-day"><div class="plan-day-head">' +
        "<div><b>" + esc(D.prettyLong(day.date)) + "</b>" +
        '<div class="small muted" style="margin-top:1px">' + (day.date === P().today() ? "Today · " : "") +
        D.duration(load) + " of focus" + (day.breakMinutes ? " + " + day.breakMinutes + "m breaks" : "") + "</div></div>" +
        '<span class="pill ' + (load > 240 ? "pill-medium" : "pill-ok") + '">' +
        Math.round((load / Math.max(1, day.availableMinutes)) * 100) + "% of window</span></div>" +
        day.slots.map(function (s) {
          if (s.kind === "break") {
            return '<div class="slot brk"><span class="slot-time">' + clock(s.start) + "–" + clock(s.end) + '</span>' +
              '<div class="slot-main"><div class="t">Break</div></div><span class="small faint">' + (s.end - s.start) + "m</span></div>";
          }
          if (s.kind === "commitment") {
            return '<div class="slot"><span class="slot-time">' + clock(s.start) + "–" + clock(s.end) + '</span>' +
              '<div class="slot-main"><div class="t">' + esc(s.title) + '</div><div class="m">Fixed commitment</div></div>' +
              '<span class="pill">Busy</span></div>';
          }
          return '<div class="slot">' +
            '<span class="slot-time">' + clock(s.start) + "–" + clock(s.end) + "</span>" +
            '<div class="slot-main"><div class="t">' + esc(s.parentTitle || s.title) + "</div>" +
            '<div class="m"><span class="pill pill-' + s.priority + '">' + cap(s.priority) + "</span>" +
            (s.parts > 1 ? "<span>Part " + s.part + " of " + s.parts + "</span>" : "") +
            (s.deadline ? "<span>Due " + esc(D.relative(s.deadline, P().tz())) + "</span>" : "") +
            "</div></div>" +
            '<button class="btn btn-sm btn-ghost" data-move="' + s.taskId + '" data-date="' + s.date + '" data-start="' + s.start + '">Move</button></div>';
        }).join("") +
        "</div>";
    }).join("");

    var unsched = plan.unscheduled.length
      ? '<section class="card" style="border-color:color-mix(in srgb,var(--danger) 30%, transparent)"><div class="card-head">' +
        '<span class="card-title" style="color:var(--danger)">Could not fit · ' + plan.unscheduled.length + "</span></div>" +
        '<div class="card-body stack gap-10">' + plan.unscheduled.map(function (u) {
          return '<div class="rec danger"><span class="ic">' + icon("alert") + "</span><div><b>" + esc(u.title) + "</b>" + esc(u.reason) + "</div></div>";
        }).join("") + "</div></section>"
      : "";

    var recsHtml = S.recs.length
      ? S.recs.map(function (r) {
          return '<div class="rec ' + (r.kind === "info" ? "" : r.kind) + '"><span class="ic">' +
            icon(r.kind === "danger" ? "alert" : r.kind === "warn" ? "clock" : "info") + "</span>" +
            "<div><b>" + esc(r.title) + "</b>" + esc(r.body) + "</div></div>";
        }).join("")
      : "";

    return '<div class="planner-grid"><div class="stack gap-16">' +
      '<section class="card"><div class="card-head"><div><span class="card-title">Optimised schedule</span>' +
      '<p class="small muted" style="margin-top:2px">' + D.pretty(plan.startDate) + " – " + D.pretty(plan.endDate) +
      " · generated " + esc(ENGINE_LABEL) + "</p></div>" +
      '<div class="row gap-8">' +
      '<button class="btn btn-sm btn-outline" id="regenerate-btn">' + icon("refresh") + " Regenerate</button>" +
      '<button class="btn btn-sm btn-ghost" id="restart-btn">Start over</button></div></div>' +
      (daysHtml || '<div class="empty"><h3>Nothing could be scheduled</h3><p>Every window is full or blocked. Increase your daily cap or free up a day.</p></div>') +
      "</section>" +
      unsched +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Adjust the plan</h3>' +
      '<p class="small muted" style="margin-top:6px">Say what you want changed in plain language. The plan is rebuilt around your constraints.</p>' +
      '<div class="row gap-10" style="margin-top:12px"><input class="input" id="revise-input" placeholder="Make Wednesday less busy / move Java revision to Thursday / only 2 hours tomorrow">' +
      '<button class="btn btn-outline" id="revise-btn">Apply</button></div>' +
      (S.notes.length ? '<div class="stack gap-8" style="margin-top:12px">' + S.notes.map(function (n) {
        return '<div class="note-box">' + esc(n) + "</div>";
      }).join("") + "</div>" : "") +
      "</section></div>" +
      '<aside class="stack gap-16">' +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Plan summary</h3>' +
      '<div class="summary-grid" style="margin-top:12px">' +
      '<div class="sum-item"><b>' + plan.stats.scheduledTasks + "</b><span>Tasks placed</span></div>" +
      '<div class="sum-item"><b>' + D.duration(plan.stats.totalMinutes) + "</b><span>Total focus</span></div>" +
      '<div class="sum-item"><b>' + plan.stats.daysNeeded + "</b><span>Days needed</span></div>" +
      '<div class="sum-item"><b style="color:' + (plan.stats.unscheduledTasks ? "var(--danger)" : "inherit") + '">' +
      plan.stats.unscheduledTasks + "</b><span>Unscheduled</span></div>" +
      '<div class="sum-item"><b>' + plan.stats.conflicts + "</b><span>Conflicts</span></div>" +
      '<div class="sum-item"><b>' + plan.stats.utilization + "%</b><span>Window used</span></div>" +
      "</div>" +
      '<button class="btn btn-primary btn-block" id="accept-btn" style="margin-top:16px">' + icon("check") + " Accept plan</button>" +
      '<p class="hint" style="margin-top:10px">Accepting adds these tasks to your list and saves the schedule to your calendar, dashboard and Today view. Nothing is marked complete.</p>' +
      "</section>" +
      '<section class="card card-pad"><h3 class="card-title" style="font-size:14px">Recommendations</h3>' +
      '<div class="rec-list" style="margin-top:12px">' + recsHtml + "</div></section>" +
      "</aside></div>";
  }

  /* --------------------------------------------------------------- mount */
  function readConstraints(root) {
    var c = constraints();
    var s = $("#c-start", root), e = $("#c-end", root), capEl = $("#c-cap", root);
    var be = $("#c-be", root), bm = $("#c-bm", root);
    if (s && s.value) c.workStart = D.parseClock(s.value) != null ? D.parseClock(s.value) : c.workStart;
    if (e && e.value) c.workEnd = D.parseClock(e.value) != null ? D.parseClock(e.value) : c.workEnd;
    if (capEl) c.dailyCapacity = parseInt(capEl.value, 10) || c.dailyCapacity;
    if (be) c.breakEvery = parseInt(be.value, 10) || c.breakEvery;
    if (bm) c.breakMinutes = parseInt(bm.value, 10) || 0;
    if (c.workEnd <= c.workStart) c.workEnd = c.workStart + 60;
    var inc = $("#inc-existing", root);
    if (inc) S.includeExisting = inc.checked;
    return c;
  }

  function bindConstraints(root) {
    $$("[data-day]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var wd = parseInt(b.getAttribute("data-day"), 10);
        var c = readConstraints(root);
        var i = c.workdays.indexOf(wd);
        if (i >= 0) c.workdays.splice(i, 1);
        else c.workdays.push(wd);
        window.renderView();
      });
    });
    var addOff = $("#add-off", root);
    if (addOff) addOff.addEventListener("click", function () {
      var v = $("#c-off", root).value;
      if (!v) return;
      var c = readConstraints(root);
      if (c.unavailableDays.indexOf(v) < 0) c.unavailableDays.push(v);
      window.renderView();
    });
    $$("[data-off-del]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var c = readConstraints(root);
        c.unavailableDays.splice(parseInt(b.getAttribute("data-off-del"), 10), 1);
        window.renderView();
      });
    });
    var addCommit = $("#add-commit", root);
    if (addCommit) addCommit.addEventListener("click", function () {
      var t = P().today();
      UI.dialog({
        title: "Add a fixed commitment",
        body: '<div class="stack gap-14">' +
          '<div class="field"><label class="label" for="cm-title">What is it?</label>' +
          '<input class="input" id="cm-title" placeholder="Lecture, meeting, dentist…"></div>' +
          '<div class="field"><label class="label" for="cm-date">Date</label>' +
          '<input class="input" id="cm-date" type="date" value="' + t + '"></div>' +
          '<div class="row gap-12"><div class="field grow"><label class="label" for="cm-start">Start</label>' +
          '<input class="input" id="cm-start" type="time" value="09:00"></div>' +
          '<div class="field grow"><label class="label" for="cm-end">End</label>' +
          '<input class="input" id="cm-end" type="time" value="10:00"></div></div></div>',
        footer: '<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" id="cm-save">Add commitment</button>',
        onMount: function (r2, close) {
          $("#cm-save", r2).addEventListener("click", function () {
            var title = $("#cm-title", r2).value.trim() || "Commitment";
            var date = $("#cm-date", r2).value;
            var st = D.parseClock($("#cm-start", r2).value);
            var en = D.parseClock($("#cm-end", r2).value);
            if (!date || st == null || en == null || en <= st) { UI.toast("Check the date and times", "error"); return; }
            var c = readConstraints(root);
            c.commitments.push({ title: title, date: date, start: st, end: en });
            close();
            window.renderView();
          });
        },
      });
    });
    $$("[data-commit-del]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var c = readConstraints(root);
        c.commitments.splice(parseInt(b.getAttribute("data-commit-del"), 10), 1);
        window.renderView();
      });
    });
  }

  function gatherTasks(root) {
    var list = S.extracted.map(function (t) {
      return {
        id: t.id, title: t.title, dueDate: t.dueDate || null, priority: t.priority,
        estimatedMinutes: Math.max(15, Number(t.estimatedMinutes) || 30),
        category: t.category, status: "pending",
      };
    });
    if (S.includeExisting) {
      P().openTasks().forEach(function (t) {
        if (list.some(function (x) { return x.id === t.id; })) return;
        list.push({
          id: t.id, title: t.title, dueDate: t.dueDate || null, priority: t.priority,
          estimatedMinutes: t.estimatedMinutes || 30, category: t.category, status: t.status,
        });
      });
    }
    return list;
  }

  function generate(root) {
    var c = readConstraints(root || document);
    var tasks = gatherTasks(root);
    S.plan = PE.schedule({
      tasks: tasks,
      prefs: prefs(),
      startDate: P().today(),
      engine: ENGINE_LABEL,
      workStart: c.workStart,
      workEnd: c.workEnd,
      dailyCapacity: c.dailyCapacity,
      workdays: c.workdays,
      unavailableDays: c.unavailableDays,
      commitments: c.commitments,
    });
    S.recs = PE.recommend(S.plan, tasks, prefs());
    S.notes = [];
    S.stage = "plan";
    window.renderView();
  }

  /* ---------------------------------------------------------------- view */
  P().views.planner = {
    title: "AI Planner",
    sub: function () {
      return Auth.isPremium() ? "Premium · " + (S.stage === "input" ? "describe your work" : S.stage === "review" ? "review extracted tasks" : "schedule ready") : "Premium feature";
    },
    render: function () {
      if (!Auth.isPremium()) return paywall();
      if (S.stage === "review") return stageReview();
      if (S.stage === "plan") return stagePlan();
      return stageInput();
    },
    mount: function (root) {
      if (!Auth.isPremium()) return;

      var nl = $("#nl-input", root);
      if (nl) {
        nl.addEventListener("input", function () { S.text = nl.value; });
        $$("[data-example]", root).forEach(function (b) {
          b.addEventListener("click", function () {
            S.text = (S.text ? S.text + " " : "") + b.getAttribute("data-example");
            nl.value = S.text;
            nl.focus();
          });
        });
        var clear = $("#clear-text", root);
        if (clear) clear.addEventListener("click", function () { S.text = ""; nl.value = ""; nl.focus(); });
        var ex = $("#extract-btn", root);
        if (ex) ex.addEventListener("click", function () {
          readConstraints(root);
          var text = nl.value.trim();
          if (text.length < 4) { UI.toast("Describe at least one thing you need to do", "error"); return; }
          S.text = text;
          var parsed = PE.parseTasks(text, { today: P().today(), tz: P().tz(), defaultPriority: prefs().defaultPriority });
          if (!parsed.tasks.length) { UI.toast(parsed.notes[0] || "No tasks found", "error"); return; }
          S.extracted = parsed.tasks.map(function (t) {
            t.id = uid("tsk");
            return t;
          });
          S.stage = "review";
          window.renderView();
        });
      }

      /* review stage */
      $$("[data-row]", root).forEach(function (row) {
        var i = parseInt(row.getAttribute("data-row"), 10);
        $$("[data-f]", row).forEach(function (input) {
          input.addEventListener("change", function () {
            var f = input.getAttribute("data-f");
            S.extracted[i][f] = f === "estimatedMinutes" ? Math.max(15, Number(input.value) || 30) : input.value;
          });
          input.addEventListener("input", function () {
            var f = input.getAttribute("data-f");
            if (f === "title") S.extracted[i].title = input.value;
          });
        });
        var del = $("[data-del]", row);
        if (del) del.addEventListener("click", function () {
          S.extracted.splice(i, 1);
          window.renderView();
        });
      });
      var back = $("#back-to-input", root);
      if (back) back.addEventListener("click", function () { S.stage = "input"; window.renderView(); });
      var addRow = $("#add-row", root);
      if (addRow) addRow.addEventListener("click", function () {
        S.extracted.push({
          id: uid("tsk"), title: "", dueDate: null, priority: "medium",
          estimatedMinutes: 30, category: "General", status: "pending",
        });
        window.renderView();
      });
      var gen = $("#generate-btn", root);
      if (gen) gen.addEventListener("click", function () {
        var empty = S.extracted.filter(function (t) { return !String(t.title || "").trim(); });
        if (empty.length) {
          S.extracted = S.extracted.filter(function (t) { return String(t.title || "").trim(); });
          UI.toast("Empty rows were removed", "success", 2000);
        }
        if (!S.extracted.length) { S.stage = "input"; window.renderView(); return; }
        generate(root);
      });

      /* plan stage */
      var accept = $("#accept-btn", root);
      if (accept) accept.addEventListener("click", acceptPlan);
      var regen = $("#regenerate-btn", root);
      if (regen) regen.addEventListener("click", function () { generate(root); UI.toast("Plan regenerated", "success"); });
      var restart = $("#restart-btn", root);
      if (restart) restart.addEventListener("click", function () {
        S = { stage: "input", text: S.text, extracted: [], plan: null, notes: [], recs: [], includeExisting: S.includeExisting, constraints: S.constraints, busy: false };
        window.renderView();
      });
      var reviseBtn = $("#revise-btn", root);
      if (reviseBtn) reviseBtn.addEventListener("click", function () {
        var input = $("#revise-input", root);
        var cmd = (input.value || "").trim();
        if (!cmd) { UI.toast("Tell me what to change", "error"); return; }
        var res = PE.revise({
          plan: S.plan, tasks: gatherTasks(root), prefs: prefs(), command: cmd, startDate: P().today(),
        });
        S.plan = res.plan;
        S.notes = res.notes;
        S.recs = PE.recommend(S.plan, res.tasks, prefs());
        var c = constraints();
        c.workStart = res.plan.constraints.workStart;
        c.workEnd = res.plan.constraints.workEnd;
        c.dailyCapacity = res.plan.constraints.dailyCapacity;
        c.workdays = res.plan.constraints.workdays;
        c.unavailableDays = res.plan.constraints.unavailableDays || [];
        input.value = "";
        window.renderView();
        UI.toast(res.notes[0], "success", 4000);
      });
      $$("[data-move]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          moveSlot(b.getAttribute("data-move"), b.getAttribute("data-date"), parseInt(b.getAttribute("data-start"), 10));
        });
      });

      bindConstraints(root);
    },
  };

  function moveSlot(taskId, date, start) {
    var plan = S.plan;
    var slot = null, from = null;
    plan.days.forEach(function (d) {
      d.slots.forEach(function (s) { if (s.kind === "task" && s.taskId === taskId && s.date === date && s.start === start) { slot = s; from = d; } });
    });
    if (!slot) return;
    var len = slot.end - slot.start;
    UI.dialog({
      title: "Move this block",
      body: '<div class="stack gap-14">' +
        '<div class="small muted">' + esc(slot.parentTitle || slot.title) + " · " + D.duration(len) + "</div>" +
        '<div class="row gap-12"><div class="field grow"><label class="label" for="mv-date">Date</label>' +
        '<input class="input" id="mv-date" type="date" value="' + date + '"></div>' +
        '<div class="field grow"><label class="label" for="mv-time">Start time</label>' +
        '<input class="input" id="mv-time" type="time" value="' + D.clock(start, "24") + '"></div></div>' +
        '<p class="hint">This changes the saved schedule. The task’s own due date is not modified.</p></div>',
      footer: '<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" id="mv-save">Move block</button>',
      onMount: function (root, close) {
        $("#mv-save", root).addEventListener("click", function () {
          var nd = $("#mv-date", root).value;
          var ns = D.parseClock($("#mv-time", root).value);
          if (!nd || ns == null) { UI.toast("Choose a valid date and time", "error"); return; }
          var target = null;
          plan.days.forEach(function (d) { if (d.date === nd) target = d; });
          if (!target) { UI.toast("That date is outside this plan's range", "error"); return; }
          // remove from old day
          from.slots = from.slots.filter(function (s) { return s !== slot; });
          from.scheduledMinutes = from.slots.filter(function (s) { return s.kind === "task"; })
            .reduce(function (a, s) { return a + (s.minutes || 0); }, 0);
          slot.date = nd;
          slot.start = ns;
          slot.end = ns + len;
          target.slots.push(slot);
          target.slots.sort(function (a, b) { return a.start - b.start; });
          target.scheduledMinutes = target.slots.filter(function (s) { return s.kind === "task"; })
            .reduce(function (a, s) { return a + (s.minutes || 0); }, 0);
          plan.stats.daysNeeded = plan.days.filter(function (d) { return d.scheduledMinutes > 0; }).length;
          S.notes = ["Moved “" + (slot.parentTitle || slot.title) + "” to " + D.prettyLong(nd) + " at " + clock(ns) + "."];
          close();
          window.renderView();
        });
      },
    });
  }

  function acceptPlan() {
    var plan = S.plan;
    if (!plan) return;
    var now = new Date().toISOString();
    var created = 0;
    P().save(function (d) {
      S.extracted.forEach(function (x) {
        if (d.tasks.some(function (t) { return t.id === x.id; })) return;
        d.tasks.unshift({
          id: x.id, title: x.title, description: x.description || "",
          dueDate: x.dueDate || null, priority: x.priority || "medium",
          status: "pending", estimatedMinutes: x.estimatedMinutes || 30,
          category: x.category || "", notes: x.notes || "",
          createdAt: now, updatedAt: now, completedAt: null,
        });
        created++;
      });
      var saved = JSON.parse(JSON.stringify(plan));
      saved.id = uid("pln");
      saved.name = "Plan for " + D.pretty(plan.startDate) + " – " + D.pretty(plan.endDate);
      saved.createdAt = now;
      saved.updatedAt = now;
      d.plans.unshift(saved);
      d.plans = d.plans.slice(0, 10);
      d.notifications.unshift({
        id: uid("ntf"),
        title: "Plan saved",
        message: plan.stats.scheduledTasks + " tasks scheduled across " + plan.stats.daysNeeded +
          " days (" + D.duration(plan.stats.totalMinutes) + " of focus)." +
          (plan.stats.unscheduledTasks ? " " + plan.stats.unscheduledTasks + " could not be placed." : ""),
        type: "plan", read: false, createdAt: now,
      });
    });
    S.stage = "input";
    S.extracted = [];
    S.plan = null;
    S.notes = [];
    UI.toast(created ? "Plan accepted — " + created + " tasks added" : "Plan saved", "success");
    location.hash = "#/dashboard";
  }
})();
