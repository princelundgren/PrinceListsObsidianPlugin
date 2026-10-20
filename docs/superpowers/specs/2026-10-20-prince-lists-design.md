---
status: building
governs: [src/**, styles.css, manifest.json]
---

# PrinceLists for Obsidian: step one, a single list

An Obsidian plugin that shows a plain Markdown note as a todo list you can tick, drag and open
into cards. Step one covers creating a list and everything inside one list. Views that span lists (Today, Upcoming and the rest) come
later.

**How decisions are marked:**

- **(owner)** means the owner decided it in the design conversation on 2026-10-20. Changing it is
  the owner's call.
- **(call)** means the designer decided it. The designer is the AI assistant that wrote this
  design with the owner. A builder may revisit it.
- **Scope:** a tag on a heading covers its section, and a tag in a bold label, such as
  **Done when (owner):**, covers what follows the label. A tag in a bullet's bold lead covers that
  bullet and the bullets under it, and a tag after a sentence covers only that sentence. The
  narrower tag wins: a sentence's tag overrides its bullet's, and a bullet's overrides the
  heading's, the label's or an enclosing bullet's.

Three independent reviewers checked this document on 2026-10-20: Obsidian platform, file format
and data safety, and owner's advocate. Their findings are folded in.

## At a glance

- **A list is an ordinary note** with `princelists: true` at the top. Open it and it shows as a
  clean todo list. Turn the plugin off and it is still a readable note.
- **What's inside:** headings make sections and checkboxes are items. Anything indented under an
  item is that item's notes, and notes can hold any Markdown, pictures included.
- **Ticking an item** grays it out where it is. Twenty-four hours later it is **archived** and
  hidden, and "Show archived" brings archived items back.
- **Lists open in the list view.** The plain note may flash for a moment first. That gets tested
  first, and the owner decides whether it is acceptable.
- **A note from outside the vault** with the marker, opened in Obsidian on the Mac, is a list too.
- **On the Mac,** you right-click for actions and drag with the mouse.
- **On the iPhone,** you tap to open an item and hold-and-move to drag it. Item actions sit in a
  ⋯ button on the open card, and tapping a heading opens the heading menu.
- **It is built in two parts.** 1a is the Mac plus the iPhone basics. 1b adds dragging on the
  iPhone, pasting pictures into a card, and Cmd+Z undo.
- **Step one is done** when one real list has lived only in Obsidian for two weeks.
- **Dates use the Tasks plugin's format,** so other tools can still read your lists. Ticking writes
  `✔` with the date and time. Tasks sees the item as done, but not when.
- **No Obsidian plugin can do these:** reminders while Obsidian is closed, home-screen widgets, or
  quick entry from anywhere on the system. Obsidian's own iPhone widgets and Quick Capture may
  cover part of the last two, and get tried during the two weeks.
- **Everything from "Technical approach" down is for the builder.** The owner doesn't need to
  review it.

## Why

- **A separate todo app keeps lists apart from notes.** When the notes live in Obsidian, todos in
  another app sit in a second place, and that app often costs money too.
- **A whole standalone app is costly to maintain.** It has to bring its own sync, storage, phone
  app and the rest before any todo feature, and then keep all of it working.
- **The Tasks plugin doesn't cover it.** Its query views can tick and edit tasks, and since 8.4.0
  a columns view can drag a task to another column to change a field such as its due date. But a
  query view can't be reordered by hand: its results follow `sort by` instructions, and the
  closest to a hand-made order is sorting by path and line number, which shows the notes' order.
  Todos gathered for Tasks in one note pile up where they are hard to find.
- **What this plugin does instead:** it keeps each list as an ordinary note and draws it as a
  todo list. Obsidian already provides sync, search, backup, attachments and the phone app, so the
  plugin rebuilds none of them.

## Goals (step one)

1. **Create a list** the same ways you create a note.
2. **Open a list and see it as a todo list:**
   - a title with a note under it
   - headings
   - items that open into a card with notes
   - adding, editing, ticking, moving and deleting items
   - done items that disappear after a day
3. **Run on the Mac and the iPhone (owner).** iPad and Android aren't targets.

**Two parts (owner):**

- **1a:**
  - Everything on the Mac: the view, ticking, adding, editing, right-click actions, mouse
    dragging, and creating lists.
  - The iPhone basics: open, tick, add, edit, the card's ⋯ actions and the heading menu.
  - Pictures already show in 1a.
- **1b:**
  - Dragging on the iPhone.
  - Pasting or dropping pictures into a card.
  - The Cmd+Z undo history.

**Done when (owner):** one real list, moved in from another todo app, has lived only in Obsidian
for two weeks, on the Mac and the iPhone, without going back to the other app for it. The two
weeks may start once 1a is in use, but step one isn't done until 1b has shipped too **(call)**.
This finish line is what keeps step one from growing into a standalone app.

## Anti-goals: failures even if it works

- **A standalone app:** a large codebase with many dependencies that becomes a second job. Keep
  the plugin small, and let Obsidian do what it already does.
- **Lock-in.** A list stays a readable, editable note without the plugin, and its dates stay
  readable by the Tasks plugin.
- **Workarounds on Obsidian internals (owner).** Use documented Obsidian APIs only.
  That rules out monkey-patching, reaching into Obsidian's own DOM, and private calls through
  `(app as any)`.
- **Losing or mangling anything the user wrote.** Content the plugin doesn't understand survives
  byte for byte.
- **Background writes.** The plugin writes a file only in response to a user action: in the view,
  or a command, ribbon icon or menu item such as New list. Nothing is written on a timer, and
  nothing is written just because a list was opened or closed.

## Not in step one

These are wanted later, roughly in this order. The file format already leaves room for them.

- **Views across lists:** a sidebar with views such as Inbox, Today, Upcoming and Done, grouped
  by area. An area is a list's folder.
- **Dates and tags:** setting dates on items (a scheduled day and a deadline), plus tags and tag
  filters.
- **Smaller item features:**
  - checklists inside an item's notes that can be ticked
  - repeating items, a trash, IDs on single items, and sorting modes
  - dragging a heading to move its whole section
- **Quick capture from outside Obsidian.** A plugin can't hear a global hotkey. The documented
  route is an `obsidian://` handler (`registerObsidianProtocolHandler`) that Raycast, Shortcuts
  or an iPhone Shortcut can call.
- **A command for the Obsidian CLI (owner, 2026-10-20).** `Plugin.registerCliHandler` (since
  1.12.2) adds a command to Obsidian's command-line tool, for example to add an item to a list
  from a script.
  - The CLI needs the Obsidian app running (Obsidian Help, "Obsidian CLI").
  - Whether it does anything on the iPhone is unverified.
  - Using it means raising `minAppVersion` to at least 1.12.2.
- **Importing from other todo apps.** Another app's lists could come in through its export or an
  integration; whether headings and notes survive is unverified.
- **Moving old archived items** into an archive note.
- **A "turn this note into a list" command.**
- **Showing lists inside other notes.** A list, or later Today, could appear inside another note
  such as a daily note, using `registerMarkdownCodeBlockProcessor`.
- **Tidier display in plain Markdown.** Making `✔` and dates look tidy when a list is opened as
  plain Markdown or embedded, using `registerMarkdownPostProcessor` for the reading view or
  `registerEditorExtension` for the editor.
- **A sidebar of all lists built on Bases.** A Base filtered on `princelists: true` already lists
  them all, and `registerBasesView` (since 1.10.0) lets a plugin add its own Bases view type.
- **Page previews of links in a card (owner, 2026-10-20).** A preview on hover needs the
  `hover-link` event. `obsidian.d.ts` names it only in the docs of `registerHoverLinkSource` and
  `HoverLinkSource`, with no payload type, so previews wait until Obsidian documents the payload.
  Links in a card still open, and on the Mac they still get Obsidian's link menu.

**Not possible through the official API.** These limits matter for replacing a standalone todo app:

- **Reminders.** The only notification the API offers is the in-app `Notice`, and plugin code runs
  only while Obsidian is open. Nothing can fire an alert at a set time while Obsidian is closed,
  least of all on the phone.
  - Reminders are out of scope.
  - Hooking into a calendar is a possible later direction (v2). Nobody has investigated it yet.
- **Home-screen widgets and system-wide quick entry.** The API has nothing for either.
  - **Obsidian's app now has some of this itself,** as app features, not plugin APIs. They're on
    the iPhone (obsidian.md/changelog):
    - Since 1.11: Home Screen widgets that create a note, view a note or open the daily note (iOS
      18 or later), Lock Screen and Control Center widgets, and Capture shortcuts that add text to
      the start or end of a note without opening the app. The View Note widget renders
      checklists with checkmarks ("Obsidian 1.11 Mobile (Public)").
    - Quick Capture on iOS 26 since 1.14: from the Lock Screen, Control Center, Home Screen
      widgets or Shortcuts, into a new note, today's daily note, a bookmarked note or any chosen
      note, with optional templates ("Obsidian 1.14 Mobile (Public)").
  - Whether they work well with a list note is unverified: how a list looks in the View Note
    widget, whether a capture lands as a correctly formatted `- [ ]` item in the right place, and
    whether text added to the start of a note goes above the frontmatter, where it would stop the
    note being a list.
  - The owner tries them during the two-week trial **(owner, 2026-10-20)**.

**Not wanted at all:**

- **A "New list" button on Obsidian's New tab screen.** Obsidian gives plugins no API for that
  screen, and the owner chose official routes only.
- **Lists shared across vaults.** The plugin builds nothing to share a list between vaults.
  - **A note from outside the vault is allowed in any vault (owner, 2026-10-20).** Opened from two
    vaults' windows, it works as a list in each. Nothing is built for this.
- **A long-press menu on item rows on the iPhone.** The owner chose: holding only ever drags.

## Constraints

- **Obsidian plugin API.** Every API named here was checked in `obsidian.d.ts` from
  `obsidianmd/obsidian-api` 1.14.4 on 2026-10-20. See "Verified facts" at the end.
  - Some behavior noted below isn't documented. It was seen in Obsidian 1.14.4 and is marked
    **observed**: pin it with a spike before relying on it.
- **Mobile.** Node.js and Electron APIs aren't available on mobile, and a plugin that calls them
  crashes there (Obsidian's mobile-development docs). `manifest.json` has `isDesktopOnly: false`.
- **Vaults (owner).** The plugin is installed per vault, and it sees only that vault's lists.
  - The exception is a note from outside the vault that Obsidian opens in that vault's window (see
    "What a list is").
  - It must work alongside the Tasks and Kanban plugins in the same vault.
- **Sync.** Obsidian Sync can carry a vault between the Mac and the iPhone, and agents may also
  edit notes in a vault. So a list file can change while it is open in the view.
- **Open source (owner, 2026-10-20).** `princelundgren/PrinceListsObsidianPlugin` is open source
  under the MIT license.
  - It goes to Obsidian's community directory after the first release.
  - An agent will give every new issue and pull request a first pass. That automation has a
    separate design, not yet written. The owner always merges and makes releases.
- **Privacy (owner, 2026-10-20).** No telemetry of any kind. The plugin makes no network requests
  unless one is agreed on in an issue first, and any network use is disclosed in the README, as
  Obsidian's developer policies require.

## Words used here

- **List file:** the `.md` note that is a list.
- **List note:** the text under the list's title.
- **Item:** a checkbox line together with its item notes.
- **Item notes:** the indented text under an item.
- **Section:** a heading and the items under it.
- **Tick:** mark an item done with its checkbox. The project says "tick" on purpose
  **(owner, 2026-10-20)**.
- **Done:** ticked.
- **Archived:** done and hidden by the archived rule (see the table under Completion). "Show
  archived" shows it again.

## What a list is

- **One note is one list (owner).** The file name is the list's name.
- **The marker is the frontmatter property `princelists: true` (owner).** It matches the plugin's
  name and ID.
  - Only the YAML boolean `true` counts. `"true"` written as a string, or `false`, doesn't
    **(call)**.
  - A note without the marker is an ordinary note and opens normally.
  - The list's other frontmatter properties are kept as they are, and the plugin never rewrites
    the YAML.
- **A list can live in any folder.** The folder is its area, so `Areas/Shopping/Wishlist.md`
  belongs to "Shopping" **(owner)**. Nothing about areas is written into the file.
- **A note from outside the vault is a list too (owner, 2026-10-20).** Since Obsidian 1.14, the
  desktop app can open a Markdown file that isn't in the vault, in the current vault's window.
  Such a note with `princelists: true` behaves like any list note.
  - Obsidian's 1.14 changelog lists this for desktop, and opening such a file needs Obsidian's
    latest installer. Whether the iPhone app can open one is unverified, so the plan checks it on
    the Mac only.
  - Whether the plugin can do everything with such a note that it does with a vault note is
    unverified. Each part is checked during the build. A part that fails is recorded with the
    fallback that "Notes outside the vault" in the implementation notes proposes, and the owner
    decides at the checkpoint of the task where it fails.

## File format

```markdown
---
princelists: true
---
Stuff for the new apartment. Check second-hand first.

- [ ] item before any heading

## Kitchen
- [ ] cutting board
- [ ] freezer storage boxes ⏳ 2026-10-21 📅 2026-10-30

	Buy 6:
	- one for the freezer
	- five for the pantry

	https://example.com/storage-box
	![[storage-box.jpg]]
- [x] glass jars 1 l ✔ 2026-10-20 23:55

## Living room
- [ ] balcony chair
```

### The list note (owner)

The list note is everything between the frontmatter and the first section or item. It can hold any
Markdown, pictures included, with three exceptions. Each would start a section or an item at the
top level:

- a heading
- a checkbox line
- a `---` or `===` line directly under text, which turns the text above it into a heading

If you type one of these, it becomes a section or an item when it is saved. The list-note editor
says so before it saves **(call)**.

The editor also warns when the list note opens a fenced code block, a comment (`%%`) or a math
block (`$$`) without closing it, because an unclosed block hides every item below it **(owner,
2026-10-20)**.

When the list note isn't empty and an item or heading follows it directly, saving the note writes
one blank line between them **(owner, 2026-10-20)**. Without it, a list note that ends in an HTML
block such as `<div>x</div>` would swallow the first item: CommonMark continues that kind of block
until a blank line.

### Sections

- **A heading that isn't inside an item starts a section (owner).**
- **Any heading level counts (call).** The plugin writes `##`. It never writes an `#` title,
  because the file name is the title.
- **Items before the first heading are allowed.** They form an unnamed section at the top.

### Items

- **An item is a top-level task line (call).** It is a `-`, `*` or `+` bullet, or a numbered
  marker such as `1.`, followed by `[c]`, where c is any single character. Obsidian and Tasks
  accept the same forms.
- **`[ ]` is open, and any other character counts as done (call).** This is Obsidian's own rule.
  - The plugin keeps the marker and the character exactly as written.
  - Ticking writes `x`, and unticking writes a space.
- **The item's first line is its title.**
- **Repeating items (🔁) can't be ticked in step one (call).** The plugin shows them, but ticking
  one shows a message instead. Ticking it without creating the next occurrence would quietly end
  the repeat.

### Item notes (owner)

- **Notes are everything CommonMark puts inside the item:**
  - lines indented to at least the item's content column
  - blank lines between such lines
  - lazy continuation lines

  An item's block ends before any blank lines that trail it.
- **There is always a blank line between the title and the notes (call, forced by data safety).**
  - Without it, a `---` line in the notes turns the title into a heading. This was reproduced
    with the CommonMark reference parser.
  - Without it, notes that start like code merge into the title.
  - The cost: once any item has notes, the whole list it belongs to (usually its section)
    renders spaced out in reading view, because CommonMark makes it a loose list.
- **Indentation:** the plugin keeps whatever indent the item's notes already use, when it reaches
  the item's content column. Otherwise, as for new notes, it uses one tab, which is Obsidian's
  default, or spaces up to the item's content column when that is wider.
  - A tab reaches column 4. With `100. [ ] x` the content column is 5, so a tab-indented note
    there turns into a code block.
  - A lazy line, indented less than the content column, still belongs to the item. Written back
    after the blank line with its own indent, it would leave the item.
  - Blank lines are written empty.
- **Notes can hold any Markdown, with nothing escaped:** bullet points, headings, links, pictures,
  callouts, code, `---` lines and `$$` math.
  - All of these were tested with the CommonMark reference parser (`commonmark` 0.31.2,
    2026-10-20). Obsidian's help says it supports CommonMark.
  - Each case stayed inside its item, with tabs, 2 spaces, 4 spaces or a mix.
- **The one way to break it is a hand edit of the raw file:** an unindented line after a blank
  line falls out of the item.

### Content the plugin leaves alone

- **Some top-level blocks are never items (call),** even when they contain checkbox lines:
  - fenced code blocks
  - HTML blocks
  - `%%` comments
  - `$$` math
- **Other content is kept byte for byte where it is:** paragraphs between items, bullets without
  a checkbox, and tables.
  - How the view shows this content is the builder's choice.
  - It is never lost and never silently reordered.

### Checklists (call; the format is reserved now)

- Checkbox lines indented in an item's notes are that item's checklist.
- In step one they render as disabled checkboxes. Ticking them comes later.

### Dates (owner: the Tasks emoji format)

- **Reserved now, used later:**
  - ⏳ scheduled, the day you plan to do it
  - 📅 due, a deadline
  - 🛫 start
  - 🔁 repeat
- **Written the Tasks way:** at the end of the title line, as `YYYY-MM-DD`.
- **Step one sets none of them.** It keeps any that are already there and never breaks them.

### Completion (owner)

- **Ticking an item writes `- [x]`** plus our own field, `✔ YYYY-MM-DD HH:mm`, in local time on a
  24-hour clock.
- **One field, not two.** The owner wanted the date and time together.
- **Why not Tasks' ✅:** its field takes only a date. The pattern `✅\uFE0F? *(\d{4}-\d{2}-\d{2})$`
  in Tasks' `DefaultTaskSerializer.ts` accepts nothing else.
- **What this costs with Tasks:**
  - Tasks sees the item as done, because of the `[x]`, but not when.
  - Tasks shows the `✔ …` text as part of the item's description.
- **`✔` goes where Tasks stops reading the line,** so Tasks still reads the dates. "Where `✔` goes"
  in the implementation notes has the exact rule.
- **Unticking** turns `[x]` back into `[ ]` and removes `✔ …` and any `✅ …`. Tasks does the same
  when it unticks an item.

**When an item is archived (call):**

| What's on the line | Counts as done at | So it's hidden |
|---|---|---|
| `✔ date time` | that date and time | 24 hours later |
| `✔ date` only, or `✅ date` | the end of that day | from the end of the next day |
| `[x]` with no time | long ago | at once |
| a time that can't be read | long ago | at once |
| a time more than 24 hours in the future | long ago | at once |

- **Several marks on one line (call),** for example after a Sync merge: the earliest mark whose
  time can be read and is no more than 24 hours ahead counts. When there is none, the line counts
  as done long ago. The plugin collapses them the next time it edits that line, keeping the mark
  with the earliest time that can be read, or the first one when none can be read.
- **The plugin never adds a `✔` to a line it didn't tick.** That would be a write the user didn't
  make in the view.
- **A leftover `✔` on an open line** is ignored. It is removed the next time that line is edited.

### Editing never rebuilds the file (call; this fixes a data-safety issue found in review)

- **The plugin holds the file's own text** and knows which lines each part occupies. It never
  rebuilds the file from its own picture of the list.
- **An edit replaces only the whole lines it concerns.** It keeps the file's line endings (LF or
  CRLF) and whether the file ends with a newline, and it applies no Unicode normalization.
- **Why:** this kind of view saves when it closes. If the text it hands back differed from the
  file in any way the user didn't cause, closing a list would write to the file, which is a
  background write.
- **A drag moves an item's whole block.** Only items change order: the blank lines between
  items, and content the plugin leaves alone, stay where they were **(call)**.

## The list view

### Opening a list

- **A note with the marker opens in the list view (call).** The plugin watches for a note being
  opened and switches that pane to the list view. It does this with documented APIs only.
- **Not the Kanban way:** Kanban, the best-known plugin with its own view for notes, monkey-patches
  Obsidian's internals for this, which is off the table.
- **The cost is a possible flash.** The normal editor may show for a moment before the switch. The
  first build task is a spike to see how that looks. If it is bad, the owner decides, and the
  plugin doesn't fall back to patching.
- **"Open as Markdown" and "Open as list"** are in the pane's ⋯ menu and are also commands.
  Choosing Markdown holds for that pane until it is switched back or Obsidian restarts.
- **On restart,** Obsidian restores a list pane as the list view.
- **If the marker is removed** while the list is open, the pane switches to Markdown.

### Layout (owner)

- **The title** is at the top, with the list note under it in gray. Step one has no icon beside
  the title **(call)**.
- **Headings** are bold, with a thin rule below.
- **Items** show a checkbox and a title, one per line.
- **Clicking an item** opens it into a raised card that shows the title and the rendered notes.
  - Notes use Obsidian's own Markdown rendering, so pictures, links and embeds look the way they
    do in any note.
  - Links in a card can be clicked.
  - On the Mac, right-clicking an internal link in a card shows Obsidian's own link menu
    **(owner, 2026-10-20)**. The item menu doesn't open as well **(call)**.
  - On the iPhone there is no right-click. A tap opens the link, and there is no link menu,
    because the plugin opens no menu on a long-press **(call)**.

### Ticking

- **The checkbox only ticks and unticks (call).** It never opens the card. The open card shows the
  same checkbox.
- **A done item stays where it is,** with the box ticked and the text gray **(owner)**. There's no
  strikethrough **(call)**.

### Editing

- **Item titles (call):** edit them in the open card. Everything after the title is hidden while
  you edit: Tasks fields, tags, block ID and `✔`. It is put back as it was, except that doubled
  `✔` marks collapse to the earliest and a leftover `✔` on an open line is dropped (see
  Completion).
- **The list title (call):** editing it renames the file when you press Enter or leave the field,
  not on every keystroke. The rename uses `fileManager.renameFile`, which updates links according
  to the user's link settings.
- **The list note and item notes (call):**
  - Both show as rendered Markdown. Clicking into one switches to a plain-text editor of the raw
    Markdown, without the item's indent.
  - Leaving the editor renders the text again, and saving puts the indent back.
- **Pictures (owner):**
  - Pictures show from 1a on.
  - Pasting or dropping a picture into a card comes in 1b. In 1a you add a picture through "Open
    as Markdown".
  - In 1b a pasted picture is saved with `fileManager.getAvailablePathForAttachment` and
    `vault.createBinary`, following the vault's attachment settings, and inserted as `![[name]]`.

### Selecting and adding

- **Selecting (call):** clicking an item, anywhere except its checkbox, opens its card and selects
  it. Clicking empty space closes the card and clears the selection.
- **The floating "+" button (owner)** sits at the bottom right of the list pane. It stays put while
  the list scrolls, on the Mac and the iPhone. Its accessible name is "New item" **(call)**.
- **Where a new item goes (call):** directly below the selected item. When nothing is selected, it
  becomes the first item of the list, before the first heading.
  - The new item opens with the cursor in its title.
  - Enter in a title adds another item below it, and Escape closes the card.
  - A new item is removed again if you close its card while its title is still empty and it has
    no notes **(call)**. Closing means Escape, a click elsewhere, "+", Enter or starting a drag.
    Closing the list, switching files or a change from outside never removes an item, and an item
    that existed before the card opened is never removed this way.
- **An empty new list (call)** shows a gray "Notes" placeholder under the title. Pressing Enter in
  the title starts the first item.
- **Hidden archived items don't count for positions (call):**
  - New items, drops and new headings go directly after the visible row above them, before any
    hidden rows that follow it.
  - The exception is a heading added after a whole section: it goes after that section's hidden
    rows, so they stay in their section.
  - A drag never moves a hidden row.

### Item actions (owner)

- **On the Mac, right-click an item** for New item below, New heading below and Delete
  **(call)**. Delete removes the item and its notes.
- **Right-click a heading (call)** for the heading menu: New item, New heading below, Rename
  heading and Delete heading.
  - New item adds one as the first item under the heading.
  - **Rename heading (owner, 2026-10-20)** edits the heading text in place. It keeps the
    heading's level, pressing Enter or leaving the field saves, Escape cancels, and an empty name
    keeps the old one **(call)**. A name that wouldn't come back as this heading, at its level and
    with exactly that text, isn't written, and a message says so **(call)**: for example one
    starting with `- [ ]` under a `===` underline, or one ending in ` #`.
  - Deleting a heading keeps its items, which join the section above. That's safer than losing
    them.
- **On both the Mac and the iPhone,** the open card has a ⋯ button with the same item actions. On
  the iPhone this is the only way to reach them **(owner)**. The button's accessible name is "Item
  actions" **(call)**.
- **On the iPhone, tapping a heading opens the heading menu:** New item, New heading below, Rename
  heading and Delete heading **(owner, 2026-10-20)**. It's a tap, not a long-press, so there is
  still no long-press menu.
- **New heading below (owner, 2026-10-20)** adds an empty heading at that point and opens the
  same field as Rename heading, with the cursor in it. Escape, or an empty name, removes the
  heading again.
- **A new heading inserted below an item takes the items after it (call).** This is the same as
  typing that heading into the raw file at that point.
- **Undoing a delete (call):** after a delete, a message with an **Undo** button shows for a few
  seconds. Obsidian's File recovery core plugin, when enabled, is the backstop.
- **Delete and Delete heading show in red (owner, 2026-10-20)** in every menu that has them,
  through `MenuItem.setWarning(true)`. The red comes from the `is-warning` class, so with Settings →
  Appearance → Native menus on, the Mac's right-click menus may not show it (obsidian.md/help,
  Settings: native menus "will not be affected by your theme").

### Dragging (owner)

- **Mac (1a):** drag items with the mouse, within and between sections. An item's notes move with
  it.
  - A drag closes any open card first, the way a click elsewhere does **(call)**. An empty new
    item is removed then, and if it was the row being dragged, the drag ends. The cost: after a
    drag, a click reopens the card.
- **iPhone (1b, owner):**
  - Hold an item and then move to drag it.
  - Holding an item row never opens a menu.
  - A swipe without a hold scrolls the list.

### Done and archived (owner)

- **The delay is 24 hours (owner).** The owner said exactly 24 hours. It is fixed, with no setting
  and no settings screen in step one **(call)**.
- **"Archived" is worked out, never written down.** It is computed from `✔` plus the delay.
  Nothing in the file changes when an item becomes archived.
- **"Show archived" in the pane's ⋯ menu (call; archived is the owner's word)** shows archived
  items again, gray, in place.
  - **It isn't remembered (owner, 2026-10-20).** It's off each time a list opens, and holds only
    while that view is open. Nothing is stored: not in the file, not in the view's state, and not
    in the app's local storage.
- **The view works out what's archived** when the list opens or redraws. It runs no timer
  **(call)**.

## Creating, renaming, moving and deleting lists

**Creating a list has three routes (owner):**

- Right-click a folder in the file explorer and choose New list (`workspace.on('file-menu')`). The
  list is created in that folder. On the iPhone this is a long-press on the folder, which needs
  confirming on the device.
- The "New list" command. It's in the command palette on the Mac and the iPhone, and you can give
  it a hotkey under Settings → Hotkeys. The plugin sets no default hotkey, because Obsidian's
  plugin guidelines advise against it.
- The "New list" icon in the ribbon (`addRibbonIcon`).

**Where a new list goes (call):**

- From the command or the ribbon, a list goes where Obsidian puts new notes:
  `fileManager.getNewFileParent(<active file path>)`, which follows the "Default location for new
  notes" setting.
- The new file is called `Untitled list.md`, with a number added if that name is taken. It holds
  only the marker.
- It opens straight into the list view with its title ready to type.

**Renaming, moving and deleting** are done with Obsidian's own file explorer. Moving a list to
another folder changes its area. An open list view follows a rename or move made elsewhere
**(call)**.

**Moving a list in from another app, by hand, in step one:**

1. Copy the items in the other app.
2. Open the list as Markdown.
3. Paste them as `- [ ]` lines.

What another app puts on the clipboard, titles only or notes too, varies and hasn't been checked.

**Finding lists:** bookmarking the lists you use often is the simplest way to reach them. This
needs no code.

## Saving, outside changes, sync conflicts, undo

- **Saving (call):**
  - Typing saves through `requestSave`, which waits 2 seconds.
  - One-off actions write at once with `vault.process`: tick, drag, delete, new item, new heading
    and rename heading. Obsidian's docs recommend `vault.process` "to avoid unintentional loss of
    data".
  - Before a one-off action writes, the view first saves pending typing (`TextFileView.save`), so
    the file already holds the typing and the guard doesn't refuse the write.
  - The write is guarded: it is applied only if the file's text is still what the view expects.
- **The file is the only copy of the truth.** When the file changes from outside (Sync or an agent),
  the view redraws from it.
  - An editor that has focus isn't torn down.
  - Text being typed in an open card is part of what the view reports to Obsidian, so Obsidian's
    own merge covers it.
- **Sync conflicts can't be fully prevented.** If both devices edit the same list while offline,
  Sync merges the Markdown with Google's diff-match-patch algorithm (Obsidian Help, "Troubleshoot
  Obsidian Sync"). Simulating that merge on 2026-10-20 gave odd but recoverable results:

  | Device A | Device B | Merged result |
  |---|---|---|
  | ticks an item | ticks the same item | two `✔` marks |
  | ticks an item | renames it | the item appears twice |
  | drags an item | adds a note to it | the note lands under a neighboring item |

  - The parser tolerates all of this.
  - Since Obsidian 1.9.7, Sync's Conflict resolution setting can create a conflict file instead of
    merging. The setting is per device (same help page).
  - File recovery is the backstop.
- **Undo (1b, call):**
  - Cmd+Z and Cmd+Shift+Z step through the plugin's own edits, using the same guarded write.
  - The history is cleared when the file changes from outside, so undo never throws away someone
    else's change.
  - In 1a, the only undo is the Undo button shown after a delete.

## Technical approach

From here on the document is for the builder.

- **TypeScript,** starting from `obsidianmd/obsidian-sample-plugin` (esbuild). The plugin ID is
  `princelists` and its name is "PrinceLists" **(owner)**.
- **No UI framework (call).** Build the UI with Obsidian's DOM helpers (`createEl` and friends),
  because every dependency is maintenance (anti-goal 1). One small drag library is allowed if touch
  dragging needs it.
- **Parsing (call):** use `commonmark` (commonmark.js 0.31.2, BSD-2-Clause, three small
  dependencies) for the block structure and its source line positions. Don't write CommonMark's
  list rules by hand.
  - It is the parser the review tested against.
  - Its line positions map onto the original text, which the edit model keeps.
  - Obsidian-only syntax (`%%`, `$$`) has to be found before parsing.
  - If that gets awkward, the builder may hand-write a scanner that passes the same fixtures.
- **A pure TypeScript core with no Obsidian imports** holds the parsing, the edits and the
  archived rule. Fixture tests cover:
  - the round trip with no edit; CRLF; no final newline; trailing whitespace; space-indented
    notes; NFD text
  - notes holding bullets, headings, pictures, `---`, callouts and `$$`
  - the title-becomes-heading case; lazy lines
  - fences, HTML, `%%` and `$$` containing checkbox lines
  - marker and checkbox-character variants
  - where `✔` goes when the line has Tasks fields, tags or a block ID
  - tick and untick; doubled marks; refusing to tick 🔁
  - every row of the archived table
- **Styling (call):** use only Obsidian's CSS variables and its built-in Lucide icons (`setIcon`),
  so the view follows light and dark mode and any theme. Obsidian's plugin guidelines warn that
  hard-coded styling stops themes and snippets from changing a plugin's look.
- **Minimum Obsidian version:** set `minAppVersion` from the newest API used, going by each API's
  `@since` tag in `obsidian.d.ts`. Every device must run at least that version, the iPhone
  included. For step one that's 1.5.7, from `getFrontMatterInfo` (see "Verified facts").
- **Installing:** copy `main.js`, `manifest.json` and `styles.css` into
  `<vault>/.obsidian/plugins/princelists/`. The folder name must match the ID, or
  `onExternalSettingsChange` and similar methods aren't called (Manifest docs). Obsidian Sync takes
  the plugin to the iPhone if that vault syncs installed community plugins.

## Implementation notes

### Opening and switching views

- **Don't call `registerExtensions(['md'])`.** It throws, because `md` is already registered
  (observed).
- **Leave `canAcceptExtension` at its default of `false` (observed).** Returning `true` would open
  every note clicked from a list pane in the list view.
- **The view implements** `getViewType`, `getViewData`, `setViewData` and `clear`.
- **Switching on `file-open(file)`:**
  - Take `workspace.getActiveViewOfType(MarkdownView)` and require `view.file === file`. The event
    also fires for embeds, canvas nodes and keyboard navigation in the file explorer (its doc: "The
    file could be in a new leaf, an existing leaf, or an embed").
  - Skip any leaf in a `WeakSet<WorkspaceLeaf>` of panes where the user chose Markdown.
  - Detect the marker from the view's text with `getFrontMatterInfo` and `parseYaml`.
    `getFileCache` returns `null` for a file that isn't cached yet, such as one Sync or an agent
    just wrote.
  - Then call `leaf.setViewState({ type: <list view type>, state: { file: file.path } })`.
- **Don't switch on `active-leaf-change`.** It fires on every file load in the active leaf, so it
  would push a pane straight back after "Open as Markdown" (observed).
- **Back history:**
  - `setViewState` records a history entry when the view type changes, so Back would land on the
    same note as Markdown (observed).
  - In the list view's `setState`, call super and then set `result.history = false`.
    `ViewStateResult` is documented as something the view fills in. That `false` suppresses the
    entry is observed, not documented, so spike it.
  - Kanban passes an undocumented `popstate` flag instead. That's not allowed here.
- **A new list opens with `setViewState({ type: <list view type> })`,** never with `openFile`.
- **If the marker is gone in `setViewData`,** switch the pane to Markdown.
- **On restart, background tabs may be deferred views.** Check `instanceof` before calling into
  the view.
- **Pane menu:** add the list view's own items by overriding `onPaneMenu`. Use `file-menu` only for
  "Open as list", filtered on `leaf?.view instanceof MarkdownView`.

### Saving and outside changes

Most of this is undocumented behavior seen in 1.14.4, so pin it with tests and a spike.

- **`TextFileView` saves when it closes.** That much is documented: "by default, this view only
  saves when it's closing." It writes `getViewData()` when that differs from what was last
  saved. This is why edits must never rebuild the file.
- **It has its own `vault.on('modify')` listener (observed).** On an outside change it calls
  `setViewData(text, false)`. If a save is pending, it first merges the last-saved text,
  `getViewData()` and the disk text, and shows a notice. Don't add a second listener.
- **`save()` doesn't re-read the disk (observed).** It writes `getViewData()` with `vault.modify`,
  and its modify handler is skipped while a save runs. An outside write that lands mid-save can
  be overwritten. That's one more reason one-off actions use a guarded `vault.process`.
- **The save before a one-off action has the same window (call).** It writes only when there is
  unsaved typing (observed), and an outside write that lands during it can be lost, as with any
  save. This is accepted: it is one short write, the same as every `TextFileView` save.
- **The view's own `vault.process` writes come back through `setViewData`.** Recognize them by
  comparing with the text last written.
- **`setViewData(_, false)` updates the model** without rebuilding an editor that has focus.

### Rendering notes in the card

- **Call `MarkdownRenderer.render(app, markdown, el, <list path>, component)`** with one child
  `Component` per rendered block: `addChild` it, then `removeChild` it on re-render or close.
  Without a Component, embeds don't load and Obsidian logs a memory leak (observed).
- **The rendered output does nothing on click.**
  - Delegate `a.internal-link` clicks to
    `workspace.openLinkText(href, file.path, Keymap.isModEvent(evt))`, as Kanban's
    `src/helpers/renderMarkdown.ts` does.
  - No page previews on hover **(owner, 2026-10-20)**. They would need the `hover-link` event,
    and Obsidian documents no payload for it, so they wait until it does (see "Not in step one").
  - On the Mac (`Platform.isDesktop`), handle `contextmenu` on `a.internal-link`: create a `Menu`,
    let `workspace.handleLinkContextMenu(menu, linktext, file.path)` fill it, and show it with
    `menu.showAtMouseEvent(evt)`. The method returns a `boolean` whose meaning isn't documented,
    so don't depend on it.
- **Disable `.task-list-item-checkbox` in rendered notes.** Otherwise it ticks on screen but saves
  nothing.

### Touch on the iPhone

- **iOS WebKit fires no `contextmenu` event** (MDN compat data). Obsidian makes one itself on iOS
  after an 800 ms still hold (not yet confirmed on a device).
  - Because holding only ever drags, item rows must not open a menu. Cancel `contextmenu` on rows, in the capture
    phase, while a finger is down.
- **Dragging uses Pointer Events with a hold timer.** Kanban uses 500 ms, canceled if the finger
  moves more than 5 px first.
  - Once a drag is armed, a non-passive `touchmove` handler calls `preventDefault` to stop
    scrolling.
  - Kanban's `src/dnd/managers/DragManager.ts` is the reference.
  - Obsidian's own drag manager isn't public.
- **A long-press on a folder in the iPhone file explorer should reach `file-menu`,** with source
  `file-explorer-context-menu`. Nobody has seen it on a device yet: confirm it on the iPhone.
- **Put the floating "+" outside the scrolling element,** and check it against the mobile navbar
  and keyboard.

### Where `✔` goes

1. Strip a trailing block ID (` ^id`).
2. Strip trailing Tasks fields and `#tags`, using Tasks' full set of signifiers:
   🔺⏫🔼🔽⏬🛫➕⏳⌛📅📆🗓✅❌🔁🏁🆔⛔.
3. Insert ` ✔ YYYY-MM-DD HH:mm` there, then put back what was stripped.

- **Obsidian's own block-ID writer** puts ` ^id` after an item's last block. For an item with
  notes, that's the last notes line, so the notes editor keeps a trailing `^id` on that line.
- **How Tasks reads a line:** it strips the block link first, skips trailing `#tags`, needs no
  space before an emoji, and gives up after about 21 passes.
- **Accept an optional U+FE0F after `✔` (U+2714).** Write `✔` without it.

### Hide-time edge cases

- **The delay is 24 hours of elapsed time.** Across a daylight-saving change, the hide time moves
  by an hour on the clock. Accepted.
- **`✔` carries no time zone.** After traveling, two devices may disagree by a few hours. Accepted.

### Frontmatter

- **`getFrontMatterInfo` (since 1.5.7) gives the content start.** Pass it to the pure core.
- **Frontmatter only counts at byte 0.**
- **Test the marker with `=== true`.**
- **Never re-serialize the YAML.**

### Notes outside the vault

- **What the API says:** such a note is a `TExternalFile`, a `TFile` subclass (since 1.14.4) that
  "can be used with the vault API just like any other file". Nothing more is documented, so each
  point below is checked on the Mac before it is relied on: opening in plan Task 2's spike,
  writing and opening from a second vault in Task 8, and rendering and renaming in Task 9.
- **The installer:** opening a file from outside the vault "requires the latest installer" (1.14
  changelog). Check that first, so an old installer isn't mistaken for a failure of the plugin.
- **A fallback below is a proposal.** When a check fails, the builder records it with its
  proposed fallback, and the owner decides at the checkpoint of the task where it failed. Nothing
  falls back without the owner's decision.
- **The marker (call):** it is read from the note's text, as for every list ("Opening and
  switching views"). So it doesn't matter whether the metadata cache covers outside notes.
- **Opening (call):** the same switch on `file-open` and `setViewState` with `file.path`. The check
  is that it opens the note in the list view and restores it after a restart. Proposed fallback:
  outside notes open as Markdown, like ordinary notes.
- **Rendering (call):** `MarkdownRenderer.render` with the note's `file.path`, as for any list.
  Obsidian resolves an outside note's picture embeds and links from the note's own folder (1.14
  changelog). The check is that the same happens in a card. Proposed fallback: outside notes open
  as Markdown.
- **Writing (call):** `vault.process` and `TextFileView.save`, as for any list. The check is that
  ticking writes the file and that an edit made in another app while the note is open shows in
  the view. If Obsidian doesn't notice such an edit, typing in the view can overwrite it. Proposed
  fallback for either: outside notes open as Markdown.
- **Renaming from the list title (call):** the same `fileManager.renameFile`, to the new name in
  the note's own folder. The check is that the file is renamed where it is and stays outside the
  vault. Proposed fallback: an outside note's title can't be edited, and it's renamed outside
  Obsidian.
- **Telling an outside note apart (call):** only the fallbacks need it.
  - Use `vault.getAbstractFileByPath(file.path) !== file`. That method finds a file "inside the
    vault" (since 0.11.11). Task 2's spike checks that it doesn't return an outside note.
  - `file instanceof TExternalFile` would mean raising `minAppVersion` to 1.14.4, the owner's
    call. `TExternalFile` is `@since 1.14.4`, so it's not in the API before that, and where the
    class is missing at runtime, `instanceof` throws a `TypeError`. The
    `obsidianmd/no-unsupported-api` lint rule doesn't check `instanceof`, so it wouldn't catch
    that (tested with `eslint-plugin-obsidianmd` 0.4.2 on 2026-10-20).
- **Outside notes leave `minAppVersion` at 1.5.7:** nothing here uses a newer API.

## Testing and owner checkpoints

- **Manual testing uses a test vault on the Mac and an iPhone.**
- **The owner runs the manual checks.** Only someone holding the iPhone can do the iPhone ones.
- **Spikes come first, and each one stops for the owner:**
  1. The flash when a list opens.
  2. Hold-to-drag on the iPhone: it must not break scrolling or trigger Obsidian's long-press
     menu. The owner sets the pass bar.
- **Then 1a, then 1b.**
- **Before installing in a vault with real notes,** test once in the test vault with Tasks and
  Kanban installed. Kanban patches how notes open, so check that the two plugins don't fight.
- **Check a Sync conflict once:** edit the same list on both devices while offline, then compare
  the result with the table above.

## Risks to check during the build

1. **The flash** when a list opens.
2. **Back history:** whether `result.history = false` really keeps the extra entry out.
3. **The iPhone gesture:** hold-to-drag, scrolling, and Obsidian's long-press menu all start the
   same way.
4. **Obsidian's parser vs. CommonMark** for the tested cases, in reading view: the title becoming
   a heading, lazy lines, and the odd markers.
5. **Kanban's patch** interfering with the plugin's switch to the list view.
6. **The `✔` glyph** may show as an emoji on some systems. That's harmless, but check it reads
   well.
7. **Notes outside the vault:** whether opening, rendering, writing and renaming work for them.

## Left to the builder

- **Display:** how existing dates and tags show in step one, and how content the plugin leaves
  alone shows.
- **Renaming a list:** what happens when the new name is already taken.
- **Editing:** the editor used for notes, how the list-note editor warns, and keyboard details
  beyond Enter, Escape and undo.
- **Parsing:** whether to keep commonmark.js if pre-masking `%%` and `$$` gets awkward.

## Verified facts

Checked 2026-10-20.

- **Obsidian API** (`obsidian.d.ts`, obsidian-api 1.14.4):
  - views: `ItemView`, `FileView.canAcceptExtension`, `TextFileView` ("by default, this view only
    saves when it's closing"; `requestSave` waits 2 seconds), `View.onPaneMenu`, `ViewStateResult`
    ("Set this to `true` … recorded in the navigation history")
  - menus and events: `Menu.showAtMouseEvent`; `Workspace.on('file-menu' | 'file-open')`, where
    `file-open` "could be in a new leaf, an existing leaf, or an embed"; `Plugin.addRibbonIcon`;
    `Workspace.openLinkText`; `MenuItem.setWarning` (0.15.0), which turns the item's "title and
    icon" red; `Workspace.handleLinkContextMenu` (0.12.10), which adds "a context menu to
    internal file links"
  - rendering and metadata: `MarkdownRenderer.render`, `CachedMetadata.listItems`,
    `getFrontMatterInfo` (1.5.7), `parseYaml`, and `getFileCache` (returns null when not cached)
  - files:
    - `FileManager.renameFile`, which updates links "depending on the user's preferences"
    - `FileManager.getNewFileParent` (1.1.13) and `FileManager.getAvailablePathForAttachment`
      (1.5.7)
    - `Vault.createBinary`, `Vault.process` (1.1.0) and `Vault.on('modify')`
    - `TExternalFile` (1.14.4): "Represents a file that is outside the Vault. Can be used with the
      vault API just like any other file."
    - `Vault.getAbstractFileByPath` (0.11.11), which gets "a file or folder inside the vault"
  - settings: `getSettingDefinitions` (1.13.0), `onExternalSettingsChange` (1.5.7)
  - the minimum version: the `@since` tags decide it. The newest among the APIs step one uses is
    1.5.7, for `getFrontMatterInfo` (and `FileManager.getAvailablePathForAttachment` in 1b). The
    others are older or untagged, and every untagged one is already in the 1.5.7 `obsidian`
    package. With `minAppVersion` 1.5.7, the `obsidianmd/no-unsupported-api` rule passes a file
    that calls each of these APIs, and at 1.5.6 it flags the two 1.5.7 ones. `MenuItem.setWarning`
    and `Workspace.handleLinkContextMenu` carry older tags but first appear in the package at
    1.10.0. Nothing has been tried on an Obsidian older than 1.14.4.
  - extensions: `registerBasesView` (1.10.0), `registerEditorExtension` (0.12.8),
    `registerMarkdownCodeBlockProcessor`, `registerMarkdownPostProcessor`,
    `registerObsidianProtocolHandler`, `Plugin.registerCliHandler` (1.12.2)
  - look and feel: `setIcon` (Lucide icons); `addStatusBarItem` ("Not available on mobile");
    `Platform`
  - absent: an API for adding actions to the New tab screen, any notification API beyond
    `Notice`, and a payload type for the `hover-link` event, which only the docs of
    `registerHoverLinkSource` (1.1.0) and `HoverLinkSource` name. Step one uses neither the event
    nor that method.
- **Obsidian docs:**
  - custom views (docs.obsidian.md, Views)
  - mobile limits (Mobile development)
  - "avoid setting a default hotkey" (Plugin guidelines)
  - "Always prefer `Vault.process()`" (Vault)
  - the manifest `id` uses only lowercase letters and hyphens, can't end with `plugin`, can't
    contain `obsidian`, and should match the folder name during development (Manifest)
  - "supports CommonMark, GitHub Flavored Markdown, and LaTeX" (obsidian.md/help, Obsidian
    Flavored Markdown)
  - Bases works on whole notes and their properties (obsidian.md/help, Bases)
  - Sync merges Markdown with Google's diff-match-patch algorithm, and since 1.9.7 a per-device
    Conflict resolution setting can create a conflict file instead (obsidian.md/help,
    Troubleshoot Obsidian Sync)
  - since 1.14, the desktop app opens individual Markdown files from outside the vault, in the
    current window, and "opening Markdown files requires the latest installer"
    (obsidian.md/changelog, "Obsidian 1.14 Desktop (Public)"). "Obsidian 1.14 Mobile (Public)"
    doesn't name it, though it "includes all new features" up to desktop 1.14.4.
  - the app and installer versions show under Settings → General, with a notice when a newer
    installer is available (obsidian.md/help, Update Obsidian)
  - the app's iPhone widgets and Capture shortcuts (obsidian.md/changelog, "Obsidian 1.11 Mobile
    (Public)") and Quick Capture on iOS 26 ("Obsidian 1.14 Mobile (Public)")
  - the Obsidian CLI needs the 1.12 installer and the app running (obsidian.md/help, Obsidian
    CLI)
  - with Settings → Appearance → Native menus on, menus "will not be affected by your theme"
    (obsidian.md/help, Settings)
- **Seen in Obsidian 1.14.4, not documented** (pin each with a spike before relying on it):
  - `registerExtensions(['md'])` throwing
  - `canAcceptExtension` defaulting to `false`
  - when `file-open` and `active-leaf-change` fire
  - `setViewState` history entries
  - `TextFileView` reloading and merging on outside changes
  - `MarkdownRenderer` needing a Component
- **Not yet confirmed on a device:** the iOS `contextmenu` after an 800 ms hold, a folder
  long-press on the iPhone reaching `file-menu`, and how a note from outside the vault behaves
  (opening, rendering, writing, renaming, and edits from another app).
- **`eslint-plugin-obsidianmd`** 0.4.2, tested 2026-10-20: `no-unsupported-api` reads the
  project's own `obsidian.d.ts` and flags a member whose `@since` is newer than `minAppVersion`,
  unless a `requireApiVersion` check guards it. It doesn't check `instanceof`.
- **Tasks plugin** (`obsidian-tasks-group/obsidian-tasks`, release 8.6.0 on 2026-10-16):
  - query views tick and edit tasks, and since 8.4.0 a columns view drags tasks between columns
    to edit some fields, such as dates and priority (Tasks docs, "Views"). Results follow
    `sort by` instructions, with no way to reorder them in the view; `sort by path` then
    `sort by function task.lineNumber` gives file order ("Sorting").
  - date fields: 📅 due, ⏳ scheduled, 🛫 start, ✅ done
  - the date format is date-only and can't be configured
  - fields are read from the end of the line (`src/TaskSerializer/DefaultTaskSerializer.ts`)
  - `[x]` with no ✅ still counts as done
  - a Tasks global filter, if set, makes Tasks ignore items without it
- **Kanban plugin** (`mgmeyers/obsidian-kanban`, `src/main.ts`): it patches `WorkspaceLeaf.prototype`
  with `monkey-around` to open its notes in its own view.
- **CommonMark reference parser** (`commonmark` 0.31.2): it confirmed the notes cases and the
  title-becomes-heading case. The second goes away with the blank line between title and notes.
