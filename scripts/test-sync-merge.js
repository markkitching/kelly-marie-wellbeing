#!/usr/bin/env node
/**
 * The sync's merge rules, tested without touching the network.
 *
 * This is the part that can quietly destroy work: an editor's chosen order, their
 * hidden episodes, and any title or description they rewrote for the website.
 */
const assert = require("assert");
const { merge, shape, shorten, formatDate, formatDuration, parseYouTubeFeed, unescapeXml, youtubeId,
        extractChannelId, channelUrlFor,
        takeRestored, newlyRemoved } = require("./sync-podcast-episodes.js");

const spotify = (id, name, extra = {}) => shape({
  id,
  name,
  description: extra.description || `Description of ${name}`,
  release_date: extra.release_date || "2026-09-12",
  duration_ms: extra.duration_ms || 2040000,
  external_urls: { spotify: `https://open.spotify.com/episode/${id}` },
});

const mergeSpotify = (existing, incoming) => merge(existing, incoming, "spotify");

const local = (id, extra = {}) => ({
  number: "", title: `Local ${id}`, description: "", meta: "",
  youtube: "", spotify: id ? `https://open.spotify.com/episode/${id}` : "",
  ...extra,
});

let passed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); passed++; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message}`); process.exitCode = 1; }
};

console.log("merge rules\n");

test("new episodes are added, newest first, above what's already there", () => {
  const { episodes, added } = mergeSpotify([local("AAA")], [spotify("CCC", "Newest"), spotify("BBB", "Newer"), spotify("AAA", "Old")]);
  assert.strictEqual(added, 2);
  assert.deepStrictEqual(episodes.map(e => e.title), ["Newest", "Newer", "Local AAA"]);
});

test("the editor's order is never rearranged", () => {
  const existing = [local("CCC"), local("AAA"), local("BBB")];          // deliberately shuffled
  const { episodes } = mergeSpotify(existing, [spotify("AAA", "A"), spotify("BBB", "B"), spotify("CCC", "C")]);
  assert.deepStrictEqual(episodes.map(e => e.spotify.slice(-3)), ["CCC", "AAA", "BBB"]);
});

test("a rewritten title is not overwritten", () => {
  const { episodes } = mergeSpotify([local("AAA", { title: "My better title" })], [spotify("AAA", "Spotify's title")]);
  assert.strictEqual(episodes[0].title, "My better title");
});

test("a rewritten description is not overwritten", () => {
  const { episodes } = mergeSpotify([local("AAA", { description: "Written for the website." })], [spotify("AAA", "T")]);
  assert.strictEqual(episodes[0].description, "Written for the website.");
});

test("an empty field is filled in from Spotify", () => {
  const { episodes } = mergeSpotify([local("AAA", { title: "", description: "", meta: "" })], [spotify("AAA", "From Spotify")]);
  assert.strictEqual(episodes[0].title, "From Spotify");
  assert.strictEqual(episodes[0].description, "Description of From Spotify");
  assert.strictEqual(episodes[0].meta, "12 September 2026 · 34 min");
});

test("a manually added YouTube link survives", () => {
  const { episodes } = mergeSpotify([local("AAA", { youtube: "dQw4w9WgXcQ" })], [spotify("AAA", "T")]);
  assert.strictEqual(episodes[0].youtube, "dQw4w9WgXcQ");
});

test("episodes with no Spotify link are left completely alone", () => {
  const placeholder = local("", { title: "Placeholder topic" });
  const { episodes, added } = mergeSpotify([placeholder], [spotify("AAA", "Real")]);
  assert.strictEqual(added, 1);
  assert.deepStrictEqual(episodes[1], placeholder);
});

test("re-syncing the same episodes changes nothing at all", () => {
  const incoming = [spotify("BBB", "B"), spotify("AAA", "A")];
  const once = mergeSpotify([], incoming).episodes;
  const twice = mergeSpotify(once, incoming);
  assert.strictEqual(twice.added, 0);
  assert.deepStrictEqual(twice.episodes, once);
});

test("an episode dropped from Spotify is kept, not deleted", () => {
  const { episodes } = mergeSpotify([local("AAA"), local("BBB")], [spotify("AAA", "A")]);
  assert.strictEqual(episodes.length, 2);
  assert.ok(episodes.some(e => e.spotify.endsWith("BBB")));
});

test("a spotify: URI is recognised as the same episode", () => {
  const { added } = mergeSpotify([local("", { spotify: "spotify:episode:AAA" })], [spotify("AAA", "A")]);
  assert.strictEqual(added, 0);
});

console.log("\nformatting\n");

test("dates read as a human would write them", () => {
  assert.strictEqual(formatDate("2026-09-12"), "12 September 2026");
  assert.strictEqual(formatDate("2026-01-01"), "1 January 2026");
  assert.strictEqual(formatDate("2026"), "2026");          // Spotify sometimes gives only a year
  assert.strictEqual(formatDate(undefined), "");
});

test("durations round to whole minutes", () => {
  assert.strictEqual(formatDuration(2040000), "34 min");
  assert.strictEqual(formatDuration(0), "");
});

test("long descriptions are cut at a word, not mid-word", () => {
  const long = "word ".repeat(200);
  const cut = shorten(long);
  assert.ok(cut.length <= 241, `got ${cut.length}`);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("wor…"));
});

test("a short description is left exactly as it is", () => {
  assert.strictEqual(shorten("  Two   sentences. Here.  "), "Two sentences. Here.");
});

console.log("\nyoutube source\n");

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <title>Grief &amp; Loss — what nobody tells you</title>
    <published>2026-09-12T09:00:00+00:00</published>
    <media:description>A conversation about loss that refuses to follow a tidy arc.</media:description>
  </entry>
  <entry>
    <yt:videoId>AbCdEfGhIjK</yt:videoId>
    <title><![CDATA[Episode 2: "asking for help"]]></title>
    <published>2026-08-30T09:00:00+00:00</published>
    <media:description>Why &quot;just ask&quot; ignores how shame works.</media:description>
  </entry>
</feed>`;

