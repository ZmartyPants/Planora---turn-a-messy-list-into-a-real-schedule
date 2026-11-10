/*!
 * Planora — runtime configuration
 * ---------------------------------------------------------------------------
 * This file is the single place the application owner edits after publishing.
 * Everything here is public (it ships to the browser), so never place secret
 * keys in this file. Secrets belong on a server / serverless function.
 */
window.PLANORA_CONFIG = {
  /* Product identity ------------------------------------------------ */
  productName: "Planora",
  supportEmail: "support@planora.app", // replace with your real inbox
  /* Public base URL — leave empty to use the current origin automatically.
     Set it only if you deploy to a subfolder or a custom domain with a path. */
  baseUrl: "",

  /* Pricing ---------------------------------------------------------- */
  pricing: {
    free: 0,
    premium: 4,
    currency: "USD",
    interval: "month",
  },

  /* Billing ----------------------------------------------------------
   * "local"  -> subscriptions are simulated on this device (default).
   *             Everything works end-to-end so you can publish immediately,
   *             but no money moves and no card is charged.
   * "stripe" -> the app hands checkout to your own serverless function which
   *             creates a Stripe Checkout Session and verifies the webhook.
   *             See DEPLOY.md for the 15-minute wiring guide.
   */
  billing: {
    mode: "local",
    checkoutEndpoint: "/api/billing/checkout",
    portalEndpoint: "/api/billing/portal",
  },

  /* AI Planner -------------------------------------------------------
   * Planora ships with the built-in deterministic planning engine, which runs
   * entirely in the browser. Optionally point `endpoint` at your own serverless
   * proxy that forwards to an LLM (OpenAI, Anthropic, Gemini, ...). Your API key
   * lives on that server, never here.
   *
   * POST {endpoint}  body: { mode: "extract" | "revise", text, tasks, constraints }
   * expects JSON: { tasks: [...] } or { summary, recommendations, operations }
   * When endpoint is null the built-in engine is used. Nothing is faked:
   * the UI tells the user which engine produced the plan.
   */
  ai: {
    endpoint: null,
    engineLabel: "Planora Engine",
  },

  /* Feature flags ---------------------------------------------------- */
  features: {
    googleSignIn: false, // flip to true once you wire OAuth on your backend
  },

  /* Legal / policy --------------------------------------------------- */
  legal: {
    lastUpdated: "2025-01-01",
    companyName: "Planora",
    jurisdiction: "the Netherlands", // used in the legal drafts
  },
};
