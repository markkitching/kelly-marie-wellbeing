/**
 * The cost calculator's arithmetic, kept apart from the page so it can be tested on its
 * own (scripts/test-calculator.js). No DOM in here — the page passes numbers in and
 * draws whatever comes back.
 *
 * Two estimates:
 *
 *   headcount  staff × a per-employee cost for each category, from Deloitte's UK totals.
 *   yours      the visitor's own counts and salary, run through the assumptions below.
 *              A category they haven't given figures for keeps its headcount value, so
 *              the two always cover the same three costs and can be compared directly.
 *
 * Loaded in the browser as window.CostCalculator, and by Node via require().
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CostCalculator = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // The three costs, in the order they're shown.
  var CATEGORIES = ["presenteeism", "turnover", "absence"];

  // Per-employee, per-year. Deloitte (2024) put the UK totals at £23.8bn presenteeism,
  // £19.5bn turnover and £7.3bn absence; dividing by roughly 30 million employees is our
  // own approximation, not Deloitte's.
  var PER_EMPLOYEE = { presenteeism: 793, turnover: 650, absence: 243 };

  // Shown and editable on the page. Days lost is rounded from HSE's 2024/25 average of
  // 22.9 days per case of work-related stress, depression or anxiety; the rest are our
  // own assumptions, not sourced figures.
  var ASSUMPTIONS = {
    daysPerAbsence: 23,       // working days lost per person off with a mental health reason
    replacementPct: 30,       // cost of replacing a leaver, as % of their salary
    productivityLossPct: 20,  // productivity lost while someone is struggling, %
    onCostPct: 15,            // employer NI + pension on top of salary, %
    workingDays: 230,         // working days in a year
  };

  /**
   * A field's value as a number, or null when it's blank or unusable.
   * Rejects negatives and non-numbers rather than guessing what was meant; `integer`
   * also rejects fractions, for counts of people.
   * Returns { value, error } so the page can say what's wrong next to the field.
   */
  function parseField(raw, opts) {
    opts = opts || {};
    var text = String(raw == null ? "" : raw).replace(/[£,\s]/g, "");
    if (text === "") return { value: null, error: null };
    if (!/^\d*\.?\d+$/.test(text)) {
      if (!/^-/.test(text)) return { value: null, error: "Please enter a number." };
      return { value: null, error: "Please enter a number of " + (opts.min || 0) + " or more." };
    }
    var n = Number(text);
    if (opts.integer && n % 1 !== 0) return { value: null, error: "Please enter a whole number." };
    if (opts.min != null && n < opts.min) return { value: null, error: "Please enter a number of " + opts.min + " or more." };
    if (opts.max != null && n > opts.max) return { value: null, error: "Please enter no more than " + opts.max + "." };
    return { value: n, error: null };
  }

  function headcountEstimate(staff, perEmployee) {
    var per = perEmployee || PER_EMPLOYEE;
    var out = { total: 0 };
    CATEGORIES.forEach(function (key) {
      out[key] = staff * (per[key] || 0);
      out.total += out[key];
    });
    return out;
  }

  /**
   * inputs: { staff, salary, absentStaff, leavers, strugglingStaff } — null for blank.
   * Returns per category { value, source: "yours" | "headcount", working }, plus total,
   * `used` (how many categories came from the visitor's figures) and `needsSalary`
   * (counts were given but there's no salary to price them with).
   */
  function ownEstimate(inputs, assumptions, perEmployee) {
    var a = assumptions || ASSUMPTIONS;
    var base = headcountEstimate(inputs.staff || 0, perEmployee);
    var salary = inputs.salary;
    var loadedPay = salary == null ? null : salary * (1 + a.onCostPct / 100);
    var dailyPay = loadedPay == null || !a.workingDays ? null : loadedPay / a.workingDays;

    var own = {
      absence: inputs.absentStaff == null || dailyPay == null ? null : {
        value: inputs.absentStaff * a.daysPerAbsence * dailyPay,
        working: { count: inputs.absentStaff, days: a.daysPerAbsence, dailyPay: dailyPay },
      },
      turnover: inputs.leavers == null || salary == null ? null : {
        value: inputs.leavers * salary * a.replacementPct / 100,
        working: { count: inputs.leavers, salary: salary, pct: a.replacementPct },
      },
      presenteeism: inputs.strugglingStaff == null || loadedPay == null ? null : {
        value: inputs.strugglingStaff * loadedPay * a.productivityLossPct / 100,
        working: { count: inputs.strugglingStaff, loadedPay: loadedPay, pct: a.productivityLossPct },
      },
    };

    var out = { total: 0, used: 0, needsSalary: false };
    CATEGORIES.forEach(function (key) {
      if (own[key]) {
        out[key] = { value: own[key].value, source: "yours", working: own[key].working };
        out.used++;
      } else {
        out[key] = { value: base[key], source: "headcount", working: null };
      }
      out.total += out[key].value;
    });
    out.needsSalary = salary == null &&
      (inputs.absentStaff != null || inputs.leavers != null || inputs.strugglingStaff != null);
    return out;
  }

  /** What cutting `total` by `pct` per cent would save. Illustrative only. */
  function illustrativeSaving(total, pct) {
    return total * pct / 100;
  }

  var gbp = typeof Intl !== "undefined"
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
    : null;

  /** £ with thousands separators, rounded to the pound. */
  function formatGBP(n) {
    var rounded = Math.round(n);
    if (gbp) return gbp.format(rounded);
    return "£" + String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  return {
    CATEGORIES: CATEGORIES,
    PER_EMPLOYEE: PER_EMPLOYEE,
    ASSUMPTIONS: ASSUMPTIONS,
    parseField: parseField,
    headcountEstimate: headcountEstimate,
    ownEstimate: ownEstimate,
    illustrativeSaving: illustrativeSaving,
    formatGBP: formatGBP,
  };
});
