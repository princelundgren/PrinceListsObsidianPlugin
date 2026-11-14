# Repeating items come back on their next date: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ticked repeating item is an ordinary tick, done until its next date, and PrinceLists
writes it back open on that date.

**Architecture:** Pure functions in `src/core/` work out when a done line comes back and what it
becomes, and plan every comeback in a list's text. The list view, the Schedule and a list inside
another note run that plan when they open, redraw or get focus, through their existing guarded
writes. Only then does the tick stop moving the date, so `main` never holds a tick with nothing to
bring it back.

**Tech Stack:** TypeScript, the Obsidian API, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-repeating-items-design.md`, "Ticking a repeating
item", "The next date", "Coming back", "Ending", "Showing a repeat", "What the build changes in the
other docs" and "Tests". It replaces the move-at-tick that
`docs/superpowers/plans/2026-11-13-repeating-items.md`, Task 3, built.

## Global Constraints

- Coming back is the one write nobody makes: no timer, no write on a list change or a Sync arrival
  in the Schedule or a list inside another note, and none for a view that isn't shown
  (`containerEl.isShown()` false).
- Builds on main once the repeat popover's pull request (#400) has merged; Task 3 changes its code.
- No new dependency, no network request, no telemetry.
- An edit replaces only the lines it concerns; every other byte, line ending and the final newline
  stay. Never `String.prototype.normalize` in `src/`.
- Dates are calendar days (`YYYY-MM-DD`, the device's local date through `dayOf`), never times.
- The repo is public: no machine, vault, path or port in code, commits or PR text. PR text at most
  400 words, US spelling. One task per pull request, squash-merged by the maintainer.
- `npm test`, `npm run lint`, `npm run build` and `node scripts/check-docs.mjs` pass on every
  commit.
- The design governs `src/**` while `building`: each task compares it with the code and sets its
  `verified` date in the same commit.

## Review Focus

1. **A card open on the item when it comes back:** typing in its notes is saved first, and the card
   follows the item (Task 2's scripted check).
2. **Two views of one list bringing the same item back:** one writes; the other writes nothing and
   shows no notice (Task 2's scripted check).
3. **A `✔` more than 24 hours ahead** (a clock set wrong): no mark counts, the anchor stands in, and
   it comes back one step after its own date (Task 1's test `backDay` "mark ahead").
4. **A next date past 9999-12-31, for the anchor or any date that moves with it:** the line stays
   done, never comes back, and its tick shows no "Back" date (Task 1's tests).
5. **A Sync change arriving in an open Schedule:** nothing is written until the Schedule is next
   opened or focused (Task 2's scripted check).

---

### Task 1: When a done line comes back, and what it becomes

**Files:**
- Modify: `src/core/repeat-line.ts`
- Create: `src/core/come-back.ts`
- Test: `tests/core/repeat-line.test.ts`, `tests/core/come-back.test.ts`
- Docs: the repeating items design's `verified` date

**Interfaces:**
- Consumes: `doneAt` (`src/core/archive.ts`), `anchorOf`, `repeatOf`, `isLastTime`, `countDown`,
  `moveDates` (`repeat-line.ts`), `stepDay`, `nextDay` (`repeat.ts`), `untickLine`, `parseItemLine`
  (`item-line.ts`), `setWhen`, `dayOf`, `daysFrom` (`when.ts`), `untickChecklist`
  (`checklist.ts`), `parseList`.
- Produces:
  - `backDay(line: string, now: Date): string | null` in `repeat-line.ts`: the date a done
    repeating line comes back on, or null when it never does.
  - `comeBack(line: string, now: Date): string | null` in `repeat-line.ts`: the line written back
    open, or null when it isn't due by `dayOf(now)`.
  - `planComeBacks(text: string, contentStart: number, now: Date, gathers: (line: string) => boolean):
    { next: string; count: number } | null` in `come-back.ts`: every due item whose title line
    `gathers` takes, brought back; null when none is due. The list view passes `() => true`; the
    Schedule and a list inside another note pass their own test (Task 2).

`backDay`'s rules, from the spec:
- Null unless the line is done, `repeatOf` finds no problem, and `parts.marks` holds a `✔` (a done
  `🔁` line without one is a Tasks history line).
- The tick's day: `dayOf(time)` when `doneAt` gives `{ kind: 'at' }`, else the anchor
  (`anchorOf`: due, then scheduled, then start).
- No mark that counts and no anchor: `dayOf(now)`, so it comes back at once.
- Otherwise, no anchor or `when done`: `stepDay(tickDay, rule)`; else
  `nextDay(anchor, rule, tickDay)`.
- Null when that is null, `isLastTime(end, next)`, or moving the line's dates to it would pass
  9999-12-31 (`moveDates` null), so the tick never promises a date it can't write.

`comeBack`'s date it came due: for a rule from its date, step from `backDay` while the next step is
`dayOf(now)` or earlier and not after a `🔚` date; `when done` and a line with no anchor use
`backDay` itself. The line: `untickLine`, then `countDown`, then the dates moved by
`daysFrom(anchor, due)`, or `setWhen(…, due)` with no anchor. Null when `moveDates` is null.

- [ ] **Step 1: Write the failing tests**

In `tests/core/repeat-line.test.ts`, with `const at = (d: number, h = 20) => new Date(2026, 10, d, h, 0)`:

```ts
describe('backDay', () => {
  const daily = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14';
  it('daily, ticked on the day', () => expect(backDay(daily, at(14))).toBe('2026-11-15'));
  it('weekly', () => expect(backDay('- [x] Review ✔ 2026-11-16 09:00 🔁 every week ⏳ 2026-11-16', at(16))).toBe('2026-11-23'));
  it('ticked early', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-20', at(14))).toBe('2026-11-21'));
  it('ticked late keeps the rhythm', () => expect(backDay('- [x] Review ✔ 2026-11-14 18:05 🔁 every week ⏳ 2026-11-02', at(14))).toBe('2026-11-16'));
  it('when done', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every 3 days when done ⏳ 2026-11-01', at(14))).toBe('2026-11-17'));
  it('no date', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day', at(14))).toBe('2026-11-15'));
  it('last time', () => expect(backDay('- [x] Physio 🔚 1x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull());
  it('past the end date', () => expect(backDay('- [x] Physio 🔚 2026-11-14 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull());
  it('Tasks history line', () => expect(backDay('- [x] Water 🔁 every day ⏳ 2026-11-14 ✅ 2026-11-14', at(14))).toBeNull());
  it('mark ahead: the anchor stands in', () => expect(backDay('- [x] Water ✔ 2026-11-20 18:05 🔁 every day ⏳ 2026-11-10', at(14))).toBe('2026-11-11'));
  it('no anchor and no mark that counts', () => expect(backDay('- [x] Water ✔ 2026-11-20 18:05 🔁 every day', at(14))).toBe('2026-11-14'));
  it('two marks: the earliest', () => expect(backDay('- [x] Water ✔ 2026-11-12 08:00 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-12', at(14))).toBe('2026-11-13'));
  it('open, unreadable or past 9999', () => {
    expect(backDay('- [ ] Water 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull();
    expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every weekday ⏳ 2026-11-14', at(14))).toBeNull();
    expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every year ⏳ 9999-12-31', at(14))).toBeNull();
    expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day 🛫 9999-12-31 📅 2026-11-14', at(14))).toBeNull();
  });
});

describe('comeBack', () => {
  const daily = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14';
  it('not before its date', () => expect(comeBack(daily, at(14, 23))).toBeNull());
  it('on its date', () => expect(comeBack(daily, at(15, 8))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-15'));
  it('days later, on today', () => expect(comeBack(daily, at(18))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-18'));
  it('weekly, on its latest weekday', () =>
    expect(comeBack('- [x] Review ✔ 2026-11-16 09:00 🔁 every week ⏳ 2026-11-16', new Date(2026, 11, 2, 9))).toBe('- [ ] Review 🔁 every week ⏳ 2026-11-30'));
  it('when done, late', () =>
    expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every 3 days when done ⏳ 2026-11-14', at(25))).toBe('- [ ] Water 🔁 every 3 days when done ⏳ 2026-11-17'));
  it('counts down', () =>
    expect(comeBack('- [x] Physio 🔚 3x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(15))).toBe('- [ ] Physio 🔚 2x 🔁 every day ⏳ 2026-11-15'));
  it('late past its end date, on the last date before it', () =>
    expect(comeBack('- [x] Physio 🔚 2026-11-20 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(25))).toBe('- [ ] Physio 🔚 2026-11-20 🔁 every day ⏳ 2026-11-20'));
  it('moves due and start, keeps ➕, drops ✅', () =>
    expect(comeBack('- [x] Rent ✔ 2026-11-14 18:05 🔁 every day ➕ 2026-11-01 🛫 2026-11-12 📅 2026-11-14 ✅ 2026-11-14', at(15)))
      .toBe('- [ ] Rent 🔁 every day ➕ 2026-11-01 🛫 2026-11-13 📅 2026-11-15'));
  it('no date gains ⏳', () =>
    expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every day', at(17))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-15'));
  it('no date and no mark that counts: today', () =>
    expect(comeBack('- [x] Water ✔ 2026-11-20 18:05 🔁 every day', at(14))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-14'));
  it('a date that would pass 9999 on a later step never', () =>
    expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every day 🛫 9999-12-30 📅 2026-11-14', at(18))).toBeNull());
});
```

In `tests/core/come-back.test.ts`: `planComeBacks` on a list (frontmatter `princelists: true`)
holding a due daily item with a notes checklist (`  - [x] Step` under it), a weekly item not yet
due, and an open item. Assert `count` 1, the due title line and its checklist line reopened, every
other line byte for byte; a CRLF copy keeps CRLF on every line; null when nothing is due; a due
item whose line `gathers` refuses stays as it is (null when it is the only one).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core/repeat-line.test.ts tests/core/come-back.test.ts`
Expected: FAIL, `backDay`, `comeBack` and `planComeBacks` not exported.

- [ ] **Step 3: Implement `backDay` and `comeBack` in `src/core/repeat-line.ts` and `planComeBacks` in `src/core/come-back.ts`**

`planComeBacks` walks every item of `parseList(lines, contentStart)`, hidden ones included,
replacing each due title line and running `untickChecklist` on its item. No line count changes,
so the parsed items stay valid.

- [ ] **Step 4: Run the tests and the checks**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/repeat-line.ts src/core/come-back.ts tests/core/repeat-line.test.ts tests/core/come-back.test.ts docs/superpowers/specs
git commit -m "Work out when a ticked repeating item comes back (#320)"
```

### Task 2: Lists, the Schedule and lists inside notes bring items back

**Files:**
- Create: `src/view/come-back.ts`
- Modify: `src/view/list-view.ts`, `src/view/schedule-view.ts`, `src/view/list-block.ts`,
  `src/obsidian/file-edit.ts`
- Docs: `AGENTS.md`, step one's and step two's designs

**Interfaces:**
- Consumes: `planComeBacks` (Task 1), `writeAction`, `enqueueAt` (`src/view/write.ts`),
  `editListFile`, `contentStartLine`, `isArchived` (`archive.ts`), `whenOf` (`when.ts`).
- Produces:
  - `bringBackInList(view: PrinceListView): void` in `src/view/come-back.ts`.
  - `ScheduleView.bringBack(): void` and `ListBlock.bringBack(): void`.
  - `editListFile(…, refused: string | null = CHANGED_ELSEWHERE_NOTICE)` and
    `ListBlock.write(next, expected, edit, refusedNotice: string | null = CHANGED_ELSEWHERE_NOTICE)`:
    null shows nothing on a refusal.

When each runs, from the spec's "When it's written":
- **List view:** at the end of `render()`, and on `active-leaf-change` for its own leaf. It does
  nothing unless `containerEl.isShown()` (Obsidian's `HTMLElement.isShown`), and queues nothing
  when `planComeBacks` on the current text finds nothing due, since `render()` runs on every
  redraw. On `enqueueAt(view, null, …)` it plans again on `view.text`, gathering every item, and
  writes with `writeAction(view, next, text, null)`. When that returns
  `'written'` it calls `view.editing.history.clear()`, then `view.render()`. A refusal writes
  nothing and waits for the next redraw.
- **Schedule:** at the end of `refresh()`, which runs only from `onOpen` and its own leaf's
  `active-leaf-change`, never from `listChanged`. It does nothing unless shown. For each list it
  holds, it gathers what `datedItems` and `unarchived` gather, and must keep tracking them: a line
  with a When (`whenOf` not null) that isn't archived at `this.archiveDelay.ms`. It writes with
  `editListFile(…, null)` on its queue, and calls `listRead` on `'written'`.
- **List inside another note:** once after `onload`'s first `resolve()`, and on `active-leaf-change`
  whose `leaf?.view.containerEl` contains `rootEl`. Never from `fileChanged` or the vault's
  create/rename/delete events. It does nothing unless `rootEl.isShown()`, or while a field or a
  drag is open. It gathers every line not archived at `this.archiveDelay.ms`, writes with
  `write(…, null)`, then calls
  `draw()`.

- [ ] **Step 1: Widen `editListFile` and `ListBlock.write` to take a null notice, and add `bringBackInList`, `ScheduleView.bringBack` and `ListBlock.bringBack` with their triggers**

- [ ] **Step 2: Update the docs this makes false**
  - **`AGENTS.md`, "No background writes":** "Never write on open, close or a timer, except that a
    repeating item comes back on its next date (the repeating items design, 'Coming back')."
  - **Step one, "Anti-goals":** "Background writes" names coming back as its one exception.
  - **Step one, "Saving, outside changes, sync conflicts, undo":** the one-off writes list coming
    back, and the undo history is cleared when an item comes back.
  - **Step two, the Schedule's "It updates" and "A list inside another note":** each says when it
    brings items back.

- [ ] **Step 3: Run the checks**

Run: `npm test && npm run lint && npm run build && node scripts/check-docs.mjs`
Expected: all pass.

- [ ] **Step 4: Scripted check in Obsidian on macOS, in the test vault only**

Write a fixture list whose lines are written directly, since ticking doesn't produce them until
Task 3, with the archive delay set to 48 hours. Each check runs between 08:00 and 22:00, and the
fixture is written again before each one. With Y for yesterday and W for 8 days ago, it holds:
- `- [x] Water ✔ Y 18:00 🔁 every day ⏳ Y`, with `  - [x] Step` under it;
- under a heading, `- [x] Review ✔ W 18:00 🔁 every week ⏳ W`, archived;
- `- [x] Stretch ✔ Y 18:00 🔁 every day`, undated;
- `- [x] Call #home ✔ Y 18:00 🔁 every day ⏳ Y`, a done item with a `🔁` typed onto its line.

Then:
- Opening the list reopens all four and Water's checklist in one write, with Review's heading
  collapsed and a tag filter that hides Water.
- An outside change written while the list is open brings them back at the redraw it causes.
- The list in a background tab writes nothing until its tab is shown.
- Undo then has nothing to undo.
- With a card open on the due item and notes typed, the typing is kept, and the notes editor shows
  the unticked checklist.
- A second tab of the list shows no notice.
- The Schedule, opened, reopens Water and Call, and leaves Review (archived) and Stretch
  (undated) done.
- A change written to the file while the Schedule is open but has no focus writes nothing until it
  gets focus. A Schedule tab restored at startup and not yet shown writes nothing.
- A note embedding the list reopens Water, Stretch and Call when opened and when it gets focus,
  leaves Review done, and writes nothing when the file changes while it has no focus.

Remove the fixture afterward.

- [ ] **Step 5: Commit**

```bash
git add src/view/come-back.ts src/view/list-view.ts src/view/schedule-view.ts src/view/list-block.ts src/obsidian/file-edit.ts AGENTS.md docs/superpowers/specs
git commit -m "Bring repeating items back when a list opens or gets focus (#320)"
```

### Task 3: Ticking a repeating item is an ordinary tick

**Files:**
- Modify: `src/core/edit-items.ts`, `src/core/repeat-line.ts`, `src/core/when.ts`,
  `src/core/display.ts`, `src/core/schedule.ts`, `src/core/group-edits.ts` (its comment only),
  `src/view/tick.ts`, `src/view/schedule-view.ts`, `src/view/block-events.ts`, `src/view/write.ts`,
  `src/view/menus.ts`, `src/view/selection-menu.ts`
- Test: `tests/core/edit-items.test.ts`, `tests/core/group-edits.test.ts`, `tests/core/when.test.ts`,
  `tests/core/display.test.ts`, `tests/core/schedule.test.ts`, `tests/core/repeat-line.test.ts`
- Docs: `README.md`, `AGENTS.md`, step one's and step two's designs, selecting several rows, the
  repeating items design

**Interfaces:**
- Consumes: `backDay` (Task 1).
- Produces:
  - `ToggledItem.back: string | null` replaces `next`: the date a repeating item ticked now comes
    back on, else null.
  - `backDayMessage(day: string, language: string): string` replaces `nextDayMessage`, giving
    `Back Tue 17 Nov.` in `en-GB`.
  - `tickRepeating` and `RepeatTick` are removed.

- [ ] **Step 1: Write the failing tests**
  - `toggleItem` on `- [ ] Water 🔁 every day ⏳ 2026-11-14` with a notes line `  - [x] Step`, at
    2026-11-14 18:05, gives the title line `- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14`.
    Its `back` is `'2026-11-15'`, and the checklist line stays `  - [x] Step`.
  - `🔚 1x` ticks the same way, with `back` null.
  - `every weekday` still throws `RepeatingItemError` with problem `'rule'`, and
    `- [ ] Rent 🔁 every month ⏳ 2026-11-14 🛫 2026-02-30` with problem `'date'`; both leave the
    lines unchanged.
  - `retitle` of the same line gives the same tick.
  - `planGroupTick` over two repeating items ticks both; an unreadable rule among them is skipped
    and counted.
  - `backDayMessage('2026-11-17', 'en-GB')` is `'Back Tue 17 Nov.'`.
  - `itemRow`'s `repeats` at 2026-11-14 20:00:
    - true for the ticked daily line;
    - false for the `1x` line once ticked;
    - false for a Tasks history line;
    - true for an open `🔁` line.
  - `unarchived` in `schedule.ts` gives the same `repeats` for done items.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement**
  - **`toggleItem`:** a repeating line whose `repeatOf` reports a problem throws
    `RepeatingItemError(problem)`. Any other is ticked with `tickLine`, and `back` is `backDay` of
    the ticked line at `now`.
  - **`itemRow` and `unarchived`:** a done row repeats when `backDay(text, now) !== null`;
    `timelessItemRow` keeps `!done && repeatOf(text) !== null`. Their doc comments on `repeats`
    say so.
  - **The card's ⋯ menu** decides on Repeat… with `itemRow` at the time it opens, as the card's
    repeat button does, so a done item that will come back shows the button and no Repeat….
  - **The three tick paths in the views:** remove the moved-item branches and their Undo notices.
    After an ordinary tick with `back` set, show `new Notice(backDayMessage(back, getLanguage()))`.
    A selection's tick shows no Back date; its "N items ticked." Undo notice stays. Remove
    `offerUndo`, `offerBlockUndo`, `LATE_UNDO_NOTICE`, any import this leaves unused, and the
    comment in `selection-menu.ts` that says a repeating tick writes nothing.

- [ ] **Step 4: Update the docs this makes false**
  - **`README.md`:** the feature list's Repeat line ends "and a ticked item is done until its next
    date, then comes back open". Line 128 says a repeating item's 📅 and 🛫 move with its ⏳ when it
    comes back.
  - **`AGENTS.md`:**
    - The summary: "Repeating items are done until their next date, then come back."
    - The plans' line names this plan for repeating items.
  - **Step one, "Items", "Dates" and "Completion":** a repeating item is ticked like any other, and
    its dates move when it comes back.
  - **Step two, "Ticking works in place":** a repeating item ticks like any other.
  - **Selecting several rows:** a repeating item is ticked like any other.
  - **The repeating items design:** `status: live`, with `verified` set to the day it is compared.

- [ ] **Step 5: Run the checks, then the scripted check in Obsidian on macOS and Android**

Run: `npm test && npm run lint && npm run build && node scripts/check-docs.mjs`
Expected: all pass.

Then, in the test vault on macOS and in a temporary vault on the Android emulator:
- Tick a daily item: it grays out, and the notice says "Back" and tomorrow's date.
- Write a ticked repeating item dated yesterday into the file and reopen the list: it is open again
  with today's date.
- Tick a `🔚 1x` item: it shows no notice, and it archives.
- A ticked daily item's card shows its repeat button, and its ⋯ menu has no Repeat….

- [ ] **Step 6: Commit**

```bash
git add src tests README.md AGENTS.md docs/superpowers/specs
git commit -m "Tick a repeating item like any other, done until it comes back (#320)"
```
