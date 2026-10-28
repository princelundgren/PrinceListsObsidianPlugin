# Step two checks

Plan step two, Task 16, Steps 1 and 2. Every check that was run passed, apart from design risk 3,
which found what the design expected might happen and goes to the owner.

- **How they ran:** a scripted suite, run in a test vault through Obsidian's CLI (`obsidian eval`)
  on macOS and through the web view's DevTools protocol on an Android emulator. It drives the
  views through their DOM, with synthetic mouse, touch and key events, and reads the files back
  byte for byte.
- **Result:** 211 checks on macOS and 192 on Android, all passing, in one run of the whole suite.
  Some checks are desktop-only (mouse dragging, right-click menus, Tasks and Kanban), and some are
  mobile-only (holding, tapping a heading, edge scrolling).
- **One-off checks with real input,** outside those counts, where a synthetic event can't stand in
  for a person: clicks and key presses through the CLI's `dev:cdp` command on macOS, and `adb` taps,
  text and key events on Android. Each is marked "real input" below.
- **Versions:** Obsidian 1.14.5 on macOS 27 and 1.14.4 on Android 16. The plugin was built from
  `main` after #117 merged.
- **The iPhone checks weren't run.** The plan's Step 1 asks for every manual check again on the
  iPhone. The owner set that aside for now, and the Android emulator stands in for mobile here.

## Step 1: Tasks 1 to 15 and 17 to 23

- **Turn into list (Tasks 1 and 4b):** with and without frontmatter, and with empty frontmatter,
  only the marker's lines are added. A line typed just before the command reaches the file, and
  the view switches once the metadata cache has the marker (risk 6). Frontmatter that is a YAML
  sequence or broken YAML, or a `princelists: false` spread over two lines, is refused with its
  message and the file is unchanged. Spread over two lines, `true` opens as a list and nothing is
  written. The file menu offers Turn into list on a note, not on a list, and New list on a folder.
  A CRLF note turned from an open editor ends up LF: an editor save alone, without the command,
  does the same.
- **Star (Task 2):** goes before trailing tags, hidden in the title field and kept when the title
  is retyped. The row shows Lucide's star. Unstarring works, and Cmd+Z undoes the unstar.
- **Empty list and Cmd+Enter (Task 3):** the hint shows centered in an empty list, goes with the
  first item and comes back with the last. A list of only archived items shows no hint. Cmd+Enter
  adds an item, below an open card from its title or notes. It adds nothing in a Markdown note, or
  once the marker is removed elsewhere.
- **Checklists (Task 4):** five boxes, nested and numbered among them, each tick only their own
  line, and Cmd+Z unticks. A box in a callout or embed is disabled while a box in another block
  still ticks (risk 1). With `%%` in the notes every box is disabled.
- **Cmd+F (Task 5):** opens the list's own filter, not Obsidian's search, on desktop. On mobile
  the Find in list command does. Ticking, dropping, "+" and opening a card work while filtering.
  Escape shows every row, and a list reopens unfiltered. In a Markdown note Cmd+F opens
  Obsidian's search (risk 2, desktop).
- **Headings (Tasks 6 and 7):** a heading drags its whole section, one Cmd+Z restores it, and a
  drop in place writes nothing. No drop line shows above the first section's items. A filtered
  move takes hidden rows along, and a list whose layout can't take the move says so and writes
  nothing. On mobile a hold drags a heading and a tap opens its menu (risk 8). The collapse
  arrow is hidden on desktop until hovered, and always shows on mobile. Collapsing writes nothing.
  A collapsed section stays collapsed when it's dragged or lines are added above it, and again
  after a filter shows its matches. A drop or New item under a collapsed heading expands it, and
  reopening the list opens every heading.
- **When (Task 8):** a click on the date lands on the transparent date input (risk 5). A day
  chosen there goes after tags and before a block ID, a star stays before it, a change replaces it
  in place, and clearing it removes it and its space. Cmd+Z takes a When back. Rows show Today,
  Tomorrow, a weekday or a date; the weekday and date follow Obsidian's language.
- **Links and pictures (Task 9):** links in a row's title, a card's notes and the list note open
  their note without opening a card. A picture in a card's notes shows.
