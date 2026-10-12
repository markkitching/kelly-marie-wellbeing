const { runtime } = require("nunjucks");

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
