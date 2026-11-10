# PrinceLists selecting several rows Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select several items and headings in the list view, on desktop and mobile, and drag,
move, tick, star, date or delete them together, each group action with an Undo message.

**Architecture:**
- **The selection is a set of tracked lines,** `RowSelection` in `src/core/selection.ts`, built
  as `CollapsedHeadings` is: each row a `TrackedLine` from `ListEditing.track`, so it follows the
  view's own edits and outside changes, and a row whose line is gone drops out. The view holds one
  as `view.selection` and draws it on every redraw, since reused rows keep their old classes.
- **A group action is the single actions in sequence, in the text, then one write.** A group move
  runs `planItemMove` and `planSectionMove` one block at a time on the running text, and a group
  delete runs `planItemDelete` and `planHeadingDelete` from the bottom up, each line followed
  through every step. So a group of one row is exactly today's action, a group refuses whatever a
  single action refuses, and the whole is one `{ next, edit }` that the view writes through
  `writePlanned`: typing that lands meanwhile reruns it (step one, "Saving"), and one write is one
  history step.
- **The Undo message** after a group action takes the list's own Cmd+Z step while the list is
  still as the action left it, so the button and Cmd+Z can't disagree.
- **Mobile's selection mode** is a flag on the view, entered from `drag-touch.ts`'s release when the
  lift was never armed, and drawn as a class on `contentEl` plus a bar in the floating "+"'s place.

