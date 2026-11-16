---
status: live
governs: [src/**]
verified: 2026-11-16
tracking: ["#428"]
---

# PrinceLists for Obsidian: tags a list or heading passes to its items

Tagging every item one by one is work, and a whole list often has one context: one to-do list is
work, another personal. A tag on the list, or on a heading, should count for every item under it,
so the Schedule's tag strip can show only work items, or only personal ones, across all lists with
one click **(owner, #428)**. This builds on [filtering by tag](2026-11-07-tag-filter-design.md),
which left "tags on a heading covering its section" out, and changes its No tag rule that a tag on
the heading above doesn't count.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-15 in #428; **(call)** means the designer did,
and a builder may revisit it. Step one's rules still hold: an edit replaces only the lines it
concerns, nothing is written in the background, and only documented Obsidian APIs are used.

## At a glance

- **A list's tags are its `tags` property (owner),** Obsidian's own, in the frontmatter beside
  `princelists: true`. Every item in the list inherits them.
- **A heading's tags are the tags in its text (owner),** such as `## Office #work`. Every item in
  its section inherits them: up to the next heading of any level, as dragging and collapsing count
  a section.
- **Filters treat an inherited tag as the item's own (owner):** in both tag strips, when tags
  combine, and for No tag.
- **Rows and cards show only an item's own tags (owner),** as today, so a work list's rows don't
  all say `#work`.
- **Not in this design (call):** showing inherited tags on rows, cards or the Schedule's
  subheadings.

## Approaches

1. **The `tags` property, plus heading text (chosen, owner).** Obsidian's search
   (`tag:#work`) and Bases (`file.hasTag`) already understand the property, and it's where a list's
   tags would already be. Tag list… in the list view sets it
   ([tag from menus](2026-11-16-tag-from-menus-design.md)); so does Obsidian, where it sets
   properties.
2. **A tag in the list note,** the text under the list's title. It can be typed in the list view,
   but tags already in that text, such as `#idea`, would then cover the whole list unasked.
3. **The plugin also writes the `tags` property** from the list view. Not now **(owner)**, and
   reversed in #434 ([tag from menus](2026-11-16-tag-from-menus-design.md)): the
   plugin edits frontmatter only line by line and never re-serializes it (AGENTS.md; step one,
   "Frontmatter"), as Turn into list adds its marker (`src/core/marker-edit.ts`). `tags` is harder
   to edit that way, since it can be a single value, a flow list or a block list over several
   lines. It can be its own issue later.

## A list's tags

- **Read from the file's text, with `parseYaml` and Obsidian's `parseFrontMatterTags` (call).**
  Both views read the text, as the list view already does for the marker
  (`src/obsidian/marker.ts`), not the metadata cache, which filtering by tag decided against for
  tags ("An item's tags"). The Schedule's `isList` reads the cache for the marker
  (`src/view/schedule-view.ts`); the builder keeps that and reads the tags from the text it already
  loads for each list's items.
- **What `parseFrontMatterTags` returns (checked in Obsidian 1.15.1's code):** it takes the key
  `tags` in any case, keeps string values only, drops any value with a space, and adds `#`, which
  the plugin drops. So `tags: work` and `tags: [work, home]` give `work` and `home`; `tags: work,
  home` gives nothing; a number such as `1984` is dropped by YAML's typing. It returns an empty
  array when it drops every value, though `obsidian.d.ts` says `null`; the builder treats both as
  no tags.
- **Only what is a tag by the plugin's tag rule counts** (filtering by tag, "An item's tags"), so
  `tags: work,home`, which gives `#work,home`, counts as nothing **(call)**.
- **A frontmatter that isn't a mapping** has no `tags`, so the list has none.
- **Core stays free of Obsidian imports:** the view reads the list's tags and passes them to core,
  as it passes the content start **(call)**.
- **A change shows at once,** since the list view rereads its file on an outside change and the
  Schedule on the metadata cache's `changed` event, which Sync's changes reach too.
- **Where it's set:** Tag list… in the list view's menus. A list opens in the list view, which
  doesn't show properties. "Edit in Markdown" opens the note as Markdown, where Obsidian shows them at the top. The Properties view
  sidebar ("Properties view: Show file properties") shows and edits them with the list view open,
  and the strip and filters follow at once (checked in Obsidian 1.15.1).
- **The README says** to write the tag without `#` or quote it: unquoted, `tags: #work` is a YAML
  comment, and the note has no tag.

## A heading's tags

- **The tags in the heading's whole text,** by the same tag rule, from `headingText`
  (`src/core/display.ts`), which joins a setext heading's lines as the heading field and the
  drawing already do **(call)**.
- **They cover the heading's own section only (owner):** its items up to the next heading of any
  level, the section the parser already finds (`src/core/parse.ts`). A `### Calls` under
  `## Office #work` doesn't inherit `#work`; to cover it, tag it too.
  - **Why:** everywhere else a section stops at the next heading. Dragging a heading moves only its
    own section and leaves a deeper heading behind (step two, "Dragging a heading";
    `src/core/move-section.ts`), and collapsing works the same way. If a tag covered deeper
    headings, dragging `## Office` away would quietly change the tags of the Calls items, with
    nothing in the file showing why.
- **Items before the first heading** inherit only the list's tags.
- **The heading shows its tags inside its text,** drawn by Obsidian's renderer as today, and they
  are added or removed by editing that text, or with Tag… in the heading's menu **(call)**.

## What an item carries

- **Its own tags,** the tags on its line as filtering by tag defines them, **plus the tags it
  inherits** from its list and its heading, each once, without regard to case **(owner)**.
- **The matching stays core's:** `meetsLitTags` and `stripTags` already take one array of tags per
  item, so the change is in what their callers pass (`src/core/display.ts` for a list,
  `src/core/schedule.ts` for the Schedule) **(call)**.
- **A nested tag counts under its parent,** as for an item's own: a list tagged `work/acme` shows
  under a lit `#work`.
- **Done and archived items inherit too.** Whether they show is as today.

## Filtering

- **The Schedule's strip** gains each list's and heading's tags, so `#work` and `#personal` are in
  it once a work or personal list has a dated item **(owner)**. Lighting `#work` shows every dated
  item that carries it, its own or inherited.
- **A list's strip** gains its headings' tags, so a list can be narrowed to the sections tagged
  `#frozen`. It leaves out the list's own tags and their parents, even where an item or heading
  carries one too **(call)**: every item carries them, so lighting one would change nothing. A
  list whose only tags are its own therefore shows no strip, as a list with no tags doesn't.
- **A strip shows only the tags its shown items carry,** as filtering by tag says, so a tagged
  heading with no items adds nothing, and an archived item's inherited tags count only while
  archived items show **(call)**.
- **No tag** shows the items that carry no tag from anywhere **(owner)**. In a list with tags of
  its own it finds nothing, which the strip already allows ("It stays when every item has a tag;
  lit, it then finds nothing").
- **Moving an item can change what it carries,** which a move never did before: dragging it, or
  "Move to heading" on a selection, out of a section tagged `#work` while `#work` is lit. It then
  hides once dropped, as an edited item that stops matching does; a moved selection leaves
  selecting as select-several says when its rows hide, and Undo brings them back **(call)**.
- **Everything else is as filtering by tag says:** the clear button, what Escape does, and that lit
  tags aren't remembered.

## What doesn't change

- **Rows show only their own tags (owner),** the chips of their tail.
- **The card** shows and edits only the item's own tags. Its add-tag popover leaves inherited tags
  out of its suggestions, and passes them with the item's own as the tags to leave out
  (`src/core/tag-choices.ts`), so typing one offers nothing: adding it would change nothing
  **(call)**.
- **Tagging a selection** adds and removes tags on the items' own lines. Its chips come only from
  the items' tails, so an inherited tag is never offered for removal; its field leaves out a tag
  every selected item carries, its own or inherited, as the card's popover does **(call)**.
- **A list inside another note** shows no strip and no cards, so nothing changes there.
- **Nothing is written:** inheriting a tag never adds it to an item's line.

## Docs to update in the build

- **[Filtering by tag](2026-11-07-tag-filter-design.md):**
  - "Not in this design": tags on a heading.
  - "An item's tags": that a heading's tag doesn't count, and the metadata cache's reason, which
    names headings' and frontmatter's tags.
  - "The strip": what's in it.
  - "No tag": that a tag on the heading above doesn't count.
  - The card's popover: "less the item's own", and why other lists' tags aren't offered.
- **[Tagging a selection](2026-11-12-select-tags-design.md):** the field's suggestions, and "Not in
  this design", which leaves out tags on headings.
- **[Step one](2026-10-20-prince-lists-design.md), "File format":** what `tags` and a heading's
  tags now mean.
- **README:** the intro to tags, the "Tags" and "Filter by tag" bullets, and "How a list is
  stored", with the `#` quoting note above.
- **AGENTS.md, "Read before working":** this design, beside filtering by tag.

## Risks to check during the build

1. **A heading's text with a tag in a link or code,** such as `` ## Use `#tag` ``, which isn't a
   tag: the heading's tags come from the same tag rule as a title's, so it should agree; a test
   checks it.

## Left to the builder

- **Where the inherited tags are computed (call):** once per parse, in the list view's `parsedText`
  memo (`PrinceListView.parse()`), and in the Schedule's `datedItems` for each list, not once per
  item or per filter run.
