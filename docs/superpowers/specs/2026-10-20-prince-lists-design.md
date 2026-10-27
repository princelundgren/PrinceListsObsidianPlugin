---
status: building
verified: 2026-10-27
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

**Keys:** Cmd in this design means Obsidian's `Mod` key, which is Ctrl on Windows and Linux.

Three independent reviewers checked this document on 2026-10-20: Obsidian platform, file format
and data safety, and owner's advocate. Their findings are folded in.

## At a glance

- **A list is an ordinary note** with `princelists: true` at the top. Open it and it shows as a
  clean todo list. Turn the plugin off and it is still a readable note.
- **What's inside:** headings make sections and checkboxes are items. Anything indented under an
  item is that item's notes, and notes can hold any Markdown, pictures included.
- **Ticking an item** grays it out where it is. Twenty-four hours later it is **archived** and
  hidden, and "Show archived" brings archived items back.
- **Lists open in the list view.** The plain note shows for about 10 ms first, which the owner
  couldn't see on macOS or an iPhone.
- **A note from outside the vault** with the marker, opened in Obsidian on desktop, is a list too.
- **On desktop,** you right-click for actions and drag with the mouse.
- **On mobile,** you tap to open an item and hold-and-move to drag it. Item actions sit in a ⋯
  button on the open card, and tapping a heading opens the heading menu.
- **It is built in two parts.** 1a is desktop plus the mobile basics. 1b adds dragging on mobile,
  pasting pictures into a card, and Cmd+Z undo.
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
3. **Run on desktop and mobile (owner, 2026-10-27):** every platform Obsidian runs on, macOS,
   Windows, Linux, iOS, iPadOS and Android. Obsidian runs on all of them, and the code depends only
   on whether it runs on desktop or mobile, through Obsidian's `Platform`. This replaces the first
   targets, the Mac and the iPhone (2026-10-20). Hands-on checks have run on macOS and an iPhone
   so far; Windows, Linux, Android and the iPad aren't checked yet.

**Two parts (owner):**

- **1a:**
  - Everything on desktop: the view, ticking, adding, editing, right-click actions, mouse
    dragging, and creating lists.
  - The mobile basics: open, tick, add, edit, the card's ⋯ actions and the heading menu.
  - Pictures already show in 1a.
- **1b:**
  - Dragging on mobile.
  - Pasting or dropping pictures into a card.
  - The Cmd+Z undo history.

**Done when (owner):** one real list, moved in from another todo app, has lived only in Obsidian
for two weeks, on desktop and mobile, without going back to the other app for it. The two
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

- **[Step two](2026-10-27-prince-lists-step-2-design.md) (owner, 2026-10-27)** takes on what the
  owner needs before moving in: ticking checklists, Cmd+F, showing a list inside another note,
  "Turn into list", a When day with a Schedule view, starring an item, and dragging a heading to
  move its whole section or collapsing it.
- **Views across lists:** a sidebar with views such as Inbox, Today, Upcoming and Done, grouped
  by area. An area is a list's folder. A Favorites view gathers starred items **(owner,
  2026-10-27)**.
- **Dates and tags:** a deadline on items, plus tags and tag filters.
- **Smaller item features:**
  - repeating items, a trash, IDs on single items, and sorting modes
- **Quick capture from outside Obsidian.** A plugin can't hear a global hotkey. The documented
  route is an `obsidian://` handler (`registerObsidianProtocolHandler`) that Raycast, Shortcuts
  or a phone's shortcut can call.
- **A command for the Obsidian CLI (owner, 2026-10-20).** `Plugin.registerCliHandler` (since
  1.12.2) adds a command to Obsidian's command-line tool, for example to add an item to a list
  from a script.
  - The CLI needs the Obsidian app running (Obsidian Help, "Obsidian CLI").
  - Whether it does anything on mobile is unverified.
  - Using it means raising `minAppVersion` to at least 1.12.2.
- **Importing from other todo apps.** Another app's lists could come in through its export or an
  integration; whether headings and notes survive is unverified.
- **Moving old archived items** into an archive note.
- **A command that inserts a list into a note,** instead of typing step two's `princelists` code
  block.
- **A "New list" button on Obsidian's New tab screen (owner, 2026-10-27).** It waits until
  Obsidian documents a route: there is no API for that screen, and adding a button there means
  changing Obsidian's own DOM. Until then, New list is on the ribbon, in the command palette and in
  a folder's menu.
- **Tidier display in plain Markdown.** Making `✔` and dates look tidy when a list is opened as
  plain Markdown or embedded, using `registerMarkdownPostProcessor` for the reading view or
  `registerEditorExtension` for the editor.
- **A sidebar of all lists built on Bases.** A Base filtered on `princelists: true` already lists
  them all, and `registerBasesView` (since 1.10.0) lets a plugin add its own Bases view type.
- **Page previews of links in a card (owner, 2026-10-20).** A preview on hover needs the
  `hover-link` event. `obsidian.d.ts` names it only in the docs of `registerHoverLinkSource` and
  `HoverLinkSource`, with no payload type, so previews wait until Obsidian documents the payload.
  Links in a card still open, and on desktop they still get Obsidian's link menu.

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

- **Lists shared across vaults.** The plugin builds nothing to share a list between vaults.
  - **A note from outside the vault is allowed in any vault (owner, 2026-10-20).** Opened from two
    vaults' windows, it works as a list in each. Nothing is built for this.
- **A long-press menu on item rows on mobile.** The owner chose: holding only ever drags.

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
- **Sync.** Obsidian Sync can carry a vault between devices, and agents may also edit notes in a
  vault. So a list file can change while it is open in the view.
- **Open source (owner, 2026-10-20).** `princelundgren/PrinceListsObsidianPlugin` is open source
  under the MIT license.
  - It goes to Obsidian's community directory after the first release.
  - An agent gives every pull request from a branch in this repository a first pass, as the
    [pull request review design](2026-10-20-pr-review-agent-design.md) describes. A fork's pull
    request gets the owner's review instead **(owner, 2026-10-20)**. Issues get a first pass
    later, under a design not yet written. The owner always merges and makes releases.
- **Privacy (owner, 2026-10-20).** No telemetry of any kind. The plugin makes no network requests
  unless one is agreed on in an issue first, and any network use is disclosed in the README, as
  Obsidian's developer policies require. Rendered notes show a picture linked from the web, because
  Obsidian's renderer loads it, as in any note, and the README says so **(owner, 2026-10-21)**.

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
  Such a note with `princelists: true` behaves like any list note, except that pictures can't be
  added to it (see "Editing", Pictures).
  - Obsidian's 1.14 changelog lists this for desktop, and opening such a file needs Obsidian's
    latest installer. Whether the mobile app can open one is unverified, so the plan checks it on
    desktop only.
  - On desktop, the plugin does everything with such a note that it does with a vault note, except
    add pictures: opening, rendering, writing, renaming and links all work, so none of the
    fallbacks in "Notes outside the vault" was needed.

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
- a line of `-` or `=` signs directly under text, which turns the text above it into a heading.
  A single `-`, typed to start a bullet, counts until a space and more text follow it

