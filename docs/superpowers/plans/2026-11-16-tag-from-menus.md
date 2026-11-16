# PrinceLists tag from menus Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag… in a heading's menu and Tag list… in the list's menus open a tag popover that adds
and removes the heading's or list's own tags (#434).

**Architecture:**
- **One popover, three targets.** The selection's tag popover becomes `src/view/tags-popover.ts`,
  which knows nothing of selecting: a target gives it its anchor, chips, suggestions, writes and
  when to close. The selection, a heading and the list are its targets.
- **A heading's tags are edited in core** (`src/core/heading-tags.ts`) through `setHeadingText`,
  as Rename heading's name is.
- **The list's `tags` lines are planned in core** (`src/core/list-tags-edit.ts`), as
  `planMarker` plans the marker. The Obsidian layer checks the result with `parseYaml` before the
  view writes it.

**Tech Stack:** TypeScript, the Obsidian API, Vitest. No new dependency.

**Design:** [tag from menus](../specs/2026-11-16-tag-from-menus-design.md).

**How work lands:** one pull request per task, stacked (each on the one before), squash-merged when
the owner asks, so "Commit with the message X" means the pull request's title is X. Task 1 moves
about 200 lines into a new file; its description says so, since AGENTS.md asks a change over about
300 lines to say why. Each task updates the doc sections it names, bumps `verified` on each design
it edits, and says in its description which design sections still hold. Manual checks run in the
test vault (AGENTS.md, "Working on a change").

## Global Constraints

- AGENTS.md's rules: documented APIs only, core free of Obsidian imports, no
  `fileManager.processFrontMatter`, no background writes, sentence case.
- The frontmatter is never re-serialized: an edit replaces, inserts or removes whole lines only.
- A heading's and the list's tag writes go through the view's own one-off write (`enqueueAt` and
  `writePlanned`, `src/view/write.ts`), so Cmd+Z undoes them and the write guard holds. The
  selection keeps its `queueGroupAction`.
- Tags compare without regard to case (`sameTag`); a removal takes every spelling.
- Menu names: **Tag…** (heading), **Tag list…** (list). The refusal message for the list:
  "The list's tags can't be changed here. Use Show file properties."
- The selection's popover behaves exactly as today after Task 1.
- Each task updates the comments and doc comments its change makes false.

## Review Focus

1. **The file changes while a heading's or list's popover is open** (Sync, or the Properties
   sidebar writing `tags`): the popover closes and nothing is written from stale chips. Manual
   check in Tasks 2 and 4.
2. **Cmd+Z right after a list-tag write** brings back the frontmatter byte for byte, including a
   removed `tags` key. Manual check in Task 4.
3. **A heading near the view's bottom, or the list scrolled down,** when the popover opens: it
   opens inside the view with the field visible, and follows its anchor while the list scrolls.
   Manual check in Tasks 2 and 4.
4. **The selection's popover after the refactor:** chips with counts, suggestions, a pick, a ×,
   Escape, a press outside, the Undo message. Manual check in Task 1, rerun in Task 4.
5. **A heading menu opened while a card is open** (desktop right-click): the popover opens and the
   card's tag popover doesn't stay open beside it. Manual check in Task 2.

---

### Task 1: The tag popover takes a target

No behavior change: the selection's popover is the only target yet.

