# PrinceLists inherited tags Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** An item counts as carrying its list's `tags` property and its heading's tags in every
tag filter, while rows and cards still show only its own tags (#428).

**Architecture:**
- **What an item inherits is worked out in a new `src/core/inherited-tags.ts`,** from the list's
  tags and each section's heading text: one array per section. Nothing in it imports Obsidian or
  `display.ts`, so `display.ts`, `schedule.ts` and the views can all use it.
- **The view reads the list's tags from the file's text** in `src/obsidian/marker.ts`, with
  `parseYaml` and `parseFrontMatterTags`, and a core function cleans what Obsidian returns.
- **Filters and strips get the item's carried tags** (its own plus its section's), and the row's
  own `tags` and `tailTags` stay as they are, so chips don't change.

**Tech Stack:** TypeScript, the Obsidian API, Vitest. No new dependency.

**Design:** [inherited tags](../specs/2026-11-15-inherited-tags-design.md).

**How work lands:** one pull request per task, from `main`, squash-merged when the owner asks, so
"Commit with the message X" means the pull request's title is X. Each task updates the doc sections
it names, sets the design's `verified`, and says in its description which design sections still
hold. Manual checks run in a test vault (AGENTS.md, "Working on a change").

## Global Constraints

- AGENTS.md's rules: documented APIs only, core free of Obsidian imports, no
  `fileManager.processFrontMatter`, no background writes, sentence case.
- Nothing is written: no task changes what any edit writes to a file.
- Rows and the card's chips stay the tags of the item's own line (`ListRow.tags`, `tailTags`).
- A heading's tags cover only its own section: `model.sections[i]`, up to the next heading of any
  level.
- Tags compare without regard to case (`sameTag`); a nested tag counts under its parent
  (`carriesTags`).
- Each task updates the comments and doc comments its change makes false.

## Review Focus

1. **`tags: #work` written unquoted** is a YAML comment: the list has no tag, and nothing throws.
   Task 1 tests the cleaning of `null` and `[]`; its manual check covers the YAML.
2. **A setext heading whose tag is on its second text line** (`Office\n#work\n======`) counts the
   tag: Task 1's `listInheritedTags` test.
