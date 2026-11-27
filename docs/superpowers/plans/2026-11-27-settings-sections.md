# Settings sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PrinceLists' settings page in three headed sections, Lists, Schedule and Appearance,
with a live preview of the date and star colors and the design's new names and descriptions.

**Architecture:** `getSettingDefinitions` returns three `group` definitions. Appearance starts
with a `render` row that draws two sample rows with `addStar`, `addWhen` and `showStarColor`, the
helpers real rows use, and redraws them on `OverdueLook.onChange`. The sample rows' data and days
are worked out in `src/core/`, so they're tested.

**Tech Stack:** TypeScript, Obsidian's plugin API (1.13 declarative settings), vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`, "Settings".

## Global Constraints

- Documented Obsidian APIs only: `SettingDefinitionGroup` (`type: 'group'`, `heading`,
  `items`), `SettingDefinitionRender` and `aliases`, all `@since` 1.13.0; `minAppVersion` stays
  1.13.4.
- Colors are only Obsidian's CSS variables; never hard-code one. No `:has()`.
- Interface text in sentence case, word for word as the spec quotes it.
- Setting keys and stored values don't change: only names, descriptions, order and grouping.
- No background writes: drawing the preview saves nothing.

## Review Focus

1. A color change while the settings are open: the preview redraws at once (Task 2, by hand).
2. Closing and reopening the settings: the old preview's listener is gone, so one change draws
   one preview (Task 2's cleanup, by hand: no error, and the listener count stays flat).
3. Sync changing a color while the settings are open: `onExternalSettingsChange` already calls
   `OverdueLook.changed()`, so the preview follows (Task 2, by hand).
4. A phone-width settings page: the sample rows fit without sideways scrolling (Task 2's CSS).
5. Settings search for an old name, such as "Floating add button", finds its setting (Task 2,
   by hand).

---

### Task 1: The sample rows

**Files:**
- Create: `src/core/settings-preview.ts`
- Test: `tests/core/settings-preview.test.ts`

**Interfaces:**
- Produces: `interface PreviewRow { readonly title: string; readonly when: string; readonly starred: boolean }`
  and `previewRows(now: Date): readonly PreviewRow[]`, with `when` as `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests**

```ts
test('the first sample row is starred and due the day before now', () => {
	expect(previewRows(new Date(2026, 10, 27, 9))[0]).toEqual({ title: 'Water the plants', when: '2026-11-26', starred: true });
});

test('the second sample row is due today and not starred', () => {
	expect(previewRows(new Date(2026, 10, 27, 9))[1]).toEqual({ title: 'Call the dentist', when: '2026-11-27', starred: false });
});

test("the day before the first of a month is the last day of the month before", () => {
	expect(previewRows(new Date(2026, 2, 1, 0, 30))[0].when).toBe('2026-02-28');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core/settings-preview.test.ts`
Expected: FAIL, the module isn't there.

- [ ] **Step 3: Implement `previewRows` in `src/core/settings-preview.ts`**

Days through `dayOf` from `src/core/when.ts`, the day before as `new Date(y, m, d - 1)`, as
`dayAfter` does it. A doc comment on each export.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/core/settings-preview.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings-preview.ts tests/core/settings-preview.test.ts
git commit -m "Work out the settings preview's sample rows"
```

### Task 2: Sections, preview and texts

**Files:**
- Create: `src/view/settings-preview.ts`
- Modify: `src/obsidian/settings.ts`, `src/main.ts:39`, `styles.css`
- Test: `tests/styles.test.ts`

**Interfaces:**
- Consumes: `previewRows` (Task 1); `addStar`, `addWhen`, `showStarColor` from
  `src/view/row-marks.ts`; `ITEMS_CLASS`, `ITEM_CLASS`, `CHECKBOX_CLASS`,
  `TITLE_AND_TAGS_CLASS` from `src/view/render-list.ts`; `OverdueLook` from
  `src/obsidian/overdue-look.ts`.
- Produces: `drawSettingsPreview(el: HTMLElement, style: OverdueStyle, now: Date): void`, which
  empties `el` and draws a `ul.princelists-items` of the sample rows in it, with the star color
  class on `el`. `PrinceListsSettingTab`'s constructor takes `overdueLook: OverdueLook` after the
  host.

- [ ] **Step 1: Write the failing styles test**

```ts
test('styles.css lays the settings preview out under its name', () => {
	expect(styles).toContain('.princelists-settings-preview {');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/styles.test.ts`
Expected: FAIL on the new test.

- [ ] **Step 3: Draw the preview**

In `src/view/settings-preview.ts`, each row is an `li` of `ITEM_CLASS` with a checkbox of
`CHECKBOX_CLASS`, its title in a `TITLE_AND_TAGS_CLASS` div's `princelists-item-title` div as
plain text, then `addStar` when starred and `addWhen(row, when, dayOf(now), false, style)`.
The list is `inert`, so nothing in it takes focus or a click. In `styles.css`, `.princelists-settings-preview` lets
the setting row wrap and gives the list its full width, framed with `--background-modifier-border`
and `--radius-m`, inside the settings page's own padding.

- [ ] **Step 4: Group the settings and rewrite their texts**

In `src/obsidian/settings.ts`, `getSettingDefinitions` returns three groups with headings
"Lists", "Schedule" and "Appearance", holding the settings in the spec's order and with its
names and descriptions word for word. Each renamed setting gets `aliases` with its old name:
"Floating add button", "Show Schedule button", "Schedule tab", "Overdue dates show", "Overdue date
color", "Today date color". The preview is Appearance's first item:

```ts
{
	name: 'Preview',
	desc: 'Colors come from your theme.',
	searchable: false,
	render: (setting) => {
		setting.settingEl.addClass('princelists-settings-preview');
		const listEl = setting.settingEl.createDiv({ cls: 'princelists-settings-preview-rows' });
		const draw = () => drawSettingsPreview(listEl, this.overdueLook.style, new Date());
		draw();
		const ref = this.overdueLook.onChange(draw);
		return () => {
			this.overdueLook.offref(ref);
			listEl.remove();
		};
	},
},
```

`src/main.ts` passes `this.overdueLook` to the tab.

- [ ] **Step 5: Run the checks**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: lint and build clean, every test passing, the docs check passing.

- [ ] **Step 6: Check it by hand in a test vault**

In a copy of the demo vault with this build, on a Mac with a DevTools port, open PrinceLists'
settings and take a screenshot in light and dark. Expected: the three headings, the sample rows
under Appearance with "Yesterday" and "Today" and a yellow star; Star color Blue turns the star
blue, Overdue color Red turns "Yesterday" red, Overdue label "Overdue" changes its text, each at
once. Search "Floating add button": the Add button setting shows. Close and reopen the settings,
then change a color: one preview, no console error. Restore the vault's settings after.

- [ ] **Step 7: Commit**

```bash
git add src/view/settings-preview.ts src/obsidian/settings.ts src/main.ts styles.css tests/styles.test.ts
git commit -m "Put the settings in three sections, with a preview of the colors"
```
