#!/usr/bin/env node
/**
 * Pull the show's recent episodes into the podcast page's content file, so they can be
 * reordered and hidden in the CMS like any other episode.
 *
 * Sources, in order of how little setup they need:
 *
 *   youtube-rss  (default)  No credentials at all. A public Atom feed of the channel's
 *                           15 most recent videos. Gives a video id, so each episode gets
 *                           a playable still on the page.
 *   youtube-api             A Google API key. Same data, but the full back catalogue
 *                           rather than the last 15. One quota unit per call.
 *
 * Shorts are left out. Both YouTube sources read the channel's "long-form uploads"
 * playlist (see longFormPlaylist), which YouTube keeps without Shorts in it. The feed
 * source also drops anything whose link is a /shorts/ address, as a second line of
 * defence and as the filter if it ever has to fall back to the full channel feed.
 *   spotify                 Client id + secret. Kept because it works, though Spotify
 *                           has new app creation on hold, so most people can't get
 *                           credentials right now.
 *
 * The rules that matter, whichever source is used:
 *   - Order is never rearranged. Episodes already in the file stay where the editor
 *     put them; genuinely new ones go on top, newest first.
 *   - A field with something in it is never overwritten. Rewrite a title or a
 *     description for the website and the sync leaves it alone. Clear it and the next
 *     sync fills it back in.
 *   - Nothing is ever deleted.
 *   - A failed fetch writes nothing at all and exits non-zero, so a bad day upstream
 *     can't empty the page.
 *
 * Usage:
 *   node scripts/sync-podcast-episodes.js
 *   node scripts/sync-podcast-episodes.js --source youtube-api
 *   node scripts/sync-podcast-episodes.js --dry-run
 *   node scripts/sync-podcast-episodes.js --fixture path/to/response.xml
 *
 * Environment:
 *   YOUTUBE_CHANNEL      @handle or UC… id. Defaults to the show's handle, so normally
 *                        nothing needs setting at all.
 *   YOUTUBE_API_KEY      only for --source youtube-api
 *   SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET   only for --source spotify
 *   (optional) SPOTIFY_SHOW_ID, SPOTIFY_MARKET, EPISODE_SYNC_LIMIT
 */

const fs = require("fs");
const path = require("path");

// The handle is enough — the UC… id is looked up from the channel page. A channel id
// isn't secret, so it lives here rather than in repository settings.
const CHANNEL = process.env.YOUTUBE_CHANNEL_ID || process.env.YOUTUBE_CHANNEL || "@TheKellyMariePodcast";
const SHOW_ID = process.env.SPOTIFY_SHOW_ID || "033TZ1QVIUJCQZ6TJ2XBYH";
const MARKET = process.env.SPOTIFY_MARKET || "GB";
const LIMIT = Math.min(Number(process.env.EPISODE_SYNC_LIMIT || 30), 50);
const PAGE_FILE = path.join(__dirname, "..", "src", "content", "pages", "podcast.json");

// The last known state of every episode on the page, written by this script and edited
// by nobody. Without it a row deleted in the CMS is simply absent, indistinguishable
// from one that has never been pulled — so the next sync would fetch it straight back.
const LEDGER_FILE = path.join(__dirname, "podcast-ledger.json");

// Long enough to be useful, short enough that a card stays a card. Spotify descriptions
// often carry sponsor copy and links; the editor can rewrite and the sync won't undo it.
const DESCRIPTION_LIMIT = 240;

// ── Shaping Spotify's response ───────────────────────────────────────────────

// Full month names, matching how dates are written on the rest of the site.
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

function formatDate(releaseDate) {
  const parts = String(releaseDate || "").split("-");
  if (parts.length !== 3) return String(releaseDate || "");   // Spotify may give just a year
  const [year, month, day] = parts;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function formatDuration(ms) {
  const minutes = Math.round(Number(ms || 0) / 60000);
  return minutes > 0 ? `${minutes} min` : "";
}

function shorten(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= DESCRIPTION_LIMIT) return clean;
  const cut = clean.slice(0, DESCRIPTION_LIMIT);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}

function shape(item) {
  const meta = [formatDate(item.release_date), formatDuration(item.duration_ms)]
    .filter(Boolean)
    .join(" · ");
  return {
    id: item.id,
    title: String(item.name || "").trim(),
    description: shorten(item.description),
    meta,
    value: (item.external_urls && item.external_urls.spotify) || `https://open.spotify.com/episode/${item.id}`,
  };
}

// ── Merging (pure — this is the part that can lose the editor's work) ─────────

