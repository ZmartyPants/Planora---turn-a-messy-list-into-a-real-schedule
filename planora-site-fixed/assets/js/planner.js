/*!
 * Planora — planning engine
 * ---------------------------------------------------------------------------
 * Two real, deterministic systems (no canned responses):
 *
 *  1. parseTasks(text)  — turns free text into structured tasks: titles, due
 *     dates, durations, priorities and categories, with the matched phrase
 *     reported so the user can see why a value was inferred.
 *
 *  2. schedule(...)     — a deadline-and-priority aware time-boxing scheduler.
 *     It packs every task into the user's available windows, respects existing
 *     commitments and daily capacity, inserts breaks, splits long tasks across
 *     days, and reports honestly when work does not fit.
 *
 * If window.PLANORA_CONFIG.ai.endpoint is set, the same shapes are produced by
 * your own LLM proxy instead; see DEPLOY.md → "Optional: connect an LLM".
 */
(function () {
  "use strict";

  var D = window.PDate;

  var WEEKDAYS = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];
  var WEEKDAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  var WORD_NUM = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
    "a": 1, "an": 1,
  };

  var CATEGORY_RULES = [
    { cat: "Study", re: /\b(assignment|homework|essay|revise|revision|study|studying|exam|test|course|lecture|math|maths|science|chemistry|physics|biology|java|python|code|coding|project report|thesis|dissertation|reading)\b/i },
    { cat: "Work", re: /\b(presentation|slide|deck|report|email|meeting|client|invoice|proposal|standup|sprint|ticket|review|interview|deadline|boss|manager|spreadsheet)\b/i },
    { cat: "Home", re: /\b(clean|cleaning|laundry|dishes|room|house|grocer|shopping|tidy|vacuum|kitchen|garden|repair)\b/i },
    { cat: "Health", re: /\b(gym|workout|run|running|jog|yoga|doctor|dentist|walk|exercise|swim|meditat)\b/i },
    { cat: "Personal", re: /\b(call|phone|bank|bill|pay|appointment|birthday|gift|book|renew|renewal|tax)\b/i },
  ];
  var DEFAULT_DURATION = { Study: 60, Work: 45, Home: 30, Health: 45, Personal: 20, General: 30 };

  function cap(s) {
    s = String(s || "").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function round15(m) { return Math.max(15, Math.round(m / 15) * 15); }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  /* ====================================================== TEXT PARSING ==== */

  function splitClauses(text) {
    var cleaned = String(text || "")
      .replace(/\r/g, "")
      .replace(/\band then\b/gi, "\u0001")
      .replace(/\balso\b/gi, "\u0001")
      .replace(/\bthen\b/gi, "\u0001")
      .replace(/\s*[;\u2022]\s*/g, "\u0001")
      .replace(/\s*\n+\s*/g, "\u0001")
      .replace(/\s*[,]\s*/g, "\u0001")
      .replace(/\s+and\s+(?=(i\s+|then\s+)?(need|have|want|must|should|finish|do|study|prep|prepare|clean|call|send|buy|pay|write|read|revise|book|make|fix|organise|organize|plan|review|submit|email|attend|go|gym|run|laundry|tidy|file|renew)\b)/gi, "\u0001");

    var raw = cleaned
      .split("\u0001")
      .map(function (s) { return s.trim().replace(/^[,.;:\s]+/, "").replace(/[,.;:\s]+$/, ""); })
      .filter(function (s) { return s.length > 1; });

    // A comma can separate a task from its own duration ("Report on Friday, 2 hours").
    // Re-attach fragments that carry no verb: durations, priorities, bare dates.
    var FRAGMENT = /^(\d+(?:[.,]\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s*(?:hours?|minutes?|mins?)|half an hour|urgent|asap|immediately|high priority|low priority|medium priority|important|by (?:today|tomorrow|\w+day)|today|tomorrow|tonight|next week|this weekend)$/i;
    var out = [];
    raw.forEach(function (clause) {
      var words = clause.split(/\s+/).filter(Boolean);
      var isFragment = FRAGMENT.test(clause) || words.length <= 2 && !/\b(finish|do|study|prep|prepare|clean|call|send|buy|pay|write|read|revise|book|make|fix|plan|review|submit|email|attend|go|run|tidy|renew|file|gym|laundry|dishes|shopping|exercise|workout)\b/i.test(clause);
      if (isFragment && out.length) {
        out[out.length - 1] = out[out.length - 1] + ", " + clause;
      } else if (clause.length > 1) {
        out.push(clause);
      }
    });
    return out;
  }

  function parseDuration(clause) {
    var m,
      text = clause.toLowerCase();
    if ((m = text.match(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h)\b/))) {
      return { minutes: round15(parseFloat(m[1].replace(",", ".")) * 60), match: m[0] };
    }
    if ((m = text.match(/(\d+)\s*(minutes?|mins?|mins|m)\b/))) {
      return { minutes: clamp(round15(parseInt(m[1], 10)), 15, 720), match: m[0] };
    }
    if ((m = text.match(/\bhalf an hour\b/))) return { minutes: 30, match: m[0] };
    if ((m = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(hours?|hrs?)/))) {
      return { minutes: WORD_NUM[m[1]] * 60, match: m[0] };
    }
    if ((m = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s+(minutes?|mins?)/))) {
      return { minutes: WORD_NUM[m[1]], match: m[0] };
    }
    return null;
  }

  function parsePriority(clause) {
    var t = clause.toLowerCase();
    if (/\b(urgent|asap|critical|immediately|very important|top priority|must)\b/.test(t))
      return { priority: "high", match: (t.match(/\b(urgent|asap|critical|immediately|very important|top priority)\b/) || ["urgent"])[0] };
    if (/\b(low priority|when i can|eventually|someday|if time|whenever|optional|nice to have)\b/.test(t))
      return { priority: "low", match: (t.match(/\b(low priority|when i can|eventually|someday|if time|whenever|optional)\b/) || ["low priority"])[0] };
    return null;
  }

  function parseDeadline(clause, today) {
    var t = clause.toLowerCase(), m;

    if (/\b(day after tomorrow)\b/.test(t))
      return { date: D.addDays(today, 2), match: "day after tomorrow", hard: true };
    if (/\btoday\b|\btonight\b|\bby end of day\b|\beod\b/.test(t))
      return { date: today, match: (t.match(/\btoday\b|\btonight\b|\bby end of day\b|\beod\b/) || ["today"])[0], hard: true };
    if (/\btomorrow\b/.test(t))
      return { date: D.addDays(today, 1), match: "tomorrow", hard: true };

    if ((m = t.match(/\b(?:by|due|before|until|on|for|this coming)\s+(?:next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/))) {
      var idx = WEEKDAYS.indexOf(m[1]) >= 0 ? WEEKDAYS.indexOf(m[1]) : WEEKDAY_ABBR.indexOf(m[1].slice(0, 3));
      if (idx < 0) idx = WEEKDAY_ABBR.indexOf(m[1].slice(0, 3));
      var cur = D.weekday(today);
      var delta = (idx - cur + 7) % 7;
      if (delta === 0) delta = 7;
      return { date: D.addDays(today, delta), match: m[0], hard: true };
    }
    if ((m = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
      var i2 = WEEKDAYS.indexOf(m[1]);
      var c2 = D.weekday(today);
      var d2 = (i2 - c2 + 7) % 7;
      if (d2 === 0) d2 = 7;
      return { date: D.addDays(today, d2), match: m[0], hard: false };
    }
    if ((m = t.match(/\bin\s+(a|an|\d+)\s*(day|days|week|weeks)\b/))) {
      var n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
      var days = /week/.test(m[2]) ? n * 7 : n;
      return { date: D.addDays(today, days), match: m[0], hard: true };
    }
    if (/\bnext week\b/.test(t)) return { date: D.addDays(today, 7), match: "next week", hard: false };
    if (/\bthis weekend\b|\bweekend\b/.test(t)) {
      var satIdx = 6;
      var c3 = D.weekday(today);
      var d3 = (satIdx - c3 + 7) % 7 || 7;
      return { date: D.addDays(today, d3), match: "weekend", hard: false };
    }
    if ((m = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/))) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      var day, month;
      if (a > 12) { day = a; month = b; } else if (b > 12) { month = a; day = b; } else { day = a; month = b; }
      var yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : parseInt(today.slice(0, 4), 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        var iso = yr + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        if (D.diffDays(today, iso) < -180) iso = yr + 1 + iso.slice(4);
        return { date: iso, match: m[0], hard: true };
      }
    }
    if ((m = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b/))) {
      var midx = MONTHS.findIndex(function (mo) { return mo.indexOf(m[1]) === 0; });
      if (midx < 0) midx = MONTHS.findIndex(function (mo) { return m[1].indexOf(mo.slice(0, 3)) === 0; });
      var dd = String(parseInt(m[2], 10)).padStart(2, "0");
      var iso2 = today.slice(0, 4) + "-" + String(midx + 1).padStart(2, "0") + "-" + dd;
      if (D.diffDays(today, iso2) < 0) iso2 = parseInt(today.slice(0, 4), 10) + 1 + iso2.slice(4);
      return { date: iso2, match: m[0], hard: true };
    }
    if ((m = t.match(/\bby the (\d{1,2})(?:st|nd|rd|th)\b/))) {
      var dd2 = String(parseInt(m[1], 10)).padStart(2, "0");
      var iso3 = today.slice(0, 7) + "-" + dd2;
      if (D.diffDays(today, iso3) < 0) {
        var nextMonth = new Date(parseInt(today.slice(0, 4), 10), parseInt(today.slice(5, 7), 10), 1);
        iso3 = D.toStr(nextMonth).slice(0, 7) + "-" + dd2;
      }
      return { date: iso3, match: m[0], hard: true };
    }
    return null;
  }

  function parseCategory(clause) {
    for (var i = 0; i < CATEGORY_RULES.length; i++) {
      if (CATEGORY_RULES[i].re.test(clause)) return CATEGORY_RULES[i].cat;
    }
    return "General";
  }

  var STRIP_PATTERNS = [
    /^\s*(i\s+)?(really\s+)?(need|have|want|must|should|plan|would like)\s+to\s+/i,
    /^\s*(i\s+)?(need|have|got)\s+(a|an|to)\s+/i,
    /\b(by|due|before|until|on|for)\s+(next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tomorrow|today|tonight|the \d{1,2}(?:st|nd|rd|th)|next week|the weekend)\b/gi,
    /^\s*(and|then|also)\s+/i,
    /\b(today|tonight|tomorrow|asap|urgent|immediately|eventually|someday|whenever|low priority|this weekend|next week)\b/gi,
    /\b(in\s+(a|an|\d+)\s*(day|days|week|weeks))\b/gi,
    /\b(\d+(?:[.,]\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m))\b/gi,
    /\b((one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(hours?|minutes?|mins?))\b/gi,
    /\bhalf an hour\b/gi,
    /\b(that|which)\b/gi,
    /\bplease\b/gi,
  ];

  function cleanTitle(clause) {
    var t = clause;
    STRIP_PATTERNS.forEach(function (re) { t = t.replace(re, " "); });
    t = t
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,.\-–—:;]+/, "")
      .replace(/[\s,.\-–—:;]+$/, "")
      .replace(/\s+(and|then|for|by|on|at|from|of)$/i, "")
      .replace(/\s+for$/i, "")
      .replace(/^(the|a|an)\s+/i, "")
      .trim();
    if (t.length < 2) t = clause.replace(/\s+/g, " ").trim();
    if (t.length > 90) t = t.slice(0, 88).trim() + "…";
    return cap(t);
  }

  function parseTasks(text, opts) {
    opts = opts || {};
    var today = opts.today || D.today(opts.tz);
    var clauses = splitClauses(text);
    var out = [];
    var seen = {};

    clauses.forEach(function (clause) {
      var dl = parseDeadline(clause, today);
      var du = parseDuration(clause);
      var pr = parsePriority(clause);
      var cat = parseCategory(clause);
      var title = cleanTitle(clause);
      if (!title || title.length < 2) return;
      var key = title.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;

      var reasons = [];
      if (dl) reasons.push('deadline "' + dl.match + '"');
      if (du) reasons.push('duration "' + du.match + '"');
      if (pr) reasons.push('priority "' + pr.match + '"');

      out.push({
        id: null,
        title: title,
        description: "",
        dueDate: dl ? dl.date : null,
        dueInferred: !!dl && !dl.hard,
        priority: pr ? pr.priority : opts.defaultPriority || "medium",
        estimatedMinutes: du ? du.minutes : DEFAULT_DURATION[cat] || 30,
        category: cat,
        status: "pending",
        notes: "",
        _source: clause,
        _reasons: reasons,
      });
    });

    return {
      tasks: out,
      notes: out.length
        ? []
        : ["We couldn't pick out any tasks from that. Try listing them one per line, for example: “Finish the maths assignment by Wednesday, 90 minutes”."],
    };
  }

  /* ========================================================= SCHEDULER ==== */

  function eachDate(from, to) {
    var list = [];
    var cur = from;
    var guard = 0;
    while (guard++ < 400) {
      list.push(cur);
      if (cur === to) break;
      cur = D.addDays(cur, 1);
    }
    return list;
  }

  function toMin(clock) {
    if (typeof clock === "number") return clock;
    return D.parseClock(clock);
  }
  function toClock(mins) { return D.clock(mins, "24"); }

  function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

  function schedule(opts) {
    var tasks = (opts.tasks || []).filter(function (t) { return t.status !== "completed"; });
    var prefs = opts.prefs || {};
    var today = opts.startDate || D.today(prefs.timezone);
    var workStart = toMin(opts.workStart != null ? opts.workStart : prefs.workStart) || 9 * 60;
    var workEnd = toMin(opts.workEnd != null ? opts.workEnd : prefs.workEnd) || 18 * 60;
    var breakEvery = clamp(prefs.breakEvery || 90, 30, 300);
    var breakMinutes = clamp(prefs.breakMinutes == null ? 15 : prefs.breakMinutes, 0, 60);
    var dailyCapacity = clamp(
      opts.dailyCapacity != null ? opts.dailyCapacity : prefs.dailyCapacity || 240,
      30, 960
    );
    var workdays = opts.workdays || prefs.workdays || [1, 2, 3, 4, 5];
    var unavailable = opts.unavailableDays || [];
    var commitments = (opts.commitments || []).slice();

    if (workEnd - workStart < 30) workEnd = workStart + 30;

    /* horizon: far enough to cover the last deadline, at least a week */
    var lastDeadline = today;
    tasks.forEach(function (t) {
      if (t.dueDate && D.diffDays(today, t.dueDate) > D.diffDays(today, lastDeadline)) lastDeadline = t.dueDate;
    });
    var horizonEnd = D.addDays(lastDeadline, 0);
    if (D.diffDays(today, horizonEnd) < 6) horizonEnd = D.addDays(today, 6);
    if (D.diffDays(today, horizonEnd) > 30) horizonEnd = D.addDays(today, 30);
    var dates = eachDate(today, horizonEnd);

    /* per-day state */
    var dayState = {};
    dates.forEach(function (d) {
      dayState[d] = {
        date: d,
        isWorkday: workdays.indexOf(D.weekday(d)) >= 0,
        blocked: unavailable.indexOf(d) >= 0,
        busy: [],
        elapsed: 0,
        continuous: 0,
        slots: [],
      };
    });

    commitments.forEach(function (c) {
      var d = c.date;
      if (!dayState[d]) return;
      var s = toMin(c.start), e = toMin(c.end);
      if (s == null || e == null || e <= s) return;
      dayState[d].busy.push([s, e]);
      dayState[d].slots.push({
        date: d, kind: "commitment", title: c.title || "Commitment",
        start: s, end: e, taskId: null,
      });
    });

    function dayWindow(ds) {
      if (ds.blocked || !ds.isWorkday) return null;
      return [workStart, Math.min(workEnd, workStart + dailyCapacity * 2)];
    }

    function findSlot(ds, duration) {
      var win = dayWindow(ds);
      if (!win) return null;
      if (ds.elapsed + duration > dailyCapacity) return null;
      var needBreak = breakMinutes > 0 && ds.continuous >= breakEvery;
      var firstStart = win[0] + (needBreak ? breakMinutes : 0);
      var step = 15;
      for (var start = firstStart; start + duration <= win[1]; start += step) {
        var end = start + duration;
        var free = true;
        for (var i = 0; i < ds.busy.length; i++) {
          if (overlap(start, end, ds.busy[i][0], ds.busy[i][1])) { free = false; break; }
        }
        // A break has to fit immediately before the block we are about to add.
        if (free && needBreak) {
          for (var b = 0; b < ds.busy.length; b++) {
            if (overlap(start - breakMinutes, start, ds.busy[b][0], ds.busy[b][1])) { free = false; break; }
          }
        }
        if (free) {
          return {
            start: start,
            end: end,
            breakBefore: needBreak ? { start: start - breakMinutes, end: start } : null,
          };
        }
      }
      return null;
    }

    function addBusy(ds, s, e) { ds.busy.push([s, e]); }

    /* ordering: overdue → nearest deadline → priority → longest */
    var ordered = tasks.slice().sort(function (a, b) {
      var ad = a.dueDate || horizonEnd, bd = b.dueDate || horizonEnd;
      var aOver = D.diffDays(ad, today) > 0 ? 1 : 0; // due before today
      var bOver = D.diffDays(bd, today) > 0 ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      var dd = D.diffDays(ad, bd);
      if (dd !== 0) return dd;
      var pr = window.TaskModel.priorityRank(a.priority) - window.TaskModel.priorityRank(b.priority);
      if (pr !== 0) return pr;
      return (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0);
    });

    var unscheduled = [];
    var placedMinutes = 0;

    ordered.forEach(function (task) {
      var duration = round15(task.estimatedMinutes || 30);
      var deadline = task.dueDate || horizonEnd;
      var startFrom = today;
      var candidateDates = dates.filter(function (d) {
        return D.diffDays(d, deadline) >= 0 && D.diffDays(startFrom, d) >= 0;
      });
      if (!candidateDates.length) candidateDates = dates.slice();

      /* split work at the user's break rhythm so no block outruns it */
      var chunkLimit = Math.min(180, Math.max(60, breakEvery));
      var parts = [];
      var remaining = duration;
      while (remaining > 0) {
        var chunk = remaining > chunkLimit ? chunkLimit : remaining;
        parts.push(round15(chunk));
        remaining -= chunk;
        if (remaining > 0 && remaining < 30) { /* merge sliver */ }
      }

      var placedAny = false;
      for (var p = 0; p < parts.length; p++) {
        var placed = false;
        for (var di = 0; di < candidateDates.length && !placed; di++) {
          var ds = dayState[candidateDates[di]];
          if (!ds) continue;
          var slot = findSlot(ds, parts[p]);
          if (!slot) continue;

          if (slot.breakBefore) {
            addBusy(ds, slot.breakBefore.start, slot.breakBefore.end);
            ds.slots.push({
              date: ds.date, kind: "break", title: "Break",
              start: slot.breakBefore.start, end: slot.breakBefore.end, taskId: null,
            });
            ds.elapsed += breakMinutes;
            ds.continuous = 0;
          }

          addBusy(ds, slot.start, slot.end);
          ds.elapsed += parts[p];
          ds.continuous += parts[p];
          placedMinutes += parts[p];
          ds.slots.push({
            date: ds.date,
            kind: "task",
            taskId: task.id,
            title: task.title + (parts.length > 1 ? " (part " + (p + 1) + "/" + parts.length + ")" : ""),
            parentTitle: task.title,
            start: slot.start,
            end: slot.end,
            minutes: parts[p],
            part: parts.length > 1 ? p + 1 : 0,
            parts: parts.length,
            priority: task.priority,
            category: task.category,
            deadline: task.dueDate,
          });
          placed = true;
          placedAny = true;
        }
        if (!placed) {
          unscheduled.push({
            taskId: task.id,
            title: task.title + (parts.length > 1 ? " (part " + (p + 1) + ")" : ""),
            minutes: parts[p],
            deadline: task.dueDate,
            reason: reasonFor(task, deadline, today, dailyCapacity, workdays, workStart, workEnd),
          });
          break;
        }
      }
      void placedAny;
    });

    /* results */
    var days = dates.map(function (d) {
      var ds = dayState[d];
      var work = ds.slots.filter(function (s) { return s.kind === "task"; });
      var breaks = ds.slots.filter(function (s) { return s.kind === "break"; });
      return {
        date: d,
        availableMinutes: ds.blocked || !ds.isWorkday ? 0 : Math.max(0, Math.min(workEnd, workStart + dailyCapacity) - workStart),
        scheduledMinutes: work.reduce(function (s, x) { return s + (x.minutes || 0); }, 0),
        breakMinutes: breaks.reduce(function (s, x) { return s + (x.end - x.start); }, 0),
        slots: ds.slots.sort(function (a, b) { return a.start - b.start; }),
        isWorkday: ds.isWorkday,
      };
    });

    /* conflicts */
    var conflicts = [];
    tasks.forEach(function (t) {
      if (t.dueDate && D.diffDays(t.dueDate, today) > 0) {
        conflicts.push({
          type: "overdue",
          taskId: t.id,
          title: t.title,
          message: "“" + t.title + "” was due " + Math.abs(D.diffDays(t.dueDate, today)) +
            " day(s) ago. It is scheduled as early as possible — move the deadline if that is not realistic.",
        });
      }
    });
    Object.keys(dayState).forEach(function (d) {
      var ds = dayState[d];
      var load = ds.slots.filter(function (s) { return s.kind === "task"; })
        .reduce(function (s, x) { return s + (x.minutes || 0); }, 0);
      if (load > 300) {
        conflicts.push({
          type: "overload",
          date: d,
          message: D.prettyLong(d) + " holds " + D.duration(load) + " of focused work, which is a lot for one day.",
        });
      }
    });
    unscheduled.forEach(function (u) {
      if (u.deadline) {
        conflicts.push({
          type: "does_not_fit",
          taskId: u.taskId,
          message: "“" + u.title + "” could not be placed before its deadline (" + D.relative(u.deadline, prefs.timezone) + ").",
        });
      }
    });

    var scheduledDates = days.filter(function (d) { return d.scheduledMinutes > 0; });

    return {
      engine: opts.engine || "built-in",
      generatedAt: new Date().toISOString(),
      startDate: today,
      endDate: horizonEnd,
      days: days,
      unscheduled: unscheduled,
      conflicts: conflicts,
      constraints: {
        workStart: workStart,
        workEnd: workEnd,
        dailyCapacity: dailyCapacity,
        workdays: workdays,
        breakEvery: breakEvery,
        breakMinutes: breakMinutes,
        unavailableDays: unavailable,
        commitments: commitments,
      },
      stats: {
        totalTasks: tasks.length,
        scheduledTasks: tasks.length - unscheduled.length,
        unscheduledTasks: unscheduled.length,
        totalMinutes: placedMinutes,
        daysNeeded: scheduledDates.length,
        conflicts: conflicts.length,
        utilization: days.reduce(function (s, d) { return s + d.availableMinutes; }, 0)
          ? Math.round(
              (placedMinutes /
                days.reduce(function (s, d) { return s + d.availableMinutes; }, 0)) * 100
            )
          : 0,
      },
    };
  }

  function reasonFor(task, deadline, today, dailyCapacity, workdays, workStart, workEnd) {
    if (task.dueDate && D.diffDays(task.dueDate, today) > 0)
      return "The deadline is already in the past, so there was no room before it.";
    var freeing = "Increase your daily capacity, use more working days, or move the deadline.";
    if (task.estimatedMinutes > dailyCapacity)
      return "It needs " + D.duration(task.estimatedMinutes) + ", more than your daily capacity of " +
        D.duration(dailyCapacity) + ". " + freeing;
    return "Every workday before the deadline is already full. " + freeing +
      " Window used: " + D.clock(workStart, "24") + "–" + D.clock(workEnd, "24") +
      ", workdays " + workdays.map(function (w) { return WEEKDAY_ABBR[w]; }).join(", ") + ".";
  }

  /* ------------------------------------------------------- recommendations */
  function recommend(plan, tasks, prefs) {
    var recs = [];
    var today = D.today(prefs && prefs.timezone);
    var byId = {};
    tasks.forEach(function (t) { byId[t.id] = t; });

    var urgent = tasks.filter(function (t) {
      return t.status !== "completed" && t.dueDate && D.diffDays(today, t.dueDate) <= 2 && D.diffDays(today, t.dueDate) >= 0;
    });
    if (urgent.length) {
      recs.push({
        kind: "warn",
        title: "Due within 48 hours",
        body: urgent.slice(0, 3).map(function (t) { return "“" + t.title + "”"; }).join(", ") +
          (urgent.length > 3 ? " and " + (urgent.length - 3) + " more" : "") +
          (urgent.length === 1 ? " is scheduled first." : " are scheduled first."),
      });
    }
    var overdue = tasks.filter(function (t) {
      return t.status !== "completed" && t.dueDate && D.diffDays(t.dueDate, today) > 0;
    });
    if (overdue.length) {
      recs.push({
        kind: "danger",
        title: overdue.length + " task" + (overdue.length > 1 ? "s are" : " is") + " past its deadline",
        body: "Either move the deadline to something realistic or drop it. Overdue items quietly distort every plan you make.",
      });
    }
    if (plan.unscheduled.length) {
      recs.push({
        kind: "danger",
        title: "Not everything fits",
        body: plan.unscheduled.length + " block" + (plan.unscheduled.length > 1 ? "s" : "") +
          " could not be placed (" + D.duration(plan.unscheduled.reduce(function (s, u) { return s + u.minutes; }, 0)) +
          " of work). Extend the deadline, free up a day, or reduce the estimate — the plan does not pretend otherwise.",
      });
    }
    var heavy = plan.days.filter(function (d) { return d.scheduledMinutes >= 240; });
    if (heavy.length) {
      recs.push({
        kind: "info",
        title: "Front-loaded days",
        body: heavy.map(function (d) { return D.pretty(d.date, { weekday: "short", day: "numeric" }); }).join(", ") +
          " carry four hours or more. Protect those blocks and turn off notifications while you work.",
      });
    }
    var longOnes = tasks.filter(function (t) {
      return t.status !== "completed" && (t.estimatedMinutes || 0) >= 150;
    });
    if (longOnes.length) {
      recs.push({
        kind: "info",
        title: "Consider splitting",
        body: longOnes
          .slice(0, 3)
          .map(function (t) { return "“" + t.title + "” (" + D.duration(t.estimatedMinutes) + ")"; })
          .join(", ") + " — long single blocks are where plans usually break. Two or three shorter sittings survive contact with a real week.",
      });
    }
    var flexible = tasks.filter(function (t) { return !t.dueDate; });
    if (flexible.length) {
      recs.push({
        kind: "info",
        title: "Tasks without a deadline",
        body: flexible.length + " task" + (flexible.length > 1 ? "s have" : " has") +
          " no due date, so " + (flexible.length > 1 ? "they were" : "it was") +
          " placed in the earliest free time. Adding even an approximate date makes the plan much more useful.",
      });
    }
    if (!recs.length) {
      recs.push({
        kind: "info",
        title: "Balanced plan",
        body: "Workload is spread evenly and nothing is past its deadline. Re-check this plan when something new lands.",
      });
    }
    return recs;
  }

  /* ------------------------------------------------------------ revision */
  /**
   * Interprets short instructions such as "make Wednesday less busy",
   * "move Java revision to Thursday", "I only have two hours tomorrow",
   * "don't schedule anything on Saturday".
   */
  function revise(opts) {
    var text = String(opts.command || "").toLowerCase();
    var plan = opts.plan;
    var tasks = opts.tasks;
    var prefs = opts.prefs;
    var today = D.today(prefs.timezone);
    var constraints = Object.assign({}, plan.constraints);
    var notes = [];
    var taskOverrides = {};

    var wd = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/);
    var weekdayIdx = null;
    if (wd) {
      weekdayIdx = WEEKDAYS.indexOf(wd[1]);
      if (weekdayIdx < 0) weekdayIdx = WEEKDAY_ABBR.indexOf(wd[1].slice(0, 3));
    }
    function nextDateFor(idx) {
      var delta = (idx - D.weekday(today) + 7) % 7;
      if (delta === 0) delta = 7;
      return D.addDays(today, delta);
    }

    /* 1. availability change: "only two hours tomorrow" */
    var durMatch = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/) || text.match(/(\w+)\s+hours?\b/);
    var wantsLess = /\b(less busy|lighter|light|free up|easier|reduce|only have|less time|fewer|half)\b/.test(text);
    var wantsMore = /\b(more time|busy|fill|pack|earlier)\b/.test(text);

    if (plan && wd && (wantsLess || wantsMore) && /\b(busy|lighter|light|free|less|time|hours?|day)\b/.test(text)) {
      var target = nextDateFor(weekdayIdx);
      if (!constraints.unavailableDays) constraints.unavailableDays = [];
      if (wantsLess && !durMatch) {
        constraints.unavailableDays = constraints.unavailableDays.concat([target]);
        notes.push("Held " + D.prettyLong(target) + " clear and rebuilt the plan around it.");
      } else {
        var hours = 2;
        if (durMatch) {
          hours = durMatch[2] && /hour|hr|^h$/.test(durMatch[2])
            ? parseFloat(durMatch[1])
            : (WORD_NUM[durMatch[1]] || 2);
        }
        if (wantsLess) {
          constraints.dailyCapacity = Math.max(30, Math.min(constraints.dailyCapacity, hours * 60));
          notes.push("Capped focused work at " + hours + "h per day and rebuilt the plan.");
        }
      }
    } else if (durMatch && /\b(hours?|hrs?)\b/.test(text) && (wantsLess || /\bonly\b/.test(text))) {
      var hrs = /^\d/.test(durMatch[1])
        ? parseFloat(durMatch[1])
        : (WORD_NUM[durMatch[1]] || 2);
      constraints.dailyCapacity = Math.max(30, hrs * 60);
      notes.push("Capped focused work at " + hrs + "h per day.");
    }

    /* 2. "don't schedule on Saturday" */
    if (/\b(no|not|avoid|nothing|skip|don't|do not|cannot|can't|off)\b/.test(text) && wd && weekdayIdx != null) {
      constraints.workdays = (prefs.workdays || [1, 2, 3, 4, 5]).filter(function (w) { return w !== weekdayIdx; });
      notes.push(cap(WEEKDAYS[weekdayIdx]) + " removed from your working days.");
    }

    /* 3. move a specific task: "move java revision to thursday" */
    var moveMatch = text.match(/\b(?:move|shift|reschedule|push)\s+(.+?)\s+(?:to|onto|on)\s+(.+)$/);
    if (moveMatch && moveMatch[1]) {
      var needle = moveMatch[1].replace(/\b(the|my|task)\b/g, "").trim();
      var dl = parseDeadline("on " + moveMatch[2], today);
      var best = null;
      tasks.forEach(function (t) {
        var title = t.title.toLowerCase();
        if (!needle) return;
        if (title.indexOf(needle) >= 0 || needle.indexOf(title) >= 0) {
          if (!best || title.length < best.title.length) best = t;
        }
      });
      if (!best) {
        var words = needle.split(/\s+/).filter(function (w) { return w.length > 3; });
        tasks.forEach(function (t) {
          var title = t.title.toLowerCase();
          var hits = words.filter(function (w) { return title.indexOf(w) >= 0; }).length;
          if (hits && (!best || hits > best._hits)) { best = t; best._hits = hits; }
        });
      }
      if (best && dl) {
        taskOverrides[best.id] = { dueDate: dl.date };
        notes.push("Moved “" + best.title + "” to " + D.prettyLong(dl.date) + ".");
      } else if (!best) {
        notes.push("I couldn't match that task name. Try using a word from the task title.");
      }
    }

    var adjusted = tasks.map(function (t) {
      return taskOverrides[t.id] ? Object.assign({}, t, taskOverrides[t.id]) : t;
    });

    var next = schedule({
      tasks: adjusted,
      prefs: prefs,
      startDate: opts.startDate || today,
      engine: plan.engine,
      workStart: constraints.workStart,
      workEnd: constraints.workEnd,
      dailyCapacity: constraints.dailyCapacity,
      workdays: constraints.workdays,
      unavailableDays: constraints.unavailableDays,
      commitments: constraints.commitments,
    });

    if (!notes.length) {
      notes.push("No specific constraint detected, so I re-ran the optimiser against the same rules. Add detail like “make Wednesday lighter”, “only 2 hours tomorrow” or “move Java revision to Thursday”.");
    }

    return { plan: next, notes: notes, tasks: adjusted };
  }

  window.PlanoraPlanner = {
    parseTasks: parseTasks,
    schedule: schedule,
    recommend: recommend,
    revise: revise,
    parseDeadline: parseDeadline,
    DEFAULT_DURATION: DEFAULT_DURATION,
  };
})();
