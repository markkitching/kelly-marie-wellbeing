# Kelly Marie Wellbeing — Website

The website for Kelly Marie Wellbeing (Leeds), built with
[Eleventy](https://www.11ty.dev/) + Tailwind CSS, hosted on Cloudflare Pages, and
editable through a friendly visual editor ([Pages CMS](https://pagescms.org)) — no code required.

- **Live site:** https://kellymariewellbeing.com  (`kellymariecounselling.com` redirects to it)
- **Visual editor:** https://app.pagescms.org (sign in with GitHub)

---

## ✏️ How to edit the website (for Kelly / family — no code)

1. Go to **https://app.pagescms.org** and sign in with your GitHub account.
2. Choose the **kelly-marie-wellbeing** project.
3. In the sidebar you'll see one entry per part of the site — *Page settings, Header / logo,
   Colours / theme, Main menu, Top section (hero), About Kelly, Services, Workplace Wellness,
   Therapeutic approach, The process, Contact, Footer,* plus one **Page:** entry per standalone
   page. Click whichever you want to change.
4. Change any text, or upload a new photo (Hero photo / About photo).
5. Click **Save**.
6. Wait about **1–2 minutes** — the live website updates itself automatically.

That's it. You never touch code, and you can't break the design — only the words and
photos are editable. If something doesn't look right, you can always change it back and Save again.

### Changing the site colours
1. In the editor, open **Colours / theme**.
2. Pick a ready-made **Colour scheme** (Navy, Forest green, Terracotta, Plum, or Charcoal & gold) and **Save** — the whole site re-colours itself, and text stays readable.
3. *(Advanced, optional)* To use an exact brand colour, type a hex code (e.g. `#1c3553`) into one of the **Advanced** boxes. Leaving a box blank just uses the chosen scheme. Note: picking a very light "main dark colour" can make white text hard to read.
4. You don't need to worry about readability: wherever the accent colour is used for small text, the site automatically uses a slightly darker (or, on dark backgrounds, lighter) version of it that passes the accessibility contrast standard (WCAG AA). This is worked out in `src/_data/colors.js`.


---

## TODO

- [x] **Social links** — LinkedIn live in the footer; Instagram and Facebook ready to add in the CMS ✓
- [x] **BACP membership number** — set in the editor (No. 00922563) ✓
- [x] **Custom domain** — `kellymariewellbeing.com` live on Cloudflare Pages, old domain redirecting ✓
- [x] **Visual CMS** — Pages CMS editing enabled ✓
- [x] **Colour themes** — editor can switch palettes or set custom colours ✓
- [x] **New menu items + holding pages** — Counselling, Training & Coaching, Podcast, Merchandise, Meet the Team ✓ *(Wellbeing was removed)*
- [x] **Menu order + show/hide editable in the CMS** — names and destinations stay locked ✓
- [x] **Six new pages' content editable** — simple fields per page; placeholder shows until filled ✓
- [x] **Spec the six new pages** — draft content written for all six, awaiting review ✓
- [x] **Page blocks added to `.pages.yml`** — forms tailored per page, round-trip verified ✓
- [x] **Podcast episodes pull automatically from YouTube** — daily, with order and edits preserved ✓
- [x] **Run the podcast sync once** — done; the sync now runs daily and has been passing ✓

---

## CMS — what the editor controls, and what's next

### Where things live

| File | Role |
|---|---|
| `src/_data/menuItems.js` | **Code-owned** menu catalogue: each item's label and destination. Not editable in the CMS, by design. |
| `src/_data/newPages.json` | The six standalone pages (`title` + `slug`). Feeds both the catalogue and page generation. |
| `src/_data/mainNav.js` | Applies the editor's order and show/hide choices to that catalogue. |
| `src/content/pages/` | Editable content for the six standalone pages, one file each. |
| `src/_data/pages.js` | Loads those files, keyed by slug. |
| `src/holding.njk` | Builds each page — real content when filled in, "coming soon" placeholder when not. |
| `src/_includes/page-sections.njk` | The seven sections the homepage is built from, rendered from whichever content object is passed in. |
| `src/_includes/page-body.njk` | Renders the optional content blocks that make up a page. |
| `src/counselling.njk` | The Counselling page — the homepage's sections, its own content. |
| `src/_data/counsellingPage.js` | Loads `src/content/counselling/`. |
| `src/_data/holdingPages.js` | `newPages.json` minus any page with a template of its own. |
| `src/404.njk` | "Page not found" — Cloudflare Pages serves `_site/404.html` (with a 404 status) for any address that doesn't exist. Lists every page in `newPages.json`. Not in the CMS. |
| `scripts/gen-pages-yml.py` | Generates the whole of `.pages.yml` from the two source files. |
| `scripts/base-forms.yml` | The site-wide editor forms. |
| `scripts/section-forms.yml` | The section forms, stamped out per page. |
| `scripts/check-pages-yml.py` | Verifies a CMS save can't drop any stored field. |
| `scripts/sync-podcast-episodes.js` | Pulls recent episodes from YouTube (or Spotify) into the podcast page. |
| `scripts/test-sync-merge.js` | Proves the sync can't undo the editor's order, edits or hidden episodes. |
| `.github/workflows/checks.yml` | Runs every test and check above on each push and pull request. A failure shows as a red cross on GitHub but doesn't stop Cloudflare deploying. |
| `src/_includes/site-header.njk` | Shared `<head>` + sticky nav. |
| `src/_includes/site-footer.njk` | Shared footer + page scripts. |

**How the menu behaves:** the header shows the logo, a "Request a Consultation" button
and a burger handle at every screen size. The handle opens one panel listing the links
on a single level — no submenus, no separate desktop and mobile arrangements to keep in
sync. It closes on link click, Escape, or a click outside.

### ✅ 1. Menu order and visibility — editable

Under **Main menu** in the editor, each row is one menu link. The editor can:

- **drag rows** to change the order links appear in
- **untick "Show in menu"** to hide a link

They deliberately *cannot* edit link names or destinations — those live in
`menuItems.js`, so a link can't be renamed into something misleading or pointed at a
URL that doesn't exist.

> **Hiding is not deleting.** A hidden page stays online at its own address; it just
> isn't linked from the menu. That's what makes it possible to build a page out before
> announcing it.

Stored in `src/content/menu.json` as:

```json
{
  "items": [
    { "item": "about", "visible": true },
    { "item": "podcast", "visible": false }
  ]
}
```

`mainNav.js` skips rows whose `item` is unknown, so a stale row can't break the build.

> ⚠️ **One sync point for developers:** the list of choices in the **Menu link**
> dropdown is written out in `.pages.yml`. Adding a page to `newPages.json` means adding
> a matching option there too, or it won't be selectable.

> **Room to grow.** Because every link lives in the dropdown panel rather than spread
> across the header bar, adding more items doesn't threaten the layout — the panel just
> gets taller. Only worry if the list gets long enough to need scrolling on a phone.

### ✅ 2. Page content — editable

Each standalone page has its own editor entry (**Page: Podcast**, **Page: Merchandise**
and so on). A page is assembled from **optional blocks** — fill in the ones that suit
the page and leave the rest empty. Blocks render in the fixed order below, and their
backgrounds alternate light/dark automatically, so the page keeps its rhythm whichever
combination is in use.

| Block | Fields | Used by |
|---|---|---|
| **Heading band** | Small heading, Page title, Intro paragraph | every page |
| **Main text** | Main text, Photo (optional, sits alongside), and **Where the main text sits** — near the top, or after the checklist | every page |
| **Cards** | Section heading + rows of *icon, title, description, meta* | Counselling, Training |
| **Checklist** | `checklistTitle` + `checklistItems` rows of *text*, shown two-up with ticks | Counselling, Training |
| **Listen links** | Section heading + rows of *label, icon, link* | Podcast |
| **Episodes** | Section heading + rows of *number, title, description, meta, YouTube link, Spotify link* | Podcast |
| **Products** | Section heading + rows of *name, price, description, photo, meta, link* | Merchandise |
| **People** | Section heading + rows of *name, role, credentials, bio, photo* | Meet the Team |
| **Quote** | Quote + attribution, on the dark band | Counselling, Training |
| **FAQs** | Section heading + rows of *question, answer*, as an accordion | Counselling, Training, Meet the Team |
| **Closing CTA** | `ctaHeading`, `ctaText`, `ctaButtonLabel`, `ctaButtonIcon`, `ctaButtonHref`, `ctaBackLabel` — all empty removes the section | optional |

**Rows collapse to one line.** Every repeatable list — episodes, cards, FAQs, people,
products — shows each row as a single draggable line carrying its title, so reordering
thirty episodes is dragging thirty lines rather than scrolling thirty open forms. Click a
line to open it. Configured per list in `.pages.yml`:

```yaml
type: object
list:
  collapsible:
    collapsed: true
    summary: '{title}'      # any field on the row; {index} also works
```

The one exception is **Main menu**, whose rows stay open: they are two fields, and one is
the *Show in menu* tick box that makes the list worth having. Collapsing would hide it.

> Keep the summary token pointing at a field that actually exists on the row — a token
> that doesn't resolve renders as empty, giving you a list of blank lines to drag. The
> check below catches that.

**The main text can move.** *Where the main text sits* puts it near the top, straight
under the heading, or further down once the cards and checklist have been read. Training
& Coaching uses the second, so a reader meets what's on offer before the explanation.
It is the one block whose position is editable; the rest keep their fixed order.

Blocks look after themselves:

- **A blank row renders nothing.** Adding a card and leaving it empty shows no card,
  rather than an empty box.
- **A missing link degrades gracefully.** A listen link with no address shows as a
  greyed "Soon" chip, so the row is ready the moment a real URL exists.
- **Fewer than three people** get a narrower grid, so a two-person team doesn't sit in
  a three-column row with a hole in it.
- **The placeholder is still the fallback.** Empty the whole page and it returns to its
  "coming soon" holding screen, so pages can be built one at a time.

Content lives in `src/content/pages/<slug>.json`, loaded by `src/_data/pages.js` and
rendered by `src/_includes/page-body.njk`.

> ⚠️ **Fixed order.** Blocks always appear in the order above; the editor can't reorder
> them. That was a deliberate simplification — reorderable blocks need a polymorphic
> list in the CMS, which is a much larger change. Worth revisiting only if a page
> genuinely needs a different order.

### Podcast episodes sync automatically

A scheduled job pulls the show's recent episodes into `src/content/pages/podcast.json`,
where they behave like any other episode: reorder by dragging, untick to hide, edit any
wording. The page renders the first 10 ticked.

**The source is YouTube, not Spotify.** Spotify's Web API would work, but Spotify has
new app creation on hold, so most people can't obtain credentials at all. YouTube is the
better source regardless: it hands back a video id, which is what the episode card needs
to show a playable still rather than just a link out.

| Source | Setup | Reach |
|---|---|---|
| `youtube-rss` *(default)* | nothing at all | the 15 most recent videos |
| `youtube-api` | a Google API key | the full back catalogue |
| `spotify` | client id + secret | the show's episodes — kept working, but see above |

**Setup: none.** The show's handle is committed in the sync script, and the `UC…` id
YouTube's feed actually wants is looked up from the channel page at run time. A channel
id isn't secret, so nothing belongs in repository settings. To point the sync at a
different channel, set a `YOUTUBE_CHANNEL` repository variable to its handle or id.

For more than the feed's 15 episodes, create an API key at
<https://console.cloud.google.com/apis/credentials> with **YouTube Data API v3** enabled,
add it as the secret `YOUTUBE_API_KEY`, and set the variable `EPISODE_SOURCE` to
`youtube-api`. It costs one quota unit per call against a free daily allowance of 10,000
— the script uses `playlistItems.list` rather than `search.list`, which would cost 100.

> **If the lookup ever fails** — YouTube changes its page, or serves a consent page — the
> sync stops with the reason and writes nothing. Setting `YOUTUBE_CHANNEL` to the `UC…`
> id (YouTube Studio → Settings → Channel → Advanced) skips the lookup entirely.

```bash
npm run test:sync                                       # the merge rules — 23 checks
npm run sync:podcast                                    # no configuration needed
node scripts/sync-podcast-episodes.js --dry-run         # show what would change
node scripts/sync-podcast-episodes.js --fixture f.xml   # test against a saved feed
node scripts/sync-podcast-episodes.js --source youtube-api
```

`.github/workflows/sync-podcast.yml` runs daily at 06:00 UTC and on demand from the
Actions tab. It runs the merge tests first, syncs, confirms the site still builds, and
commits only if something changed — which triggers the usual Cloudflare deploy.

**What the sync will and won't do.** These rules exist so a nightly job can never quietly
undo an afternoon's editing, and every one is covered by `npm run test:sync`:

| | |
|---|---|
| Order | Never rearranged. Existing episodes stay where they were put; new ones go on top, newest first |
| Your edits | A field with something in it is never overwritten. Rewrite a title or description for the website and it stays. Clear it and the next sync refills it |
| Hidden episodes | Stay hidden |
| Deletions | Never. An episode that vanishes upstream stays in the file until someone removes it |
| Failure | Writes nothing and exits non-zero. An outage upstream cannot empty the page |

> **Identity is the video id**, parsed exactly as `src/_data/pages.js` parses it — so an
> episode whose YouTube link was pasted in by hand is recognised as the same episode and
> is not duplicated. An episode with no YouTube link at all is invisible to the sync and
> left completely alone, which is why the original placeholder topics survive untouched,
> and why they drop off the page once real episodes sit above them.

> **Descriptions are trimmed to 240 characters** on a word boundary. YouTube descriptions
> carry timestamps, links and sponsor copy that would wreck a card. Rewrite any of them
> and the sync leaves your version alone.

### Podcast episodes — how adding one will work

Pages CMS can't browse YouTube or Spotify, so an episode is added by **pasting a link**.
Each episode row has:

| Field | Notes |
|---|---|
| Episode number | Optional, shown as a small label |
| Title | Required — a row with no title isn't rendered |
| Description | Optional |
| Duration / date | Optional free text |
| YouTube link | Paste anything YouTube's Share button gives you |
| Spotify link | Paste anything Spotify's Share button gives you |

**Deleting an episode.** Delete the row as you would any other **and press Save**. About
a minute later it appears under **Removed episodes**, the collapsed list below, and it is
never pulled in again even though the feed still offers it.

To bring one back, tick **Put this episode back** and save. About a minute later it is
at the top of the Episodes list again.

> **The minute is the sync running.** Saving the page pushes a commit, which starts
> `sync-podcast-episodes`, which does the moving between the two lists and commits the
> result. Nothing moves in the browser as you click — refresh after a minute to see it.

> **If a deleted episode comes straight back on refresh, the save didn't happen.**
> Deleting a row only changes the page in your browser; Pages CMS writes nothing until
> you press Save, so a refresh reloads the old list. Same for the tick box.

> **Why a deletion needs recording at all.** A row deleted in the CMS is simply absent
> from the file, which looks exactly like an episode that has never been pulled — so the
> next sync would fetch it straight back. `scripts/podcast-ledger.json` holds the last
> known state of the list, which is what lets the sync tell those two apart. It is
> written by the sync, is not in the CMS, and is not served with the site. Don't edit it
> by hand.

> **Deleting from *Removed episodes* forgets the episode entirely**, so the next sync is
> free to pull it in again as if it were new. That is the way to undo a deletion you
> never meant to make permanent — but if you simply don't want it, leave it in the
> archive.

**Choosing which episodes appear, and in what order.** Drag the rows to reorder them —
that order is what the page uses, so newest-first is just a matter of dragging. Every
episode on the list is on the page: there is no separate show/hide, because an episode
is either on the list or in the archive and a third state only made it harder to tell
what the site was showing.

Each row collapses to one line showing its title, so the whole list can be read and
reordered without opening anything.

**The page shows the first 10 ticked episodes** (`EPISODE_LIMIT` in `src/_data/pages.js`).
Beyond that, a line appears under the grid linking out to the full back catalogue, so a
long-running show doesn't turn the page into an endless scroll. Every episode can stay
in the CMS regardless — the limit only affects what's rendered.

> **The page still shows only the first 10.** Beyond that a line appears under the grid
> linking to the full back catalogue. With the show/hide control gone, that cap is the
> one remaining way an episode can be on the list without being on the page — worth
> remembering if a newly synced episode seems not to appear.

**The YouTube field is deliberately forgiving.** `pages.js` pulls the video id out of a
watch URL, a `youtu.be` short link, an `/embed/` or `/shorts/` URL, or a bare id — so
whatever gets pasted, it works. Spotify accepts `open.spotify.com` links, `spotify.link`
short links and `spotify:episode:…` URIs; anything that isn't a Spotify address is
ignored rather than rendered as a link that goes somewhere unexpected.

What each combination produces:

| Episode has | Card shows |
|---|---|
| A YouTube link | The video still, which becomes the player when clicked, plus both listen links |
| Spotify only | The show's artwork, which opens the episode on Spotify, and a *Listen on Spotify* link |
| Neither | A "Not published yet" placeholder — so a planned episode can be listed before it exists |

The artwork comes from **Artwork for audio-only episodes** on the Podcast form. It is
square and the slot is 16:9, so it is cropped from the centre, which is where the title
sits. Clear the field and those episodes fall back to a plain "Audio episode" panel.

> **Give an uploaded image a file extension.** `PodcastImage` was uploaded without one,
> and a file served without a recognised type is not reliably drawn by a browser. It is
> `PodcastImage.jpg` now.

Every card keeps a media area of the same size, so cards sitting side by side line up
whichever combination they use.

> **Nothing is requested from YouTube until someone presses play.** The card shows a
> still image, and only on click does the player load — from `youtube-nocookie.com`.
> For a counselling site, where a visitor reading the page shouldn't be handed to
> Google's tracking, that's worth the small amount of extra code.

### Where each page's sections come from

`src/_includes/page-sections.njk` holds the seven sections, and every page states which
of them it renders:

| Page | Renders |
|---|---|
| `/` | `hero` |
| `/contact/` | `contact` — the site's only enquiry form |
| `/counselling/` | `hero`, `about`, `services`, `workplace`, `approach`, `process` |

```njk
{%- set sectionsShown = ["hero"] -%}
```

The editor forms follow the same lists. They live in `scripts/section-forms.yml` and are
stamped out per page by `scripts/gen-pages-yml.py`, which keeps the forms and the pages
in step: a page that doesn't render a section doesn't get a form for it, and a field
added to a section's form reaches every page that shows it.

> **`.pages.yml` is part hand-written, part generated.** Everything below the marker
> comment is rewritten wholesale by the generator — edit the generator or
> `section-forms.yml`, not those lines. The generator refuses to run if the marker has
> gone, rather than guessing where to start.

**One form outlives the section it came from:** *Contact page*, because `/contact/`
renders it and the footer takes the email address from it on every page.

The enquiry form's **Service of interest** dropdown is a list on that same form —
*Service of interest — dropdown options*. Drag to reorder, delete them all and the
dropdown disappears. It used to read the card titles out of the Services section, which
meant the contact page depended on a section it doesn't render and nobody could tell
where those options came from.

`src/content/{about,approach,process,services,workplace}.json` have been deleted: the homepage
stopped rendering those sections and the Counselling page keeps its own copies, so
nothing read them. Deleting them changed no rendered byte. Git has them if the homepage
sections ever come back.

### Buttons appear when they have a label

Every button on the site is drawn only when its label field has something in it — the
hero's two, the header's, and the back-to-home button at the foot of each standalone
page. Clearing the label removes the button — there is no separate switch to
find, and no button left pointing at a page that no longer wants it.

| Button | Form | Fields |
|---|---|---|
| Hero, main | Top section (hero) | Main button text, **Main button icon**, and it goes to the enquiry form |
| Hero, secondary | Top section (hero) | Secondary button text; goes to the Services section |
| Header, top right | Header / logo | Button text, **Button icon**, Button link |
| Closing section, main | each **Page:** form | Closing button text, icon, link |
| Back to home | each **Page:** form | Back-to-home button text |

**The closing section goes too.** Empty its heading, text and both button labels and the
whole band disappears — the page just ends with whatever came before it. That is how
Meet the Team has no closing section.

> **A cleared field and a missing one have to mean the same thing.** Pages CMS leaves a
> field out of the file when the editor empties it, so anything that defaults an absent
> value to "show" would put the button back the moment someone cleared it. These fields
> have no default for that reason: absent means no button.

Every icon dropdown is expanded from one list. `ICONS` in `scripts/gen-pages-yml.py` is
written into the schema wherever a source file says `values: __ICON_VALUES__`, so a form
can never offer an icon that renders as a blank square — which is exactly what happened
when lucide dropped its brand icons and `youtube` was still on offer. The generator
refuses to finish if a placeholder is left unexpanded.

### The header's button is editable

**Header / logo** carries the button that sits top right on every page:

| Field | Does |
|---|---|
| Button text (top right) | The label. **Leave it empty and the button disappears from every page** |
| Button link | Where it goes. Blank falls back to the enquiry form |

Its address, and every other link to the enquiry form, comes from `src/_data/links.js`,
so moving that form again is a one-line change rather than a hunt through six templates.

### The Counselling page is the homepage's design with its own words

Counselling is the one standalone page not built from blocks. It renders the same seven
sections as the homepage — hero, About, Services, Workplace, Approach, Process, Contact
— from its own copy of the content in `src/content/counselling/`.

```
src/_includes/page-sections.njk   the seven sections, rendered from `sections`
  ├── src/index.njk               sections = content              (src/content/*.json)
  └── src/counselling.njk         sections = counsellingPage      (src/content/counselling/*.json)
```

One template, two sets of words. A change to the design reaches both; a change to the
text reaches only one. `content.site` stays global inside that include, because the
contact form posts to a single endpoint wherever it appears.

**The Counselling page has no enquiry form.** The contact section is wrapped in
`{% if showContact != false %}` and `counselling.njk` turns it off, so the site has one
enquiry form rather than two competing ones. That page's hero button points at
`/#contact` — the homepage's form — because an in-page `#contact` jump would now land
nowhere.

**Its hero has no buttons either.** The *Request a Consultation* / *View Services* pair
is wrapped in `{% if showHeroButtons != false %}` and turned off there. The sticky
header keeps its own *Request a Consultation* button, which appears on every page — so
the page still offers a way through to the enquiry form.

A page that drops something drops its editor fields too, so the forms and the rendered
page can't disagree:

| In `scripts/gen-pages-yml.py` | Drops |
|---|---|
| `SECTIONS_OMITTED` | a whole section, and its form |
| `FIELDS_OMITTED` | named fields from a copied form — here the two hero button labels |

Without that, the editor would be offered somewhere to type text that nothing renders.

In the editor this is six more entries — **Counselling: Top section (hero)**,
**Counselling: About Kelly**, and so on — each with exactly the fields of its homepage
counterpart. Those forms are *copied from the homepage's* by `scripts/gen-pages-yml.py`
rather than written out again, so adding a field to the homepage's About form puts the
same field on the Counselling one the next time the generator runs.

> ⚠️ **Two identical pages is bad for search.** The Counselling page ships as a
> word-for-word copy, which is a starting point, not a destination: Google treats
> duplicate content as a reason to rank one of them lower. Edit the Counselling text to
> be about counselling specifically, and it stops competing with the homepage.

> **A page with its own template must be listed in `src/_data/holdingPages.js`.** It
> stays in `newPages.json` so it keeps its menu entry, but `holding.njk` has to skip it
> — two templates writing `/counselling/` is a build error.

### 2a. Each page's form shows only the blocks that page uses

`.pages.yml` gives every page its own tailored form, so *Page: Merchandise* has no
Checklist section and *Page: Counselling* has no Products section. The block map that
decides this lives in `scripts/gen-pages-yml.py`, which regenerates all six entries —
edit the map and re-run it rather than hand-editing 900 lines of YAML.

Field names in the form match the JSON keys exactly. That matters more than it sounds:
Pages CMS writes back only what its schema knows about, so a key with no matching field
would be **silently deleted** the first time the editor saves. The generator and a
round-trip check guard against that — see *Checking the CMS schema* below.

Every field is a `string`, `text`, `image`, `select`, or an `object` with `list: true`.
There is no nesting beyond one level, which is why `checklistTitle`/`checklistItems` and
the `ctaHeading`/`ctaText`/`ctaButton…` fields are flat rather than nested objects.

### `.pages.yml` is generated — don't edit it

```
scripts/base-forms.yml      site-wide forms (Page settings, Header, Colours, Menu, Footer)
scripts/section-forms.yml   the seven section forms
        │
        └── scripts/gen-pages-yml.py  ──>  .pages.yml
```

Edit a source file, then:

```bash
python3 scripts/gen-pages-yml.py     # rewrite .pages.yml
python3 scripts/check-pages-yml.py   # prove a save can't lose anything
```

The generator owns the whole file, which is what lets one icon list reach every form
including the header's. Running it twice produces an identical file.

### Social links in the footer

**Footer → Social links** takes a platform and an address. Leave the address empty and
that one doesn't appear. LinkedIn is set; Instagram and Facebook are wired up and waiting
for addresses.

The marks are inlined in `src/_data/socialIcons.js` rather than named like every other
icon on the site, because **lucide removed its brand icons** — that is what once put a
blank square on the page when `youtube` was still on an icon dropdown. Instagram and
Facebook come from the `simple-icons` package; LinkedIn is not in it, having asked for
its mark to be removed, so that glyph is written out in the file.

> **Adding a platform** means two edits: an entry in `src/_data/socialIcons.js` and an
> option on the Footer form's *Social links* field in `scripts/base-forms.yml`. A link
> whose platform has no entry is skipped rather than rendered without an icon.

### What the footer and the contact page carry

The footer is the brand line, the tagline, the menu links and the email address. The
BACP membership tile and the location line were removed, and `footer.bacpNumber` went
with the tile — it was rendered nowhere else, and a form field that edits nothing is
worse than no field at all.

The contact page lists **Email** and **Availability**. The location block was removed
and `locationLine1` / `locationLine2` went with it, for the same reason.

> Both are in git if they are ever wanted back. The pattern to follow: when the last
> thing rendering a field goes, take the field out of `scripts/*-forms.yml` and the
> stored value out of `src/content/`, then re-run the generator. `check-pages-yml.py`
> fails if a stored key is left without a form, because Pages CMS would silently delete
> it on the next save.

### Line breaks typed in the editor show on the page

Any multi-line field — intros, paragraphs, descriptions, bios, FAQ answers, quotes —
keeps the line breaks the editor types. Press Enter twice for a gap between paragraphs.

That is the `lines` filter in `.eleventy.js`, and every multi-line field goes through it.
It does three things a bare `nl2br` doesn't:

- **escapes first**, so an `&` or a `<` typed into a field shows as itself instead of
  being read as markup;
- **returns the result already marked safe**, so a call site is just `{{ value | lines }}`
  — there is no `| safe` to forget, and forgetting it would print a literal `<br />`;
- **trims first**, so a field saved with a trailing newline doesn't end in a dangling
  break that is invisible in the editor and obvious on the page.

The one multi-line field that deliberately does *not* use it is the search-engine
description, which is an attribute value — a `<br />` there would be nonsense.

> **Adding a `type: text` field?** Render it with `| lines`. This audit finds any that
> were missed:
> ```bash
> grep -rn '{{' src --include=*.njk | grep -v '| lines'
> ```

### Checking the CMS schema

After changing `.pages.yml` or the page JSON, confirm a save can't lose anything:

```bash
python3 scripts/check-pages-yml.py     # every stored key has a matching form field
```

It parses the YAML, compares each form against its JSON file (including the sub-fields
of every list block), then simulates a save — writing each file back with only the keys
the form knows — and confirms the built site is byte-for-byte unchanged.

### Cost calculator

"What is poor mental health costing your business?" lives at `/cost-calculator/` (the
address to share; not in the menu) and also on the Training & Coaching page. The homepage
links to it with the **Cost calculator button text** field under *Top section (hero)*;
empty that field to remove the button. Its wording,
and the figures it uses, are under **Cost calculator** in the editor. A figure left blank
there falls back to the default in `src/js/cost-calculator.js`.

| File | Role |
|---|---|
| `src/js/cost-calculator.js` | The arithmetic only — no page code, so it can be tested |
| `src/js/cost-calculator-page.js` | Reads the fields, draws the results, sends the form, builds the printable summary |
| `src/_includes/blocks/calculator.njk` | The markup, used by both pages |
| `src/content/calculator.json` | Wording and figures (CMS). These are the figures the page uses |
| `scripts/test-calculator.js` | Worked examples — `npm run test:calc` |
| `src/_data/calcDefaults.js` | The fallback figures for any left blank in the editor, taken from `cost-calculator.js` so they're written once |
| `scripts/test-calculator-figures.js` | Builds a copy of the site with figures changed and cleared, and checks the page uses the editor's figures and falls back to the defaults for blank ones: `npm run test:figures` |
| `scripts/test-page-titles.js` | Builds a copy of the site with an apostrophe and `&` in the calculator heading, and checks titles and link previews aren't escaped twice: `npm run test:titles` |
| `scripts/test-calculator-page.js` | The page in a real browser (headcount, warnings, form, summary): `npm run build && npm run test:page` |
| `src/privacy.njk` | The privacy policy both forms link to |

- **Headcount estimate:** staff × a per-employee cost per category (Deloitte 2024 UK
  totals ÷ ~30 million employees — that division is our approximation). Always free.
- **Your figures:** optional salary and staff counts, run through assumptions the visitor
  can see and edit. A blank category keeps its headcount figure. Counts need a salary.
- **The printable (PDF) summary** sits behind a short form that posts to the same
  Formspree endpoint as the contact form, with the subject "Cost calculator lead" and the
  visitor's figures attached. Nothing they type is sent anywhere until they submit it.
- Everything is worked out in the browser; there is no server code.

### Fonts, icons and the share image

- **Fonts** (Playfair Display, Inter) are served from `src/fonts/`, not Google, so visitors'
  details aren't sent to a third party. Both are SIL Open Font License; the licence files sit
  beside them. The `@font-face` rules are in `site-header.njk`.
- **Icons** come from a fixed copy of Lucide in `src/js/vendor/` (ISC licence alongside).
  To upgrade, replace the file, update the path in `site-header.njk`, and check every name in
  `ICONS` (`scripts/gen-pages-yml.py`) still exists in the new version.
- **Share image**: `src/images/share-image.jpg` (1200×630, the logo in brand colours) is what
  LinkedIn, Facebook and others show when a link to any page is shared.
- **Styles** are built at deploy time: `npm run build` runs `npm run css` (Tailwind 3.4.17,
  pinned, from `styles/tailwind.css` with `tailwind.config.js`) into `src/css/site.css`, which is
  git-ignored and copied to `_site/css/`. The brand colours come from `src/_data/colors.js`,
  so a scheme picked in the CMS reaches the stylesheet on the next deploy. Nothing is loaded
  from Tailwind in the browser any more. While running `npm run dev`, re-run `npm run css`
  after adding new class names to a template.

### Optional extras for later

- **Per-page SEO** — `metaTitle` / `metaDescription` fields. Titles are currently derived
  automatically as *"{Page name} | Kelly Marie Wellbeing"* (from the logo lines in
  **Header / logo**), and there's no per-page description.

### Removing a page

Take its entry out of `src/_data/newPages.json`, delete its file in
`src/content/pages/`, drop its row from `src/content/menu.json` and its entry from
`BLOCKS` in `scripts/gen-pages-yml.py`, then re-run the generator. That one registry
feeds the menu, page generation and the 404 page's suggestions, so everything else
follows.

Its address then answers with the 404 page rather than a redirect, which is worth
knowing if the page had been shared or indexed. *Wellbeing* was removed this way.

---

## 🔧 One-time setup (admin)

This was set up once; recorded here in case it ever needs redoing.

### 1. Cloudflare Pages build settings
Because the site now uses a build step, set (Cloudflare → Workers & Pages → project → Settings → Builds & deployments):

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `_site` |
| Framework preset | None |

### 2. Give the editor (daughter) access
- She creates a free account at https://github.com (one time).
- Repo owner: GitHub repo → **Settings → Collaborators → Add people** → invite her username.
- She accepts the email invite.

### 3. Connect Pages CMS
- Go to https://app.pagescms.org, sign in with GitHub, and authorise the Pages CMS GitHub app **for this repository only**.
- The editing forms are defined by [`.pages.yml`](.pages.yml) in the repo root.

---

## 🏗️ How it's built (for developers)

```
/
├── .eleventy.js            ← Eleventy build config
├── .pages.yml              ← Pages CMS editing-form definitions
├── package.json            ← Eleventy dependency + build scripts
├── src/
│   ├── index.njk           ← Homepage (HTML + Tailwind, with {{ placeholders }})
│   ├── holding.njk         ← Generates the six standalone pages (one per newPages entry)
│   ├── 404.njk             ← "Page not found" page (served by Cloudflare for unknown URLs)
│   ├── _includes/
│   │   ├── site-header.njk ← Shared <head> + sticky nav
│   │   ├── page-body.njk   ← Optional content blocks for the standalone pages
│   │   └── site-footer.njk ← Shared footer + page scripts
│   ├── content/            ← ALL editable text (one file per section — what the CMS edits)
│   │   ├── hero.json  contact.json  services.json  …
│   │   ├── counselling/    ← the Counselling page's own copy of the sections
│   │   └── pages/          ← Content for the six standalone pages
│   ├── _data/
│   │   ├── content.js      ← Merges src/content/*.json into one `content` object
│   │   ├── pages.js        ← Loads src/content/pages/*.json
│   │   ├── colors.js       ← Resolves the chosen palette / custom hex overrides
│   │   ├── newPages.json   ← The six standalone pages (developer-owned)
│   │   ├── menuItems.js    ← Menu labels + destinations (locked, not CMS-editable)
│   │   └── mainNav.js      ← Applies the editor's order / show-hide choices
│   └── images/          ← uploaded through the CMS; favicon.ico is generated
└── _site/                  ← Build output (git-ignored, generated by Eleventy)
```

The design lives in `src/index.njk`; the words/photos live in `src/content/*.json`.
Eleventy merges them into `_site/index.html` at build time, so the page is fully
rendered static HTML (good for SEO). Pages CMS edits those files via friendly forms — one
sidebar entry per file, so no single form gets unwieldy.

### Local development

```bash
npm install        # once
npm run dev        # live preview at http://localhost:8080
npm run build      # one-off build into _site/
```

### Editing in code (instead of the CMS)
- **Text / photos:** edit the relevant file in `src/content/` (one per section).
- **Colours:** editable from the CMS (Colours / theme). The named palettes and the
  `forest`/`sage`/`stone`/`cream` token mapping live at the top of `src/index.njk` in the
  `PALETTES` table in `src/_data/colors.js`; custom hex overrides come from `src/content/theme.json`.
- **Layout / design:** edit `src/index.njk` (Tailwind classes).
- Commit + push to `main`; Cloudflare rebuilds and deploys in ~1–2 minutes.

### Contact form (Formspree)
The form posts to the Formspree endpoint stored in `src/content/site.json` → `formspreeEndpoint`
(currently `https://formspree.io/f/mwvjrpyo`).

> **The delivery address lives at Formspree, not in this repo.** It is
> contactus@kellymariewellbeing.com (confirmed October 2026). The cost calculator's summary
> form uses the same endpoint, so its leads arrive there too, with the subject
> "Cost calculator lead". If that mailbox ever changes, update it in the Formspree
> dashboard, then send a test enquiry, since a wrong address fails silently.

**The message box is worded for organisations on purpose** ("Tell us a little about your
organisation..."). The business doesn't take enquiries from individuals, so the wording
isn't meant to suit someone looking for counselling for themselves (owner's decision,
October 2026).

---

## Custom domain migration (Hostinger → Cloudflare) — reference

The site now serves from `kellymariewellbeing.com`; `kellymariecounselling.com` redirects
to it. The notes below describe the original migration of the older domain and still
apply to its DNS.

`kellymariecounselling.com` is **registered** with Hostinger (unchanged). Only **DNS management**
moved to Cloudflare, because Cloudflare Pages needs Cloudflare-hosted DNS to serve an apex (no-`www`) domain.
This is already done — kept here for reference.

### EMAIL records — KEEP (all must be "DNS only" / grey cloud)

| Type  | Name                          | Value                                          | Priority |
|-------|-------------------------------|------------------------------------------------|----------|
| MX    | `@`                           | `mx1.hostinger.com`                            | 5        |
| MX    | `@`                           | `mx2.hostinger.com`                            | 10       |
| TXT   | `@`                           | `v=spf1 include:_spf.mail.hostinger.com ~all`  | —        |
| TXT   | `_dmarc`                      | `v=DMARC1; p=none`                             | —        |
| CNAME | `hostingermail-a._domainkey`  | `hostingermail-a.dkim.mail.hostinger.com`      | —        |
| CNAME | `hostingermail-b._domainkey`  | `hostingermail-b.dkim.mail.hostinger.com`      | —        |
| CNAME | `hostingermail-c._domainkey`  | `hostingermail-c.dkim.mail.hostinger.com`      | —        |
| CNAME | `autodiscover`                | `autodiscover.mail.hostinger.com`              | —        |
| CNAME | `autoconfig`                  | `autoconfig.mail.hostinger.com`                | —        |

> **⚠️ Known import gotcha:** Cloudflare imports the 5 mail CNAMEs as **Proxied (orange)** —
> they must be toggled to grey **"DNS only"** or DKIM/email breaks. Only website records stay proxied.

### WEBSITE records (managed automatically by Cloudflare Pages custom domains)
The apex + `www` records pointing at the old Hostinger site (`A 145.223.124.152`, `A 147.79.79.23`,
two `AAAA`, and `CNAME www → …cdn.hstgr.net`) were **deleted**; Pages recreated the correct proxied records.

### www → non-www redirect
A Cloudflare Redirect Rule ("Redirect from WWW to root") sends `www.kellymariecounselling.com`
to `kellymariecounselling.com`.