If you type one of these, it becomes a section or an item when it is saved. The list-note editor
says so in a gray line under it before it saves **(call)**.

The editor also warns when the list note opens a fenced code block, a comment (`%%`) or a math
block (`$$`) without closing it, because an unclosed block hides every item below it **(owner,
2026-10-20)**. It warns the same way about an HTML block that CommonMark runs to the end of the
file when its end is missing, such as `<!--` without `-->` or `<pre>` without `</pre>` **(call)**.

When the list note isn't empty and an item or heading follows it directly, saving the note writes
one blank line between them **(owner, 2026-10-20)**. Without it, a list note that ends in an HTML
block such as `<div>x</div>` would swallow the first item: CommonMark continues that kind of block
until a blank line.

A note the editor warns about for an unclosed block still saves, with no check of what follows, so
nothing typed is lost **(owner, 2026-10-21)**. Saving changes only the note's own lines, so what
follows is never lost:

- **While the block stays open,** the items and headings below are hidden. Where a fence or comment
  further down closes the block, the text after that line reads differently instead, as when a
  fenced block's checkbox lines become items.
- **The save that closes the block** skips the check as well **(call)**. It brings them back as they
  were, unless it also makes the note take them in, as a list item in the note does with an
  indented first item. Nothing is deleted then either, and leaving the field and coming back shows
  those lines in the note.

This is the one exception to refusing an edit that changes how the rest reads (see "Content the
plugin leaves alone"). Any other note that would change what follows is refused **(call)**, as when
a first item indented to a list item's content column would join that item.

Each save replaces exactly the lines the editor's previous save wrote, not the list note as the file
now parses **(call)**. Typing can change how the note's own lines parse: a `-` under text makes a
heading, and an opening fence makes the rest of the file part of the note. Re-reading the note's
extent from the file after such a keystroke would delete or repeat lines. That includes the blank
line a save wrote under the note, so a note typed and erased again leaves none behind, but only
while it is still blank and directly under the note **(call)**: a line another device added there
stays, and the blank line stays with it.

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
  - Notes that open with indented code, 4 or more columns past the content column, don't lend
    that indent either **(call)**: every note written with it would become code.
  - A tab reaches column 4. With `100. [ ] x` the content column is 5, so a tab-indented note
    there turns into a code block.
  - A lazy line, indented less than the content column, still belongs to the item. Written back
    after the blank line with its own indent, it would leave the item.
  - While the notes editor is open, every save uses the indent the notes had when it opened
    **(call)**. Taken afresh from the file after each keystroke, a space typed at the start of the
    notes would widen it, and the next save would turn a paragraph into code.
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
- **A `%%` comment or a `$$` block is recognized only when its opening line starts with `%%` or
  `$$` at column 0 (call):** an indented one may belong to an item's notes, where masking it would
  change the item's extent. The accepted cost: a top-level comment or math block indented 1 to 3
  spaces isn't recognized, so checkbox lines inside it become items. Masking also doesn't track
  HTML blocks such as `<div>`, which end at a blank line, so a fence line inside one, with no blank
  line before the fence, can leave a later `%%` or `$$` region unmasked. Likewise, a new item
  added right after such a block would join it: at the end of the file after a list note that
  ends in one, or in a section without items whose content does. So would a new heading added
  after a section whose content ends in one. Preventing that needs a blank line before the item
  or heading, outside the lines the edit replaces, so that insert is refused **(call)**, as below.
  A drag isn't bound by that, so it writes the blank line.
- **Other content is kept byte for byte where it is:** paragraphs between items, bullets without
  a checkbox, tables, and link reference definitions.
  - **The view shows it in its place as gray plain text (call),** like the list note, so it can be
    seen. That goes for the blocks above too: fenced code, HTML blocks, comments and math.
  - It is never lost and never silently reordered.
  - **Edits leave it parsing as it did (call).** Every top-level block an edit doesn't touch keeps
    its type and source text, the list note's blocks included. Where an edit would leave text
    right below a block that would take it in, as a lazy line, as more of a paragraph or as a
    setext heading's text, the edit writes one empty line between them. Parsing the text before
    and after decides, not hand-written rules.
  - **An edit that one empty line can't make safe is refused (call),** and nothing is written. The
    view says the list's layout can't take that change and suggests making it in Markdown. An
    example: text indented to an item's content column, which would become the notes of the item
    above once the item between them is deleted. A list note that leaves a block open is the one
    exception (see "The list note").
  - A setext heading's line is its first line after any link reference definitions that open its
    paragraph, so those definitions stay untouched content **(call)**. The accepted cost: the
    check reads such a heading as starting at its definitions, so an edit that would separate
    them from its text is refused, as is any save of a list note that ends with them **(call)**.

### Checklists (call; the format is reserved now)

- Checkbox lines indented in an item's notes are that item's checklist.
- In step one they render as disabled checkboxes. Step two ticks them in the open card: a box
  ticks its own line, and nothing else on it changes. The row shows nothing about the checklist.

### Dates (owner: the Tasks emoji format)

- **Reserved now, used later** (step two writes ⏳ as an item's When):
  - ⏳ scheduled, the day you plan to do it. In step two it is the item's When, set from the
    card's calendar icon (step two's design, "When").
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
  - In a file that doesn't end with a newline, an edit leaves no empty line last **(call)**. Empty
    lines it would leave at the end go, so the new last line keeps the missing newline. They only
    separate blocks, so nothing parses differently.
  - It adds one empty line where the text below would otherwise join the block above **(call)**:
    after a new item or rewritten notes, or in place of a deleted item or heading. When that isn't
    enough, the edit is refused. See "Content the plugin leaves alone".
- **Why:** this kind of view saves when it closes. If the text it hands back differed from the
  file in any way the user didn't cause, closing a list would write to the file, which is a
  background write.
- **A drag moves an item's whole block.** Only items change order: the blank lines between
  items, and content the plugin leaves alone, stay where they were **(call)**.
  - **Into another section (call),** the item goes without a blank line. In the section it
    leaves, the blank lines after it move to that section's end when they no longer sit directly
    between two items.
  - **The blank lines before the item stay (call).** Moved away, untouched text after the item
    would join the item above as a lazy line.
  - **An item between two runs of blank lines (call)** takes the run after it to the section's
    end, as a delete removes it, so no double blank line is left between items. When only blank
    lines follow the item in its section, both runs end up at its end.
  - **A drag adds an empty line (call)** wherever the text below one of the boundaries it makes
    would otherwise join the block above, as any edit does. It checks again after each, since one
    can uncover the next. A join with a link reference definition, which belongs to no block,
    can't be traced to a boundary, so the drag then writes an empty line at every boundary it
    made. It's refused only when that isn't enough either.

## The list view

### Opening a list

- **A note with the marker opens in the list view (call).** The plugin watches for a note being
  opened and switches that pane to the list view. It does this with documented APIs only.
- **Not the Kanban way:** Kanban, the best-known plugin with its own view for notes, monkey-patches
  Obsidian's internals for this, which is off the table.
- **The cost is a short flash.** The normal editor shows for about 10 ms before the switch, under
  one frame at 60 Hz. The owner couldn't see it on macOS or an iPhone **(owner, 2026-10-21)**
  ([spike 1](../notes/2026-10-21-spike-open.md)). Even if it showed, the plugin wouldn't fall back
  to patching.
- **"Open as Markdown" and "Open as list"** are in the pane's ⋯ menu and are also commands.
  Choosing Markdown holds for that note in that pane until it is switched back or Obsidian
  restarts **(owner, 2026-10-21)**. Another list opened in the same pane still opens as a list,
  and going Back to the first note shows it as Markdown again.
- **On restart,** Obsidian restores a list pane as the list view.
- **If the marker is removed** while the list is open, the pane switches to Markdown.
- **A note without the marker that loads in the list view stays there (owner, 2026-10-21).** That
  happens through Back, Forward or a restart. It shows the note's name, then "This note isn't a
  list", then an "Open as Markdown" button.
  - The pane can't switch by itself there: Back would loop on the note ("Opening and switching
    views").
  - The accepted cost: after the pane switches to Markdown by itself, Back stops once on the note,
    which shows the message. One more Back reaches the previous note.

### Layout (owner)

- **The title** is at the top, with the list note under it in gray. Step one has no icon beside
  the title **(call)**.
- **While filtering,** Cmd+F's field shows below the list note (step two's design, "Cmd+F").
- **Headings** are bold, with a thin rule below. In step two, an arrow left of each collapses its
  section (step two's design, "Collapsing a heading").
- **Items** show a checkbox and a title, one per line. In step two a row also shows its star and
  its When.
- **Item titles and headings are rendered as Markdown (owner, 2026-10-21),** with Obsidian's own
  rendering, as in any note: bold is bold, and links can be clicked. A click on a link in a row
  opens the link. It doesn't tick the item or open the card.
- **Web links show without Obsidian's external-link icon (owner, 2026-10-27),** in titles, notes,
  the list note, the Schedule view and a list inside another note, as Live Preview shows a bare
  URL. No CSS variable controls the icon, so the plugin's styles turn off the background image
  that draws it, inside its own views only, as Obsidian's web viewer does.
- **Clicking an item** (not a link in its title) opens it into a raised card that shows the title
  and the rendered notes.
  - **On mobile in dark mode the card takes Obsidian's secondary background (owner,
    2026-10-27).** The page is black there, so a card in the page's own color, raised only by its
    shadow, can hardly be seen. Desktop keeps the page's color.
  - Notes use Obsidian's own Markdown rendering, so pictures, links and embeds look the way they
    do in any note.
  - **A card's notes are at least three lines tall (owner, 2026-10-27),** empty or not, and so is
    the notes field while it's being typed in, so it's easy to tap. Empty notes show a gray
    "Notes".
  - **No field draws a frame or focus ring, notes included (owner, 2026-10-27):** a field being
    typed in reads as its text, as a title does.
  - Links in a card can be clicked.
  - On desktop, right-clicking an internal link in a card shows Obsidian's own link menu
    **(owner, 2026-10-20)**. The item menu doesn't open as well **(call)**.
  - On mobile there is no right-click. A tap opens the link, and there is no link menu,
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
  Completion). Step two hides an item's star too, and saving puts it back once.
