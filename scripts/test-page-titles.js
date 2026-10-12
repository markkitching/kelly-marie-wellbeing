#!/usr/bin/env node
/**
 * Titles and link-preview text set from the CMS are escaped once, not twice.
 *
 * A page title built in eleventyComputed is escaped when it's worked out and again when
 * site-header prints it, unless it's marked `| safe`. Then an apostrophe in the CMS
 * heading shows as "&#39;" in browser tabs and social link previews. The live content
 * may not contain one, so this builds a copy of the site with awkward characters put in
 * and checks what comes out.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { withBuiltCopy } = require("./lib/build-copy.js");

const TRICKY = `It's "you" & <yours>`;
// What that should look like in the HTML: escaped exactly once.
const ONCE = "It&#39;s &quot;you&quot; &amp; &lt;yours&gt;";
const TWICE = /&amp;(#39|quot|amp|lt|gt);/;

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); passed++; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message}`); process.exitCode = 1; }
};

const edits = { "calculator.json": (calc) => { calc.heading = TRICKY; calc.shareDescription = TRICKY; } };
withBuiltCopy(edits, (site) => {
  const html = fs.readFileSync(path.join(site, "cost-calculator", "index.html"), "utf8");
  const tag = (re) => (html.match(re) || [])[0] || "(missing)";

  console.log("page titles and descriptions\n");

  test("the browser-tab title is escaped once", () => {
    const title = tag(/<title>.*<\/title>/);
    assert.ok(title.includes(ONCE), title);
  });
  test("og:title is escaped once", () => {
    const meta = tag(/<meta property="og:title"[^>]*>/);
    assert.ok(meta.includes(`content="${ONCE}"`), meta);
  });
  test("the description and og:description are escaped once", () => {
    for (const re of [/<meta name="description"[^>]*>/, /<meta property="og:description"[^>]*>/]) {
      const meta = tag(re);
      assert.ok(meta.includes(`content="${ONCE}"`), meta);
    }
  });
  test("nothing in any page's <head> is escaped twice", () => {
    const pages = [];
    (function walk(dir) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith(".html")) pages.push(p);
      }
    })(site);
    const bad = pages.filter((p) => TWICE.test(fs.readFileSync(p, "utf8").split("</head>")[0]));
    assert.deepStrictEqual(bad.map((p) => path.relative(site, p)), []);
  });
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
