# PrinceLists tagging a selection Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tag button in the selection bar opens a popover that adds a tag to every selected item,
or takes one off them all, in one write with an Undo message (#361).

**Architecture:**
- **The card's `TagSuggest` takes a target** that says which tags to leave out and what a pick
  does, so the card's popover and the selection's share it.
- **What a selection's tags are is worked out in `src/core/selection-tags.ts`:** the chips with
  their counts, and the tags every selected item has.
- **The selection's popover is one element on the view's container,** built once beside the bar
  and filled on each open, with its listeners registered once. The write is `queueGroupAction`
  with `planGroupLineEdit`, as a star is.

**Tech Stack:** as in step two. No new dependency.

**Design:** [tagging a selection](../specs/2026-11-12-select-tags-design.md).

**How work lands:** one pull request per task, from `main`, squash-merged by the owner, so "Commit
with the message X" means the pull request's title is X. Each task updates the design sections it
names, or says in one line that they still hold, and sets `verified`. Manual checks run in a test
vault (AGENTS.md, "Working on a change"), on macOS and on the Android emulator, with the steps each
task lists. iOS isn't reachable for these checks; #372 tracks it.

## Global Constraints

- AGENTS.md's rules: Obsidian's CSS variables only, no hard-coded colors, no `:has()`, documented
  APIs only, sentence case, listeners through `registerDomEvent`, one delegated listener per
  container.
- The popover looks as the card's does: `--background-modifier-border`, `--radius-m`, `--shadow-s`,
  the card's background, `z-index: var(--layer-popover)`, `width: 16em`, and never wider than the
  view less `--size-4-2` each side. Not the HTML `popover` attribute.
- Copy, verbatim: the button's label "Tag"; the dialog's name "Tag the selection"; a chip
  `#pantry 2 of 5`, or `#pantry` when every selected item has it; a chip's × "Remove #pantry"; the
  field's hidden label "Add tag" and placeholder "Tag"; the menu entry "Tag…"; the messages
  `#pantry added to 3 items.` and `#pantry removed from 5 items.`, `1 item` in the singular.
- Every bar button stays at least 48 by 48 pixels wherever its labels show.
- Each task updates the comments and doc comments its change makes false, and removes code it
  leaves unreachable.

## Review Focus

1. **A pick by a tap on Android with the keyboard up** adds the tag: the suggestions can be reached
   above the keyboard, and the field's focusout doesn't close the popover before
   `selectSuggestion` runs.
2. **A press on a row, the tag strip or the list's title while the popover is open** only closes
   it: no row is selected or unselected, no card opens, no tag lights, no hold or drag starts, and
   the next tap acts as usual.
3. **Escape twice:** the first closes the popover with focus on the Tag button, or only Obsidian's
   suggestions while they show; the next ends selecting. Escape with focus on a chip's × behaves
   as in the field.
4. **The selection changing while the popover is open** (Done, an outside change that drops a
   row, a ticked row hiding) closes it, and focus doesn't land outside the view.
5. **Tags that differ only in case,** `#Pantry` on one item and `#pantry` on another, show as one
   chip counting both, and its × takes both off.

---

### Task 1: The tag type-ahead takes a target

**Files:**
- Modify: `src/view/tag-suggest.ts`, `src/view/card-tags.ts`
- Modify: the design, "Left to the builder" (how `TagSuggest` serves both, now decided)

**Interfaces:**
- Produces: in `tag-suggest.ts`, `interface TagTarget { tagsToLeaveOut(): readonly string[];
  choose(tag: string): void }`, and `new TagSuggest(view: PrinceListView, input: HTMLInputElement,
  target: TagTarget)`, replacing the `afterChoice` parameter.

- [ ] **Step 1:** `getSuggestions` passes `target.tagsToLeaveOut()` to `tagChoices` in place of
  the open card's item's tags, and `selectSuggestion` calls `target.choose(choice.tag)` in place of
  its edit and `afterChoice`. The undo keys stay.
- [ ] **Step 2:** `toggleTagPopover` gives the card's target: `tagsToLeaveOut` reads
  `itemTags(line).tags` of `view.selected`'s line when called, `choose` queues `addTag` on
  `view.selected` with `queueLineEdit`, then calls `escapeTagPopover`. The class's doc comment
  stops naming the card.
- [ ] **Step 3:** `npm run lint`, `npm run build`, `npm test` pass. On macOS, the card's popover
  suggests, adds and closes as before, and leaves out the item's own tags, its title's included.
- [ ] **Step 4:** Set the design's `status` to `building`, add `governs: [src/**, styles.css]`, and
  commit with the message "Let the tag type-ahead serve more than the open card (#361)".

### Task 2: A selection's tags, and the messages

**Files:**
- Create: `src/core/selection-tags.ts`, `tests/core/selection-tags.test.ts`
- Modify: `src/core/group-menu.ts`, `tests/core/group-menu.test.ts`
- Modify: the design, "Left to the builder" (where the counts are worked out, and the names)

**Interfaces:**
- Produces: `selectionTags(text: string, contentStart: number, rows: readonly number[], order:
  readonly string[]): SelectionTags`, with `interface SelectionTags { items: number; chips: {
  tag: string; count: number }[]; shared: string[] }`; `type TagChange = 'addTag' |
  'removeTag'` and `tagChangeMessage(change: TagChange, tag: string, changed: number): string` in
  `group-menu.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/core/selection-tags.test.ts`, with `FRONT` and
  the content start as `group-edits.test.ts` has them, and in `group-menu.test.ts`:

```ts
// Lines 3 to 7 of the text.
const TEXT = FRONT + '- [ ] oats #pantry\n- [ ] rice #Pantry #dry\n## Fridge\n- [ ] milk\n- [ ] #pantry flour\n';
const ORDER = ['pantry', 'dry'];

test('counts the items carrying each tail tag, in the given order, spelled as it spells them', () => {
	expect(selectionTags(TEXT, 3, [3, 4, 6], ORDER).chips).toEqual([
		{ tag: 'pantry', count: 2 },
		{ tag: 'dry', count: 1 },
	]);
});
test('counts items only, not headings', () => {
	expect(selectionTags(TEXT, 3, [3, 5, 6], ORDER)).toMatchObject({ items: 2, chips: [{ tag: 'pantry', count: 1 }] });
});
test('leaves a title tag out of the chips but counts it as shared', () => {
	const result = selectionTags(TEXT, 3, [3, 7], ORDER);
	expect(result.chips).toEqual([{ tag: 'pantry', count: 1 }]);
	expect(result.shared).toEqual(['pantry']);
});
test('shares only the tags every selected item has, in any case', () => {
	expect(selectionTags(TEXT, 3, [3, 4], ORDER).shared).toEqual(['pantry']);
	expect(selectionTags(TEXT, 3, [3, 6], ORDER).shared).toEqual([]);
});
test('puts a tag the order lacks after the rest', () => {
	expect(selectionTags(TEXT, 3, [4], ['pantry']).chips.map((chip) => chip.tag)).toEqual(['pantry', 'dry']);
});
test('has no chips for a selection with no tag', () => {
	expect(selectionTags(TEXT, 3, [6], ORDER)).toEqual({ items: 1, chips: [], shared: [] });
});

test('names the tag and how many items the write changed', () => {
	expect(tagChangeMessage('addTag', 'pantry', 3)).toBe('#pantry added to 3 items.');
	expect(tagChangeMessage('removeTag', 'pantry', 5)).toBe('#pantry removed from 5 items.');
	expect(tagChangeMessage('addTag', 'pantry', 1)).toBe('#pantry added to 1 item.');
});
```

- [ ] **Step 2:** Run `npx vitest run tests/core/selection-tags.test.ts tests/core/group-menu.test.ts`:
  FAIL, `selectionTags` and `tagChangeMessage` aren't defined.
- [ ] **Step 3:** Implement `selectionTags` in `src/core/selection-tags.ts`: items as `groupState`
  counts them, chips from `itemTags(line).tailTags` matched by `sameTag`, and `shared` from
  `itemTags(line).tags`, in the order the first selected item has them. Implement
  `tagChangeMessage` with `countPhrase(changed, 0)`.
- [ ] **Step 4:** Run the same command: PASS. Then `npm run lint` and `npm test`.
- [ ] **Step 5:** Commit with the message "Work out a selection's tags and its tag messages (#361)".

### Task 3: The bar's Tag button opens the selection's tag popover

**Files:**
- Create: `src/view/selection-tag-popover.ts`
- Modify: `src/view/selection-bar.ts`, `src/view/list-view.ts`, `src/view/keys.ts`,
  `src/core/group-menu.ts`, `tests/core/group-menu.test.ts`, `styles.css`, `README.md` (the
  features list's "Select several" and the line under the tags picture name tagging)
- Modify: the design, "The bar's Tag button" (the measured one-row width) and "Left to the
  builder" (where the suggestions open on Android); selecting several rows, "What the selection
  is" (the popover takes the first Escape), "While selecting" (a press on a row while it's open
  only closes it), "The bar" (Tag in the buttons line, the widths) and "The actions" (the Undo
  message line names a tag change); filtering by tag, "The card" (the popover's second home)

**Interfaces:**
- Consumes: `TagSuggest` and `TagTarget` (Task 1); `selectionTags` and `tagChangeMessage`
  (Task 2); `queueGroupAction` and `planGroupLineEdit`; `addTag` and `removeTag`.
- Produces: in `selection-tag-popover.ts`, `buildSelectionTagPopover(view: PrinceListView): void`,
  `toggleSelectionTagPopover(view: PrinceListView, button: HTMLElement): void`,
  `openSelectionTagPopover(view: PrinceListView, button: HTMLElement): void`,
  `closeSelectionTagPopover(view: PrinceListView): void`, `placeSelectionTagPopover(view:
  PrinceListView): void`, `syncSelectionTagPopover(view: PrinceListView): void` and `isInSelectionTagPopover(view: PrinceListView, target: Node | null):
  boolean`; `BarButton` gains `'tag'`. The popover's class is `princelists-selection-tag-popover`.

- [ ] **Step 1: Write the failing test** in `group-menu.test.ts`: `barButtons(MIXED, true)` and
  every other `barButtons` expectation gain `tag: true` for a selection with an item, and the
  headings-only `toEqual` gains `tag: false`. Run it: FAIL. Then `barButtons`
  gives `tag: state.items > 0`: PASS.
- [ ] **Step 2:** `buildSelectionTagPopover`, called in `list-view.ts` after `buildSelectionBar`,
  adds a hidden `div` to `view.containerEl` with `role="dialog"` and `aria-label="Tag the
  selection"`, and registers its listeners once: on the `div`, `click` on a chip's ×, `keydown`
  for Escape, and `focusout`; on `view.containerEl`, a capture `pointerdown` and a capture
  `mousedown`. Its state lives in a
  `WeakMap` keyed by the view, as the bar's does: the Tag button, the input, its `TagSuggest`, and
  the selection's lines when it opened.
- [ ] **Step 3:** `openSelectionTagPopover` fills the `div` from `selectionTags`, with the order
  `listStripTags(lines, model, new Date(), shown, [])`, as `TagSuggest` reads it: a chip per tag
  with its × (Global Constraints), then the input with its `TagSuggest`, whose `tagsToLeaveOut` is
  `selectionTags(…).shared` when called and whose `choose` writes. `placeSelectionTagPopover` sets,
  with `setCssProps` and in `px`, `--princelists-tag-popover-bottom`, the container's bottom less
  the button's top, and `--princelists-tag-popover-end`, the container's right less the button's
  right; open calls it, and so does the view's `onResize` while the popover is open. Open sets the
  button's `aria-expanded` to `"true"`, shows the `div` and focuses the input.
  `toggleSelectionTagPopover` closes it when open and focuses the button, and opens it otherwise.
- [ ] **Step 4:** A pick and a × each close the popover, focus the Tag button, then call
  `queueGroupAction(view, view.selection.lines(), plan, (written) => tagChangeMessage(change, tag,
  written.changed))`, with `plan` being `planGroupLineEdit` with `addTag` or `removeTag` on `tag`.
  A write that would change nothing gets `null` from `planGroupLineEdit`, so it writes nothing and
  says nothing.
- [ ] **Step 5:** What closes it, through `closeSelectionTagPopover`, which closes the suggestions,
  empties and hides the `div`, and sets `aria-expanded` to `"false"`:
  - Escape in the `div`: `preventDefault`, close, focus the Tag button. `keys.ts`'s Escape guard
    passes while `isInSelectionTagPopover(view, targetOf(evt))`, as it does in a card, so the
    first Escape keeps the selection.
  - Focus leaving the `div` for an element outside it or for none, while `doc.hasFocus()`, as
    the card's rule does.
  - The capture `pointerdown`, while open, for a primary press in `view.contentEl`: close, move
    focus to the list with `focusList`, set `view.swallowNextClick`, and `stopPropagation`, so the
    view's hold, touch-drag and click-reset listeners don't see it and its click is held back. The
    capture `mousedown` of that same press calls `preventDefault`, so it starts no row's native
    drag and focuses no field, such as the list's title.
  - In `selection-bar.ts`: a `mousedown` on the Tag button while open calls `preventDefault`, so
    the click toggles it closed, as on the card; a click on another bar button closes it before
    that button acts, since Safari doesn't focus a clicked button.
  - `syncSelectionTagPopover`, in `syncSelectionBar` before its return for a view that stopped
    selecting: while open, closes it when the view
    stops selecting or `view.selection.lines()` differs from the lines it opened with, moving the
    focus it held to the Tag button while selecting, or to the list with `focusList`.
- [ ] **Step 6:** `selection-bar.ts`: `BUTTONS` gets `{ button: 'tag', label: 'Tag', icon: 'tag' }`
  after Star. `opensMenu` leaves Tag out; Tag gets `aria-haspopup="dialog"` and
  `aria-expanded="false"`, and `act` calls `toggleSelectionTagPopover`. The doc comments name Tag.
- [ ] **Step 7:** `styles.css`: the actions' grid takes `repeat(5, 1fr) auto 1fr`, and the narrow
  layout's `minmax(0, 1fr)` columns five times; the icons-only query becomes `max-width: 389px`;
  the one-row query moves from `min-width: 520px` to the narrowest width where all six buttons
  keep 48 pixels with their labels, measured in Obsidian, about 540. The comments say six buttons.
  The popover: `position: absolute`, `bottom: calc(var(--princelists-tag-popover-bottom) +
  var(--size-4-1))`, and `right: clamp(var(--size-4-2), var(--princelists-tag-popover-end), 100% -
  var(--size-4-2) - min(16em, 100% - 2 * var(--size-4-2)))`, with the card popover's look (Global
  Constraints), shared through one selector list; the chips wrap above a full-width field.
- [ ] **Step 8:** `npm run lint`, `npm run build`, `npm test` pass. On macOS and Android, five
  items selected, two with `#pantry`: the chip reads `#pantry 2 of 5`; picking `#pantry` tags the
  other three with `#pantry added to 3 items.`, and Cmd+Z or Undo takes it back in one step; the
  chip's × with `#pantry removed from 5 items.`; a new tag; Review Focus 1 to 5; the bar at 360,
  389, 390 and 540 pixels, the popover inside the view at 360 and after a resize. Record the
  one-row width in the design and name it in the pull request.
- [ ] **Step 9:** Commit with the message "Tag every selected item from the selection bar (#361)".

### Task 4: Tag… in the selection's menu

**Files:**
- Modify: `src/core/group-menu.ts`, `tests/core/group-menu.test.ts`, `src/view/selection-menu.ts`,
  `src/view/selection-bar.ts`
- Modify: selecting several rows, "The actions" (the menu gets Tag…)

**Interfaces:**
- Consumes: `openSelectionTagPopover` (Task 3).
- Produces: `GroupEntry` gains `'tag'`; `openSelectionTags(view: PrinceListView): void` in
  `selection-bar.ts`, which opens the popover over the bar's Tag button.

- [ ] **Step 1: Write the failing test:** in `group-menu.test.ts`, `groupEntries(MIXED, true)` has
  `'tag'` after `'removeStar'`, "shows only the entries that change something" expects `'tag'`
  after `'removeStar'`, and a selection of headings still gets only `['delete']`. Run it: FAIL.
- [ ] **Step 2:** `groupEntries` shows `tag` while `state.items > 0`, after `removeStar`, and
  `barButtons` reads `tag: entries.includes('tag')`, so one rule decides both. In
  `selection-menu.ts`, `PARTS.tag` is `'mark'`, `ENTRY_LOOKS.tag` is `{ title: 'Tag…', icon:
  'tag' }`, and choosing it calls `openSelectionTags` from `menu.onHide`, so the menu, if it gives
  focus back as it hides, doesn't take it from the field. Run the test: PASS.
- [ ] **Step 3:** `npm run lint`, `npm run build`, `npm test` pass. On macOS: a right-click on a
  selected row shows Tag… after the star entries; it opens the popover over the bar's Tag button
  with the field focused once the menu has closed, and a pick acts as from the bar.
- [ ] **Step 4:** Set the design's `status` to `live` and `verified`, then commit with the message
  "Open the selection's tag popover from its menu (#361)".
