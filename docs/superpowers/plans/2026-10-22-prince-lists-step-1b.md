# PrinceLists step 1b Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build part 1b of the PrinceLists Obsidian plugin: dragging items on the iPhone, pasting or
dropping pictures into a card, and Cmd+Z undo. Then release it as `0.2.0`, so step one can finish
once the two-week trial has run.

**Architecture:**
- **Part 1a is the base.** The pure core (`src/core/`) and the view (`src/view/`) stay as 1a built
  them. Every write still goes through `writeAction` or a typing session, and every line-based state
  still follows `OwnEdit`s.
- **The iPhone drag** is spike 2's gesture (Pointer Events with a 500 ms hold) on the real rows. It
  drops through the same `dropAt` and `planItemMove` as the mouse drag, and it scrolls the list at
  its edges, inside a scrolling element of the plugin's own.
- **Pictures** are saved with `getAvailablePathForAttachment` and `createBinary`, and their link
  goes into the card's notes through the notes editor's own typing path.
- **Undo** is a history of the view's own edits, kept in the core next to the line-based state.
  Undo and redo write a whole earlier text back through the same guarded write the delete's Undo
  button uses. The keys go through the view's `scope`.

**Tech Stack:** as in 1a: TypeScript 6.0, esbuild 0.28, ESLint 10 with `eslint-plugin-obsidianmd`,
`obsidian` 1.14.4 types, `commonmark` 0.31.x (runtime), `vitest` (tests only), GitHub Actions on
Node 26.

**Spec:** `docs/superpowers/specs/2026-10-20-prince-lists-design.md`. Read it first, especially
"Dragging", "Editing" (Pictures), "Saving, outside changes, sync conflicts, undo" and "Touch on the
iPhone". The touch spike's notes, `docs/superpowers/notes/2026-10-21-spike-touch.md`, say how the
gesture was built and what it left open. This plan cites both by heading.

**How work lands:** as in 1a. Each task is one pull request that the owner squash-merges, so
"Commit with the message X" means the pull request's title is X. Each pull request checks the design
against the change and updates it, or says in one line that it still holds. **`<test vault>`** and
**`<everyday vault>`** mean what they mean in the 1a plan.

## Global Constraints

- **Everything in the 1a plan's Global Constraints still holds,** and so does `AGENTS.md`.
- **The manifest:** `minAppVersion` stays `1.5.7`. The newest API 1b uses is `View.scope` and
  `FileManager.getAvailablePathForAttachment`, both `@since 1.5.7`; `generateMarkdownLink` is
  `@since 0.12.0` and `Vault.createBinary` `@since 0.9.7`. If any other API with a newer `@since`
  turns up, `npm run lint` flags it: raise `minAppVersion` only with the owner's agreement.
- **No new commands and no new dependencies.** Undo and redo get no commands (owner, 2026-10-22).
  Their keys go through the view's `scope`, which adds nothing to Settings → Hotkeys. The design
  allows one drag library; the spike showed Pointer Events are enough, so none is added.
- **Timers** use `window.setTimeout`, `window.clearTimeout` and `window.requestAnimationFrame`, as
  the `obsidianmd/prefer-window-timers` lint rule asks. Each is cleared when the view unloads.
- **Interface text** added in 1b is exactly this:
  - "Couldn't add the picture."
  - "Obsidian can't show that kind of picture, so it wasn't added."
  - "The card closed before the picture was added. It's saved as {path}."
  - "This list changed elsewhere, so it can't be undone."
  - "This list changed elsewhere, so it can't be redone."
- **Writing to files:** a pasted or dropped picture is a write in response to a user action, like
  any other. Undo and redo write only through `writeAction`.

## Review Focus

1. **A list longer than the iPhone's screen.** Dragging the last item to the top section must
   scroll the list at the edge, and the item must land where the drop line showed (Task 2's
   `edgeStep` and `overRow` tests, Task 2 check 6).
2. **A Sync change that lands mid-drag or between an edit and its undo.** The drag must end without
   writing, and the undo must do nothing, since the history is cleared (Task 2 check 8, Task 4's
   `outsideChange` test).
