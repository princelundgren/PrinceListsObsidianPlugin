# Overdue and Today date colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the settings pick the color of an overdue item's day and of today's day, from
Obsidian's theme colors, with Today green by default.

**Architecture:** A pure `src/core/day-color.ts` decides which color a row's day takes and reads
the stored settings. `OverdueStyle` carries the two colors in place of `colored`, so every redraw
key that already holds the style redraws when a color changes. `addWhen` marks the day with one
class per color, and `styles.css` maps each class to its `--color-` variable.

**Tech Stack:** TypeScript, Obsidian's plugin API, vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`, "When and the Schedule
view", "On a row", and "Settings", "Overdue date color and Today date color".

## Global Constraints

- Colors are only Obsidian's CSS variables: `--color-red`, `--color-orange`, `--color-yellow`,
  `--color-green`, `--color-cyan`, `--color-blue`, `--color-purple`, `--color-pink`, and None
  leaves `--text-muted`. Never hard-code a color.
- No background writes: reading the settings never saves them.
- Interface text in sentence case.

## Review Focus

1. A stored color that is none of the choices, such as a misspelt one: the default
   (Task 1's `overdueColorOf` and `todayColorOf` tests).
2. Ticking an item dated today turns its day gray at once, and unticking it turns it back, as
   for an overdue item (Task 1's `dayColor` tests, Task 2's `tickRedraws` tests).
3. An overdue item with the "Today" label: it takes the overdue color, not Today's (Task 1).
4. Changing a color, in settings or through Sync, redraws open lists, list blocks and the Schedule:
   the style is in their redraw keys (Task 2, checked by hand).
5. Tomorrow and later days stay gray whatever the settings (Task 1).

---

### Task 1: Which color a row's day takes

**Files:**
- Create: `src/core/day-color.ts`
- Test: `tests/core/day-color.test.ts`

**Interfaces:**
- Produces:
  - `DATE_COLORS = ['none', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const`, `type DateColor`
  - `DEFAULT_OVERDUE_COLOR: DateColor = 'red'`, `DEFAULT_TODAY_COLOR: DateColor = 'green'`
  - `overdueColorOf(stored: unknown): DateColor`
  - `todayColorOf(stored: unknown): DateColor`
  - `dayColor(day: string, today: string, done: boolean, colors: { overdueColor: DateColor; todayColor: DateColor }): DateColor`

- [ ] **Step 1: Write the failing tests**

```ts
overdueColorOf('blue') === 'blue'; overdueColorOf('none') === 'none'
overdueColorOf(undefined) === 'red'; overdueColorOf('crimson') === 'red'
todayColorOf('pink') === 'pink'; todayColorOf(undefined) === 'green'; todayColorOf(3) === 'green'
// with { overdueColor: 'orange', todayColor: 'cyan' } and today 2026-11-27:
dayColor('2026-11-26', T, false, c) === 'orange'; dayColor('2026-11-27', T, false, c) === 'cyan'
dayColor('2026-11-27', T, true, c) === 'none'; dayColor('2026-11-26', T, true, c) === 'none'
dayColor('2026-11-28', T, false, c) === 'none'
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core/day-color.test.ts`
Expected: FAIL, the module doesn't exist.

- [ ] **Step 3: Implement `src/core/day-color.ts`**

`dayColor` uses `isOverdue` from `./overdue` first, then today and not done. A stored color that
is none of the choices reads as the default.

- [ ] **Step 4: Run them to see them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit** `Add the rule for which color a row's day takes`

### Task 2: The two settings, and the day in their colors

**Files:**
- Modify: `src/core/overdue.ts` (`OverdueStyle`; remove `colorOverdueOf` and `DEFAULT_COLOR_OVERDUE`)
- Modify: `src/obsidian/settings.ts`, `src/main.ts`, `src/view/row-marks.ts`, `styles.css`, `README.md`
- Modify: `src/core/display.ts` (`tickRedraws`), `src/view/tick.ts`
- Test: `tests/core/overdue.test.ts` (drop the `colorOverdueOf` tests), `tests/core/display.test.ts`

**Interfaces:**
- Consumes: Task 1's exports.
- Produces: `OverdueStyle { label: OverdueLabel; overdueColor: DateColor; todayColor: DateColor }`;
  settings fields `overdueColor` and `todayColor` in place of `colorOverdue`.

- [ ] **Step 1: Change `OverdueStyle`, the settings and their loading**
  - `PrinceListsSettings` gets `overdueColor` and `todayColor`, defaults from Task 1, and loses
    `colorOverdue`. `loadSettings` reads them with `overdueColorOf(stored?.overdueColor)`
    and `todayColorOf(stored?.todayColor)`.
  - `onExternalSettingsChange` and `settingChanged` call `overdueLook.changed()` for either key.
  - Two dropdowns replace the toggle: "Overdue date color", described "The color of an overdue
    item's day, from your theme's colors.", and "Today date color", described "The color of the
    day of an item due today, from your theme's colors.",
    with names None, Red, Orange, Yellow, Green, Cyan, Blue, Purple and Pink.
- [ ] **Step 2: Color the day**
  - `addWhen` adds `princelists-when-<color>` when `dayColor(...)` isn't `'none'`, for overdue and
    plain days alike, and its doc comment says so.
  - `styles.css`: one `.princelists-when.princelists-when-<color>` rule per color, setting
    `color: var(--color-<color>)`, in place of `.princelists-when-overdue`.
  - `tickRedraws(was, ticked, today, showArchived, colors: DayColors)` is also true when the tick
    changes `dayColor`, so ticking an item due today redraws its day gray; `tick.ts` passes
    `view.overdueStyle()`. Tests: a tick and an untick of an item due today are true, false with a
    Today color of `'none'`, and false for an item due tomorrow.
  - `README.md`'s Settings line: "what an overdue item's date says and its color, the color of
    today's date".
- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: all pass.

By hand in a test vault: Today green and overdue red by default, each dropdown recolors open
lists and the Schedule at once, None leaves the day gray, and a ticked item due today stays gray.

- [ ] **Step 4: Commit** `Add settings for the colors of overdue and today's dates`