3. **A tag inside code or a link in a heading** (`` ## Use `#tag` ``) is no tag: Task 1's test.
4. **A list tagged `work/acme`:** its strip shows neither `work` nor `work/acme`, and the
   Schedule's `#work` shows its items: Tasks 1 and 2's tests.
5. **The `tags` property changed while the list is open** (in Markdown view, or by Sync): the strip
   and the filters follow without reopening the list. Manual check in Tasks 1 and 2.

---

### Task 1: A list's filter and strip count its heading's and its own tags

**Files:**
- Create: `src/core/inherited-tags.ts`, `tests/core/inherited-tags.test.ts`
- Modify: `src/core/item-tags.ts` (export `inlineTags`), `src/core/display.ts`
  (`visibleSections`, `isItemVisible`, `listStripTags`, new `listInheritedTags`),
  `src/obsidian/marker.ts` (new `listTags`), `src/view/list-view.ts` (`parse()`),
  `src/view/render-list.ts`, `src/view/redraw.ts`, `src/view/card.ts`, `src/view/tag-suggest.ts`,
  `src/view/card-tags.ts`, `src/view/list-block.ts`
- Test: `tests/core/inherited-tags.test.ts`, `tests/core/display.test.ts`,
  `tests/core/render-timing.test.ts`, `tests/core/editing.test.ts`
- **Existing tests:** every `visibleSections`, `isItemVisible` and `listStripTags` call in
  `display.test.ts`, `render-timing.test.ts` and `editing.test.ts` gains the new argument,
  `NO_INHERITED_TAGS` unless a step says otherwise. Two say otherwise:
  - `display.test.ts`'s `describe('No tag')` states the rule this design reverses (its `## Dry
    #pantry`). It passes `listInheritedTags(lines, model, [])`, its first test is renamed "alone
    shows the items that carry no tag, their heading's included, whatever their notes carry", and
    the expectations become `['Bread']` alone, `['Fries', 'Bread']` with `frozen` lit, and
    `['Bread']` with `frozen` and `pantry` lit.
  - `render-timing.test.ts`'s "core's part of a redraw" times `listInheritedTags` too, since
    `parse()` now runs it, and passes its result.

**Interfaces:**
- Produces, in `src/core/inherited-tags.ts`:
  - `interface InheritedTags { list: readonly string[]; bySection: readonly (readonly string[])[] }`
    where `bySection[i]` is the list's tags then the tags of `model.sections[i]`'s heading, each
    once.
  - `const NO_INHERITED_TAGS: InheritedTags` (`{ list: [], bySection: [] }`)
  - `inheritedTags(listTags: readonly string[], headingTexts: readonly (string | null)[]): InheritedTags`
  - `carriedTags(own: readonly string[], inherited: readonly string[]): string[]`: own first, then
    the inherited ones it lacks, compared with `sameTag`.
  - `withoutListTags(tags: readonly string[], listTags: readonly string[]): string[]`: drops each
    tag that is one of `listTags` or a parent of one (`work` for `work/acme`).
  - `inheritedFor(model: ListModel, inherited: InheritedTags, line: number): readonly string[]`:
    the section's array for the section holding `line`, or `inherited.list`.
  - `listTagsOf(fromObsidian: readonly string[] | null): string[]`: drops a leading `#`, keeps what
    `isTagBody` accepts, each once.
- Produces, in `src/core/item-tags.ts`: `inlineTags(text: string): string[]` (today's private
  `titleTags`, distinct).
- Produces, in `src/core/display.ts`:
  `listInheritedTags(lines: readonly Line[], model: ListModel, listTags: readonly string[]): InheritedTags`,
  and a last parameter `inherited: InheritedTags` on `visibleSections`, `isItemVisible` and
  `listStripTags`.
- Produces, in `src/obsidian/marker.ts`: `listTags(text: string): string[]`.
- Produces: `PrinceListView.parse()` returns `{ lines, model, inherited }`.

- [ ] **Step 1: Write the failing tests** in `tests/core/inherited-tags.test.ts`:

```ts
test('a section inherits the list tags then its heading tags', () => {
	expect(inheritedTags(['work'], [null, 'Office #calls', 'Home']).bySection).toEqual([['work'], ['work', 'calls'], ['work']]);
});
test('carriedTags keeps the own spelling and adds what is missing', () => {
	expect(carriedTags(['Work', 'x'], ['work', 'calls'])).toEqual(['Work', 'x', 'calls']);
});
test('withoutListTags drops a list tag and its parents', () => {
	expect(withoutListTags(['Work', 'work/acme', 'calls', 'workshop'], ['work/acme'])).toEqual(['calls', 'workshop']);
});
test('listTagsOf cleans what Obsidian returns', () => {
	expect(listTagsOf(['#work', '#Work', '#work,home', '#1984', '#home'])).toEqual(['work', 'home']);
	expect(listTagsOf(null)).toEqual([]);
	expect(listTagsOf([])).toEqual([]);
});
```

  and in `tests/core/display.test.ts`, a `describe('inherited tags')` with a list
  `'---\nprincelists: true\n---\n- [ ] top\n## Office #work\n- [ ] call\n### Calls\n- [ ] ring\n\nUse `#code`\n---\n- [ ] x\n'`
  (the blank line makes `Use \`#code\`` a setext heading, not a lazy line of `ring`) and list tags
  `['home']`:
  - `listInheritedTags(...).bySection` is `[['home'], ['home', 'work'], ['home'], ['home']]`: the
    `###` doesn't inherit `#work`, and the code span is no tag.
  - With `#work` lit, `visibleSections` shows `call` and not `top`, `ring` or `x`.
  - With No tag lit, it shows no item (every item carries `home`).
  - `listStripTags(..., [], inherited)` is `['work']`: `home` is the list's own.
  - In `'---\nprincelists: true\n---\n- [ ] top\n\nOffice\n#work\n======\n- [ ] call\n'`, the
    setext heading's second line gives its section `work` (without the blank line, `Office` is a
    lazy line of `top`).
  - The same list without its headings' tags has an empty strip, so it shows none.

