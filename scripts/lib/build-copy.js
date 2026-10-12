/**
 * Builds a throwaway copy of the site with some content changed, for tests that need to
 * see what the editor's input would produce without touching the real content files.
 *
 *   withBuiltCopy({ "calculator.json": (c) => { c.heading = "..."; } }, (site) => {
 *     // site is the copy's _site folder
 *   });
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");

function withBuiltCopy(edits, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kmw-copy-"));
  try {
    fs.cpSync(path.join(ROOT, "src"), path.join(tmp, "src"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, ".eleventy.js"), path.join(tmp, ".eleventy.js"));
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(tmp, "node_modules"), "dir");

    for (const [file, edit] of Object.entries(edits)) {
      const p = path.join(tmp, "src", "content", file);
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      edit(data);
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
    }

    execFileSync(process.execPath, [path.join(ROOT, "node_modules", "@11ty", "eleventy", "cmd.js"), "--quiet"],
      { cwd: tmp, stdio: ["ignore", "ignore", "inherit"] });
    return fn(path.join(tmp, "_site"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { withBuiltCopy };
