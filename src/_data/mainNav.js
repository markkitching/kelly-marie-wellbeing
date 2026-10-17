const content = require("./content.js");
const menuItems = require("./menuItems.js");
const shopPage = require("./shopPage.js");

// The editor's menu (src/content/menu.json) says which items appear and in what order.
// Labels and destinations come from menuItems.js, so the CMS can't change them.
// Rows naming an item that no longer exists are skipped rather than breaking the build.
// The Shop link also waits for the page itself to be published, so ticking "Show in menu"
// early can't send visitors to a page that's still being prepared.
module.exports = () => {
  const items = menuItems();
  const hidden = new Set(shopPage().published ? [] : ["shop"]);

  return ((content().menu || {}).items || [])
    .filter((row) => row.visible !== false && items[row.item] && !hidden.has(row.item))
    .map((row) => ({ ...items[row.item], id: row.item }));
};