- [ ] **Step 2: Run** `npm test -- inherited-tags display` and see them fail on the missing exports.

- [ ] **Step 3: Implement** `src/core/inherited-tags.ts`, export `inlineTags`, add
  `listInheritedTags` (`headingText` for each section's `headingLine`, `null` for the first
  section's) and thread `inherited` through `visibleSections` (match on
  `carriedTags(row.tags, inherited.bySection[i] ?? inherited.list)`), `isItemVisible` and
  `listStripTags` (carry `withoutListTags(carriedTags(...), inherited.list)` per shown item; the
  lit tags still join as today).

- [ ] **Step 4: Wire the view.** `listTags(text)` in `marker.ts`: `leadingFrontmatter`, then
  `parseYaml` in a `try`/`catch` like `isListText`'s, `[]` unless `isYamlMapping`, then
  `listTagsOf(parseFrontMatterTags(yaml))`. The `parsedText` memo in `list-view.ts` adds
  `inherited: listInheritedTags(lines, model, listTags(text))`. Pass `view.parse().inherited` from
  `render-list.ts` (`visibleSections`), `redraw.ts` and `tag-suggest.ts` (`listStripTags`) and
  `card.ts` (`isItemVisible`); `list-block.ts` passes `NO_INHERITED_TAGS`. In `card-tags.ts`, the
  card's `tagsToLeaveOut` becomes `carriedTags(itemTags(line).tags, inheritedFor(model, inherited,
  view.selected))`, with no inherited tags while `view.selected` is `null`.

- [ ] **Step 5: Run** `npm test`, `npm run lint` and `npm run build`; all pass.

- [ ] **Step 6: Check in a test vault** with a list whose frontmatter has `tags: [home]` and a heading
  `## Office #work`: the strip shows `#work` and not `#home`; lighting `#work` shows only Office's
  items; No tag shows nothing; no row gains a chip; the card's tag field doesn't offer `work`;
  dragging an item out of Office with `#work` lit hides it and Cmd+Z brings it back, and so does
  "Move to heading" on a selection of Office's items, which also ends selecting; changing
  `tags` to `[home, errands]` in "Edit in Markdown" and returning updates the strip; `tags: #home`
  unquoted gives the list no tag. Note whether the Properties sidebar edits `tags` with the list
  view open (design, risk 1).

- [ ] **Step 7: Docs.** The design's header gets `status: building`, `governs: [src/**]` and
  `verified`, and its "Left to the builder" becomes the decision: computed once per parse, in the
  list view's `parsedText` memo and in `datedItems`. The tag filter design's "Not in this design"
  bullet under "At a glance", "An item's tags", "The tag strip", "No tag (owner, #383)" and the
  card popover's suggestions under "The card"; step one's "File format"; README's tags intro, "Tags",
  "Filter by tag" and "How a list is stored" (with the quoting note and the risk 1 result);
  AGENTS.md's "Read before working" lists the design and this plan.

