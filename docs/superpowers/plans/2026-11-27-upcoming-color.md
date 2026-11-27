# Upcoming color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the settings color the day of an item due after today, as they color an overdue
item's and today's, None by default.

**Architecture:** `DayColors` gains `upcomingColor`, and `dayColor` gives it to an open item due
after today. `OverdueStyle` extends `DayColors`, so the look, the redraw keys, the tick's redraw
check and the settings preview pick it up with no change of their own. `addWhen` already marks
the day with the color's class.

**Tech Stack:** TypeScript, Obsidian's plugin API, vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`, "When and the Schedule
view", "On a row", and "Settings", "Overdue color, Today color and Upcoming color".

## Global Constraints

- Colors are only Obsidian's theme color variables, through the existing
  `princelists-when-<color>` classes. Never hard-code a color.
- No background writes: reading the settings never saves them.
- Interface text in sentence case.

## Review Focus

1. Ticking an item due tomorrow turns its day gray at once when Upcoming color is set, and
   unticking it brings the color back (Task 1's `tickRedraws` tests).
2. A stored value that is none of the choices: None (`themeColorOf`, already tested).
3. Changing the color, in settings or through Sync, redraws open lists, list blocks, the Schedule
   and the settings preview (checked by hand).

---

### Task 1: Upcoming color

**Files:**
- Modify: `src/core/day-color.ts`, `src/obsidian/settings.ts`, `src/main.ts`, `README.md`
- Test: `tests/core/day-color.test.ts`, `tests/core/display.test.ts`

**Interfaces:**
- Produces: `DEFAULT_UPCOMING_COLOR: ThemeColor = 'none'`; `DayColors.upcomingColor: ThemeColor`;
  `upcomingColor` in `PrinceListsSettings`.

- [ ] **Step 1: Write the failing tests**

```ts
// COLORS gains upcomingColor: 'purple'; today 2026-11-27
dayColor('2026-11-28', TODAY, false, COLORS) === 'purple'; dayColor('2027-03-01', TODAY, false, COLORS) === 'purple'
dayColor('2026-11-28', TODAY, true, COLORS) === 'none'
// tickRedraws: true for a tick or untick of an item due after today with an upcoming color,
// false when the upcoming color is none
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core/day-color.test.ts tests/core/display.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: The color and the setting.** `dayColor` returns `upcomingColor` for an open item
  whose day is after today. `upcomingColor` is read with
  `themeColorOf(stored?.upcomingColor, DEFAULT_UPCOMING_COLOR)`, goes into the look `OverdueLook`
  reads, and is in `settingChanged` and `onExternalSettingsChange`. A dropdown after Today color:
  "Upcoming color", described "The date of an item due after today.", with `THEME_COLOR_NAMES`.
  The README's Settings line names it.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: all pass.

By hand in a test vault: each choice recolors tomorrow's and later days in a list and in the
settings preview's "in three days" row at once; ticking such an item turns its day gray.

- [ ] **Step 5: Commit** `Add a color setting for upcoming dates`
