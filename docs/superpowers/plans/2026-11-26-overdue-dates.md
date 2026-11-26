# PrinceLists overdue dates Implementation Plan

> **For agentic workers:** implement this plan task by task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** An overdue item's day reads as late on list rows, list blocks and the Schedule, through
two settings: what the day says and whether it's colored (#163).

**Architecture:**
- **The rule is in core** (`src/core/overdue.ts`): whether an item is overdue, and what its day
  shows and what a screen reader hears, for each label. `dayLabel` learns "Yesterday".
- **The settings reach every view through one `Events` object,** `OverdueLook`, shaped as
  `ArchiveDelay` is for the delay: list views, list blocks and the Schedule read the style from it
  and redraw when it changes. One object for both overdue settings, beside `ArchiveDelay`
  rather than merged with it, so the delay's code stays as it is **(call)**.
- **The row code applies it** (`src/view/row-marks.ts`): the shown label, a class for the color,
  and hidden text for screen readers. The card keeps the plain label. Whether a tick in place
  redraws is decided beside `itemRow` in `src/core/display.ts`.

**Tech Stack:** TypeScript, the Obsidian API, Vitest. No new dependency.

**Design:** step two's design, "When and the Schedule view", "On a row" and "Settings"
([step two](../specs/2026-10-27-prince-lists-step-2-design.md)). The design text is already on
this plan's branch, uncommitted.

**How work lands:** one pull request holding the design text, this plan and the three tasks as
commits, which closes #163. That departs from AGENTS.md's one task per pull request, for the
maintainer to accept or refuse: the design is `live`, so its text lands with the code that makes
it true, and Task 2 alone would merge two settings that draw nothing. If refused, the tasks go as
three stacked pull requests with Tasks 2 and 3 swapped, so rows first draw with the default style
and the settings come last, with the design text and this plan. The
pull request bumps the design's `verified` once the code is compared with it. Manual checks run in
a copy of the demo vault (AGENTS.md).

## Global Constraints

- AGENTS.md's rules: documented APIs only, `src/core/` free of Obsidian imports with tests first,
  no `:has()`, Obsidian's CSS variables only, sentence case, no background writes.
- Setting names and choices, exactly: **Overdue dates show** with **Yesterday or the date**,
  **Overdue** and **Today**, stored as `"yesterday-or-date"`, `"overdue"` and `"today"`;
  **Color overdue dates**, a toggle. Defaults: `"yesterday-or-date"` and on.
- Overdue means not ticked and the When (`⏳`, `ItemRow.when` / `ScheduledItem.day`) before
  today. `📅` and `🛫` don't count.
- The color is `--text-error`. The `repeat` icon keeps `--text-muted`. The card's day keeps its
  accent color and the plain label.
- A screen reader hears `Overdue, <plain label>`, such as "Overdue, Nov 23", for every label,
  through visually hidden text, never `aria-label` (`src/view/dom.ts` says why).
- Each task updates the comments and doc comments its change makes false, including those it
  names.

## Review Focus

1. **A setting change with a list, a list block in another note and the Schedule all open:** all
   three redraw at once, and again after `data.json` changes from outside (Sync). Manual check in
   Task 3.
2. **Ticking and unticking an overdue row in a list:** its label and color change at once, not at
   the next redraw. Unit-tested in Task 1 (`tickRedraws`), checked by hand in Task 3.
3. **VoiceOver on an overdue row** with each label: it reads "Overdue, Nov 23" once, not the shown
   label too, and hovering the day shows no tooltip. Manual check in Task 3.
4. **A narrow pane or a phone with "Overdue" shown:** the longer word keeps the row's layout, the
   day at the row's end as other labels are. Manual check in Task 3.
5. **A view left open over midnight:** the next focus or draw marks items that became overdue,
   since all three redraw keys already carry today. Manual check in Task 3: with an item dated
   today, turn off automatic date and time in macOS's Date & Time settings, set the date a day on,
   then focus the view; set it back after.

---

### Task 1: The overdue rule, in core

**Files:**
- Modify: `src/core/when.ts` (`DayLabelKind`, `dayLabelKind`, `LABEL_FORMATS`, `dayLabel` and its
  doc comment)
