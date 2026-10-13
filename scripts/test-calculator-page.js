#!/usr/bin/env node
/**
 * The cost calculator page, driven in a real browser: the part between the sums
 * (tested in test-calculator.js) and what the visitor sees.
 *
 * Needs the built site, so run `npm run build` first. Nothing leaves the machine: the
 * site is served locally, Formspree is faked and every other host is blocked. The
 * Tailwind CDN is swapped for the one rule these checks rely on, `.hidden`.
 */
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const C = require("../src/js/cost-calculator.js");

const SITE = path.join(__dirname, "..", "_site");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// The headcount estimate for 50 staff, from the figures in the editor (blank ones use
// the defaults), so changing a figure there doesn't break this test.
const calc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "content", "calculator.json"), "utf8"));
const figure = (v, fallback) => (v == null || v === "" || isNaN(Number(v)) ? fallback : Number(v));
const FIFTY = C.formatGBP(50 * (
  figure(calc.presenteeismCost, C.PER_EMPLOYEE.presenteeism) +
  figure(calc.turnoverCost, C.PER_EMPLOYEE.turnover) +
  figure(calc.absenceCost, C.PER_EMPLOYEE.absence)));

let passed = 0;
let beforeEach = async () => {};
const test = async (name, fn) => {
  try { await beforeEach(); await fn(); console.log(`  ok    ${name}`); passed++; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message.split("\n")[0]}`); process.exitCode = 1; }
};

(async () => {
  if (!fs.existsSync(path.join(SITE, "cost-calculator", "index.html"))) {
    console.error("No built site found. Run `npm run build` first.");
    process.exit(1);
  }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const errors = [];

  async function openCalculator() {
    const context = await browser.newContext();
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (url.includes("formspree.io")) return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/cost-calculator/`);
    // The optional fields and the workings sit in collapsed panels; open them all.
    await page.evaluate(() => document.querySelectorAll("#calculator details").forEach((d) => { d.open = true; }));
    return page;
  }

  const text = (page, sel) => page.locator(sel).first().innerText();
  const workings = (page) => page.$$eval("[data-calc-workings] tr", (rows) => rows.map((r) => r.textContent));
  const errorFor = (page, id) => page.locator(`#${id}-error`);
  // Each check starts from 50 staff and blank optional fields, so one failure can't
  // leave values behind that break the next.
  const reset = (page) => page.evaluate(() => {
    const fire = (el) => el.dispatchEvent(new Event("input", { bubbles: true }));
    ["calc-salary", "calc-absent", "calc-leavers", "calc-struggling"].forEach((id) => {
      const el = document.getElementById(id); el.value = ""; fire(el);
    });
    const staff = document.getElementById("calc-staff"); staff.value = "50"; fire(staff);
  });

  console.log("cost calculator page\n");
  const page = await openCalculator();
  beforeEach = () => reset(page);

  await test(`50 staff shows the ${FIFTY} headcount estimate`, async () => {
    await page.fill("#calc-staff", "50");
    assert.strictEqual(await text(page, "[data-calc-total]"), FIFTY);
  });

  await test("clearing the headcount clears the workings table too", async () => {
    await page.fill("#calc-staff", "50");
    assert.ok((await workings(page)).some((r) => r.includes(FIFTY)), "workings should show the total first");
    await page.fill("#calc-staff", "");
    assert.strictEqual(await text(page, "[data-calc-total]"), "-");
    const rows = await workings(page);
    assert.ok(!rows.some((r) => r.includes("£")), `old figures still shown: ${rows.join(" | ")}`);
  });

  await test("a salary of 0 is rejected and the estimate falls back to headcount", async () => {
    await page.fill("#calc-staff", "50");
    await page.fill("#calc-salary", "0");
    await page.fill("#calc-absent", "3");
    assert.strictEqual(await page.getAttribute("#calc-salary", "aria-invalid"), "true");
    assert.ok(await errorFor(page, "calc-salary").isVisible(), "salary error should show");
    assert.ok(await page.locator("[data-calc-yours-summary]").isHidden(), "should not claim to use their figures");
  });

  await test("more leavers than staff warns and marks the field invalid", async () => {
    await page.fill("#calc-staff", "50");
    await page.fill("#calc-leavers", "120");
    assert.match(await errorFor(page, "calc-leavers").innerText(), /more than the 50 people/);
    assert.strictEqual(await page.getAttribute("#calc-leavers", "aria-invalid"), "true");
    await page.fill("#calc-leavers", "2");
    assert.ok(await errorFor(page, "calc-leavers").isHidden(), "warning should clear");
    assert.strictEqual(await page.getAttribute("#calc-leavers", "aria-invalid"), "false");
  });

  await test("typing in one field doesn't rewrite the other fields' alerts", async () => {
    await page.fill("#calc-staff", "50");
    await page.fill("#calc-leavers", "120");
    await page.evaluate(() => {
      window.alertWrites = 0;
      document.querySelectorAll("#calculator [role=alert]").forEach((el) =>
        new MutationObserver(() => window.alertWrites++).observe(el, { childList: true, characterData: true, subtree: true }));
    });
    await page.locator("#calc-struggling").pressSequentially("123");
    await page.locator("#calc-struggling").fill("");
    // The struggling field's own warning appears and goes once each; nothing else is touched.
    assert.ok(await page.evaluate(() => window.alertWrites) <= 2, "alerts were rewritten on every keystroke");
  });

  await test("before the script runs, the figures already have thousands separators", async () => {
    const html = fs.readFileSync(path.join(SITE, "cost-calculator", "index.html"), "utf8");
    assert.ok(html.includes(FIFTY), `the built page should show ${FIFTY}`);
    assert.ok(!/£\d{4,}/.test(html), `unformatted figure in the built page: ${html.match(/£\d{4,}/)}`);
  });

  await test("the calculator scripts' addresses change whenever the scripts do", async () => {
    const html = fs.readFileSync(path.join(SITE, "cost-calculator", "index.html"), "utf8");
    for (const name of ["cost-calculator.js", "cost-calculator-page.js"]) {
      const hash = require("crypto").createHash("sha256")
        .update(fs.readFileSync(path.join(__dirname, "..", "src", "js", name))).digest("hex").slice(0, 10);
      assert.ok(html.includes(`/js/${name}?v=${hash}"`), `${name} should load with ?v=${hash}`);
    }
  });

  await test("typing 22.5 days never shows an error on the way", async () => {
    await page.fill("#calc-days", "");
    await page.locator("#calc-days").pressSequentially("22.");
    assert.strictEqual(await page.getAttribute("#calc-days", "aria-invalid"), "false");
    await page.locator("#calc-days").pressSequentially("5");
    assert.strictEqual(await page.getAttribute("#calc-days", "aria-invalid"), "false");
    await page.click("[data-calc-reset]");
  });

  await test("the summary form unlocks the download, which opens the summary", async () => {
    await page.fill("#calc-staff", "50");
    await page.fill("#calc-name", "Test Person");
    await page.fill("#calc-email", "test@example.com");
    await page.check("#calc-consent");
    await page.click("[data-calc-submit]");
    await page.locator("[data-calc-download]").waitFor({ state: "visible" });
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.click("[data-calc-download]"),
    ]);
    await popup.waitForLoadState();
    assert.ok((await popup.content()).includes(`${FIFTY} a year`), `the summary should show ${FIFTY} a year`);
    await popup.close();
  });

  await test("download with no headcount says why instead of doing nothing", async () => {
    // Follows the test above, so the summary is already unlocked.
    await page.fill("#calc-staff", "");
    let opened = false;
    page.once("popup", () => { opened = true; });
    await page.click("[data-calc-download]");
    const message = page.locator("[data-calc-download-error]");
    assert.ok(await message.isVisible(), "a message should explain why nothing opened");
    assert.match(await message.innerText(), /how many people you employ/);
    assert.ok(!opened, "no summary should open");
    await page.fill("#calc-staff", "50");
    assert.ok(await message.isHidden(), "the message should clear once there's a headcount");
  });

  await test("no script errors on the page", async () => {
    assert.deepStrictEqual(errors, [], errors.join("; "));
  });

  await browser.close();
  server.close();
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
})().catch((e) => { console.error(e); process.exit(1); });