**Files:**
- Create: `src/view/tags-popover.ts`
- Modify: `src/view/selection-tag-popover.ts` (keeps only the selection's target),
  `src/view/selection-bar.ts`, `src/view/keys.ts`, `src/view/list-view.ts`, `styles.css`
- Design: `docs/superpowers/specs/2026-11-16-tag-from-menus-design.md` header and "The popover"

**Interfaces:**
- Produces, in `src/view/tags-popover.ts`:

```ts
export interface TagChip { tag: string; text: string }

export interface TagsPopoverTarget {
	/** The dialog's accessible name, such as "Tag the selection". */
	label: string;
	/** The element it opens against. */
	anchor: HTMLElement;
	/** 'above' always opens above the anchor; 'below' opens below it, or above when there is more room above. */
	side: 'above' | 'below';
	/** The button it opens from, whose aria-expanded follows it and which takes focus back; null for a menu's targets. */
	button: HTMLElement | null;
	chips: readonly TagChip[];
	tagsToLeaveOut(): readonly string[];
	add(tag: string): void;
	remove(tag: string): void;
	/** Whether what it opened on changed, read at each render: true closes it. */
	isStale(): boolean;
}

export function buildTagsPopover(view: PrinceListView): void;
export function openTagsPopover(view: PrinceListView, target: TagsPopoverTarget): void;
export function closeTagsPopover(view: PrinceListView): void;
export function placeTagsPopover(view: PrinceListView): void;
export function syncTagsPopover(view: PrinceListView): void;
export function isInTagsPopover(view: PrinceListView, target: Node | null): boolean;
/** Whether it is open, for whichever target: the selection's Tag button toggles it. */
export function isTagsPopoverOpen(view: PrinceListView): boolean;
```

- Produces, in `src/view/selection-tag-popover.ts`: `openSelectionTagPopover(view, button)` and
  `toggleSelectionTagPopover(view, button)`, which build the selection's target and call the above.

- [ ] **Step 1: Move the popover's element, listeners, placing, closing and focus handling into
  `tags-popover.ts`,** unchanged except:
  - a pick closes the popover, returns focus, then calls `target.add`; a × does the same with
    `target.remove`;
  - focus returns to `target.button` when it has one and it takes focus, else to the list
    (`focusList`), on Escape and when a render closes it holding focus;
  - `syncTagsPopover` closes it when `target.isStale()`; it is called where
    `syncSelectionTagPopover` is today (`selection-bar.ts`, after the buttons, before its own
    `focusList`);
  - the dialog's hidden label is made once in `buildTagsPopover`, and each open sets its text to
    `target.label`, since `addHiddenLabel` adds a new element on every call;
  - `openTagsPopover` scrolls the anchor into view (`scrollIntoView({ block: 'nearest' })`) when it
    has no `button`;
  - `placeTagsPopover`, for `side: 'below'`, opens under the anchor when there is at least as much
    room below it as above within the view, else above it. Below adds the class
    `princelists-tags-popover-below` and sets `--princelists-tag-popover-top` to the anchor's bottom
    from the container's top; above uses today's `--princelists-tag-popover-bottom`. Both set
    `--princelists-tag-popover-end` as today;
  - `buildTagsPopover` registers a `scroll` listener on `view.listScrollEl` that re-places the open
    popover, so it follows its anchor.
  The element keeps its classes (`princelists-selection-tag-popover` and the chip classes), so
  `styles.css` gains only the below rule.

- [ ] **Step 2: The selection's target** in `selection-tag-popover.ts`: label "Tag the selection",
  `side: 'above'`, `button` the bar's Tag button, chips from `selectionTags` with the
  `#pantry 2 of 5` text as today, `tagsToLeaveOut` from `sharedCarried`, `add` and `remove` the
  group action and Undo message as today, and `isStale` true once the view isn't selecting or the
  selected rows or their text differ from those it opened with (`sameRowTexts`).

- [ ] **Step 3: `styles.css`:** `.princelists-selection-tag-popover.princelists-tags-popover-below`
  sets `top: calc(var(--princelists-tag-popover-top) + var(--size-4-1))`, `bottom: auto`, and a
  `max-height` that keeps it `var(--size-4-2)` above the view's bottom, so the chips scroll and the
  field stays in view.

- [ ] **Step 4: Callers:** `selection-bar.ts`, `keys.ts` (Escape) and `list-view.ts` (build in
  `onOpen`, close on close, place on resize) call the new names.

- [ ] **Step 5: Design.** Header: `status: building`, `governs: [src/**, styles.css]`, `verified`
  today. "The popover", "Where it opens": a heading's popover opens above it when there is more
  room there, a decided change from "under the heading", so the field never opens off the view's
  bottom; it follows its anchor as the list scrolls.

- [ ] **Step 6: Verify.** `npm test`, `npm run lint`, `npm run build`, `node scripts/check-docs.mjs`
  all pass. Manual check (Review Focus 4): select two items under `## Office #work`, one tagged
  `#urgent`, in a list tagged `[home]`; the bar's Tag button and the selection menu's Tag… each
  open the popover with `#urgent 1 of 2`; `work` and `home` aren't suggested; a pick adds the tag
  with an Undo message; × removes it; Escape returns focus to the Tag button; a press on a row
  only closes it.

- [ ] **Step 7: Commit** with the message "Give the selection's tag popover a target (#434)".

---

### Task 2: Tag… on a heading

**Files:**
- Create: `src/core/heading-tags.ts`, `tests/core/heading-tags.test.ts`, `src/view/heading-tags.ts`
- Modify: `src/view/menus.ts` (`headingMenu`), `src/view/heading-field.ts` (export
  `NAME_REFUSED_NOTICE`), `README.md`, `docs/superpowers/specs/2026-10-20-prince-lists-design.md`,
  `docs/superpowers/specs/2026-11-15-inherited-tags-design.md`

**Interfaces:**
- Consumes: Task 1's `TagsPopoverTarget`, `openTagsPopover`; `setHeadingText`
  (`src/core/edit-headings.ts`), `headingText` (`src/core/display.ts`), `inlineTags`
  (`src/core/item-tags.ts`), `HeadingSave` (`src/core/heading-field.ts`), `TagChange`
  (`src/core/group-menu.ts`).
- Produces, in `src/core/heading-tags.ts`:

```ts
/** The tags at the end of a heading's text, after its last word that isn't a tag, once each by sameTag. */
export function headingEndTags(text: string): string[];
/**
 * Adds `#tag` at the end of the heading on `line`, or removes every spelling of it from the end. `none`:
 * nothing to change. `lost`: no heading on `line`. `refused`: the result wouldn't come back as this
 * heading, or would leave it with no text.
 */
export function planHeadingTag(text: string, contentStart: number, line: number, change: TagChange, tag: string): HeadingSave;
```

- [ ] **Step 1: Write the failing tests** in `tests/core/heading-tags.test.ts`:

```ts
describe('headingEndTags', () => {
	it.each([
		['Office #work', ['work']],
		['Office #work #Home', ['work', 'Home']],
		['Office #work #Work', ['work']],
		['The #work trip', []],
		['#work', ['work']],
		['Use `#tag`', []],
		['Office', []],
	])('%s', (text, tags) => expect(headingEndTags(text)).toEqual(tags));
});

// list(body) is '---\nprincelists: true\n---\n' + body; the heading is on line 3.
describe('planHeadingTag', () => {
	it.each([
		['## Office\n', 'addTag', 'work', '## Office #work\n'],
		['## Office ##\n', 'addTag', 'work', '## Office #work ##\n'],
		['##\n', 'addTag', 'work', '## #work\n'],
		['Office\n===\n', 'addTag', 'work', 'Office #work\n===\n'],
		['Office\nhours\n===\n', 'addTag', 'work', 'Office hours #work\n===\n'],
		['## Office #work #home\n', 'removeTag', 'work', '## Office #home\n'],
		['## Office #work #Work\n', 'removeTag', 'WORK', '## Office\n'],
	])('%j %s %s', (body, change, tag, after) => {
		const result = planHeadingTag(list(body), 3, 3, change, tag);
		expect(result).toMatchObject({ kind: 'write', next: list(after) });
	});
	it.each([
		['## Office #work\n', 'addTag', 'Work'],
		['## The #work trip\n', 'addTag', 'work'],
		['## The #work trip\n', 'removeTag', 'work'],
	])('%j %s %s changes nothing', (body, change, tag) => expect(planHeadingTag(list(body), 3, 3, change, tag)).toEqual({ kind: 'none' }));
	it('refuses to leave a heading with no text', () => {
		expect(planHeadingTag(list('## #work\n'), 3, 3, 'removeTag', 'work')).toEqual({ kind: 'refused' });
		expect(planHeadingTag(list('#work\n===\n'), 3, 3, 'removeTag', 'work')).toEqual({ kind: 'refused' });
	});
	it('is lost when the line is no heading', () => {
		expect(planHeadingTag(list('- [ ] call\n'), 3, 3, 'addTag', 'work')).toEqual({ kind: 'lost' });
	});
	it('keeps a CRLF line ending', () => {
		expect(planHeadingTag('---\r\nprincelists: true\r\n---\r\n## Office\r\n', 3, 3, 'addTag', 'work'))
			.toMatchObject({ next: '---\r\nprincelists: true\r\n---\r\n## Office #work\r\n' });
	});
});
```

- [ ] **Step 2: Run** `npm test -- tests/core/heading-tags.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/core/heading-tags.ts`.** The end tags are the words from the end of
  the text that are `#tag` and that `inlineTags(text)` also finds, so a tag in code or a link isn't
  one. `planHeadingTag` finds the section as `heading-field.ts`'s `findHeading` does. A new tag
  joins the text with one space, or with none when the text is empty, so `##` gets `#work`. It
  calls `setHeadingText` and refuses when that returns null or `headingText` of the result differs
  from the new text, as `saveHeadingName` does. Its `edit` is `ownEdit(line, text, next, 'change')`.
  An add of a tag anywhere in the heading's text, in any spelling, is `none`.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: `src/view/heading-tags.ts`:** `openHeadingTags(view: PrinceListView, line: number): void`
  builds the target: label "Tag the heading", anchor the heading's element (found with
  `ownElement` as `heading-field.ts` finds it; none, nothing opens), `side: 'below'`,
  `button: null`, chips from `headingEndTags`, leave out
  `carriedTags(inlineTags(heading text), view.parse().inherited.list)`, `isStale` true once
  `view.text` differs from the text it opened on. `add` and `remove` run
  `enqueueAt(view, line, (pending) => …)`, and plan inside `writePlanned`'s callback on
  `pending.line` and `contentStartLine(text)`, as `writeField` does (`heading-field.ts`).
  `refused` shows `NAME_REFUSED_NOTICE`, `lost` shows `CHANGED_ELSEWHERE_NOTICE`.

