---
status: approved
verified: 2026-11-12
tracking: ["#361"]
---

# PrinceLists for Obsidian: tagging a selection

A list kept as a standing catalog, such as the food a household usually buys, gets tags by where
things go: `#pantry`, `#fridge`, `#freezer`. The tag strip then shows one place at a time. Items
are added without a tag and tagged later, many at once. Today each needs its card opened. This
design adds and removes a tag on every selected item at once (#361), on desktop and on a phone,
since a list must be manageable with only a phone at hand **(owner)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-12; **(call)** means the designer did, and a
builder may revisit it. #361 asked for Add tag… and Remove tag as two menu entries; the owner chose
one popover instead, after seeing both as mockups. It builds on
[selecting several rows](2026-11-07-select-several-design.md) (the bar, the selection's menu, the
Undo message) and [filtering by tag](2026-11-07-tag-filter-design.md) (what a tag is, the card's
tag popover, `addTag` and `removeTag`). Their rules hold unless this design says otherwise.

## At a glance

- **A Tag button in the selection bar (owner),** beside Star and Date.
- **One press opens a tag popover (owner),** as the open card's tag button does, not a menu first.
  It shows the tags the selected items carry, each with a × that takes it off them all, and a field
  that suggests the list's tags and `New tag: #<tag>`.
- **A pick gives the tag to every selected item that lacks it (owner),** in one write with an Undo
  message **(owner)**. The popover closes and the selection stays **(owner)**.
- **On desktop, the selection's menu gets Tag… (call),** which opens the same popover.

## The bar's Tag button

- **Its place (call):** Move to, Tick, Star, Tag, Date, then Delete past the divider. It has the
  `tag` icon, as the card's tag button does, and the label "Tag".
- **Enabled while any item is selected (call),** as Date is; a selection of headings alone
  disables it ("Actions apply to items only").
- **Icons only below 390 px, not 360 (owner):** six buttons 48 px wide and 8 px apart need a view
  about 387 px wide, so the labeled layout holds them only down to there. A narrower phone, such
  as one 360 or 375 px wide, gets the icons-only layout, whose buttons may narrow below 48 px, as
  in a sidebar today **(owner, 2026-11-12, in selecting several rows)**.
- **The one-row layout moves up too (call: the width):** at 520 px Done and the count leave about
  320 px, short of the 337 six buttons need, so it starts where every button keeps 48 px, about
  540 px. The builder measures it in Obsidian and names the width in the PR.
- **A screen reader (call):** the button has `aria-expanded`, as the card's tag button has, and
  `aria-haspopup="dialog"`; the popover has `role="dialog"`, named "Tag the selection".

## The popover

- **The plugin's own element, as the card's is (call),** for the same reasons
  ([filtering by tag](2026-11-07-tag-filter-design.md), "The tag button opens a small popover"):
  the card's border, radius and shadow variables, at `--layer-popover`. It sits above the bar's
  Tag button, right-aligned with it, and stays inside the view. The bar is on the view's container,
  outside the content element that the card's popover listens on, so this one needs focus, Escape
  and outside-press handling of its own.
- **First, the selection's tags (owner):** a chip per tag in the selected items' tails, each with a
  ×. A tag only some carry shows how many, as `#pantry 2 of 5` **(owner)**; one all carry shows as
  `#pantry` **(call)**. The rest is **(call)**: chips in the strip's order, which holds every
  shown item's tags; the count is of selected items, headings left out; the × is named
  "Remove #pantry", since the card's "Remove tag" has its item beside it; tags that differ only in
  letter case are one chip, spelled as the strip spells it, and its × removes every spelling, as
  `removeTag` does; with no tag among them, no chips show.
- **Then the field (owner),** the card's `AbstractInputSuggest`. The rest is **(call)**: it is
  focused on open, so a phone's keyboard comes up; it suggests the list's tags in the strip's
  order, as the card's does, less those every selected item already has by `addTag`'s rule (in its
  title or its tail), then `New tag: #<tag>` for a typed tag the list lacks. A tag only some items
  have stays, since picking it gives it to the rest.
- **Obsidian's suggestions** open in the page's body at z-index 60, above the popover, and may
  cover the bar while they show **(call)**: the bar is not in use then.
- **A pick (owner)** adds the tag with `addTag` to each selected item, which leaves an item that has
  it, in its title or its tail, as it is. The popover closes **(owner)** and focus goes to the
  bar's Tag button, as the card's popover returns it to its tag button **(call)**.
- **A × (owner)** takes the tag off each selected item's tail with `removeTag`. The popover closes,
  as after a pick **(call)**: one action, one message, and the chips never show a count from before
  the write.
- **The selection stays (owner),** as after the bar's other actions, so a star or a date can follow.
- **What closes it (call):**
  - Escape, once Obsidian's suggestions have taken the first one while they show, as on the card.
  - A second press of Tag.
  - A press anywhere else in the view, on a row, the tag strip or the list's title, which does
    nothing else: it neither selects nor unselects a row, nor opens a card nor lights a tag, so a
    near miss doesn't change what the next pick reaches. Focus leaves the field before the press's
    click arrives, so that click must be held back.
  - A press on another bar button, which then does what it does: Done ends selecting, Star opens
    its menu.
  - Any change to the selection, such as an outside change dropping a row or a ticked row hiding,
    so the chips and the next pick never describe rows that left.

## The selection's menu

- **Tag… (call),** after the star entries, opens the popover over the bar's Tag button, so desktop
  has one way to tag a selection whether it starts from the menu or the bar. It shows while any
  item is selected. The selection's menu is desktop only, as today; the bar opens no menu for Tag.

## The write and the message

- **One write and one Cmd+Z step (call),** through the selection's group action, as a star is
  ("Each action is one write"). Lines are read when the write runs, so an edit from outside since
  the popover opened is respected: an item that gained the tag is left as it is.
- **The Undo message (owner)** says what changed, as the other group actions do: `#pantry added
  to 3 items.` and `#pantry removed from 5 items.` **(call: the wording)**, counting only the items
  the write changed. A write that would change nothing writes nothing and says nothing **(call)**.
- **A tag in a title (call)** isn't a chip, as on the card, and × leaves it. An item with the tag
  only in its title counts as having it when adding, as `addTag` does, so a pick can change fewer
  items than the chip's count suggests; the message says how many it did.
- **Headings (call)** get no tag and aren't counted, as they get no star or date.

## Left to the builder

- How the card's `TagSuggest` serves both: today it reads the open card's item for the tags to
  leave out and adds to that item.
- Where the selection's tag counts are worked out, in `src/core/` with tests first, and the names.
- Where the suggestions open on a phone with the keyboard up; tagging must work on Android then.

## Not in this design

- **A No tag choice in the tag strip:** #383 **(owner)**, designed after this one **(call)**.
- **Renaming a tag across the list,** and tags on headings.
- **The Schedule and lists inside other notes:** selecting is only in the list view (owner).

## What it changes elsewhere

- **Selecting several rows:**
  - "At a glance": "Tags are their own design" points here as well.
  - "What the selection is", how it ends: the tag popover, like a menu or dialog, takes the first
    Escape.
  - "While selecting": while the tag popover is open, a press on a row only closes it.
  - "The bar": the buttons line names Tag, and the widths follow this design.
  - "The actions": the selection's menu gets Tag…, and the Undo message line names a tag change.
  - "Not in this design": "Tags: their own design" points here.
- **Filtering by tag:** the tag popover has a second home, at the selection bar.
- **AGENTS.md, "Read before working":** names this design beside the other two.
