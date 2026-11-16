---
status: building
governs: [src/**, styles.css]
verified: 2026-11-16
tracking: ["#434"]
---

# PrinceLists for Obsidian: tagging a heading or the list from its menus

Since [inherited tags](2026-11-15-inherited-tags-design.md), a heading's tags and the list's `tags`
property count for their items in the tag filters. Setting them still means typing: `#work` in a
heading's text through Rename heading or Edit in Markdown, and the list's `tags` in Obsidian's
**Show file properties** sidebar or as Markdown. Tagging a whole section or list should be as quick
as tagging an item from its card **(owner, #434)**.

This reverses the inherited tags design's Approach 3, which left writing the `tags` property out
because it is hard to edit line by line.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-16 in #434; **(call)** means the designer did,
and a builder may revisit it. Step one's rules still hold: an edit replaces only the lines it
concerns, nothing is written in the background, only documented Obsidian APIs are used, and the
frontmatter is never re-serialized, so `processFrontMatter` stays out.

## At a glance

- **Tag… in the heading menu (owner),** from a right-click on desktop and a tap on mobile.
- **Tag list… in the list's menus (owner):** the background's right-click menu on desktop, and the
  pane's ⋯ menu on desktop and mobile.
- **Each opens a tag popover (owner),** as the card's tag button and the selection's Tag… do: the
  heading's or list's own tags as chips with a ×, then a field with suggestions.
- **A heading's tag is ` #tag` in its text (owner),** written as Rename heading writes a name.
- **The list's tags are its `tags` property (owner),** edited line by line in whichever form it is
  written in, or added in the form Obsidian's Properties writes. YAML too unusual to edit safely is
  refused with a message pointing to **Show file properties**.
- **Cmd+Z undoes either (owner),** as it undoes the card's tag edits and a rename.

## Approaches

1. **The plugin edits the `tags` lines itself (chosen, owner).** It keeps every other line of the
   frontmatter as it is, as Turn into list does when it adds its marker
   (`src/core/marker-edit.ts`).
2. **`FileManager.processFrontMatter`.** Documented and simple, but it re-serializes the whole
   frontmatter: comments, quoting and key order can change. AGENTS.md and step one ("Frontmatter")
   rule it out.
3. **The menu opens Obsidian's Properties sidebar** and the plugin writes nothing. The plugin would
   have to run Obsidian's "Show file properties" command, and `obsidian.d.ts` has no way to run a
   command, so it would rest on undocumented API.

A heading has one way: its tags are in its text, so the tag goes in the text.

## The menus

- **Tag… (owner)** goes in the heading menu after Rename heading, in its group, so the heading
  menu groups Select; New item, New heading below, Rename heading and Tag…; Edit in Markdown;
  Collapse or Expand all headings; Delete heading **(call)**. The name is the selection's menu's
  ([tagging a selection](2026-11-12-select-tags-design.md), "The selection's menu").
- **Tag list… (owner)** goes in the background's menu after New heading, and in the pane's ⋯ menu
  before Show archived items, shown only on a list as that item is **(call)**.
- **While selecting,** the menus open as they do today: a tap on a heading selects it, and only a
  right-click on a heading outside the selection opens its menu with Tag….
- **A list inside another note** has neither menu, so nothing changes there.

## The popover

- **The selection's popover, given a target (call):** the plugin's own element on the view's
  container, with its focus, Escape and outside-press handling and its look. The selection, a
  heading and the list each give it their chips, suggestions and writes, rather than a third copy
  of the popover. It lives in `src/view/tags-popover.ts`, and each target says when it is stale
  (`isStale`), which closes it: the selection's, once the view isn't selecting or its rows or their
  text changed. Chips, button and where focus returns are the target's too.
- **Where it opens (call):** against the heading for Tag…, and against the list's title for Tag
  list…, scrolled into view if needed, inside the view and right-aligned with it as far as the
  view's width allows. A heading's popover opens above it when there is more room there than
  below, so the field never opens off the view's bottom. It follows its anchor as the list scrolls
  and as the view draws again, and closes once the anchor isn't drawn.
- **The chips (owner)** are the target's own tags, each with a × named "Remove #work":
  - **A heading's chips are the tags at the end of its text (call),** after its last word that
    isn't a tag, as a row's chips are the tags in its tail. A tag earlier in the text, as in
    `## The #work trip`, stays part of the words and is edited with Rename heading.
  - **The list's chips are its tags** as the plugin reads them (inherited tags, "A list's tags").
    A value that isn't a tag by the plugin's tag rule, such as `work home`, gets no chip and is
    kept as it is.
  - With no tags, no chips show.
- **The field (owner)** is the card's `AbstractInputSuggest`, focused on open. It suggests the
  list's tags in the strip's order, then `New tag: #<tag>`, as the card's does **(call)**, leaving
  out the tags the target already carries **(owner)**:
  - for a heading, every tag in its text and the list's own;
  - for the list, its own. A heading's tag stays, since putting it on the list covers every item.
- **A pick or a × writes, and the popover closes (call),** as the selection's does, with no
  message: one target changes, as with the card's popover. Focus goes back to the list.

## A heading's tags

- **A pick adds ` #tag` at the end of the heading's text (owner)** with `setHeadingText`
  (`src/core/edit-headings.ts`), so the level and an ATX heading's closing `##` stay. A setext
  heading over several lines becomes one line, as a rename makes it **(call)**.
- **A × removes the tag and the whitespace right before it (call),** every spelling of it at the
  end of the text, as `removeTag` does for a tail. The rest of the heading's text stays byte for
  byte. `removeTag` reads only
  item lines, so a heading needs its own function, finding its tags with the same parse as
  inherited tags do (`inlineTags`, `src/core/item-tags.ts`).
- **A result that wouldn't come back as this heading isn't written,** with Rename heading's
  message (step one, "Item actions"). A heading that is only a tag, as `## #work`, is a heading.
- **A × that would leave the heading with no text isn't written (call),** with the same message,
  as Rename heading never writes an empty name. `## #work` keeps its tag until it has a name.

## The list's tags

- **Which key:** the frontmatter's `tags` in any letter case, as `parseFrontMatterTags` reads it.
  Two such keys are refused.
- **The forms it edits (owner):**
  - **No `tags`:** `tags:` and `  - home` go in before the closing `---`, the block list Obsidian's
    Properties writes (checked in 1.15.1).
  - **One value,** `tags: work`: the line becomes the flow list `tags: [work, home]` **(call)**,
    one line for one line.
  - **A flow list on one line,** `tags: [work]` or `tags: []`: `home` goes in before the `]`.
  - **A block list,** `tags:` with `- work` lines under it: `- home` goes after its last item,
    indented as that item is.
  - **An empty value,** `tags:` with nothing under it: it becomes the block list.
- **Removing (owner)** takes out the flow entry with its comma, or the block item's line. Removing
  the last tag takes out the key and its lines **(call)**, so the list is as it was before it had
  tags.
- **A value written as `#work` or quoted** counts as `work`, as the reading does, and is removed
  as written. A new tag is written plain, without `#` or quotes **(call)**.
- **A × removes every spelling of the tag (call),** as for a heading: `tags: [work, Work]` shows
  one chip, and its × takes out both entries in one edit.
- **Refused (owner),** with a message such as "The list's tags can't be changed here. Use Show
  file properties." and nothing written:
  - a frontmatter that isn't a mapping;
  - a flow list over several lines, a block scalar (`|`, `>`), an anchor, alias or YAML tag
    (`&`, `*`, `!`), or a comment on the `tags` lines;
  - a `tags` key twice;
  - an unquoted entry YAML reads as null, `true`, `false` or a number (`~`, `null`, `123`): Obsidian
    drops it on both sides of the edit, so the parse check below can't catch it;
  - anything else the edit can't place exactly.
- **Checked by parsing (call):** before writing, the plugin parses the old and new frontmatter with
  `parseYaml` and writes only if every other property parses the same and the tags are exactly the
  old ones with the one tag added, or with every spelling of it gone, compared without regard to
  case. Anything else is refused as above. This catches a form the
  rules above misread.
- **Core stays free of Obsidian imports (call):** the line edit is planned in core, as
  `planMarker` is, and the view does the parse check.
- **It writes through the list view's own one-off write (call),** with the view's undo history and
  write guard, as a rename does. The strip and the Schedule follow at once, as after any change to
  `tags`.

## Not in this design

- **Tagging a heading or list from the Schedule.** The Schedule has no heading or list menu.
- **Showing a heading's or list's tags anywhere new.** A heading shows them in its text, as
  today.
- **Other lists' tags as suggestions,** for the same reason the card leaves them out (filtering by
  tag, "The tag button opens a small popover"). Typing `work` still offers `New tag: #work`.

## Docs to update in the build

- **[Inherited tags](2026-11-15-inherited-tags-design.md):** Approach 3 and "Not in this design",
  "Where it's set" in "A list's tags", and the heading's tags "added or removed by editing that
  text".
- **[Step one](2026-10-20-prince-lists-design.md), "Item actions":** Tag… in the heading menu and
  its order, desktop and mobile.
- **[Step two](2026-10-27-prince-lists-step-2-design.md), "Right-click menus":** Tag list… in the
  background's menu, and in the pane's ⋯ menu.
- **[Tagging a selection](2026-11-12-select-tags-design.md):** the popover's other targets.
- **README:** the "Tags" bullet and `tags` in "How a list is stored".
- **AGENTS.md, "Read before working":** this design, beside inherited tags.

## Risks to check during the build

1. **Obsidian's Properties sidebar, open while the plugin writes `tags`,** should show the new
   value and not write back the old one. Checked by hand.
2. **CRLF files:** a new line takes the file's usual ending and a replaced one keeps its own, as
   `applyMarkerEdit` does. A test checks it.
3. **A block list written without indent,** `tags:` then `- work` at the start of the line, is
   valid YAML; the new item matches it. A test checks it.

## Left to the builder

- **The message's exact words,** and whether "Couldn't change the heading's tags" reuses Rename
  heading's text or has its own.
- **How the popover's targets are shaped in code,** as long as the selection's popover keeps its
  behavior.