- **An item's When (step two):** the calendar icon at the card's top right sets it, and the clear
  button beside the day removes it.
- **The list title (call):** editing it renames the file when you press Enter or leave the field,
  not on every keystroke. Switching to another window or app doesn't leave the field. The rename
  uses `fileManager.renameFile`, which updates links according to the user's link settings. Escape
  puts the old name back. If another note in the list's folder has the new name, compared without
  regard to case as macOS and iOS disks compare names, a message says so and the old name stays.
  So does a name with `/` or `\`, which would move the list to another folder. A note outside the
  vault has no folder in the vault (observed in 1.14.4), so for one the name counts as taken only
  when Obsidian finds a file at exactly the new path.
- **The list note and item notes (call):**
  - Both show as rendered Markdown. Clicking into one switches to a plain-text editor of the raw
    Markdown, without the item's indent.
  - **Where the caret goes (owner, 2026-10-27):** on the character clicked, wherever the rendered
    text matches the Markdown. On a link, a picture or another part the rendering draws or hides,
    at the end of that source line. A click on a link still follows it. The rendered notes show a
    text cursor.
  - Where the browser has no `caretPositionFromPoint` (Chromium before 128, Safari and iOS before
    26.2), a click goes to the end of the first line of the clicked paragraph or list item **(call)**.
    The older `caretRangeFromPoint` would tell the character, but it's deprecated, and Obsidian's
    lint rules don't allow deprecated APIs.
  - Leaving the editor renders the text again, and saving puts the indent back.
- **Pictures (owner):**
  - Pictures show from 1a on.
  - Pasting or dropping a picture into a card comes in 1b. In 1a you add a picture through "Open
    as Markdown".
  - Only a card takes pictures, not the list note **(owner, 2026-10-22)**: a picture goes in the
    list note through "Open as Markdown".
  - In 1b a pasted or dropped picture is saved with
    `fileManager.getAvailablePathForAttachment` and `vault.createBinary`, following the vault's
    attachment settings.
  - Its link is `!` and `fileManager.generateMarkdownLink`, so it follows the vault's link
    settings; with Obsidian's defaults that's `![[name]]` **(owner, 2026-10-22)**. A plain
    `![[name]]` could show the wrong picture when two files share a name.
  - **Pasting (call):** a picture pasted into an open notes editor is saved and linked; text
    pastes as text. A pasted picture in a card's title does nothing.
  - **Text wins (owner, 2026-10-27):** a paste that holds plain text pastes as text, even when it
    holds a picture too. Numbers, Excel, Pages and Word copy a picture of the text along with it.
    A card's notes are plain text, and the text is what was copied; Obsidian's own editor pastes a
    spreadsheet's text, too. Only a paste with no plain text adds its pictures.
  - **Dropping (call):** a picture file dropped on an open card is saved and linked. Any other drag
    leaves the card alone. Where the platform hides a drag's file kinds until the drop, as iOS does,
    the card accepts any file drag and checks each file when it lands **(owner, 2026-10-27)**.
  - **Names (call):** a pasted picture is named `Pasted image YYYYMMDDHHmmss.<ext>` in local time,
    as Obsidian names its own. A dropped one keeps its name, with `#`, `^`, `|`, `[` and `]`
    replaced by `-`, since in a link they start a heading, a block, an alias or the brackets.
  - **Refused formats (call):** only the formats Obsidian shows are added: avif, bmp, gif, jpeg,
    jpg, png, svg and webp. Others, such as HEIC, would be linked but not shown, so a notice says
    they weren't added.
  - **Where the links go (call):** when a notes editor is open once the last picture is saved
    (including one opened meanwhile), the links go in at its cursor as it is then, so typing
    meanwhile isn't replaced, inside the line when the cursor is mid-line. With no editor open,
    including one that closed meanwhile, the editor opens and the links go on a line of their own at
    the end. They save as typing does.
  - **A card that closed or lost its item first (call):** nothing is inserted, and a notice gives
    the saved path.
  - **A picture dragged from inside Obsidian (call)** isn't added: dropping a rendered picture back
    on the card would save a second copy.
  - **A list outside the vault takes no pictures (owner, 2026-10-27):** a paste or drop saves
    nothing and shows "Pictures can't be added to a list outside the vault." The link wouldn't
    resolve from a note outside the vault.

