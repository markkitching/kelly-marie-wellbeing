#!/usr/bin/env node
/**
 * The cost calculator's arithmetic, checked against worked examples done by hand.
 *
 * Run after changing src/js/cost-calculator.js or any of its default figures.
 */
const assert = require("assert");
const C = require("../src/js/cost-calculator.js");

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); passed++; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message}`); process.exitCode = 1; }
};
const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 0.01, `${label}: expected ${expected}, got ${actual}`);

const blank = { salary: null, absentStaff: null, leavers: null, strugglingStaff: null };

console.log("headcount estimate\n");

test("50 staff × £1,686 per employee = £84,300", () => {
  const r = C.headcountEstimate(50);
  near(r.presenteeism, 39650, "presenteeism (50 × £793)");
  near(r.turnover, 32500, "turnover (50 × £650)");
  near(r.absence, 12150, "absence (50 × £243)");
  near(r.total, 84300, "total");
});

test("per-employee figures still add up to Deloitte's £50.6bn across 30m employees", () => {
  const r = C.headcountEstimate(30e6);
  assert.ok(Math.abs(r.total - 50.6e9) < 0.05e9, `got £${(r.total / 1e9).toFixed(2)}bn`);
});

console.log("\nyour figures\n");

test("all blank → identical to the headcount estimate", () => {
  const r = C.ownEstimate({ staff: 50, ...blank });
  assert.strictEqual(r.used, 0);
  near(r.total, 84300, "total");
  C.CATEGORIES.forEach((k) => assert.strictEqual(r[k].source, "headcount"));
});

test("worked example: 50 staff, £30,000 salary, 3 off, 2 left, 5 struggling", () => {
  // loaded pay = 30,000 × 1.15 = 34,500; daily = 34,500 / 230 = 150
  // absence      = 3 × 23 days × £150         = 10,350
  // turnover     = 2 × 30,000 × 30%           = 18,000
  // presenteeism = 5 × 34,500 × 20%           = 34,500
  const r = C.ownEstimate({ staff: 50, salary: 30000, absentStaff: 3, leavers: 2, strugglingStaff: 5 });
  near(r.absence.value, 10350, "absence");
  near(r.turnover.value, 18000, "turnover");
  near(r.presenteeism.value, 34500, "presenteeism");
  near(r.total, 62850, "total");
  assert.strictEqual(r.used, 3);
});

test("a blank category falls back to its headcount figure", () => {
  // Only leavers given: turnover = 4 × 40,000 × 30% = 48,000; the others stay headcount.
  const r = C.ownEstimate({ staff: 100, ...blank, salary: 40000, leavers: 4 });
  near(r.turnover.value, 48000, "turnover");
  assert.strictEqual(r.turnover.source, "yours");
  near(r.presenteeism.value, 79300, "presenteeism (100 × £793)");
  near(r.absence.value, 24300, "absence (100 × £243)");
  assert.strictEqual(r.presenteeism.source, "headcount");
  near(r.total, 151600, "total");
});

test("counts without a salary can't be priced, so say so and use headcount", () => {
  const r = C.ownEstimate({ staff: 20, ...blank, leavers: 3 });
  assert.strictEqual(r.used, 0);
  assert.strictEqual(r.needsSalary, true);
  near(r.total, 20 * 1686, "total");
});

test("a salary on its own changes nothing — there's nothing to price yet", () => {
  const r = C.ownEstimate({ staff: 20, ...blank, salary: 50000 });
  assert.strictEqual(r.used, 0);
  assert.strictEqual(r.needsSalary, false);
  near(r.total, 20 * 1686, "total");
});

test("zero is a real answer, not a blank: 0 off sick costs £0", () => {
  const r = C.ownEstimate({ staff: 10, ...blank, salary: 30000, absentStaff: 0 });
  assert.strictEqual(r.absence.source, "yours");
  near(r.absence.value, 0, "absence");
});

test("edited assumptions are used: 10 days, 50% replacement, 10% productivity, 0% on-costs", () => {
  const a = { daysPerAbsence: 10, replacementPct: 50, productivityLossPct: 10, onCostPct: 0, workingDays: 250 };
  // daily = 25,000 / 250 = 100 → absence 2 × 10 × 100 = 2,000
  // turnover 1 × 25,000 × 50% = 12,500; presenteeism 4 × 25,000 × 10% = 10,000
  const r = C.ownEstimate({ staff: 10, salary: 25000, absentStaff: 2, leavers: 1, strugglingStaff: 4 }, a);
  near(r.absence.value, 2000, "absence");
  near(r.turnover.value, 12500, "turnover");
  near(r.presenteeism.value, 10000, "presenteeism");
});

console.log("\ninput checking\n");

test("blank is blank, not zero", () => assert.deepStrictEqual(C.parseField("  "), { value: null, error: null }));
test("negatives are rejected", () => assert.ok(C.parseField("-5").error));
test("a headcount of -5 asks for 1 or more", () =>
  assert.strictEqual(C.parseField("-5", { integer: true, min: 1 }).error, "Please enter a number of 1 or more."));
test("words are rejected", () => assert.ok(C.parseField("ten").error));
test("scientific notation is rejected", () => assert.ok(C.parseField("1e3").error));
test("fractions of people are rejected", () => assert.ok(C.parseField("2.5", { integer: true }).error));
test("£ and thousands separators are accepted in a salary", () =>
  assert.strictEqual(C.parseField("£35,000").value, 35000));
test("range limits apply", () => assert.ok(C.parseField("120", { max: 100 }).error));
test("a trailing point is fine, so typing 22.5 never passes through an error", () => {
  assert.strictEqual(C.parseField("22.").value, 22);
  assert.strictEqual(C.parseField("32,000.").value, 32000);
  assert.strictEqual(C.parseField(".5").value, 0.5);
});
test("a point on its own isn't a number", () => assert.ok(C.parseField(".").error));

console.log("\nformatting\n");

test("GBP with thousands separators, to the pound", () => {
  assert.strictEqual(C.formatGBP(1234567.6), "£1,234,568");
  assert.strictEqual(C.formatGBP(0), "£0");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
