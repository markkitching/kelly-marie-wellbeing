"""Regenerate the six 'Page:' entries in .pages.yml from one block map."""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ["heart-handshake","users","megaphone","user","target","infinity","presentation",
         "briefcase","message-circle","brain","shield","clock","layers","monitor","calendar",
         "mail","award","map-pin","check","leaf","book-open","mic","music","video","headphones",
         "shopping-bag","image","activity","compass","sun","graduation-cap","handshake",
         "lightbulb","sparkles","phone","quote","gift","package","shirt","coffee"]

PAGES = json.loads((ROOT / "src/_data/newPages.json").read_text())
# The Counselling page is built from the homepage's seven sections rather than from
# blocks, so it gets no entry here — its forms are copied from the homepage ones below.
SECTION_PAGES = {"counselling"}
# Pages with a layout and form of their own (see base-forms.yml), so no block form here.
OWN_FORM_PAGES = {"shop"}

BLOCKS = {
    "training-coaching": ["cards", "checklist", "quote", "faqs"],
    "podcast":           ["links", "episodes"],
    "meet-the-team":     ["people", "faqs"],
}

def f(name, label, ftype, indent=6, extra=""):
    pad = " " * indent
    out = f"{pad}- name: {name}\n{pad}  label: {label}\n{pad}  type: {ftype}\n"
    return out + extra

def icon_field(indent, description=None):
    pad = " " * indent
    vals = "\n".join(f"{pad}      - {i}" for i in ICONS)
    desc = f"{pad}  description: {description}\n" if description else ""
    return (f"{pad}- name: icon\n{pad}  label: Icon\n{desc}{pad}  type: select\n"
            f"{pad}  options:\n{pad}    values:\n{vals}\n")

def listblock(name, label, description, subfields, *, summary, indent=6):
    """A repeatable block.

    Rows collapse to a single line showing `summary`, so a long list stays draggable
    rather than becoming a wall of open forms. `{field}` resolves against the row.
    """
    pad = " " * indent
    out = (f"{pad}- name: {name}\n{pad}  label: {label}\n{pad}  description: {description}\n"
           f"{pad}  type: object\n"
           f"{pad}  list:\n"
           f"{pad}    collapsible:\n"
           f"{pad}      collapsed: true\n"
           f"{pad}      summary: '{summary}'\n"
           f"{pad}  fields:\n")
    return out + subfields

def sub(name, label, ftype, indent=6, description=None, values=None):
    pad = " " * (indent + 4)
    out = f"{pad}- name: {name}\n{pad}  label: {label}\n"
    if description:
        out += f"{pad}  description: {description}\n"
    out += f"{pad}  type: {ftype}\n"
    if values:
        out += f"{pad}  options:\n{pad}    values:\n"
        out += "".join(f"{pad}      - {v}\n" for v in values)
    return out

