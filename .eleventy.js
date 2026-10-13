const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { runtime } = require("nunjucks");
const { formatGBP } = require("./src/js/cost-calculator.js");

// Escaping by hand rather than leaning on Nunjucks' own: this runs before the line
// breaks go in, so the <br /> that follows must not be escaped along with the content.
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "src/fonts": "fonts" });
  // The stylesheet built by `npm run css` from styles/tailwind.css.
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });

  // Renders a multi-line CMS field with its line breaks intact.
  //
  // Anything the editor types is escaped first, so an ampersand or an angle bracket
  // shows as itself instead of being read as markup. The result is returned already
  // marked safe, so call sites are just `{{ value | lines }}` — no `| safe` to forget,
  // which is what would otherwise print a literal "<br />" on the page.
  // Trimmed first: a field saved with a trailing newline would otherwise end in a
  // dangling line break, which is invisible in the editor and obvious on the page.
  eleventyConfig.addFilter("lines", (str) => {
    const text = String(str ?? "").trim();
    return new runtime.SafeString(
      text ? escapeHtml(text).replace(/\r\n|\r|\n/g, "<br />") : ""
    );
  });

  // Pounds with thousands separators, to the pound: the same formatting the calculator
  // script uses, so its figures don't change shape when the script takes over.
  eleventyConfig.addFilter("gbp", (n) => formatGBP(Number(n) || 0));

  // "/js/x.js" becomes "/js/x.js?v=<short hash of the file>", so the address changes
  // whenever the file does and browsers can't keep running an old copy after an update.
  eleventyConfig.addFilter("versioned", (url) => {
    const file = path.join(__dirname, "src", url);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
    return `${url}?v=${hash}`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