- [ ] **Step 8: Commit** with the message "Count a list's and a heading's tags in the list's tag
  filter (#428)".

### Task 2: The Schedule counts them too

**Files:**
- Modify: `src/core/schedule.ts`, `src/view/schedule-view.ts`
- Test: `tests/core/schedule.test.ts`

**Interfaces:**
- Consumes: `listInheritedTags`, `carriedTags`, `inheritedFor` (Task 1); `listTags` (Task 1).
- Produces: `datedItems(text, contentStart, list: { path: string; name: string; tags?: readonly string[] })`,
  and `ScheduledItem.carried: string[]`, the item's own tags then its section's inherited ones.

- [ ] **Step 1: Write the failing tests** in `tests/core/schedule.test.ts`: for a list text with a
  dated item under `## Office #work` and one before any heading, with `tags: ['home']` passed:
  - `datedItems(...)[0].carried` and `[1].carried` are `['home']` and `['home', 'work']`, while
    their `tags` and `tailTags` are unchanged.
  - `shownSchedule` with `#home` lit shows both; with `#work` lit only the second; with No tag lit
    neither.
  - `scheduleStripTags` is `['home', 'work']` (the Schedule keeps a list's own tags).
  - A list tagged `work/acme`: `#work` lit shows its items.

- [ ] **Step 2: Run** `npm test -- schedule` and see them fail.

- [ ] **Step 3: Implement:** `datedItems` builds `listInheritedTags(lines, model, list.tags ?? [])`
  from the model it already parses and sets `carried`; `shownSchedule` and `scheduleStripTags`
  read `item.carried` in place of `item.tags`. `readList` in `schedule-view.ts` passes
  `tags: listTags(text)`. The hand-built `ScheduledItem`s in `tests/core/schedule.test.ts` (its
  item helpers) gain `carried`, equal to their `tags`, so the type check and the existing "tags in
  the Schedule" tests pass.

- [ ] **Step 4: Run** `npm test`, `npm run lint` and `npm run build`; all pass.

- [ ] **Step 5: Check in a test vault** with two lists, one `tags: [work]` and one `tags: [personal]`,
  each with dated items: the Schedule's strip shows both tags, each shows only its list's items,
  grouped and sorted by date, and no row gains a chip; changing a list's `tags` updates the strip.

- [ ] **Step 6: Docs:** the design's "Filtering" holds or is updated; README's "Filter by tag"
  says the Schedule counts a list's tags; `verified`.

- [ ] **Step 7: Commit** with the message "Count a list's and a heading's tags in the Schedule's
  tag filter (#428)".

### Task 3: Tagging a selection leaves inherited tags out of its suggestions

**Files:**
- Modify: `src/core/inherited-tags.ts`, `src/view/selection-tag-popover.ts`
- Test: `tests/core/inherited-tags.test.ts`

**Interfaces:**
- Consumes: `inheritedFor`, `carriedTags`, `InheritedTags`, `listInheritedTags` (Task 1).
- Produces: `sharedCarried(lines: readonly Line[], model: ListModel, inherited: InheritedTags, rows: readonly number[]): string[]`:
  the tags every item on `rows` carries, its own or inherited, as the first item spells them;
  headings and other rows left out; `[]` when no row is an item. It covers a tag one item has on
  its line and another inherits, which adding would change for neither, as the card's popover
  leaves out every tag its item carries.

- [ ] **Step 1: Write the failing test** in `tests/core/inherited-tags.test.ts`, for
  `'---\nprincelists: true\n---\n## Office #work\n- [ ] call\n- [ ] mail #urgent\n## Home\n- [ ] sweep #work\n'`
  with list tags `['home']` (lines 4, 5 and 7 are the items, 3 and 6 the headings):
  - rows `[4, 5]` give `['home', 'work']`;
  - rows `[4, 7]` give `['home', 'work']` (`sweep` has `#work` on its own line);
  - rows `[5, 7]` give `['home', 'work']`, not `urgent`;
  - rows `[3]`, a heading alone, give `[]`.

- [ ] **Step 2: Run** `npm test -- inherited-tags` and see it fail.

- [ ] **Step 3: Implement** `sharedCarried`; the popover's `tagsToLeaveOut`
  (`selection-tag-popover.ts`, the `tagsToLeaveOut` at line 139) becomes
  `sharedCarried(lines, model, inherited, view.selection.lines())` with `view.parse()`'s values, in
  place of `selectionTags(...).shared`.

- [ ] **Step 4: Run** `npm test`, `npm run lint` and `npm run build`; all pass.

- [ ] **Step 5: Check in a test vault:** selecting two items under `## Office #work` in a list tagged
  `home`, the popover's field suggests neither `home` nor `work`, and typing `work` offers no "New
  tag"; its chips are unchanged.

- [ ] **Step 6: Docs:** the select tags design's field suggestions and "Not in this design"; the
  inherited tags design's "What doesn't change" says the field leaves out a tag every selected item
  carries, its own or inherited (it said "inherits"); the
  inherited tags design gets `status: live` once all three tasks are in, with `verified`.

- [ ] **Step 7: Commit** with the message "Leave inherited tags out of a selection's tag
  suggestions (#428)".
