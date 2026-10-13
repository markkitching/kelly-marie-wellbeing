// Builds the site's stylesheet (src/css/site.css) at deploy time, in place of Tailwind's
// Play CDN, which ran in every visitor's browser.
//
// The brand colours come from src/_data/colors.js, the same place the templates get
// them, so a colour scheme picked in the CMS reaches the stylesheet on the next build.
// Class names are found by scanning the templates and the page scripts; the CMS content
// itself never carries class names.
const colors = require("./src/_data/colors.js")();

module.exports = {
  content: [
    "./src/**/*.njk",
    "./src/**/*.md",
    "./src/js/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        forest: colors.dark,
        // Text-safe versions of the accent (see colors.js), so every scheme meets WCAG AA.
        sage: colors.accentText,
        "sage-light": colors.accentOnDark,
        mist: colors.mutedOnDark,
        stone: colors.light,
        cream: colors.cream,
      },
    },
  },
};