- Create: `src/core/overdue.ts`; modify `src/core/display.ts` (`tickRedraws`)
- Test: `tests/core/when.test.ts`, `tests/core/overdue.test.ts`, `tests/core/display.test.ts`

**Interfaces:**
- Produces, in `src/core/when.ts`: `DayLabelKind` gains `'yesterday'`; `dayLabel` returns
  `'Yesterday'` for it; `LABEL_FORMATS` excludes it as it does `'today'` and `'tomorrow'`.
- Produces, in `src/core/overdue.ts`:
  - `OVERDUE_LABELS = ['yesterday-or-date', 'overdue', 'today'] as const`,
    `type OverdueLabel`, `DEFAULT_OVERDUE_LABEL: OverdueLabel = 'yesterday-or-date'`
  - `overdueLabelOf(stored: unknown): OverdueLabel`, the default for anything else, as
    `tagStripModeOf` does
  - `DEFAULT_COLOR_OVERDUE = true`, `colorOverdueOf(stored: unknown): boolean`, as
    `groupByListOf` does
  - `interface OverdueStyle { readonly label: OverdueLabel; readonly colored: boolean }`
  - `isOverdue(day: string, today: string, done: boolean): boolean`
  - `interface RowDay { readonly shown: string; readonly spoken: string | null }`; `spoken` is
    null unless the item is overdue
  - `rowDay(day: string, today: string, done: boolean, label: OverdueLabel, language: string): RowDay`
- Produces, in `src/core/display.ts`, beside `itemRow`:
  - `tickRedraws(was: ItemRow, ticked: ItemRow, today: string, showArchived: boolean): boolean`:
    true when the tick archives a hidden item, changes `repeats`, or changes `isOverdue` for the
    item's When; the first two are the cases `tick.ts` handles today

- [ ] **Step 1: Write the failing tests**

In `tests/core/when.test.ts`:
- The first `dayLabelKind` test's last day, `'2026-10-26'` against `'2026-10-27'`, now expects
  `'yesterday'`; add `'2026-10-25'` expecting `'date-this-year'`, and name the test for
  yesterday too.
- Add `['2026-11-04', 'en', 'Yesterday']` to the `dayLabel` table.
- Add: `dayLabel('2026-12-31', '2027-01-01', 'en')` is `'Yesterday'`.

`tests/core/overdue.test.ts`, today `'2026-11-26'`, language `'en'`:

```ts
test.each(['yesterday-or-date', 'overdue', 'today'])('overdueLabelOf keeps %s', (s) => expect(overdueLabelOf(s)).toBe(s));
test.each([undefined, 'late', 1, null])('overdueLabelOf reads %s as yesterday-or-date', (s) => expect(overdueLabelOf(s)).toBe('yesterday-or-date'));
test.each([[true, true], [false, false], [undefined, true], ['no', true]])('colorOverdueOf reads %s as %s', (s, on) => expect(colorOverdueOf(s)).toBe(on));

test('isOverdue only for an open item whose day is before today', () => {
	expect(isOverdue('2026-11-25', '2026-11-26', false)).toBe(true);
	expect(isOverdue('2026-11-25', '2026-11-26', true)).toBe(false);
	expect(isOverdue('2026-11-26', '2026-11-26', false)).toBe(false);
	expect(isOverdue('2025-12-31', '2026-11-26', false)).toBe(true);
});

test.each([
	['yesterday-or-date', '2026-11-25', { shown: 'Yesterday', spoken: 'Overdue, Yesterday' }],
	['yesterday-or-date', '2026-11-23', { shown: 'Nov 23', spoken: 'Overdue, Nov 23' }],
	['overdue', '2026-11-23', { shown: 'Overdue', spoken: 'Overdue, Nov 23' }],
	['today', '2026-11-23', { shown: 'Today', spoken: 'Overdue, Nov 23' }],
])('rowDay with %s shows %s as late', (label, day, expected) => {
	expect(rowDay(day, '2026-11-26', false, label, 'en')).toEqual(expected);
});

test.each(['yesterday-or-date', 'overdue', 'today'])('rowDay with %s shows a ticked past day plainly', (label) => {
	expect(rowDay('2026-11-23', '2026-11-26', true, label, 'en')).toEqual({ shown: 'Nov 23', spoken: null });
});

test('rowDay leaves today and later days alone', () => {
	expect(rowDay('2026-11-26', '2026-11-26', false, 'overdue', 'en')).toEqual({ shown: 'Today', spoken: null });
	expect(rowDay('2026-11-27', '2026-11-26', false, 'overdue', 'en')).toEqual({ shown: 'Tomorrow', spoken: null });
});
```

