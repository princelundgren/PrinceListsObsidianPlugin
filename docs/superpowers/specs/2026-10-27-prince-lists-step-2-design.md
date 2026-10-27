---
status: draft
verified: 2026-10-27
---

# PrinceLists for Obsidian: step two, ready to move in

Step one made a single list work. Step two adds what the owner needs before moving their todos
into Obsidian for good **(owner, 2026-10-27)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-10-27 unless another date is given; **(call)** means
the designer did, and a builder may revisit it. Everything step one decided still holds, its rules
included: an edit replaces only the lines it concerns, nothing is written in the background, and
only documented Obsidian APIs are used.

## At a glance

- **Checklists** in an item's notes can be ticked in its card.
- **Cmd+F** filters the open list.
- **A list can show inside another note,** such as a daily note, through a `princelists` code
  block. Its items can be ticked, added, deleted and dragged there, without cards.
- **"Turn into list"** adds the marker to the note you're in.
- **An item can have a When,** the day you plan to do it, shown with a calendar icon. A Schedule
  view gathers every list's items with a When: Today, with anything overdue, then Tomorrow, Coming
  week, Next month and Later.
- **An item can be starred.**
- **An empty list says how to add an item,** and Cmd+Enter adds one.
- **Dragging a heading moves its whole section,** and an arrow left of a heading collapses it.
- **Not in step two:** a Favorites view, and a New list button on Obsidian's New tab screen (see
  "Still later").

**Done when (call):** step two is released and the owner has moved their lists in from their
current todo app. Step one's own "Done when" doesn't change.

## What's written in the file

### When (owner)

- **Written as Tasks' scheduled date,** ` ⏳ YYYY-MM-DD`, among the title line's trailing Tasks
  fields, so Tasks and its queries read it as scheduled. Tasks also accepts `⌛`; the plugin reads
  both and writes `⏳` **(call)**.
- **In the view it never shows as `⏳`:** a row shows Lucide's `calendar` icon and the day
  (owner: the icon, not the hourglass).
- **Setting a When (call)** on an item that has one replaces its date in place. A new one goes at
  the end of the trailing Tasks fields, before a block ID (` ^id`) and trailing whitespace if the
  line has them. Clearing it removes the field and the space before it.
- **Several scheduled fields on one line (call),** for example after a Sync merge: the view shows
  the earliest, and setting or clearing a When replaces them all.
- **A day, no time:** Tasks' format has none.

### Star (owner)

- **` ⭐` at the end of the title,** before any `✔` mark and the trailing Tasks fields, so Tasks
  still reads them. Tasks shows the star as part of the item's text.
- **The order on a line with everything:**
  `- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id`. The title, then the star, then the `✔`
  mark, then the Tasks fields with the When last, then a block ID.
- **A title ending in a space and `⭐`** (with an optional U+FE0F) is starred **(call)**: `5⭐`
  isn't. The title is the text before any `✔` mark and the trailing Tasks fields, as the parser
  splits the line. The row hides the emoji and shows Lucide's `star` icon instead.
- **The title field shows the title without its star,** and saving puts ` ⭐` back, so typing can't
  drop the star or add a second one **(call)**.
- **Removing the star** removes the space, the `⭐` and any U+FE0F after it, and nothing else.

### Checklist lines

- **The format is step one's** ("Checklists"): checkbox lines in an item's notes are its checklist.
- **Ticking one writes `x` in its brackets, and unticking writes a space (call).** Nothing else on
  the line changes, no `✔` and no date: a checklist line is a step of an item, not an item. As for
  items, any character other than a space counts as ticked.

### The marker, added by "Turn into list" (owner: the marker only)

- **With frontmatter** (`getFrontMatterInfo`, at byte 0): `princelists: true` goes in as the last
  line before the closing `---`. The YAML is never re-serialized.
- **Only into frontmatter that is a mapping (call).** If the metadata cache reads no object from
  frontmatter that's there (a list, a single value or broken YAML), adding a line would leave it
  invalid, so the command changes nothing and says so.
- **A `princelists:` line already there** with another single-line value, such as `false`, is
  replaced. If its value runs over several lines, the command changes nothing and says so
  **(call)**.
