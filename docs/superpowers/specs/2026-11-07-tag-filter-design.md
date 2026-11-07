---
status: building
governs: [src/**, styles.css]
tracking: ["#325"]
---

# PrinceLists for Obsidian: filtering by tag

Some lists group their items two ways at once. A grocery list has headings by kind of food
(Protein, Vegetables, Carbs), while the shop is walked by area: pantry, frozen, fridge. Sub-headings
can't hold both: Pantry and Frozen would repeat under every heading. Tags hold the second grouping
in the file (`- [ ] Fries #frozen`), but today a row hides a tag written at the end of an item, and
nothing filters by one (#325). This design shows an item's tags and filters a list, or the
Schedule, by them. It isn't only for groceries: a to-do or packing list narrows the same way
**(owner)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-07; **(call)** means the designer did, and a
builder may revisit it. Step one's rules still hold: an edit replaces only the lines it concerns,
nothing is written in the background, and only documented Obsidian APIs are used.

## At a glance

- **A strip of the list's tags** sits between the list note and the rows. Tapping a tag shows only
  the items that carry it **(owner)**.
- **Tags combine:** with two tags lit, only items carrying both show **(owner)**.
- **A setting** shows the strip always, the default, or only while the filter field is open
  **(owner)**.
- **Rows show their tags as labels,** and the open card adds and removes them **(owner)**.
- **The Schedule has the strip too (owner).**
- **Not in this design (call):** a tag strip in a list inside another note; tags on a heading
  covering its section; tags in an item's notes.

## An item's tags

- **An item's tags are the tags on its own line (call):** in its title, as in `- [ ] #frozen
  Fries`, and in the hidden part after it, as in `- [ ] Fries #frozen`, which the parser reads as
  the line's tail, with Tasks' fields (`src/core/item-line.ts`). Tags in its notes don't count,
  and neither does a tag on the heading above it.
- **A tag is what Obsidian reads as one** (Obsidian Help, "Tags"): letters, numbers, `_`, `-`,
  `/` and other Unicode characters, emoji included, with at least one that isn't a number, so
  `#1984` isn't a tag.
- **Core has one tag rule (call),** shared by the item reader and the `Tag` parser
  (`src/core/obsidian-markdown.ts`), which reads a title's tags and is also what Clear formatting
  uses (the notes editor itself reads no tags), so a row, the strip and Clear formatting agree on
  what a tag is. That parser accepted `#1984` and stopped at an emoji; it now follows Obsidian's
  format, and Clear formatting follows.
- **The tail keeps Tasks' rule for what it holds,** which accepts `#1984` (`item-line.ts`). A
  tail `#1984` stays hidden on the row, as today, and isn't a tag here.
- **A tail field such as `#frozen;` stays a Tasks field (call),** hidden, and isn't a tag here,
  though Obsidian reads `#frozen` in it: the tail's fields are Tasks' and are read whole.
- **Obsidian's metadata cache isn't used for this (call),** although it indexes tags
  (`CachedMetadata.tags`, `getAllTags`): core has no Obsidian imports, the cache catches up only
  after the view's own writes, and it also counts tags in the notes, headings and frontmatter.
- **Case doesn't matter (call),** as in Obsidian, where `#Frozen` and `#frozen` are one tag
  (Obsidian Help, "Tags"). The strip shows the casing that comes first in the file, or, in the
  Schedule, first in its order.
- **A nested tag counts under its parent (call),** as Obsidian's search does: `#shop` finds
  `#shop/frozen` too (Obsidian Help, "Nested tags"). The strip lists each tag as written.

## The tag strip

- **Where it sits (owner):** between the list note and the rows. With the filter field open, the
  strip is below the field **(call)**, so it is always directly above the rows.
- **What's in it:** each tag the list's items carry, once **(owner)**, sorted alphabetically,
  ignoring case **(call)**. Archived items' tags are in it only while "Show archived items" is on
  **(call)**, since their items show only then. A list with no tags shows no strip **(owner)**.
- **It wraps onto more lines** when the tags don't fit across the pane **(call)**.
- **Each tag is a toggle button,** with `aria-pressed` as the field's toggles have, at least 24 by
  24 CSS pixels, the minimum in WCAG 2.2's "Target Size (Minimum)" **(call)**. It is drawn with
  Obsidian's tag CSS variables, so it looks like a tag in a note, and a lit tag with the accent
  color.
- **A press keeps focus where it was (call),** as a press on the field's toggles does, so a phone's
  keyboard stays up while the field is open.
- **The strip keeps every tag while filtering (owner),** not only those of the items still shown,
  so what is lit can always be seen and turned off. A lit tag whose last item lost it stays in the
  strip, lit, until it's turned off **(call)**, so the filter never changes under you.
- **A clear button at the strip's end (owner)** turns off every lit tag. It shows only while a tag
  is lit, and clears only tags: typed text and "Show starred only" keep their own ways out
  **(owner)**. It is an icon button with the tooltip "Clear tags" **(call)**.

## Filtering

- **Tapping a tag lights it,** and only items carrying it show. Tapping a lit tag turns it off
  **(owner)**.
- **Tapping a second tag adds it (owner):** only items carrying every lit tag show. In the shop
  that means turning #frozen off before turning #pantry on, which the owner accepted, since
  narrowing (#pantry with #bulk) is the common case outside groceries.
- **It filters as typed text does** (step two, "Cmd+F"): the same rules decide which headings,
  Schedule groups and content the plugin leaves alone show, and what shows when nothing matches.
  This design doesn't restate them, so it follows any change to them.
- **With text or "Show starred only" too,** an item shows only if it matches all of them
  **(owner)**, as starred and text combine today.
- **Everything else works while filtering,** as with typed text: ticking, cards, dragging and
  adding. A new item isn't given the lit tags; like one that doesn't match typed text, it shows
  while its card is open and hides once it closes **(call)**.
- **Lit tags aren't remembered (owner):** a list opens with none lit, as with typed text and "Show
  starred only".
- **Escape and the filter icon end typed text and "Show starred only",** as today. With the strip
  set to "Always" they leave lit tags lit **(call)**, since the strip isn't part of the field, so
  they no longer always show every row. With "While filtering", closing the field turns lit tags
  off too **(owner)**, as it turns off "Show starred only".
- **The matching is core's:** the view passes the lit tags to core, as it passes the text matcher
  **(call)**.

## The setting

- **"Tag strip" (owner),** on PrinceLists' settings page (step two, "Settings"): a dropdown with
  "Always" and "While filtering". The default is "Always" **(owner)**, which shows the strip on
  every list with tags. Step two's settings keep the plugin as it was before the page existed; this
  default is an exception the owner chose, as the two "+" buttons' are.
- **"While filtering"** shows the strip only while the filter field is open, under the field. The
  list then looks as it does today until the filter icon, Cmd+F or "Filter list" opens it.
- **A change shows at once** in open lists and the Schedule, and a stored value that isn't one of
  the two reads as "Always" **(call)**.
- **A change that hides the strip turns lit tags off (call),** such as "While filtering" with the
  field closed, so no hidden tag filters the rows.

## Rows

- **A row shows its tags as labels (owner),** like its star and day: tapping one does what tapping
  the row does, which opens its card. Only the strip filters **(owner)**.
- **The row's chips are the tags in its tail,** read with the rule above **(call)**. A tag in the
  title already shows inside the title, which Obsidian's renderer draws, so it gets no second chip.
  A tap on it does what a tap on a link in a row does (step one, "Layout"), which is Obsidian's,
  not the card's; the build checks what that is (risk 3).
- **The tags follow the title on its line at every width (owner, 2026-11-07).** The title's text
  is drawn by Obsidian's renderer, so the tags can't flow inside it: they follow it and wrap among
  themselves when the line is full **(call)**.
  - **In a wider pane,** the star and the day follow the tags.
  - **In a view 480 pixels wide or narrower,** the star and the day go to the row's right edge, as
    in a row without tags (`styles.css`, the 480-pixel container query), and the tags fill the room
    between the title and them.
- **The reading order is title, tags, star, day at every width (call),** so a screen reader reads
  a row the same way on a phone and a desktop.
- **A done item's chips are gray,** as its title is **(call)**.
- **Rows in the Schedule and in a list inside another note show their tags too (call),** as they
  show the star.

## The card

- **A tag button left of the star (owner),** so the card's top reads tag, star, day, ⋯, as a
  closed row reads title, tags, star, day. Its icon is a tag from Obsidian's built-in Lucide set
  **(call)**, and its tooltip is "Add tag".
- **The item's tags show in the card (owner),** under the title, each with an × that takes it off.
  These are the tags in its tail; a tag in the title stays in the title field, where it's edited as
  text **(call)**. Today the card hides the tail while you edit (step one, "Editing"), so a tag
  typed there can't be seen again in the view; showing them fixes that.
- **The tag button opens a type-ahead (owner):** an input with Obsidian's `AbstractInputSuggest`
  (`@since` 1.4.10, older than `minAppVersion` 1.13.4). It suggests this list's tags **(call)**,
  the same set the strip shows with no tag lit, less the item's own, and `New tag: #<tag>` for
  anything else. Other lists' tags aren't offered:
  the metadata cache would hold them, but with their notes', headings' and frontmatter's tags,
  which this design doesn't count. A leading `#` is optional, and text that isn't a tag (a space,
  only numbers) isn't offered **(call)**.
- **Typing a tag at the end of the title keeps working (owner):** the file reads it as the tail, as
  it does today, and it then shows in the card with the others.
- **Adding or removing a tag changes only the item's line (call),** like setting a When:
  - A new tag goes in the tail, before a block ID (` ^id`) and trailing whitespace, as a new When
    does (step two, "When (owner)" under "What's written in the file"), and Tasks still reads
    every field. Where among the tail's fields it goes is the builder's.
  - Adding a tag the item already has, in any case, writes nothing.
  - Removing a tag takes the tag and the space before it only when that space is the tail's: on a
    line with no title, such as `- [ ] #errand` or `- [ ]  ⭐ #errand`, the space after `]` stays,
    so the line is still an item, as step two's star rule keeps it (step two, "Star (owner)").
  - Cmd+Z undoes it, as it does the plugin's other edits (step one, the "Undo" rule under "Saving,
    outside changes, sync conflicts, undo"). The tag input stays focused after each tag it adds, so
    while it's empty Cmd+Z and Cmd+Shift+Z step through the list's history; with text in it they
    undo the typing, as in other fields **(call)**.

## The Schedule

- **The Schedule has the same strip (owner),** under its description, or under its filter field
  while that's open, with the same setting.
- **Its tags are those of the items the Schedule gathers (call),** from every list, not every tag
  in those lists: a tag on no dated item would find nothing there.
- **Lit tags combine and clear as in a list.**

## What the build changes in the other designs

Each in the pull request that makes it untrue:

- **Step one, "Not in step one":** tags and tag filters are no longer only wanted later.
- **Step one, "Layout (owner)":** a row shows its tags as well as its checkbox, title, star and
  When.
- **Step one, "Editing":** the card shows the tail's tags, though the title field still hides them.
- **Step two, "When and the Schedule view":** a Schedule row shows its tags too.
- **Step two, "Cmd+F":** the filter icon and Escape show every row only once no tag is lit, or with
  "While filtering".
- **Step two, "Settings":** "Tag strip" joins the defaults that are an exception.
- **AGENTS.md, "Read before working":** this design, once approved.

## Risks to check during the build

1. **A tag edit, byte for byte:** adding and removing a tag on lines with a star, a `✔` mark, Tasks
   fields, a When, a block ID, no title with the tag first, no title with a star, CRLF endings and
   no final newline leaves every other byte, and Tasks still reads the same fields. Core tests,
   written first.
2. **Which tags count:** a tag in the title, in the tail, in the notes (not counted), nested, in
   another case, with an emoji, and a lookalike (`#1984`, a `#` inside a link or inline code), the
   same in Clear formatting (which keeps a tag whole) and the item reader. Core
   tests.
3. **A tag in a title, tapped:** what Obsidian's renderer draws for it and what a tap does there, on
   desktop and on a phone. If it opens nothing useful, the owner decides what it does.
4. **A long strip on a phone:** a list with many tags wraps without pushing the rows off the first
   screen in a way that makes the strip worse than no strip. Checked by hand on a phone; if it
   does, the owner decides between a fixed height and scrolling sideways.
5. **Tap targets:** strip tags and the clear button meet 24 by 24 CSS pixels on a phone.

## Order (call)

1. Core: the one tag rule, an item's tags, matching lit tags, and adding and removing a tag, with
   tests.
2. Rows show their tags.
3. The strip, filtering and the clear button in a list, with the setting.
4. The card's tag button, chips and type-ahead.
5. The Schedule's strip.