def build(slug, title):
    blocks = BLOCKS[slug]
    body = (
        f"  - name: page-{slug}\n"
        f"    label: 'Page: {title}'\n"
        f"    description: >-\n"
        f"      Every section below is optional — fill in what suits this page and leave the rest\n"
        f"      empty. Clear the whole page and it goes back to its \"coming soon\" screen.\n"
        f"      This page's menu link is under Main menu.\n"
        f"    type: file\n"
        f"    path: src/content/pages/{slug}.json\n"
        f"    format: json\n"
        f"    fields:\n"
    )
    body += f("eyebrow", "Small heading above the title (optional)", "string")
    body += f("heading", f'Page title (leave blank to use "{title}")', "string")
    body += f("intro", "Intro paragraph (shown slightly larger)", "text")
    body += f("body", "Main text (press Enter for new lines)", "text")
    body += f("image", "Photo (optional — sits beside the main text)", "image")
    body += ("      - name: mainTextPosition\n"
             "        label: Where the main text sits\n"
             "        description: Near the top, or further down once the cards and checklist have been read.\n"
             "        type: select\n"
             "        options:\n"
             "          values:\n"
             "            - Near the top\n"
             "            - After the checklist\n")

    if "cards" in blocks:
        body += f("cardsTitle", "Cards — section heading (optional)", "string")
        body += listblock("cards", "Cards",
            "Each card is shown as a heading and text under a thin line. Drag to reorder. A card with no title is not shown.",
            icon_field(10, "Not shown on the site at the moment.") + sub("title", "Title", "string")
            + sub("description", "Description", "text")
            + sub("meta", "Small label underneath (optional)", "string"), summary="{title}")

    if "checklist" in blocks:
        body += f("checklistTitle", "Checklist — section heading (optional)", "string")
        body += listblock("checklistItems", "Checklist items",
            "Shown as a two-column ticked list. An item with no text is not shown.",
            sub("text", "Text", "string"), summary="{text}")

    if "links" in blocks:
        body += f("linksTitle", "Listen links — section heading (optional)", "string")
        body += listblock("links", "Listen links",
            'Buttons linking out. Leave the address empty and the button shows as a greyed "Soon".',
            sub("label", "Button text", "string") + icon_field(10)
            + sub("href", "Address", "string", description="Full https:// address"), summary="{label}")

    if "episodes" in blocks:
        body += f("episodesTitle", "Episodes — section heading (optional)", "string")
        body += f("audioArtwork", "Artwork for audio-only episodes", "image",
                  )
        body += listblock("episodes", "Episodes",
            "Drag to reorder — newest first is usual. An episode with no title is not shown.",
            sub("number", "Episode number (optional)", "string")
            + sub("title", "Title", "string")
            + sub("description", "Description", "text")
            + sub("meta", "Duration or date (optional)", "string")
            + sub("youtube", "YouTube link", "string",
                  description="Paste anything YouTube's Share button gives you. Adds a video the visitor can play here.")
            + sub("spotify", "Spotify link", "string",
                  description="Paste anything Spotify's Share button gives you."),
            summary="{title}")
        body += listblock("removedEpisodes", "Removed episodes",
            "Episodes deleted from the list above. Kept so they are never pulled back in. Set Restore to Yes and the next sync puts one back.",
            sub("number", "Episode number", "string")
            + sub("title", "Title", "string")
            + sub("description", "Description", "text")
            + sub("meta", "Duration or date", "string")
            + sub("youtube", "YouTube link", "string")
            + sub("spotify", "Spotify link", "string")
            + sub("restore", "Put this episode back", "boolean",
                  description="Tick and save. It returns to the Episodes list about a minute later."),
            summary="{title}")

    if "products" in blocks:
        body += f("productsTitle", "Products — section heading (optional)", "string")
        body += listblock("products", "Products",
            "A product with no name is not shown.",
            sub("name", "Name", "string")
            + sub("description", "Description", "text")
            + sub("image", "Photo", "image")
            + sub("price", "Price (optional)", "string", description='e.g. "£14.00". Leave empty to show the label below instead.')
            + sub("meta", "Label shown when there is no price", "string", description='e.g. "Coming soon"')
            + sub("href", "Buy link (optional)", "string"), summary="{name}")

    if "people" in blocks:
        body += f("peopleTitle", "People — section heading (optional)", "string")
        body += listblock("people", "People",
            "A person with no name is not shown.",
            sub("name", "Name", "string")
            + sub("role", "Role", "string")
            + sub("credentials", "Credentials (optional)", "string")
            + sub("bio", "Short biography", "text")
            + sub("image", "Photo", "image"), summary="{name}")

    if "quote" in blocks:
        body += f("quote", "Quote (optional — shown on the dark band)", "text")
        body += f("quoteAuthor", "Quote — who said it", "string")

    if "faqs" in blocks:
        body += f("faqsTitle", 'Questions — section heading (leave blank for "Common questions")', "string")
        body += listblock("faqs", "Common questions",
            "Shown as an accordion. A question with no text is not shown.",
            sub("question", "Question", "string") + sub("answer", "Answer", "text"), summary="{question}")

    body += f("ctaHeading", "Closing section — heading (optional)", "string")
    body += f("ctaText", "Closing section — text (optional)", "text")
    body += f("ctaButtonLabel", 'Closing button text (blank uses "Request a Consultation")', "string")
    body += icon_field(6).replace("- name: icon\n", "- name: ctaButtonIcon\n").replace("  label: Icon\n", "  label: Closing button icon\n")
    body += f("ctaButtonHref", 'Closing button link (blank goes to the contact form)', "string")
    body += f("ctaBackLabel", "Back-to-home button text (blank removes the button)", "string")
    return body

SECTION_LABELS = {
    "hero": "Top section (hero)", "about": "About Kelly", "services": "Services",
    "workplace": "Workplace Wellness", "approach": "Therapeutic approach",
    "process": "The process", "contact": "Contact",
}

# Sections a page doesn't render, so it gets no form for them either. The Counselling
# page has no enquiry form — its hero button goes to the homepage's.
SECTIONS_OMITTED = {"counselling": {"contact"}}

