# PrinceLists repeating items Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ticking a repeating item moves it to its next date on the same line, and a repeat can be
set from the card or the row's menu (#320).

**Architecture:**
- **`src/core/repeat.ts` is the calculator:** it reads and writes the rules and ends the design
  lists, and steps a date. Dates are `YYYY-MM-DD` strings, counted with `Date.UTC` and the
  `getUTC*` getters, never with milliseconds in local time.
- **`src/core/repeat-line.ts` applies it to a title line:** which repeat a line has, ticking it, and
  setting or removing one. The `🔚` end becomes its own part of `ItemLineParts`, between the title
  and the `✔` marks.
- **The tick stays one write:** `toggleItem` moves a repeating item and unticks its checklist in the
  same lines, and each tick surface shows the next date with an Undo button.
- **The popover is built as the card's tag popover is** (`src/view/card-tags.ts`), from Obsidian's
  `DropdownComponent`, `TextComponent` and `ButtonComponent`.

**Tech Stack:** as in step two. No new dependency.

**Design:** [repeating items](../specs/2026-11-13-repeating-items-design.md).

**How work lands:** one pull request per task, from `main`, squash-merged by the owner, so "Commit
with the message X" means the pull request's title is X. Each task updates the design sections it
names, or says in one line that they still hold, and sets `verified`. Task 1 sets the design's
`status` to `building` with `governs: [src/**, styles.css]`, and Task 5 sets it to `live`. Manual
checks run in a test vault (AGENTS.md, "Working on a change"), on macOS and on the Android
emulator, with the steps each task lists. iOS isn't reachable for these checks; #372 tracks it.

## Global Constraints

- AGENTS.md's rules: Obsidian's CSS variables only, no hard-coded colors, no `:has()`, documented
  APIs only, sentence case, listeners through `registerDomEvent`, one delegated listener per
  container. An edit replaces only the lines it concerns.
- No `rrule` and no code ported from Tasks.
- Rules are written in Tasks' wording, lower case, with N from 2 up: `every day`, `every 3 days`,
  `every 2 months on the last`, `every week when done`. Ends: `🔚 2026-12-31`, `🔚 5x`.
- "Today" is `dayOf(now)` at the moment of the tick or the save (`src/core/when.ts`), never a date
  kept from a render.
- Copy, verbatim:
  - The menu entry `Repeat…`, icon `repeat`; the row's and the card's icon Lucide `repeat`, the
    row's with the label `Repeats`, the card's button `Repeat`.
  - The tick's notice `Next: Tue 17 Nov.`, from `nextDayMessage` (Task 3), with Undo.
  - Refusals: `This item repeats in a way PrinceLists can't follow, so it isn't ticked.`,
    `This item's 🔚 end can't be read, so it isn't ticked.`, `This item has a date that doesn't
    exist, so it isn't ticked.`
  - The selection's skip: `1 item that can't repeat skipped.`, `2 items that can't repeat skipped.`
  - Clearing a date that ends a repeat: `The repeat was removed with the date.`
  - An Undo that comes too late, in a list inside another note: `This list changed since the
    tick, so it can't be undone.` The list view's keeps `CANT_UNDO_NOTICE`, and the Schedule's
    `editListFile`'s own notice.
  - The popover (Task 5): dialog name `Repeat`; `Every`, with the units `day`, `days`, `week`,
    `weeks`, `month`, `months`, `year`, `years`; `Counted from` with `Its date` and `When it's
    ticked`; for months `On` with `The same day` and `The last day`; `Ends` with `Never`, `On a
    date` and `After`, then the number and `times`; `Next: ` and up to three dates; the buttons
    `Save` and `Remove repeat`; for a rule it can't write, `Repeats: ` and the rule as written.
- The popover looks as the card's tag popover does: `--background-modifier-border`, `--radius-m`,
  `--shadow-s`, the card's background, `z-index: var(--layer-popover)`, never wider than the card.
  Not the HTML `popover` attribute.