- **Without frontmatter:** `---`, `princelists: true` and `---` go before the first line, with the
  file's usual line ending.
- **Nothing else in the note changes.** `- [ ]` lines become items. Plain bullets stay content the
  plugin leaves alone.

## The features

### Ticking checklists

- **In the card's rendered notes, a checklist's checkboxes work** (step one disables them). A click
  ticks or unticks that line through the same guarded write as other edits, and Cmd+Z undoes it.
- **Which line a checkbox ticks (call):** the nth rendered checkbox is the nth checkbox line the
  core parser finds in the item's notes. Obsidian's rendered output carries no documented line
  numbers. "Risks" has the check.
- **When the two disagree, every checkbox in that card stays disabled (call),** as in step one: if
  the number of rendered checkboxes or any of their ticked states differs from the parsed lines.
  Callouts, embeds, HTML, code fences, `%%` comments and `$$` math can each make them differ, and a
  tick on the wrong line is worse than no tick.
- **Nested checklist lines** tick the same way.
- **The row shows nothing about a checklist (call).** A progress count wasn't asked for.

### Cmd+F: filter the list (owner: this list only)

- **Cmd+F, while a list has focus, opens a filter field** at the top of the list, below the list
  note **(call)**. It's registered on the view's own `scope`, as Cmd+Z is, so it applies only
  while the list has focus and isn't a default hotkey. Cmd+F in a Markdown note is untouched.
- **A "Find in list" command** opens the same field, for the iPhone and for anyone who wants
  another hotkey. It has no default hotkey **(call)**.
- **As you type, items whose title or notes don't contain the text hide (call).** The match ignores
  case and compares the text as written, Markdown included, with no Unicode normalization.
- **A heading shows while one of its items shows (call).** Headings themselves aren't searched.
- **Archived items are searched only while "Show archived" is on.**
- **Escape in the field, or emptying it, ends the filter** and shows every row again. Like "Show
  archived", it isn't remembered **(call)**.
- **Everything else works while filtering (call):** ticking, cards, dragging and adding. A drop
  goes after the visible row above it, as it does past hidden archived rows. A new item, or an item
  whose card is open, stays shown while its card is open even if it doesn't match.

### A list inside another note (owner)

- **Written as a code block** naming the list with a link:

  ````markdown
  ```princelists
  [[Groceries]]
  ```
  ````

  It renders through `registerMarkdownCodeBlockProcessor` (since 0.9.7), in reading view and Live
  Preview. The block is typed by hand in step two **(call)**.
- **It shows (owner):** the list's name as a link to it, its headings, and its items as rows with
  a checkbox, the rendered title, the star and the When. The list note and the items' notes don't
  show, and there are no cards.
  - Done items stay gray until archived. Archived items are hidden, with no "Show archived"
    **(call)**.
- **Ticking** works as in the list view.
- **Titles are edited in place (call).** A click on a title, not on a link in it, turns it into a
  field: Enter or leaving saves, Escape cancels.
- **Adding:** a "New item" button below the rows adds an item where "+" puts one with nothing
  selected, as the list's first item, and opens its title field **(call)**. Shift+Enter adds the
  next one. Leaving a new item with an empty title removes it, as in the list view.
- **Deleting (call):** a trash button shows at the end of the title field while it's open, on the
  Mac and the iPhone, since the iPhone has no long-press menu. On the Mac, right-clicking an item
  offers Delete too. Both show the Undo message, as Delete does in the list view.
- **Dragging** works within the block, within and between sections: with the mouse on the Mac and
  hold-and-move on the iPhone, with the list view's drop rules.
- **Writes go to the list's file** through the same guarded edits. An open list view of that file
  follows them as a change from outside **(call)**. Cmd+Z doesn't step through edits made in a
  block **(call)**.
- **It redraws when the list file changes.** Its listeners belong to a `MarkdownRenderChild`, so
  they go when the block does.
- **A link to no file, or to a note without the marker,** shows a gray line saying so, naming the
  link. So does a block that names the note it's in **(call)**: that note may be open in an editor
  with typing not yet saved. A note from outside the vault can't be linked, so it can't be shown
  this way.

### Turn into list (owner)

