# Planora

An AI-assisted task planner you can publish today: a full marketing site, a real
account system, a complete task manager, a calendar, and a premium AI Planner
that turns a paragraph of “everything I have to do” into a schedule that respects
your actual hours.

No build step. No framework. No `npm install`. Plain HTML, CSS and JavaScript —
upload the folder and it runs.

---

## 1. Publish it in five minutes

Pick any one of these. All three work with the files exactly as they are.

**Netlify (fastest)**
1. Go to <https://app.netlify.com/drop>.
2. Drag the whole `planora` folder onto the page.
3. You get a live URL immediately. Add your domain under *Domain settings*.

**Vercel**
```bash
npx vercel --prod        # run inside the planora folder
```

**GitHub Pages / cPanel / any static host**
Upload the contents of this folder to the web root. `index.html` is the entry
point. There is no server-side component to configure.

Before you tell anyone the URL, do these four things:

| # | What | Where |
|---|------|-------|
| 1 | Set your support email | `assets/js/config.js` → `supportEmail`, plus `contact.html` and `help.html` |
| 2 | Set your real domain | `sitemap.xml`, `robots.txt`, `assets/js/config.js` (`baseUrl` is optional) |
| 3 | Replace the OG image if you rebrand | `assets/img/og.png` (1200×630) |
| 4 | Read the three legal drafts and fill the bracketed placeholders | `privacy.html`, `terms.html`, `cookies.html` |

`netlify.toml`, `vercel.json` and `_headers` ship sane security headers and
clean-URL redirects (`/pricing` → `/pricing.html`). Delete the ones you do not use.

---

## 2. What is in the box

```
planora/
├── index.html              landing page (hero, benefits, features, how it works, AI, pricing, FAQ)
├── features.html           full feature inventory + “what's included”
├── pricing.html            plan comparison, billing explanation, pricing FAQ
├── ai-planner.html         how the planner works, what it optimises for, what it refuses to do
├── faq.html                9 questions, FAQPage structured data
├── about.html   contact.html   help.html   404.html
├── privacy.html  terms.html  cookies.html   policy drafts, clearly marked for review
├── login.html  signup.html  forgot-password.html  reset-password.html  verify-email.html
├── app.html                the application shell (hash-routed, no server needed)
├── assets/css/styles.css   complete design system, light + dark
├── assets/js/
│   ├── config.js           ← the only file you normally edit
│   ├── storage.js          data layer + date/timezone utilities
│   ├── auth.js             accounts, sessions, verification, password reset, subscription
│   ├── ui.js               icons, toasts, dialogs, theme, marketing interactions
│   ├── planner.js          natural-language parser + scheduling engine  ← the premium feature
│   ├── app.js              router, dashboard, tasks, today, upcoming, completed, notifications
│   ├── calendar.js         month / week / day views
│   ├── planview.js         AI Planner UI (extract → review → generate → revise → accept)
│   ├── settings.js         settings, billing, onboarding
│   └── auth-pages.js       sign-up / login / reset / verify behaviour
├── robots.txt  sitemap.xml  _headers  netlify.toml  vercel.json
└── DEPLOY.md               wiring real email, payments, AI and a hosted database
```

### The product, feature by feature

**Public site** — marketing pages, SEO metadata, Open Graph, JSON-LD
(`SoftwareApplication` + `FAQPage`), sitemap, robots, responsive navigation with
a mobile drawer, light/dark toggle, interactive FAQ, working contact form.

**Accounts** — email + password registration with validation and duplicate-email
protection, PBKDF2-SHA256 password hashing with a per-account salt, sessions that
survive reloads, “keep me signed in”, email verification with resend, password
reset with single-use expiring tokens, email change with re-verification, account
deletion, protected routes, redirects for unauthenticated and already-signed-in
users.

**Tasks** — title, description due date, priority, status, estimate, category,
notes, timestamps; create / edit / delete (with confirmation) / complete / reopen;
search across titles, descriptions and notes; filters for status, priority and
category; sorting by due date, priority, recency or alphabetically; empty states
with sample data.

**Dashboard** — time-of-day greeting, four live totals, today's progress bar,
today's task list with scheduled times, upcoming deadlines, quick actions,
active-plan summary, and a Premium upsell for free accounts.

**Calendar** — month, week and day views, tasks placed on their due date and
AI-planned blocks placed at their scheduled time, click a day to add a task,
per-user timezone.

**AI Planner (Premium)** — natural-language input → extracted tasks with the
evidence for each inferred value → editable review → constraint panel (working
hours, daily focus cap, working days, break rhythm, fixed commitments, days off)
→ generated schedule → plain-language revisions → accept. Accepted plans sync to
the task list, calendar, dashboard and Today view. Nothing is marked complete by
being scheduled.

**Subscriptions** — free/premium state machine, billing page with plan, price,
interval, status, current period and next payment, cancel-at-period-end that keeps
access until the paid period ends, resume, and a Premium gate on the planner.

**Notifications** — deadline, overdue, daily summary and plan-change notifications
in an in-app centre with unread counts, plus optional browser notifications behind
an explicit permission prompt.

**Onboarding** — four short steps (welcome, working preferences, first task,
dashboard tour) with skip and replay.

