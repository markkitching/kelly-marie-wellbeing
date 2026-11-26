/**
 * The personal plan emailed from the cost calculator: what goes in it, and the emails
 * that carry it. Used by functions/api/plan.js (the Cloudflare Pages Function that
 * sends them) and tested by scripts/test-plan.js. No DOM and no file reading here.
 *
 * All the wording comes from src/content/personal-plan.json ("Personal plan" in the
 * editor). {placeholders} in it are filled in here; anything the visitor typed is
 * escaped before it goes into the HTML.
 */
const C = require("../js/cost-calculator.js");

// Training groups come in these sizes; 15 is the most in one session.
const GROUP_SIZES = [6, 9, 12, 15];

/**
 * The fewest full-day sessions that fit everyone, all the same size: as many sessions
 * as groups of 15 need, then the smallest group size that holds an equal share.
 * Fewer than 6 people is one small session.
 */
function suggestSessions(managers) {
  const n = Math.max(1, Math.round(managers));
  if (n < GROUP_SIZES[0]) return { count: 1, size: null, small: true };
  const max = GROUP_SIZES[GROUP_SIZES.length - 1];
  const count = Math.ceil(n / max);
  const perGroup = Math.ceil(n / count);
  const size = GROUP_SIZES.find((s) => s >= perGroup);
  return { count, size, small: false };
}

/** Managers and team leaders guessed from headcount: 1 per `ratio` staff, rounded up. */
function estimateManagers(staff, ratio) {
  const r = Number(ratio) > 0 ? Number(ratio) : 10;
  return Math.max(1, Math.ceil(staff / r));
}

/**
 * Everything the plan says, worked out from the visitor's figures.
 * details: { staff, managers (null = estimate), inputs, assumptions, perEmployee,
 *            organisation, name, managerRatio }
 */
function buildPlan(details) {
  const estimate = C.ownEstimate(details.inputs, details.assumptions, details.perEmployee);
  const costs = C.CATEGORIES.map((key) => ({ key, value: estimate[key].value, source: estimate[key].source }));
  // The largest cost; on a tie, the one listed first (the order the page shows them in).
  const largest = costs.reduce((best, c) => (c.value > best.value ? c : best), costs[0]).key;
  const managersEstimated = details.managers == null;
  const managers = managersEstimated ? estimateManagers(details.staff, details.managerRatio) : details.managers;
  return {
    name: details.name || "",
    organisation: details.organisation || "",
    staff: details.staff,
    total: estimate.total,
    perEmployee: estimate.total / details.staff,
    usedOwnFigures: estimate.used,
    costs,
    largest,
    managers,
    managersEstimated,
    sessions: suggestSessions(managers),
    assumptions: details.assumptions,
  };
}

// ── Wording ─────────────────────────────────────
const LABELS = { presenteeism: "Working while unwell", turnover: "Staff leaving", absence: "Sickness absence" };
const MEANING_FIELD = { presenteeism: "meaningPresenteeism", turnover: "meaningTurnover", absence: "meaningAbsence" };

const fill = (template, values) =>
  String(template || "").replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The plan's sentences, filled in and still plain text. */
function planText(plan, words) {
  const org = plan.organisation || words.organisationFallback || "your organisation";
  const firstName = plan.name.trim().split(/\s+/)[0] || "";
  const sessions = plan.sessions.small
    ? words.sessionsSmall
    : fill(plan.sessions.count === 1 ? words.sessionsOne : words.sessionsMany, {
        count: plan.sessions.count,
        size: plan.sessions.size,
      });
  const managers = plan.managersEstimated ? "about " + plan.managers : String(plan.managers);
  return {
    subject: fill(words.subject, { organisation: org }),
    greeting: fill(words.greeting, { name: firstName }),
    intro: fill(words.introText, { organisation: org }),
    numbersHeading: words.numbersHeading,
    numbers: fill(words.numbersText, {
      organisation: org,
      total: C.formatGBP(plan.total),
      perEmployee: C.formatGBP(plan.perEmployee),
    }),
    costs: plan.costs.map((c) => ({ label: LABELS[c.key], value: C.formatGBP(c.value) })),
    total: C.formatGBP(plan.total),
    biggestShare: fill(words.biggestShareText, { largest: LABELS[plan.largest].toLowerCase() }),
    meaningHeading: words.meaningHeading,
    meaning: words[MEANING_FIELD[plan.largest]] || "",
    trainingHeading: words.trainingHeading,
    training: fill(words.trainingText, { managers, sessions }),
    estimatedNote: plan.managersEstimated ? fill(words.estimatedNote, { ratio: words.managerRatio || 10 }) : "",
    freeHeading: words.freeHeading,
    freeSteps: (words.freeSteps || []).map((s) => (s && s.text) || "").filter(Boolean),
    nextHeading: words.nextHeading,
    next: words.nextText,
    buttonLabel: words.buttonLabel,
    signOff: words.signOff,
    reason: words.reasonText,
  };
}

