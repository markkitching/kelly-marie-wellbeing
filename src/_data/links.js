// Destinations that more than one template needs to agree on. The enquiry form has now
// lived on the homepage and on its own page; keeping its address here means moving it
// again is a one-line change rather than a hunt through six templates.
module.exports = () => ({
  contact: "/contact/",
  services: "/counselling/#services",
  // The calculator's own page — the address to share. It also sits on the Training page.
  calculator: "/cost-calculator/",
  // Link previews on social media need a full address, not just a path.
  site: "https://kellymariewellbeing.com",
});
