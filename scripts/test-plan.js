// Checks the cost calculator's personal plan (src/lib/personal-plan.js) and the request
// handler that emails it (src/lib/plan-handler.js), with the email and spam-check
// services stood in for. Run with `npm run test:plan`.
const assert = require("assert");
const plan = require("../src/lib/personal-plan.js");
const handler = require("../src/lib/plan-handler.js");
const words = require("../src/content/personal-plan.json");
const C = require("../src/js/cost-calculator.js");

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const section = (title) => tests.push([title, null]);

const details = (over) =>
  Object.assign(
    {
      name: "Sam Jones",
      organisation: "Acme Ltd",
      staff: 50,
      managers: null,
      inputs: { staff: 50, salary: null, absentStaff: null, leavers: null, strugglingStaff: null },
      assumptions: Object.assign({}, C.ASSUMPTIONS),
      perEmployee: C.PER_EMPLOYEE,
      managerRatio: 10,
    },
    over
  );
const site = {
  url: "https://kellymariewellbeing.com",
  contactUrl: "https://kellymariewellbeing.com/contact/",
  email: "contactus@kellymariewellbeing.com",
  logo: "https://kellymariewellbeing.com/images/kmclogo-tree-1.jpeg",
  sourceNote: "This is an estimate based on UK averages, not a measurement of your organisation.",
  colors: { dark: "#1c3553", accent: "#4a7fa5", light: "#f5f7fa", cream: "#e8eef5", accentText: "#406d8e", accentOnDark: "#8fb0c7" },
};

section("training groups");

for (const [managers, expected] of [
  [4, "one small full-day session"],
  [6, "one full-day session, for a group of up to 6"],
  [10, "one full-day session, for a group of up to 12"],
  [20, "2 full-day sessions, in groups of up to 12"],
  [40, "3 full-day sessions, in groups of up to 15"],
]) {
  test(`${managers} managers: ${expected}`, () => {
    const t = plan.planText(plan.buildPlan(details({ managers })), words);
    assert.ok(t.training.includes(expected), t.training);
    assert.ok(t.training.startsWith(`With ${managers} managers`), t.training);
    assert.strictEqual(t.estimatedNote, "");
  });
}

test("blank managers: estimated from headcount at 1 per 10, and labelled as an estimate", () => {
  const t = plan.planText(plan.buildPlan(details({ staff: 200, inputs: { staff: 200 } })), words);
  assert.ok(t.training.startsWith("With about 20 managers"), t.training);
  assert.ok(t.training.includes("2 full-day sessions, in groups of up to 12"), t.training);
  assert.ok(t.estimatedNote.includes("1 for every 10 staff"), t.estimatedNote);
});

test("blank managers with a small workforce rounds up to at least one", () => {
  const p = plan.buildPlan(details({ staff: 3, inputs: { staff: 3 } }));
  assert.strictEqual(p.managers, 1);
  assert.ok(p.sessions.small);
});

test("group sizes are only ever 6, 9, 12 or 15, with no more than 15 in a group", () => {
  for (let n = 6; n <= 400; n++) {
    const s = plan.suggestSessions(n);
    assert.ok([6, 9, 12, 15].includes(s.size), `${n}: ${s.size}`);
    assert.ok(s.count * s.size >= n, `${n} people must fit`);
    assert.strictEqual(s.count, Math.ceil(n / 15), `${n}: fewest sessions`);
  }
});

section("what that means (the biggest cost)");

test("headcount only: working while unwell is the biggest", () => {
  const p = plan.buildPlan(details({ managers: 6 }));
  assert.strictEqual(p.largest, "presenteeism");
  const t = plan.planText(p, words);
  assert.strictEqual(t.biggestShare, "The biggest share for you is working while unwell.");
  assert.strictEqual(t.meaning, words.meaningPresenteeism);
});

test("lots of leavers: staff leaving is the biggest", () => {
  const p = plan.buildPlan(details({ managers: 6, inputs: { staff: 50, salary: 30000, leavers: 10, absentStaff: 0, strugglingStaff: 0 } }));
  assert.strictEqual(p.largest, "turnover");
  assert.strictEqual(plan.planText(p, words).meaning, words.meaningTurnover);
});

test("lots of absence: sickness absence is the biggest", () => {
  const p = plan.buildPlan(details({ managers: 6, inputs: { staff: 50, salary: 30000, leavers: 0, absentStaff: 20, strugglingStaff: 0 } }));
  assert.strictEqual(p.largest, "absence");
  assert.strictEqual(plan.planText(p, words).meaning, words.meaningAbsence);
});

test("only the biggest cost's paragraph is in the email", () => {
  const p = plan.buildPlan(details({ managers: 6 }));
  const email = plan.renderPlanEmail(p, words, site);
  assert.ok(email.text.includes(words.meaningPresenteeism));
  assert.ok(!email.text.includes(words.meaningTurnover));
  assert.ok(!email.text.includes(words.meaningAbsence));
});