- [ ] **Step 6: `headingMenu`** gets **Tag…** (icon `tag`) after Rename heading in its group,
  through `atLine(anchor, (line) => openHeadingTags(view, line))`. The card's popovers close on
  their own as focus moves into the new field (`events.ts`). `menus.ts` is already over AGENTS.md's
  300 lines; this entry and Task 4's add about 20, and the file isn't split in this plan.

- [ ] **Step 7: Docs.** Step one, "Item actions": Tag… in the heading menu's lists (desktop and
  mobile) and in "The order". Inherited tags, "A heading's tags": the last bullet says they are
  also added and removed with Tag…. README "Tags": a heading's tag can be added with **Tag…** in
  its menu.

- [ ] **Step 8: Verify.** `npm test`, `npm run lint`, `npm run build`, the docs check. Manual
  check on the test vault: Tag… on `## Office` adds `#work`, its items show under a lit `#work`;
  × removes it and Cmd+Z brings it back; `## #work`'s × shows the refusal; a change to the file
  from Markdown view while the popover is open closes it (Review Focus 1); a heading at the view's
  bottom opens the popover above it, and scrolling moves the popover with the heading (Review
  Focus 3); with a card open and its tag popover showing, a right-click on a heading and Tag…
  leaves only the new popover (Review Focus 5).