**Tech Stack:** as in step two. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-07-select-several-design.md`, "the design" below, which
leans on [step one](../specs/2026-10-20-prince-lists-design.md) and [step
two](../specs/2026-10-27-prince-lists-step-2-design.md), cited by heading.

**How work lands:** as in step two. Each task is one pull request that the owner squash-merges, so
"Commit with the message X" means the pull request's title is X. Each pull request updates the
design sections its task's Files list names, or says in one line that they still hold, and sets the
design's `verified` date. Manual checks run in a copy of the demo vault (AGENTS.md, "Commands"), on
desktop, and on an iPhone, an iPad or Android where a task says so.

**Order:** the design's. Tasks 1 to 4 are core, with tests written first; then desktop selecting,
desktop dragging, the menu, mobile selecting and mobile dragging.

## Global Constraints

- **Everything in the earlier plans' Global Constraints still holds,** and so does `AGENTS.md`.
- **List view only:** nothing here reaches the Schedule or a list inside another note; the block
  host (`src/view/block-drag.ts`) keeps dragging one row.
- **Words, verbatim from the design:** "Move to heading…", "Top of the list", "Tick", "Untick",
  "Add star", "Remove star", "Set date to today", "Set date to tomorrow", "Set date…", "Remove
  date", "Delete 5 items", "Delete 4 items and 1 heading", "5 selected", "Done", "Move to",
  "Star", "Date", "Delete". A heading named twice shows as "Frozen, 2 of 2".
- **The Undo message's words** follow "Item deleted." (`src/view/delete.ts:12`), with the counted
  phrase from `countPhrase` (Task 4): "5 items moved.", "2 items and 1 heading moved.", "3 items
  ticked.", "3 items unticked.", "2 items starred.", "Star removed from 2 items.", "Date set on 4
  items.", "Date removed from 4 items.", "4 items and 1 heading deleted.". A tick that skipped
  repeating items adds "1 repeating item skipped." or "2 repeating items skipped.".
- **Mobile's "without moving":** the lift's `armed` flag never set, which `MOVE_TOLERANCE_PX = 5`
  decides (`src/core/touch-drag.ts:2`).
- **Selected rows' background** comes from an Obsidian CSS variable, checked in the default theme
  in light and dark mode; no hard-coded color and no `:has()`.
- **Each file under about 300 lines:** `events.ts` (287), `menus.ts` (272) and `list-view.ts`
  (383) take new code in new modules and a call each, not new bodies.

## Review Focus

1. **An outside change while rows are selected** (Sync, an agent): rows the view can still find
   stay selected and the rest drop out, never a selected line pointing at another row. Task 1.
2. **Cmd+click with an empty new item's card open:** closing the card removes the item, so it must
   not stay selected. Task 1 (a line that goes drops out) and Task 5's manual check.
3. **A drop or a place on a row that is itself moving:** it resolves around the selection, never
   inside a moved block. Tasks 2 and 3.
4. **Undo of a group delete is byte for byte,** a heading and its items included. Task 4.
5. **A filter or collapse after selecting** prunes hidden rows, the anchor included, so Delete
   names only rows on screen. Task 1 (`keepOnly`) and Task 5.

---

### Task 1: The selection, in core

**Files:**
- Create: `src/core/selection.ts`
- Test: `tests/core/selection.test.ts`
- Modify: the design's header (`status: building`, `governs: [src/**, styles.css]`, `verified`),
  `AGENTS.md` ("Read before working": the design)

**Interfaces:**
- Consumes: `ListEditing.track(line): TrackedLine` and `untrack` (`src/core/editing.ts:63,69`).
- Produces:
  ```ts
  export class RowSelection {
  	constructor(editing: ListEditing);
  	get size(): number;
  	get anchor(): number | null;
  	has(line: number): boolean;
  	lines(): number[];                  // ascending; gone lines dropped and untracked
  	setAnchor(line: number | null): void;
  	toggle(line: number): void;
  	selectRange(to: number, shown: readonly number[]): void;
  	extend(step: 1 | -1, shown: readonly number[]): void;
  	keepOnly(shown: ReadonlySet<number>): void;
  	clear(): void;
  }
  ```
  `shown` is the shown rows' lines in list order (`shownRows(listEl).map((r) => r.line)`).
- The selection is the rows chosen one at a time plus the current range, the shown rows from the
  anchor to the range's far end. `toggle` keeps the current range as chosen rows, adds or removes
  the line, makes it the anchor and ends the range. `setAnchor` ends the range. `selectRange` and
  `extend` replace only the range (the design's "a second Shift+click replaces the range"), and
  with no anchor, or an anchor not in `shown`, `selectRange` toggles the line. `keepOnly` drops
  the rows and the anchor not in the set; a range whose far end it drops ends, its other rows kept
  as chosen rows.

- [ ] **Step 1: Write the failing tests** in `tests/core/selection.test.ts`, building `ListEditing`
  as `tests/core/collapsed.test.ts:10-15` does, with its `TEXT` (lines 3 `a`, 4 `## B`, 5 `b`, 6
  `## C`, 7 `c`) and `const SHOWN = [3, 4, 5, 6, 7]`:
  - `toggle adds and removes a row and moves the anchor`: `toggle(3); toggle(7)` → `lines()`
    `[3, 7]`, `anchor` `7`; `toggle(3)` → `[7]`, `anchor` `3`.
  - `selectRange selects the shown rows from the anchor`: `setAnchor(4); selectRange(6, SHOWN)` →
    `[4, 5, 6]`; then `selectRange(3, SHOWN)` → `[3, 4]`.
  - `a second range replaces the first and keeps rows chosen one at a time`: `toggle(3);
    toggle(6); selectRange(7, SHOWN)` → `[3, 6, 7]`; `selectRange(5, SHOWN)` → `[3, 5, 6]`.
  - `toggle keeps the range`: `setAnchor(4); selectRange(5, SHOWN); toggle(7)` → `[4, 5, 7]`.
  - `selectRange skips rows that aren't shown`: `setAnchor(3); selectRange(7, [3, 6, 7])` →
    `[3, 6, 7]`.
  - `selectRange with no anchor selects the row alone`: `selectRange(5, SHOWN)` → `[5]`, `anchor`
    `5`.
  - `extend grows and shrinks the range from the anchor`: `toggle(5)`; `extend(1, SHOWN)` →
    `[5, 6]`, again → `[5, 6, 7]`, again → `[5, 6, 7]`; `extend(-1, SHOWN)` → `[5, 6]`, again →
    `[5]`, again → `[4, 5]`.
  - `extend does nothing with no anchor`: `extend(1, SHOWN)` leaves `[]`.
  - `keepOnly drops rows and an anchor no longer shown`: `toggle(3); toggle(5);
    keepOnly(new Set([3]))` → `[3]`, `anchor` `null`.
  - `keepOnly ends a range whose far end is hidden`: `setAnchor(3); selectRange(5, SHOWN);
    keepOnly(new Set([3, 4]))` → `[3, 4]`, `anchor` `3`; then `extend(1, [3, 4, 6, 7])` → `[3, 4]`.
  - `the selection follows the view's own edits`: select `[5, 6]`, apply
    `planSectionMove(TEXT, 3, 6, 4)` through `editing.applyOwn` → `[4, 7]`; on a fresh selection
    of `[4, 6]`, insert an empty item after line 3 as `collapsed.test.ts:27-30` does → `[5, 7]`.
  - `a row whose line goes drops out`: select `[5, 7]`, apply an own `'delete'` edit of line 5 →
    `[6]`, `size` `1`.
  - `an outside change keeps the rows it can still find`: select `[5, 7]`, call
    `editing.outsideChange` with `TEXT` whose line 7 reads `- [ ] c2` → `[5]`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run tests/core/selection.test.ts`
  Expected: FAIL, `src/core/selection.ts` doesn't exist.

- [ ] **Step 3: Implement `RowSelection` in `src/core/selection.ts`**

  A `Set<TrackedLine>` of chosen rows as in `CollapsedHeadings`, plus the anchor and the range's far
  end as `TrackedLine | null`; the range's rows are worked out from `shown` when it's set and kept
  as tracked lines.

- [ ] **Step 4: Run the tests to see them pass**

  Run: `npm test`
  Expected: PASS, all files.

- [ ] **Step 5: Mark the design as building** and add it to `AGENTS.md`'s "Read before working".
  Run `node scripts/check-docs.mjs`: passes.

- [ ] **Step 6: Commit** with the message `Track a selection of several rows in core (#79)`.

### Task 2: Moving several rows in one write

**Files:**
- Create: `src/core/group-actions.ts`
- Test: `tests/core/group-move.test.ts`

**Interfaces:**
- Consumes: `planItemMove`, `planSectionMove`, `endOfSection`, `ItemPlace`
  (`src/core/list-actions.ts:13,85,113,125`), `parse`, `itemAt` (`src/core/parse.ts`),
  `followLine`, `moveEdit`, `OwnEdit` (`src/core/follow.ts:10,58,65`).
- Produces:
  ```ts
  export interface PlannedGroupEdit { next: string; edit: OwnEdit }
  export type GroupPlace = ItemPlace | { beforeSection: number | null } | { endOf: number | null };
  export function planGroupMove(text: string, contentStart: number, rows: readonly number[], place: GroupPlace): PlannedGroupEdit | null;
  ```
  `rows` are title lines and heading lines in any order. `{ beforeSection: h }` puts the sections
  before heading `h`, or at the end when `null`. `{ endOf: h }` puts the items after the last item
  of `h`'s section, or of the part before the first heading when `null` (Move to heading…). `null`
  when a row is gone or nothing would change; throws `UnsafeEditError` as the single moves do.

- [ ] **Step 1: Write the failing tests** in `tests/core/group-move.test.ts`, with
  `const FRONT = '---\nprincelists: true\n---\n'`, `const TEXT = FRONT + '- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n'`
  and `const body = (t: string | undefined) => t?.slice(FRONT.length)`:
  - `moves loose items together, in file order`: `planGroupMove(TEXT, 3, [7, 3], { firstUnder: 4 })` → body `'## B\n- [ ] a\n- [ ] c\n- [ ] b\n## C\n'`.
  - `puts loose items before sections`: `planGroupMove(TEXT, 3, [3, 6], { beforeSection: 4 })` → body `'- [ ] a\n## C\n- [ ] c\n## B\n- [ ] b\n'`.
  - `moves a selected heading's selected item once`: `[6, 7]` with `{ beforeSection: 4 }` gives the same `next` as `[6]`.
  - `an item place on a moving row resolves to the nearest place above that isn't moving`: `[3, 5]` with `{ after: 5 }` → body `'## B\n- [ ] a\n- [ ] b\n## C\n- [ ] c\n'`.
  - `a section place on a moving heading resolves to the next heading below that isn't moving`: on `FRONT + '## B\n- [ ] b\n## C\n- [ ] c\n## D\n- [ ] d\n'` (headings on 3, 5, 7), `[5]` with `{ beforeSection: 5 }` → `null`, since the place resolves to `7`; `[3, 7]` with `{ beforeSection: 7 }` → body `'## C\n- [ ] c\n## B\n- [ ] b\n## D\n- [ ] d\n'`, the place resolving to the end.
  - `moves to the end of a heading's section`: `[3]` with `{ endOf: 6 }` → body `'## B\n- [ ] b\n## C\n- [ ] c\n- [ ] a\n'`; `[7]` with `{ endOf: null }` → body `'- [ ] a\n- [ ] c\n## B\n- [ ] b\n## C\n'`.
  - `moves selected items already under the heading to its end too`: on `FRONT + '- [ ] a\n## B\n- [ ] b\n- [ ] d\n## C\n- [ ] c\n'`, `[5, 3]` with `{ endOf: 4 }` → body `'## B\n- [ ] d\n- [ ] a\n- [ ] b\n## C\n- [ ] c\n'`.
  - `returns null when nothing moves`: `[5]` with `{ firstUnder: 4 }` → `null`.
  - `a group of one row is the single move`: as `tests/core/move-item.test.ts:105-111` loops, for every text in `JOINING_CASES` and `FIXTURES`, and the `crlf` copy of each, with `contentStartOf(splitLines(text))`: every item to every place gives the same `next` as `planItemMove` (`{ firstIn: s }` as `{ firstUnder: s.headingLine }`, or `'first'` for the part before the first heading), and every heading before every other heading or `null` the same as `planSectionMove`, or both throw `UnsafeEditError`.
  - `refuses what a single move refuses`: `planGroupMove(REFUSED_CASES.widerColumnDelete, 0, [0], { after: 1 })`, `planGroupMove(REFUSED_CASES.widerColumnDelete, 0, [1], 'first')` and `planGroupMove(REFUSED_CASES.widerColumnMove, 0, [1], { after: 3 })` throw `UnsafeEditError`.
  - `moves several blocks across a setext heading, byte for byte` (the design's risk 1): on `JOINING_CASES.setextHeadingTop2` (lines 5 `Kitchen`, 7 `a`, 9 `Hall`, 11 `b`), `[9, 7]` with `{ beforeSection: 5 }`, and `[7, 11]` with `{ endOf: 9 }`. For each, on the text, its `crlf` copy and a copy without the final newline: parsing `next` gives the headings in the order `Hall`, `Kitchen` (first) or the items `a`, `b` under `Hall`, in file order (second); `expectRestKept(text, next)` passes; the copy keeps CRLF on every line and its missing final newline.
  - `adds an empty line only where the final arrangement needs one`: on `'Set\n===\n- [ ] s\n## H\n- [ ] h\n## K\n- [ ] i\n'`, `planGroupMove(text, 0, [3, 6], { beforeSection: 0 })` → `'- [ ] i\n## H\n- [ ] h\n\nSet\n===\n- [ ] s\n## K\n'`: the step that puts `i` before `Set` alone would need an empty line after `i`, and the final order doesn't.
  - `maps each line`: a `RowSelection` over `[3, 7]` follows the first test's `edit` to `[4, 5]`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run tests/core/group-move.test.ts`
  Expected: FAIL, `planGroupMove` isn't defined.

- [ ] **Step 3: Implement `planGroupMove` in `src/core/group-actions.ts`**

  1. Parse once. A selected heading's selected items are dropped from `rows`: they come with it.
  2. Resolve the place against the moving rows: an `{ after }` or `{ firstUnder }` on a moving row
     takes the nearest item above it in its section that isn't moving, else `{ firstUnder }` its
     heading, else `'first'`; a `{ beforeSection }` or `{ endOf }` on a moving heading takes the
     next heading below that isn't moving, else `null`.
  3. Loose items, in file order, each with `planItemMove` on the running text: the first to the
     place, each after it to `{ after: the previous item's line now }`. `{ endOf: h }` is
     `endOfSection` of `h`'s section. With a section in the group, the first loose item goes to
     `endOfSection` of the nearest section above the resolved heading that isn't moving.
  4. Then each section, in file order, with `planSectionMove` before the resolved heading's line
     now, or at the end.
  5. Follow every original line through each step with `followLine(line, step.edit)`; a step that
     returns `null` is skipped. The steps only decide the order: sort the original lines by where
     they ended, drop the empty lines the steps added, and pass that order to `reorderChecked` once,
     which adds an empty line only where the final arrangement needs one (the design's "Dragging
     the selection"). The plan's `edit` is `moveEdit` of its map; `null` when the text ends as it
     began.

- [ ] **Step 4: Run the tests to see them pass**

  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit** with the message `Plan a move of several rows in one write (#79)`.

### Task 3: Aiming a drop for several rows

**Files:**
- Modify: `src/core/drop.ts`
- Test: `tests/core/drop.test.ts`

**Interfaces:**
- Consumes: `ShownRow` and the private `dropAbove` (`src/core/drop.ts:4,84`), `GroupPlace`
  (Task 2).
- Produces:
  ```ts
  export interface GroupDrop { place: GroupPlace; line: number; above: boolean }
  export function groupDropAt(shown: readonly ShownRow[], moving: readonly number[], over: { line: number; below: boolean }): GroupDrop | null;
  ```
  It reads `shown` without the moving rows. With no heading among `moving`, the place is
  `dropAbove`'s for the gap; with one, it is `{ beforeSection }` of the first heading at or after
  the gap, or `null` with the drop line under the last row, as `sectionDropAt` does. `null` when
  `over.line` isn't shown or is a moving row. A drop that would change nothing aims anyway, and
  `planGroupMove` returns `null` for it.

- [ ] **Step 1: Write the failing tests** in `tests/core/drop.test.ts`, with
  `const SHOWN: ShownRow[] = [{ line: 3, kind: 'item' }, { line: 4, kind: 'heading' }, { line: 5, kind: 'item' }, { line: 6, kind: 'heading' }, { line: 7, kind: 'item' }]`:
  - `aims items past the moving rows`: `groupDropAt(SHOWN, [3, 7], { line: 5, below: true })` → `{ place: { after: 5 }, line: 5, above: false }`.
  - `aims first under a heading`: `groupDropAt(SHOWN, [5, 7], { line: 4, below: true })` → `{ place: { firstUnder: 4 }, line: 4, above: false }`.
  - `skips an untouched row as an item drop does`: shown `[{ line: 3, kind: 'item' }, { line: 4, kind: 'untouched' }, { line: 5, kind: 'item' }]`, `[5]` over `{ line: 4, below: true }` → `{ place: { after: 3 }, line: 3, above: false }`.
  - `aims a selection with a heading as a section`: `groupDropAt(SHOWN, [3, 6], { line: 4, below: false })` → `{ place: { beforeSection: 4 }, line: 4, above: true }`.
  - `aims a section to the end under the last row`: `groupDropAt(SHOWN, [4], { line: 7, below: true })` → `{ place: { beforeSection: null }, line: 7, above: false }`.
  - `gives null over a moving row or a row not shown`: `[3, 5]` over `{ line: 5, below: false }` → `null`; over `{ line: 9, below: true }` → `null`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run tests/core/drop.test.ts`
  Expected: FAIL, `groupDropAt` isn't exported.

- [ ] **Step 3: Implement `groupDropAt` in `src/core/drop.ts`.**

- [ ] **Step 4: Run the tests to see them pass**

  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit** with the message `Aim a drop of several rows (#79)`.

### Task 4: Ticking, starring, dating and deleting several rows

**Files:**
- Modify: `src/core/group-actions.ts` (or create `src/core/group-edits.ts` if it passes 300 lines)
- Test: `tests/core/group-edits.test.ts`

**Interfaces:**
- Consumes: `tickLine`, `untickLine`, `isRepeating`, `isDoneStatus` (`src/core/item-line.ts`);
  `RepeatingItemError` (`src/core/edit-items.ts:14`); `setStar`, `isStarred`
  (`src/core/star.ts`); `setWhen`, `whenOf` (`src/core/when.ts`); `planItemDelete`,
  `planHeadingDelete` (`src/core/list-actions.ts:99,105`); `headingText`
  (`src/core/display.ts:187`); `PlannedGroupEdit` (Task 2).
- Produces:
  ```ts
  export interface PlannedGroupChange extends PlannedGroupEdit { changed: number; skipped: number }
  export interface GroupState { items: number; headings: number; anyUnticked: boolean; anyTicked: boolean;
  	anyUnstarred: boolean; anyStarred: boolean; anyDated: boolean }
  export function groupState(text: string, contentStart: number, rows: readonly number[]): GroupState;
  export function planGroupLineEdit(text: string, contentStart: number, rows: readonly number[], change: (line: string) => string): PlannedGroupChange | null;
  export function planGroupTick(text: string, contentStart: number, rows: readonly number[], done: boolean, now: Date): PlannedGroupChange | null;
  export function planGroupDelete(text: string, contentStart: number, rows: readonly number[]): PlannedGroupEdit | null;
  export interface HeadingChoice { label: string; headingLine: number | null }
  export function headingChoices(text: string, contentStart: number): HeadingChoice[];
  export function countPhrase(items: number, headings: number): string;
  ```
  Headings in `rows` are skipped by the line edits and the tick. `changed` counts the items whose
  line changed, `skipped` the repeating items a tick left. `null` when a row is gone or nothing
  changes; `planGroupTick` throws `RepeatingItemError` when every item it would tick repeats, which
  `tryEdit` (`src/view/write.ts:114`) turns into its notice.

- [ ] **Step 1: Write the failing tests** in `tests/core/group-edits.test.ts`, with Task 2's
  `FRONT`, `TEXT` and `body`, and `const NOW = new Date(2026, 10, 7, 12, 0)`:
  - `ticks only the unticked items`: `planGroupTick(TEXT, 3, [3, 4, 7], true, NOW)` → line 3 `tickLine('- [ ] a', NOW)`, line 7 `tickLine('- [ ] c', NOW)`, every other line the same, `changed` `2`, `skipped` `0`.
  - `skips a repeating item and counts it`: with line 7 `'- [ ] c 🔁 every day'`, `[3, 7]` → `changed` `1`, `skipped` `1`, line 7 unchanged; `[7]` alone throws `RepeatingItemError`.
  - `returns null when nothing changes`: `planGroupTick(TEXT, 3, [3, 7], false, NOW)` → `null`.
  - `edits each item's line and no other`: `planGroupLineEdit(TEXT, 3, [3, 4, 5], (l) => setStar(l, true))` → lines 3 and 5 equal `setStar`'s result, the rest byte for byte, `edit.kind` `'change'`, `changed` `2`.
  - `groupState counts what the selection holds`: `[3, 4, 7]` on `TEXT` → `{ items: 2, headings: 1, anyUnticked: true, anyTicked: false, anyUnstarred: true, anyStarred: false, anyDated: false }`.
  - `deletes items and headings, keeping a lone heading's items`: `planGroupDelete(TEXT, 3, [3, 6])` → body `'## B\n- [ ] b\n- [ ] c\n'`.
  - `deletes a heading with its selected items`: `[6, 7]` → body `'- [ ] a\n## B\n- [ ] b\n'`.
  - `a group delete undoes byte for byte`: for `[3, 6]` and `[6, 7]`, `history.wrote(TEXT, next, edit)` then `history.undo(next)` gives `next` `TEXT`; the same on the `crlf` copy and a copy without the final newline. For `[3, 6]`, the undo's `edit` takes lines `[4, 5]` back to `[5, 7]` under `followLine`.
  - `deleting one row is the single delete`: `[3]` gives the same `next` as `planItemDelete(TEXT, 3, 3)`; `[6]` the same as `planHeadingDelete(TEXT, 3, 6)`.
  - `maps each line through a delete`: a `RowSelection` over `[5, 7]` follows `[3, 6]`'s `edit` to `[4, 5]`.
  - `lists the headings to move to`: `headingChoices(TEXT, 3)` → `[{ label: 'Top of the list', headingLine: null }, { label: 'B', headingLine: 4 }, { label: 'C', headingLine: 6 }]`; on `FRONT + '## F\n## G\n## F\n'` the labels are `'Top of the list'`, `'F, 1 of 2'`, `'G'`, `'F, 2 of 2'`.
  - `names a count of items and headings`: `countPhrase(5, 0)` `'5 items'`, `(4, 1)` `'4 items and 1 heading'`, `(1, 0)` `'1 item'`, `(0, 2)` `'2 headings'`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run tests/core/group-edits.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement them**

  The line edits and the tick keep the line count, so their edit is `{ start: the first changed
  line, delta: 0, kind: 'change' }`. The delete runs `planItemDelete` or `planHeadingDelete` for
  each row from the bottom up on the running text, follows every line through each step's edit with
  `followLine`, and returns `moveEdit` of the composed map, `null` for the deleted lines; history
  inverts it with `movedBack`, so it needs no `undo` of its own. A heading's label in
  `headingChoices` is `headingText`, as the view shows it.

- [ ] **Step 4: Run the tests to see them pass**

  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit** with the message `Plan ticks, stars, dates and deletes of several rows (#79)`.

### Task 5: Selecting on desktop

**Files:**
- Create: `src/view/select.ts`
- Modify: `src/view/list-view.ts` (`selection: RowSelection`, cleared in `onClose`),
  `src/view/events.ts` (one call in `onClick` after `handleLinkClick`, and a delegated
  `mousedown`), `src/view/keys.ts` (Shift+ArrowUp, Shift+ArrowDown, and Mod+Enter calling
  `newItemBelowSelection`), `src/view/redraw.ts` (`drawSelection` at the end), `styles.css`
- Modify: step one's "Selecting and adding" and "Ticking"

**Interfaces:**
- Consumes: `RowSelection` (Task 1), `shownRows` (`src/view/move.ts:16`), `closeCard`, `openCard`,
  `newItem` (`src/view/add-button.ts:25`), `Keymap.isModifier(evt, 'Mod')` and `'Shift'`.
- Produces:
  ```ts
  export const SELECTED_CLASS = 'princelists-selected';
  export function onSelectClick(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean;
  export function extendSelection(view: PrinceListView, step: 1 | -1): boolean;
  export function drawSelection(view: PrinceListView): void;
  export function newItemBelowSelection(view: PrinceListView): void;
  ```
  `onSelectClick` returns true when it handled the click: Cmd or Shift held on a row, a heading, a
  checkbox or the zone beside it. Links come first, since `handleLinkClick` runs before it.
  Cmd+click and Shift+click close an open card first, its item selected. A plain click on a row
  calls `clear()` and `setAnchor(line)` and returns false, so the card opens as today; a plain click
  on a checkbox or the zone beside it returns false and leaves the selection. `drawSelection` calls
  `keepOnly` with the shown rows, sets `SELECTED_CLASS` and the accessible state on every row, and
  announces the count. `newItemBelowSelection` adds below the last selected item in list order with
  two or more selected, else calls `newItem`; the floating "+" keeps calling `newItem`.

- [ ] **Step 1: Wire the selection.** Cmd+click toggles; Shift+click calls `selectRange` with the
  shown rows, the open card's item as anchor when there is one. Escape clears it in a last branch
  of `onKeyDown`'s Escape handling (`src/view/events.ts:217-233`), so the filter, the tag field,
  the card, the heading field and the list's title keep their Escape; a click on empty space clears
  it too.
  `newItemBelowSelection` clears the selection when it opens the new item's card. A `mousedown` with Shift held
  on a row calls `preventDefault`, so the browser doesn't start selecting text.
- [ ] **Step 2: Mark the rows.** `SELECTED_CLASS` takes a background from an Obsidian CSS variable;
  the accessible pattern for rows that hold a checkbox and for `role="heading"`, named in the pull
  request; the count announced. `tests/styles.test.ts` still passes.
- [ ] **Step 3: Check focus (the design's risk 6):** after Cmd+click closes the card, Shift+Up and
  Shift+Down reach the view through its `scope` without making rows focusable.
- [ ] **Step 4: Run the checks**

  Run: `npm run lint && npm run build && npm test`
  Expected: no warnings, a build, all tests passing.

- [ ] **Step 5: Check by hand on desktop:** Cmd+click two items; Shift+click a range across a
  heading, then Cmd+click a row outside it, then Shift+click again (the Cmd row stays); Shift+Up
  and Shift+Down from an open card and after Cmd+click; a plain click on a checkbox ticks one item
  and keeps the selection; Cmd+click on a checkbox selects; Cmd+click on a link opens a tab;
  Escape clears; collapsing a section drops its selected rows; Cmd+click with an empty new item
  open removes it and leaves only the clicked row; Cmd+Enter with three rows selected; no text
  selected by Shift+click; light and dark mode.
- [ ] **Step 6: Commit** with the message `Select several rows with Cmd and Shift on desktop (#79)`.

### Task 6: Dragging the selection on desktop

**Files:**
- Create: `src/view/group-write.ts`
- Modify: `src/view/drag-host.ts` and `src/view/block-drag.ts` (`RowDragHost.dragged`),
  `src/view/drag-mouse.ts`, `src/view/move.ts` (`queueGroupMove`), `src/view/undo.ts` (export
  `undoStep`), `styles.css`
- Modify: step one's "Dragging" and step two's "Dragging a heading"

**Interfaces:**
- Consumes: `planGroupMove` (Task 2), `groupDropAt` (Task 3), `countPhrase` (Task 4), `writeStep`
  (`src/view/undo.ts:46`), `showUndoNotice` (`src/view/delete.ts:43`), `writePlanned`, and
  `queueMove`'s pattern (`src/view/move.ts:53-76`).
- Produces:
  ```ts
  // src/view/undo.ts: Cmd+Z's write, without the field checks
  export function undoStep(view: PrinceListView): void;
  // src/view/group-write.ts
  export function offerGroupUndo(view: PrinceListView, message: string, after: string): void;
  export function queueGroupAction<T extends PlannedGroupEdit>(view: PrinceListView, rows: readonly number[],
  	plan: (text: string, contentStart: number, rows: readonly number[]) => T | null, message: (written: T) => string): void;
  // src/view/move.ts
  export function queueGroupMove(view: PrinceListView, rows: readonly number[], place: GroupPlace, message: string): void;
  // RowDragHost
  dragged(line: number): readonly number[];
  // src/view/move.ts: a third arm, which queueDrop sends to queueGroupMove and markDrop draws
  export type RowDrop = { item: Drop } | { section: SectionDrop } | { group: GroupDrop };
  ```
  `queueGroupAction` and `queueGroupMove` do what `queueMove` does: track every row (and the
  place's line) before the queue's wait, read their lines inside the `writePlanned` callback, end
  with a Notice when one is gone, expand a collapsed target, `view.render()` after a write, untrack
  in `finally`, and offer the Undo message only when something was written. `offerGroupUndo`'s
  button calls `undoStep` while `view.text === after`, else shows "This list changed elsewhere, so
  it can't be undone.". `dragged` gives the selection's lines for a selected row while two or more
  are selected, else `[line]`; the block host always gives `[line]`.

- [ ] **Step 1: Carry the selection.** A drag of a selected row aims with `groupDropAt` and shows
  the count on the lifted row (`data-princelists-count`, drawn in `styles.css`). A drag of a row
  outside it clears the selection and drags that row alone, as today.
- [ ] **Step 2: Write it** with `queueGroupMove(view, rows, place, '5 items moved.')`, the count from
  `countPhrase`: the selected headings, and the selected items outside a selected heading's
  section, since those inside come with it.
- [ ] **Step 3: Run the checks:** `npm run lint && npm run build && npm test` pass.
- [ ] **Step 4: Check by hand:** drag three items from two sections under a third; a heading and a
  loose item before another heading; a drop beside a moving row; Cmd+Z and the Undo button each
  put it back once; the Undo button after typing in a card says the list changed; a setext list
  made in the demo copy for the check gets its empty line.
- [ ] **Step 5: Commit** with the message `Drag a selection of rows as one block on desktop (#79)`.

### Task 7: The selection's menu

**Files:**
- Create: `src/view/selection-menu.ts`, `src/view/heading-picker.ts`, `src/view/date-modal.ts`
- Modify: `src/view/menus.ts` (`menuAt` calls the selection's menu for a selected row while two or
  more are selected)
- Modify: step one's "Item actions" and step two's "Collapsing a heading"

**Interfaces:**
- Consumes: Task 4's planners, `groupState`, `headingChoices`, `countPhrase`; `queueGroupAction`,
  `queueGroupMove` (Task 6); `setStar`, `setWhen`, `dayOf`, `dayAfter`; `SuggestModal`, `Modal` and
  `MenuItem.setWarning` (`obsidian.d.ts`).
- Produces:
  ```ts
  export function addGroupEntries(view: PrinceListView, menu: Menu, only?: 'tick' | 'star' | 'date'): void;
  export function moveToHeading(view: PrinceListView): void;
  export function deleteSelection(view: PrinceListView): void;   // also ends selecting on mobile
  export class HeadingPickerModal extends SuggestModal<HeadingChoice> {}
  export class DateModal extends Modal {}                        // an <input type="date">, Set and Cancel
  ```
  `only` lets mobile's bar (Task 8) show one group of entries. `moveToHeading` opens the picker
  and calls `queueGroupMove` with `{ endOf }`.

- [ ] **Step 1: Build the menu:** Move to heading… (hidden while a heading is selected or the list
  has no headings), Tick and Untick, Add star and Remove star, the four date entries, then Delete
  with `setWarning` and `'Delete ' + countPhrase(…)`, each shown by `groupState`. Each goes through
  `queueGroupAction` with the Undo message's words; a tick with `skipped` adds them.
- [ ] **Step 2: The picker** narrows as you type; a pick expands a collapsed target first.
- [ ] **Step 3: Set date…** opens `DateModal`, whose input the user taps or clicks, so the picker
  opens on a real user action with Native menus on or off. If a platform doesn't open it, stop and
  raise it with the owner (the design's risk 2).
- [ ] **Step 4: Run the checks:** `npm run lint && npm run build && npm test` pass.
- [ ] **Step 5: Check by hand on desktop, Native menus on and off:** every entry on a mixed
  selection; Move to heading… with a duplicate heading name and a collapsed target; Delete of two
  items and a heading, then Undo; right-click on a row outside the selection opens its own menu.
- [ ] **Step 6: Commit** with the message `Act on a selection from its right-click menu (#79)`.

### Task 8: Selecting on mobile

**Files:**
- Create: `src/view/selection-bar.ts`
- Modify: `src/view/drag-host.ts` and `src/view/block-drag.ts` (`RowDragHost.selectHold`, a no-op
  in the block host), `src/view/drag-touch.ts` (`pointerup`), `src/view/select.ts` (taps while
  selecting), `src/view/list-view.ts` (`selecting: boolean`; `syncButtons` shows the bar instead
  of the floating "+"), `styles.css` (selection circles under `.princelists-selecting`)
- Modify: step one's "Selecting and adding", "Ticking", "Item actions", "Dragging", "Touch on
  mobile" and "Undo"; step two's "Dragging a heading" and "Collapsing a heading"

**Interfaces:**
- Consumes: Tasks 1, 4 and 7 (`addGroupEntries(view, menu, only)`, `moveToHeading`,
  `deleteSelection`), `queueGroupAction` (Task 6).
- Produces: `RowDragHost.selectHold(line: number): void`; `buildSelectionBar(view: PrinceListView):
  HTMLElement` and `syncSelectionBar(view: PrinceListView): void` in `src/view/selection-bar.ts`.

- [ ] **Step 1: Start and end selecting.** At `pointerup`, a lift that was never armed calls
  `host.selectHold(line)` and drops nothing, even if `lift.drop` is set. The list host's
  `beforeLift` keeps the open card's item as a tracked line before it closes the card, so
  `selectHold` selects it with the held row. While selecting, a tap on a row or heading toggles it
  (before the tick and the heading menu in `onClick`), and a still hold on another row selects the
  range from the last row tapped. Done or Delete ends selecting, and so does an empty selection
  after any redraw (a tap, a filter, a collapse, an outside change).
- [ ] **Step 2: The bar:** "5 selected", Done, Move to, Tick, Star, Date and Delete. Tick, Star
  and Date open a `Menu` of `addGroupEntries(view, menu, only)`; a button with nothing to act on is
  disabled; Move to is disabled while a heading is selected or the list has no headings. Every bar
  action offers the Undo message, one row included.
- [ ] **Step 3: Android's back gesture (the design's risk 5):** look for a documented way in
  `obsidian.d.ts` to hear it; with none, Done alone ends selecting, and the pull request says so.
- [ ] **Step 4: Run the checks:** `npm run lint && npm run build && npm test` pass.
- [ ] **Step 5: Check by hand on an iPhone, an iPad and Android:** a still hold starts selecting
  and the tap after it is swallowed (risk 4); a hold that moves still drags one row; a lift that
  moves past 5 px and comes back drags; a hold with a card open selects both; the bar sits above
  Obsidian's navigation bar and the on-screen keyboard without covering the last rows (risk 3);
  circles replace checkboxes; each button on a mixed selection; Undo.
- [ ] **Step 6: Commit** with the message `Select several rows on mobile, with a bar for the actions (#79)`.

### Task 9: Dragging the selection on mobile

**Files:**
- Modify: `src/view/drag-touch.ts`
- Modify: step one's "Touch on mobile"

**Interfaces:**
- Consumes: `RowDragHost.dragged(line)`, `groupDropAt` and `queueGroupMove` (Tasks 3 and 6).

- [ ] **Step 1: Carry the selection.** A hold that moves on a selected row lifts that row with the
  count and carries the selection, as Task 6 does on desktop; the other rows stay until the drop
  redraws. A drag of a row outside the selection drags it alone and ends selecting.
- [ ] **Step 2: Run the checks:** `npm run lint && npm run build && npm test` pass.
- [ ] **Step 3: Check by hand on an iPhone and Android:** drag a selection with a heading to the end
  of the list with edge scrolling; Undo after it.
- [ ] **Step 4: Mark the design live** (`status: live`, `verified`) once every section holds.
- [ ] **Step 5: Commit** with the message `Drag a selection of rows on mobile (#79)`.
