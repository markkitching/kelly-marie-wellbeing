const path = require("path");

const newPages = require("./newPages.json");

// Pages that have a template of their own, so holding.njk must not also generate them —
// two templates writing the same permalink is a build error.
const HAS_OWN_TEMPLATE = new Set(["counselling", "shop"]);

module.exports = () => newPages.filter((page) => !HAS_OWN_TEMPLATE.has(page.slug));