- **A "Turn into list" command,** available while the active note is a Markdown note in the vault
  without the marker. The note's file menu (right-click in the file explorer, or a long-press on
  the iPhone) has it too **(call)**.
- **It writes the marker** as "What's written in the file" says, then opens the note as a list.
  - **The write path (call):** when the note is open in a Markdown editor, the line goes in through
    that editor, and the view is saved (`TextFileView.save`), so typing not yet saved isn't lost.
    This follows Obsidian's guideline to prefer the Editor API for the active file. Otherwise it's
    a `vault.process` edit.
  - The note opens as a list once the metadata cache reports the marker for it, not straight after
    the write.
- **Undoing it (call):** open the note as Markdown and remove the line. No command reverses it in
  step two.

### When and the Schedule view (owner)

- **Setting a When:** the card gets a When row, a calendar icon with the day, or a gray "When" when
  there is none. Clicking it opens the platform's date picker through an `<input type="date">`;
  a clear button next to it removes the When **(call)**. Obsidian has no date picker API, and the
  HTML input gives the iPhone's own picker.
- **On a row (call):** the calendar icon and a short day at the row's end: "Today", "Tomorrow", a
  weekday for the rest of the next seven days, or else the date in the locale's short form through
  Obsidian's `moment`, which follows the language set in Obsidian. A past day shows its date.
- **The Schedule view** is a view of its own, opened with an "Open schedule" command and a
  calendar ribbon icon **(call)**. It gathers, from every list in the vault, the items with a When
  that are open or done but not yet archived.
- **Its groups (owner):** Today, which includes everything overdue, then Tomorrow, Coming week,
  Next month and Later.
  - The ranges **(call)**: Coming week is two to seven days ahead, Next month 8 to 31 days ahead,
    and Later anything after that. An empty group is hidden.
  - Within a group, items go by day, then by list name, then by their order in the list **(call)**.
- **Each row shows** a checkbox, the title, the star, the list's name in gray, and the day, except
  for today's items in Today.
- **Ticking works in place.** A repeating item (🔁) shows the same message as in its list instead
  of ticking. A click on a row opens its list with that item's card open **(call)**. Rows can't
  be dragged: their order comes from the days.
- **It updates (call)** when it opens, when it gets focus, and when a list changes, through the
  metadata cache's `changed` event and the vault's `rename` and `delete`. Like a list, it runs no
  timer, so a view left open over midnight moves its items when it next gets focus.
- **Lists are found** by the marker in the metadata cache's frontmatter, and read with
  `vault.cachedRead`. Notes outside the vault aren't included.

### An empty list says how to add an item (owner)

- **A list with no items shows a gray hint** centered in the space below the list note, in
  `--text-faint`. It goes as soon as the first item is added and comes back if the last one is
  deleted. A list whose items are all archived and hidden doesn't show it **(call)**.
- **The text:** "Press Cmd+Enter or + to add an item" on the Mac, with Ctrl+Enter on Windows and
  Linux, and "Tap + to add an item" on the iPhone and iPad, which usually have no keyboard.
- **Cmd+Enter adds an item (owner),** the same as "+": below the selected item, or as the list's
  first item when nothing is selected. It's registered on the view's own `scope` as `Mod+Enter`,
  like Cmd+Z, so it works anywhere in a list that has focus, a card's fields included, and isn't
  a default hotkey **(call)**.

### Dragging a heading (owner)

- **Dragging a heading moves its section:** the heading and every line up to the next heading.
  That covers its items with their notes, hidden archived items and content the plugin leaves alone.
- **A section ends at the next heading of any level (call),** as step one's sections do, so
  dragging a `##` doesn't take a `###` below it along.
- **It's started as an item drag is:** with the mouse on the Mac, and by holding and then moving
  on the iPhone, where a tap still opens the heading menu. The drag closes an open card first. A
  heading whose name field is open doesn't drag **(call)**.
- **A section drops only between sections (call):** before another heading, or at the end of the
  list. The drop line shows above the heading it will go before, or under the last row for the
  end. It never drops above the items before the first heading, which would join the moved
  section, and that unnamed section has no heading to drag.