- Each task updates the comments and doc comments its change makes false, and removes code it
  leaves unreachable.

## Review Focus

1. **Two quick taps on a repeating box** move the item twice, one date each, and Undo or Cmd+Z
   takes back one move at a time; neither tap is dropped or doubled (Task 3).
2. **A `🔁` the field pattern can't take** (`- [ ] fix the 🔁 icon's color`) isn't a repeat: it
   ticks as any item and shows no icon. One it takes (`- [ ] fix the 🔁 every day bug`) is a rule
   it can't read, and refuses the tick (Task 2).
3. **A checklist line inside a code block, a callout or a `%%` comment** stays as typed when its
   item moves (Task 3).
4. **A tick just after midnight** counts from the new day, and one just before from the old (Task 2).
5. **A count typed by hand as `🔚 0x` or `🔚 -1x`** refuses the tick, and `🔚 05x` reads as 5
   (Task 1).

---

### Task 1: Repeat rules and dates

**Files:**
- Create: `src/core/repeat.ts`, `tests/core/repeat.test.ts`
- Modify: `src/core/when.ts` (export `isRealDay` and `utcOf`), the design's header

**Interfaces:**
- Produces, in `repeat.ts`:
  - `type RepeatUnit = 'day' | 'week' | 'month' | 'year'`
  - `interface RepeatRule { every: number; unit: RepeatUnit; onLast: boolean; whenDone: boolean }`
  - `type RepeatEnd = { kind: 'date'; day: string } | { kind: 'times'; left: number }`
  - `readRule(text: string): RepeatRule | null`, the text after `🔁` and its spaces; null for N
    above 9999
  - `writeRule(rule: RepeatRule): string`, without the `🔁`
  - `readEnd(text: string): RepeatEnd | null`, the text after `🔚` and its spaces
  - `writeEnd(end: RepeatEnd): string`, with the `🔚`
  - `addDays(day: string, days: number): string | null`; the days between two dates are
    `when.ts`'s `daysFrom`, and the arithmetic uses its `utcOf`, both exported
  - `stepDay(day: string, rule: RepeatRule): string | null`, one step
  - `nextDay(anchor: string, rule: RepeatRule, today: string): string | null`, the date a tick
    gives
  - The three give null for a date after 9999-12-31, which `YYYY-MM-DD` can't write.
  - `upcomingDays(anchor: string | null, rule: RepeatRule, end: RepeatEnd | null, today: string,
    count: number): string[]`, the dates the next `count` ticks give, stopping at the end

- [ ] **Step 1: Write the failing tests** in `tests/core/repeat.test.ts`:
  - `readRule` reads `every day` as `{ every: 1, unit: 'day', onLast: false, whenDone: false }`,
    `Every 3 Days` as every 3 days, `every 1 day` as every day, `every 2 weeks`, `every year`, and
    `every month on the last when done` with `onLast` and `whenDone`; it returns null for
    `every weekday`, `every week on Tuesday`, `every 0 days`, `every day on the last` and
    `every month on the 31st`.
  - `writeRule` writes `every day`, `every 3 days`, `every 2 months on the last` and
    `every week when done`.
  - `readEnd` reads `2026-12-31`, `5x`, `5X` and `05x` (5); it returns null for `0x`, `-1x`,
    `soon` and `2026-02-30`. `writeEnd` gives `🔚 2026-12-31` and `🔚 5x`.
  - `stepDay`: monthly from `2026-01-31` gives `2026-02-28` and from `2026-02-28` gives
    `2026-03-28`; yearly from `2024-02-29` gives `2025-02-28`; `every 2 months on the last` from
    `2026-11-14` gives `2026-11-30` and from `2026-11-30` gives `2027-01-31`; `every month on the
    last` from `2026-01-31` gives `2026-02-28`; `every 3 days` from `2026-11-13` gives
    `2026-11-16`; `every 2 weeks` from `2026-11-13` gives `2026-11-27`; daily from `2026-03-28`
    gives `2026-03-29`, across the EU clock change.
  - `nextDay`, today `2026-11-13`: weekly from `2026-11-01` gives `2026-11-15`; from `2026-11-20`
    (ticked early) `2026-11-27`; from `2026-11-13` (on the day) `2026-11-20`; monthly from
    `2026-01-31`, today `2026-04-15`, gives `2026-04-28`; `every month when done` from `2026-10-01`
    gives `2026-12-13`; `every month on the last when done` gives `2026-11-30`.
  - `upcomingDays`, today `2026-11-13`, weekly: from `2026-11-13` with no end, 3, gives
    `['2026-11-20', '2026-11-27', '2026-12-04']`; with `2x` left, `['2026-11-20']`; with the end
    `2026-11-30`, `['2026-11-20', '2026-11-27']`; daily from null gives `['2026-11-14',
    '2026-11-15', '2026-11-16']`.
- [ ] **Step 2:** `npm test -- repeat` fails: the module doesn't exist.
- [ ] **Step 3: Implement `repeat.ts`.** Rules are read case-insensitively from
  `^every(?: (\d+))? (day|week|month|year)s?( on the last)?( when done)?$`, after trimming, `on the
  last` only with months and N at least 1. A month step takes the same day N months on, or that
  month's last day when it is shorter. `on the last` takes the day's own month's last day when the
  day is before it, otherwise the last day N months on. `nextDay` with `whenDone` is one step from
  today; otherwise it steps from the anchor, then again from each result while the result is
  today or earlier. `upcomingDays` starts from `nextDay`, or one step from today without an
  anchor, then takes one `stepDay` from each date, counting a `times` end down and stopping past
  a `date` end.
- [ ] **Step 4:** `npm test`, `npm run lint` and `npm run build` pass.
- [ ] **Step 5:** The design's header gets `status: building`, `governs: [src/**, styles.css]` and
  `verified`; "The next date" still holds. Commit with the message "Calculate a repeating item's
  next date (#320)".

### Task 2: A line's repeat

**Files:**
- Create: `src/core/repeat-line.ts`, `tests/core/repeat-line.test.ts`
- Modify: `src/core/item-line.ts`, `src/core/edit-items.ts`, `src/core/group-edits.ts`,
  `src/core/tag-edit.ts`, `src/core/when.ts`, `src/core/empty-item.ts`, `src/core/star.ts`,
  `src/core/missing-typing.ts`, `src/core/display.ts`, `tests/core/item-line.test.ts`

**Interfaces:**
- Consumes: Task 1's `repeat.ts`.
- Produces:
  - `ItemLineParts.end: string`: on a line whose tail has a `🔁`, the `🔚` field at the end of the
    title, with the spaces before it, or `''`. `joinItemLine` puts it between `title` and `marks`.
  - In `repeat-line.ts`: `type RepeatProblem = 'rule' | 'end' | 'date'`;
    `interface LineRepeat { ruleText: string; rule: RepeatRule | null; end: RepeatEnd | null;
    problem: RepeatProblem | null }`; `repeatOf(line: string): LineRepeat | null`, null on a line
    that doesn't repeat; `anchorOf(line: string): string | null`; `hasDate(line: string): boolean`;
    `type RepeatTick = { kind: 'moved'; line: string; next: string } | { kind: 'ended'; line:
    string }`; `tickRepeating(line: string, now: Date): RepeatTick`; `setRepeat(line: string,
    rule: RepeatRule, end: RepeatEnd | null, today: string): string`; `removeRepeat(line: string):
    string`; `removeWhen(line: string): { line: string; repeatRemoved: boolean }`.
  - `RepeatingItemError` moves to `repeat-line.ts` with `readonly problem: RepeatProblem`, and
    `edit-items.ts` re-exports it as it does `UnsafeEditError`. Until Task 3, `toggleItem` and
    `planGroupTick` throw it with `'rule'`, as they refuse every repeat today.

- [ ] **Step 1: Write the failing tests.** `now` is `new Date(2026, 10, 13, 9, 0)` unless named.
  - `parseItemLine` of `- [x] Physio ⭐ 🔚 5x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14 ^id`
    gives the title `Physio ⭐`, the end ` 🔚 5x`, the marks ` ✔ 2026-11-14 18:05` and the tail
    ` 🔁 every day ⏳ 2026-11-14 ^id`, and `isStarred` is true; `- [ ] Countdown 🔚 5x` keeps it all
    in the title. `setTitle`, `tickLine` and `untickLine` keep the end where it was.
  - `repeatOf`: null for `- [ ] fix the 🔁 icon's color` and `- [ ] fix the 🔁 bug.`; the problem
    `rule` for `🔁 every weekday` and for `- [ ] fix the 🔁 every day bug`; `end` for `🔚 soon`,
    `🔚 0x`, and for `- [ ] Trip 🔚 next spring ⏳ 2026-11-13 🔁 every day`, whose `🔚` stays in
    the title; `date` for `⏳ 2026-02-30` or for a valid `📅` beside `⏳ 2026-02-30`. `anchorOf` takes `📅`, `📆` or `🗓` first, then `⏳` or `⌛`, then
    `🛫`, the earliest of a kind that appears twice.
  - `tickRepeating`:
    - `- [ ] Water ⏳ 2026-11-10 🔁 every 3 days` moves to `⏳ 2026-11-16`, `next` `2026-11-16`.
    - `- [ ] Rent ➕ 2026-11-01 🛫 2026-11-25 ⏳ 2026-11-28 📅 2026-12-01 🔁 every month` gives
      `🛫 2026-12-26`, `⏳ 2026-12-29` and `📅 2027-01-01`, with `➕` as written.
    - `- [ ] a ✅ 2026-11-05 ⏳️ 2026-11-13 🔁️ every week` gives `⏳️ 2026-11-20`, the `✅` and both
      U+FE0F kept.
    - `🔚 3x` becomes `🔚 2x`, also on `⏳ 2026-11-01 🔁 every day`, which skips several dates;
      `🔚 2026-12-31` stays as written on a move; `- [ ] Physio 🔚 1x ⏳ 2026-11-13 🔁 every day` ends as
      `- [x] Physio 🔚 1x ✔ 2026-11-13 09:00 ⏳ 2026-11-13 🔁 every day`; `🔚 2026-11-15` on
      `⏳ 2026-11-13 🔁 every 3 days` ends.
    - `- [ ] Stretch 🔁 every day` becomes `- [ ] Stretch 🔁 every day ⏳ 2026-11-14`.
    - `- [ ] Walk ⏳ 2026-11-12 🔁 every day` gives `2026-11-14` at `new Date(2026, 10, 13, 23, 59)`
      and `2026-11-15` at `new Date(2026, 10, 14, 0, 1)`.
    - Each problem above throws `RepeatingItemError` with that `problem`, and so does a move whose
      `nextDay` is null (`⏳ 9999-12-31 🔁 every day`), with `date`.
  - `setRepeat`, today `2026-11-13`: `- [ ] Water plants` with every 3 days gives
    `- [ ] Water plants ⏳ 2026-11-13 🔁 every 3 days`; `- [ ] Physio ⭐ ⏳ 2026-11-13` with every
    day and `5x` gives `- [ ] Physio ⭐ 🔚 5x ⏳ 2026-11-13 🔁 every day`; a line with `📅` only gets
    no `⏳`; a new rule replaces the old one in place, and a null end removes the end.
  - `removeRepeat` takes the `🔁` field and the end away with the spaces before them. `removeWhen`
    on `- [ ] a ⏳ 2026-11-13 🔁 every day` gives `- [ ] a` and `repeatRemoved: true`; on
    `- [ ] a ⏳ 2026-11-13 📅 2026-11-20 🔁 every day` it keeps the repeat.
- [ ] **Step 2:** `npm test` fails on the new tests.
- [ ] **Step 3: Implement.** In `parseItemLine`, the end is read from the title once the marks are
  off, with ` +🔚${VS16} *\S+$`, with `item-line.ts`'s `VS16`, and only when the tail matches `REPEAT_FIELD`; on such a line a
  `🔚` still in the title is the problem `end`. Every join of
  `parts.title + parts.marks` in `src/core` adds `parts.end` between them. A date field is one of
  `📅 📆 🗓 ⏳ ⌛ 🛫` with its optional U+FE0F and spaces and a `YYYY-MM-DD`, ended as
  `SCHEDULED_FIELD` ends one; a move rewrites only its digits, each by `daysFrom(anchor, next)`
  days. An end comes after `⭐` and before the marks; `setRepeat` places a new `🔁` field as
  `setWhen` places a When, after the `⏳` it adds.
- [ ] **Step 4:** `npm test`, `npm run lint` and `npm run build` pass.
- [ ] **Step 5:** The design's "What's written in the file" and "Ticking" still hold. Commit with
  the message "Read and write a line's repeat (#320)".

### Task 3: Ticking moves a repeating item

**Files:**
- Modify: `src/core/edit-items.ts`, `src/core/checklist.ts`, `src/core/group-edits.ts`,
  `src/core/group-menu.ts`, `src/core/when.ts`, `src/view/tick.ts`, `src/view/write.ts`,
  `src/view/schedule-view.ts`, `src/view/block-events.ts`, `src/view/group-write.ts`, and their
  tests in `tests/core/`
- Modify: README.md's "An item's date" line; step one's design ("Items", "Dates" and its test
  list); step two's design ("When and the Schedule view", and "Star"'s line order); selecting
  several rows' design ("The actions")

**Interfaces:**
- Consumes: Task 2's `tickRepeating`, `RepeatingItemError` and `RepeatTick`.
- Produces:
  - `toggleItem(lines, item, now): ToggledItem`, with `interface ToggledItem { lines: Line[]; next:
    string | null; retitle: (line: string) => string }`; `next` is the date a repeating item moved
    to, else null.
  - `untickChecklist(lines: readonly Line[], item: ItemBlock): Line[]` in `checklist.ts`.
  - `nextDayMessage(day: string, language: string): string` in `when.ts`.
  - `offerGroupUndo` exported from `group-write.ts`, unchanged.

- [ ] **Step 1: Write the failing tests.**
  - `toggleItem` on a repeating item with notes `\t- [x] inbox zero` and `\t\t- [-] plan` gives
    the moved title line and both steps as `[ ]`, and `next`; a `- [x]` inside a fenced code block,
    a `> [!note]` callout or a `%%` comment stays. An ended item keeps its checklist. Two
    `toggleItem` calls in a row move two dates.
  - `toggleItem` on an open item that doesn't repeat, or on a done one, ticks or unticks as today,
    with `next: null`.
  - `planGroupTick` moves repeating items with their checklists, skips each line that throws and
    counts it, and throws the first skipped line's `RepeatingItemError` when every item it would
    change was skipped. `changeMessage` names them as `1 item that can't repeat skipped.`.
  - Undoing a move: the text from before the tick, written back, equals the file before it byte
    for byte, CRLF endings and a missing final newline included.
  - `nextDayMessage('2026-11-17', 'en-GB')` is `Next: Tue 17 Nov.`, formatted as `dayLabel`
    formats, with `{ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }` on
    `utcOf(day)`.
- [ ] **Step 2:** `npm test` fails on them.
- [ ] **Step 3: Implement the core.** `untickChecklist` writes `' '` in every non-space status of a
  line in the item's notes that `parseItemLine` reads, other than lines in a `drawnBlocks` block
  or in what `maskBlocks` masks. The edit stays `{ start: titleLine, delta: 0, kind: 'change' }`,
  so an open notes visit keeps its range and shows the change. `planGroupTick` no longer goes
  through `planGroupLineEdit` for a tick: it applies `toggleItem` to each item, which changes no
  line count, so the rows keep their lines.
- [ ] **Step 4: Wire the views.** `tick.ts`, `schedule-view.ts` and `block-events.ts` take
  `toggleItem`'s `retitle` for the edit. After a written move, each shows `nextDayMessage(next,
  getLanguage())` with Undo: the list view through `offerGroupUndo(view, message, before, after)`;
  a list inside another note as its delete's Undo does, with `block.write(before, after, { start:
  titleLine, delta: 0, kind: 'change', history: 'undo' })`, no `retitle`, and the late-Undo
  notice when it no longer holds `after`; the Schedule with `editListFile(app, file, after,
  before)`, then `listRead(file, before)` once written. A moved row is redrawn, not marked done. `tryEdit` shows the refusal that
  names `error.problem`.
- [ ] **Step 5: Manual check,** the only check of the views, which have no unit tests. In a test
  vault, tick `🔁 every day` and `🔁 every month on the last` items in a list, in the Schedule and
  in a list inside another note, and Undo each; tick one with its card open and a step typed in
  its notes just before, and see the typing kept and the checklist unticked in the editor; tick one twice quickly, then
  Undo once; tick a selection holding a `🔁 every weekday` line.
- [ ] **Step 6:** `npm test`, `npm run lint` and `npm run build` pass. The docs this task lists
  say what the design's "What the build changes in the other docs" asks for ticking. Commit with
  the message "Move a repeating item to its next date when it's ticked (#320)".

### Task 4: Showing a repeat, and clearing its date

**Files:**
- Modify: `src/core/display.ts`, `src/core/schedule.ts`, `src/view/row-marks.ts`,
  `src/view/render-list.ts`, `src/view/schedule-row.ts`, `src/view/card-when.ts`,
  `src/view/item-quick-menu.ts`, `src/view/selection-menu.ts`, `styles.css`, and the tests of
  `display` and `schedule`
- Modify: step two's design, "When" and "On a row"

**Interfaces:**
- Consumes: Task 2's `repeatOf` and `removeWhen`.
- Produces: `ItemRow.repeats: boolean` and `ScheduledItem.repeats: boolean`, true for an open line
  `repeatOf` reads; `addRepeat(rowEl: HTMLElement): void` in `row-marks.ts`.

- [ ] **Step 1: Write the failing tests:** `itemRow` and `datedItems` give `repeats: true` for an
  open `🔁` line, its problem included (`fix the 🔁 every day bug`), and false for a done one and
  for `fix the 🔁 icon's color`.
- [ ] **Step 2:** `npm test` fails on them.
- [ ] **Step 3: Implement.** `addRepeat` adds a `princelists-repeat` span with the `repeat` icon
  and `aria-label` `Repeats`, just before the row's `princelists-when`, or at the row's end without
  one, in the day's color and at its size. The card's date, the row menu's Remove date and the
  selection's Remove date change each line with `removeWhen`; a single item whose repeat went
  shows `The repeat was removed with the date.`, and the selection keeps its Undo message.
- [ ] **Step 4: Manual check:** a `🔁` row in a list and in the Schedule, with and without a `⏳`,
  on a phone's width; clearing the card's date on `⏳ … 🔁` and on `⏳ … 📅 … 🔁` lines.
- [ ] **Step 5:** `npm test`, `npm run lint` and `npm run build` pass. Step two's "When" and "On a
  row" say a repeating row shows the `repeat` icon, pointing to the design. Commit with the message
  "Show a repeating item on its row, and end the repeat with its last date (#320)".

### Task 5: Setting a repeat

**Files:**
- Create: `src/view/card-repeat.ts`
- Modify: `src/core/repeat-line.ts` and its tests, `src/view/card.ts`, `src/view/list-view.ts`,
  `src/view/events.ts`, `src/view/item-quick-menu.ts`, `src/view/menus.ts`, `styles.css`
- Modify: README.md's feature list; step one's design, "Item actions" and its later features; step two's design, "Star"'s tool group; the design's header

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces:
  - In `repeat-line.ts`: `interface RepeatDraft { rule: RepeatRule; end: RepeatEnd | null }` and
    `draftOf(line: string): RepeatDraft | 'read-only'`, every day with no end on a line that
    doesn't repeat, and `'read-only'` for a rule `readRule` can't read or an end `readEnd` can't.
  - In `card-repeat.ts`: `toggleRepeatPopover(view: PrinceListView): void`,
    `closeRepeatPopover(view: PrinceListView): void` and `escapeRepeatPopover(view:
    PrinceListView): void`, as `card-tags.ts` has for tags; `PrinceListView.repeatPopover: {
    el: HTMLElement; opened: { line: number; text: string; seen: number }; draft: RepeatDraft |
    'read-only' } | null`.

- [ ] **Step 1: Write the failing tests** of `draftOf`: `- [ ] Review 🔚 3x ⏳ 2026-11-13 🔁 every
  2 weeks when done` gives that rule with `3x` left; `🔁 Every Day` and `🔁 every 1 day` give every day, which Save writes as `every day`;
  `🔁 every weekday` and `🔚 soon` are `'read-only'`; a line without a repeat gives every day with no
  end.
- [ ] **Step 2:** `npm test` fails on them.
- [ ] **Step 3: The popover.** A `div` with `role="dialog"` and the name `Repeat`, the last child of
  the card's tools, under `.princelists-card-when`. Its controls hold the draft, changing nothing
  in the file; `Next: ` shows `upcomingDays(anchorOf(line), …, dayOf(new Date()), 3)` through
  `dayLabel`, redrawn on each change; `On` shows only for months. `Save` writes `setRepeat` in one
  queued line edit with that edit as its `retitle`, if the tracked line still reads
  `opened.text` and `view.outsideChanges` is still `opened.seen`; otherwise it shows
  `CHANGED_ELSEWHERE_NOTICE` and reopens on the line as it is. `Remove repeat`, shown while the
  line repeats, writes `removeRepeat` the same way. A `'read-only'` draft shows `Repeats: ` with
  the rule as written and only `Remove repeat`. Escape closes it with focus on the card's repeat
  button, or on its date button when the item doesn't repeat yet, and focus leaving it, while the document has focus, closes it, as the tag popover's
  rules do.
- [ ] **Step 4: Where it opens.** `itemQuickMenu` adds `Repeat…` after Remove date, which opens
  the card, then the popover. The card's ⋯ (`showCardMenu`) and a right-click on the open card,
  which share the ⋯'s entries, add it in a group of its own after Select, when the item doesn't
  repeat. A repeating item's card shows a `Repeat` button with the `repeat` icon
  after its date, in the tools' spacing, which toggles the popover.
- [ ] **Step 5: Manual check:** set every 3 days on an undated item and see `⏳` today; set every
  month on the last with an end after 3 times, and read the next dates; change a rule, then
  Escape, and see nothing written; edit the line in the editor while the popover is open, then
  Save; open a `🔁 every weekday` item's popover; repeat it from the row's menu on a phone.
- [ ] **Step 6:** `npm test`, `npm run lint` and `npm run build` pass. The README's feature list
  gains repeating items in one line, step one's "Item actions" and step two's tool group name the
  new entry and button, step one's later features no longer list repeating items, and the design's
  `status`
  becomes `live`. Commit with the message "Set a repeat from the card or the row's menu (#320)".