- [ ] **Step 9: Commit** with the message "Tag a heading from its menu (#434)".

---

### Task 3: Plan an edit of the list's `tags`

Core and its check only; nothing calls them until Task 4.

**Files:**
- Create: `src/core/list-tags-edit.ts`, `tests/core/list-tags-edit.test.ts`
- Modify: `src/obsidian/marker.ts`

**Interfaces:**
- Consumes: `FrontmatterShape`, `MarkerEdit` (`src/core/marker-edit.ts`), `TagChange`.
- Produces, in `src/core/list-tags-edit.ts`:

```ts
export type ListTagsRefusal = { refused: 'not-a-mapping' | 'unreadable' };
/**
 * Plans adding `tag` to the list's `tags` property, or removing every spelling of it, line by line.
 * null: nothing to change. No frontmatter is 'not-a-mapping'.
 */
export function planListTags(text: string, frontmatter: FrontmatterShape | null, change: TagChange, tag: string): MarkerEdit | ListTagsRefusal | null;
/** `before` with `tag` added, or with every spelling of it gone. */
export function expectedListTags(before: readonly string[], change: TagChange, tag: string): string[];
/**
 * The RunEdit kind for `edit`, by the change in its line count: 'insert' for more lines, 'delete' for
 * fewer, 'change' for the same. The edit is above every item, so only the shift matters, and
 * followRange loses a range under a 'change' whose line count differs.
 */
export function listTagsEditKind(edit: MarkerEdit): 'insert' | 'delete' | 'change';
```