### Selecting and adding

- **Selecting (call):** clicking an item, anywhere except its checkbox or a link in its title, opens
  its card and selects it. Clicking empty space closes the card and clears the selection.
  - **While a card is open, a click outside it only closes it (owner, 2026-10-27):** a click on
    another item, a heading or the list note doesn't also open it. A checkbox still only ticks.
- **The floating "+" button (owner)** sits at the bottom right of the list pane. It stays put while
  the list scrolls, on desktop and mobile. Its accessible name is "New item" **(call)**.
  - **On desktop it sits 32 px higher (owner, 2026-10-27),** clear of Obsidian's status bar, which
    floats over the bottom right of the window. Mobile has no status bar (`addStatusBarItem`:
    "Not available on mobile").
    Obsidian documents no variable for the bar's height, so the lift is fixed on purpose:
    `--size-4-8`, a step of Obsidian's spacing scale, a little more than the 27 to 31 px the bar
    measured in 1.14.5. Measuring the bar would mean reading Obsidian's own DOM. A theme with a
    taller bar can still touch the "+"'s lower edge, and with the bar hidden the "+" sits a little
    higher than it must.
  - **Cmd+Enter does what "+" does** (step two), anywhere in a list that has focus, a card's
    fields included. An empty list shows a gray hint saying how to add an item.
- **Where a new item goes (call):** directly below the selected item. When nothing is selected, it
  becomes the first item of the list, before the first heading.
  - The new item opens with the cursor in its title.
  - **Enter in a title closes the card (owner, 2026-10-27),** as Escape does, so typing a new
    item's name and pressing Enter finishes it. Shift+Enter adds another item below it instead, so
    a run of items can still be typed in one go. On mobile, "+" adds each next item.
  - In a new item whose title is still empty, Shift+Enter closes the card instead, which removes the
    item, so a second Shift+Enter ends a run of new items. "+" and New item below keep it, with the
    cursor back in its title. Delete closes the card, which removes the item as a cancel, with no
    Undo **(call)**.
  - A new item is removed again if you close its card while its title is still empty and it has
    no notes **(call)**. Removing it restores the text from before it was added, so an empty line
    the insert wrote goes too. If the file changed outside the view while the card was open, the
    item is deleted from the current text instead, without a message **(call)**. If even that would
    change how the rest reads, the empty item stays and the view says so. Closing means Escape, a
    click elsewhere, Enter, starting a drag, a menu choice that adds an item, Delete on it, or
    Cmd+Z with focus outside its fields.
    Closing the list, switching files or a change from outside never removes an item, and an item
    that existed before the card opened is never removed this way.
- **An empty list note (call)** shows as a gray "Notes" placeholder under the title, in any list,
  so a note can be added from the view. In any list without items, new or not, pressing Enter in
  the title saves the name and starts the first item.
- **Hidden archived items don't count for positions (call):**
  - New items, drops and new headings go directly after the visible row above them, before any
    hidden rows that follow it.
  - The exception is a heading added after a whole section: it goes after that section's hidden
    rows, so they stay in their section.
  - A drag never moves a hidden row.

### Item actions (owner)

- **On desktop, right-click an item** for New item below, New heading below and Delete
  **(call)**. Delete removes the item and its notes. Step two's star is a button on the open card,
  not an entry here **(owner, 2026-10-27)**.
- **Right-click a heading (call)** for the heading menu: New item, New heading below, Rename
  heading and Delete heading.
  - New item adds one as the first item under the heading. In a section without items, it goes
    after the section's content **(call)**: directly under the heading, a paragraph there would
    join the item as a lazy line, and a setext heading spans more than one line.
  - **Rename heading (owner, 2026-10-20)** edits the heading text in place. It keeps the
    heading's level, pressing Enter or leaving the field saves, Escape cancels, and an empty name
    keeps the old one **(call)**. Switching to another window or app doesn't leave the field
    **(call)**. A name that wouldn't come back as this heading, at its level and with exactly that
    text, isn't written, and a message says so **(call)**: for example one starting with `- [ ]`
    under a `===` underline, an underline such as `===` itself, or one ending in ` #`.
  - Deleting a heading keeps its items, which join the section above. That's safer than losing
    them. A heading between two runs of blank lines takes the run after it, as a deleted item
    does, so no double blank line is left **(call)**.
- **On both desktop and mobile,** the open card has a ⋯ button with the same item actions. On
  mobile this is the only way to reach them **(owner)**. The button's accessible name is "Item
  actions" **(call)**.
- **On mobile, tapping a heading opens the heading menu:** New item, New heading below, Rename
  heading and Delete heading **(owner, 2026-10-20)**. It's a tap, not a long-press, so there is
  still no long-press menu. With a card open, the tap only closes the card ("Selecting and
  adding").
- **New heading below (owner, 2026-10-20)** adds an empty heading at that point and opens the
  same field as Rename heading, with the cursor in it. Escape, or an empty name, removes the
  heading again.
  - **Accepted cost (owner, 2026-10-22):** a field left open while the user is in another app
    keeps its name until they come back. If its pane is closed meanwhile, nothing is written, since
    closing never writes, so an empty new heading stays in the file, as it does when the pane is
    closed with the field open.
- **A new heading inserted below an item takes the items after it (call).** This is the same as
  typing that heading into the raw file at that point.
- **Undoing a delete (call):** after Delete or Delete heading, a message with an **Undo** button
  shows for a few seconds. Removing an empty new item or heading is a cancel, with no Undo.
  Obsidian's File recovery core plugin, when enabled, is the backstop.
- **Delete and Delete heading show in red (owner, 2026-10-20)** in every menu that has them,
  through `MenuItem.setWarning(true)`. The red comes from the `is-warning` class, so with Settings →
  Appearance → Native menus on, the desktop right-click menus may not show it (obsidian.md/help,
  Settings: native menus "will not be affected by your theme").

### Dragging (owner)

- **Desktop (1a):** drag items with the mouse, within and between sections. An item's notes move
  with it. In step two, headings drag too, each with its whole section (step two's design,
  "Dragging a heading").
  - A drag closes any open card first, the way a click elsewhere does **(call)**. An empty new
    item is removed then, and if it was the row being dragged, the drag ends. The cost: after a
    drag, a click reopens the card.
  - **The drop line (call)** shows under the visible item the dragged item will follow, or under a
    heading for the first place in its section, or above the first row for the top of the list.
    It passes over content the plugin leaves alone, since a drag changes only the order of items.
    Dropped where it already shows, the item stays as it is in the file.
  - **A link or picture in a title drags as itself (call),** as in any note, not the row.
- **Mobile (1b, owner):**
  - Hold an item and then move to drag it.
  - Holding an item row never opens a menu.
  - A swipe without a hold scrolls the list.
  - **The drop line works as on desktop (call).** A move drops where it shows, and an item
    dropped over its own place stays as it is in the file.
  - **A hold anywhere on an item row drags it (call),** its checkbox and any link in its title
    included, but not the open card. A tap on a link still opens it. A hold closes any open card
    first, as on desktop.
  - **The list scrolls at its edges while dragging (call),** so an item can go further than one
    screen. It starts only once the finger has moved more than 5 px since the lift, so a row
    held still at an edge doesn't scroll the list **(owner, 2026-10-27)**.
  - **A redraw while dragging ends the drag (call),** with nothing written, since the row the
    finger holds is gone: an outside change, or the removal of an empty item that closing the card
    started. The release that follows is swallowed too.

### Done and archived (owner)

- **The delay is 24 hours (owner).** The owner said exactly 24 hours. It is fixed, with no setting
  and no settings screen in step one **(call)**.
- **"Archived" is worked out, never written down.** It is computed from `✔` plus the delay.
  Nothing in the file changes when an item becomes archived.
- **"Show archived" in the pane's ⋯ menu (call; archived is the owner's word)** shows archived
  items again, gray, in place.
  - **It's also a ticked-checkbox icon in the pane's header (owner, 2026-10-27),** because the ⋯
    menu alone was hard to find on mobile. The icon is the same shape as the list's own
    checkboxes, so it reads as done items; an eye was tried first and read as unrelated to them.
    It toggles the same setting as the menu item, is blue while archived items show, as their
    checkboxes are, and its tooltip then says "Hide archived". It shows only on a list.
  - **An archived item's checkbox is blue (owner, 2026-10-27),** Obsidian's `--color-blue`, so
    it stands apart from an item ticked in the last day, whose checkbox keeps the accent color.
  - **It isn't remembered (owner, 2026-10-20).** It's off each time a list opens, and holds only
    while that view is open. Nothing is stored: not in the file, not in the view's state, and not
    in the app's local storage.