**Settings** — profile, email, password; theme, timezone, time format, default
priority, working hours, capacity, breaks, working days; notification toggles;
subscription management; JSON export, sign out, delete account.

---

## 3. How data works in this build

This build is **local-first**: accounts and tasks live in the visitor's browser
storage, scoped per account, and every read is guarded by the signed-in account
id. That is what makes it publishable today with no infrastructure — and it is
also its one real limitation.

| Capability | This build | Needs a backend |
|---|---|---|
| Marketing site, SEO | ✅ works | — |
| Accounts, sessions, hashing | ✅ works (on device) | sync across devices |
| Email verification / reset | ✅ flow works, message captured in a **local mailbox** | real delivery |
| Tasks, calendar, dashboard, planner | ✅ works | sync across devices |
| Premium + $4/month billing | ✅ full state machine, **test mode** | real card charges |
| Contact form | ✅ stored locally | delivery to your inbox |

Nothing about that is hidden from the user: the verification and reset screens
show a clearly labelled “Local mailbox — development mode” panel, the billing page
shows a “Test mode” chip, and the upgrade dialog states that no card is charged.

`DEPLOY.md` contains the exact wiring to replace each of those four pieces
(hosted database, transactional email, Stripe, LLM). Every call site is already
isolated behind `Store` / `Auth` / `PLANORA_CONFIG`, so the UI does not change.

---

## 4. The AI Planner, honestly

There is no API key in this project, so the planner does not pretend to call an
LLM. It ships with a deterministic engine that genuinely works offline:

1. **Parser** — splits free text into clauses, then extracts durations
   (“two hours”, “90 minutes”), deadlines (“by Wednesday”, “tomorrow”, “on 12/05”,
   “in 3 days”, “this weekend”), priorities (“urgent”, “low priority”) and a
   category from keyword rules. It shows the matched phrase as evidence for every
   inferred value, and everything stays editable.
2. **Scheduler** — orders work by deadline urgency, then priority, then length;
   places it in 15-minute increments inside your working window and daily cap;
   respects fixed commitments and days off; inserts breaks at your break rhythm;
   splits long tasks into sittings; and refuses to place work after its deadline.
3. **Recommendations** — flags work that does not fit (with the arithmetic and the
   constraint to relax), overdue debt, front-loaded days, fragile estimates and
   undated tasks.

To use an LLM instead (or as well), set `ai.endpoint` in `assets/js/config.js` to
your own serverless proxy. The contract is documented in `DEPLOY.md`; when it is
set, the UI labels the engine with your endpoint's name.

---

## 5. Testing performed

Verified in a real browser (Chromium, desktop 1440×950 and mobile 390×844) with
zero console errors:

- Landing page loads without an account, FAQ expands, mobile drawer opens, dark
  mode toggles, pricing shows both plans.
- Sign-up → onboarding (4 steps, first task created) → dashboard with live totals.
- Task create / complete / search / filter, sample data, all three calendar views.
- Free user sees the planner paywall; upgrade activates Premium; extraction of a
  five-task paragraph is correct; schedule generation produces 3 days with breaks;
  a plain-language revision rebuilds the plan; accepting saves the plan and adds
  the tasks.
- Settings tabs, theme persistence, delete confirmations, 404.
- Unauthenticated `/app.html` redirects to login; signed-in users skip it.
- Planner engine unit checks: no overlapping blocks, no duplicated breaks, all
  five tasks placed, capacity and deadline constraints respected.

---

## 6. Search engine setup

- Landing, features, pricing, AI planner, FAQ, about, contact, help and the three
  legal pages are indexable with descriptive titles, meta descriptions, canonical
  URLs and Open Graph tags.
- `app.html`, the auth screens and `404.html` are `noindex` and also disallowed in
  `robots.txt`. Private data is never rendered into a public page.
- `sitemap.xml` lists the ten public URLs — update the domain, then submit it in
  Google Search Console and Bing Webmaster Tools.

---

## 7. Before you charge money

1. Wire the payment provider (`DEPLOY.md` §4) and set `billing.mode` to `"stripe"`.
   Premium must be granted by your webhook, never by the browser.
2. Wire transactional email (`DEPLOY.md` §5) so verification and reset links
   actually arrive.
3. Move to a hosted database (`DEPLOY.md` §3) so accounts work across devices.
4. Have the three legal drafts reviewed and fill in your entity details, VAT
   position and refund policy.
5. Swap `support@planora.app` for an inbox you actually monitor.

Until steps 1–2 are done the product is fully usable but is a single-device demo
of billing and email — and it says so in the interface.

---

## 8. Customising

- **Brand colour** — one variable: `--primary` (and `--primary-hover`,
  `--primary-soft`) at the top of `assets/css/styles.css`. Dark mode has its own
  set in `html[data-theme="dark"]`.
- **Price** — `PLANORA_CONFIG.pricing.premium`, plus the copy in `pricing.html`
  and `index.html` (search for `$4`).
- **Fonts** — Fraunces (display) and Inter (UI), loaded from Google Fonts. To go
  fully self-hosted, drop the `<link>` tags from the page heads and add the
  `@font-face` rules to the top of `styles.css`.
- **Copy** — every marketing page is plain HTML; there is no templating to fight.

---

© Planora. No build tools, no dependencies, no attribution requirements.