function spotifyId(url) {
  const found = String(url || "").match(/episode[/:]([A-Za-z0-9]+)/);
  return found ? found[1] : "";
}

// Mirrors the parsing in src/_data/pages.js, so an id written by hand in any of
// YouTube's link formats is recognised as the same episode the sync already knows.
function youtubeId(value) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const found = raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return found ? found[1] : "";
}

// Which episode field a source fills, and how to read an id back out of it.
const FIELDS = {
  youtube: youtubeId,
  spotify: spotifyId,
};

function newEpisode(fresh, field) {
  return {
    number: "",
    title: fresh.title,
    description: fresh.description,
    meta: fresh.meta,
    youtube: field === "youtube" ? fresh.value : "",
    spotify: field === "spotify" ? fresh.value : "",
  };
}

function merge(existing, incoming, field = "spotify", alsoKnown = []) {
  const idOf = FIELDS[field];
  if (!idOf) throw new Error(`unknown episode field: ${field}`);

  // Removed episodes count as known: they have been pulled once and thrown back.
  const seen = new Set([
    ...existing.map((episode) => idOf(episode[field])),
    ...alsoKnown,
  ].filter(Boolean));

  const kept = existing.map((episode) => {
    const id = idOf(episode[field]);
    const fresh = id && incoming.find((candidate) => candidate.id === id);
    if (!fresh) return episode;
    return {
      ...episode,
      title: episode.title || fresh.title,
      description: episode.description || fresh.description,
      meta: episode.meta || fresh.meta,
      [field]: episode[field] || fresh.value,
    };
  });

  const added = incoming.filter((fresh) => !seen.has(fresh.id)).map((fresh) => newEpisode(fresh, field));
  return { episodes: [...added, ...kept], added: added.length };
}

// ── YouTube ──────────────────────────────────────────────────────────────────

// Titles and descriptions arrive XML- or HTML-escaped from both the feed and the API.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
function unescapeXml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code) => {
      if (code[0] === "#") {
        const value = code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
      }
      return ENTITIES[code] !== undefined ? ENTITIES[code] : whole;
    });
}

// YouTube's feed and API both want the UC… id, but people have handles. The id is
// published several ways in the channel page's HTML; any one of them will do.
const CHANNEL_ID_PATTERNS = [
  /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
  /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
  /<link[^>]+rel="canonical"[^>]+href="[^"]*\/channel\/(UC[A-Za-z0-9_-]{22})"/,
  /<meta[^>]+itemprop="identifier"[^>]+content="(UC[A-Za-z0-9_-]{22})"/,
];

function extractChannelId(html) {
  for (const pattern of CHANNEL_ID_PATTERNS) {
    const found = String(html || "").match(pattern);
    if (found) return found[1];
  }
  return "";
}

function channelUrlFor(channel) {
  const value = String(channel || "").trim();
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("@")) return `https://www.youtube.com/${value}`;
  return `https://www.youtube.com/@${value}`;
}

async function resolveChannelId(channel = CHANNEL) {
  const value = String(channel || "").trim();
  if (/^UC[A-Za-z0-9_-]{22}$/.test(value)) return value;       // already an id
  if (!value) throw new Error("No channel set. Put the @handle or UC… id in YOUTUBE_CHANNEL.");

  const url = channelUrlFor(value);
  const response = await fetch(url, {
    // Without a browser-ish agent YouTube sometimes serves a consent interstitial.
    headers: { "User-Agent": "Mozilla/5.0 (compatible; kelly-marie-site-sync/1.0)", "Accept-Language": "en-GB,en" },
  });
  if (!response.ok) {
    throw new Error(`Could not open ${url} (${response.status}). Set YOUTUBE_CHANNEL to the UC… id directly.`);
  }
  const id = extractChannelId(await response.text());
  if (!id) {
    throw new Error(`Opened ${url} but found no channel id in it. Set YOUTUBE_CHANNEL to the UC… id directly — YouTube Studio > Settings > Channel > Advanced.`);
  }
  console.log(`resolved ${value} -> ${id}`);
  return id;
}

function shapeYouTube({ id, title, description, published, link }) {
  return {
    id,
    // The feed links a Short to youtube.com/shorts/…, and everything else to /watch.
    isShort: /\/shorts\//.test(String(link || "")),
    title: unescapeXml(title).trim(),
    description: shorten(unescapeXml(description)),
    meta: formatDate(String(published || "").slice(0, 10)),
    value: id,                      // pages.js takes a bare video id
  };
}