- **Schedule view (Tasks 10 and 11):** groups, order, list names and days are right, with an
  overdue item in Today showing its date. Setting a When, ticking, renaming and deleting a list
  elsewhere update the open view. A tick writes to its list, and a repeating item shows its
  message and writes nothing. A click opens the list with the card open and reuses that tab, and
  typing not yet saved there survives a tick from the view. A tick right before a rename lands in
  the renamed list. A tick right before a delete changes no other file.
- **Risk 7:** 300 lists of 30 items, with 50 other notes. The view reads only the lists, each once,
  and draws its rows in about 230 ms on both. An edit in one list updates it in 12 ms on macOS and
  17 ms on Android.
- **A list inside another note (Tasks 12, 13 and 15):** in reading view and Live Preview the block
  shows the list's name as a link, its headings, items, stars and dates, and none of its notes or
  archived items. Ticking, editing elsewhere, and a list in another pane all stay in step. Each
  gray line shows for its case. In a block, a title's field saves only the title, two new items go
  to the top, an empty one adds nothing, and the trash button deletes with Undo. Cmd+Z in a list
  view doesn't undo a block's edit. Items drag within and between sections with their notes,
  headings don't drag, and a hold opens no menu on mobile. A tick and a drag leave the note's
  source unchanged, and so do a click and typing with real input on both (risk 4).
- **Risk 3, found:** renaming a list doesn't update the `[[link]]` inside a `princelists` block.
  The block then shows that `[[old name]]` doesn't lead to a note. This goes to the owner, as the
  design says.
- **Row dragging on a host (Task 14):** an item drags with its notes, within and between
  sections, and Cmd+Z puts it back. A drop in place writes nothing and leaves no drop line or card.
  On Android a held row near the bottom edge scrolls the list, and a tap after a drag opens the
  card.
- **Format bar (Task 17):** Strikethrough toggles and keeps the selection, and Underline wraps it
  in `<u>`. Mod+B and Mod+I work on desktop. Every button has its icon in 1.14 (risk 12 asks about
  1.5.7), the notes draw struck through and underlined (risk 11), and on a phone the bar wraps
  onto two lines with each group whole.
- **Right-click menus (Task 18):** on desktop the background menu has the list's five actions, and
  New item lands at the end of the section clicked in, from between sections, the list note, or
  below the last row. New heading, with real input on macOS, lands after the section. Edit in
  Markdown opens at the section's last line. A row, a heading, the filter field and a card's field
  keep their own menus. On Android a heading's tap menu has Edit in Markdown, which opens at the
  heading, and holding the background opens nothing.
- **Notes a piece at a time (Tasks 20 to 23 and #116):** a paragraph, a table, a callout, a nested
  checklist item and a numbered item each open alone, and a list with a callout inside opens whole
  (risk 10). Typing changes only that piece's lines. A box ticks while another piece is open, and
  another piece opens at once. The strip adds a new piece after an empty line. Enter continues
  bullets, nested bullets, checklists and numbered lists, moves an empty nested item out and ends
  the list on an empty top-level item. Up and Down walk the pieces, and Backspace in an empty piece
  removes it. An Enter that confirms a composition starts no item. With real input on Android's
  on-screen keyboard, Enter continues a bullet, Backspace removes an empty piece, and the keyboard
  stays up. The list note's pieces work the same way, and typing `- [ ] x` at its top level
  warns. A box in the list note ticks its own line, and Cmd+Z unticks it.

## Step 2: alongside Tasks and Kanban

On macOS, with Tasks 8.6.0 and Kanban 2.0.51 on:

- **A Tasks query** with `scheduled on` finds the item whose When is that day. `done` finds a
  starred done item, and `not done` finds the three open ones.
- **Kanban** still opens its board as a board, and a list still opens as a list.

## Not checked

- Every check on an iPhone, including dragging and the keyboard in iOS's WebKit.
- The native date picker opening (risk 5): the checks set the date input's value.
- Cmd+F on mobile with a hardware keyboard (risk 2), and Cmd+K making a link.
- A Japanese keyboard confirming a word with Enter on a real device. Only the composition flag on
  the event was checked.
- Dropping a picture on a card's notes, and a note from outside the vault.
- Risks 9 and 12 by hand: the byte-for-byte section moves are pinned by the unit tests, and the
  two icons weren't checked in Obsidian 1.5.7.
- From the plans' manual steps: a swipe on a block scrolls the note (Task 15), right-clicking a
  link shows its own menu (Task 18), the caret lands where a piece was clicked (Task 21), and the
  collapse arrow appearing on hover (Task 7).