- **The view works out what's archived** when the list opens or redraws. It runs no timer
  **(call)**.

## Creating, renaming, moving and deleting lists

**Creating a list has three routes (owner):**

- Right-click a folder in the file explorer and choose New list (`workspace.on('file-menu')`). The
  list is created in that folder. On mobile this is a long-press on the folder, confirmed on an
  iPhone in the 1a checks; Android isn't checked.
- The "New list" command. It's in the command palette on desktop and mobile, and you can give
  it a hotkey under Settings → Hotkeys. The plugin sets no default hotkey, because Obsidian's
  plugin guidelines advise against it.
- The "New list" icon in the ribbon (`addRibbonIcon`).

**Where a new list goes (call):**

- From the command or the ribbon, a list goes where Obsidian puts new notes:
  `fileManager.getNewFileParent(<active file path>)`, which follows the "Default location for new
  notes" setting.
- The new file is called `Untitled list.md`, with a number added if that name is taken, compared
  without regard to case as macOS and iOS disks compare names. It holds only the marker.
- It opens in a new tab, as Obsidian's own New note does (observed in 1.14.4), straight into the
  list view with its title selected, so typing replaces it.

**An existing note becomes a list** with "Turn into list" (step two), which adds the marker to it.

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
  - One-off actions write at once with `vault.process`: tick, drag, delete, new item, new heading,
    rename heading, undo and redo. Obsidian's docs recommend `vault.process` "to avoid
    unintentional loss of data".
  - Before a one-off action writes, the view first saves pending typing (`TextFileView.save`), so
    the file already holds the typing and the guard doesn't refuse the write.
  - Typing that lands while an action waits to write makes it write nothing, since it was worked
    out without that typing **(call)**. The action then runs once more on the new text: a tick, a
    drag, a delete, a new item or heading, or a heading's name. The removal of an empty new item
    deletes it from the current text instead. An undo or redo isn't run again: it does nothing, and
    the typing is the newest step **(call)**.
    - If typing refuses it a second time, the action is dropped with no message **(call)**: the
      tick or move simply didn't happen, which the list shows, and a message mid-typing would only
      interrupt.
  - The write is guarded: it is applied only if the file's text is still what the view expects.
  - A write that fails shows "Couldn't save the change to this list." and isn't tried again. A view
    that still holds the change, with nothing typed since, reads the file again, as after an outside
    change, so it shows what the file holds. Typing since then stays in the view, and its own save
    writes it with the change, so the change can still reach the file.
- **The file is the only copy of the truth.** When the file changes from outside (Sync or an agent),
  the view redraws from it.
  - An editor that has focus isn't torn down.
  - An outside change inside the lines a focused editor writes, an item's notes or the list note,
    is overwritten by its next keystroke, so typing wins **(call)**. When the change moves the
    list note's lines so the editor can't tell where they are, it reads the note again instead.
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
  - Edits to the same list on two devices within one Sync cycle (about 10 s) can lose a change.
    Sync's merge reads a write made from an older copy as a deletion, and applies it. Obsidian's
    own editor loses text in the same way. Typing in an open card is covered by "Copy text" (see
    "Saving and outside changes"); a change made in the list itself is not.
  - The first row was checked on two devices in the 1a checks, with Sync paused on both: both
    marks were kept, with no conflict file, the view showed one done item, and the next untick
    removed both marks.
  - Since Obsidian 1.9.7, Sync's Conflict resolution setting can create a conflict file instead of
    merging. The setting is per device (same help page).
  - Conflict files show up as extra lists.
  - File recovery is the backstop.
- **Undo (1b, call):**
  - Cmd+Z and Cmd+Shift+Z step through the plugin's own edits, using the same guarded write.
  - They're keys only, with no Undo or Redo command **(owner, 2026-10-22)**, so without a keyboard
    the only undo on mobile stays the Undo button after a delete.
  - The history is cleared when the file changes from outside, so undo never throws away someone
    else's change.
  - Typing in a field makes one step for each time the field has focus. A write of the view's
    own or an undo between keystrokes starts a new step, and typing that ends where it began
    leaves none.
  - A new item's first edit, such as its title, or a new heading's name, with nothing between,
    joins the step that added it: one Cmd+Z takes the item or heading away, and Cmd+Shift+Z brings
    it back as it was. A new item or heading undone while still empty can't be redone, since it
    would come back empty.
  - Closing an empty new item or heading is a cancel, which leaves no step. A cancel that can't take
    its insert back exactly, such as after another edit to the list, clears the history, so neither
    an undo nor a redo brings back an empty item or heading with nothing left to close it.
  - Cmd+Z on an empty new item's open card, with focus outside its fields, closes the card, which
    removes the item.
  - The Undo button after a delete and Cmd+Z take the same step back, and Cmd+Shift+Z deletes again.
    Once Cmd+Z has taken the delete back, the button does nothing while the list is as Cmd+Z left
    it.
  - In a field, Cmd+Z is left to the browser's text undo, not the list's history. That doesn't take
    back the link to a picture pasted into the notes, since the browser doesn't count the plugin's
    insert as typing; Cmd+Z after leaving the field does (the 1b plan, Task 4, check 10).
  - The history holds 100 steps, and only the list's text: undoing a picture's link leaves the
    picture's file.
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
- **Accessible names (call):** only the icon buttons carry `aria-label`, since Obsidian shows every
  `aria-label` as a hover tooltip. A text field takes its name from a gray placeholder ("Title",
  "Heading", "Notes"), seen only while it's empty, and a checkbox from a hidden copy of its item's
  title.
