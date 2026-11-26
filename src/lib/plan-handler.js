/**
 * What happens when the calculator's "Get your personal plan" form is sent, after the
 * page has stored the submission with Formspree as before: check it's a person
 * (Cloudflare Turnstile), check the details, work out the plan from their figures, email
 * it to them, and email Kelly Marie Wellbeing about it. Called by functions/api/plan.js.
 *
 * Settings, all in Cloudflare Pages > Settings > Variables and Secrets, never in code:
 *   RESEND_API_KEY        secret   Resend API key, for sending email
 *   TURNSTILE_SECRET_KEY  secret   Turnstile secret key, for the spam check
 *   PLAN_FROM             text     e.g. Kelly Marie Wellbeing <plan@kellymariewellbeing.com>
 *   PLAN_REPLY_TO         text     where replies to the plan email go (optional)
 *   NOTIFY_TO             text     who's told about each request
 * With any of the required ones missing it sends nothing, so it can't be used to send
 * email by someone getting round the spam check.
 */
const C = require("../js/cost-calculator.js");
const plan = require("./personal-plan.js");
const { colorsFor } = require("./colors-core.js");
const words = require("../content/personal-plan.json");
const calculator = require("../content/calculator.json");
const theme = require("../content/theme.json");
const contact = require("../content/contact.json");
const links = require("../_data/links.js")();

const REQUIRED = ["RESEND_API_KEY", "TURNSTILE_SECRET_KEY", "PLAN_FROM", "NOTIFY_TO"];

// The same limits the page checks (src/js/cost-calculator-page.js), so a value the page
// accepts is accepted here and nothing wildly out of range gets into an email.
const INPUT_RULES = {
  salary: { min: 1, max: 10000000 },
  absentStaff: { integer: true, min: 0, max: 1000000 },
  leavers: { integer: true, min: 0, max: 1000000 },
  strugglingStaff: { integer: true, min: 0, max: 1000000 },
};
const ASSUMPTION_RULES = {
  daysPerAbsence: { min: 0, max: 365 },
  replacementPct: { min: 0, max: 500 },
  productivityLossPct: { min: 0, max: 100 },
  onCostPct: { min: 0, max: 100 },
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// A number within the rules, null when blank; undefined when it's present but unusable.
function number(value, rules) {
  if (value === null || value === undefined || value === "") return null;
  const r = C.parseField(value, rules);
  return r.error ? undefined : r.value;
}

/** The submitted details, checked: { lead, details } or { error }. */
function readSubmission(body) {
  const name = text(body.name, 100);
  const email = text(body.email, 254);
  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(email)) return { error: "Please enter a valid email address." };
  if (body.consentPlan !== true) return { error: "Please tick to agree before we can send your plan." };

  const staff = number(body.staff, { integer: true, min: 1, max: 1000000 });
  if (!staff) return { error: "Please enter how many people you employ." };
  const managers = number(body.managers, { integer: true, min: 1, max: 100000 });
  if (managers === undefined) return { error: "Please enter the number of managers as a whole number." };

  const inputs = { staff };
  for (const key of Object.keys(INPUT_RULES)) {
    const v = number((body.inputs || {})[key], INPUT_RULES[key]);
    if (v === undefined) return { error: "One of your figures isn't a number we can use." };
    inputs[key] = v;
  }
  const defaults = calculatorAssumptions();
  const assumptions = { workingDays: defaults.workingDays };
  for (const key of Object.keys(ASSUMPTION_RULES)) {
    const v = number((body.assumptions || {})[key], ASSUMPTION_RULES[key]);
    assumptions[key] = v == null ? defaults[key] : v;
  }

  return {
    lead: {
      name,
      email,
      organisation: text(body.organisation, 150),
      managersGiven: managers,
      wantsToTalk: body.wantsToTalk === true,
      message: text(body.message, 2000),
      consentPlan: true,
      consentUpdates: body.consentUpdates === true,
    },
    details: {
      name,
      organisation: text(body.organisation, 150),
      staff,
      managers,
      inputs,
      assumptions,
      perEmployee: calculatorPerEmployee(),
      managerRatio: words.managerRatio,
    },
  };
}

// The figures in the editor's "Cost calculator" entry, falling back to the defaults the
// same way the page does (src/_includes/blocks/calculator.njk).
const figure = (value, fallback) => (value === "" || value == null || isNaN(Number(value)) ? fallback : Number(value));
function calculatorPerEmployee() {
  return {
    presenteeism: figure(calculator.presenteeismCost, C.PER_EMPLOYEE.presenteeism),
    turnover: figure(calculator.turnoverCost, C.PER_EMPLOYEE.turnover),
    absence: figure(calculator.absenceCost, C.PER_EMPLOYEE.absence),
  };
}
function calculatorAssumptions() {
  const a = C.ASSUMPTIONS;
  return {
    daysPerAbsence: figure(calculator.daysPerAbsence, a.daysPerAbsence),
    replacementPct: figure(calculator.replacementPct, a.replacementPct),
    productivityLossPct: figure(calculator.productivityLossPct, a.productivityLossPct),
    onCostPct: figure(calculator.onCostPct, a.onCostPct),
    workingDays: a.workingDays,
  };
}

async function verifyTurnstile(token, ip, env, fetchFn) {
  if (!token || typeof token !== "string") return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token.slice(0, 2048));
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    return false;
  }
}

async function sendEmail(env, fetchFn, message) {
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

/**
 * request: a POST with a JSON body from src/js/cost-calculator-page.js.
 * Answers { ok: true, emailSent } or { ok: false, error } with a matching status.
 */
async function handle(request, env, fetchFn) {
  fetchFn = fetchFn || fetch;
  env = env || {};
  if (REQUIRED.some((k) => !env[k])) return json(503, { ok: false, error: "not_configured" });

  // Only from the site's own pages (the live site or a preview of it).
  const origin = request.headers.get("Origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: "forbidden" });

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json(413, { ok: false, error: "too_large" });
    body = JSON.parse(raw);
  } catch (err) {
    return json(400, { ok: false, error: "Please try again." });
  }
  if (!body || typeof body !== "object") return json(400, { ok: false, error: "Please try again." });

  if (!(await verifyTurnstile(body.turnstileToken, request.headers.get("CF-Connecting-IP"), env, fetchFn))) {
    return json(403, { ok: false, error: "spam_check" });
  }

  const submission = readSubmission(body);
  if (submission.error) return json(400, { ok: false, error: submission.error });
  const { lead, details } = submission;

  const result = plan.buildPlan(details);
  const site = {
    url: links.site,
    contactUrl: links.site + links.contact,
    email: contact.email,
    logo: links.site + "/images/kmclogo-tree-1.jpeg",
    sourceNote: calculator.sourceNote || "",
    colors: colorsFor(theme),
  };
  const visitorEmail = plan.renderPlanEmail(result, words, site);
  const emailSent = await sendEmail(env, fetchFn, {
    from: env.PLAN_FROM,
    to: [lead.email],
    reply_to: env.PLAN_REPLY_TO || contact.email,
    subject: visitorEmail.subject,
    html: visitorEmail.html,
    text: visitorEmail.text,
  });

  const notice = plan.renderNotification(result, { ...lead, submittedAt: new Date().toISOString(), emailSent });
  await sendEmail(env, fetchFn, {
    from: env.PLAN_FROM,
    to: String(env.NOTIFY_TO).split(",").map((s) => s.trim()).filter(Boolean),
    reply_to: lead.email,
    subject: notice.subject,
    html: notice.html,
    text: notice.text,
  });

  return json(200, { ok: true, emailSent });
}

module.exports = { handle, readSubmission };
