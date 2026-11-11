---
status: building
verified: 2026-11-11
governs: [src/**, styles.css]
tracking: ["#79"]
---

# PrinceLists for Obsidian: selecting several rows

Sorting a list means moving many items under the headings they belong to, adding headings and
moving headings. Today each of those is one row at a time: a long grocery list sorted into kinds
of food takes one drag per item, and a drag from the top to the bottom holds the pointer while
scrolling past every row between. This design selects several items and headings and acts on them
together: drags them as one block, moves them under a heading picked from a list, and ticks, stars,
dates or deletes them (#79). Mobile gets all of it, not a lighter version: sorting a list must be
possible with only a phone at hand **(owner)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-07, and **(owner, 2026-11-11)** after trying
the first build; **(call)** means the designer did, and a builder may revisit it. Step one's rules
still hold: an edit replaces only the lines it concerns, nothing is written in the background, and
only documented Obsidian APIs are used.

**Keys:** Cmd in this design means Obsidian's `Mod` key, which is Ctrl on Windows and Linux.
**Mobile** means phones and tablets used by touch, as in step one; a mouse or pen on a tablet is
#126's.

## At a glance

- **One way of selecting, on desktop and mobile (owner, 2026-11-11).** Hold a row and let go
  without moving, or pick Select in its menu, to start selecting; on desktop Cmd+click,
  Shift+click, Shift+Up and Shift+Down start it too **(owner)**. While selecting, a click or a tap
  adds or removes a row, and a bar at the bottom holds the actions **(owner)**.
- **Dragging a selected row drags the whole selection** as one block. A selected heading brings its
  section **(owner)**.
- **Move to heading…** sends the selection under a heading picked from a list, with no drag
  **(owner)**.
- **Tick, star, set a date and delete** act on every selected item at once **(owner)**, and each
  shows an Undo message **(owner)**.
- **Only in the list view (owner).** Not in the Schedule, nor in a list inside another note. Tags
  are their own design ([filtering by tag](2026-11-07-tag-filter-design.md)).

## What the selection is

- **Rows and headings,** in the list view. The open card's item counts as selected, as it does
  today ("Selecting and adding" in step one): it is where a range starts.
- **One selected row is enough (owner, 2026-11-11).** Selecting is one mode on desktop and mobile,
  so the bar, the selection's menu and the Undo message act on whatever is selected, one row
  included.
- **A selected heading is its own row (call),** on desktop and mobile alike: its items aren't
  selected with it. It brings its whole section when dragged, as a heading drag does, and the
  actions skip it ("The actions").
- **Only shown rows can be selected (call).** A range skips rows hidden by a collapsed heading,
  hidden archived items, Show starred only and Cmd+F's filter. A selected row that becomes hidden,
  such as by collapsing its heading, a filter, or a tick with "Hide ticked items after" set to at
  once, leaves the selection, so no action reaches a row that can't be seen **(call)**. A selected
  heading still brings its hidden rows when dragged, as a heading drag does.
- **Selected rows are marked as Obsidian marks selected files** in its file list,
  `--nav-item-background-selected` behind the row and `--nav-item-color-selected` for its text
  ([Navigation](https://docs.obsidian.md/Reference/CSS+variables/Components/Navigation)). A run of
  selected rows reads as one block, rounded only at its ends **(call)**; a heading's or an
  untouched block's margin still shows as a gap within a run. Checked in Obsidian's
  default theme in light and dark mode. Assistive technology hears which rows are selected and how
  many: rows hold a checkbox and headings have `role="heading"`, so `aria-selected` alone isn't
  valid on them, and the builder names the pattern used in the pull request **(call)**.
- **It follows its rows through the view's own edits,** as a collapsed heading follows its line
  (step two, "Collapsing a heading"). A change from outside keeps the rows the view can still find
  and drops the rest **(call)**.
- **It's never written to the file and isn't remembered (call).** Closing the list ends it.
- **It ends** with Done, Escape, or removing the last selected row **(call)**. A click or a tap on
  empty space keeps it, so a near miss between rows doesn't lose it **(call)**. An open menu or
  dialog takes the first Escape, and Escape in a text field is the field's **(call)**. Once it
  ends, a click opens a card again.

## Starting to select

- **Before selecting, a plain click opens the card, as today (owner),** and a click on the
  checkbox or beside it ticks that one item.
- **Holding a row and letting go without moving (owner; with a mouse, owner, 2026-11-11).**
  - **By touch,** today that lifts the row and puts it back, writing nothing, so the gesture is
    free. "Without moving" means the finger never passed the drag's 5 px tolerance after the lift
    (`armed` in `src/view/drag-touch.ts`), so a lift that moves and comes back still drags
    **(call)**. A hold that moves still drags a single row.
  - **With a mouse,** a press held as long as the touch hold (`HOLD_MS` in
    `src/core/touch-drag.ts`) and let go within the same tolerance **(call)**. Once the hold time
    is reached the row shows it **(owner, 2026-11-11)**, lifted as a touch hold lifts it **(call)**.
    Moving past the tolerance drops the lift and selects nothing, and moving far enough starts the
    browser's drag, which drags the row as today. The click that follows the release opens no
    card. Only the main button with no modifier counts, and only on a row's or a heading's own
    area: not on its checkbox or the zone beside it, a link, the collapse arrow, a field or inside
    the open card **(call)**.
- **Select, first in a row's or a heading's menu (owner, 2026-11-11; step one, "Item actions"):**
  the right-click menu **(owner, 2026-11-11)**, and a card's ⋯ and the heading menu on mobile
  **(call)**. It starts selecting with that row, or adds it while selecting, and shows only while
  that row isn't selected: a selected row's right-click opens the selection's menu instead
  **(call)**. The ⋯ of a new empty item has no Select, as selecting it would remove it **(call)**.
- **Cmd+click adds or removes a row (owner), and Shift+click selects every shown row between the
  anchor and the click (owner);** either starts selecting **(owner, 2026-11-11)**. The anchor is
  the open card's item, or the last row clicked, tapped or held **(call)**. A second Shift+click
  replaces the range rather than adding to it, and a Shift+click with no anchor selects that row
  alone, as Cmd+click does **(call)**.
- **Shift+Up and Shift+Down grow or shrink the range from the anchor (owner),** and start selecting
  **(owner, 2026-11-11)**, while the list has focus and no field does; with no anchor they do
  nothing. In a card's title or notes they keep selecting text. Moving between rows with the arrows
  alone, and opening a card from the keyboard, are #125's **(call)**.
- **With a card open,** each of these closes it, and the card's item and the row are both selected
  **(call)**. This changes step one's "while a card is open, a click outside it only closes it" for
  these only **(owner)**.

## While selecting

- **A click or a tap on a row or a heading adds or removes it (owner; on desktop, owner
  2026-11-11),** and one on a heading doesn't open the heading menu. Cmd+click does the same.
  Shift+click, and holding another row and letting go, select every shown row between it and the
  anchor, as a first Shift+click does **(call)**. A click or a tap on a link in a title still opens
  it **(call)**.
- **Each row's checkbox shows as a selection circle,** and a click or a tap on it or beside it
  selects, so nothing is ticked by mistake.
- **A bar replaces the floating "+" at the bottom of the pane:** "5 selected" with Done, and Move
  to, Tick, Star, Date and Delete. On desktop it takes the same place whether or not the floating
  "+" shows there, and the "+" in the pane's header hides **(call)**.
- **Right-click on a selected row** opens the selection's menu **(owner)**; on a row outside the
  selection it opens that row's own menu, as today, and leaves the selection **(call)**.
- **Dragging a selected row drags the whole selection** ("Dragging the selection").
- **With a card open,** such as one a row's own menu opened, a click or a tap outside it only closes
  it, as step one's "while a card is open, a click outside it only closes it" says **(owner,
  2026-10-27)**; Cmd+click and Shift+click still select, as in "Starting to select" **(call)**.
- **Cmd+Enter adds the new item below the last selected item** in list order **(call)**, and
  selecting ends as its card opens. With only headings selected it adds one as "+" does.
- **Cmd+click on a link** in a title still opens it in a new tab, as Obsidian does: the link wins
  over selecting **(call)**.

## The bar

- **Its buttons (call):** Move to opens the heading picker and Delete deletes, as the menu's
  entries do. Tick, Star and Date each open a small menu of the selection menu's entries for them,
  so a mixed selection gets both Tick and Untick. A button whose entries all hide, such as Tick
  with only headings selected, is disabled; Move to is disabled while a heading is selected.
- **Sized for a finger (owner, 2026-11-11):** each button, Done included, takes at least 48 by 48
  CSS pixels, with at least 8 between them **(call)**. That meets Apple's 44 by 44 points
  ([Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)) and Android's
  48 by 48 dp with 8 between
  ([Touch target size](https://support.google.com/accessibility/android/answer/7101858)).
  Delete sits apart at the far end, past a divider, so a near miss on Date doesn't reach it
  **(call)**. The bar is the same on desktop.
- **Done ends selecting,** and so does Delete or removing the last selected row **(call)**. Other
  actions keep the selection, so several can follow each other.

## Dragging the selection

- **Dragging a selected row drags every selected row (owner);** dragging a row outside the
  selection drags that row alone and ends selecting **(call)**.
- **What lifts (call):** the row under the pointer or finger, with the number of rows it carries.
  The other selected rows stay in place until the drop redraws the list, as only a heading lifts
  in step two's section drag on mobile.
- **The rows land together at the drop line (owner):** the loose items in file order, then the
  sections in file order **(call)**, from whichever sections they came from. Loose items first
  keeps them out of a moved section.
- **A selected heading brings its whole section (owner),** as a heading drag does. Its items that
  are also selected come once.
- **Where it can drop (call):** a selection of items drops wherever an item drops, before any
  hidden rows after the row above, as step one's drops do. One with a heading in it drops where a
  section drops (step two, "Dragging a heading"): its loose items land at the end of the section
  above, after its hidden rows, so nothing lands in another section's middle.
- **The file (call):** one write moves every selected block's lines as they are. Each moved section
  goes through step two's rule for a section move: if it would change how the rest of the list
  reads, one empty line goes before its heading, and if that doesn't help, nothing is written and a
  message says so. Every block goes through step one's check (`src/core/edit-check.ts`). One Cmd+Z
  puts it all back.

## The actions

- **The selection's menu** opens with a right-click on a selected row ("While selecting"), and the
  bar's Tick, Star and Date open parts of it ("The bar").
- **Move to heading… (owner)** opens a picker, Obsidian's `SuggestModal`, that lists "Top of the
  list" and then the list's headings in order, and narrows as you type **(call)**. A pick sends the
  selected items to the end of that section, after its last item, as the background menu's New item
  places one (step two, "Right-click menus") **(call)**; "Top of the list" sends them to the end of
  the part before the first heading. A heading name used twice shows its place, such as "Frozen,
  2 of 2" **(call)**. A collapsed target section expands, as step two's adding does. It shows only
  while no heading is selected, and in a list with headings: sections reorder by dragging
  **(call)**. Items under the picked heading that are selected move to the end too.
- **Tick and Untick, Add star and Remove star (call)** show by what the selection holds: Tick
  while any selected item is unticked, Untick while any is ticked, both for a mix. Each changes only
  the items that need it. A repeating item, which can't be ticked here today, is skipped, and a
  message says how many were.
- **Set date to today, Set date to tomorrow, Set date… and Remove date (call),** as on one item. Set
  date… can't open a card for several items, so it opens a date picker of its own, titled "Set
  date" with the buttons Cancel and Set **(call)**. It is a `Modal` with a date input, which opens
  the platform's own date picker when the user clicks or taps it.
- **Delete (call)** names what goes, such as "Delete 5 items" or "Delete 4 items and 1 heading", in
  red as today. A selected heading goes and keeps its items unless they're selected too, as Delete
  heading does.
- **Actions apply to items only (call):** a selected heading ticks, stars and dates nothing, and an
  entry with nothing to act on hides.
- **One-row entries drop out (call):** New item below, New heading below, Rename heading and Edit
  in Markdown.
- **Each action is one write and one Cmd+Z step (call),** and follows step one's "Saving" as a
  one-off action: typing that lands while it waits makes it run once more on the new text.
- **Every group action shows an Undo message (owner),** on desktop and mobile: a move, a drag, a
  tick, a star, a date or a delete. Its button takes the same step back as Cmd+Z, as the message
  after a delete does today. Without it, a phone could never take back a mistaken group move,
  since undo there is otherwise only the message after a delete (step one, "Undo").

## Not in this design

Left out on purpose, each for its reason:

- **The Schedule and lists inside other notes:** sorting happens in the list itself **(owner)**.
- **Tags:** their own design.
- **Moving between rows with the arrow keys alone, and Cmd+A:** #125 covers keyboard reach, and
  selecting everything is a later step once it's asked for **(call)**.

## What the build changes in the other designs

Each in the pull request that makes it untrue:

- **Step one, "Selecting and adding":** a click with Cmd or Shift held, Shift+Up or Shift+Down, a
  hold let go or Select starts selecting instead of only closing the card; while selecting, a click
  selects instead of opening a card, Cmd+Enter adds below the selection, and the bar takes the
  floating "+"'s place.
- **Step one, "Ticking":** with Cmd or Shift held, and while selecting, a click on the checkbox or
  beside it selects; while selecting, checkboxes show as selection circles.
- **Step one, "Item actions":** the selection's menu, and Select in an item's and a heading's
  menus; while selecting, a click or a tap on a heading selects it instead of opening the heading
  menu.
- **Step one, "Dragging" and "Touch on mobile":** a hold let go without moving, by touch or with a
  mouse, starts selecting; a drag of a selected row moves the selection.
- **Step one, "Undo":** "the list's only undo on mobile stays the Undo button after a delete" no
  longer holds: every group action shows one.
- **Step two, "Dragging a heading":** a selection with a heading drops as a section does, and
  while selecting a click or a tap on a heading selects it.
- **Step two, "Collapsing a heading":** while selecting, a click or a tap on a heading selects it;
  Move to heading… expands a collapsed target.
- **AGENTS.md, "Read before working":** links this design.

## Risks to check during the build

1. **A multi-block move, byte for byte:** blocks from different sections, a heading with its
   section plus loose items, a drop between them, a setext heading that needs the empty line, CRLF
   endings and no final newline. Every byte outside the moved lines stays, and edit-check refuses
   what would read differently. Core tests, written first.
   - **Result:** core tests cover each case byte for byte, and a group refuses what a single move
     refuses (`tests/core/group-move.test.ts`).
2. **A date picker without a card:** Set date… for several items needs a date picker opened from a
   menu choice, which may not count as a user action with Native menus on (step one, "Item
   actions"). Find a documented route; if none works, the owner decides.
   - **Result:** the `Modal` above. It sets the date on macOS with Native menus off, and on Android,
     where a tap on the input opens Android's own calendar. Not checked with Native menus on.
3. **The mobile bar:** it sits above Obsidian's own navigation bar and the on-screen keyboard
   without covering the last rows, on an iPhone, an iPad and Android.
   - **Result:** on Android, the bar sits above the navigation bar and the keyboard, and the last
     row scrolls clear of it; at the bar's 48 px buttons, the clearance was checked again without
     the keyboard. Not checked on an iPhone or an iPad.
4. **Hold and let go:** that a still hold let go reaches the view on iOS and Android after
   Obsidian's own `contextmenu` and its haptic, and that the tap after it is still swallowed (step
   one, "Touch on mobile").
   - **Result:** on Android, a still hold let go starts selecting. No tap follows a long press
     there, so whether the tap after it is swallowed isn't shown. Not checked on an iPhone or an
     iPad.
5. **Android's back gesture** ending selection: only if Obsidian documents a way to hear it;
   otherwise Done alone ends it.
   - **Result:** Obsidian documents no way for a plugin to hear Back, so Done ends selecting. On
     Android, Back shows Obsidian's "Press back again to exit." and the selection stays.
6. **Focus after Cmd+click:** with the card closed, Shift+Up and Shift+Down still reach the view,
   through its `scope`, without making rows focusable ahead of #125.
   - **Result:** the list's scroller takes focus at `tabindex="-1"`, so the keys reach the view
     with no row focusable; checked on macOS, also after switching tabs and back.

7. **Holding with a mouse:** that a press held still on a draggable row, in Obsidian's own
   window, sends `pointerup` and then one `click` without starting the browser's drag, on macOS and
   Windows, and that the click opens no card.
   - **Result:** On macOS, Obsidian 1.14.5, a press held still for 700 ms on a row, sent as DevTools
     input events, gives `pointerdown`, `pointerup` and one `click`, and no `dragstart`. The row is
     selected and no card opens. A press that moves 20 px, before or after the hold time, selects
     nothing. A hold on a checkbox ticks and one on a link opens it. The row is lifted once the
     hold time passes, and a move of 8.5 px drops the lift. Not checked on Windows, nor with a
     physical mouse.
8. **The bar on desktop:** that it sits at the bottom of a narrow pane, a split pane and a pop-out
   window without covering the last rows or the status bar.
   - **Result:** on macOS, in a 327 px pane at the window's right edge, under the status bar, the
     bar is 295 px wide, inside the pane, with its bottom 17 px above the status bar's top. In a
     429-row list scrolled to the end, the last row ends above the bar. The bar needs about 327 px
     of pane, so in a narrower one Delete is clipped; how a narrower pane lays it out is open, for
     the owner to decide.

## Order (call)

1. Core: moving several blocks in one write, and the actions over several items, with tests.
2. Desktop: the selection, Cmd+click, Shift+click and Shift+arrows, and how selected rows look.
3. Desktop: dragging the selection.
4. The selection's menu, Move to heading… included.
5. Mobile: hold to start, taps, the bar, and dragging.
6. The bar sized for a finger, and how selected rows look.
7. One way of selecting on desktop: the mode, the bar there, and one selected row as a group.
8. Starting by holding with a mouse, and Select in the menus.