// YouTube keeps several playlists per channel alongside the full uploads list (UU…).
// UULF… holds the long-form uploads only, so no Shorts. It isn't documented, but it is
// widely relied on; if it ever goes, the feed source falls back to the channel feed
// and filters Shorts by their links, and the API source stops rather than let them in.
function longFormPlaylist(channelId) {
  return "UULF" + String(channelId).slice(2);
}

// A public Atom feed. No key, no quota — but only the 15 most recent. Shorts, which the
// feed links to /shorts/ rather than /watch, are dropped here whichever feed it is.
function parseYouTubeFeed(xml) {
  const field = (block, tag) => {
    const found = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return found ? found[1] : "";
  };
  const link = (block) => {
    const found = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"/) ||
                  block.match(/<link[^>]*href="([^"]*)"[^>]*rel="alternate"/);
    return found ? found[1] : "";
  };
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) || [])
    .map((entry) => shapeYouTube({
      id: field(entry, "yt:videoId"),
      title: field(entry, "title"),
      description: field(entry, "media:description"),
      published: field(entry, "published"),
      link: link(entry),
    }))
    .filter((episode) => episode.id && !episode.isShort);
}

async function fetchYouTubeFeed() {
  const channelId = await resolveChannelId();
  const feed = (query) => fetch(`https://www.youtube.com/feeds/videos.xml?${query}`);

  let response = await feed(`playlist_id=${encodeURIComponent(longFormPlaylist(channelId))}`);
  if (response.status === 404) {
    console.warn("the long-form uploads feed wasn't found — using the channel feed and filtering Shorts by their links");
    response = await feed(`channel_id=${encodeURIComponent(channelId)}`);
    if (response.status === 404) throw new Error(`YouTube has no feed for channel ${channelId}.`);
  }
  if (!response.ok) throw new Error(`YouTube returned ${response.status} for the channel feed.`);
  return parseYouTubeFeed(await response.text());
}

// The Data API, for more than the feed's 15. playlistItems.list on the long-form
// uploads playlist, one quota unit per call — search.list would cost 100 and is not
// needed. The API gives no way to tell a Short from its listing, so if that playlist
// is ever missing this stops rather than fall back to the full uploads and let Shorts in.
async function fetchYouTubeApi() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY must be set for --source youtube-api.");
  const channelId = await resolveChannelId();

  const uploads = longFormPlaylist(channelId);
  const episodes = [];
  let pageToken = "";
  while (episodes.length < LIMIT) {
    const listUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}` +
      `&maxResults=${Math.min(50, LIMIT - episodes.length)}&key=${key}` + (pageToken ? `&pageToken=${pageToken}` : "");
    const listResponse = await fetch(listUrl);
    if (listResponse.status === 404) throw new Error(`YouTube has no long-form uploads playlist (${uploads}) for this channel. Use --source youtube-rss, which can filter Shorts without it.`);
    if (!listResponse.ok) throw new Error(`YouTube returned ${listResponse.status} listing uploads. Check YOUTUBE_API_KEY and that the YouTube Data API v3 is enabled.`);
    const body = await listResponse.json();
    for (const item of body.items || []) {
      episodes.push(shapeYouTube({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        published: item.snippet.publishedAt,
      }));
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return episodes.slice(0, LIMIT);
}

// ── Deleting and restoring ───────────────────────────────────────────────────

const idsOf = (rows, idOf, field) => rows.map((r) => idOf(r[field])).filter(Boolean);

const readLedger = () => {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")).episodes || [];
  } catch {
    return [];                       // first run, or someone removed the file
  }
};

/** Rows the editor has ticked to bring back, and the list without them.
 *
 * The tick box arrives as a boolean, but rows saved before it was one still hold "Yes",
 * so both are accepted. Anything else — including the field being absent, which is what
 * the CMS writes for an unticked box — leaves the episode where it is.
 */
function takeRestored(removed) {
  const wanted = (row) =>
    row.restore === true || /^(yes|true)$/i.test(String(row.restore || "").trim());
  return {
    restored: removed.filter(wanted).map(({ restore, ...episode }) => episode),
    remaining: removed.filter((row) => !wanted(row)),
  };
}

/**
 * Episodes the ledger remembers that the page no longer lists.
 *
 * That means someone deleted the row in the CMS. The ledger's copy is the only record
 * left of it, so it goes to the archive rather than being forgotten — otherwise the
 * next sync treats it as new and pulls it back.
 */
function newlyRemoved(ledger, episodes, removed, idOf, field) {
  const accounted = new Set([
    ...idsOf(episodes, idOf, field),
    ...idsOf(removed, idOf, field),
  ]);
  return ledger
    .filter((episode) => {
      const id = idOf(episode[field]);
      return id && !accounted.has(id);
    })
    .map((episode) => ({ ...episode, restore: false }));
}

// ── Talking to Spotify ───────────────────────────────────────────────────────

async function getToken(id, secret) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`Spotify refused the credentials (${response.status}). Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.`);
  }
  return (await response.json()).access_token;
}

async function fetchEpisodes(token) {
  const url = `https://api.spotify.com/v1/shows/${SHOW_ID}/episodes?market=${MARKET}&limit=${LIMIT}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) {
    throw new Error(`Spotify has no show ${SHOW_ID} in market ${MARKET}. Check SPOTIFY_SHOW_ID, and that the show is published in that market.`);
  }
  if (!response.ok) {
    throw new Error(`Spotify returned ${response.status} for the episode list.`);
  }
  const body = await response.json();
  // Spotify pads the array with nulls for anything unavailable in this market.
  return (body.items || []).filter(Boolean).map(shape);
}

