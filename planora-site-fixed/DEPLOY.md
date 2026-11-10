# Deploying Planora as a real business

The static app is complete and runnable. What turns it into a business that takes
money and sends email is four integrations. Each section below is self-contained;
you can do them in any order, and the UI degrades honestly until each is done.

Time budget: about 2–3 hours for all four, most of it Stripe.

> **Golden rule for all four:** secrets live on the server (environment
> variables), never in `assets/js/config.js`. That file is public.

---

## 1. Where each value goes

| Setting | File | Default | Change to |
|---|---|---|---|
| Support email | `assets/js/config.js` → `supportEmail` | `support@planora.app` | your real inbox |
| Premium price | `assets/js/config.js` → `pricing.premium` | `4` | your price |
| Billing mode | `assets/js/config.js` → `billing.mode` | `"local"` | `"stripe"` after §4 |
| Checkout route | `assets/js/config.js` → `billing.checkoutEndpoint` | `/api/billing/checkout` | your function URL |
| AI proxy | `assets/js/config.js` → `ai.endpoint` | `null` | your proxy URL after §6 |
| Domain | `sitemap.xml`, `robots.txt`, `<link rel="canonical">` in page heads | `planora.app` | your domain |

The app never hardcodes a hostname in navigation or redirects: every link is
relative, and `Auth.requireAuth()` builds redirects from `location`. Moving to
`https://planora.com` requires no code change.

---

## 2. Hosting and domain

**Netlify:** drag the folder onto <https://app.netlify.com/drop>, then *Domain
management → Add a domain*. Enable “HTTPS” (Lets Encrypt is automatic).

**Vercel:** `npx vercel --prod`, then *Settings → Domains*.

**Cloudflare Pages:** upload via the dashboard, or connect a Git repo with an empty
build command and `/` as the output directory.

DNS: point the apex `A`/`ALIAS` record at the host and `www` at the host's CNAME.
Then update `sitemap.xml`, `robots.txt` and the ten canonical URLs (a find-and-
replace of `https://planora.app` across the HTML files is enough).

---

## 3. Hosted database + real accounts (Supabase, ~45 min)

Today `Store` and `Auth` read and write `localStorage`. To make accounts work on
any device, move those two layers behind an API. Nothing in the views changes,
because every view reads through `Auth.data()` and writes through
`Planora.save(fn)`.

1. Create a Supabase project, then run this schema (RLS is what enforces privacy):

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  timezone text default 'UTC',
  prefs jsonb not null default '{}'::jsonb,
  onboarding jsonb not null default '{"completed":false}'::jsonb,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text default '', notes text default '',
  due_date date, priority text not null default 'medium'
    check (priority in ('high','medium','low')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed')),
  estimated_minutes int not null default 30 check (estimated_minutes between 0 and 720),
  category text default '',
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  start_date date not null, end_date date not null,
  plan_data jsonb not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  provider_customer_id text, provider_subscription_id text,
  plan_type text not null default 'free' check (plan_type in ('free','premium')),
  status text not null default 'active',
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean default false
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null, message text not null, type text default 'info',
  read boolean default false, created_at timestamptz default now()
);

alter table profiles      enable row level security;
alter table tasks         enable row level security;
alter table plans         enable row level security;
alter table subscriptions enable row level security;
alter table notifications enable row level security;

create policy "own profile"  on profiles      for all using (auth.uid() = id)  with check (auth.uid() = id);
create policy "own tasks"    on tasks         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans"    on plans         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifs"   on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- subscriptions are written only by the Stripe webhook (service role key), read by the owner
create policy "read own sub" on subscriptions for select using (auth.uid() = user_id);
```

2. Replace the bodies of `Store.load` / `Store.save` and `Auth.login` /
`Auth.register` with Supabase calls (`supabase.auth.signInWithPassword`,
`from('tasks').select()`, …). Both are isolated functions at the top of
`storage.js` and `auth.js`; keep the same signatures and the views keep working.

3. Email verification and password reset then come free from Supabase Auth — set
the redirect URLs to `https://yourdomain/verify-email.html` and
`https://yourdomain/reset-password.html`. Delete the local-mailbox block in
`auth-pages.js` (`renderOutbox`) once real mail is flowing.

4. `Auth.isPremium()` should read the `subscriptions` row instead of local state.
That is the function the planner gate calls — one place to change.

---

## 4. Payments — Stripe, $4/month (the important one)

**Never grant Premium from the browser.** In this app, `Auth.activatePremium()` is
only called by the local test-mode flow. With Stripe you skip it entirely and let
the webhook write the subscription row. The app reads the result.

### 4.1 Stripe setup
1. Create a Product “Planora Premium” with a recurring Price of **$4.00 / month**.
2. Copy the Price ID (`price_…`) and your secret key.
3. Add a webhook endpoint at `https://yourdomain/api/billing/webhook` listening for
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and `invoice.payment_failed`.

### 4.2 Checkout endpoint — `/api/billing/checkout`

