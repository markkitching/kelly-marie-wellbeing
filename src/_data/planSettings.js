// Settings for the cost calculator's personal plan that aren't wording (the wording is
// src/content/personal-plan.json). The Turnstile site key is public, but it differs
// between Cloudflare accounts, so it's set as TURNSTILE_SITE_KEY in Cloudflare Pages
// (Settings > Variables and Secrets) rather than written here. Without it the form
// still stores submissions with Formspree; it just can't email the plan.
module.exports = () => ({
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
  endpoint: "/api/plan",
});
