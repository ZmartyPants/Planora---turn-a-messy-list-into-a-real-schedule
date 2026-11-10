/*!
 * Planora — calendar views (month / week / day)
 */
(function () {
  "use strict";
  var UI = window.PlanoraUI;
  var $ = UI.$, $$ = UI.$$, icon = UI.icon, esc = UI.esc, D = PDate;

  var state = { mode: "month", cursor: null };

  function P() { return window.Planora; }
  function prefs() { return P().data.prefs; }
  function clock(m) { return D.clock(m, prefs().timeFormat); }
  function cursor() { return state.cursor || P().today(); }

  /** date -> [{task, start, end}] combining due dates and accepted plan blocks. */
  function eventsByDate() {
    var map = {};
    function add(date, ev) {
      if (!date) return;
      (map[date] = map[date] || []).push(ev);
    }
    var plan = P().plan();
    var scheduledTaskIds = {};
    if (plan) {
      plan.days.forEach(function (d) {
        d.slots.forEach(function (s) {
          if (s.kind !== "task") return;
          var task = null;
          P().data.tasks.forEach(function (t) { if (t.id === s.taskId) task = t; });
          scheduledTaskIds[s.taskId] = true;
          add(d.date, {
            taskId: s.taskId,
            title: (task ? task.title : s.parentTitle || s.title),
            start: s.start,
            end: s.end,
            priority: s.priority || (task ? task.priority : "medium"),
            done: task ? task.status === "completed" : false,
            scheduled: true,
          });
        });
      });
    }
    P().data.tasks.forEach(function (t) {
      if (!t.dueDate) return;
      if (scheduledTaskIds[t.id]) return; // already shown as a block
      add(t.dueDate, {
        taskId: t.id, title: t.title, start: null, end: null,
        priority: t.priority, done: t.status === "completed", scheduled: false,
      });
    });
    return map;
  }

  function chip(ev) {
    return (
      '<button class="cal-ev ' + (ev.priority === "high" && !ev.done ? "high " : "") + (ev.done ? "done " : "") + '" ' +
      'data-ev="' + ev.taskId + '" title="' + esc(ev.title) + '">' +
      esc(ev.title) + "</button>"
    );
  }

  function monthView() {
    var cur = cursor();
    var first = cur.slice(0, 7) + "-01";
    var start = D.startOfWeek(first, 1);
    var todayStr = P().today();
    var events = eventsByDate();
    var dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var html = '<div class="cal-month"><div class="cal-dow">' +
      dows.map(function (d) { return "<div>" + d + "</div>"; }).join("") + "</div><div class=\"cal-grid\">";
    for (var i = 0; i < 42; i++) {
      var date = D.addDays(start, i);
      var inMonth = date.slice(0, 7) === cur.slice(0, 7);
      var list = (events[date] || []).slice(0, 3);
      var extra = (events[date] || []).length - list.length;
      html += '<div class="cal-cell ' + (inMonth ? "" : "out ") + (date === todayStr ? "today" : "") +
        '" data-date="' + date + '" role="button" tabindex="0" aria-label="' + esc(D.prettyLong(date)) + '">' +
        '<span class="cal-num">' + parseInt(date.slice(8, 10), 10) + "</span>" +
        list.map(chip).join("") +
        (extra > 0 ? '<span class="cal-more">+' + extra + " more</span>" : "") +
        "</div>";
    }
    html += "</div></div>";
    return html;
  }

  function weekHead(start) {
    var todayStr = P().today();
    var out = '<div class="cal-week-head"><div></div>';
    for (var i = 0; i < 7; i++) {
      var d = D.addDays(start, i);
      out += '<div class="' + (d === todayStr ? "is-today" : "") + '">' +
        D.pretty(d, { weekday: "short" }) +
        '<span class="dnum">' + parseInt(d.slice(8, 10), 10) + "</span></div>";
    }
    return out + "</div>";
  }

  function weekView() {
    var cur = cursor();
    var start = D.startOfWeek(cur, 1);
    var events = eventsByDate();
    var hourFrom = 6, hourTo = 22;

    var allDay = '<div class="calgrid-row" style="background:var(--surface-2)"><div class="cal-hour" style="padding-top:6px">all day</div>';
    for (var i = 0; i < 7; i++) {
      var d = D.addDays(start, i);
      var untimed = (events[d] || []).filter(function (e) { return e.start == null; });
      allDay += '<div class="cal-slot" data-date="' + d + '">' + untimed.map(function (e) {
        return '<button class="cal-ev ' + (e.done ? "done " : "") + (e.priority === "high" && !e.done ? "high " : "") +
          '" data-ev="' + e.taskId + '">' + esc(e.title) + "</button>";
      }).join("") + "</div>";
    }
    allDay += "</div>";

    var body = "";
    for (var h = hourFrom; h < hourTo; h++) {
      body += '<div class="calgrid-row"><div class="cal-hour">' + clock(h * 60) + "</div>";
      for (var j = 0; j < 7; j++) {
        var date = D.addDays(start, j);
        var list = (events[date] || []).filter(function (e) {
          return e.start != null && Math.floor(e.start / 60) === h;
        });
        body += '<div class="cal-slot" data-date="' + date + '" data-hour="' + h + '">' +
          list.map(function (e) {
            return '<button class="cal-block ' + (e.done ? "done " : "") + (e.priority === "high" && !e.done ? "high " : "") +
              '" data-ev="' + e.taskId + '" title="' + esc(e.title + " · " + clock(e.start) + "–" + clock(e.end)) + '">' +
              clock(e.start) + " " + esc(e.title) + "</button>";
          }).join("") + "</div>";
      }
      body += "</div>";
    }

    return '<div class="cal-week">' + weekHead(start) + '<div class="cal-body">' + allDay + body + "</div></div>";
  }

  function dayView() {
    var cur = cursor();
    var events = (eventsByDate()[cur] || []).slice().sort(function (a, b) {
      if (a.start == null && b.start == null) return 0;
      if (a.start == null) return 1;
      if (b.start == null) return -1;
      return a.start - b.start;
    });
    var html = "";
    if (!events.length) {
      html = P().emptyState("calendar", "Nothing on this day",
        "Click “Add task for this day” to put something on " + D.prettyLong(cur) + ".",
        '<button class="btn btn-primary btn-sm" id="day-add">Add task for this day</button>');
      return '<div class="card">' + html + "</div>";
    }
    var total = events.reduce(function (s, e) {
      return s + (e.start != null && e.end != null ? e.end - e.start : 0);
    }, 0);
    html += '<div class="card" style="overflow:hidden"><div class="card-head">' +
      '<span class="card-title">' + esc(D.prettyLong(cur)) + "</span>" +
      '<span class="small muted">' + events.length + " item" + (events.length > 1 ? "s" : "") +
      (total ? " · " + D.duration(total) + " scheduled" : "") + "</span></div>" +
      '<div class="task-list">';
    events.forEach(function (e) {
      var task = null;
      P().data.tasks.forEach(function (t) { if (t.id === e.taskId) task = t; });
      html += '<div class="task-row ' + (e.done ? "done" : "") + '">' +
        '<button class="check ' + (e.done ? "on" : "") + '" data-day-toggle="' + e.taskId + '" role="checkbox" aria-checked="' + e.done + '" aria-label="Toggle complete">' +
        icon("check") + "</button>" +
        '<div class="task-main"><div class="task-title">' + esc(e.title) + "</div>" +
        '<div class="task-meta">' +
        (e.start != null ? "<span>" + clock(e.start) + "–" + clock(e.end) + "</span><span class=\"dot\"></span>" : "") +
        '<span class="pill pill-' + e.priority + '">' + e.priority.charAt(0).toUpperCase() + e.priority.slice(1) + "</span>" +
        (task && task.estimatedMinutes ? '<span class="dot"></span><span>' + D.duration(task.estimatedMinutes) + "</span>" : "") +
        (task && task.category ? '<span class="dot"></span><span>' + esc(task.category) + "</span>" : "") +
        (e.scheduled ? '<span class="dot"></span><span class="pill pill-primary">Scheduled</span>' : "") +
        "</div></div>" +
        '<div class="task-actions"><button class="btn btn-icon btn-sm btn-ghost" data-day-edit="' + e.taskId + '" aria-label="Edit task">' + icon("edit") + "</button></div>" +
        "</div>";
    });
    html += "</div></div>";
    html += '<div style="margin-top:14px"><button class="btn btn-outline btn-sm" id="day-add">' + icon("plus") + " Add task for this day</button></div>";
    return html;
  }

  P().views.calendar = {
    title: "Calendar",
    sub: function () {
      var cur = cursor();
      return state.mode === "month" ? D.monthLabel(cur)
        : state.mode === "week" ? "Week of " + D.pretty(D.startOfWeek(cur, 1), { month: "short", day: "numeric" })
        : D.prettyLong(cur);
    },
    render: function () {
      var cur = cursor();
      var html = '<div class="cal-head">' +
        '<button class="btn btn-icon btn-outline btn-sm" data-nav="prev" aria-label="Previous">' + icon("chevronLeft") + "</button>" +
        '<button class="btn btn-icon btn-outline btn-sm" data-nav="next" aria-label="Next">' + icon("chevronRight") + "</button>" +
        '<button class="btn btn-outline btn-sm" data-nav="today">Today</button>' +
        '<span class="cal-title">' +
        (state.mode === "month" ? D.monthLabel(cur)
          : state.mode === "week" ? "Week of " + D.pretty(D.startOfWeek(cur, 1), { month: "short", day: "numeric" })
          : D.prettyLong(cur)) + "</span>" +
        '<div class="seg" style="margin-left:auto">' +
        ["day", "week", "month"].map(function (m) {
          return '<button data-mode="' + m + '" class="' + (state.mode === m ? "on" : "") + '">' +
            m.charAt(0).toUpperCase() + m.slice(1) + "</button>";
        }).join("") + "</div>" +
        '<button class="btn btn-primary btn-sm" id="cal-add">' + icon("plus") + " New</button>" +
        "</div>";
      html += state.mode === "month" ? monthView() : state.mode === "week" ? weekView() : dayView();
      html += '<p class="small faint" style="margin-top:12px">Click any day to add a task there. Blocks come from your accepted AI plans; untimed tasks fall on their due date.</p>';
      return html;
    },
    mount: function (root) {
      $$("[data-nav]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var dir = b.getAttribute("data-nav");
          var cur = cursor();
          if (dir === "today") state.cursor = P().today();
          else if (state.mode === "month") {
            var d = D.parse(cur);
            d.setMonth(d.getMonth() + (dir === "next" ? 1 : -1));
            state.cursor = D.toStr(d);
          } else if (state.mode === "week") state.cursor = D.addDays(cur, dir === "next" ? 7 : -7);
          else state.cursor = D.addDays(cur, dir === "next" ? 1 : -1);
          window.renderView();
        });
      });
      $$("[data-mode]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          state.mode = b.getAttribute("data-mode");
          window.renderView();
        });
      });
      var add = $("#cal-add", root);
      if (add) add.addEventListener("click", function () {
        P().openTask(null, { dueDate: cursor() });
      });
      $$(".cal-cell, .cal-slot", root).forEach(function (cell) {
        cell.addEventListener("click", function (e) {
          if (e.target.closest("[data-ev]")) return;
          var date = cell.getAttribute("data-date");
          if (date) P().openTask(null, { dueDate: date });
        });
      });
      $$("[data-ev]", root).forEach(function (chip) {
        chip.addEventListener("click", function (e) {
          e.stopPropagation();
          var id = chip.getAttribute("data-ev");
          var task = null;
          P().data.tasks.forEach(function (t) { if (t.id === id) task = t; });
          if (task) P().openTask(task);
          else UI.toast("That scheduled block's task no longer exists.", "error");
        });
      });
      var dayAdd = $("#day-add", root);
      if (dayAdd) dayAdd.addEventListener("click", function () {
        P().openTask(null, { dueDate: cursor() });
      });
      $$("[data-day-toggle]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-day-toggle");
          P().save(function (d) {
            d.tasks.forEach(function (t) {
              if (t.id !== id) return;
              var done = t.status === "completed";
              t.status = done ? "pending" : "completed";
              t.completedAt = done ? null : new Date().toISOString();
            });
          });
        });
      });
      $$("[data-day-edit]", root).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-day-edit");
          P().data.tasks.forEach(function (t) { if (t.id === id) P().openTask(t); });
        });
      });
    },
  };
})();
