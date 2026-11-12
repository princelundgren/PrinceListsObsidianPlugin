# PrinceLists one way of selecting Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selecting one mode on desktop and mobile, started by a hold, Select in a menu,
Cmd+click, Shift+click or Shift+arrows, with the bar on both, its buttons sized for a finger, and
selected rows marked as Obsidian marks selected files.

**Architecture:**
- **Selecting is the selection being non-empty.** `view.selecting` already ends when the last row
  goes (`drawSelection` in `src/view/select.ts`); every way in now sets it, on every platform, so
  "selecting" and "a row is selected" mean the same thing on desktop and mobile.
- **One selected row is a group.** `RowSelection.linesWith` in `src/core/selection.ts` answers for
  any selected row, one included, so the selection's menu, the drag and the Undo message follow.
- **The bar is built on every platform,** in the floating "+"'s place, and clears the status bar on
  desktop the way the floating "+" does (`src/view/add-button.ts`).
- **A mouse hold** is a press and release on a row, with the touch hold's time and tolerance from
  `src/core/touch-drag.ts`, and the click after it swallowed as touch's is.

**Tech Stack:** as in step two. No new dependency.

**Design:** [select-several design](../specs/2026-11-07-select-several-design.md), items 6 to 8 of
its "Order".

**How work lands:** as in the [select-several plan](2026-11-07-select-several.md): one pull request
per task, stacked on the select-several stack, squash-merged by the owner, so "Commit with the
message X" means the pull request's title is X. Each task updates the design sections it names, or
says in one line that they still hold, and sets `verified`. Manual checks run in a copy of the demo
vault (AGENTS.md, "Commands"), on macOS and on the Android emulator.

## Global Constraints

- AGENTS.md's rules: Obsidian's CSS variables only, no hard-coded colors, no `:has()`, documented
  APIs only, sentence case, listeners through `registerDomEvent`, one delegated listener per
  container.
- Bar buttons, Done included: at least 48 by 48 CSS pixels each, at least 8 CSS pixels apart.
- Selected rows: `--nav-item-background-selected` and `--nav-item-color-selected`.
- The mouse hold: `HOLD_MS` and `MOVE_TOLERANCE_PX` from `src/core/touch-drag.ts`, no new numbers,
  and the tolerance measured as touch measures it, by distance (`Math.hypot`).
- Menu entry: "Select", with Lucide's `square-check` icon.
- Each task updates the comments and doc comments its change makes false, and removes code it
  leaves unreachable.

## Review Focus

1. **A plain click on desktop with nothing selected still opens the card,** and a click on a
   checkbox still ticks: the mode starts only by the ways the design names.
2. **A hold that becomes a drag:** a mouse press that moves before the hold time drags the row as
   today and selects nothing; one that moves after it selects nothing either.
3. **The click after a hold** opens no card and doesn't toggle the row back off.
4. **Escape and Done on desktop** end selecting, and a click on empty space doesn't.
5. **The bar on a narrow desktop pane** stays inside the pane, above the status bar, and the last
   row scrolls clear of it.

---

### Task 1: The bar sized for a finger, and selected rows marked as selected files

