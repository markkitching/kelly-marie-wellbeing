/**
 * Drives the cost calculator block (src/_includes/blocks/calculator.njk): reads the
 * fields, asks cost-calculator.js for the numbers, and draws them.
 *
 * Everything is worked out in the browser. The only thing ever sent anywhere is the
 * summary form, and only when the visitor submits it.
 */
(function () {
  "use strict";

  var root = document.getElementById("calculator");
  var configEl = document.getElementById("calc-config");
  if (!root || !configEl || !window.CostCalculator) return;

  var C = window.CostCalculator;
  var config = JSON.parse(configEl.textContent);
  var $ = function (sel) { return root.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
  var fmt = C.formatGBP;
  var UNLOCK_KEY = "kmw-calc-unlocked";

  // ── Fields ──────────────────────────────────────
  var staffInput = $("[data-calc-staff]");
  var range = $("[data-calc-range]");

  // Each optional field and how strictly it's checked.
  var FIELD_RULES = {
    salary: { min: 0, max: 10000000 },
    absentStaff: { integer: true, min: 0 },
    leavers: { integer: true, min: 0 },
    strugglingStaff: { integer: true, min: 0 },
    daysPerAbsence: { min: 0, max: 365 },
    replacementPct: { min: 0, max: 500 },
    productivityLossPct: { min: 0, max: 100 },
    onCostPct: { min: 0, max: 100 },
  };
  var fields = {};
  $$("[data-calc-field]").forEach(function (el) { fields[el.dataset.calcField] = el; });

  function showError(input, message) {
    var box = document.getElementById(input.id + "-error");
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (box) {
      box.textContent = message || "";
      box.classList.toggle("hidden", !message);
    }
  }

  function readField(name) {
    var input = fields[name];
    var result = C.parseField(input.value, FIELD_RULES[name]);
    showError(input, result.error);
    return result.value;
  }

  // The headcount box is type=number for its spinner, so the browser can hand back ""
  // for something like "12abc" — validity.badInput tells that apart from a real blank.
  function readStaff() {
    var result = staffInput.validity && staffInput.validity.badInput
      ? { value: null, error: "Please enter a number." }
      : C.parseField(staffInput.value, { integer: true, min: 1, max: 1000000 });
    if (result.value == null && !result.error) result.error = "Please enter how many people you employ.";
    showError(staffInput, result.error);
    return result.value;
  }

  function readAssumptions() {
    var a = {};
    Object.keys(config.assumptions).forEach(function (key) {
      // A blank or invalid assumption uses its default rather than breaking the maths.
      var value = fields[key] ? readField(key) : null;
      a[key] = value == null ? config.assumptions[key] : value;
    });
    return a;
  }

  // ── Working it out ──────────────────────────────
  var state = null;

  function compute() {
    var staff = readStaff();
    var inputs = {
      staff: staff,
      salary: readField("salary"),
      absentStaff: readField("absentStaff"),
      leavers: readField("leavers"),
      strugglingStaff: readField("strugglingStaff"),
    };
    var assumptions = readAssumptions();

    // Counts bigger than the workforce are almost certainly a typo; say so, but still
    // work it out — the visitor may simply not have updated the headcount yet.
    ["absentStaff", "leavers", "strugglingStaff"].forEach(function (key) {
      if (staff != null && inputs[key] != null && inputs[key] > staff) {
        var el = document.getElementById(fields[key].id + "-error");
        el.textContent = "That's more than the " + staff + " people you employ. Is the headcount right?";
        el.classList.remove("hidden");
      }
    });

    return {
      staff: staff,
      inputs: inputs,
      assumptions: assumptions,
      headcount: staff == null ? null : C.headcountEstimate(staff, config.perEmployee),
      yours: staff == null ? null : C.ownEstimate(inputs, assumptions, config.perEmployee),
    };
  }

  function render() {
    state = compute();
    var h = state.headcount, y = state.yours;
    var perEmployee = config.perEmployee.presenteeism + config.perEmployee.turnover + config.perEmployee.absence;

    $("[data-calc-per]").textContent = fmt(perEmployee);
    $("[data-calc-total]").textContent = h ? fmt(h.total) : "-";

    var usingYours = !!(y && y.used);
    $("[data-calc-yours-summary]").classList.toggle("hidden", !usingYours);
    if (usingYours) {
      $("[data-calc-yours-total]").textContent = fmt(y.total);
      var diff = y.total - h.total;
      $("[data-calc-yours-diff]").textContent =
        (Math.round(diff) === 0 ? "The same as" : fmt(Math.abs(diff)) + (diff > 0 ? " more than" : " less than")) +
        " the headcount estimate, using your figures for " + y.used + " of 3 costs.";
    }

    var shown = usingYours ? y.total : (h ? h.total : 0);
    C.CATEGORIES.forEach(function (key) {
      var row = $('[data-calc-row="' + key + '"]');
      row.querySelector("[data-calc-part]").textContent = h ? fmt(h[key]) : "-";
      var yoursEl = row.querySelector("[data-calc-part-yours]");
      var fromYours = usingYours && y[key].source === "yours";
      yoursEl.classList.toggle("hidden", !fromYours);
      if (fromYours) yoursEl.textContent = "Your figures: " + fmt(y[key].value);
      var value = usingYours ? y[key].value : (h ? h[key] : 0);
      row.querySelector("[data-calc-bar]").style.width = (shown ? (value / shown) * 100 : 0) + "%";
    });

    var status = $("[data-calc-more-status]");
    var message = "";
    if (y && y.needsSalary) message = "Add an average salary so we can put a cost on the numbers you've entered.";
    else if (y && y.used) message = "Using your figures for " + y.used + " of 3 costs. The rest use the headcount estimate.";
    else if (state.inputs.salary != null) message = "Now add any of the staff numbers to use your salary.";
    status.textContent = message;
    status.classList.toggle("hidden", !message);


    renderWorkings();
  }

  // ── The workings (free, under "How we calculated this") ──
  function workingFor(key) {
    var y = state.yours, a = state.assumptions;
    if (!y) return "";
    var item = y[key];
    if (item.source === "headcount") {
      return state.staff + " staff × " + fmt(config.perEmployee[key]) + " per employee (headcount estimate)";
    }
    var w = item.working;
    if (key === "absence") {
      return w.count + " staff off × " + a.daysPerAbsence + " days × " + fmt(w.dailyPay) +
        " a day (salary plus " + a.onCostPct + "% on-costs, over " + a.workingDays + " working days)";
    }
    if (key === "turnover") return w.count + " leavers × " + fmt(w.salary) + " salary × " + w.pct + "% to replace";
    return w.count + " staff struggling × " + fmt(w.loadedPay) + " (salary plus " + a.onCostPct + "% on-costs) × " +
      w.pct + "% productivity lost";
  }

  function labelFor(key) {
    for (var i = 0; i < config.categories.length; i++) {
      if (config.categories[i].key === key) return config.categories[i].label;
    }
    return key;
  }

  function renderWorkings() {
    var body = $("[data-calc-workings]");
    if (!body || !state.yours) return;
    body.innerHTML = "";
    C.CATEGORIES.forEach(function (key) {
      var tr = document.createElement("tr");
      tr.className = "border-b border-gray-100 align-top";
      [labelFor(key), workingFor(key), fmt(state.yours[key].value)].forEach(function (text, i) {
        var td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) td.scope = "row";
        td.className = i === 0 ? "py-3 pr-4 font-medium text-forest whitespace-nowrap"
          : i === 1 ? "py-3 pr-4 text-gray-700" : "py-3 text-right font-semibold text-forest tabular-nums whitespace-nowrap";
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    var total = document.createElement("tr");
    total.innerHTML = '<th scope="row" class="pt-3 pr-4 font-semibold text-forest">Total</th><td class="pt-3 pr-4"></td>' +
      '<td class="pt-3 text-right font-semibold text-forest tabular-nums whitespace-nowrap"></td>';
    total.lastChild.textContent = fmt(state.yours.total);
    body.appendChild(total);
  }

  // A plain-text version, sent with the form so Kelly sees what the visitor saw.
  function summaryText() {
    var s = state, lines = [];
    lines.push("Employees: " + s.staff);
    lines.push("Headcount estimate: " + fmt(s.headcount.total) + " a year");
    if (s.yours.used) lines.push("Using their figures: " + fmt(s.yours.total) + " a year");
    ["salary", "absentStaff", "leavers", "strugglingStaff"].forEach(function (k) {
      if (s.inputs[k] != null) lines.push(fields[k].labels[0].textContent.trim() + ": " + (k === "salary" ? fmt(s.inputs[k]) : s.inputs[k]));
    });
    lines.push("");
    C.CATEGORIES.forEach(function (k) { lines.push(labelFor(k) + ": " + fmt(s.yours[k].value) + " (" + workingFor(k) + ")"); });
    lines.push("");
    lines.push("Assumptions: " + s.assumptions.daysPerAbsence + " days per absence, " + s.assumptions.replacementPct +
      "% replacement cost, " + s.assumptions.productivityLossPct + "% productivity lost, " + s.assumptions.onCostPct + "% on-costs");
    return lines.join("\n");
  }

  function setUnlocked(unlocked) {
    $("[data-calc-locked]").classList.toggle("hidden", unlocked);
    $("[data-calc-unlocked]").classList.toggle("hidden", !unlocked);
  }

  // ── The form ────────────────────────────────────
  var form = $("[data-calc-form]");
  var submitBtn = $("[data-calc-submit]");
  var submitLabel = $("[data-calc-submit-label]");
  var formError = $("[data-calc-form-error]");
  var talkBox = $("[data-calc-talk-box]");

  talkBox.addEventListener("change", function () {
    $("[data-calc-message]").classList.toggle("hidden", !talkBox.checked);
  });

  function validateForm() {
    var ok = true;
    var name = form.elements.name, email = form.elements.email, consent = form.elements.consent;
    var checks = [
      [name, !name.value.trim() ? "Please enter your name." : ""],
      [email, !email.value.trim() ? "Please enter your email address." : !email.validity.valid ? "Please enter a valid email address." : ""],
      [consent, !consent.checked ? "Please tick to agree before we can provide your summary." : ""],
    ];
    checks.forEach(function (c) {
      showError(c[0], c[1]);
      if (c[1] && ok) { ok = false; c[0].focus(); }
    });
    return ok;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.classList.add("hidden");
    if (!state || state.staff == null) {
      formError.textContent = "Please enter how many people you employ first.";
      formError.classList.remove("hidden");
      staffInput.focus();
      return;
    }
    if (!validateForm()) return;
    if (!form.action || form.action.indexOf("formspree.io") === -1) {
      formError.textContent = "This form isn't set up yet. Please email " + config.contactEmail + ".";
      formError.classList.remove("hidden");
      return;
    }

    $("[data-calc-form-estimate]").value = summaryText();
    submitBtn.disabled = true;
    submitLabel.textContent = "Sending…";

    fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("Server error");
        try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch (err) { /* private mode — fine */ }
        if (talkBox.checked) {
          $("[data-calc-thanks]").textContent = "Thank you. We'll be in touch about training soon. Download your summary below; it reflects the figures currently entered above.";
        }
        setUnlocked(true);
        $("#calc-summary").focus();
      })
      .catch(function () {
        formError.textContent = "Sorry, that didn't send. Please try again, or email " + config.contactEmail + ".";
        formError.classList.remove("hidden");
      })
      .then(function () {
        submitBtn.disabled = false;
        submitLabel.textContent = "Get my summary";
      });
  });

  // "Talk to us" opens the same form with the box ticked. Once they've already sent it,
  // the contact page is the better next step, so the link is left to do its job.
  var talk = $("[data-calc-talk]");
  if (talk) talk.addEventListener("click", function (e) {
    if (!$("[data-calc-locked]").classList.contains("hidden")) {
      e.preventDefault();
      talkBox.checked = true;
      $("[data-calc-message]").classList.remove("hidden");
      $("#calc-summary").scrollIntoView({ behavior: "smooth", block: "start" });
      form.elements.name.focus({ preventScroll: true });
    }
  });

  // ── Printable summary ───────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  $("[data-calc-download]").addEventListener("click", function () {
    var s = state;
    if (!s || !s.yours) return;
    var org = form.elements.organisation.value.trim();
    var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    var rows = C.CATEGORIES.map(function (k) {
      return "<tr><th>" + esc(labelFor(k)) + "</th><td>" + esc(workingFor(k)) + "</td><td class=n>" + esc(fmt(s.yours[k].value)) + "</td></tr>";
    }).join("");
    var a = s.assumptions;
    var html = "<!doctype html><html lang=en><head><meta charset=utf-8><title>Mental health cost estimate</title><style>" +
      "body{font:14px/1.5 Georgia,serif;color:#1f2937;max-width:720px;margin:32px auto;padding:0 24px}" +
      "h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}.muted{color:#4b5563;font-size:12px}" +
      "table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:8px 8px 8px 0;border-bottom:1px solid #e5e7eb}" +
      ".n{text-align:right;white-space:nowrap}.big{font-size:28px;font-weight:bold;margin:8px 0}" +
      "@media print{body{margin:0}}</style></head><body>" +
      "<p class=muted>" + esc(config.orgName) + " · " + esc(today) + "</p>" +
      "<h1>What poor mental health could be costing " + (org ? esc(org) : "your organisation") + "</h1>" +
      "<p class=big>" + esc(fmt(s.yours.used ? s.yours.total : s.headcount.total)) + " a year</p>" +
      "<p>Based on " + s.staff + " employees." + (s.yours.used
        ? " Headcount estimate: " + esc(fmt(s.headcount.total)) + "; using your figures for " + s.yours.used + " of 3 costs: " + esc(fmt(s.yours.total)) + "."
        : "") + "</p>" +
      "<h2>Breakdown</h2><table>" + rows + "<tr><th>Total</th><td></td><td class=n><strong>" + esc(fmt(s.yours.total)) + "</strong></td></tr></table>" +
      "<h2>Our assumptions</h2><p>" + a.daysPerAbsence + " working days lost per absence; replacing a leaver costs " + a.replacementPct +
      "% of salary; " + a.productivityLossPct + "% productivity lost per struggling employee; " + a.onCostPct + "% employer on-costs; " +
      a.workingDays + " working days a year. Days lost is rounded from Health and Safety Executive 2024/25 figures; the others are our own working assumptions, not published figures.</p>" +
      (config.sourceNote ? "<h2>About this estimate</h2><p class=muted>" + esc(config.sourceNote) + "</p>" : "") +
      (config.roiText ? "<p class=muted>" + esc(config.roiText) + "</p>" : "") +
      "<h2>Talk to us</h2><p>" + esc(config.contactEmail) + " · " + esc(config.calculatorUrl) + "</p>" +
      "<script>window.onload=function(){window.print()}<\/script></body></html>";
    var win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups for this site to download the summary."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  });

  // ── Share ───────────────────────────────────────
  var shareBtn = $("[data-calc-share]");
  var shareLabel = $("[data-calc-share-label]");
  shareBtn.addEventListener("click", function () {
    // The calculator's own page, whose link preview is written for it, even when this
    // copy sits on the Training page. location.origin so previews share themselves.
    var url = location.origin + new URL(config.calculatorUrl).pathname;
    if (navigator.share) {
      navigator.share({ title: config.heading, url: url }).catch(function () {});
      return;
    }
    var done = function () {
      shareLabel.textContent = "Link copied";
      setTimeout(function () { shareLabel.textContent = "Share this calculator"; }, 2500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); });
    else window.prompt("Copy this link:", url);
  });

  // ── Wiring ──────────────────────────────────────
  staffInput.addEventListener("input", function () {
    render();
    if (state.staff != null) range.value = Math.min(state.staff, Number(range.max));
  });
  range.addEventListener("input", function () {
    staffInput.value = range.value;
    render();
  });
  Object.keys(fields).forEach(function (k) { fields[k].addEventListener("input", render); });
  $("[data-calc-reset]").addEventListener("click", function () {
    Object.keys(config.assumptions).forEach(function (k) { if (fields[k]) fields[k].value = config.assumptions[k]; });
    render();
  });

  var unlocked = false;
  try { unlocked = sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch (err) { /* private mode — fine */ }
  setUnlocked(unlocked);
  render();
})();
