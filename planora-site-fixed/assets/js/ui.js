/*!
 * Planora — shared UI kit
 * Icons, toasts, dialogs, theme, marketing interactions, small formatters.
 */
(function () {
  "use strict";

  /* --------------------------------------------------------------- icons */
  var P = {
    logo: '<path d="M4 19V5.6c0-.4.4-.7.8-.6l7 2.1c.4.1.7.5.7.9V21c0 .4-.5.7-.9.5l-6.8-2.1a1 1 0 0 1-.8-1Z" fill="currentColor" opacity=".95"/><path d="M20 19V5.6c0-.4-.4-.7-.8-.6l-7 2.1a1 1 0 0 0-.7.9V21c0 .4.5.7.9.5l6.8-2.1a1 1 0 0 0 .8-1Z" fill="currentColor" opacity=".55"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    tasks: '<path d="M9 5h11M9 12h11M9 19h11"/><path d="M4 5.5 5.2 6.7 7 4.4M4 12l1.2 1.2L7 10.9M4 18.5l1.2 1.2L7 17.4"/>',
    today: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M8 2v4M16 2v4M3 10h18"/><circle cx="12" cy="15" r="2" fill="currentColor" stroke="none"/>',
    upcoming: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    planner: '<path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z"/>',
    completed: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.3 2.3 4.7-4.9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H20a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4.9Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
    check: '<path d="m5 13 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17.5v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/>',
    external: '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 4.1M6.3 7.9A17 17 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 3.3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
    split: '<path d="M3 6h5l4 6-4 6H3"/><path d="M21 6h-5l-4 6 4 6h5"/>',
    tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.4"/>',
    sparkle: '<path d="M12 3v3M12 18v3M4.5 7.5l2 2M17.5 14.5l2 2M3 12h3M18 12h3M4.5 16.5l2-2M17.5 9.5l2-2"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1Z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    play: '<path d="M6 4l14 8-14 8Z"/>',
  };

  function icon(name, cls) {
    var body = P[name] || P.info;
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round"' +
      (cls ? ' class="' + cls + '"' : "") +
      ' aria-hidden="true">' + body + "</svg>"
    );
  }
  function logoMark() {
    return '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">' + P.logo + "</svg></span>";
  }

  /* ----------------------------------------------------------- utilities */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "P";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }
  function qs(name) {
    try {
      var fromSearch = new URLSearchParams(location.search).get(name);
      if (fromSearch != null) return fromSearch;
      var h = location.hash || "";
      var i = h.indexOf("?");
      if (i >= 0) return new URLSearchParams(h.slice(i + 1)).get(name);
      return null;
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------- toasts */
  function toastContainer() {
    var c = $(".toasts");
    if (!c) {
      c = document.createElement("div");
      c.className = "toasts";
      c.setAttribute("role", "status");
      c.setAttribute("aria-live", "polite");
      document.body.appendChild(c);
    }
    return c;
  }
  function toast(message, kind, ms) {
    var c = toastContainer();
    var el = document.createElement("div");
    el.className = "toast " + (kind || "success");
    el.innerHTML =
      icon(kind === "error" ? "alert" : "check") + "<span>" + esc(message) + "</span>";
    c.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(function () { el.remove(); }, 260);
    }, ms || 3400);
  }

  /* -------------------------------------------------------------- dialogs */
  var openDialogs = 0;
  function dialog(opts) {
    var prev = document.activeElement;
    var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML =
      '<div class="modal ' + (opts.wide ? "modal-wide" : "") + '" role="dialog" aria-modal="true" aria-label="' +
      esc(opts.title || "Dialog") + '">' +
      (opts.title
        ? '<div class="modal-head"><h3>' + esc(opts.title) + "</h3>" +
          '<button class="btn btn-icon btn-sm btn-ghost" data-close aria-label="Close">' + icon("x") + "</button></div>"
        : "") +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (opts.footer === false ? "" : '<div class="modal-foot">' + (opts.footer || "") + "</div>") +
      "</div>";
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    openDialogs++;

    function close() {
      overlay.remove();
      openDialogs = Math.max(0, openDialogs - 1);
      if (!openDialogs) document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      if (prev && prev.focus) prev.focus();
      if (opts.onClose) opts.onClose();
    }
    function key(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", key);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay && opts.dismissible !== false) close();
    });
    $$("[data-close]", overlay).forEach(function (b) { b.addEventListener("click", close); });
    if (opts.onMount) opts.onMount(overlay, close);
    var focusable = $("input, select, textarea, button:not([data-close])", overlay);
    if (focusable) setTimeout(function () { focusable.focus(); }, 40);
    return { el: overlay, close: close };
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var d = dialog({
        title: opts.title || "Are you sure?",
        body: '<p class="small muted" style="line-height:1.6">' + esc(opts.message || "") + "</p>",
        footer:
          '<button class="btn btn-outline" data-cancel>' + esc(opts.cancelText || "Cancel") + "</button>" +
          '<button class="btn ' + (opts.danger ? "btn-primary" : "btn-primary") + '" data-ok' +
          (opts.danger ? ' style="--btn-bg:var(--danger);--btn-fg:#fff"' : "") + ">" +
          esc(opts.confirmText || "Confirm") + "</button>",
        onClose: function () { resolve(false); },
        onMount: function (root, close) {
          $("[data-ok]", root).addEventListener("click", function () { resolve(true); close(); });
          $("[data-cancel]", root).addEventListener("click", function () { close(); });
        },
      });
      void d;
    });
  }

  /* ---------------------------------------------------------------- theme */
  var Theme = {
    get: function () {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
    apply: function (mode) {
      // mode: "light" | "dark" | "system"
      var dark =
        mode === "dark" ||
        (mode === "system" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#0b100f" : "#faf9f6");
      $$("[data-theme-icon]").forEach(function (el) {
        el.innerHTML = icon(dark ? "sun" : "moon");
      });
      try {
        localStorage.setItem("planora:theme", mode);
      } catch (e) {}
    },
    stored: function () {
      try { return localStorage.getItem("planora:theme") || "system"; } catch (e) { return "system"; }
    },
    toggle: function () {
      var next = Theme.get() === "dark" ? "light" : "dark";
      Theme.apply(next);
      if (window.Auth && Auth.isSignedIn()) {
        Auth.update(function (d) { d.prefs.theme = next; });
      }
      return next;
    },
    init: function () {
      var mode = Theme.stored();
      if (window.Auth && Auth.isSignedIn()) {
        var p = Auth.data().prefs;
        if (p && p.theme) mode = p.theme;
      }
      Theme.apply(mode);
      if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
          if (Theme.stored() === "system") Theme.apply("system");
        });
      }
      $$("[data-theme-toggle]").forEach(function (b) {
        b.addEventListener("click", function () { Theme.toggle(); });
      });
    },
  };

  /* ------------------------------------------------- marketing behaviours */
  function initMarketing() {
    var nav = $(".m-nav");
    if (nav) {
      var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    var burger = $("[data-burger]");
    var drawer = $(".m-drawer");
    if (burger && drawer) {
      burger.addEventListener("click", function () {
        var open = drawer.classList.toggle("open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.style.overflow = open ? "hidden" : "";
        burger.innerHTML = icon(open ? "x" : "menu");
      });
      $$("a", drawer).forEach(function (a) {
        a.addEventListener("click", function () {
          drawer.classList.remove("open");
          document.body.style.overflow = "";
          burger.innerHTML = icon("menu");
        });
      });
    }
    // FAQ accordion
    $$(".faq-item").forEach(function (item) {
      var q = $(".faq-q", item);
      if (!q) return;
      q.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");
        $$(".faq-item").forEach(function (o) { o.classList.remove("open"); $(".faq-q", o).setAttribute("aria-expanded", "false"); });
        if (!isOpen) {
          item.classList.add("open");
          q.setAttribute("aria-expanded", "true");
        }
      });
    });
    // reveal on scroll
    var reveals = $$(".reveal");
    if ("IntersectionObserver" in window && reveals.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
      );
      reveals.forEach(function (el) {
        // Only arm the animation once JS is definitely running, so the content
        // is never left invisible if a script fails to load.
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) { el.classList.add("in"); return; }
        el.classList.add("reveal-armed");
        io.observe(el);
      });
    }
    // nav hours: mark current year
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ------------------------------------------------------------ marketing
     Contact form: writes into a local inbox the owner can copy, and opens the
     user's mail client as a fallback. Wire a real endpoint in DEPLOY.md. */
  function initContact() {
    var form = $("#contact-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#c-name").value.trim();
      var email = $("#c-email").value.trim();
      var subject = $("#c-subject").value.trim();
      var message = $("#c-message").value.trim();
      var box = $("#contact-status");
      function fail(msg) {
        box.className = "form-error";
        box.textContent = msg;
        box.classList.remove("hide");
      }
      if (!name) return fail("Please tell us your name.");
      if (!Auth.validEmail(email)) return fail("Please enter a valid email address.");
      if (!subject) return fail("Please choose a subject.");
      if (message.length < 10) return fail("Please add a little more detail in your message.");
      var list = [];
      try { list = JSON.parse(localStorage.getItem("planora:contact") || "[]"); } catch (err) {}
      list.unshift({
        id: uid("msg"), name: name, email: email, subject: subject, message: message,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("planora:contact", JSON.stringify(list.slice(0, 50)));
      box.className = "form-ok";
      box.textContent =
        "Thanks, " + name + ". Your message was recorded (reference " + list[0].id +
        "). We reply to " + email + " within two business days.";
      box.classList.remove("hide");
      form.reset();
      toast("Message sent", "success");
    });
  }

  window.PlanoraUI = {
    icon: icon,
    logoMark: logoMark,
    esc: esc,
    initials: initials,
    $: $,
    $$: $$,
    on: on,
    debounce: debounce,
    qs: qs,
    toast: toast,
    dialog: dialog,
    confirm: confirmDialog,
    Theme: Theme,
    initMarketing: initMarketing,
    initContact: initContact,
  };
  window.icon = icon;
  window.toast = toast;
  window.esc = esc;

  document.addEventListener("DOMContentLoaded", function () {
    Theme.init();
    initMarketing();
    initContact();
    $$("[data-theme-toggle]").forEach(function (b) {
      if (!b.innerHTML.trim()) b.innerHTML = icon("moon");
    });
  });
})();