- **The file (call):** the section's lines move as they are, and the move goes through step one's
  check (`edit-check.ts`): if it would change how the rest of the list reads, such as a moved
  setext heading joining the paragraph above it, one empty line goes before it, and if that
  doesn't help, nothing is written and a message says so. The file keeps its line endings and
  final-newline rules. Dropped where it already is, the section stays as it is in the file.
- **One Cmd+Z puts it back.** While Cmd+F filters the list, a section moves with its hidden rows.
- **The edge scrolling and the redraw rule** are step one's for items.
- **Headings don't drag in a list inside another note (call)** in step two; items do.

### Collapsing a heading (owner)

- **An arrow left of a heading collapses and expands its section,** in the margin as Obsidian's
  own fold arrows are: Lucide's `chevron-down` while open, `chevron-right` while collapsed
  **(call)**. Only a click or tap on the arrow toggles; a tap on the heading still opens its menu
  on the iPhone.
- **It shows on hover, and always on a collapsed heading (owner),** as in Obsidian's notes. The
  iPhone has no hover, so there it always shows. Its accessible name is "Collapse" or "Expand"
  **(call)**.
- **Collapsed, the section's rows hide;** the heading stays. The items before the first heading
  have no heading, so they can't collapse.
- **It isn't remembered (owner).** Every heading is open each time a list opens, as "Show
  archived" is off. While the view is open, a collapsed heading stays collapsed through redraws
  and edits, following its line as a selection does **(call)**. Nothing is written to the file.
- **Adding into a collapsed section expands it (call):** New item from its heading menu, an item
  dropped under the heading, or Cmd+Enter with an item in it selected.
- **A collapsed section drags as any section does.** While Cmd+F filters the list, matches in a
  collapsed section show, and the section is collapsed again when the filter ends **(call)**.
- **Not in a list inside another note (call)** in step two.

### Star (owner: in its list only)

- **"Add star" and "Remove star"** are in the item menu: right-click on the Mac, and the card's ⋯
  button **(call)**.
- **The row shows Lucide's `star`** after the title, in `--color-yellow` **(call)**, wherever rows
  show: a list, the Schedule view and a list inside another note.

## Still later

These go into step one's "Not in step one" list:

- **A Favorites view (owner)** that gathers starred items from every list.
- **A "New list" button on Obsidian's New tab screen (owner, 2026-10-27),** back from "Not wanted
  at all". Obsidian documents no API for that screen: `obsidian.d.ts` 1.14.4 has nothing for it,
  and plugins that add buttons there change Obsidian's own DOM, which this project's rules forbid.
  It waits until Obsidian documents a route. Until then, New list is on the ribbon, in the command
  palette (with any hotkey you give it) and in a folder's menu.
- **A command that inserts a list into a note,** instead of typing the code block.

## Risks to check during the build

1. **Checklist order:** the checkboxes Obsidian renders in a card's notes match the checkbox lines
   the core parser finds, in order, for step one's fixtures plus nested and mixed checklists.
2. **Cmd+F on the view's scope** wins over Obsidian's own Cmd+F while a list has focus, on the Mac
   and on an iPhone with a hardware keyboard.
3. **Renaming a list:** whether Obsidian updates a `[[link]]` inside a `princelists` code block.
   Links in code blocks usually aren't links to Obsidian, so a block may show "not found" after a
   rename until it's edited. Nothing may fix it in the background, so if it happens, it goes to the
   owner as an accepted cost or a change of format.
4. **Live Preview:** a click, a drag or typing inside a rendered block stays in the block and
   doesn't move the cursor into its source.
5. **`<input type="date">`** opens a picker on the Mac and the iPhone, and returns `YYYY-MM-DD`.
6. **Turn into list from an open editor:** the editor's line and its save reach the file, and the
   metadata cache reports the marker, before the note switches to the list view.
7. **The Schedule view on a large vault:** it reads only the lists' files, and stays quick with a
   few hundred lists.

## Order (call)

Smallest first, each feature its own group of plan tasks that can be released alone: Turn into
list, star, the empty-list hint and Cmd+Enter, ticking checklists, Cmd+F, dragging and collapsing
headings, When on rows and in the card, the Schedule view, then lists inside other notes. No API
here is newer than 1.5.7, the current `minAppVersion`.