// ── Entry point ──────────────────────────────────────────────────────────────

const SOURCES = {
  "youtube-rss": { field: "youtube", fetch: fetchYouTubeFeed, parse: parseYouTubeFeed },
  "youtube-api": { field: "youtube", fetch: fetchYouTubeApi, parse: parseYouTubeFeed },
  spotify: {
    field: "spotify",
    fetch: async () => {
      const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set for --source spotify.");
      }
      return fetchEpisodes(await getToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET));
    },
    parse: (text) => (JSON.parse(text).items || []).filter(Boolean).map(shape),
  },
};

function flag(name, fallback = "") {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sourceName = flag("source", process.env.EPISODE_SOURCE || "youtube-rss");
  const source = SOURCES[sourceName];
  if (!source) {
    throw new Error(`unknown source "${sourceName}". Use one of: ${Object.keys(SOURCES).join(", ")}.`);
  }

  const fixture = flag("fixture");
  const incoming = fixture
    ? source.parse(fs.readFileSync(fixture, "utf8"))
    : await source.fetch();

  console.log(`${sourceName}${fixture ? " (fixture)" : ""}: ${incoming.length} episodes`);

  if (!incoming.length) {
    throw new Error("No episodes came back — refusing to write, in case this is a blip.");
  }

  const page = JSON.parse(fs.readFileSync(PAGE_FILE, "utf8"));
  const idOf = FIELDS[source.field];
  const before = page.episodes || [];

  let episodes = before;
  let removed = page.removedEpisodes || [];
  const ledger = readLedger();

  // 1. Anything the editor asked to bring back goes to the top of the list.
  const { restored, remaining } = takeRestored(removed);
  removed = remaining;
  episodes = [...restored, ...episodes];

  // 2. Anything the ledger remembers but the page no longer lists was deleted in the
  //    CMS. Archive it, so it can be brought back and is never pulled again.
  const archived = newlyRemoved(ledger, episodes, removed, idOf, source.field);
  removed = [...archived, ...removed];

  // 3. Merge in what came back from upstream, skipping everything already known.
  const { episodes: merged, added } = merge(
    episodes, incoming, source.field, idsOf(removed, idOf, source.field)
  );

  page.episodes = merged;
  page.removedEpisodes = removed;

  console.log(
    `${before.length} on the page, ${added} new, ${restored.length} restored, ` +
    `${archived.length} newly removed, ${removed.length} in the archive`
  );

  if (dryRun) {
    console.log("--dry-run: nothing written");
    return;
  }
  fs.writeFileSync(PAGE_FILE, JSON.stringify(page, null, 2) + "\n");

  // 4. The ledger records what the page holds now, so the next run can tell a deletion
  //    from an episode it has never seen.
  fs.writeFileSync(
    LEDGER_FILE,
    JSON.stringify({
      note: "Written by scripts/sync-podcast-episodes.js. Not edited by hand or by the CMS.",
      episodes: merged,
    }, null, 2) + "\n"
  );
  console.log(`wrote ${path.relative(process.cwd(), PAGE_FILE)} and the ledger`);
}

// Exported so the merge rules can be tested without touching the network.
module.exports = { merge, shape, shapeYouTube, parseYouTubeFeed, unescapeXml, longFormPlaylist,
                   takeRestored, newlyRemoved, readLedger,
                   extractChannelId, channelUrlFor,
                   spotifyId, youtubeId, shorten, formatDate, formatDuration };

if (require.main === module) {
  main().catch((error) => {
    console.error("sync failed:", error.message);
    console.error("nothing was written.");
    process.exit(1);
  });
}