- **Minimum Obsidian version:** set `minAppVersion` from the newest API used, going by each API's
  `@since` tag in `obsidian.d.ts`. Every device must run at least that version, mobile
  included. For step one that's 1.5.7, from `getFrontMatterInfo` (see "Verified facts").
- **Installing:** copy `main.js`, `manifest.json` and `styles.css` into
  `<vault>/.obsidian/plugins/princelists/`. The folder name must match the ID, or
  `onExternalSettingsChange` and similar methods aren't called (Manifest docs). Obsidian Sync takes
  the plugin to the other devices if that vault syncs installed community plugins.

## Implementation notes

### Opening and switching views

- **Don't call `registerExtensions(['md'])`.** It throws, because `md` is already registered
  (observed).
- **Leave `canAcceptExtension` at its default of `false` (observed).** Returning `true` would open
  every note clicked from a list pane in the list view.
- **Don't reuse the names Obsidian's view classes use at runtime** for a field or method of the
  view: a field initializer runs after `super()` and replaces Obsidian's own member. A field named
  `titleEl` broke opening a list. These are undocumented, read from the 1.14.4 app bundle:
  - `Component`: `_loaded`, `_events`, `_children` and `registerScopeEvent`
  - `View`: `onHeaderMenu`, `getSideTooltipPlacement`, `handleCut`, `handleCopy` and
    `handlePaste`
  - `ItemView`: `headerEl`, `titleEl`, `titleContainerEl`, `titleParentEl`, `actionsEl`,
    `backButtonEl`, `forwardButtonEl`, `moreOptionsButtonEl`, `leftSidebarToggleEl`,
    `canDropAnywhere`, `onMoreOptions`, `onMoreOptionsMenu`, `onGroupChange` and `onTabMenu`
  - `FileView`: `syncState`, `receiveSyncState`, `renderBreadcrumbs`, `createBreadcrumb` and
    `onDelete`
  - `EditableFileView`: `fileBeingRenamed`, `saveTitle`, `onTitleFocus`, `onTitleChange`,
    `onTitlePaste` and `onTitleKeydown`
  - `TextFileView`: `dirty`, `isPlaintext`, `lastSavedData`, `saving`, `saveAgain` and
    `loadFileInternal`
  - and the methods `loadFile`, `setData`, `saveImmediately`, `onModify`, `updateNavButtons`,
    `handleDrop` and `onTitleBlur`
- **The view implements** `getViewType`, `getViewData`, `setViewData` and `clear`.
- **Switching on `file-open` and `active-leaf-change` (call),** through one guarded check:
  - Take `workspace.getActiveViewOfType(MarkdownView)`. On `file-open(file)`, require
    `view.file === file`: the event also fires for embeds, canvas nodes and keyboard navigation in
    the file explorer (its doc: "The file could be in a new leaf, an existing leaf, or an embed").
  - Skip the note if the user chose Markdown for it in this pane **(owner, 2026-10-21)**: a
    `WeakMap<WorkspaceLeaf, WeakSet<TFile>>` from each pane to the files it was told to open as
    Markdown. "Open as Markdown" adds the file, and "Open as list" removes it.
    - The choice survives a rename or move because it's keyed by the file object, not its path:
      the vault's `rename` event (0.9.7) passes that same file with its new path.
  - Wait until the view's text has loaded: `TextFileView.data` is unset until then (observed).
  - Detect the marker from the editor's text, `getViewData()`, with `getFrontMatterInfo` and
    `parseYaml`.
    - Not from `data`: it waits for the save, up to 2 seconds after an edit, so it would still hold
      a marker the user just deleted.
    - Not from `getFileCache`: it returns `null` for a file that isn't cached yet, such as one Sync
      or an agent just wrote.
  - Then call `leaf.setViewState({ type: <list view type>, state: { file: file.path } })`.
- **Why both events:**
  - **Documented:** `file-open` is "Triggered when the active file changes", `active-leaf-change`
    is "Triggered when the active leaf changes", `TextFileView.data` is the view's "In-memory
    data", and `getViewData` "Gets the data from the editor".
  - **Observed in 1.14.4:** a switch made while the leaf is still loading its note is ignored. A
    note opening in the same tab has its text loaded when `file-open` fires. A new tab doesn't: it
    fires `active-leaf-change` once before its text loads and once after. So the first event that
    finds the text loaded switches. Reading the file instead, with `vault.cachedRead`, doesn't
    help, because the switch would still run during the load.
- **`active-leaf-change` fires on every file load in the active leaf (observed).** Without that
  record, it would push a pane straight back after "Open as Markdown". After the pane switches
  to Markdown by itself because the marker was removed, the marker is gone, so nothing switches it
  back.
- **Back history:**
  - `setViewState` records a history entry when the view type changes, so Back would land on the
    same note as Markdown (observed).
  - In the list view's `setState`, call super and then set `result.history = false`.
    `ViewStateResult.history` is documented as something the view fills in. That `false` keeps
    the entry out is observed, not documented: spike 1's check 4 confirmed it in 1.14.4, and an
    Obsidian that recorded the entry anyway would cost only one extra Back stop.
  - Kanban passes an undocumented `popstate` flag instead. That's not allowed here.
- **A new list opens with `setViewState({ type: <list view type> })`,** never with `openFile`.
- **If the marker is gone in `setViewData` (owner, 2026-10-21):**
  - **On a reload** (`clear` is `false`, as when the file changes on disk), switch the pane to
    Markdown with `leaf.setViewState`, not `openAsMarkdown`: the user didn't choose Markdown.
  - **On a load** (`clear` is `true`: opening, Back, Forward, a restore), don't switch. Show the
    note's name, "This note isn't a list" and an "Open as Markdown" button that calls
    `openAsMarkdown`, since that is the user's choice.
  - **Why the split:**
    - A `setViewState` from inside the leaf's own load doesn't take effect (observed).
    - Every list-to-Markdown switch records a Back entry for the list view (observed). Only the view
      switched to can clear `ViewStateResult.history`, and that's Obsidian's `MarkdownView`.
    - No documented API avoids either. So a switch on load, from there or later, would record the
      entry that Back just left, and Back would loop on the note.
  - **The accepted cost:** after a switch on reload, Back stops once on the note, which shows the
    message. One more Back reaches the previous note.
  - **What's documented:** `clear` means "a different file is being opened". That a reload passes
    `false` and every load passes `true` is observed.
- **On restart, background tabs may be deferred views.** Check `instanceof` before calling into
  the view.
