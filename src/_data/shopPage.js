const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "content", "shop.json");
const CONTACT_URL = require("./links.js")().contact;

// The Shop page (src/shop.njk): printed mental health sheets, ordered by enquiry. There is
// no basket or checkout; the one button goes to the contact form, and its text and link
// are a single field each so proper ordering can be wired in later in one place.
//
// `published` is the switch in the CMS. While it's off the page is still built at /shop/
// (reachable by its link, for review) but is marked noindex, left off the "page not
// found" list, and kept out of the menu even if "Show in menu" is ticked.
//
// Read fresh each time rather than require()d, so `eleventy --serve` picks up edits.
const clean = (value) => (typeof value === "string" ? value.trim() : value || "");
const rows = (raw, required, keys) =>
  (Array.isArray(raw) ? raw : [])
    .map((row) => Object.fromEntries(keys.map((key) => [key, clean((row || {})[key])])))
    .filter((row) => row[required]);

module.exports = () => {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch {
    console.warn("[content] shop.json is empty or invalid — the Shop page will be blank");
  }

  return {
    published: raw.published === true,
    eyebrow: clean(raw.eyebrow),
    heading: clean(raw.heading),
    intro: clean(raw.intro),
    images: [1, 2, 3].map((n) => ({ src: clean(raw[`image${n}`]), alt: clean(raw[`image${n}Alt`]) })),
    rangeTitle: clean(raw.rangeTitle),
    rangeItems: rows(raw.rangeItems, "text", ["text"]),
    orderHeading: clean(raw.orderHeading),
    orderText: clean(raw.orderText),
    buttonLabel: clean(raw.buttonLabel),
    buttonLink: clean(raw.buttonLink) || CONTACT_URL,
    brandedHeading: clean(raw.brandedHeading),
    brandedText: clean(raw.brandedText),
    showFaqs: raw.showFaqs === true,
    faqsTitle: clean(raw.faqsTitle),
    faqs: rows(raw.faqs, "question", ["question", "answer", "linkLabel", "linkHref"]),
  };
};
