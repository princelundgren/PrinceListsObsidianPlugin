# Star color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Star color" setting picks the star's color from Obsidian's theme colors, Yellow by
default.

**Architecture:** The date colors' choices move to `src/core/theme-color.ts`, with one reader for
a stored choice. The star color rides in the style `OverdueLook` already hands the views. Each
view's root takes one `princelists-star-color-<color>` class, which sets
`--princelists-star-color`, and the three yellow rules read that variable instead.

**Tech Stack:** TypeScript, Obsidian's plugin API, vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`, "Star" and
"Settings", "Star color".

## Global Constraints

- Colors are only Obsidian's CSS variables: `--color-<name>` for each choice, and None is
  `--text-muted`. Never hard-code a color.
- No background writes: reading the settings never saves them.
- Interface text in sentence case.

## Review Focus

1. A star color change while a list block's row is being edited: the block's root class changes
   at once, though its rows wait for the edit to end (Task 2, checked by hand).
2. None: the star stays filled, in gray (Task 2's CSS).
3. The starred-only toggle in the Schedule and in a list, on and off: only "on" takes the color
   (Task 2, checked by hand).
4. A stored star color that is none of the choices: Yellow (Task 1's `themeColorOf` tests).

---

### Task 1: Theme colors of their own

A move with no change in behavior.

**Files:**
- Create: `src/core/theme-color.ts`, `tests/core/theme-color.test.ts`
- Modify: `src/core/day-color.ts`, `src/main.ts`, `src/obsidian/settings.ts`,
  `tests/core/day-color.test.ts`

**Interfaces:**
- Produces: `THEME_COLORS` (the list `DATE_COLORS` was), `type ThemeColor`, and
  `themeColorOf(stored: unknown, fallback: ThemeColor): ThemeColor`. `DayColors` and the defaults
  use `ThemeColor`; `overdueColorOf` and `todayColorOf` go, and `loadSettings` calls
  `themeColorOf` with each default. `DATE_COLOR_NAMES` becomes `THEME_COLOR_NAMES`.

- [ ] **Step 1:** Move the `overdueColorOf` and `todayColorOf` tests to `themeColorOf`: a stored
  choice is kept, and `undefined`, `'crimson'`, `1` and `null` give the fallback.
- [ ] **Step 2:** Make the move. Run `npm run lint && npm run build && npm test`; all pass.
- [ ] **Step 3: Commit** `Move the date colors' choices to theme colors with one reader`

### Task 2: The setting and the star in its color

**Files:**
- Modify: `src/core/star.ts` (`DEFAULT_STAR_COLOR: ThemeColor = 'yellow'`), `src/core/overdue.ts`
  (`OverdueStyle` gets `starColor`), `src/obsidian/settings.ts`, `src/main.ts`,
  `src/obsidian/overdue-look.ts` (its comment), `src/view/row-marks.ts`, `src/view/list-view.ts`,
  `src/view/schedule-view.ts`, `src/view/list-block.ts`, `styles.css`, `README.md`

**Interfaces:**
- Consumes: Task 1's `ThemeColor`, `THEME_COLORS`, `themeColorOf`, `THEME_COLOR_NAMES`.
- Produces: `showStarColor(rootEl: HTMLElement, color: ThemeColor): void` in `row-marks.ts`,
  which leaves `rootEl` with exactly one `princelists-star-color-<color>` class.

- [ ] **Step 1:** The setting: `starColor` in `PrinceListsSettings`, read with
  `themeColorOf(stored?.starColor, DEFAULT_STAR_COLOR)`, in the look `OverdueLook` reads, and in
  `settingChanged` and `onExternalSettingsChange`. A dropdown after Today date color: "Star
  color", described "The color of an item's star, from your theme's colors.", with
  `THEME_COLOR_NAMES`.
- [ ] **Step 2:** The views: the list view's and the Schedule's `contentEl` and each list block's
  `rootEl` call `showStarColor` when they open and in their `overdueLook.onChange` callback,
  before any redraw.
- [ ] **Step 3:** `styles.css`: one `.princelists-star-color-<color>` rule per choice setting
  `--princelists-star-color` (None to `--text-muted`), and the row's star, the card's star button
  while starred and the starred-only toggle while on use
  `color: var(--princelists-star-color, var(--color-yellow))`. The README's Settings line names
  the star's color.
- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: all pass.

By hand in a test vault: the star is yellow by default in a list, a list block and the Schedule,
and on the card's button and the starred-only toggle; each choice recolors all of them at once;
None leaves them gray and filled.

- [ ] **Step 5: Commit** `Add a setting for the star's color`
