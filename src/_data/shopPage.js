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
// Packs are sold through Stripe Payment Links: each pack's "Buy" button goes straight to
// Stripe's checkout, so no card details touch this site. A pack only gets a live Buy button
// once it has a Stripe link AND the business address is filled in (UK law requires the
// address to be shown before anyone buys); until then its button falls back to the order
// enquiry link. `selling` is true once any pack is on sale, and switches on the Terms of
// sale link in the footer and the shop section of the privacy policy.
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

  const address = clean(raw.sellerAddress);
  const buttonLink = clean(raw.buttonLink) || CONTACT_URL;
  const packs = rows(raw.packs, "name", ["name", "description", "price", "buyLink"]).map((pack) => {
    const onSale = Boolean(address) && /^https:\/\//.test(pack.buyLink);
    return { ...pack, onSale, href: onSale ? pack.buyLink : buttonLink };
  });
  if (!address && packs.some((pack) => pack.buyLink)) {
    console.warn("[content] shop.json: packs have Stripe links but no business address, so their Buy buttons go to the enquiry form");
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
    buttonLink,
    packsIntro: clean(raw.packsIntro),
    buyLabel: clean(raw.buyLabel) || "Buy now",
    packs,
    selling: packs.some((pack) => pack.onSale),
    address,
    brandedHeading: clean(raw.brandedHeading),
    brandedText: clean(raw.brandedText),
    faqsTitle: clean(raw.faqsTitle),
    faqs: rows(raw.faqs, "question", ["question", "answer", "linkLabel", "linkHref"]),
  };
};