3. **A screenshot pasted on the Mac, whose file is `image.png`, and a photo from the iPhone,** which
   may come as HEIC. The first must get a name of its own; the second, a format Obsidian can't show,
   must be refused rather than linked (Task 3's `pictureName` table).
4. **Cmd+Z while typing in a card.** It must undo the typing in that field, as in any text field,
   not a list action (Task 4 check 4).
5. **Undo after a drag that took an item with notes into another section.** The file must come back
   byte for byte, and an open card must stay on its item (Task 4's move test, Task 4 check 2).

---

### Task 1: Give the list a scrolling element of its own

The spike scrolled the view's `contentEl`, which scrolls only because Obsidian 1.14.4's stylesheet
gives `.view-content` `overflow: auto`. That isn't documented, so the list gets a scrolling element
of its own before Task 2 scrolls it (spike notes, "Styles").

**Files:**
- Modify: `src/view/list-view.ts`, `src/view/redraw.ts`, `src/view/add-button.ts` (its comment),
  `styles.css`, the design ("Touch on the iPhone")

**Interfaces:**
- Produces: `PrinceListView.listScrollEl: HTMLElement`, a `div` with the class `princelists-scroll`
  inside `contentEl`, created once in a new constructor of `PrinceListView`, after `super(leaf)`.
  Everything `redraw` draws goes in it, and its `scrollTop` is the one `redraw` keeps and `clear`
  resets. Not `scrollEl`: keep clear of names Obsidian's view classes might use at runtime (design,
  "Opening and switching views").

- [ ] **Step 1: Move the list into `listScrollEl`.** `redraw` replaces `listScrollEl`'s children
  instead of `contentEl`'s, and saves and restores its `scrollTop`. `clear()` empties it and sets
  its `scrollTop` to 0. The delegated listeners stay on `contentEl`, which holds it. `contentEl`
  gets the class `princelists-content`.
- [ ] **Step 2: Style it.** `.princelists-content` gets `position: relative`, and
  `.princelists-scroll` gets `position: absolute; inset: 0; overflow-y: auto; padding: inherit`.
  - The scroller fills `contentEl`'s padding box and takes its padding, so the Mac's scrollbar stays
    at the pane's edge and the list sits where it did.
  - `contentEl` then holds nothing in its flow, so it never scrolls, whatever Obsidian's stylesheet
    gives it. Overriding that stylesheet instead would mean matching its selectors: in 1.14.4,
    `.workspace-split.mod-primary-split .view-content` sets `overflow: auto` with three classes,
    and Obsidian's own views override it through an undocumented `[data-type=…]` attribute.
  - Update the comments in `redraw.ts` and `add-button.ts` that say `contentEl` is what scrolls.
- [ ] **Step 3: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 4: Check it by hand on the Mac and the iPhone.**
  1. A generated 500-item list scrolls, with the trackpad and with a swipe, and on the Mac the
     scrollbar sits at the pane's right edge.
  2. Ticking an item halfway down keeps the scroll position, and so does an edit to the list made
     in Markdown in another pane.
  3. Opening another list in the same pane starts at the top.
  4. The "+" stays put while the list scrolls, and the last row scrolls clear of it, also above the
     iPhone's floating navbar.
  5. On the iPhone, after "+", the keyboard leaves the new item's title in view.
  6. `example.md` looks the same as in `0.1.0` on both devices: compare screenshots of the two
     builds.
  7. In the Mac's developer tools, `contentEl`'s computed `position` is `relative`, and its
     `scrollHeight` equals its `clientHeight`.
- [ ] **Step 5: Update the design.** In "Touch on the iPhone", say the list scrolls in an element of
  its own, so nothing relies on Obsidian's undocumented `overflow` on `.view-content`.
- [ ] **Step 6: Commit** with the message "Give the list a scrolling element of its own".

### Task 2: Drag items on the iPhone

**Files:**
- Create: `src/core/touch-drag.ts`, `tests/core/touch-drag.test.ts`, `src/view/drag-touch.ts`,
  `src/view/move.ts`
- Modify: `src/view/drag-mouse.ts` (what both drags share moves to `move.ts`),
  `src/view/list-view.ts`, `styles.css`, the design ("Dragging", "Touch on the iPhone")

**Interfaces:**
- Consumes: `dropAt`, `ShownRow` and `Drop` (`src/core/drop.ts`); `ItemPlace` and `planItemMove`;
  `closeCard`; `view.editing.track` and `untrack`; `view.swallowNextClick`; `targetOf`;
  `LINE_ATTR`, `lineOf`, `ITEM_CLASS` and `CARD_CLASS`; `listScrollEl` (Task 1).
- Produces, in `src/core/touch-drag.ts`:
  - `HOLD_MS = 500` and `MOVE_TOLERANCE_PX = 5`, the spike's values (owner, 2026-10-21)
  - `EDGE_ZONE_PX = 56` and `EDGE_STEP_MAX_PX = 12`, the edge scroll's zone and its fastest step
    per frame **(call; the owner tunes them at Step 7)**
  - `interface RowBox { line: number; top: number; bottom: number }`: a shown row's, heading's or
    untouched block's first line and its vertical extent in the scroller's content coordinates
    (`rect.top - scrollerRect.top + scrollTop`), so scrolling doesn't change it
  - `overRow(boxes: readonly RowBox[], y: number): { line: number; below: boolean } | null`: the
    first box whose `bottom` is greater than `y`, with `below` true when `y` is past its middle;
    past every box, the last one with `below` true; `null` when there are no boxes. `y` is in the
    same coordinates. Its result is what `dropAt` takes as `over`.
  - `edgeStep(y: number, top: number, bottom: number): number`: how far to scroll this frame for a
    finger at viewport `y` in a scroller whose visible part runs from `top` to `bottom`. `0` outside
    the two zones, and in a zone it grows linearly from 0 at the zone's inner edge to
    `EDGE_STEP_MAX_PX` at the edge and beyond: negative at the top, positive at the bottom. Never
    `-0`, which `toBe(0)` tells apart from `0`.
- Produces, in `src/view/move.ts` (moved from `drag-mouse.ts` without a change in behavior):
  - `queueMove(view: PrinceListView, line: number, place: ItemPlace): void`
  - `shownRows(listEl: HTMLElement): ShownRow[]`
  - `markDrop(listEl: HTMLElement, marked: HTMLElement | null, drop: Drop | null): HTMLElement | null`:
    takes the drop line off `marked`, shows it for `drop`, and returns the element that now shows it
- Produces: `enableTouchDrag(view: PrinceListView): void`, in `src/view/drag-touch.ts`, called from
  `onOpen` only when `Platform.isMobile`. It also adds a zero-height element with the class
  `princelists-visible-bottom` to `containerEl`, styled `position: absolute; left: 0; right: 0;
  bottom: var(--view-bottom-spacing, 0px)`. Its top is where the list stops being visible: on the
  iPhone the list runs under the floating navbar, whose height Obsidian 1.14.4 puts in
  `--view-bottom-spacing`, as the "+" relies on (design, "Touch on the iPhone").

- [ ] **Step 1: Write the failing tests** in `tests/core/touch-drag.test.ts`, with
  `boxes = [{line: 0, top: 0, bottom: 40}, {line: 1, top: 40, bottom: 80}, {line: 3, top: 90, bottom: 130}]`:

| Call | Expected |
|---|---|
| `overRow(boxes, 10)` | `{line: 0, below: false}` |
| `overRow(boxes, 30)` | `{line: 0, below: true}` |
| `overRow(boxes, 85)` (in the gap) | `{line: 3, below: false}` |
| `overRow(boxes, 200)` (past the end) | `{line: 3, below: true}` |
| `overRow(boxes, -5)` (above the start) | `{line: 0, below: false}` |
| `overRow([], 10)` | `null` |
| `edgeStep(300, 0, 600)` | `0` |
| `edgeStep(56, 0, 600)` and `edgeStep(544, 0, 600)` | `0` (the zones' inner edges) |
| `edgeStep(28, 0, 600)` | `-6` |
| `edgeStep(0, 0, 600)` and `edgeStep(-20, 0, 600)` | `-12` |
| `edgeStep(572, 0, 600)` | `6` |
| `edgeStep(600, 0, 600)` and `edgeStep(650, 0, 600)` | `12` |

- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement `src/core/touch-drag.ts` and expect
  PASS.
- [ ] **Step 3: Move what both drags share to `src/view/move.ts`,** and have `drag-mouse.ts` use it.
  Run `npm run lint && npm test`, and repeat the 1a plan's Task 11 mouse checks 1 to 5 on the Mac.
- [ ] **Step 4: Build the gesture in `src/view/drag-touch.ts`,** as the spike notes' "What was
  built" describes it, with these differences:
  - **Listeners:** registered once in `enableTouchDrag` with `registerDomEvent` on `contentEl`,
    including the non-passive `touchmove`. The view's existing capture-phase `contextmenu` cancel
    and `swallowNextClick` (the 1a plan's Task 10) stay as they are and serve the drag too.
  - **What drags:** a hold anywhere on an item row, its checkbox and any link in its title included,
    but not on the open card **(call)**. A tap on a link still opens it.
  - **The lift:** first `closeCard(view)`, as the mouse drag does, then measure the rows. Track the
    item's line with `view.editing.track`, and measure a `RowBox` for every element carrying
    `LINE_ATTR` in `listScrollEl`, in order, the dragged row included: over its own place, `dropAt`
    returns `null`, so no line shows.
  - **Following the finger:** the row's offset is the finger's movement plus how far the list has
    scrolled since the lift, so the row stays under the finger while the list scrolls. With `y` the
    finger's `clientY` in the boxes' coordinates, the drop is
    `dropAt(shownRows(listScrollEl), item.line, overRow(boxes, y))`, shown with `markDrop`. While
    `item.line` or `overRow`'s result is `null`, no drop line shows.
  - **The edge scroll:** `edgeStep` takes the scroller's top and the top of
    `princelists-visible-bottom`, read on each move and frame: closing the card at the lift can put
    the keyboard away, which moves the visible bottom. While the finger is in a zone (`edgeStep` not
    0), a `window.requestAnimationFrame` loop adds the step to `listScrollEl.scrollTop` each frame,
    then updates the row's offset and the drop as a move does. It stops when the step is 0 or the
    press ends. The spike didn't test setting `scrollTop` while `touchmove` is canceled: if it
    doesn't scroll on the iPhone, stop and raise it in the pull request.
  - **A redraw while lifted** (an outside change, or the removal of an empty item that closing the
    card started) detaches the row: the next move or frame finds it disconnected and ends the drag
    with no drop **(call)**, since the row the finger holds is gone.
  - **The release:** a lifted press sets `view.swallowNextClick`, so it never counts as a tap, and,
    with a drop, calls `queueMove(view, line, drop.place)` only while the row is still in the
    document: a redraw since the last move means the drop's lines may be stale. A press that a
    redraw ended stays open until the finger lifts, so that release is swallowed too.
    `pointercancel` drops nothing.
  - **The lifted row's look** is the spike's: a class with an `--interactive-accent` outline, a
    `--shadow-l` shadow, a `--background-primary` fill, `position: relative`, `z-index: 1`, and
    `transform: translateY(...)` from a custom property set with `setCssProps`.
- [ ] **Step 5: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 6: Install in the test vault and check it on the iPhone.** The owner does the checks
  that need a finger.
  1. A quick swipe scrolls the list.
  2. Holding a row about half a second, then moving, lifts it and it follows the finger. The drop
     line shows where it will land, and dropping moves the item in the file, notes and all.
  3. Dropping into another section works, and so does dropping directly under a heading.
  4. Holding still opens no menu, magnifier or text selection. Letting go of a lifted row without
     moving changes nothing and opens no card.
  5. A tap on a row still opens its card, and a tap on its box still ticks it.
  6. In a list longer than the screen, dragging toward the top or bottom edge scrolls it, and the
     item lands where the line showed.
  7. With "Show archived" off, dragging past a hidden item leaves it where it was in the file.
  8. With the list open as Markdown in a second pane on the Mac, an edit made there while a row is
     lifted on the iPhone ends the drag after Sync, and nothing is written.
  9. Holding a row while another item's card is open, with the keyboard up, closes the card and
     drags the row, and the bottom edge still scrolls the list.
  10. Scrolling right after a drop still works.
- [ ] **Step 7: CHECKPOINT. The owner judges the feel:** the hold, the edge zone and the scroll
  speed. Change the constants as the owner asks, and record the values in the pull request.
- [ ] **Step 8: Update the design.** Under "Dragging", iPhone: the drop line works as on the Mac, a
  hold anywhere on a row drags it, the list scrolls at its edges, and a redraw while dragging ends
  the drag, each **(call)**. Under "Touch on the iPhone": the final constants, and the edge scroll
  as a second user of the undocumented `--view-bottom-spacing`, next to the "+", in the line on what
  happens if Obsidian drops it.
- [ ] **Step 9: Commit** with the message "Drag items on the iPhone".

### Task 3: Paste and drop pictures into a card

**Files:**
- Create: `src/core/picture.ts`, `tests/core/picture.test.ts`, `src/view/pictures.ts`
- Modify: `src/view/events.ts` (registers the picture listeners), the design ("Editing", Pictures)

**Interfaces:**
- Consumes: `editNotes`, `notesInput`, `CARD_NOTES_CLASS` and `NOTES_EDITOR_CLASS`
  (`src/view/card.ts`); `view.card` and its `lostAt`; `targetOf`, for the drag events.
- Produces, in `src/core/picture.ts`:
  - `PICTURE_EXTENSIONS`: `avif`, `bmp`, `gif`, `jpeg`, `jpg`, `png`, `svg` and `webp`, the image
    formats Obsidian accepts (Obsidian Help, "Accepted file formats", checked 2026-10-22). Other
    pictures, such as HEIC, would be linked but not shown, so they're refused **(call)**.
  - `pictureName(file: { name: string; type: string }, pasted: boolean, now: Date): string | null`.
    A pasted picture is named `Pasted image YYYYMMDDHHmmss.<ext>` in local time, as Obsidian names
    its own, with the extension from its MIME type: `image/png` gives `png`, `image/jpeg` `jpg`, and
    `image/<x>` gives `<x>` for the other extensions above, `image/svg+xml` giving `svg`. A dropped
    picture keeps its own name when its extension, compared without case, is in the list **(call)**,
    with each `#`, `^`, `|`, `[` and `]` replaced by `-`: in a link they would start a heading, a
    block, an alias or the brackets. `null` for anything else.
  - `appendOnOwnLine(notes: string, text: string): string`: `text` after `notes`, on a line of its
    own.
- Produces: `registerPictureEvents(view: PrinceListView): void`, in `src/view/pictures.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/core/picture.test.ts`
  (`now = new Date(2026, 9, 22, 14, 30, 5)`):

| Call | Expected |
|---|---|
| `pictureName({name: "image.png", type: "image/png"}, true, now)` | `"Pasted image 20261022143005.png"` |
| `pictureName({name: "image.jpeg", type: "image/jpeg"}, true, now)` | `"Pasted image 20261022143005.jpg"` |
| `pictureName({name: "x.svg", type: "image/svg+xml"}, true, now)` | `"Pasted image 20261022143005.svg"` |
| `pictureName({name: "IMG_0042.JPG", type: "image/jpeg"}, false, now)` | `"IMG_0042.JPG"` |
| `pictureName({name: "Plan [v2] #3.png", type: "image/png"}, false, now)` | `"Plan -v2- -3.png"` |
| `pictureName({name: "IMG_0042.HEIC", type: "image/heic"}, false, now)` | `null` |
| `pictureName({name: "image.heic", type: "image/heic"}, true, now)` | `null` |
| `pictureName({name: "notes.pdf", type: "application/pdf"}, false, now)` | `null` |
| `appendOnOwnLine("", "![[a.png]]")` | `"![[a.png]]"` |
| `appendOnOwnLine("Buy 6:", "![[a.png]]")` | `"Buy 6:\n![[a.png]]"` |
| `appendOnOwnLine("Buy 6:\n", "![[a.png]]")` | `"Buy 6:\n![[a.png]]"` |

- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the listeners in `src/view/pictures.ts`,** delegated once on `contentEl`:
  - **`paste`** in the open card's notes editor, found among the view's textareas as `onInput` finds
    its field, since a `ClipboardEvent` has no `targetNode`: when `clipboardData.files` holds a file
    whose `type` starts with `image/`, cancel the paste and add its pictures. Otherwise leave it
    alone, so text pastes as text. A pasted picture in the card's title does nothing, as now
    **(call)**.
  - **`dragover` and `drop`** inside the open card, only when one of `dataTransfer.items` has
    `kind` `"file"` and a `type` starting with `image/`, which a page can read during a drag:
    `dragover` cancels the event so a drop is allowed, and `drop` cancels it and stops it, so
    Obsidian doesn't also act on the file. Any other drag is left alone, so the card isn't a drop
    target for it. The row drag's listeners ignore a file drag already, since it lacks their type.
  - **Adding them:** a picture with no `pictureName` shows "Obsidian can't show that kind of
    picture, so it wasn't added." The others are saved one at a time, so only one is held in memory
    at once. For each,
    `getAvailablePathForAttachment(name, file.path)`, then
    `vault.createBinary(path, await picture.arrayBuffer())`, then the link
    `"!" + fileManager.generateMarkdownLink(created, file.path)`, where `file` is the list's file.
    That follows the vault's link settings, and with Obsidian's defaults gives `![[name]]` (owner,
    2026-10-22). A picture whose save throws shows "Couldn't add the picture." and is skipped.
  - **Where the links go,** once every picture is saved, joined with line breaks, while the card
    open at the paste or drop is still open on its item (`view.card` is that card, and its `lostAt`
    is `null`):
    - **The notes editor that was open is still in the document:** the links replace its selection
      (`setRangeText(text, start, end, "end")`).
    - **Otherwise,** when the notes weren't being edited or the editor closed while the pictures
      saved: `editNotes` opens it, and the links go at the end with `appendOnOwnLine`.
    - Then `notesInput(view, editor)` saves them as typing is saved, so the view's line-based state,
      Obsidian's merge and Task 4's history all see an ordinary keystroke.
  - **When the card closed or lost its item** before the pictures were saved, nothing is inserted,
    and a notice reads "The card closed before the picture was added. It's saved as {path}."
    **(call)**.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac.**
  1. Copy a screenshot, click into an item's notes in its card, and press Cmd+V. A file
     `Pasted image <time>.png` appears where the vault's attachment setting says, and the notes hold
     `![[Pasted image <time>.png]]` at the cursor. Leaving the field renders the picture.
  2. With Settings → Files and links → "Use [[Wikilinks]]" off, the link is a Markdown link.
  3. Drag a `.jpg` from the Finder onto an open card whose notes aren't being edited. The notes
     editor opens, and the link goes on a line of its own at the end. Obsidian opens nothing else.
  4. Dropping a PDF on the card adds nothing to the notes, and Obsidian does with it what it does
     with a PDF dropped elsewhere in the list pane: record what that is.
  5. Pasting text into the notes still pastes the text.
  6. With a list from outside the vault (design, "Notes outside the vault"), paste a picture and
     record where it was saved and whether it shows. If it fails, stop and record it with this
     proposed fallback: pictures can't be pasted into a list from outside the vault. The owner
     decides before it's built.
- [ ] **Step 6: Check it on the iPhone.**
  1. Copy a photo in Photos, tap into an item's notes, and paste. It's added as in check 1.
  2. Drag a photo from Photos onto an open card: hold the photo, then switch to Obsidian with
     another finger. It's added as in check 3. If iOS offers no way to do this, record it.

  If check 1 fails because the paste brings no file, or only a HEIC one, stop and record what the
  paste event holds. The owner decides before it's built.
- [ ] **Step 7: Update the design** under "Editing", Pictures: the names, where the links go, which
  formats are refused and why, and the notice when the card closed first, each **(call)**.
- [ ] **Step 8: Commit** with the message "Paste and drop pictures into a card".

### Task 4: Undo and redo with Cmd+Z

**Files:**
- Create: `src/core/history.ts`, `tests/core/history.test.ts`, `src/view/undo.ts`
- Modify: `src/core/follow.ts`, `src/core/editing.ts`, `tests/core/editing.test.ts`,
  `src/core/empty-item.ts`, `src/core/heading-field.ts`, `src/core/list-actions.ts`,
  `tests/core/empty-item.test.ts`, `tests/core/heading-field.test.ts`,
  `tests/core/list-actions.test.ts`, `src/view/list-view.ts`, the design ("Saving, outside changes,
  sync conflicts, undo")

**Interfaces:**
- Consumes: `OwnEdit`, `RunEdit`, `MoveEdit`, `moveEdit` and `followLine` (`src/core/follow.ts`);
  `splitLines`; `writeAction`; `view.enqueue`; `closeCard` and `isNewEmptyItem`.
- Produces, in `src/core/follow.ts`: `type HistoryMark = "cancel" | "undo" | "redo"`, and an
  optional `history?: HistoryMark` on `RunEdit` and `MoveEdit`. An edit without one is an ordinary
  action.
- Produces, in `src/core/history.ts`:
  - `HISTORY_LIMIT = 100`: the most steps kept **(call)**
  - `textEdit(from: string, to: string): RunEdit`: a run from the first line where the two differ,
    with `delta` the change in the number of lines and `kind` `"insert"` when it grows, `"delete"`
    when it shrinks, and `"change"` otherwise
  - `class EditHistory`. A step is a text before and after one edit, and a move's map. The steps
    form a chain: each one's `before` is the `after` of the step below it, the same string, so each
    text is held once. Whole texts keep an undo a plain guarded write of an earlier text
    **(call)**; the cost is at most `HISTORY_LIMIT` copies of the list, about 10 MB for a
    50,000-character list at 2 bytes a character.
    - **The chain rule:** when there is a top step and a write's or keystroke's `before` isn't its
      `after`, both stacks are cleared first, so an undo never jumps over a change it doesn't know.
    - `wrote(before: string, after: string, edit: OwnEdit): void`, for each own write that landed:
      - **No mark:** it pushes a step and empties the redo stack.
      - **`"undo"`,** taking the top step back exactly (the write's `after` is that step's
        `before`), moves that step to the redo stack. **`"redo"`,** doing the top redo step again,
        moves it back. Either, matching nothing, is pushed like an action.
      - **`"cancel"`,** taking the top step back exactly, drops that step. Otherwise it clears both
        stacks **(call)**: an undo must never bring back an empty item or heading with no card or
        field left to close it.
    - `typed(session: object, before: string, after: string): void`, for each keystroke. It empties
      the redo stack. Keystrokes from the same `session`, with no other step between them, make one
      step, and a step that ends where it started is dropped.
    - `undo(text: string): { next: string; edit: OwnEdit } | null`: when `text` is the top step's
      `after`, the write that takes it back, marked `"undo"`. For a move, its edit is the inverse
      map: each line goes back where it came from, and a line the move added maps to `null`.
      Otherwise it's `textEdit(after, before)`.
    - `redo(text: string): { next: string; edit: OwnEdit } | null`: the same for the top redo step,
      marked `"redo"`.
    - `clear(): void`
- Produces, in `src/core/editing.ts`: `ListEditing.history: EditHistory`. `applyOwn` calls `wrote`,
  and each keystroke calls `typed` with its session's key: a new object that `focusTitle`,
  `openNotes` and `openListNote` each create, kept until that field closes. Not `this.title`, which
  `typeTitle` replaces on every keystroke. `outsideChange` and `reset` call `clear`.
- Produces: `registerUndoKeys(view: PrinceListView): void`, in `src/view/undo.ts`, called from the
  view's constructor (Task 1), so the scope is in place before the view first takes focus. Check 8
  confirms it reaches the list.

- [ ] **Step 1: Write the failing tests** in `tests/core/history.test.ts`, with
  `t0` = `- [ ] a\n- [ ] b\n`, `t1` its tick of `a`, and `t2`, `t3` other texts:
  - **Undo and redo:** after `wrote(t0, t1, tick)`, `undo(t1)` gives `{next: t0}` with a
    `"change"` edit at line 0 marked `"undo"`. After `wrote(t1, t0, thatEdit)`, `undo(t0)` is
    `null` and `redo(t0)` gives `{next: t1}`, marked `"redo"`.
  - **A new action empties the redo stack:** after an undo, `wrote(t0, t2, edit)` makes `redo(t2)`
    `null`.
  - **Typing:** `typed(s, t0, t1)` then `typed(s, t1, t2)` is one step: `undo(t2)` gives `t0`.
    `typed(s2, t2, t3)` after them is a second step. `typed(s, …)`, `wrote(…)`, `typed(s, …)` makes
    three steps. After `wrote(t2, t0, …)`, `typed(s, t0, t1)` and `typed(s, t1, t0)`, the session
    left no step: `undo(t0)` gives `t2`, and a further `typed(s, t0, t3)` starts a new step, so
    `undo(t3)` gives `t0`. A keystroke after an undo empties the redo stack.
  - **A cancel leaves no step:** after `wrote(t2, t0, …)`, `wrote(t0, t1, insert)` and
    `wrote(t1, t0, {…, history: "cancel"})`, `redo(t0)` is `null` and `undo(t0)` gives `t2`. After
    `wrote(t0, t1, insert)` and `wrote(t1, t3, {…, history: "cancel"})`, `undo(t3)` is `null`.
  - **The delete's Undo button is an undo:** after `wrote(t0, t1, delete)` and
    `wrote(t1, t0, {…, history: "undo"})`, `redo(t0)` gives `t1`.
  - **A broken chain clears it:** after `wrote(t0, t1, …)` and `wrote(t2, t3, …)`, the history holds
    one step: `undo(t3)` gives `t2`, and `undo(t1)` is `null`.
  - **`undo(text)` is `null` when `text` isn't the top step's `after`,** and `clear()` empties both
    stacks.
  - **The limit:** after 101 actions, 100 undos succeed and the next is `null`.
  - **A move:** in `- [ ] a\n- [ ] b\n- [ ] c\n`, moving `c` first gives `moved = [1, 2, 0]`. The
    undo's edit is a `MoveEdit` with the inverse map: `followLine` takes 0 to 2, 1 to 0 and 2 to 1.
    Once that undo is written, the redo's edit maps as the move did: 0 to 1, 1 to 2 and 2 to 0.
  - **`textEdit`:** for an insert of one line at line 2 it's `{start: 2, delta: 1, kind: "insert"}`,
    the reverse is `{start: 2, delta: -1, kind: "delete"}`, and a tick is
    `{start: 0, delta: 0, kind: "change"}`.

  In `tests/core/editing.test.ts`, also test that `applyOwn` records a step, that a typing session
  records one step for many keystrokes, and that `outsideChange` clears the history.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Mark the writes that take a step back.**
  - `planRemoval` (`src/core/empty-item.ts`) and `planHeadingRemoval` (`src/core/heading-field.ts`)
    mark their edits `"cancel"`, so removing an empty new item or heading leaves no step, as the
    design's "a cancel, with no Undo" wants.
    - An item's removal restores the text from before its insert, so it takes the insert back
      exactly.
    - A heading's removal deletes it from the current text. Test that this gives back the text from
      before `insertHeading` for a heading added after an item and one added after a section.
    - A removal that doesn't match, such as the fallback after the file changed, clears the
      history.
  - The delete's `undo` edit (`deletePlan` in `src/core/list-actions.ts`) is marked `"undo"`, so the
    Undo button and Cmd+Z take the same step back, and Cmd+Shift+Z can delete again.
  - Add a row for each to `tests/core/empty-item.test.ts`, `tests/core/heading-field.test.ts` and
    `tests/core/list-actions.test.ts`: the edit carries its mark.
- [ ] **Step 4: Build the keys in `src/view/undo.ts`.** `registerUndoKeys` sets
  `view.scope = new Scope(view.app.scope)` and registers `["Mod"], "z"` for undo and
  `["Mod", "Shift"], "z"` for redo. Each handler:
  - **When the key's target** (`evt.targetNode`) is a `textarea`, an `input` other than a checkbox,
    or content-editable, it returns `true`, so that field's own undo runs **(call)**. That covers
    the view's own fields and Obsidian's under the same scope, such as the pane's title.
  - **On an empty new item's open card,** with focus outside its title, undo closes the card, which
    removes the item: that is the undo of adding it. With the cursor in the title, the rule above
    gives Cmd+Z to the field.
  - **Otherwise** it queues on `view.enqueue`: it takes `history.undo(view.text)` or
    `history.redo(view.text)`, does nothing when that is `null`, and writes it with
    `writeAction(view, step.next, view.text, notice, step.edit)`, where `notice` is "This list
    changed elsewhere, so it can't be undone." or "…redone.". When the write lands, it calls
    `view.render()`, since Obsidian's echo returns early.
  - It returns `false`, so Obsidian cancels the key's default.
  - The card stays open when its item survives the undo: `applyOwnText` moves `selected` with the
    edit, and closes the card when the item is gone.
- [ ] **Step 5: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 6: Check it by hand on the Mac.** Compare the file with `git diff` on a copy where a
  check says "back".
  1. Tick an item, press Cmd+Z: it's unticked. Cmd+Shift+Z ticks it again with the same `✔` time.
  2. Drag an item with notes into another section, open another item's card, then press Cmd+Z: the
     file is back, and the card is still on its item.
  3. Delete an item, then Cmd+Z: it's back. Delete again and use the notice's Undo instead: it's
     back, and Cmd+Shift+Z deletes it again.
  4. Type in an item's title, leave the field, then Cmd+Z: the old title is back. Inside the field,
     Cmd+Z undoes the typing in the field only.
  5. Press "+", click the card's empty space so the title loses focus, then Cmd+Z: the empty item is
     gone, and the next Cmd+Z undoes what came before it.
  6. New heading below, then Escape: Cmd+Z doesn't bring an empty heading back.
  7. Edit the list as Markdown in another pane: afterwards Cmd+Z in the list does nothing.
  8. Cmd+Z reaches the list after clicking empty space, after ticking a box and after a drag. If one
     doesn't, record which in the pull request: the view's scope may not be active then.
  9. Cmd+Z in a Markdown note in another pane still undoes in that note.
  10. Paste a picture into an item's notes, leave the field, then Cmd+Z: the link goes and the
      picture file stays **(call)**: undo changes only the list's own text. Then paste one again
      and press Cmd+Z at once, inside the field, and record what it does. The browser may not count
      the plugin's insert as typing, so the link may stay, to be deleted by hand **(call)**.
- [ ] **Step 7: Update the design** under "Undo (1b, call)": typing in a field makes one step per
  session; a cancel leaves no step, and one that can't take its insert back exactly clears the
  history; the Undo button and Cmd+Z are the same step; a field keeps its own Cmd+Z, which may not
  take back a picture's link (check 10); and the history holds 100 steps and only the list's text.
  Add `View.scope` and `Scope.register` to "Verified facts".
- [ ] **Step 8: Commit** with the message "Undo and redo the list's own edits with Cmd+Z".

### Task 5: Finish 1b and release 0.2.0

**Files:**
- Create: `docs/superpowers/notes/<date>-1b-checks.md`
- Modify: the design (reconcile it), `README.md` (the status line), `package.json`,
  `package-lock.json`, `manifest.json`, `versions.json`

- [ ] **Step 1: Run every 1b check on the iPhone in the test vault:** Task 2's Step 6 and Task 3's
  Step 6. If risk 6 (the `✔` glyph in reading view on the iPhone) is still open, check it too.
- [ ] **Step 2: Check alongside Tasks and Kanban** in the test vault: a drag on the iPhone and an
  undo on the Mac still write what they should, and a Tasks query still lists the items.
- [ ] **Step 3: Write the notes file:** each check, its result and how it ran, naming no devices,
  vaults or home paths.
- [ ] **Step 4: Reconcile the design.** Check each 1b claim against the code, record decided
  deviations with their reasons, raise anything undecided, and set `verified`. Keep
  `status: building` unless the owner confirms the two-week trial has met "Done when"; then it's
  `live`.
- [ ] **Step 5: Bump the version** with `npm version minor --no-git-tag-version`, which gives
  `0.2.0` and adds `"0.2.0": "1.5.7"` to `versions.json`. Check that `minAppVersion` is still
  `1.5.7` and that `npm run lint` passes.
- [ ] **Step 6: Commit** the notes, the design, `README.md` and the version files with the message
  "Finish part 1b". In the README, say 1b is in `0.2.0`. Open the pull request; the owner merges it.
- [ ] **Step 7: Release `0.2.0`.** The owner pushes the signed tag `0.2.0`, approves the `release`
  environment, checks the draft and publishes it (`AGENTS.md`, "Releases").
- [ ] **Step 8: The owner installs `0.2.0` in the everyday vault,** replacing the three files.