**Files:**
- Modify: `styles.css` (the selected-row rule and the selection bar's rules)
- Modify: `src/view/selection-bar.ts` (Delete apart, past a divider)
- Modify: `src/view/select.ts` (`drawSelection` and `markRow`: the ends of a run)
- Modify: the design, "What the selection is" and "The bar"

**Interfaces:**
- Produces: the classes `princelists-selected-first` and `princelists-selected-last` on a selected
  row that starts or ends a run of selected rows in shown order, set by `drawSelection`.

- [ ] **Step 1:** In `styles.css`, draw `.princelists-selected` with
  `--nav-item-background-selected` and `--nav-item-color-selected`, rounded with `--radius-s` only
  at a run's first and last row, square between.
- [ ] **Step 2:** In `drawSelection`, mark the first and last row of each run of selected rows, in
  the order `ownElements(view.listScrollEl, ROW_SELECTOR)` returns them, passing each row's place
  to `markRow`.
- [ ] **Step 3:** Size the bar: each action button and Done at least `var(--size-4-12)` (48 px) in
  both directions, with `var(--size-4-2)` (8 px) or more between them, and the bar's height variable
  grown to fit, so the spacer and the edge zone keep following it.
- [ ] **Step 4:** Put Delete last, past a divider drawn with `--background-modifier-border`, with
  the gap on each side of the divider at least 8 px.
- [ ] **Step 5:** `npm run lint`, `npm run build`, `npm test` pass.
- [ ] **Step 6: Check on the Android emulator,** light and dark: read each bar button's and Done's
  `getBoundingClientRect()` through the WebView inspector, every one at least 48 by 48 and 8 apart;
  a run of three selected rows reads as one block; a picture of each. On macOS, light and dark: a
  Cmd+click selection of three rows reads as one block.
- [ ] **Step 7: Commit** with the message "Size the selection bar for a finger, and mark selected
  rows as selected files (#79)".

### Task 2: One way of selecting on desktop

**Files:**
- Modify: `src/core/selection.ts` (`linesWith`)
- Test: `tests/core/selection.test.ts`
- Modify: `src/view/select.ts`, `src/view/list-view.ts`, `src/view/selection-bar.ts`,
  `src/view/drag-host.ts`, `src/view/drag-mouse.ts`, `src/view/drag-touch.ts`, `src/view/move.ts`,
  `styles.css`
- Modify: the design, "Starting to select", "While selecting" and risk 8, and step one's and step
  two's sections the design's "What the build changes in the other designs" lists

**Interfaces:**
- Consumes: Task 1's bar.
- Produces: `RowSelection.linesWith(line: number): number[] | null`, the selection's lines in
  order whenever `line` is selected, one row included; null otherwise. `view.selecting` set by every
  way into selecting, on every platform.

- [ ] **Step 1: Rewrite the test** `linesWith gives the selected lines for a row in a selection of
  two or more` in `tests/core/selection.test.ts` as `linesWith gives the selected lines for any
  selected row`: with line 7 alone selected, `linesWith(7)` is `[7]`; after toggling 3,
  `linesWith(7)` is `[3, 7]`; `linesWith(5)` stays null.
- [ ] **Step 2:** Run `npx vitest run tests/core/selection.test.ts`: it fails.
- [ ] **Step 3:** Change `linesWith` to answer for one row. Run the tests: they pass.
- [ ] **Step 4:** In `onSelectClick` when Cmd or Shift selects, and in `extendSelection` when it
  moves, set `view.selecting = true` before `drawSelection`, which syncs the bar only while
  selecting.
- [ ] **Step 5:** Build the bar on every platform in `list-view.ts`; on desktop it clears the status
  bar as the floating "+" does.
- [ ] **Step 6:** A drag records whether it carries the selection, from `host.dragged`, and
  `aimCarried` aims a group drop for it, one row included, so its drop goes through
  `queueSelectionDrop` with the Undo message. Remove the branch in `drag-host.ts`'s `dragged` that
  `linesWith` now covers.
- [ ] **Step 7:** `newItemBelowSelection` adds below the last selected item whenever one is
  selected.
- [ ] **Step 8:** `npm run lint`, `npm run build`, `npm test` pass.
- [ ] **Step 9: Check on macOS** through a DevTools port, with every click sent as a DevTools input
  event: Review Focus items 1, 4 and 5; Cmd+click, Shift+click and Shift+Down each show the bar; a
  plain click while selecting toggles a row; with one row selected, right-click opens the
  selection's menu, a drag shows the Undo message, Tick, Star, Date and Delete each show it, and
  Cmd+Enter adds below the row; Done ends selecting. Write risk 8's result in the design. Then on
  the Android emulator: holding, tapping and the bar still work as before, and a one-row drag shows
  the Undo message.
- [ ] **Step 10: Commit** with the message "Select the same way on desktop as on mobile, with the
  bar (#79)".

### Task 3: Hold with a mouse, and Select in the menus

**Files:**
- Modify: `src/core/touch-drag.ts` (`isStillHold`)
- Test: `tests/core/touch-drag.test.ts`
- Create: `src/view/hold-mouse.ts`
- Modify: `src/view/events.ts`, `src/view/list-view.ts`, `src/view/menus.ts`, `src/view/select.ts`
- Modify: the design, "Starting to select", risk 7, and the header's `status`

**Interfaces:**
- Consumes: Task 2's `view.selecting` on every platform.
- Produces: `isStillHold(press: { x: number; y: number; at: number }, release: { x: number; y:
  number; at: number }): boolean`, true when `release.at - press.at >= HOLD_MS` and the pointer
  moved at most `MOVE_TOLERANCE_PX` by distance. `selectRow(view: PrinceListView, line: number):
  void` in `select.ts`, which closes an open card, selecting its item too, adds `line` and starts
  selecting.

- [ ] **Step 1: Write the failing tests** in `tests/core/touch-drag.test.ts`: `a press held for
  HOLD_MS and let go in place is a still hold`, `a release before HOLD_MS is not`, `a release
  farther than MOVE_TOLERANCE_PX is not`, the last moved 4 px on each axis (5.7 px away).
- [ ] **Step 2:** Run them: they fail. Write `isStillHold`; run them: they pass.
- [ ] **Step 3:** In `src/view/hold-mouse.ts`, one delegated `pointerdown` and `pointerup` pair on
  the list's rows, for `pointerType === 'mouse'`, the main button and no modifier. A hold counts on
  a row's or a heading's own area only: not on its checkbox, a link, the collapse arrow, or inside
  the open card. A still hold calls `selectOnHold` with the open card's item, as touch does, and
  sets `view.swallowNextClick`. A `dragstart` forgets the press. Desktop only, from `list-view.ts`;
  `swallowClickAfterHold` in `events.ts` moves out of the `Platform.isMobile` block, so it runs on
  every platform.
- [ ] **Step 4:** Add "Select" with the `square-check` icon to an item's menu and a heading's menu
  in `menus.ts`, calling `selectRow`, shown while that row isn't selected. Check the icon draws, in
  Obsidian at `minAppVersion` too.
- [ ] **Step 5:** `npm run lint`, `npm run build`, `npm test` pass.
- [ ] **Step 6: Check on macOS** as Task 2 does: Review Focus items 2 and 3; a hold on a checkbox
  or a link does what a click there does; a hold with a card open selects both; Select from a row's
  right-click menu, a heading's menu and a card's ⋯. Write risk 7's result in the design. Then on
  the Android emulator: Select from a card's ⋯ and the heading menu.
- [ ] **Step 7:** Set the design's `status: live` once every risk has its result.
- [ ] **Step 8: Commit** with the message "Select by holding with a mouse, or with Select in a
  row's menu (#79)".