test("the channel feed parses into episodes", () => {
  const episodes = parseYouTubeFeed(FEED);
  assert.strictEqual(episodes.length, 2);
  assert.strictEqual(episodes[0].id, "dQw4w9WgXcQ");
  assert.strictEqual(episodes[0].meta, "12 September 2026");
  assert.strictEqual(episodes[0].value, "dQw4w9WgXcQ");
});

test("escaped and CDATA titles come out readable", () => {
  const episodes = parseYouTubeFeed(FEED);
  assert.strictEqual(episodes[0].title, "Grief & Loss — what nobody tells you");
  assert.strictEqual(episodes[1].title, 'Episode 2: "asking for help"');
  assert.strictEqual(episodes[1].description, 'Why "just ask" ignores how shame works.');
});

test("numeric entities decode too", () => {
  assert.strictEqual(unescapeXml("Kelly&#39;s &#x2014; show"), "Kelly's — show");
});

test("a video id is written where the page expects it", () => {
  const { episodes } = merge([], parseYouTubeFeed(FEED), "youtube");
  assert.strictEqual(episodes[0].youtube, "dQw4w9WgXcQ");
  assert.strictEqual(episodes[0].spotify, "");
});

test("an episode whose YouTube link was pasted by hand is not duplicated", () => {
  const existing = [{ number: "", title: "Mine", description: "", meta: "",
                      youtube: "https://youtu.be/dQw4w9WgXcQ", spotify: "" }];
  const { episodes, added } = merge(existing, parseYouTubeFeed(FEED), "youtube");
  assert.strictEqual(added, 1);                       // only the other one
  assert.strictEqual(episodes.length, 2);
  assert.ok(episodes.some(e => e.title === "Mine"));  // and the hand-written title survives
});

test("re-syncing the feed is a no-op", () => {
  const once = merge([], parseYouTubeFeed(FEED), "youtube").episodes;
  const twice = merge(once, parseYouTubeFeed(FEED), "youtube");
  assert.strictEqual(twice.added, 0);
  assert.deepStrictEqual(twice.episodes, once);
});

test("a spotify-keyed sync ignores youtube-only episodes, and vice versa", () => {
  const youtubeOnly = [{ number: "", title: "YT", description: "", meta: "",
                         youtube: "dQw4w9WgXcQ", spotify: "" }];
  const { added } = mergeSpotify(youtubeOnly, [spotify("AAA", "A")]);
  assert.strictEqual(added, 1);
  assert.strictEqual(mergeSpotify(youtubeOnly, [spotify("AAA", "A")]).episodes.length, 2);
});

test("youtubeId matches what pages.js accepts", () => {
  for (const form of ["dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ",
                      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s",
                      "https://www.youtube.com/shorts/dQw4w9WgXcQ"]) {
    assert.strictEqual(youtubeId(form), "dQw4w9WgXcQ", form);
  }
  assert.strictEqual(youtubeId("not a link"), "");
});

console.log("\nresolving a handle to a channel id\n");

const ID = "UCabcdefghijklmnopqrstuv";