`tickRedraws`, in `tests/core/display.test.ts`, with `ItemRow`s built by `itemRow` from item lines
or spread from one (`{ ...row, repeats: false }`): true for ticking and for unticking an item
whose `⏳` is before today; false for ticking an item dated today or later, or undated; true for a
tick that archives with `showArchived` false, false with it true; true when `repeats` changes.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- tests/core/when.test.ts tests/core/overdue.test.ts tests/core/display.test.ts`
Expected: FAIL, `'yesterday'` not returned and `src/core/overdue.ts` missing.

- [ ] **Step 3: Implement**

The test tables' label strings need `as OverdueLabel` or an `as const` table, since `npm run
build` type-checks `tests/`. `dayLabelKind` returns `'yesterday'` when `daysFrom(today, day) ===
-1`. `rowDay`'s plain label is `dayLabel`; the shown label for `'overdue'` and `'today'` is the
literal word.

- [ ] **Step 4: Run the tests, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. A row whose day was yesterday now says "Yesterday", in lists, the Schedule and
the card.

- [ ] **Step 5: Commit**

Message: `Add the overdue rule and "Yesterday" to the day label`

### Task 2: The two settings, and redrawing when they change

**Files:**
- Create: `src/obsidian/overdue-look.ts`
- Modify: `src/obsidian/settings.ts`, `src/main.ts`, `src/view/list-view.ts`,
  `src/view/list-block.ts`, `src/view/schedule-view.ts`

**Interfaces:**
- Consumes: Task 1's `OverdueLabel`, `OverdueStyle`, `overdueLabelOf`, `colorOverdueOf` and the
  defaults.
- Produces:
  - `class OverdueLook extends Events` with `constructor(read: () => OverdueStyle)`,
    `get style(): OverdueStyle`, `changed(): void` and `onChange(callback: () => void): EventRef`,
    shaped as `ArchiveDelay` (`src/obsidian/archive-delay.ts`)
  - `PrinceListsSettings` gains `overdueLabel: OverdueLabel` and `colorOverdue: boolean`, each
    with a doc comment as its neighbors have
  - `PrinceListView`, `ListBlock` and `ScheduleView` each take an `OverdueLook` right after their
    `ArchiveDelay`. `PrinceListView` and `ListBlock` expose `overdueStyle(): OverdueStyle`;
    `ScheduleView`'s is private

- [ ] **Step 1: Settings**

In `settings.ts`, the two keys and defaults, an `OVERDUE_LABEL_NAMES: Record<OverdueLabel,
string>` as `TAG_STRIP_NAMES` is, and two definitions right after **Hide ticked items after**,
each with its `defaultValue`:
- `dropdown`, key `overdueLabel`, name `Overdue dates show`, desc `What an item's day says once it
  has passed and the item isn't ticked.`, options `{ 'yesterday-or-date': 'Yesterday or the date',
  overdue: 'Overdue', today: 'Today' }`
- `toggle`, key `colorOverdue`, name `Color overdue dates`, desc `Shows an overdue item's day in
  your theme's error color, usually red.`

`loadSettings` reads both through `overdueLabelOf` and `colorOverdueOf`.

- [ ] **Step 2: Wiring**

`main.ts` makes one `OverdueLook` reading `{ label: settings.overdueLabel, colored:
settings.colorOverdue }` and hands it to the two view factories and the code block processor.
`settingChanged` calls `overdueLook.changed()` for either key; `onExternalSettingsChange` calls it
when either value differs from before the load. Each view registers `overdueLook.onChange(...)`
with `registerEvent` and redraws as it does for the delay: `render()` in the list view, `draw()`
in the Schedule, and in `ListBlock` the delay listener's code (`list-block.ts:78`), with
`delayChangedSinceDraw` renamed `rowLookChangedSinceDraw` and set by either listener, and the
comments at `list-block.ts:48` and over `drawIfChanged` saying so.

