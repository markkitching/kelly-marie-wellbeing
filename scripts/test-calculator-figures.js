#!/usr/bin/env node
/**
 * The calculator's figures come from the editor's "Cost calculator" entry
 * (src/content/calculator.json). A figure left blank falls back to the default in
 * src/js/cost-calculator.js. This builds a copy of the site with some figures changed
 * and some cleared, and checks the page uses exactly those.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const C = require("../src/js/cost-calculator.js");
const { withBuiltCopy } = require("./lib/build-copy.js");

const ROOT = path.join(__dirname, "..");

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); passed++; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message}`); process.exitCode = 1; }
};

console.log("calculator figures\n");

// The editor might store a cleared number as null, an empty string or no key at all.
const edits = {
  "calculator.json": (c) => {
    c.presenteeismCost = 800;
    c.turnoverCost = null;
    c.absenceCost = "";
    c.daysPerAbsence = 10;
    delete c.onCostPct;
  },
};

withBuiltCopy(edits, (site) => {
  const html = fs.readFileSync(path.join(site, "cost-calculator", "index.html"), "utf8");
  const config = JSON.parse(html.match(/<script id="calc-config" type="application\/json">(.*?)<\/script>/s)[1]);

  test("figures entered in the editor are used", () => {
    assert.strictEqual(config.perEmployee.presenteeism, 800);
    assert.strictEqual(config.assumptions.daysPerAbsence, 10);
  });
  test("cleared figures fall back to the defaults in cost-calculator.js, whichever way they're cleared", () => {
    assert.strictEqual(config.perEmployee.turnover, C.PER_EMPLOYEE.turnover, "null");
    assert.strictEqual(config.perEmployee.absence, C.PER_EMPLOYEE.absence, "empty string");
    assert.strictEqual(config.assumptions.onCostPct, C.ASSUMPTIONS.onCostPct, "missing");
    assert.strictEqual(config.assumptions.workingDays, C.ASSUMPTIONS.workingDays, "working days");
  });
  test("the figures shown before the script runs use them too", () => {
    const perEmployee = 800 + C.PER_EMPLOYEE.turnover + C.PER_EMPLOYEE.absence;
    assert.ok(html.includes(C.formatGBP(perEmployee * 50)), `expected ${C.formatGBP(perEmployee * 50)} for 50 staff`);
    assert.ok(html.includes(C.formatGBP(800)), "the £800 per employee in the workings");
  });
});

test("the editor's hints quote the same defaults as cost-calculator.js", () => {
  const forms = fs.readFileSync(path.join(ROOT, "scripts", "base-forms.yml"), "utf8");
  const hint = (name) => {
    const m = forms.match(new RegExp(`name: ${name}\\n(?:.*\\n)*?\\s+description: .*?default \\(£?([\\d.]+)`));
    assert.ok(m, `no default mentioned for ${name}`);
    return Number(m[1]);
  };
  const expected = {
    presenteeismCost: C.PER_EMPLOYEE.presenteeism,
    turnoverCost: C.PER_EMPLOYEE.turnover,
    absenceCost: C.PER_EMPLOYEE.absence,
    daysPerAbsence: C.ASSUMPTIONS.daysPerAbsence,
    replacementPct: C.ASSUMPTIONS.replacementPct,
    productivityLossPct: C.ASSUMPTIONS.productivityLossPct,
    onCostPct: C.ASSUMPTIONS.onCostPct,
  };
  for (const [name, value] of Object.entries(expected)) assert.strictEqual(hint(name), value, name);
});

test("the figures saved in the editor are usable numbers, or blank", () => {
  const calc = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "content", "calculator.json"), "utf8"));
  const fields = ["presenteeismCost", "turnoverCost", "absenceCost", "daysPerAbsence",
    "replacementPct", "productivityLossPct", "onCostPct"];
  for (const name of fields) {
    const v = calc[name];
    if (v == null || v === "") continue;
    assert.ok(typeof v === "number" && Number.isFinite(v) && v >= 0, `${name} is ${JSON.stringify(v)}`);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