section("the plan email");

test("the figures match the calculator page: £84,300 for 50 staff, £1,686 each", () => {
  const t = plan.planText(plan.buildPlan(details({ managers: 6 })), words);
  assert.ok(t.numbers.includes("Acme Ltd around £84,300 a year"), t.numbers);
  assert.ok(t.numbers.includes("about £1,686 for each person"), t.numbers);
  assert.deepStrictEqual(t.costs.map((c) => c.value), ["£39,650", "£32,500", "£12,150"]);
});

test("subject names the organisation, or says 'your organisation'", () => {
  assert.strictEqual(plan.renderPlanEmail(plan.buildPlan(details()), words, site).subject, "Your mental health cost plan for Acme Ltd");
  assert.strictEqual(
    plan.renderPlanEmail(plan.buildPlan(details({ organisation: "" })), words, site).subject,
    "Your mental health cost plan for your organisation"
  );
});

test("all five sections and the sources are in both the HTML and plain-text versions", () => {
  const email = plan.renderPlanEmail(plan.buildPlan(details()), words, site);
  for (const part of [words.numbersHeading, words.meaningHeading, words.trainingHeading, words.freeHeading, words.nextHeading, "Samaritans on 116 123", site.sourceNote]) {
    // The plain-text version writes headings in capitals.
    assert.ok(email.text.toLowerCase().includes(part.toLowerCase()), `text: ${part}`);
    assert.ok(email.html.includes(part.replace(/'/g, "&#39;")), `html: ${part}`);
  }
});

test("no prices in the training section", () => {
  const t = plan.planText(plan.buildPlan(details({ managers: 40 })), words);
  assert.ok(!/£/.test(t.training + t.estimatedNote));
});

test("no booking link yet: the button goes to the contact page", () => {
  const email = plan.renderPlanEmail(plan.buildPlan(details()), Object.assign({}, words, { bookingUrl: "" }), site);
  assert.ok(email.html.includes('href="https://kellymariewellbeing.com/contact/"'));
  const linked = plan.renderPlanEmail(plan.buildPlan(details()), Object.assign({}, words, { bookingUrl: "https://example.com/book" }), site);
  assert.ok(linked.html.includes('href="https://example.com/book"'));
});

test("what visitors type is escaped in the HTML", () => {
  const email = plan.renderPlanEmail(plan.buildPlan(details({ name: "<b>Sam</b>", organisation: 'Acme "<script>"' })), words, site);
  assert.ok(!email.html.includes("<script>"));
  assert.ok(!email.html.includes("<b>Sam"));
  assert.ok(email.html.includes("&lt;b&gt;Sam&lt;/b&gt;"));
});

test("the email is laid out for phones (viewport set, max 600px wide, no attachment)", () => {
  const email = plan.renderPlanEmail(plan.buildPlan(details()), words, site);
  assert.ok(email.html.includes('name="viewport"'));
  assert.ok(email.html.includes("max-width:600px"));
});

section("the request handler");

const ENV = {
  RESEND_API_KEY: "re_test",
  TURNSTILE_SECRET_KEY: "ts_test",
  PLAN_FROM: "Kelly Marie Wellbeing <plan@kellymariewellbeing.com>",
  NOTIFY_TO: "contactus@kellymariewellbeing.com",
};
const goodBody = () => ({
  turnstileToken: "token",
  name: "Sam Jones",
  email: "sam@example.com",
  organisation: "Acme Ltd",
  managers: 20,
  wantsToTalk: true,
  message: "Can we talk in January?",
  consentPlan: true,
  consentUpdates: false,
  staff: 50,
  inputs: { salary: null, absentStaff: null, leavers: null, strugglingStaff: null },
  assumptions: { daysPerAbsence: 23, replacementPct: 30, productivityLossPct: 20, onCostPct: 15 },
});
const request = (body, origin) =>
  new Request("https://kellymariewellbeing.com/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin || "https://kellymariewellbeing.com" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
// Stands in for Turnstile and Resend, recording what would have been sent.
function fakeServices(opts) {
  opts = opts || {};
  const sent = [];
  const fetchFn = async (url, init) => {
    if (url.includes("turnstile")) return new Response(JSON.stringify({ success: opts.human !== false }));
    if (url.includes("resend")) {
      sent.push(JSON.parse(init.body));
      assert.strictEqual(init.headers.Authorization, "Bearer re_test");
      return new Response("{}", { status: opts.resendFails ? 500 : 200 });
    }
    throw new Error("unexpected request to " + url);
  };
  return { fetchFn, sent };
}

test("sends the plan to the visitor and the notification to us", async () => {
  const { fetchFn, sent } = fakeServices();
  const res = await handler.handle(request(goodBody()), ENV, fetchFn);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { ok: true, emailSent: true });
  assert.strictEqual(sent.length, 2);
  assert.deepStrictEqual(sent[0].to, ["sam@example.com"]);
  assert.strictEqual(sent[0].subject, "Your mental health cost plan for Acme Ltd");
  assert.ok(sent[0].html && sent[0].text, "HTML and plain text");
  assert.ok(!sent[0].attachments, "no attachment");
  assert.deepStrictEqual(sent[1].to, ["contactus@kellymariewellbeing.com"]);
  assert.strictEqual(sent[1].reply_to, "sam@example.com");
  for (const part of ["Sam Jones", "sam@example.com", "Acme Ltd", "Employees: 50", "Managers and team leaders: 20",
    "£84,300", "Consent to store details and send the plan: Yes", "Consent to occasional updates: No",
    "Would like to talk about training: Yes", "Can we talk in January?", "Plan email sent: Yes"]) {
    assert.ok(sent[1].text.includes(part), `notification should include ${part}`);
  }
});

test("settings pasted with quote marks or spaces still work", async () => {
  const { fetchFn, sent } = fakeServices();
  const env = Object.assign({}, ENV, { PLAN_FROM: '  "Kelly Marie Wellbeing <plan@kellymariewellbeing.com>" ', NOTIFY_TO: "“contactus@kellymariewellbeing.com”" });
  await handler.handle(request(goodBody()), env, fetchFn);
  assert.strictEqual(sent[0].from, "Kelly Marie Wellbeing <plan@kellymariewellbeing.com>");
  assert.deepStrictEqual(sent[1].to, ["contactus@kellymariewellbeing.com"]);
  const quotedName = fakeServices();
  await handler.handle(request(goodBody()), Object.assign({}, ENV, { PLAN_FROM: '"Kelly Marie Wellbeing" <plan@kellymariewellbeing.com>' }), quotedName.fetchFn);
  assert.strictEqual(quotedName.sent[0].from, '"Kelly Marie Wellbeing" <plan@kellymariewellbeing.com>', "a quoted name is left alone");
});

test("sends nothing when the spam check fails", async () => {
  const { fetchFn, sent } = fakeServices({ human: false });
  const res = await handler.handle(request(goodBody()), ENV, fetchFn);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(sent.length, 0);
});

test("sends nothing without a spam-check token", async () => {
  const { fetchFn, sent } = fakeServices();
  const res = await handler.handle(request(Object.assign(goodBody(), { turnstileToken: "" })), ENV, fetchFn);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(sent.length, 0);
});

test("sends nothing when it isn't set up (no keys)", async () => {
  const { fetchFn, sent } = fakeServices();
  const res = await handler.handle(request(goodBody()), {}, fetchFn);
  assert.strictEqual(res.status, 503);
  assert.strictEqual(sent.length, 0);
});

test("refuses requests from other websites", async () => {
  const { fetchFn, sent } = fakeServices();
  const res = await handler.handle(request(goodBody(), "https://example.com"), ENV, fetchFn);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(sent.length, 0);
});

for (const [what, change] of [
  ["no consent", { consentPlan: false }],
  ["no name", { name: "  " }],
  ["a bad email address", { email: "not-an-email" }],
  ["managers that aren't a whole number", { managers: "abc" }],
  ["no headcount", { staff: null }],
  ["a negative figure", { inputs: { leavers: -3 } }],
]) {
  test(`refuses ${what}, sending nothing`, async () => {
    const { fetchFn, sent } = fakeServices();
    const res = await handler.handle(request(Object.assign(goodBody(), change)), ENV, fetchFn);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(sent.length, 0);
  });
}

test("refuses a body that isn't JSON", async () => {
  const { fetchFn } = fakeServices();
  assert.strictEqual((await handler.handle(request("{nope"), ENV, fetchFn)).status, 400);
});

test("blank managers: the notification says it was estimated", async () => {
  const { fetchFn, sent } = fakeServices();
  await handler.handle(request(Object.assign(goodBody(), { managers: null })), ENV, fetchFn);
  assert.ok(sent[1].text.includes("Managers and team leaders: 5 (estimated from headcount)"));
});

test("if the plan email fails, we're still told, and the page hears it wasn't sent", async () => {
  const { fetchFn, sent } = fakeServices({ resendFails: true });
  const res = await handler.handle(request(goodBody()), ENV, fetchFn);
  assert.deepStrictEqual(await res.json(), { ok: true, emailSent: false, error: "resend_500" });
  assert.strictEqual(sent.length, 2);
  assert.ok(sent[1].text.includes("Plan email sent: No"));
});

(async () => {
  for (const [name, fn] of tests) {
    if (!fn) {
      console.log(`\n${name}\n`);
      continue;
    }
    try {
      await fn();
      console.log(`  ok    ${name}`);
      passed++;
    } catch (error) {
      console.log(`  FAIL  ${name}\n        ${error.message.split("\n")[0]}`);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed} passed`);
})();