- **Pane menu:** add the list view's own items by overriding `onPaneMenu`. Use `file-menu` only for
  "Open as list" among the view's own items, filtered on `leaf?.view instanceof MarkdownView`.
  - The `file-menu` item also requires `view.file === file`, because `file-menu` also fires for
    link menus, where the file is the link's target **(call)**.
- **Switching to Markdown uses the view type `'markdown'`,** which obsidian.d.ts names in the doc
  comment of `WorkspaceLeaf.isDeferred` ("like MarkdownView for the `markdown` type").

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
- **An outside change that edits lines both above and below the item being typed in (call)** loses
  track of the item, since the line mapping finds a single changed run. The card says the list
  changed elsewhere and closes once it loses focus. What was typed until then is usually in the
  file. When it isn't, the notice instead offers "Copy text", which copies the field's text, and
  stays until dismissed (owner, 2026-10-22). Typed notes count as in the file only as whole lines,
  and a typed title only as an item's title **(call)**.

### Rendering notes in the card

- **Call `MarkdownRenderer.render(app, markdown, el, <list path>, component)`** with one child
  `Component` per rendered block: `addChild` it, then `removeChild` it on re-render or close.
  Without a Component, embeds don't load and Obsidian logs a memory leak (observed).
- **The rendered output does nothing on click.**
  - Delegate `a.internal-link` clicks, once on the view for every rendered block, to
    `workspace.openLinkText(linktext, file.path, Keymap.isModEvent(evt))`, as Kanban's
    `src/helpers/renderMarkdown.ts` does. Like Kanban, read `linktext` from the link's `data-href`,
    or its `href` when it has none: a Markdown-style link's `href` can be URL-encoded.
  - No page previews on hover **(owner, 2026-10-20)**. They would need the `hover-link` event,
    and Obsidian documents no payload for it, so they wait until it does (see "Not in step one").
  - On desktop (`Platform.isDesktop`), handle `contextmenu` on `a.internal-link`: create a `Menu`,
    let `workspace.handleLinkContextMenu(menu, linktext, file.path)` fill it, and show it with
    `menu.showAtMouseEvent(evt)`. The method returns a `boolean` whose meaning isn't documented,
    so don't depend on it.
- **Disable `.task-list-item-checkbox` in rendered notes.** Otherwise it ticks on screen but saves
  nothing. Step two enables a card's boxes only when they match the checklist parsed from its
  notes, in number and in each ticked state; a box in a callout, an embed or a `%%` comment puts
  them out of step, and then every box stays disabled.

### Touch on mobile

- **iOS WebKit fires no `contextmenu` event** (MDN compat data). Obsidian makes one itself on iOS
  after a still hold, 800 ms by its code. A device confirmed the event (its haptic comes with it);
  the 800 ms wasn't measured. A hold on Android isn't checked.
  - Because holding only ever drags, item rows must not open a menu, and a heading opens its menu
    on a tap. So on mobile, cancel `contextmenu` on rows and headings, in the capture phase.
  - On an iPhone, a hold opens no menu and selects no text, and the tap that ends it is swallowed
    ([1a checks](../notes/2026-10-22-1a-checks.md)).
  - After a canceled hold, the next click is swallowed, as spike 2 does after a lift: WebKit still
    sends one when the finger lifts. The next `touchstart` clears the flag.
  - Obsidian's own haptic on a hold can't be turned off (no documented API), and it is accepted.
- **Dragging uses Pointer Events with a hold timer.** Kanban uses 500 ms, canceled if the finger
  moves more than 5 px first. Spike 2 confirmed both values on an iPhone, with the rows'
  `-webkit-user-select: none` and `-webkit-touch-callout: none`: the maintainer keeps 500 ms
  (`docs/superpowers/notes/2026-10-21-spike-touch.md`).
  - Once a row is lifted, a non-passive `touchmove` handler calls `preventDefault` to stop
    scrolling.
  - **The edge scroll (call)** starts 56 px from the top of the list or from where it stops being
    visible, and speeds up linearly to 12 px a frame at the edge and beyond.
  - Kanban's `src/dnd/managers/DragManager.ts` is the reference.
  - Obsidian's own drag manager isn't public.
- **A long-press on a folder in the mobile file explorer reaches `file-menu`,** with source
  `file-explorer-context-menu`, so it offers "New list" (confirmed on the device in the 1a
  checks).
- **The list scrolls in an element of its own,** inside the view's `contentEl`, so nothing relies on
  Obsidian's undocumented `overflow` on `.view-content`. It fills `contentEl`.
- **The list is laid out as a Markdown view is (owner, 2026-10-27):** the scrolling element takes
  the documented `--file-margins` as its padding, and what it holds sits centered at the documented
  `--file-line-width`, so titles and rows line up with a note's. That's always the readable line
  width: no documented API reads Obsidian's "Readable line length" setting, so with it off a
  note fills the pane while a list doesn't.
- **Put the floating "+" outside the scrolling element,** and check it against the mobile navbar
  and keyboard.
  - It sits on the view's `containerEl`, which the plugin's own class makes `position: relative`.
  - It keeps above mobile's floating navbar with Obsidian's `--view-bottom-spacing`, as Bases
    does **(call)**. The variable is undocumented, read from 1.14.4's `app.css`, and unset on
    desktop. If Obsidian drops it, the "+" sits lower on mobile, under the floating navbar, and the
    edge scroll, its second user, takes the bottom of the view for the bottom of what is visible,
    so dragging toward the navbar scrolls late.

### Where `✔` goes

1. Set aside trailing whitespace: Tasks trims the line before it strips the block link.
2. Strip a trailing block ID (` ^id`).
3. Strip trailing Tasks fields and `#tags`, using Tasks' full set of signifiers:
   🔺⏫🔼🔽⏬🛫➕⏳⌛📅📆🗓✅❌🔁🏁🆔⛔.
   Like Tasks, accept an optional U+FE0F after each signifier.
4. Insert ` ✔ YYYY-MM-DD HH:mm` there, then put back what was stripped.

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
  point below is checked on desktop before it is relied on: opening in plan Task 2's spike,
  writing and opening from a second vault in Task 8, and rendering and renaming in Task 9.
- **The result:** every check passed in 1.14.4, including another app's edit showing in the view,
  so none of the fallbacks below was needed.
- **The installer:** opening a file from outside the vault "requires the latest installer" (1.14
  changelog). Check that first, so an old installer isn't mistaken for a failure of the plugin.
- **A fallback below is a proposal.** When a check fails, the builder records it with its
  proposed fallback, and the owner decides at the checkpoint of the task where it failed. Nothing
  falls back without the owner's decision.
- **The marker (call):** it is read from the note's text, as for every list ("Opening and
  switching views"). So it doesn't matter whether the metadata cache covers outside notes.
- **Opening (call):** the same switch on `file-open` and `active-leaf-change`, and `setViewState`
  with `file.path`. The check is that it opens the note in the list view and restores it after a
  restart. Proposed fallback: outside notes open as Markdown, like ordinary notes.
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
  - Seen in 1.14.4: the file is renamed in its own folder, and then its tab closes. Obsidian's own
    Markdown view does the same when an outside note is renamed.