- [ ] **Step 3: Lint, build and test**

Run: `npm run lint && npm run build && npm test`
Expected: all pass. In a demo vault copy, the settings page shows both settings after Hide ticked
items after, and a change survives a restart. Rows draw nothing different until Task 3.

- [ ] **Step 4: Commit**

Message: `Add the overdue settings and redraw views when they change`

### Task 3: Rows show it, and the docs say so

**Files:**
- Modify: `src/view/row-marks.ts`, `src/view/render-list.ts`, `src/view/schedule-row.ts`,
  `src/view/schedule-view.ts`, `src/view/list-block.ts`, `src/view/tick.ts`, `styles.css`,
  `README.md`, `AGENTS.md`, `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`
  (header only)

**Interfaces:**
- Consumes: Task 1's `rowDay`, `tickRedraws`, `OverdueStyle`; Task 2's `overdueStyle()`.
- Produces:
  - `addWhen(rowEl: HTMLElement, day: string, today: string, done: boolean, style: OverdueStyle): void`
  - `RowHost` gains `overdueStyle(): OverdueStyle`
  - `buildScheduleRow`'s options gain `overdue: OverdueStyle`
  - `fillWhen(el, day, today)` is unchanged, and the card keeps calling it

- [ ] **Step 1: The day on a row**

`addWhen` fills `.princelists-when` from `rowDay`. When `spoken` is null, the label is the span's
text, as now. Otherwise the span holds the shown label in a child with `aria-hidden="true"` and
`spoken` in a child with class `princelists-spoken`, and takes the class
`princelists-when-overdue` when `style.colored`. In `styles.css`, add `.princelists-spoken` to
the visually hidden rule `.princelists-selection-status` uses, with that rule's comment covering
both, and color `.princelists-when.princelists-when-overdue` with `var(--text-error)`;
`.princelists-repeat` stays as it is.

- [ ] **Step 2: Callers and the redraw keys**

`buildRow` passes `row.done` and `host.overdueStyle()`; `buildScheduleRow` passes `item.done` and
`overdue`. Each redraw key includes the style, so a setting change rebuilds rows instead of
keeping them:
- the list's row key in `takeRow` (`render-list.ts:221`), beside `today` and like it only when
  `when !== null`, with the comment above it saying so
- the Schedule's `drawn` key (`schedule-view.ts:361`), and its comment at line 74
- `rowsKey` in `list-block.ts`, which takes the style as a parameter, and its comment

- [ ] **Step 3: A tick in place**

`tick.ts` redraws (`view.render()`) when `tickRedraws(was, ticked, dayOf(now), view.showArchived)`
and calls `showDone` alone otherwise. The comment at `tick.ts:68-69` names the overdue case too.

- [ ] **Step 4: Docs**

- README.md, each line still one line:
  - line 86 (`**Star** an item and give it a date.`) gains that a late one shows as late
  - line 105, the Schedule, gains that overdue items sit under Today and read as late
  - line 115, Settings, gains how overdue dates show and whether they're red
  - "Good to know", line 155, gains that only `⏳` makes an item overdue, not Tasks' `📅`
- AGENTS.md: this plan joins the list of the latest plans in "Read before working".
- The design's header: `verified` to the day the code is compared with "On a row" and "Settings".

- [ ] **Step 5: Lint, build, test, docs check, and the Review Focus by hand**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: all pass. Then Review Focus 1 to 5 in a demo vault copy, on desktop and the Android
emulator, with each of the three labels and the color on and off. Check that a card's day shows
the plain label in its accent color with every setting.

- [ ] **Step 6: Commit**

Message: `Show overdue items as late on rows (#163)`

The pull request's description says that the demo vault's open past items (`To do.md`,
`Home/Chores.md`) will show "Yesterday" and red in the README's pictures and the listing's shots,
for the release step to retake. `schedule-view.ts` is already over AGENTS.md's 300 lines; this
task adds a few, and splitting it is not part of this work.
