const content = require("./content.js");
const { colorsFor, contrast } = require("../lib/colors-core.js");

// The site's colours, from the scheme picked in the editor. The working-out is in
// src/lib/colors-core.js, shared with the plan emails.
module.exports = () => colorsFor(content().theme);

module.exports.contrast = contrast;