- Produces, in `src/obsidian/marker.ts`:

```ts
/** Whether every frontmatter property but `tags` (in any case) parses the same in both texts. */
export function sameButTags(before: string, after: string): boolean;
```

- [ ] **Step 1: Write the failing tests** in `tests/core/list-tags-edit.test.ts`, applying the
  plan with `applyMarkerEdit`. `fm(lines)` is `'---\nprincelists: true\n' + lines + '---\n- [ ] a\n'`
  and `shape` its closing line, with `isMapping: true`:

| Before (`fm` lines) | Change | After | Kind |
|---|---|---|---|
| (none) | add `home` | `tags:\n  - home\n` | insert |
| `tags: work\n` | add `home` | `tags: [work, home]\n` | change |
| `Tags: work\n` | add `home` | `Tags: [work, home]\n` | change |
| `tags: [work]\n` | add `home` | `tags: [work, home]\n` | change |
| `tags: []\n` | add `home` | `tags: [home]\n` | change |
| `tags:\n  - work\n` | add `home` | `tags:\n  - work\n  - home\n` | insert |
| `tags:\n- work\n` | add `home` | `tags:\n- work\n- home\n` | insert |
| `tags:\n` | add `home` | `tags:\n  - home\n` | insert |
| `tags: [work home]\n` | add `home` | `tags: [work home, home]\n` | change |
| `tags: [work, home]\n` | remove `home` | `tags: [work]\n` | change |
| `tags: [work, Work, home]\n` | remove `WORK` | `tags: [home]\n` | change |
| `tags:\n  - work\n  - home\n` | remove `work` | `tags:\n  - home\n` | delete |
| `tags: work\n` | remove `work` | (none) | delete |
| `tags: ["#work"]\n` | remove `work` | (none) | delete |
| `tags:\n  - work\n` | remove `work` | (none) | delete |

  The Kind column is `listTagsEditKind` of the plan. Also: removing `WORK` from
  `tags:\n  - work\n  - home\n  - Work\n` gives `tags:\n  - home\n`, kind delete.
  And: add `Work` to `tags: [work]` and remove `home` from `tags: [work]` return null; a CRLF file
  keeps `\r\n` on every line, new ones included; `isMapping: false` and a null frontmatter give
  `{ refused: 'not-a-mapping' }`; each of these gives `{ refused: 'unreadable' }`:
  `tags: |\n  a\n`, `tags: >\n  a\n`, `tags: [a,\n  b]\n`, `tags: &x [a]\n`, `tags: *x\n`,
  `tags: !!seq [a]\n`, `tags: [a] # c\n`, `tags: work # c\n`, `tags:\n  # c\n  - a\n`,
  `tags: a\nTags: b\n`, `tags:\n  - a: b\n`, `tags: {a: b}\n`, `tags: [a, [b]]\n`,
  `tags: ["a,b"]\n`, `tags: work, home\n`. And `expectedListTags(['work', 'Work', 'home'],
  'removeTag', 'WORK')` is `['home']`, `expectedListTags(['work'], 'addTag', 'home')` is
  `['work', 'home']`.

- [ ] **Step 2: Run** `npm test -- tests/core/list-tags-edit.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `src/core/list-tags-edit.ts`.** Find the `tags` key line in any letter
  case, plain or quoted, as `marker-edit.ts` finds its key; read its value as one of the forms
  above, and refuse anything else. An entry counts as a tag after dropping quotes and a leading
  `#`, compared by `sameTag`. New entries are written plain. A new key goes before the closing
  `---`; a block item copies the indent of the item above it; removing the last tag removes the
  key's lines. A removal of block items on lines apart may be one edit over the run from the first
  to the last, rewriting the lines between as they were.

