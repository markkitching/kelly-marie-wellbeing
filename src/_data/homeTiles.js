const content = require("./content.js");
const mainNav = require("./mainNav.js");
const pages = require("./pages.js");
const shopPage = require("./shopPage.js");

// The homepage's tiles, one per page. A tile shows only while its page is in the menu,
// so hiding a page under Main menu (or leaving the shop unpublished, which keeps it out
// of the menu) takes its tile off the homepage too, and a tile can never point at a page
// the editor has put away. Links come from the menu, so they can't be edited into
// somewhere that doesn't exist.
//
// Some tiles borrow from the page they lead to rather than asking for the same thing
// twice: the Training tile shows that page's intro and cards, the Team tile shows the team's
// photos, and the Podcast and Shop tiles fall back to those pages' own artwork.
//
// Read fresh each time, so `eleventy --serve` picks up edits.
const clean = (value) => (typeof value === "string" ? value.trim() : "");
const firstSentence = (text) => (clean(text).match(/^.*?[.!?](?=\s|$)/) || [clean(text)])[0];

module.exports = () => {
  const home = content().home || {};
  const nav = Object.fromEntries(mainNav().map((item) => [item.id, item]));
  const allPages = pages();
  const tile = (id, extra) => (nav[id] ? { href: nav[id].href, ...extra } : null);

  const training = allPages["training-coaching"] || {};
  const team = allPages["meet-the-team"] || {};
  const podcast = allPages.podcast || {};

  const tiles = {
    counselling: tile("counselling", {
      image: clean(home.counsellingImage),
      imageAlt: clean(home.counsellingImageAlt),
    }),
    // The wide tile: its own text if set, otherwise the Training page's intro, and each of
    // that page's cards with the first sentence of its description.
    training: tile("training-coaching", {
      text: clean(home.trainingText) || clean(training.intro),
      items: (training.cards || [])
        .filter((card) => clean(card.title))
        .map((card) => ({ title: clean(card.title), summary: firstSentence(card.description) }))
        .slice(0, 4),
    }),
    podcast: tile("podcast", {
      image: clean(home.podcastImage) || podcast.audioArtwork || "",
    }),
    shop: tile("shop", {
      image: clean(home.shopImage) || (shopPage().images[0] || {}).src || "",
    }),
    team: tile("meet-the-team", {
      faces: (team.people || []).filter((person) => person.image).slice(0, 3),
    }),
  };

  return {
    ...tiles,
    any: Object.values(tiles).some(Boolean),
    // The small tiles share a row, so the row needs to know how many there are.
    smallCount: [tiles.podcast, tiles.shop, tiles.team].filter(Boolean).length,
  };
};