- **Telling an outside note apart (call):** the fallbacks would need it, and the picture refusal
  does.
  - `vault.getAbstractFileByPath(file.path)` can't do it. Its doc says it finds a file "inside the
    vault" (since 0.11.11), but spike 1 found that it returns the outside note too (observed in
    1.14.4).
  - The only documented way is `file instanceof TExternalFile`. It needs `minAppVersion` 1.14.4,
    and raising it is the owner's call if a later fallback needs it. `TExternalFile` is
    `@since 1.14.4`, so it's not in the API before that, and where the class is missing at
    runtime, `instanceof` throws a `TypeError`. The `obsidianmd/no-unsupported-api` lint rule
    doesn't check `instanceof`, so it wouldn't catch that (tested with `eslint-plugin-obsidianmd`
    0.4.2 on 2026-10-20).
  - The picture refusal tells them apart by `file.parent === null` instead, observed in 1.14.4 as
    the rename check does **(call)**: `TExternalFile` is newer than `minAppVersion` 1.5.7.
- **Outside notes leave `minAppVersion` at 1.5.7:** nothing here uses a newer API.

## Testing and owner checkpoints

- **Manual testing uses a test vault on desktop and mobile,** so far macOS and an iPhone. Windows,
  Linux, Android and the iPad aren't checked yet.
- **Many manual checks run scripted:** through Obsidian's CLI on desktop, and through the mobile
  browser engine's web inspector (Safari's, for the iPhone), with synthetic touch. The owner checks
  by hand what needs a finger or an eye, such as holds, scrolling, the keyboard and the flash.
- **Spikes come first, and each one stops for the owner:**
  1. The flash when a list opens.
  2. Hold-to-drag on mobile: it must not break scrolling or trigger Obsidian's long-press
     menu. The owner sets the pass bar.
- **Then 1a, then 1b.**
- **Before installing in a vault with real notes,** test once in the test vault with Tasks and
  Kanban installed. Kanban patches how notes open, so check that the two plugins don't fight.
- **Check a Sync conflict once:** edit the same list on both devices while offline, then compare
  the result with the table above.
- **The last two ran in the 1a checks** ([notes](../notes/2026-10-22-1a-checks.md)). Their results
  are under risk 5 below and under the Sync conflict table above.

## Risks to check during the build

Each has a result from 1a's spikes and checks, and 1b's for the `✔` glyph on an iPhone.

1. **The flash** when a list opens.
   - **Result:** about 10 ms, which the owner couldn't see on macOS or an iPhone.
2. **Back history:** whether `result.history = false` really keeps the extra entry out.
   - **Result:** it does, in 1.14.4, with one stop after the pane switches to Markdown by itself.
3. **The mobile gesture:** hold-to-drag, scrolling, and Obsidian's long-press menu all start the
   same way.
   - **Result:** a hold opens no menu and selects no text, and its tap is swallowed. Spike 2's
     drag kept scrolling working. Obsidian's haptic stays (see "Touch on mobile").
4. **Obsidian's parser vs. CommonMark** for the tested cases, in reading view: the title becoming
   a heading, lazy lines, and the odd markers.
   - **Result:** in all ten fixtures, reading view shows as many items as the plugin parses, on
     macOS and an iPhone, with notes inside their items. The title that becomes a heading renders as
     CommonMark has it.
5. **Kanban's patch** interfering with the plugin's switch to the list view.
   - **Result:** with Tasks and Kanban on, lists still open as lists from every route tried, and
     Back still works.
6. **The `✔` glyph** may show as an emoji on some systems. That's harmless, but check it reads
   well.
   - **Result:** on macOS it reads as a text check mark in reading view. On an iPhone it shows as
     Apple's gray check mark, which reads well (1b checks).
7. **Notes outside the vault:** whether opening, rendering, writing and renaming work for them.
   - **Result:** on macOS, all of them work, and so do links.

## Left to the builder

- **Display:** how existing dates and tags show in step one.
- **Editing:** keyboard details beyond Enter, Escape and undo.
- **Parsing:** whether to keep commonmark.js if pre-masking `%%` and `$$` gets awkward.

## Verified facts

Checked 2026-10-20.

- **Obsidian API** (`obsidian.d.ts`, obsidian-api 1.14.4):
  - views: `ItemView`, `FileView.canAcceptExtension`, `TextFileView` ("by default, this view only
    saves when it's closing"; `requestSave` waits 2 seconds), `View.onPaneMenu`, `ViewStateResult`
    ("Set this to `true` … recorded in the navigation history")
  - keys: `View.scope` (1.5.7), "to register hotkeys for when the view is in focus", and
    `Scope.register`, where `Mod` "translates to `Meta` on macOS" and a handler may "return `false`
    to automatically preventDefault" (checked 2026-10-27)
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
    - `FileManager.generateMarkdownLink` (0.12.0), which generates a link "based on the user's
      preferences" (checked 2026-10-22)
    - `Vault.createBinary`, `Vault.process` (1.1.0) and `Vault.on('modify')`
    - `TExternalFile` (1.14.4): "Represents a file that is outside the Vault. Can be used with the
      vault API just like any other file."
    - `Vault.getAbstractFileByPath` (0.11.11), which gets "a file or folder inside the vault",
      though it returns a note from outside the vault too (observed in 1.14.4)
  - settings: `getSettingDefinitions` (1.13.0), `onExternalSettingsChange` (1.5.7)
  - the minimum version: the `@since` tags decide it. The newest among the APIs step one uses is
    1.5.7, for `getFrontMatterInfo` (and `FileManager.getAvailablePathForAttachment` and
    `View.scope` in 1b). The others are older or untagged, and every untagged one is already in
    the 1.5.7 `obsidian` package. With `minAppVersion` 1.5.7, the `obsidianmd/no-unsupported-api`
    rule passes a file that calls each of these APIs, and at 1.5.6 it flags the three 1.5.7 ones
    (checked again 2026-10-27). `MenuItem.setWarning` and `Workspace.handleLinkContextMenu` carry
    older tags but first appear in the package at 1.10.0. Nothing has been tried on an Obsidian
    older than 1.14.4.
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
  - a `setViewState` made while a leaf is still loading its note being ignored
  - `Vault.getAbstractFileByPath` returning a note from outside the vault
  - `setViewState` history entries
  - `TextFileView` reloading and merging on outside changes
  - `MarkdownRenderer` needing a Component
  - `file.parent` being `null` for a note outside the vault
  - the `--view-bottom-spacing` CSS variable, set on an iPhone and unset on macOS
  - iOS (1.14.5) showing a drag's types only as `Files` until the drop
  - Obsidian's own `dragover` listener making a drop a move unless the view sets `dropEffect`
  - the browser not counting the plugin's `setRangeText` insert as typing for its undo
- **Not yet measured on a device:** the 800 ms of the iOS `contextmenu` hold; 1a confirmed the
  event itself. 1a also confirmed a folder long-press on an iPhone reaching `file-menu`, and, on
  macOS, how a note from outside the vault behaves (opening, rendering, writing, renaming, and
  edits from another app).
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
