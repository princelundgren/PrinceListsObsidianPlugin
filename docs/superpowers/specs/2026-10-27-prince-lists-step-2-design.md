---
status: live
verified: 2026-11-07
governs: [src/**, styles.css, manifest.json]
---

# PrinceLists for Obsidian: step two, ready to move in

Step one made a single list work. Step two adds what the owner needs before moving their todos
into Obsidian for good **(owner, 2026-10-27)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-10-27 unless another date is given; **(call)** means
the designer did, and a builder may revisit it. Everything step one decided still holds, its rules
included: an edit replaces only the lines it concerns, nothing is written in the background, and
only documented Obsidian APIs are used.

**Keys:** Cmd in this design means Obsidian's `Mod` key, which is Ctrl on Windows and Linux.

## At a glance

- **Checklists** in an item's notes can be ticked in its card.
- **Cmd+F** filters the open list, or the Schedule.
- **A list can show inside another note,** such as a daily note, through a `princelists` code
  block. Its items can be ticked, added, deleted and dragged there, without cards.
- **"Turn into list"** adds the marker to the note you're in.
- **An item can have a When,** the day you plan to do it, shown as the day alone. A Schedule
  view gathers every list's items with a When: Today, with anything overdue, then Tomorrow, Next
  7 days and Later.
- **An item can be starred.**
- **An empty list says how to add an item,** and Cmd+Enter adds one.
- **Dragging a heading moves its whole section,** and an arrow beside a heading collapses it.
- **Formatting in a card:** Cmd+B, Cmd+I and Cmd+K, a format bar under the notes, and "Edit in
  Markdown", which opens the list as Markdown at the item.
- **Notes edited one block at a time:** a card's notes and the list note stayed drawn as in a note,
  and only the paragraph, table or list item you clicked showed its Markdown. [Notes in one
  editor](2026-10-29-notes-in-one-editor-design.md) replaced this.
- **Right-click menus:** a heading's menu gains "Edit in Markdown" and collapsing or expanding
  every heading, and the list's background has a menu of its own on desktop.
- **A settings page:** a folder for new lists, how long ticked items stay before they're archived,
  where each "+" that adds an item shows, whether a list's header shows the Schedule button, and a
  button that brings back the Schedule's tab.
- **Not in step two:** a Favorites view, and a New list button on Obsidian's New tab screen (see
  "Still later").

**Done when (call):** step two is released and the owner has moved their lists in from their
current todo app. Step one's own "Done when" doesn't change. The maintainer called
this met on 2026-10-30 **(owner)**.

## What's written in the file

### When (owner)

- **The interface calls it the date (owner, 2026-10-28):** "When" is this design's name for it, and
  no text in the view, a label or the Schedule says "When".
- **Written as Tasks' scheduled date,** ` ⏳ YYYY-MM-DD`, among the title line's trailing Tasks
  fields, so Tasks and its queries read it as scheduled. Tasks also accepts `⌛`; the plugin reads
  both and writes `⏳` **(call)**.
- **In the view it never shows as `⏳`:** a row shows only the day, with no icon **(owner,
  2026-11-05)**: a date reads as one without it, and the icon took room on a phone's row.
- **Setting a When (call)** on an item that has one replaces its date in place. A new one goes at
  the end of the trailing Tasks fields and tags, so after any tags, before a block ID (` ^id`)
  and trailing whitespace if the line has them. Clearing it removes the field and the space before it.
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
- **Removing the star** removes the space, the `⭐` and any U+FE0F after it, and nothing else,
  except on an item with no title whose first field is a tag **(owner, 2026-11-03)**. Starring
  `- [ ] #errand` adds a space before the tag as well, which a tag needs, giving
  `- [ ]  ⭐ #errand`, and removing the star takes that space back. So star then unstar gives back
  the line it started from, as tick then untick does. Starring adds that space even when white
  space is already there, so `- [ ]  #errand` stars to `- [ ]  ⭐  #errand` and comes back too
  **(owner, 2026-11-04)**.

### Checklist lines

- **The format is step one's** ("Checklists"): checkbox lines in an item's notes are its checklist.
- **Ticking one writes `x` in its brackets, and unticking writes a space (call).** Nothing else on
  the line changes, no `✔` and no date: a checklist line is a step of an item, not an item. As for
  items, any character other than a space counts as ticked.

### The marker, added by "Turn into list" (owner: the marker only)

- **With frontmatter** (`getFrontMatterInfo`, at byte 0): `princelists: true` goes in as the last
  line before the closing `---`. The YAML is never re-serialized.
- **Only into frontmatter that is a mapping (call).** If the YAML isn't an object (a list, a
  single value or broken YAML), adding a line would leave it invalid, so the command changes
  nothing and says so. Empty frontmatter, or one holding only comments, counts as a mapping.
- **The YAML is read from the text being edited (call)** with `parseYaml`, as the marker is read,
  not from the metadata cache, which can lag the file.
- **A `princelists:` line already there** with another single-line value, such as `false`, is
  replaced. The key may be quoted or have spaces before its colon. If its value runs over several
  lines, the command changes nothing and says so **(call)**.
- **Without frontmatter:** `---`, `princelists: true` and `---` go before the first line, with the
  file's usual line ending.
- **Nothing else in the note changes.** `- [ ]` lines become items. Plain bullets stay content the
  plugin leaves alone.

## The features

### Ticking checklists

- **In a card's notes and the list note, a checklist's checkboxes work** (step one disables them).
  A click ticks or unticks that line through the same guarded write as other edits, and Cmd+Z
  undoes it.
- **Which line a checkbox ticks:** the notes' editor knows which line drew each box, so a box ticks
  its own line, and one inside a block Obsidian's renderer draws, such as a callout, is disabled
  ([notes in one editor](2026-10-29-notes-in-one-editor-design.md), "Checkboxes"). Step two
  counted rendered boxes against checklist lines instead, which that design replaces.
- **Nested checklist lines** tick the same way.
- **The list note's boxes tick the same way.** Its checkbox lines are always nested, under a
  bullet, since a top-level one is an item.
- **The row shows nothing about a checklist (call).** A progress count wasn't asked for.

### Cmd+F: filter the list or the Schedule (owner: the open view only)

- **Cmd+F, while a list has focus, opens a filter field** at the top of the list, below the list
  note **(call)**. It's registered on the view's own `scope`, as Cmd+Z is, so it applies only
  while the list has focus and isn't a default hotkey. Cmd+F in a Markdown note is untouched.
- **A "Filter list" command (owner, 2026-11-06)** opens the same field, for mobile and for anyone
  who wants another hotkey. It has no default hotkey **(call)**, and its id stays `find-in-list`.
- **A filter icon opens and closes it (owner, 2026-11-06),** on desktop and mobile: a `list-filter`
  view action in a list's header named "Filter list", with its key on desktop as "New item" has,
  shown only on a list. A magnifier was tried first and looked too much like Obsidian's own search.
  A press while the field is open closes it and shows every row, as Escape does. While it's open
  the icon is pressed, in the active icon color on desktop; on mobile Obsidian gives a header's
  icons one color, as its own bookmark icon shows, so the open field shows it there
  (owner, 2026-11-06). The field's row ends with the
  show-archived toggle, which the icon replaced in the header (step one, "Done and archived").
- **The field is Obsidian's own search field (owner, 2026-11-07),** whose clear button shows once
  it holds text and empties it as deleting the text does, keeping focus in it.
- **As you type, items the text doesn't find hide.** The match is fuzzy, with Obsidian's
  `prepareFuzzySearch` (owner, 2026-11-06): the text's letters in order, with gaps between them,
  so "mlk" finds "oat milk". A wrong or swapped letter finds nothing, and neither does another
  word order. It ignores case and folds accents as Obsidian does, so "e" finds "é" (owner,
  2026-11-06). Two letters can match a long note, which the owner accepted.
  - **It searches the title, the notes and the When as the file writes it (owner, 2026-11-06),**
    each on its own, Markdown included. The When matches letter for letter, as part of the day,
    not fuzzily, so `2026-11` finds November's items, where fuzzily it would find `2026-12-01`
    too (owner, 2026-11-06). The words a row shows for its day ("Tomorrow", "Fri") don't match,
    since they change each day and with Obsidian's language.
  - **Spaces around the text are ignored,** and spaces alone filter nothing **(call)**.
  - **The view builds the matcher and passes it to core,** which has no Obsidian imports **(call)**.
  - **The list redraws once typing pauses for 100 ms,** not at every letter, and at once when the
    field is emptied **(call)**.
- **Every heading shows while filtering (owner, 2026-11-07),** whether or not one of its items
  matches, so the list keeps its shape. Headings themselves aren't searched.
- **Content the plugin leaves alone hides while filtering (call),** since it isn't an item and
  can't match.
- **Archived items are searched only while "Show archived items" is on.**
- **"Show starred only" hides every item that isn't starred (owner, 2026-11-06),** in a list and
  in the Schedule. A star toggle in the field's row, before a list's archived toggle, turns it on
  and off, and so does an item of that name in the pane's menu: a list's ⋯ menu, beside "Show
  archived items", and the Schedule's, which in a sidebar opens from a right-click on its tab. It
  filters as typed text does: every heading shows, a Schedule group shows while one of its items
  shows, collapsed ones included, and content the plugin leaves alone hides. With text in the
  field too, an item shows only if it's starred and matches. The toggle is yellow and filled
  while it's on, as a row's star is, and a press on it doesn't take focus from the field
  **(call)**. Its tooltip stays "Show starred only", and it has no key **(call)**. It's on only
  while the field is open, so the lit toggle always shows why items are hidden: the menu item
  opens the field when it's closed, without focusing it **(call)**, and closing the field turns it
  off (owner, 2026-11-06). It isn't remembered (owner, 2026-11-06).
- **Escape in the field ends the filter** and shows every row again, as the filter icon does.
- **The field stays open when focus leaves it (owner, 2026-11-06),** empty or not, until Escape,
  the filter icon, or another note or the list closing ends it. Like "Show archived items", it
  isn't remembered **(call)**.
- **Everything else works while filtering (call):** ticking, cards, dragging and adding. A drop
  goes after the visible row above it, as it does past hidden archived rows. A new item, or an item
  whose card is open, stays shown while its card is open even if it doesn't match.
- **The Schedule filters too (owner, 2026-11-06).** Cmd+F while it has focus, or "Filter list"
  while it's the active view, opens a field under its description, which reads "Find in
  schedule". One command keeps one hotkey for both views. A filter icon at the right of its title,
  "Filter schedule", opens and closes it too, since a sidebar hides a view's header
  **(owner, 2026-11-06)**; its row has no archived toggle, since the Schedule never shows archived
  items. It works as a list's field, and:
  - **The list's name is searched too (owner, 2026-11-06),** besides the title, the notes and
    the When, so typing a list's name shows its dated items.
  - **A group shows while one of its items shows, collapsed ones too (owner, 2026-11-06),** and a
    collapsed group is collapsed again when the filter ends, as a list's sections are.
- **With no match, "No items match" shows (owner, 2026-11-07),** centered across the pane, below
  a list's headings or in the Schedule in place of its groups. It sits in the rows' own flow
  rather than centered in the space left, so nothing above it moves as it comes and goes
  **(call)**. A list with no items keeps its own hint, and a Schedule with no dated items its own
  message.

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
  a checkbox, the rendered title, the star and the When. The list note, the items' notes and
  content the plugin leaves alone don't show **(call)**, and there are no cards.
  - Done items stay gray until archived. Archived items are hidden, with no "Show archived items"
    **(call)**.
- **Ticking** works as in the list view.
- **Titles are edited in place (call).** A click on a row, not on its checkbox, the zone beside it
  or a link, turns its title into a field, so a row with no title can be edited too: Enter or
  leaving saves, Escape cancels. A change to the file from elsewhere while the field is open waits
  for it to close before the block draws it **(call)**; the field saves to its line as that change
  moved it. A line that went writes nothing and shows the list view's message with "Copy text" for
  what was typed, or "This list changed elsewhere. Try again." for a field emptied by hand; a field
  left as it opened shows nothing, since nothing is lost **(call)**. The same message shows when the
  block's link comes to lead to another note, or the list is renamed, while a field is open. Until
  the block draws again, its other rows may stand on lines the change moved, so a tick, a click, a
  right-click or a drag on one only closes the field and redraws: it never acts on the item that is
  now on that line **(call)**.
- **Adding:** a "New item" button below the rows adds an item where "+" puts one with nothing
  selected, as the list's first item, and opens its title field **(call)**. Shift+Enter adds the
  next one. Leaving a new item with an empty title removes it, as in the list view.
- **Deleting (call):** a trash button shows at the end of the title field while it's open, on
  desktop and mobile, since mobile has no long-press menu. On desktop, right-clicking an item
  offers Delete item too. Both show the Undo message, as Delete item does in the list view. The
  trash button deletes without saving what was typed in the field **(call)**, so Undo brings back
  the item as the file had it.
- **Dragging** works within the block, within and between sections: with the mouse on desktop and
  hold-and-move on mobile, with the list view's drop rules. Lifting an item closes an open
  title field and saves it. Until then, a mouse press that can lift another item leaves the
  field open, without its focus, so the rows don't move under the press; the press's click
  closes it as any click does, and a release outside the block, or a drag that ends before
  its lift, closes and saves it **(call)**.
  A hold on an item opens no menu, and a swipe that starts no lift scrolls the note.
  - **The item lands where the drop line showed (owner, 2026-11-02),** even when that save
    removes an empty new item and so moves the lines below it: the drag aims with the rows as
    drawn, and the move follows each drawn row's line to where it is now. A drop under the row
    that save removed goes under the row above it, as if that row had never shown **(call)**. A
    change from elsewhere between the drop and the move writes nothing and shows "This list
    changed elsewhere. Try again.", as a tick does **(call)**. A draw during the drag, such as for
    a change from elsewhere, ends it with nothing written, with the mouse as with a finger
    **(call)**.
- **No edge scrolling in a block (call):** the block sits in the note's scroller, which is
  Obsidian's, and the plugin doesn't reach into Obsidian's own elements. A drop beyond what shows
  needs the list view. For the same reason, a lifted row can shift once, as an open title field
  above it closes, instead of being scrolled back under the pointer.
- **Writes go to the list's file** through the same guarded edits. An open list view of that file
  follows them as a change from outside **(call)**. Cmd+Z doesn't step through edits made in a
  block, not even in a list view whose notes hold the block: each keeps its own history, and a
  block's delete shows an Undo message **(owner, 2026-11-04)**.
- **It follows changes to the list file,** and draws again only when they change its rows. Its
  listeners belong to a `MarkdownRenderChild`, so they go when the block does. The metadata cache
  reports each of the block's own writes, sometimes only after a later one has landed; a late report
  is the block's own write, not a change from outside.
- **In a list's own notes (owner, 2026-11-02):** a block in the list note or an item's notes draws
  its rows with the list view's classes and line attribute, for its own list's lines. The list
  view finds, renumbers and aims drops at only its own rows, and never acts on the block's rows:
  a click, right-click or drag on them is the block's. A click in a block in the list note still
  closes an open card, as any click on the list note does.
  - **The block works there as in a note (owner, 2026-11-03):** a click on a row's box or the zone
    beside it ticks it, a click elsewhere on the row opens its title field, and items drag, with the
    mouse and with hold-and-move. Keys and typing in the block, its title field included, are the
    block's alone, and so are keys after a press on one of its rows: the view's keys, such as
    Cmd+Enter, Cmd+Z and Escape, and its own field undo leave them be. A press elsewhere on the
    block shows its Markdown, as on any drawn block in the notes (the notes design, "What shows
    drawn").
- **A link to no file, or to a note without the marker,** shows a gray line saying so, naming the
  link. So does a block that names the note it's in **(call)**: that note may be open in an editor
  with typing not yet saved. A note from outside the vault can't be linked, so it can't be shown
  this way.

### Turn into list (owner)

- **A "Turn into list" command,** available while the active note is a Markdown note in the vault
  without the marker. The note's file menu (right-click in the file explorer, or a long-press on
  mobile) has it too **(call)**.
- **It writes the marker** as "What's written in the file" says, then opens the note as a list.
  - **The write path (call):** when the note is open in a Markdown editor, the view is saved first
    (`TextFileView.save`), so typing not yet saved isn't lost. The line then goes in with
    `vault.process`. Not through the editor, against Obsidian's guideline to prefer the Editor API
    for the active file: while the editor shows the note's properties, it drops an edit inside the
    frontmatter (observed in 1.14.4), so a `princelists: false` line stayed as it was.
  - The note opens as a list once the metadata cache reports the marker for it, not straight after
    the write. A wait that never sees the marker ends with the next "Turn into list", a failed
    write, or the note's rename or deletion, and otherwise when the plugin unloads: there's no
    timer, as everywhere in the plugin **(call)**.
  - **A CRLF note open in an editor is saved with LF line endings,** as Obsidian's editor saves
    any note (observed in 1.14.4). A note that isn't open keeps CRLF.
- **Only notes in the vault (call).** A note from outside the vault has no parent folder (observed
  in 1.14.4), which is how it's told apart, as step one does for pictures.
- **"Turn into note" undoes it (owner, 2026-10-29),** as a command and in a list's file menu, so
  turning a note into a list isn't a one-way door. It takes out only the marker's line, or the
  frontmatter with it when the marker was all it held, so a note Turn into list gave frontmatter
  gets back its text. Items stay `- [ ]` lines. A tab showing the list switches to Markdown by
  itself; otherwise the note opens as Markdown. Typing not yet saved, in an editor or the list, is
  saved first, and the write goes through `vault.process`, as for Turn into list.
  - A marker that isn't on a line of its own, such as `{princelists: true}`, or whose value runs
    over several lines, is left as it is, with a message saying so **(call)**.

### When and the Schedule view (owner)

- **Setting a When (owner, 2026-10-27):** the card's top right has a calendar icon, between the
  star and the ⋯, so the star comes before the day as on the row **(owner, 2026-11-05)**. Once the
  item has a When, its day takes the icon's place, with no icon, as on the row. Clicking either
  opens the platform's date picker through an `<input type="date">`. Obsidian has no date picker
  API, and the HTML input gives each platform's own picker.
  - **In a view 480 px wide or narrower (owner, 2026-11-05),** such as a phone or a
    sidebar, the star, When and ⋯ always have a line of their own under the title, together at its
    right, where a row shows its day. Beside the title they took about half a phone's line, and
    moved down only on some titles; split, with the day under the title's start, a lone calendar
    looked out of place.
  - **In a wider pane too narrow for the title beside them (call),** they move to a line of their
    own under the title, still on the right, so the title keeps about 8em to show and edit.
  - **The picker's own Clear or Reset removes the When (owner, 2026-10-27).** There is no clear
    button beside the day: it crowded the card's top right, and every platform's picker can
    already clear the day.
- **On a row (call):** a short day at the row's end, with no icon: "Today", "Tomorrow", a
  weekday for the rest of the next seven days, or else the date, in the language set in Obsidian.
  A past day shows its date.
  - **A date in the current year has no year (owner, 2026-11-05),** such as "Nov 12", since the
    year took much of the row; one in another year keeps it, such as "Jan 4, 2027".
- **The Schedule view** is a view of its own, opened with an "Open schedule" command and a ribbon
  icon **(call)**. The icon is Lucide's `calendar-clock`, not `calendar`, which the Daily notes
  core plugin's ribbon button uses **(owner, 2026-10-27)**. It gathers, from every list in the vault, the items with a When
  that are open or done but not yet archived.
- **A list's ⋯ menu also has "Open schedule" (owner, 2026-10-27),** for anyone who keeps the
  ribbon hidden or doesn't know the command.
- **So can a list's header (owner, 2026-11-05):** a `calendar-clock` view action named "Open
  schedule", left of Filter list, which shows once the settings turn it on; it's off by
  default. Like Filter list, it shows only on a list. The ⋯ menu's item stays either way.
- **Its groups (owner, 2026-10-27):** Today, which includes everything overdue, then Tomorrow,
  Next 7 days and Later. An earlier "Next month", 8 to 31 days ahead, read as the calendar month
  and seemed to leave a gap after the week.
  - The ranges **(call)**: Next 7 days is two to seven days ahead, and Later anything after that.
    An empty group is hidden.
  - Within a group, items go by day, then by list name, then by their order in the list **(call)**.
- **Each row shows** a checkbox, the title, the star, the list's name in gray, and the day. The
  list's name is smaller, on a line under the title, so it doesn't read as part of it **(owner,
  2026-10-28)**. The star and the day stay right after the title, however long the list's name,
  and go to the row's right edge in a narrow pane, as in every row ("Where the star and the day
  sit").
  - **Today's items show "Today" too (owner, 2026-10-28),** as in a list. Without it, a row in
    Today with no day read as an item with no date beside the overdue ones that show theirs.
- **The page (owner, 2026-10-27)** has a list's margins and readable line width, and "Schedule" as
  its title in a list's title style. A muted line under it says in a few words what the page shows,
  so it takes one line on a phone, and the empty page says how an item gets a When **(owner,
  2026-11-04)**.
  - **In a pane about as narrow as a sidebar (owner, 2026-11-04),** it has a sidebar's margins and
    the title at heading size, through a container query; the width where that starts, 480 px, is
    a **(call)**.
- **Ticking works in place.** A repeating item (🔁) shows the same message as in its list instead
  of ticking. A tick is worked out on the text the view last read, so a list changed, renamed or
  deleted since then shows "This list changed elsewhere. Try again." and writes nothing, and so
  does a click that opens a list that's gone. Rows can't be dragged: their
  order comes from the days.
- **A day's heading collapses as a list's does (owner, 2026-11-05),** with the same arrow in the
  checkboxes' column, so it doesn't read as an item without its checkbox. As in a list, it isn't
  remembered: every day is open each time the view opens.
- **A click on a row,** away from a link, its checkbox and the zone beside it, opens its list with
  that item's card open **(call)**: in a tab whose list view already shows that list, else in a new
  tab. The card opens only while the item's line still reads as the view showed it, so an edit since
  then opens the list with no card.
- **It's a view in the right sidebar (owner, 2026-11-02),** a tab with its `calendar-clock` icon
  beside core views such as Backlinks and Outline, so it stays beside the list in use. The ribbon
  icon, the command, and a list's menu item and header button open it there with `ensureSideLeaf`,
  or show it where it already is, such as in a main-area tab kept from an earlier version. It's a
  static view (`navigation` false), so a link in a row opens in the main area rather than in its
  place, and the file that was active stays active while it has focus (observed in 1.14.5).
  - **Its tab is added when the user turns the plugin on (owner, 2026-11-04),** in
    `onUserEnable` (`@since` 1.7.2), which Obsidian's docs name as the place to open a plugin's
    view. It's added without being shown, unless a Schedule is open already. It isn't added when
    Obsidian starts: Obsidian keeps the tab in its workspace from one start to the next, and adding
    it at every start brought back a tab the user had closed.
  - **A closed tab comes back from the settings (owner, 2026-11-04):** the Schedule tab's "Add to
    sidebar" button in PrinceLists' settings does what the ribbon icon does.
- **It updates (call)** when it opens, when it gets focus, and when a list changes, through the
  metadata cache's `changed` event and the vault's `rename` and `delete`. Those keep the lists it
  has read current, so focus reads only lists it doesn't hold yet, and it draws again only when
  today or its rows change. Like a list, it runs no timer, so a view left open over midnight moves
  its items when it next gets focus.
- **Lists are found** by the marker in the metadata cache's frontmatter, and read with
  `vault.cachedRead`. Notes outside the vault aren't included.

### An empty list says how to add an item (owner)

- **A list with no items shows a gray hint** centered in the space below the list note, in
  `--text-faint`. It goes as soon as the first item is added and comes back if the last one is
  deleted. A list whose items are all archived and hidden doesn't show it **(call)**.
- **The text:** "Press Cmd+Enter or + to add an item" on macOS, with Ctrl+Enter on Windows and
  Linux, and "Tap + to add an item" on mobile, which usually has no keyboard. Where the settings
  show no "+" on that device, it leaves the "+" out: "Press Cmd+Enter to add an item", and "Press
  Enter in the title to add an item" on mobile **(owner, 2026-11-05)**. Changing either "+"
  setting draws open empty lists again, so the hint follows at once; a list with items only shows
  or hides its buttons.
- **Cmd+Enter adds an item (owner),** the same as "+": below the selected item, or as the list's
  first item when nothing is selected. It's registered on the view's own `scope` as `Mod+Enter`,
  like Cmd+Z, so it works anywhere in a list that has focus, a card's fields included, and isn't
  a default hotkey **(call)**.

### Dragging a heading (owner)

- **Dragging a heading moves its section:** the heading and every line up to the next heading.
  That covers its items with their notes, hidden archived items and content the plugin leaves alone.
- **A section ends at the next heading of any level (call),** as step one's sections do, so
  dragging a `##` doesn't take a `###` below it along.
- **It's started as an item drag is:** with the mouse on desktop, and by holding and then moving
  on mobile, where a tap still opens the heading menu. The drag closes an open card first. A
  heading whose name field is open doesn't drag **(call)**.
- **A section drops only between sections (call):** before another heading, or at the end of the
  list. The drop line shows above the heading it will go before, or under the last row for the
  end. It never drops above the items before the first heading, which would join the moved
  section, and that unnamed section has no heading to drag.
- **Over a row, the section goes before the first heading shown below the gap (call):** the gap is
  under the row in its lower half and above it otherwise, as for an item, and with no heading
  below, it goes to the end.
- **On mobile only the heading lifts (call);** its rows stay in place until the drop redraws
  the list.
- **The file (call):** the section's lines move as they are, and the move goes through step one's
  check (`src/core/edit-check.ts`): if it would change how the rest of the list reads, such as a
  moved setext heading joining the paragraph above it, one empty line goes before it, and if that
  doesn't help, nothing is written and a message says so. The file keeps its line endings and
  final-newline rules. Dropped where it already is, the section stays as it is in the file.
- **One Cmd+Z puts it back.** While Cmd+F filters the list, a section moves with its hidden rows.
- **The edge scrolling and the redraw rule** are step one's for items.
- **Headings don't drag in a list inside another note (call)** in step two; items do.

### Collapsing a heading (owner)

- **An arrow in the checkboxes' column collapses and expands a heading's section (owner,
  2026-11-05),** with the heading's text lined up with the item titles; in the margin it was too
  hard to hit. It is drawn as Obsidian's own fold arrows are (owner, 2026-10-27): its `right-triangle`
  icon in `--collapse-icon-color`, turned to point right and in `--collapse-icon-color-collapsed`
  while collapsed. Only a click or tap on the arrow toggles; a tap on the heading still opens its menu
  on mobile.
- **Its target is as wide as a row's tick zone (call):** the column and the gap after it, reaching
  into the view's margin. It runs from the space above the heading to the heading's bottom.
- **It always shows (owner, 2026-11-05),** so a heading has something in the column where an item
  has its checkbox; shown only on hover, the empty column made a heading read as an item without
  one. It shows no tooltip: its accessible name is
  "Collapse section", with `aria-expanded` saying whether the section is open **(call)**.
- **Collapsed, the section's rows hide;** the heading stays. The items before the first heading
  have no heading, so they can't collapse. The open card's item still shows in a collapsed
  section, so a card never vanishes under its heading **(call)**.
- **It isn't remembered (owner).** Every heading is open each time a list opens, as "Show
  archived items" is off. While the view is open, a collapsed heading stays collapsed through
  redraws and edits, following its line as a selection does **(call)**. Nothing is written to the
  file.
- **Adding into a collapsed section expands it (call):** New item from its heading menu, an item
  dropped under the heading, or Cmd+Enter with an item in it selected.
- **A collapsed section drags as any section does.** While Cmd+F filters the list, matches in a
  collapsed section show, and the section is collapsed again when the filter ends **(call)**.
- **Collapse all headings and Expand all headings (owner, 2026-10-28)** are in a heading's menu,
  on desktop and mobile, and the list's background menu, after a separator. Each shows only while
  it would change something: Collapse all while any heading is open, Expand all while any is
  collapsed. In the heading menu they come before Delete heading, which stays last, after a
  separator of its own **(owner, 2026-10-28)**. They aren't commands **(owner, 2026-10-28)**: a
  command ID can't change once released, so one waits until it's wanted.
- **Not in a list inside another note (call)** in step two.

### Star (owner: in its list only)

- **The card's star button (owner, 2026-10-27)** sits between the When and the ⋯ and adds or
  removes the star: an outline when the item has none, filled in `--color-yellow` when it has one.
  A list's row adds or removes it from its right-click menu too **(owner, 2026-10-29)**, where the
  item menu at first had no star entry **(owner)**: the step one design's "Item actions".
- **The row shows Lucide's `star`** after the title, in `--color-yellow` **(call)**, wherever rows
  show: a list, the Schedule view and a list inside another note.
- **Where the star and the day sit (owner, 2026-11-05):**
  - On the title's first line: the day on its baseline, and the checkbox and the star centered on
    its capital letters.
  - The checkbox and the star are drawn in one box a fifth taller than the title's capital
    letters. The checkbox reaches a little above and below them; the star, which Lucide draws
    inside a margin, runs from the baseline to the capitals' top. Each keeps the room its full size
    takes, so the text doesn't move and a tap anywhere the full-size box was still ticks. An open
    card's star, day and ⋯ are buttons the ⋯'s height, centered on one line; its star, and its
    calendar while it has no day, are drawn as small as the row's star. Where the app's web view
    lacks CSS's `cap` unit (before Chrome 118 and Safari 17.2) they keep their full size.
  - In a view or list block 480 px wide or narrower, such as a sidebar or a phone, the star and
    the day go to the row's right edge, so a title that wraps leaves no gap before them and the
    days line up. In a wider pane they stay after the title, where the right edge can be far away.

### Formatting in a card (owner, 2026-10-27)

A card's title is a plain text field and its notes are the plugin's own editor, so Editing Toolbar
and Obsidian's own formatting commands, which act on the active Markdown editor, don't reach them.
Obsidian documents no way to put its editor in a plugin's view.

- **"Edit in Markdown"** in the item menu opens the list as Markdown beside it, through the same
  path as "Open as Markdown", with the caret at the end of the item's title line and the editor
  focused. There, Editing Toolbar, Obsidian's commands and its mobile toolbar work.
  - Typing still waiting for the save is saved first, so the Markdown shows it.
  - It opens in a split (`getLeaf('split')`). A phone has no splits, and Obsidian opens a new tab
    there (observed on Android).
  - It opens in the view Obsidian's settings give new tabs, editing by default: Obsidian documents
    no way for a plugin to pick the mode.
- **Cmd+B, Cmd+I and Cmd+K** in a card's title and notes make the selection bold, italic or a
  link, as in a note, and Cmd+B or Cmd+I again takes it off **(call)**. The title's are registered
  on the view's own `scope`, as Cmd+Z is, and the notes' are in their editor's keymap; anywhere
  else the key stays Obsidian's.
- **A format bar under the notes** while their editor has focus, in two groups: Bold, Italic,
  Strikethrough and Underline; then Task list, Bullet list, Numbered list, Add link, Add external
  link, Code and Code block, in one group so the bar stays short **(owner, 2026-11-05)**. It has
  no Undo or Redo **(owner, 2026-11-05)**; Cmd+Z and Cmd+Shift+Z still undo and redo. A press
  keeps focus in the notes, so the phone's keyboard stays up, but for Add link, whose search box
  takes it. The list note has it too. It has no Table button until a table can be edited well,
  #213 **(owner, 2026-10-30)**.
  - The buttons take the names and icons of Obsidian's own editor menu, where it has them
    **(owner, 2026-11-04)**, but for Code block's icon: Lucide's `square-code`, a boxed `<>`, so
    it doesn't look like Code's `</>` **(owner, 2026-11-05)**.
  - Its first icon lines up with the notes' text **(owner, 2026-11-05)**.
  - Add link asks for a note or list in Obsidian's search box, then links to it as the vault's link
    settings say, with selected text as the link's text. Add external link wraps the selection in
    `[` and `]()`, as Cmd+K does.
  - On a narrow desktop card, whole groups wrap to a second row, so every button stays in sight,
    with no menu to open **(call)**. On mobile it's one row that scrolls sideways ([notes in one
    editor](2026-10-29-notes-in-one-editor-design.md), "The format bar").
  - The list buttons turn each selected line that isn't blank into an item of that kind, or back
    into a plain line when every one already is one **(call)**. A caret on a blank line gets the
    marker, to type after.
  - A selection that takes in its markers, as a drag does, counts as the text inside them, so
    Bold, Italic or Code again takes them off.
  - Strikethrough wraps the selection in `~~`, as Obsidian writes it. Markdown has no underline,
    so Underline wraps it in HTML's `<u>` and `</u>` **(owner, 2026-10-28)**. Both take their
    marks off again, as Bold does. No key is added for them **(call)**.
  - The buttons can't be reached with Tab, which would leave the notes **(call)**.
- **A table and code in a card's notes are drawn as in a note,** with Obsidian's documented table
  and code variables: Obsidian's own style for them applies only inside its views.

### Editing notes a block at a time (owner, 2026-10-28)

**Replaced (owner, 2026-10-29)** by [notes in one editor](2026-10-29-notes-in-one-editor-design.md)
(#182): a card's notes and the list note are one editor each, drawn as Live Preview draws a note.
The block fields this section described are gone.

### Right-click menus (owner, 2026-10-28)

- **The heading menu gains "Edit in Markdown",** with the caret at the end of the heading's line,
  on desktop and on mobile, and Collapse or Expand all headings ("Collapsing a heading").
- **Right-clicking the list's background on desktop** opens the list menu: New item, New heading,
  Edit in Markdown, Show archived items, Show starred only, Collapse or Expand all headings, and
  Open schedule. The background is anywhere a click lands on no row, heading, field, link or notes
  editor: the list note is its editor, and gets no list menu ([notes in one
  editor](2026-10-29-notes-in-one-editor-design.md), "Keys and touch").
  - New item and New heading go at the end of the section the click is in: under the nearest
    heading above it, or in the part before the first heading **(owner)**. New item goes after the
    section's last item, before any text below it that isn't an item, which an item can't follow
    without joining it **(call)**.
  - Edit in Markdown puts the caret at the end of that section's last line **(call)**.
  - Show archived items, Show starred only and Open schedule do what they do in the pane's ⋯ menu.
  - Mobile has no background menu: the plugin opens no menu on a long-press (step one, "Touch on
    mobile").
- **Right-clicking a picture on desktop** in a card's notes or the list note opens the picture's
  menu, laid out as Obsidian's own image menu: Copy image and Remove image, then Obsidian's link
  menu, then Delete image in red at the bottom. Swap file and Reset size are left out
  **(owner, 2026-10-28)**.
  - Remove image takes out the link only, and Delete image takes out the link and moves the file to
    the trash after Obsidian's own prompt **(owner, 2026-10-28)**. A cancel leaves both.
  - The link goes with one space beside it: the one before it after text, else the one after it,
    so the line's indent stays. A line left empty goes, with one empty line next to it, so one
    still separates the blocks around it; empty notes leave none under the title, and a block
    right under a title keeps the empty line that keeps it apart from the title; the list note
    keeps its empty line before an item or heading **(call)**. Cmd+Z puts it back.
  - Remove and Delete show for every picture the notes' editor draws, which knows each one's link.
    In a block Obsidian's renderer draws, such as a callout, they show only while its drawn
    pictures line up one to one with its picture links ([notes in one
    editor](2026-10-29-notes-in-one-editor-design.md), "Pictures"). Either shows only while the
    removal is safe; a picture in an embedded note belongs to that note and gets no picture menu
    **(call)**.
  - Delete image checks the removal before Obsidian's prompt, so it doesn't trash a file whose
    link can't go. Either refuses once the list changed elsewhere after the menu opened, so a change
    while the prompt is open can still leave the link **(call)**.
  - Copy image copies PNG, the one picture format the clipboard takes, so any other is drawn into a
    PNG first **(call)**.

### Settings (owner, 2026-11-04)

PrinceLists' page in Obsidian's settings, built with `getSettingDefinitions` (`@since` 1.13.0, the
docs' way from 1.13 on). Each setting has a reason someone would change it, and its default keeps
the plugin as it was before the page existed, except the two "+" buttons', below.

- **Folder for new lists:** Obsidian's `folder` control, which suggests the vault's folders. It sets
  where "Create new list" and the ribbon icon put a list, as step one's "Where a new list goes"
  says. Any path is kept, and a folder that isn't there is made with the next list (call): the
  field then agrees with what a new list does when a chosen folder has gone. Obsidian saves the
  value to the plugin's `data.json` when the user changes it, so it's never written in the
  background, and `onExternalSettingsChange` reads it again when Sync brings a change.
- **Hide ticked items after (owner, 2026-11-04):** a `dropdown` control with at once, 1 hour,
  12 hours, 1 day (the default), 2 days and 1 week, saved as the hours in a string, such as
  `"24"`. A value in `data.json` that is none of them is read as 1 day when the settings load, as
  Obsidian's docs ask a plugin to check stored values when it reads them; nothing is written back.
  - **A change redraws** the list views, the list blocks and the Schedule. The settings tab's
    `setControlValue`, and `onExternalSettingsChange` when Sync changes the delay, tell them
    through an `Events` object the plugin hands each view, which each one listens to with
    `registerEvent`. A list block with an open field or a drag draws it when the field closes or
    the drag ends.
  - **It writes nothing to any list,** since archived is worked out, never written down.
- **Floating add button and Header add button (owner, 2026-11-05):** a `dropdown` control each,
  with desktop and mobile, desktop only, mobile only and off, saved as `"both"`, `"desktop"`,
  `"mobile"` and `"off"`. Mobile is `Platform.isMobile`, a tablet included, as for keys' names.
  The floating "+" shows everywhere by default and the header's "+" nowhere, so desktop gains the
  floating one and both lose the header's after the update: the owner chose that over the rule
  that opens this section. A stored value that is none of them is read as the default, as the
  delay's is. Open lists show or hide the buttons at once, and again when Sync brings a change.
  Cmd+Enter adds an item whatever the two say.
- **Show Schedule button (owner, 2026-11-05):** a toggle that shows or hides the header's "Open
  schedule" button. It's off by default, so the header stays short and the ribbon icon and the
  command open the Schedule. Open lists show or hide the button at once, and again when Sync brings
  a change.
- **Schedule tab:** an "Add to sidebar" button that opens the Schedule as the ribbon icon does, so a
  closed tab is easy to get back. A button saves nothing.

### No onboarding (owner, 2026-11-04)

- **Turning PrinceLists on shows nothing of its own** beyond the Schedule's sidebar tab, which is
  added without being shown (see "When and the Schedule view"): no window, onboarding tab or
  example note. The README's Quick start shows how to begin.
- **Why:** steps drawn as list rows read as half a PrinceLists list and half another app's
  checklist. Onboarding worth having needs pictures, and a release ships only `main.js`,
  `manifest.json` and `styles.css`: bundled, they would make `main.js` several times bigger, and
  loading them would be a network request, which the privacy rule allows only after an issue
  agrees to it. An example note leaves a file the user has to delete.

## Still later

These go into step one's "Not in step one" list:

- **A Favorites view (owner)** that gathers starred items from every list.
- **A "New list" button on Obsidian's New tab screen (owner, 2026-10-27),** back from "Not wanted
  at all". Obsidian documents no API for that screen: `obsidian.d.ts` 1.14.4 has nothing for it,
  and plugins that add buttons there change Obsidian's own DOM, which this project's rules forbid.
  It waits until Obsidian documents a route. Until then, a list is created from the ribbon, the
  command palette (with any hotkey you give it) or a folder's menu.
- **A command that inserts a list into a note,** instead of typing the code block.

## Risks to check during the build

1. **Checklist order:** the checkboxes Obsidian renders in a card's notes match the checkbox lines
   the core parser finds, in order, for step one's fixtures plus nested and mixed checklists. The
   notes' editor ticks a box's own line, so this no longer applies.
2. **Cmd+F on the view's scope** wins over Obsidian's own Cmd+F while a list has focus, on desktop
   and on mobile with a hardware keyboard.
3. **Renaming a list:** whether Obsidian updates a `[[link]]` inside a `princelists` code block.
   Links in code blocks usually aren't links to Obsidian, so a block may show "not found" after a
   rename until it's edited. Nothing may fix it in the background, so if it happens, it goes to the
   owner as an accepted cost or a change of format. Found: in Obsidian 1.14 a rename leaves the
   block's link as it was, and the block shows that the link doesn't lead to a note. Accepted
   **(owner, 2026-10-28):** the format stays, and the new name is typed into the block. It fails
   where it can be seen, it only follows renaming a list another note shows, and a fix would be a
   background write.
4. **Live Preview:** a click, a drag or typing inside a rendered block stays in the block and
   doesn't move the cursor into its source.
5. **`<input type="date">`** opens a picker on desktop and mobile, and returns `YYYY-MM-DD`.
6. **Turn into list from an open editor:** the save and the line reach the file, and the metadata
   cache reports the marker, before the note switches to the list view. Found: an editor edit inside
   the frontmatter is dropped while the properties show, so the line goes in through the vault.
7. **The Schedule view on a large vault:** it reads only the lists' files, and stays quick with a
   few hundred lists.
8. **A heading on mobile:** a hold-and-move drags it, and a tap still opens the heading menu,
   with neither firing the other.
9. **Moving a section, byte for byte:** a setext heading moved under a paragraph gets its empty
   line or is refused, never joining the paragraph. A section moved off the end of a file without
   a final newline takes the file's usual line ending, and the new last line takes the old last
   line's, as AGENTS.md requires. Moving it back gives the original bytes when no empty line was
   added.
10. **Editing a list item alone:** the nth drawn list item of a block is the nth item CommonMark
    finds outside quotes and callouts, for nested, numbered and mixed lists, as risk 1 checks. Gone
    with the block fields.
11. **`<u>`** draws underlined in a card's notes.
12. **Lucide's `strikethrough` and `underline` icons** exist in Obsidian 1.5.7.

## Order (call)

Smallest first, each feature its own group of plan tasks that can be released alone: Turn into
list, star, the empty-list hint and Cmd+Enter, ticking checklists, Cmd+F, dragging and collapsing
headings, When on rows and in the card, the Schedule view, then lists inside other notes. Then,
before 0.4.0 **(owner, 2026-10-28)**: the two new format buttons, the right-click menus, and
editing notes a block at a time.