```js
// Node runtime (Vercel/Netlify function). Env: STRIPE_SECRET_KEY, PRICE_ID, APP_URL
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Resolve the user from their session/JWT — never trust a body-supplied user id.
  const user = await requireUser(req);           // your Supabase session check
  if (!user) return res.status(401).json({ error: "Sign in first" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.PRICE_ID, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${process.env.APP_URL}/app.html#/billing?success=1`,
    cancel_url: `${process.env.APP_URL}/pricing.html?canceled=1`,
    allow_promotion_codes: true,
  });
  res.json({ url: session.url });
}
```

The dialog in `settings.js` already POSTs to `billing.checkoutEndpoint` and
redirects to `{ url }` when `billing.mode === "stripe"`.

### 4.3 Webhook — `/api/billing/webhook`

```js
export const config = { api: { bodyParser: false } };   // raw body is required

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook signature failed: ${e.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const sub = await stripe.subscriptions.retrieve(s.subscription);
      await db.upsertSubscription({
        user_id: s.client_reference_id,
        provider_customer_id: s.customer,
        provider_subscription_id: sub.id,
        plan_type: "premium",
        status: "active",
        current_period_start: new Date(sub.current_period_start * 1000),
        current_period_end: new Date(sub.current_period_end * 1000),
        cancel_at_period_end: sub.cancel_at_period_end,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.payment_failed": {
      const sub = event.data.object;
      await db.syncFromStripeSubscription(sub);   // update status / period / cancel flag
      break;
    }
  }
  res.json({ received: true });
}
```

### 4.4 Cancel and resume
Point `billing.portalEndpoint` at a second function that creates a Stripe Billing
Portal session (`stripe.billingPortal.sessions.create`). That gives customers card
updates, invoices and cancellation in one place. The in-app cancel button already
works for the local mode; with Stripe, redirect it to the portal URL instead.

### 4.5 Go live
- Switch to live keys, re-create the product in live mode, add the live webhook.
- Set `billing.mode: "stripe"` in `config.js`.
- Test with card `4242 4242 4242 4242` in test mode: upgrade → webhook → Premium
  appears → cancel → Premium persists until period end → then Free. Tasks must
  survive every step.

---

## 5. Transactional email (~20 min)

Verification and reset links are the only email the product sends. Any provider
works; Resend is the shortest path.

```js
// /api/email/send — called by your auth flow, not by the browser
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Planora <no-reply@yourdomain.com>",
  to: email,
  subject: "Verify your Planora email address",
  html: `<p>Confirm your address to finish setting up Planora.</p>
         <p><a href="${verifyUrl}">Verify my email</a></p>
         <p>This link expires in 24 hours.</p>`,
});
```

Then in `assets/js/auth.js`, replace the two `Store.pushOutbox(...)` calls inside
`sendVerification` and `requestReset` with a `fetch('/api/email/send', …)`. Delete
`renderOutbox()` from `auth-pages.js` so the development mailbox disappears.

Deliverability checklist: SPF, DKIM and DMARC records on your domain; a real
`From:` address you own; keep the plain-text alternative part.

---

## 6. Optional: connect an LLM

The built-in engine is deterministic and needs no key. If you want an LLM doing the
extraction and the prose recommendations, put a proxy in front of it and set
`ai.endpoint` in `config.js`.

**Contract**

```
POST {endpoint}
content-type: application/json

{ "mode": "extract" | "revise",
  "text": "the user's paragraph",
  "tasks": [ { "id","title","dueDate","priority","estimatedMinutes" } ],
  "constraints": { "workStart":540, "workEnd":1080, "dailyCapacity":240, ... } }

→ 200 { "tasks": [ { "title","dueDate","priority","estimatedMinutes","category" } ] }
```

Server-side sketch (OpenAI):

```js
const r = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content:
      "Extract tasks. Return JSON {tasks:[{title,dueDate:'YYYY-MM-DD'|null,priority:'high'|'medium'|'low',estimatedMinutes:int,category:string}]}. Resolve relative dates against TODAY=" + today + ". Never invent tasks." },
    { role: "user", content: text },
  ],
});
```

Rules that keep this honest: the browser never sees the API key; if the call fails
you fall back to `PlanoraPlanner.parseTasks` and tell the user which engine ran;
the user always reviews and can edit the extraction before scheduling. Keep the
deterministic scheduler even when an LLM is connected — LLMs are good at parsing
language and bad at arithmetic, which is exactly the split this app already makes.

---

## 7. Contact form

Currently it validates, stores the message locally (so the confirmation is real)
and shows the reference. To receive mail, POST the same fields to a function:

```js
// /api/contact
await resend.emails.send({ from: "site@yourdomain.com", to: "you@yourdomain.com",
  subject: `[Planora] ${subject}`, reply_to: email, text: `${name} <${email}>\n\n${message}` });
```

Alternatively point the form at Formspree/Netlify Forms and delete the local
handler in `ui.js → initContact`.

---

## 8. Pre-launch checklist

**Security**
- [ ] No secrets in `config.js` or anywhere under `assets/`.
- [ ] Premium is granted only by the webhook; the local test path is disabled
      (`billing.mode: "stripe"`).
- [ ] Database RLS enabled and tested with two accounts (account A cannot read B's
      tasks by id).
- [ ] Webhook signature verification fails closed.
- [ ] HTTPS everywhere; HSTS header present.
- [ ] Password minimum enforced server-side too, not only in the browser.

**Product**
- [ ] Sign up → verify → onboard → add task → complete task on desktop and phone.
- [ ] Free user cannot reach the planner; premium user can.
- [ ] Upgrade → Premium; cancel → access until period end → then Free; tasks intact.
- [ ] Export JSON, then delete account → all data gone.
- [ ] Every link in the footer resolves; no 404s.
- [ ] Error and empty states show real copy, not blank panels.

**SEO / legal**
- [ ] Canonicals and sitemap use your domain; `robots.txt` blocks the app and auth.
- [ ] Submit the sitemap in Search Console.
- [ ] Privacy, Terms and Cookie drafts reviewed, placeholders replaced, VAT and
      refund position stated.
- [ ] Support email is monitored.

**Performance**
- [ ] Lighthouse on `/` and `/pricing` ≥ 90 for performance and accessibility.
- [ ] Images have alt text; all form inputs have labels; keyboard-only pass through
      sign-up, task create, and the planner.