test("the id is found however YouTube happens to publish it", () => {
  const shapes = [
    `<script>var ytInitialData = {"externalId":"${ID}","title":"x"};</script>`,
    `<script>{"channelId":"${ID}"}</script>`,
    `<link rel="canonical" href="https://www.youtube.com/channel/${ID}">`,
    `<meta itemprop="identifier" content="${ID}">`,
  ];
  for (const html of shapes) assert.strictEqual(extractChannelId(html), ID, html.slice(0, 40));
});

test("a page with no channel id gives nothing back rather than a wrong guess", () => {
  assert.strictEqual(extractChannelId("<html><body>consent required</body></html>"), "");
  assert.strictEqual(extractChannelId(""), "");
  assert.strictEqual(extractChannelId("UCtooshort"), "");
});

test("a handle becomes the right channel URL", () => {
  assert.strictEqual(channelUrlFor("@TheKellyMariePodcast"), "https://www.youtube.com/@TheKellyMariePodcast");
  assert.strictEqual(channelUrlFor("TheKellyMariePodcast"), "https://www.youtube.com/@TheKellyMariePodcast");
  assert.strictEqual(channelUrlFor("https://www.youtube.com/channel/" + ID), "https://www.youtube.com/channel/" + ID);
});

console.log("\ndeleting and restoring\n");

const ep = (id, extra = {}) => ({ number: "", title: "Ep " + id, description: "", meta: "",
                                  youtube: id, spotify: "", ...extra });
const ytId = (v) => youtubeId(v);

test("an episode deleted in the CMS is moved to the archive", () => {
  const ledger = [ep("AAAAAAAAAAA"), ep("BBBBBBBBBBB")];
  const live = [ep("AAAAAAAAAAA")];                       // B was binned
  const gone = newlyRemoved(ledger, live, [], ytId, "youtube");
  assert.strictEqual(gone.length, 1);
  assert.strictEqual(gone[0].youtube, "BBBBBBBBBBB");
  assert.strictEqual(gone[0].restore, false, "archived rows arrive unticked");
});

test("an archived episode is not archived a second time", () => {
  const ledger = [ep("AAAAAAAAAAA"), ep("BBBBBBBBBBB")];
  const live = [ep("AAAAAAAAAAA")];
  const already = [{ ...ep("BBBBBBBBBBB"), restore: false }];
  assert.deepStrictEqual(newlyRemoved(ledger, live, already, ytId, "youtube"), []);
});

test("an archived episode is never pulled back by the sync", () => {
  const incoming = [{ id: "BBBBBBBBBBB", title: "B", description: "", meta: "", value: "BBBBBBBBBBB" }];
  const { added } = merge([ep("AAAAAAAAAAA")], incoming, "youtube", ["BBBBBBBBBBB"]);
  assert.strictEqual(added, 0, "the feed still lists it, but it stays deleted");
});

test("without the archive it would come straight back", () => {
  const incoming = [{ id: "BBBBBBBBBBB", title: "B", description: "", meta: "", value: "BBBBBBBBBBB" }];
  const { added } = merge([ep("AAAAAAAAAAA")], incoming, "youtube", []);
  assert.strictEqual(added, 1, "which is the bug the archive exists to prevent");
});

test("Restore = Yes takes a row out of the archive, and drops the flag", () => {
  const { restored, remaining } = takeRestored([
    { ...ep("AAAAAAAAAAA"), restore: true },
    { ...ep("BBBBBBBBBBB"), restore: false },
  ]);
  assert.strictEqual(restored.length, 1);
  assert.strictEqual(restored[0].youtube, "AAAAAAAAAAA");
  assert.ok(!("restore" in restored[0]), "the flag must not follow it back onto the page");
  assert.strictEqual(remaining.length, 1);
});

test("the tick box is read, and so is the wording it replaced", () => {
  for (const value of [true, "Yes", "yes", " YES ", "true"]) {
    assert.strictEqual(takeRestored([{ ...ep("AAAAAAAAAAA"), restore: value }]).restored.length, 1, value);
  }
  for (const value of [false, "No", "", undefined, "maybe"]) {
    assert.strictEqual(takeRestored([{ ...ep("AAAAAAAAAAA"), restore: value }]).restored.length, 0, String(value));
  }
});

test("an empty ledger archives nothing", () => {
  assert.deepStrictEqual(newlyRemoved([], [ep("AAAAAAAAAAA")], [], ytId, "youtube"), []);
});

console.log(`\n${passed} checks passed${process.exitCode ? " — WITH FAILURES" : ""}`);