- [ ] **Step 4: Run** the test. Expected: PASS.

- [ ] **Step 5: `sameButTags`** in `marker.ts`: parse both frontmatters with `parseYaml`; false
  when either isn't a mapping or doesn't parse; otherwise compare every key not matching
  `/^tags$/i` by `JSON.stringify` of its value, whatever the key order. No unit test: `parseYaml`
  is Obsidian's; Task 4's manual check covers it.

- [ ] **Step 6: Verify** `npm test`, `npm run lint`, `npm run build`.

- [ ] **Step 7: Commit** with the message "Plan line edits of a list's tags property (#434)".

---

### Task 4: Tag list… writes the list's `tags`

**Files:**
- Create: `src/view/list-tags.ts`
- Modify: `src/view/menus.ts` (`listMenu`), `src/view/list-view.ts` (`onPaneMenu`), `README.md`,
  `AGENTS.md`, and the designs listed in Step 3

**Interfaces:**
- Consumes: Task 1's popover; Task 3's `planListTags`, `expectedListTags`, `listTagsEditKind`,
  `sameButTags`; `applyMarkerEdit`; `readFrontmatter`, `listTags` (`src/obsidian/marker.ts`).
- Produces: `openListTags(view: PrinceListView): void` and `LIST_TAGS_REFUSED_NOTICE` in
  `src/view/list-tags.ts`.

- [ ] **Step 1: `src/view/list-tags.ts`:** `openListTags` opens the target: label "Tag the list",
  anchor `view.listTitleEl` (null, nothing opens), `side: 'below'`, `button: null`, chips
  `listTags(view.text)`, leave out the same, `isStale` as for a heading. `add` and `remove` run,
  through `enqueueAt(view, null, …)` and `writePlanned`, on the callback's `text`:
  `planListTags(text, readFrontmatter(text), change, tag)`, then
  `next = applyMarkerEdit(text, plan)`, and write only if `sameButTags(text, next)` and
  `listTags(next)` matches `expectedListTags(listTags(text), change, tag)` by `sameTag`, in any
  order. A refusal or a failed check shows `LIST_TAGS_REFUSED_NOTICE` ("The list's tags can't be
  changed here. Use Show file properties."). The `edit` is
  `ownEdit(plan.start, text, next, listTagsEditKind(plan))`.

- [ ] **Step 2: Menus.** `listMenu` gets **Tag list…** (icon `tag`) after New heading;
  `onPaneMenu` gets it before Show archived items, inside the `isListText` check.

- [ ] **Step 3: Docs.**
  - Inherited tags: Approach 1 no longer says the property is read only or set outside the list
    view; Approach 3 says it was reversed in #434, with a link to the tag from menus design; "Not
    in this design" drops setting a list's tags; "Where it's set" adds Tag list….
  - Step two, "Right-click menus": Tag list… in the list menu, and a line that the pane's ⋯ menu
    has it on a list.
  - Tagging a selection, "The popover": it is shared with a heading's and the list's (tag from
    menus).
  - README "Tags" and "How a list is stored" (`tags`): Tag list….
  - AGENTS.md, "Read before working": the tag from menus design beside inherited tags, and this
    plan in the list of plans.
  - This design: `status: live`.

- [ ] **Step 4: Verify.** `npm test`, `npm run lint`, `npm run build`, the docs check. Manual
  check on the test vault, with Obsidian's Properties sidebar open beside the list:
  - Tag list… adds `home` to a list with no `tags`, with `tags: work`, with `tags: [work]` and
    with a block list, and no other frontmatter line changes (diff the file);
  - × removes it, the last one removing the key; Cmd+Z brings back the exact text (Review
    Focus 2);
  - with the card's notes open on an item, adding and removing a list tag keeps the notes open on
    that item;
  - the sidebar shows each change, and a change made in the sidebar while the popover is open
    closes it (Review Focus 1);
  - `tags: [a] # c` shows the refusal and nothing is written;
  - the ⋯ menu's Tag list… with the list scrolled down scrolls the title into view and opens under
    it (Review Focus 3);
  - rerun Task 1's selection check (Review Focus 4).

- [ ] **Step 5: Commit** with the message "Tag the list from its menus (#434)".