# What each page actually renders, mirroring `sectionsShown` in the templates. The
# homepage is its top section and nothing else; Contact keeps a form of its own because
# the footer prints the email address and location on every page.
SECTIONS_SHOWN = {
    "index": ["hero"],
    "counselling": ["hero", "about", "services", "workplace", "approach", "process"],
}
# The contact section is no longer on any page's section list, but it has a page of its
# own, so it still needs a form.
STANDALONE_FORMS = ["contact"]

# Individual fields a page doesn't render. The Counselling page's hero has no buttons,
# so offering somewhere to type their labels would be offering to edit nothing.
FIELDS_OMITTED = {"counselling": {"hero": {"primaryButton", "primaryButtonIcon", "secondaryButton"}}}


def drop_fields(block, names):
    """Remove named top-level fields from a copied section form.

    Field entries sit at six spaces; anything deeper belongs to a list's sub-fields and
    is left alone.
    """
    if not names:
        return block
    kept, dropping = [], False
    for line in block.split("\n"):
        if line.startswith("      - name: "):
            dropping = line[len("      - name: "):].strip() in names
        elif dropping and line.strip() and not line.startswith("       "):
            dropping = False          # back out to a shallower level
        if not dropping:
            kept.append(line)
    return "\n".join(kept)


SECTION_FORMS = (ROOT / "scripts" / "section-forms.yml").read_text()


ICON_PLACEHOLDER = "values: __ICON_VALUES__"


def expand_icons(block):
    for line in block.split("\n"):
        if ICON_PLACEHOLDER in line:
            pad = line[: line.index("values:")]
            listing = "\n".join(f"{pad}  - {icon}" for icon in ICONS)
            block = block.replace(line, f"{pad}values:\n{listing}", 1)
    return block


def section_block(name):
    """One section's form, as written in scripts/section-forms.yml."""
    start = SECTION_FORMS.index(f"  - name: {name}\n")
    after = SECTION_FORMS.find("\n  - name: ", start + 1)
    return SECTION_FORMS[start:after + 1] if after != -1 else SECTION_FORMS[start:] + "\n"


def section_forms(slug, title, shown, *, prefixed=True):
    """A form per section a page shows, re-pointed at that page's copy of the content.

    Stamped from one definition rather than written out per page, so a field added to a
    section's form reaches every page that shows it.
    """
    out = []
    for name in shown:
        block = section_block(name)
        label = SECTION_LABELS[name]

        if prefixed:
            block = block.replace(f"  - name: {name}\n", f"  - name: {slug}-{name}\n", 1)
            block = re.sub(r"^    label: .*$", f"    label: '{title}: {label}'", block, count=1, flags=re.M)
            block = re.sub(r"^    path: src/content/.*$", f"    path: src/content/{slug}/{name}.json",
                           block, count=1, flags=re.M)
        block = drop_fields(block, FIELDS_OMITTED.get(slug, {}).get(name, set()))
        out.append(block)
    return "".join(out)


# The homepage's own sections keep their plain names, so their paths and labels are
# untouched; everything else is prefixed with its page.
entries = section_forms("index", "", SECTIONS_SHOWN["index"], prefixed=False)
entries += section_forms("standalone", "", STANDALONE_FORMS, prefixed=False)
entries += "".join(build(p["slug"], p["title"]) for p in PAGES if p["slug"] not in SECTION_PAGES | OWN_FORM_PAGES)
entries += section_forms("counselling", "Counselling", SECTIONS_SHOWN["counselling"])

PREAMBLE = """# GENERATED FILE — do not edit.
#
# Written by scripts/gen-pages-yml.py from:
#   scripts/base-forms.yml     the site-wide forms, and the media settings
#   scripts/section-forms.yml  the section forms, stamped out per page
#
# Change one of those and run:  python3 scripts/gen-pages-yml.py
# Then check nothing can be lost: python3 scripts/check-pages-yml.py
"""

base = (ROOT / "scripts" / "base-forms.yml").read_text()
base = base[base.index("media:"):]                    # drop that file's own header comment
new = expand_icons(PREAMBLE + base + entries)

if "__ICON_VALUES__" in new:
    raise SystemExit("an icon placeholder was left unexpanded")
(ROOT / ".pages.yml").write_text(new)
section_count = len(SECTION_LABELS) - len(SECTIONS_OMITTED.get("counselling", set()))
print(f"rewrote {len(PAGES) - len(SECTION_PAGES) - len(OWN_FORM_PAGES)} block pages + {section_count} counselling sections"
      f" — .pages.yml is now {len(new.splitlines())} lines")
