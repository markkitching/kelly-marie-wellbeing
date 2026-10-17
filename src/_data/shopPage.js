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
const num = (value) => (value === "" || value == null || isNaN(Number(value)) ? null : Number(value));
const fill = (text, values) => clean(text).replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));
const pounds = (amount) => "£" + (amount % 1 === 0 ? String(amount) : amount.toFixed(2));
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

  // Pricing cards. "Sheets" and "Price per set" are worked out from the other figures
  // when left blank in the CMS; when typed in and they don't add up, the build warns.
  const sheetsPerSet = num(raw.sheetsPerSet) || 15;
  const vatLabel = clean(raw.vatLabel);
  const withVat = (text) => (vatLabel ? `${text} ${vatLabel}` : text);
  const series = { understanding: clean(raw.seriesUnderstanding), quickTips: clean(raw.seriesQuickTips) };
  const packs = (Array.isArray(raw.packs) ? raw.packs : [])
    .filter((pack) => pack && clean(pack.name) && num(pack.price) !== null && num(pack.sets))
    .map((pack) => {
      const name = clean(pack.name);
      const sets = num(pack.sets);
      const price = num(pack.price);
      const sheets = num(pack.sheets) ?? sets * sheetsPerSet;
      const perSet = num(pack.perSet) ?? Math.round((price / sets) * 100) / 100;
      if (Math.round((price / sets) * 100) !== Math.round(perSet * 100)) {
        console.warn(`[content] shop.json: ${name} pack's price per set (${perSet}) doesn't match ${price} ÷ ${sets}`);
      }
      if (sheets !== sets * sheetsPerSet) {
        console.warn(`[content] shop.json: ${name} pack's ${sheets} sheets doesn't match ${sets} sets × ${sheetsPerSet}`);
      }
      const values = { sets, sheets, price: pounds(price), perSet: pounds(perSet), ...series };
      return {
        name,
        highlight: pack.highlight === true,
        price: pounds(price),
        setsText: fill(raw.setsText, values),
        detailText: fill(raw.packDetailText, values),
        perSetText: fill(raw.perSetText, values),
        extra: fill(pack.extra, values),
        button: clean(pack.button) || `Enquire about ${name}`,
        enquiry: `Shop enquiry: ${name} pack`,
      };
    });

  return {
    published: raw.published === true,
    eyebrow: clean(raw.eyebrow),
    heading: clean(raw.heading),
    intro: clean(raw.intro),
    images: [1, 2, 3].map((n) => ({ src: clean(raw[`image${n}`]), alt: clean(raw[`image${n}Alt`]) })),
    rangeTitle: clean(raw.rangeTitle),
    rangeItems: rows(raw.rangeItems, "text", ["text"]),
    pricing: {
      heading: clean(raw.pricingHeading),
      packs,
      vatLabel,
      perSetVat: withVat,
      bestValueLabel: clean(raw.bestValueLabel),
      footnote: fill(raw.pricingFootnote, series),
    },
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