/**
 * The visitor's email: { subject, html, text }.
 * site: { url, contactUrl, email, logo, sourceNote, colors }
 */
function renderPlanEmail(plan, words, site) {
  const t = planText(plan, words);
  const k = site.colors;
  // No booking link yet: the button goes to the contact page instead.
  const bookingUrl = /^https:\/\//.test(words.bookingUrl || "") ? words.bookingUrl : site.contactUrl;
  const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
  const sans = "Inter, Arial, Helvetica, sans-serif";
  const p = (text, extra) =>
    `<p style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.6;color:#374151;${extra || ""}">${esc(text)}</p>`;
  const h2 = (text) =>
    `<h2 style="margin:32px 0 6px;font-family:${serif};font-weight:normal;font-size:22px;line-height:1.3;color:${k.dark};">${esc(text)}</h2>` +
    `<div style="width:40px;height:3px;background:${k.accent};margin:0 0 16px;line-height:3px;font-size:0;">&nbsp;</div>`;

  const costRows = t.costs
    .map(
      (c) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-family:${sans};font-size:15px;color:#374151;">${esc(c.label)}</td>` +
        `<td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-family:${sans};font-size:15px;font-weight:600;color:${k.dark};white-space:nowrap;">${esc(c.value)}</td></tr>`
    )
    .join("");
  const steps = t.freeSteps
    .map(
      (s, i) =>
        `<tr><td valign="top" style="padding:0 12px 14px 0;width:28px;"><div style="width:28px;height:28px;border-radius:14px;background:${k.dark};color:#ffffff;font-family:${sans};font-size:14px;font-weight:600;line-height:28px;text-align:center;">${i + 1}</div></td>` +
        `<td valign="top" style="padding:0 0 14px;font-family:${sans};font-size:16px;line-height:1.6;color:#374151;">${esc(s)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(t.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${k.light};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(t.numbers)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${k.light};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${k.dark};padding:24px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;"><img src="${esc(site.logo)}" width="40" height="40" alt="" style="display:block;border-radius:20px;background:#ffffff;"></td>
<td style="font-family:${serif};font-size:20px;color:#ffffff;">Kelly Marie <em style="color:${k.accentOnDark};">Wellbeing</em></td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 32px 8px;">
${p(t.greeting)}
${p(t.intro)}
${h2(t.numbersHeading)}
<p style="margin:0 0 4px;font-family:${serif};font-size:36px;line-height:1.2;color:${k.dark};">${esc(t.total)} <span style="font-family:${sans};font-size:16px;color:#4b5563;">a year</span></p>
${p(t.numbers)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
${costRows}
<tr><td style="padding:10px 0;font-family:${sans};font-size:15px;font-weight:600;color:${k.dark};">Total</td>
<td align="right" style="padding:10px 0;font-family:${sans};font-size:15px;font-weight:600;color:${k.dark};white-space:nowrap;">${esc(t.total)}</td></tr>
</table>
${p(t.biggestShare, "font-weight:600;color:" + k.dark + ";")}
${h2(t.meaningHeading)}
${p(t.meaning)}
${h2(t.trainingHeading)}
${p(t.training)}
${t.estimatedNote ? p(t.estimatedNote, "font-size:14px;color:#4b5563;") : ""}
${h2(t.freeHeading)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
${h2(t.nextHeading)}
${p(t.next)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
<td style="border-radius:6px;background:${k.dark};"><a href="${esc(bookingUrl)}" style="display:inline-block;padding:14px 28px;font-family:${sans};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(t.buttonLabel)}</a></td>
</tr></table>
${p(t.signOff, "font-family:" + serif + ";color:" + k.dark + ";")}
</td></tr>
<tr><td style="padding:20px 32px 28px;background:${k.cream};">
<p style="margin:0 0 10px;font-family:${sans};font-size:12px;line-height:1.6;color:#4b5563;">${esc(site.sourceNote)}</p>
<p style="margin:0 0 10px;font-family:${sans};font-size:12px;line-height:1.6;color:#4b5563;">${esc(t.reason)}</p>
<p style="margin:0;font-family:${sans};font-size:12px;line-height:1.6;color:#4b5563;"><a href="${esc(site.url)}" style="color:${k.accentText};">${esc(site.url.replace(/^https:\/\//, ""))}</a> · <a href="mailto:${esc(site.email)}" style="color:${k.accentText};">${esc(site.email)}</a> · <a href="${esc(site.url)}/privacy/" style="color:${k.accentText};">Privacy policy</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    t.greeting,
    "",
    t.intro,
    "",
    t.numbersHeading.toUpperCase(),
    t.numbers,
    "",
    ...t.costs.map((c) => `${c.label}: ${c.value}`),
    `Total: ${t.total}`,
    "",
    t.biggestShare,
    "",
    t.meaningHeading.toUpperCase(),
    t.meaning,
    "",
    t.trainingHeading.toUpperCase(),
    t.training,
    ...(t.estimatedNote ? [t.estimatedNote] : []),
    "",
    t.freeHeading.toUpperCase(),
    ...t.freeSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
    t.nextHeading.toUpperCase(),
    t.next,
    `${t.buttonLabel}: ${bookingUrl}`,
    "",
    t.signOff,
    "",
    "---",
    site.sourceNote,
    t.reason,
    `${site.url} · ${site.email} · Privacy policy: ${site.url}/privacy/`,
  ].join("\n");

  return { subject: t.subject, html, text };
}

/**
 * The email to Kelly Marie Wellbeing about a new request: { subject, html, text }.
 * lead: { name, email, organisation, managersGiven, wantsToTalk, message,
 *         consentPlan, consentUpdates, submittedAt, emailSent }
 */
function renderNotification(plan, lead) {
  const yesNo = (v) => (v ? "Yes" : "No");
  const rows = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Organisation", lead.organisation || "(not given)"],
    ["Employees", String(plan.staff)],
    ["Managers and team leaders", lead.managersGiven == null ? `${plan.managers} (estimated from headcount)` : String(plan.managers)],
    ["Total estimate", `${C.formatGBP(plan.total)} a year (${C.formatGBP(plan.perEmployee)} per employee)`],
    ...plan.costs.map((c) => [LABELS[c.key], `${C.formatGBP(c.value)}${c.source === "yours" ? " (their figures)" : " (headcount estimate)"}`]),
    ["Biggest share", LABELS[plan.largest]],
    [
      "Suggested training",
      plan.sessions.small ? "1 small session" : `${plan.sessions.count} session${plan.sessions.count > 1 ? "s" : ""}, groups of up to ${plan.sessions.size}`,
    ],
    ["Consent to store details and send the plan", `${yesNo(lead.consentPlan)} (${lead.submittedAt})`],
    ["Consent to occasional updates", `${yesNo(lead.consentUpdates)} (${lead.submittedAt})`],
    ["Would like to talk about training", yesNo(lead.wantsToTalk)],
    ["Their message", lead.message || "(none)"],
    ["Plan email sent", yesNo(lead.emailSent)],
  ];
  const subject = `New personal plan request: ${lead.name}${lead.organisation ? `, ${lead.organisation}` : ""}`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html =
    `<!doctype html><html lang="en-GB"><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;">` +
    `<p>Someone asked for their personal plan on the cost calculator.</p><table cellpadding="6" cellspacing="0" border="0">` +
    rows.map(([k, v]) => `<tr><th align="left" valign="top" style="padding-right:16px;">${esc(k)}</th><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("") +
    `</table></body></html>`;
  return { subject, html, text };
}

module.exports = { GROUP_SIZES, suggestSessions, estimateManagers, buildPlan, planText, renderPlanEmail, renderNotification };
