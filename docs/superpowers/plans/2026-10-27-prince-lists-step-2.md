# PrinceLists step two Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on** pull request #47, which adds dragging and collapsing headings to the step-two
> design. It merges before this plan.

**Goal:** Build step two of PrinceLists, what's needed before moving in: "Turn into list", a star,
the empty-list hint and Cmd+Enter, ticking checklists, Cmd+F, dragging and collapsing headings, a
When day with a Schedule view, and lists inside other notes. Then release it as `0.4.0`.

**Architecture:**
- **Step one is the base.** Every list-view write still goes through `writeAction` or a typing
  session, and every line-based state still follows `OwnEdit`s. One-line edits of an item (star,
  When) share one planner, `planItemLineEdit`, so the title field and undo follow them as they
  follow a tick. A heading drag moves its section through the item move's own check, taken out as
  `reorderChecked`.
- **Pure rules go in `src/core/`:** the marker edit, the star, the When field and its day labels,
  checklist lines, the filter, section moves, collapsed headings and the Schedule's groups. Each
  comes with failing tests first.
- **Two new surfaces reuse the rows' pieces.** Task 9 moves rendering from "the view" to a small
  `RowHost`, so the `princelists` code block (a `MarkdownRenderChild`) draws rows with the list
  view's `buildRow` and `buildHeading`. The Schedule view (an `ItemView`) draws its own rows, which
  show a list's name and have no notes, from the same pieces: `renderInline`, `addStar` and
  `addWhen`. The block keeps its text in a `ListEditing`, as the view does, for its tracked lines,
  and writes through `guardedWrite`. Task 14 moves dragging onto a `RowDragHost`, so the block can
  use both drags.
- **Refactors land alone.** Tasks 9 and 14 change no behavior, each in its own pull request.
- **`list-view.ts` (263 lines) stays under 300.** Its keys move to `src/view/keys.ts` (Task 3), the
  filter's handlers live in `filter.ts`, collapsed headings in `CollapsedHeadings`, and opening an
  item from the Schedule view in `src/view/open-item.ts`. The view itself gains only fields.

**Tech Stack:** as in 1b: TypeScript 6.0, esbuild 0.28, ESLint 10 with `eslint-plugin-obsidianmd`,
`obsidian` 1.14.4 types, `commonmark` 0.31.x (runtime), `vitest` (tests only).

**Spec:** `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`, which leans on the
[step one design](../specs/2026-10-20-prince-lists-design.md): "Items", "Item notes", "Where `✔`
goes", "Frontmatter", "Selecting and adding", "Dragging", "Undo (1b, call)" and "Rendering notes in
the card". This plan cites both by heading; "the design" alone means step two's.

**How work lands:** as in 1b. Each task is one pull request that the owner squash-merges, so
"Commit with the message X" means the pull request's title is X. Each pull request checks both
designs against the change and updates them, or says in one line that they still hold, and sets the
step-two design's `verified` date. **`<test vault>`** means what it means in the 1a plan. Every
manual check runs there, never in a vault with real notes.

## Global Constraints

- **Everything in the 1a and 1b plans' Global Constraints still holds,** and so does `AGENTS.md`.
- **The manifest:** `minAppVersion` stays `1.5.7`. Every API this plan names was checked in
  `obsidian.d.ts` 1.14.4: `registerMarkdownCodeBlockProcessor` and `Vault.cachedRead` are `@since
  0.9.7`, `Editor.replaceRange` 0.11.11, `TextFileView.save` 0.10.12, `Keymap.isModifier` 0.12.17
  and `setActiveLeaf(leaf, {focus})` 0.16.3. `MarkdownRenderChild`, `MetadataCache.on('changed')`,
  `moment` and `parseYaml` carry no `@since`; nor does `getLinkpath`. `getFrontMatterInfo` is
  1.5.7, `MetadataCache.getFirstLinkpathDest` 0.15.3 and `Platform.isDesktopApp` 0.12.2; `Scope`
  and `Menu` are already used in step one. Not allowed: `TExternalFile` (1.14.4) and
  `Workspace.revealLeaf` (1.7.2).
- **Never `fileManager.processFrontMatter`** and never re-serialize YAML: "Turn into list" writes
  one line.
- **New IDs, stable once released:** commands `turn-into-list`, `find-in-list` and `open-schedule`;
  view type `princelists-schedule`; code block language `princelists`. No default hotkeys. Cmd+F
  and Cmd+Enter go through the list view's `scope`, as Cmd+Z does.
- **No new dependencies, and no timers** except the 1b drag's.
- **Writing:** a write only in response to a user action, through a guarded `vault.process` or
  `writeAction`; the one exception is "Turn into list" from an open editor, which writes through
  that editor and `TextFileView.save` (the design, "The marker, added by Turn into list").
- **The file format:** the When is ` ⏳ YYYY-MM-DD`, read from `⏳` or `⌛`, written with `⏳`. The
  star is ` ⭐` at the end of the title, read with an optional U+FE0F, written without it.
- **Styling:** icons are Lucide's `star`, `calendar`, `chevron-down` and `chevron-right` through
  `setIcon`; the star is `--color-yellow`, the hint and the collapse arrow `--text-faint`. No
  hard-coded colors.
- **Interface text** added in step two is this, worded exactly:
  - Commands and menu items: "Turn into list", "Find in list", "Open schedule", "Delete".
  - The card's star button's `aria-label`: "Add star" or "Remove star".
  - "The note's properties can't be read, so it wasn't turned into a list."
  - "The note's princelists property runs over several lines, so it wasn't turned into a list."
  - "Couldn't turn {name} into a list.", where `{name}` is the note's name **(call)**.
  - "Press Cmd+Enter or + to add an item", "Press Ctrl+Enter or + to add an item" and "Tap + to add
    an item".
  - The collapse arrow's hidden label "Collapse section", with `aria-expanded`.
  - The filter field's placeholder "Find in list"; the date input's `aria-label` "When"; the clear button's
    `aria-label` "Remove the day"; the day labels "Today" and "Tomorrow".
  - The Schedule view's title "Schedule", its groups "Today", "Tomorrow", "Next 7 days" and
    "Later" (owner, 2026-10-27), and "No items have a When." when every group is empty **(call)**.
  - In a block: the button "New item", the trash button's `aria-label` "Delete item", and the gray
    lines "This block needs a link to a list, such as [[Groceries]].", "[[{link}]] doesn't lead to
    a note.", "[[{link}]] isn't a list." and "[[{link}]] is this note, so it can't show here."
    **(call)**, where `{link}` is the link as written.
  - Writes from the Schedule view or a block: "Couldn't save the change to this list.", "This list
    changed elsewhere. Try again.", "Repeating items can't be ticked here yet." and the Undo
    message "Item deleted.".

## Review Focus

- **The same list open in a list view with typing not yet saved, while a block or the Schedule
  view writes to it.** Nothing typed is lost, and the list view follows the change.
- **Cmd+Z in the list view after a block or the Schedule view wrote to the same list.** Undo never
  writes back a text from before that write.
- **A list renamed, moved or deleted while a write from the Schedule view or a block waits.**
  Nothing is written to another file, and no error is thrown.
- **A card whose notes hold a callout, an embed or a code fence with checkboxes, on the iPhone as
  well as the Mac.** No tick lands on another line.
- **"Turn into list" from an editor with typing not yet saved, on the iPhone.** The typing and the
  marker both reach the file, and the note opens as a list.

---

### Task 1: Turn a note into a list

**Files:**
- Create: `src/core/marker-edit.ts`, `tests/core/marker-edit.test.ts`,
  `src/obsidian/turn-into-list.ts`
- Modify: `src/core/frontmatter.ts`, `tests/core/frontmatter.test.ts`, `src/obsidian/marker.ts`,
  `src/main.ts`, the design's header and "The marker, added by Turn into list"; step one's
  "Creating, renaming, moving and deleting lists"

**Interfaces:**
- Produces, in `src/core/frontmatter.ts`: `isYamlMapping(yaml: unknown): boolean`: true for a plain
  object and for `null`, which empty frontmatter or one holding only comments parses to **(call)**.
- Produces, in `src/core/marker-edit.ts`:
  - `interface FrontmatterShape { closingLine: number; isMapping: boolean }`: the line of the
    closing `---`, and whether the YAML is a mapping
  - `interface MarkerEdit { start: number; deleteCount: number; insert: string[] }`, in lines
  - `planMarker(text: string, frontmatter: FrontmatterShape | null): MarkerEdit | { refused:
    'not-a-mapping' | 'multiline-value' }`. A `princelists:` line at column 0 between the
    delimiters is replaced. It's `multiline-value` when a block indicator follows the colon (`|`
    or `>`, with any chomping or indentation indicator, such as `>-`, `|+` or `|2`), or when the
    next line is indented or starts with `- `. A bare `princelists:`, YAML's null, is one line and
    is replaced.
  - `applyMarkerEdit(text: string, edit: MarkerEdit): string`: through `spliceLines`, with
    `dominantEol` for new lines
- Produces, in `src/obsidian/marker.ts`: `readFrontmatter(text: string): FrontmatterShape | null`,
  from `getFrontMatterInfo` at byte 0 and `parseYaml`; a parse that throws is not a mapping.
- Produces, in `src/obsidian/turn-into-list.ts`: `canTurnIntoList(app: App, file: TFile): boolean`
  and `turnIntoList(plugin: Plugin, file: TFile): Promise<void>`.

- [ ] **Step 1: Write the failing tests** in `tests/core/marker-edit.test.ts`, applying the plan
  with `applyMarkerEdit`. `fm(n)` is `{closingLine: n, isMapping: true}`:

| Text | Frontmatter | Expected |
|---|---|---|
| `---\ntitle: A\n---\nBody\n` | `fm(2)` | `---\ntitle: A\nprincelists: true\n---\nBody\n` |
| `---\nprincelists: false\ntags: [a]\n---\n` | `fm(3)` | `---\nprincelists: true\ntags: [a]\n---\n` |
| `---\n---\nBody\n` | `fm(1)` | `---\nprincelists: true\n---\nBody\n` |
| `Body\n- [ ] a\n` | `null` | `---\nprincelists: true\n---\nBody\n- [ ] a\n` |
| `Body\r\n` | `null` | `---\r\nprincelists: true\r\n---\r\nBody\r\n` |
| `---\r\nt: 1\r\n---\r\n` | `fm(2)` | `---\r\nt: 1\r\nprincelists: true\r\n---\r\n` |
| `Body` (no final newline) | `null` | `---\nprincelists: true\n---\nBody` |
| `''` (empty) | `null` | `---\nprincelists: true\n---\n` |
| `---\n- a\n---\n` | `{closingLine: 2, isMapping: false}` | refused `not-a-mapping` |
| `---\nprincelists:\n  - x\n---\n` | `fm(3)` | refused `multiline-value` |
| `---\nprincelists: \|\n  x\n---\n` | `fm(3)` | refused `multiline-value` |
| `---\nprincelists: >-\n  x\n---\n`, the same with `\|+`, and `---\nprincelists:\n- x\n---\n` | `fm(3)` | refused `multiline-value` |
| `---\nprincelists:\ntitle: A\n---\n` | `fm(3)` | `---\nprincelists: true\ntitle: A\n---\n` |

  In `tests/core/frontmatter.test.ts`: `isYamlMapping` is true for `{}`, `{a: 1}` and `null`, and
  false for `['a']`, `'x'`, `5` and `undefined`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build `src/obsidian/turn-into-list.ts`.**
  - `canTurnIntoList`: a `.md` file the metadata cache doesn't report the marker for, that the
    vault holds (`vault.getAbstractFileByPath(file.path) === file`), since `TExternalFile` is newer
    than `minAppVersion`.
  - `turnIntoList` finds a `MarkdownView` showing the file: the active one, else the first among
    `getLeavesOfType('markdown')`. **With one,** it plans on `editor.getValue()`, which holds unsaved
    typing, applies the edit with `editor.replaceRange(insert.map((l) => l + '\n').join(''), {line:
    start, ch: 0}, {line: start + deleteCount, ch: 0})`, then `await view.save()`. **Without
    one,** it plans and applies inside `vault.process`, on the text it's given. A text that already
    has the marker isn't written; it only opens.
  - A refusal shows its notice and writes nothing.
  - **Opening:** before writing, it listens for `metadataCache.on('changed')` on that file through
    `plugin.registerEvent`, and decides on the event's `data`, the text the cache was built from.
    `isListText(data)` opens the note with `openAsList` in the editor's leaf, or
    `workspace.getLeaf(false)` without one. A `data` without the marker is ignored, since it may
    come from an earlier save **(call)**. The wait also ends, with no note opened, when the write or
    `save` throws (it shows "Couldn't turn {name} into a list."), when the file is deleted or
    renamed (`vault.on('delete')`, `vault.on('rename')`), or when a newer "Turn into list" starts,
    since only one wait is kept **(call)**. Each way it `offref`s every listener it registered.
- [ ] **Step 4: Register it in `src/main.ts`:** the command `turn-into-list` with a
  `checkCallback` on the active `MarkdownView`'s file, true when `canTurnIntoList` and
  `!isListText(view.getViewData())`; and a `file-menu` item for a `TFile` that `canTurnIntoList`
  accepts, with the `RIBBON_ICON`.
- [ ] **Step 5: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 6: Check it by hand on the Mac, then the iPhone.**
  1. A note with frontmatter and one without each become lists and open as lists. `git diff` on a
     copy shows one or three added lines and nothing else.
  2. **Design risk 6:** type a line into an open note and run the command within 2 seconds. The typed line
     and the marker are both in the file, and the note opens as a list only after the cache has
     the marker. If it switches early or loses the line, stop and raise it in the pull request.
  3. A CRLF note turned into a list from an open editor: record whether the file keeps CRLF. If the
     editor's save writes LF, raise it: that is Obsidian's editor, not the plugin's edit.
  4. Notes whose frontmatter is `- a`, broken YAML, or `princelists:` over two lines show their
     notice and don't change.
  5. The file explorer's menu on a note offers "Turn into list"; on a list or a folder it doesn't.
     On the iPhone, a long-press on a note offers it.
  6. On a note opened from outside the vault, the command isn't offered. If
     `getAbstractFileByPath` can't tell it apart, stop and raise it.
  7. A note holding only `---` twice, and one with `Body` after them: `princelists: true` lands
     between the two `---` lines. If `getFrontMatterInfo` doesn't see the empty frontmatter, so
     the marker lands above it as a second block, stop and raise it.
- [ ] **Step 7: Update the designs.** In the step-two design, set `status: building`, add
  `governs: [src/**, styles.css, manifest.json]`, and in "The marker, added by Turn into list" say
  the YAML is read from the text being edited with `parseYaml`, as `marker.ts` reads the marker,
  since the cache lags an editor's unsaved text **(call)**, and that empty frontmatter counts as a
  mapping. In step one's "Creating, renaming, moving and deleting lists", add "Turn into list" as
  the way an existing note becomes a list.
- [ ] **Step 8: Commit** with the message "Turn a note into a list".

### Task 2: Star an item

**Files:**
- Create: `src/core/star.ts`, `tests/core/star.test.ts`, `src/view/line-edit.ts`,
  `src/view/row-marks.ts`
- Modify: `src/core/list-actions.ts`, `src/core/title-field.ts`, `src/core/editing.ts`
  (`selectedTitle`), `src/core/missing-typing.ts`, `src/core/display.ts`, their tests,
  `src/view/render-list.ts`, `src/view/menus.ts`, `styles.css`; step one's "Editing" and "Item
  actions"

**Interfaces:**
- Produces, in `src/core/star.ts`:
  - `splitStar(title: string): { plain: string; star: string }`: `star` is the title's trailing
    space, `⭐` and optional U+FE0F as written, or `''`
  - `setStar(line: string, starred: boolean): string`: adds ` ⭐` at the end of the title, or
    removes `star`, and changes nothing else, not even the spacing before the tail
  - `keepStar(savedTitle: string, typed: string): string`: `typed`, with a trailing star dropped
    and the saved title's star put back, when the saved title has one; else `typed` as it is
- Produces, in `src/core/list-actions.ts`:
  - `interface PlannedLineEdit { next: string; edit: OwnEdit }`
  - `planItemLineEdit(text: string, contentStart: number, titleLine: number, change: (line: string)
    => string): PlannedLineEdit | null`: null when no item is on the line or `change` leaves it as
    it is. The edit is `{start: titleLine, delta: 0, kind: 'change', retitle: change}`, so a title
    field with focus makes the same change to its saved line.
- Produces: `ItemRow.title` and `ItemRow.label` without the star, and `ItemRow.starred: boolean`.
- Produces, in `src/view/line-edit.ts`: `queueLineEdit(view: PrinceListView, titleLine: number,
  change: (line: string) => string): void`, through `enqueueAt` and `writePlanned`, calling
  `view.render()` once written.
- Produces, in `src/view/row-marks.ts`: `addStar(rowEl: HTMLElement): void`, a span with the class
  `princelists-star` and `setIcon(el, 'star')`.

- [ ] **Step 1: Write the failing tests** in `tests/core/star.test.ts` (`F` is U+FE0F):

| Call | Expected |
|---|---|
| `splitStar('Buy milk ⭐')` | `{plain: 'Buy milk', star: ' ⭐'}` |
| `splitStar('Buy milk ⭐' + F)` | `{plain: 'Buy milk', star: ' ⭐' + F}` |
| `splitStar('5⭐')` and `splitStar('⭐')` | `star: ''`, the title unchanged |
| `setStar('- [ ] Buy milk', true)` | `'- [ ] Buy milk ⭐'` |
| `setStar('- [x] Buy milk ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id', true)` | `'- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id'` |
| `setStar` of that result, `false` | the line before it |
| `setStar('- [ ] a ⭐' + F + ' #shop  ', false)` | `'- [ ] a #shop  '` |
| `setStar('- [ ] a📅 2026-10-30', true)` | `'- [ ] a ⭐📅 2026-10-30'` |
| `setStar('- [ ] a ⭐', true)` | unchanged |
| `keepStar('milk ⭐', 'oat milk')` and `keepStar('milk ⭐', 'oat milk ⭐')` | `'oat milk ⭐'` |
| `keepStar('milk ⭐' + F, 'oat')` | `'oat ⭐' + F` |
| `keepStar('milk', 'milk ⭐')` | `'milk ⭐'` |

  Also: `typeTitle` on the saved line `- [x] milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30` with `oat
  milk` typed writes `- [x] oat milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30`; `selectedTitle` on a
  starred item is `milk`; `missingTyping` finds the typed `milk` in a file holding `- [ ] milk ⭐`;
  `itemRow` gives `title: 'milk', label: 'milk', starred: true`; and `planItemLineEdit` returns
  null on a heading's line and for a change that changes nothing.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS. `typeTitle` calls
  `setItemTitle(withSaved, item, keepStar(savedTitle, oneLineTitle(typed)))`.
- [ ] **Step 3: Build the view.** `buildRow` calls `addStar` after the title when `row.starred`.
  The open card has a star button between its When and its ⋯, labeled "Add star" or "Remove star",
  which calls `queueLineEdit(view, line, (l) => setStar(l, !isStarred(l)))`; the item menu has no
  star entry (owner). `.princelists-star` gets `color:
  var(--color-yellow)` and `fill: currentColor` on its `svg`, so it reads as set **(call)**.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. Add and remove a star from the right-click menu and from the card's ⋯. The file changes only
     by ` ⭐`, and the row shows the yellow star, not the emoji.
  2. A starred item's title field shows no star; typing and leaving keeps one. Cmd+Z unstars.
  3. With Tasks installed, a query still lists a starred done item with its ⏳ date, and shows ⭐
     in its description.
- [ ] **Step 6: Update step one's design.** In "Editing", the title field hides the star too and
  puts it back on save; "Item actions" says the star is a button on the open card, not a menu
  entry.
- [ ] **Step 7: Commit** with the message "Star an item".

### Task 3: Hint at adding to an empty list, and add with Cmd+Enter

**Files:**
- Create: `src/view/keys.ts`
- Modify: `src/view/list-view.ts`, `src/view/undo.ts`, `src/view/add-button.ts`,
  `src/view/redraw.ts`, `src/view/events.ts`, `styles.css`; step one's "Selecting and adding"

**Interfaces:**
- Consumes: `hasNoItems(view)`.
- Produces, in `src/view/keys.ts`: `registerListKeys(view: PrinceListView): void`, which the
  constructor calls in place of `registerUndoKeys`. It sets `view.scope = new
  Scope(view.app.scope)`, registers Mod+Z and Mod+Shift+Z, which move here from `undo.ts` (their
  actions stay there), and `['Mod'], 'Enter'`, which calls `newItem` and returns `false`. Task 5
  adds Mod+F here.
- Produces, in `src/view/add-button.ts`: `newItem(view: PrinceListView): void`, now exported. It
  does nothing unless `isListText(view.text)`: the view can show a note whose marker went, as
  `syncArchivedButton` allows for.

- [ ] **Step 1: Move the keys and add Cmd+Enter.** Cmd+Enter applies in every field too, a
  card's included **(call; the design)**, so `onKeyDown`'s Enter branches return early when
  `Keymap.isModifier(evt, 'Mod')`: Cmd+Enter in a card's title mustn't also close the card.
- [ ] **Step 2: Draw the hint.** In `redraw`, when `hasNoItems(view)`, add a `div` with the class
  `princelists-empty-hint` after the list note, and the class `princelists-is-empty` to the
  sizer. The text is "Tap + to add an item" when `Platform.isMobile`, else "Press Cmd+Enter or + to
  add an item" when `Platform.isMacOS`, else the Ctrl version. `isMobile` comes first, so an iPad
  with a keyboard still reads "Tap" **(call)**.
- [ ] **Step 3: Style it.** `.princelists-is-empty` makes the sizer `display: flex;
  flex-direction: column; min-height: 100%`, and the hint is `flex: 1; display: flex;
  align-items: center; justify-content: center; color: var(--text-faint)`, so it sits centered in
  the space below the list note.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. A new list shows the hint centered below the list note. The first item takes it away;
     deleting the last item brings it back. A list whose items are all archived shows no hint.
  2. Cmd+Enter with nothing selected adds the first item; with a card open, below it, also with
     the cursor in the card's title or notes. The list title's Enter still starts the first item.
  3. Cmd+Enter in a Markdown note does what it does there. The iPhone shows "Tap + to add an item".
  4. Remove the marker of a list open in the view, from Markdown in another pane: Cmd+Enter in the
     view writes nothing.
- [ ] **Step 6: Update step one's design** in "Selecting and adding": Cmd+Enter does what "+" does,
  and an empty list shows the hint.
- [ ] **Step 7: Commit** with the message "Hint at adding to an empty list, and add with
  Cmd+Enter".

### Task 4: Tick checklists in a card

**Files:**
- Create: `src/core/checklist.ts`, `tests/core/checklist.test.ts`, `src/view/checklist.ts`
- Modify: `src/view/notes.ts`, `src/view/card.ts` (`showNotes`), `src/view/events.ts`; step one's
  "Checklists" and "Rendering notes in the card"

**Interfaces:**
- Produces, in `src/core/checklist.ts`:
  - `interface ChecklistLine { line: number; ticked: boolean }`
  - `checklistOf(lines: readonly Line[], item: ItemBlock): ChecklistLine[]`: the item's notes,
    `getItemNotes`, parsed with commonmark. Each `item` node at any depth whose source line
    `parseItemLine` reads is one, in order. Its file line is that of the first non-blank line after
    the title, where `getItemNotes` starts, plus its offset.
    A list item in a blockquote or callout doesn't parse, so it isn't counted.
  - `toggleChecklistLine(text: string): string`: `x` for a space, a space for anything else, and
    nothing else changes
  - `planChecklistTick(text: string, contentStart: number, titleLine: number, index: number,
    lineText: string): PlannedLineEdit | null`: ticks or unticks the `index`th line as the file
    holds it now **(call)**: a checkbox has already flipped by the time its click is handled, so
    its state isn't evidence. The edit is `{start: line, delta: 0, kind: 'change'}`. Null when the
    item is gone, or its `index`th line doesn't read `lineText`, the text it had at the click.
- Produces, in `src/view/notes.ts`: `renderCardNotes(view: PrinceListView, el: HTMLElement,
  markdown: string, checklist: readonly ChecklistLine[]): Component`. Once rendered, the boxes are
  enabled only when their count and each ticked state match `checklist`; otherwise all stay
  disabled, as step one does.
- Produces, in `src/view/checklist.ts`: `checklistClick(view: PrinceListView, box: HTMLInputElement,
  evt: MouseEvent): void`.

- [ ] **Step 1: Write the failing tests** in `tests/core/checklist.test.ts`, on
  `- [ ] trip\n\n\tPack:\n\t- [ ] passport\n\t- [x] charger\n\t\t- [ ] cable\n\t1. [?] tickets\n`:
  - `checklistOf` gives lines 3, 4, 5 and 6, ticked `false`, `true`, `false`, `true`.
  - With a fenced block holding `- [ ] x`, a `> - [ ] y` callout line and an indented `%%` comment
    holding `- [ ] z` added to the notes, the fence and callout lines aren't counted. The `%%` line
    is, which is why the view compares counts.
  - `toggleChecklistLine`: `\t- [ ] passport` gives `\t- [x] passport`; `\t- [x] charger` and
    `\t1. [?] tickets` untick to a space; `\t- [ ] a ✔ 2026-10-27 18:05` changes only its box.
  - `planChecklistTick(text, 0, 0, 1, '\t- [x] charger')` unticks `charger`, its `edit` `{start: 4,
    delta: 0, kind: 'change'}`; a CRLF file keeps CRLF. Index 4, a heading's line, the line text
    `'\t- [ ] passport'`, and the same call after a line was added to the notes above `charger`
    give null.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the view.** `showNotes` renders with `renderCardNotes` and the selected item's
  `checklistOf`. In `onClick`, a `.task-list-item-checkbox` inside the open card's notes goes to
  `checklistClick`; any other still only cancels. `checklistClick` cancels the click, so the box
  shows the file, and checks again that the notes' box count equals the checklist's: an embed can
  render more boxes after the first check, and then every box is disabled and nothing is written.
  Otherwise it records `view.outsideChanges` and the line's text at the click, as `queueTick`
  does, and queues `planChecklistTick` for the box's index on the selected item through
  `enqueueAt` and `writePlanned`. When it runs, a changed `outsideChanges`, or a plan that comes
  back null, shows `CHANGED_ELSEWHERE_NOTICE` and writes nothing; once written, it calls
  `view.render()`.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. **Design risk 1:** in cards built from step one's fixtures, plus nested and numbered checklists,
     every box ticks its own line: compare `git diff` after each. If any box ticks another line,
     stop and raise it.
  2. Cmd+Z unticks it again.
  3. A card whose notes hold a callout with a checklist, an embed of a note with checkboxes, or a
     `%%` comment holding one shows every box disabled, and a click writes nothing.
  4. The row shows nothing about the checklist.
- [ ] **Step 6: Update step one's design:** "Checklists" says step two ticks them, and "Rendering
  notes in the card" says boxes are enabled only when they match the parsed checklist.
- [ ] **Step 7: Commit** with the message "Tick checklists in a card".

### Task 5: Filter a list with Cmd+F

**Files:**
- Create: `src/view/filter.ts`
- Modify: `src/core/display.ts`, `tests/core/display.test.ts`, `tests/core/editing.test.ts`,
  `tests/core/render-timing.test.ts`, `src/view/render-list.ts`, `src/view/redraw.ts`,
  `src/view/list-view.ts`, `src/view/keys.ts`, `src/view/events.ts`, `src/main.ts`, `styles.css`;
  the design's "Cmd+F"; step one's "Layout"

**Interfaces:**
- Produces, in `src/core/display.ts`:
  - `interface RowFilter { showArchived: boolean; query: string; keepLine: number | null }`
  - `visibleSections(lines, model, now, filter: RowFilter): SectionRows[]`, replacing the
    `showArchived` parameter. A `query` of `''` filters nothing.
  - `matchesQuery(title: string, notes: string, query: string): boolean`: `toLowerCase()` on both,
    no normalization, Markdown as written
- Produces, on `PrinceListView`: `filter: string | null` (null while the field is closed) and
  `filterEl: HTMLInputElement | null`; `clear()` sets `filter` to null.
- Produces: Mod+F in `registerListKeys`, calling `openFilter`. In `src/view/filter.ts`:
  `openFilter(view)`, `buildFilterField(view, parent): HTMLInputElement`,
  `filterInput(view)`, `filterKeyDown(view, evt)` and `filterBlur(view)`.

- [ ] **Step 1: Write the failing tests** in `tests/core/display.test.ts`, and move the existing
  callers to `RowFilter`:
  - `MILK` keeps `Buy milk`; `**bold**` keeps an item whose notes hold `**bold** milk`.
  - An NFC `café` doesn't match an NFD title.
  - A heading shows while one of its items shows, and goes when none does.
  - Content the plugin leaves alone is hidden while the query isn't empty **(call)**.
  - A matching archived item stays hidden unless `showArchived`.
  - The item on `keepLine` shows without matching, and so does its heading.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the field.** `renderList` passes `{showArchived, query: view.filter ?? '',
  keepLine: view.selected}`. `redraw` draws the field after the list note while `filter` isn't
  null, and keeps it while it has focus, as it keeps the list title. The field is an `input` with
  the class `princelists-filter` and the placeholder "Find in list".
  - `openFilter` sets `filter` to `''` if it's null, renders, then focuses and selects the field.
  - Typing sets `filter` and renders. Escape sets it to null and focuses the view. Leaving the
    field while it's empty does too **(call)**: emptying it shows every row, and the field stays
    while the cursor is in it.
  - `onInput` also finds `view.filterEl`, and `onKeyDown` sends its Escape to `filterKeyDown`.
  - The "Find in list" command (`find-in-list`) has a `checkCallback` on the active list view.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. **Design risk 2:** Cmd+F with the list focused opens the field, not Obsidian's search, on the Mac and
     on an iPhone with a keyboard. If Obsidian's wins, stop and raise it.
  2. Cmd+F in a Markdown note still opens Obsidian's search.
  3. Typing hides rows as the design says; Escape shows every row.
  4. While filtering: a tick, a card, a drag and "+" all work. A drop lands after the visible row
     above it. A new item stays shown while its card is open.
  5. Reopening the list starts without a filter. On the iPhone, "Find in list" opens the field.
- [ ] **Step 6: Update the designs.** In the step-two design's "Cmd+F", record that content the
  plugin leaves alone hides while filtering. In step one's "Layout", the filter field shows below
  the list note while filtering.
- [ ] **Step 7: Commit** with the message "Filter a list with Cmd+F".

### Task 6: Drag a heading to move its section

**Files:**
- Create: `src/core/reorder.ts`, `src/core/move-section.ts`, `tests/core/move-section.test.ts`
- Modify: `src/core/edit-items.ts`, `src/core/drop.ts`, `tests/core/drop.test.ts`,
  `src/core/list-actions.ts`, `src/view/move.ts`, `src/view/drag-mouse.ts`,
  `src/view/drag-touch.ts`, `src/view/render-list.ts`; the design's "Dragging a heading"; step
  one's "Dragging"

**Interfaces:**
- Produces, in `src/core/reorder.ts`: `reorderChecked(lines: readonly Line[], model: ListModel,
  order: readonly number[]): { lines: Line[]; moved: (number | null)[] }`: the second half of
  `moveItemWithLineMap` moved out as it is, with `surplus` and `newIndexes`. It puts
  the lines in `order`, adds empty lines at the boundaries where blocks changed, and throws
  `UnsafeEditError` when that doesn't help. `moveItemWithLineMap` calls it, and
  `tests/core/move-item.test.ts` passes unchanged.
- Produces, in `src/core/move-section.ts`: `moveSectionWithLineMap(lines: readonly Line[], model:
  ListModel, section: Section, before: Section | null): { lines: Line[]; moved: (number | null)[]
  }`: the lines from `section.headingLine` to `section.endLine` go before `before.headingLine`, or
  after the last line when `before` is null, through `reorderChecked`.
- Produces, in `src/core/list-actions.ts`: `planSectionMove(text: string, contentStart: number,
  headingLine: number, before: number | null): PlannedMove | null`: null when either heading is
  gone, `headingLine` is the top section, or the text doesn't change. The edit is `moveEdit(moved)`.
- Produces, in `src/core/drop.ts`:
  - `interface SectionDrop { before: number | null; line: number; above: boolean }`: the heading
    the section goes before, or null for the end, and where the drop line shows
  - `sectionDropAt(shown: readonly ShownRow[], dragged: number, over: { line: number; below:
    boolean }): SectionDrop | null`: the gap is under `over` in its lower half and above it
    otherwise, as `dropAt` reads it; the section goes before the first heading shown at or after
    that gap, or to the end when there is none **(call)**. The line shows above that heading, or
    under the last shown row for the end. null when the section would stay where it is.
- Produces, in `src/view/move.ts`: `type RowDrop = { item: Drop } | { section: SectionDrop }`;
  `aimDrop(shown: readonly ShownRow[], dragged: ShownRow, over: { line: number; below: boolean }):
  RowDrop | null`; `queueDrop(view: PrinceListView, line: number, drop: RowDrop): void`; and
  `queueSectionMove(view, headingLine: number, before: number | null): void`, which tracks both
  lines as `queueMove` does. `markDrop` takes a `RowDrop | null`.

- [ ] **Step 1: Write the failing tests.** In `tests/core/drop.test.ts`, with `shown = [item(1),
  heading(2), item(3), heading(4), item(5), untouched(6)]`:

| Call | Expected |
|---|---|
| `sectionDropAt(shown, 4, upper(2))` | `{before: 2, line: 2, above: true}` |
| `sectionDropAt(shown, 4, lower(1))` | the same: the gap after the top items is before heading 2 |
| `sectionDropAt(shown, 4, upper(1))` | the same: never above the items before the first heading |
| `sectionDropAt(shown, 2, lower(6))` | `{before: null, line: 6, above: false}` |
| `sectionDropAt(shown, 2, upper(4))`, `lower(3)` and `upper(2)`, and `sectionDropAt(shown, 4, upper(3))` | `null`: it stays |
| `sectionDropAt(shown, 4, lower(5))` | `null`: the last section dropped at the end stays |

  In `tests/core/move-section.test.ts`, through `planSectionMove`:

| Text | Move | Expected |
|---|---|---|
| `Top\n\n## A\n- [ ] a\n\tnote\n- [x] old ✔ 2026-10-01 09:00\n\nText\n## B\n- [ ] b\n` | A to the end | `Top\n\n## B\n- [ ] b\n## A\n- [ ] a\n\tnote\n- [x] old ✔ 2026-10-01 09:00\n\nText\n` |
| `## A\n- [ ] a\n### A1\n- [ ] a1\n## B\n` | A before B | `### A1\n- [ ] a1\n## A\n- [ ] a\n## B\n`: a `###` below isn't taken along |
| `B\n---\n- [ ] b\n## A\n- [ ] a\n` | B to the end | `## A\n- [ ] a\n\nB\n---\n- [ ] b\n`: one empty line keeps `B` from joining `a` |
| `## A\r\n- [ ] a\r\n## B\r\n- [ ] b` | B before A | `## B\r\n- [ ] b\r\n## A\r\n- [ ] a`, with `moved` `[2, 3, 0, 1]` |
| `## A\n- [ ] a\n## B\n` and then a line of three backticks and `code\n`, a fence never closed | B before A | throws `UnsafeEditError` |
| `## A\n- [ ] a\n## B\n- [ ] b\n` | A before B, or B to the end | `null` |

  Also: a `headingLine` or `before` that isn't a heading's line, such as an item's, gives null.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement, moving `reorderChecked` out
  first with `move-item.test.ts` still passing, and expect PASS.
- [ ] **Step 3: Drag headings in the view.**
  - `buildHeading` makes a heading `draggable` when `ROWS_DRAG`, as `buildRow` does a row.
  - The mouse drag's `startDrag` and the touch drag's `pointerdown` take a `HEADING_CLASS` element
    as well as an item. The drag keeps the dragged `ShownRow`, aims with `aimDrop` and ends with
    `queueDrop`. A heading whose name field is open is the field, not a `HEADING_CLASS` element, so
    it doesn't drag.
  - On the iPhone only the heading lifts; its rows stay until the drop redraws **(call)**. A tap
    still opens the heading menu, and `cancelHoldMenu` already covers headings.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`, then check it by hand on the Mac
  and the iPhone.
  1. Drag a heading above another, and to the end. Its items, notes, archived items and text move
     with it; `git diff` shows only those lines moved.
  2. One Cmd+Z puts it back.
  3. Dropping it where it is writes nothing. The drop line never shows above the first heading's
     items.
  4. With Cmd+F filtering, a moved section takes its hidden rows along.
  5. A drag near the top or bottom edge scrolls the list on the iPhone, and a tap on a heading
     still opens its menu.
  6. A section that can't move safely shows "This list's layout can't take that change. Make it
     in Markdown instead." and writes nothing.
- [ ] **Step 5: Update the designs.** In the step-two design's "Dragging a heading", record which
  heading a drop over a row goes before, and that only the heading lifts on the iPhone. In step
  one's "Dragging", headings drag too.
- [ ] **Step 6: Commit** with the message "Drag a heading to move its section".

### Task 7: Collapse a heading

**Files:**
- Create: `src/core/collapsed.ts`, `tests/core/collapsed.test.ts`, `src/view/collapse.ts`
- Modify: `src/core/display.ts`, `tests/core/display.test.ts`, `src/view/list-view.ts`,
  `src/view/render-list.ts`, `src/view/events.ts`, `src/view/drag-touch.ts`,
  `src/view/add-button.ts`, `src/view/move.ts`, `styles.css`; the design's "Collapsing a heading";
  step one's "Layout"

**Interfaces:**
- Produces, in `src/core/collapsed.ts`:
  - `class CollapsedHeadings`, built with `(editing: ListEditing)`. It keeps each collapsed
    heading as a `TrackedLine` from `editing.track`, so it follows the view's own edits
    (`followLine`) and outside changes (`mapLine`) as the selection does. Nothing of it is written
    or saved in the view's state.
  - Its methods: `toggle(headingLine: number): void`, `expand(headingLine: number): void`,
    `clear(): void`, and `lines(): ReadonlySet<number>`, which untracks and leaves out lines that
    went
  - `sectionHeadingOf(model: ListModel, line: number): number | null`: the heading line of the
    section that holds `line`, or null for the top section
- Produces, in `src/core/display.ts`: `RowFilter.collapsed: ReadonlySet<number>`. A section whose
  heading line is in it shows only its heading, and the `keepLine` row, while `query` is `''`.
  While it isn't, its matches show as in any section **(call; the design)**.
  `SectionRows.collapsed: boolean`, true for a heading in the set, filtering or not.
- Produces, on `PrinceListView`: `collapsed: CollapsedHeadings`, which `clear()` empties, so every
  heading is open each time a list opens.
- Produces, in `src/view/collapse.ts`: `addCollapseArrow(headingEl: HTMLElement, collapsed:
  boolean): void`, a `button` with the class `princelists-collapse`, `setIcon` `right-triangle`,
  the hidden label "Collapse section" and `aria-expanded`; and `expandFor(view:
  PrinceListView, place: ItemPlace): void`, which expands the section the place's line is in.

- [ ] **Step 1: Write the failing tests.** In `tests/core/collapsed.test.ts`, on
  `---\nprincelists: true\n---\n- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n` in a `ListEditing`:
  - `toggle(4)` gives `lines()` `{4}`, and a second `toggle(4)` gives `{}`.
  - After `applyOwn` of an item inserted at line 3, `lines()` is `{5}`. After an own move of
    section C before B (Task 6's `planSectionMove`), it is C's new line.
  - After `outsideChange` that adds a line above B, it is `{5}`; after one that deletes `## B`, `{}`.
  - After `reset()` or `clear()`, `{}`.
  - `sectionHeadingOf(model, 5)` is `4`, `sectionHeadingOf(model, 7)` is `6`, and
    `sectionHeadingOf(model, 3)` is `null`.

  In `tests/core/display.test.ts`, with `collapsed: new Set([4])`: section B shows its heading,
  `collapsed: true` and no rows; C shows; the top section shows. With `query: 'b'`, item `b`
  shows. With `keepLine: 5`, item `b` shows.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the view.**
  - `renderList` passes `view.collapsed.lines()` and calls `addCollapseArrow` on each named
    heading; the block in Task 12 doesn't, so its headings have no arrow.
  - `onClick` handles a click on `.princelists-collapse` first: `toggle`, then `render`. It opens
    no menu and closes no card. The touch drag's `pointerdown` ignores the arrow, so holding it
    starts no drag.
  - `addItem` and `queueMove` call `expandFor` with their place before they write. That covers New
    item from the heading menu, Cmd+Enter or "+" below a selected item, and a drop under a heading.
  - **Styling:** the arrow sits in the margin left of the heading, `--text-faint`, hidden until
    the heading is hovered, and always shown on a collapsed heading and when `Platform.isMobile`,
    through a class the view sets on its `contentEl`.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`, then check it by hand on the Mac
  and the iPhone.
  1. On the Mac the arrow shows on hover and stays on a collapsed heading; on the iPhone it always
     shows. A click or tap on it collapses and expands; a tap on the heading still opens its menu.
  2. Collapsing writes nothing: `git status` in the test vault shows no change.
  3. New item from a collapsed heading's menu, and a drop under it, expand it.
  4. A collapsed section drags as any section does, and stays collapsed after the drop.
  5. With Cmd+F, matches in a collapsed section show; after Escape it is collapsed again.
  6. Adding lines above it in Markdown in another pane keeps the same heading collapsed. Closing
     and reopening the list opens every heading.
- [ ] **Step 5: Update the designs.** In the step-two design's "Collapsing a heading", record that
  the open card's item still shows in a collapsed section; in step one's "Layout", headings have
  the arrow.
- [ ] **Step 6: Commit** with the message "Collapse a heading".

### Task 8: Give an item a When

**Files:**
- Create: `src/core/when.ts`, `tests/core/when.test.ts`, `src/view/card-when.ts`
- Modify: `src/core/display.ts`, `tests/core/display.test.ts`, `src/view/row-marks.ts`,
  `src/view/render-list.ts`, `src/view/card.ts`, `src/view/events.ts`, `styles.css`; step one's
  "Dates", "Layout" and "Editing"; the design's "When"

**Interfaces:**
- Produces, in `src/core/when.ts`:
  - `whenOf(line: string): string | null`: the earliest `⏳` or `⌛` date among the parsed tail's
    fields, with an optional U+FE0F; a date that doesn't exist, such as `2026-02-30`, doesn't count
  - `setWhen(line: string, day: string | null): string`: replaces the first scheduled field in
    place with `⏳ YYYY-MM-DD`, so a `⌛` becomes `⏳`, and removes any others, each with the
    whitespace before it; `null` removes them all.
    A new field goes as ` ⏳ YYYY-MM-DD` right before the tail's block ID and trailing whitespace,
    so after any tags **(call)**, and with no leading space when nothing stands before it.
  - `dayOf(date: Date): string`: local `YYYY-MM-DD`
  - `daysFrom(today: string, day: string): number`: calendar days, through `Date.UTC`
  - `dayLabelKind(day: string, today: string): 'today' | 'tomorrow' | 'weekday' | 'date'`:
    `weekday` for 2 to 6 days ahead, `date` for 7 or more and for the past
- Produces: `ItemRow.when: string | null`.
- Produces, in `src/view/row-marks.ts`: `dayLabel(day: string, today: string): string`: "Today",
  "Tomorrow", `moment(day, 'YYYY-MM-DD').format('dddd')`, or `.format('ll')` **(call)**; and
  `addWhen(rowEl: HTMLElement, day: string, today: string): void`, a span with the class
  `princelists-when` holding the `calendar` icon and the label.
- Produces, in `src/view/card-when.ts`: `buildWhenPicker(tools: HTMLElement): void`, `showWhen(card:
  Card, day: string | null): void` and `whenChange(view, input: HTMLInputElement): void`.

- [ ] **Step 1: Write the failing tests** in `tests/core/when.test.ts`, with today `2026-10-27`:

| Call | Expected |
|---|---|
| `whenOf('- [ ] a ⏳ 2026-10-30')`, and with `⌛` or `⏳` + U+FE0F | `'2026-10-30'` |
| `whenOf('- [ ] a ⏳ 2026-10-30 ⏳ 2026-10-28')` | `'2026-10-28'` |
| `whenOf('- [ ] ⏳ 2026-10-30 a')`, `whenOf('- [ ] a ⏳ 2026-02-30')`, `whenOf('- [ ] a 📅 2026-10-30')` | `null` |
| `setWhen('- [ ] a', '2026-10-30')` | `'- [ ] a ⏳ 2026-10-30'` |
| `setWhen('- [ ] a ⏳ 2026-10-21 📅 2026-10-30', '2026-11-02')` | `'- [ ] a ⏳ 2026-11-02 📅 2026-10-30'` |
| `setWhen('- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ^id', '2026-10-30')` | `'- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id'` |
| `setWhen('- [ ] a 📅 2026-10-30 #shop ^id  ', '2026-11-02')` | `'- [ ] a 📅 2026-10-30 #shop ⏳ 2026-11-02 ^id  '` |
| `setWhen('- [ ] a ⏳ 2026-10-30 📅 2026-11-01 ⌛ 2026-10-28', '2026-11-05')` | `'- [ ] a ⏳ 2026-11-05 📅 2026-11-01'` |
| the same line, `null` | `'- [ ] a 📅 2026-11-01'` |
| `setWhen('- [ ] a ⏳ 2026-10-30', null)` | `'- [ ] a'` |
| `setWhen('- [ ] a ⌛ 2026-10-30', '2026-11-02')` | `'- [ ] a ⏳ 2026-11-02'` |
| `dayOf(new Date(2026, 9, 27, 23, 59))` / `dayOf(new Date(2026, 9, 28, 0, 0))` | `'2026-10-27'` / `'2026-10-28'` |
| `daysFrom('2026-03-28', '2026-03-30')` (a daylight-saving change) | `2` |
| `daysFrom('2026-12-31', '2027-01-01')` | `1` |
| `dayLabelKind` for `2026-10-27`, `-28`, `-29`, `11-02`, `11-03`, `10-26` | `today`, `tomorrow`, `weekday`, `weekday`, `date`, `date` |

  Also: `- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 📅 2026-11-01 #shop ⏳ 2026-10-30 ^id  ` keeps
  everything but its `⏳` date under `setWhen`, and `parseItemLine`'s title is the same before and
  after; `itemRow` gives `when: '2026-10-30'`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Show it on rows.** `buildRow` calls `addWhen` after the star when `row.when` isn't
  null, with `dayOf(new Date())` as today. The When is `--text-muted`.
- [ ] **Step 4: Build the card's When picker** in `card-when.ts`, at the card's top right before
  the star: a button with the class `princelists-when-button` showing `addWhen`'s content, or the
  `calendar` icon; an `input
  type="date"` laid over the button at its size with `opacity: 0`, so a click or tap lands on the
  input itself; and a clear button with the `x` icon and the `aria-label` "Remove the day", shown
  only with a When. `refreshCard` calls `showWhen`.
  - On the iPhone the tap on the input opens its picker; Safari on iOS has no `showPicker()`
    **(call)**. On desktop, where Chromium opens a date input's picker from its own calendar icon,
    a click on the input also calls `input.showPicker()` when `Platform.isDesktopApp`.
  - A delegated `change` listener on `contentEl` sends the input to `whenChange`, which queues
    `queueLineEdit(view, selected, (l) => setWhen(l, input.value || null))`: an empty value, which
    the iPhone's picker gives on Reset, clears it. The clear button does the same with `null`.
- [ ] **Step 5: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 6: Check it by hand on the Mac and the iPhone.**
  1. **Design risk 5:** a click on the When on the Mac, and a tap on the iPhone, land on the transparent
     date input and open a date picker, and choosing a day writes ` ⏳ YYYY-MM-DD`. If either opens
     nothing or returns another format, stop and raise it.
  2. Changing the day replaces the date in place; clearing removes the field and its space only.
  3. Rows show "Today", "Tomorrow", a weekday, and a date for a past day or one a week away. With
     Obsidian's language set to another language, the weekday and date follow it.
  4. Cmd+Z takes a When back. With Tasks installed, a `scheduled on 2026-10-30` query lists it.
- [ ] **Step 7: Update the designs.** In the step-two design's "When", record that a new When goes
  after the tags, before the block ID. In step one's, "Dates" says ⏳ is the item's When, set in the
  card; "Layout" says rows show the star and the When; "Editing" names the card's calendar icon.
- [ ] **Step 8: Commit** with the message "Give an item a When".

### Task 9: Draw rows for any host

**Files:**
- Modify: `src/view/notes.ts`, `src/view/render-list.ts`, `src/view/card.ts`, `src/view/fields.ts`,
  `src/view/events.ts`, `src/view/list-view.ts`

**Interfaces:**
- Produces, in `src/view/notes.ts`: `interface MarkdownHost { readonly app: App; addChild<T extends
  Component>(component: T): T }`. `renderNotes`, `renderInline` and `renderCardNotes` take a
  `MarkdownHost` and a `sourcePath: string` instead of the view; `handleLinkClick` and
  `handleLinkMenu` take `(app: App, sourcePath: string, evt, target)`.
- Produces, in `src/view/render-list.ts`: `interface RowHost extends MarkdownHost { readonly
  dragsRows: boolean; readonly dragsHeadings: boolean }`. `readonly` here only stops `buildRow`
  writing them: a host may implement them as getters or plain fields that change, as
  `ListBlock.dragsRows` does in Task 15. `buildRow(host: RowHost, sourcePath:
  string, row: ItemRow, blocks)` and `buildHeading(host: RowHost, sourcePath: string, heading,
  blocks)` set `draggable` only when `ROWS_DRAG` and the host's flag are both on. The list view
  has both on and passes `view.file?.path ?? ''`, so its behavior doesn't change.

- [ ] **Step 1: Move rendering onto the hosts,** with no change in behavior, then run `npm run
  lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 2: Check it by hand on the Mac.** Links in a title, a card's notes and the list note
  open; a picture in a card's notes shows; rows and headings still drag.
- [ ] **Step 3: Commit** with the message "Draw rows for any host".

### Task 10: Show a Schedule view

**Files:**
- Create: `src/core/schedule.ts`, `tests/core/schedule.test.ts`, `src/view/schedule-view.ts`
- Modify: `src/constants.ts`, `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: `MarkdownHost` and `renderInline` (Task 9); `addStar` and `addWhen`.
- Produces, in `src/core/schedule.ts`:
  - `interface ScheduledItem { listPath: string; listName: string; titleLine: number; line: string;
    title: string; starred: boolean; done: boolean; day: string; order: number }`, where `line` is
    the title line's text and `order` the item's place in its list
  - `scheduledItems(text: string, contentStart: number, now: Date, list: { path: string; name:
    string }): ScheduledItem[]`: items with a When that are open, or done and not archived
  - `type ScheduleGroup = 'today' | 'tomorrow' | 'week' | 'later'`
  - `scheduleGroup(day: string, today: string): ScheduleGroup`: today and before; 1 day ahead; 2 to
    7; more
  - `groupSchedule(items: readonly ScheduledItem[], today: string): { group: ScheduleGroup; items:
    ScheduledItem[] }[]`: the groups in order, empty ones left out, each sorted by day, then
    `listName` with `localeCompare`, then `order`
- Produces: `VIEW_TYPE_SCHEDULE = 'princelists-schedule'` and `SCHEDULE_ICON = 'calendar'`;
  `class ScheduleView extends ItemView implements MarkdownHost` with `refresh(): Promise<void>`.

- [ ] **Step 1: Write the failing tests** in `tests/core/schedule.test.ts`, with `now = new
  Date(2026, 9, 27, 12, 0)`:
  - `scheduledItems` keeps an open item with ⏳, and one ticked at `2026-10-27 11:00`; it leaves
    out one ticked at `2026-10-25 09:00`, one with no When, and an item line inside a fenced block.
    Items under a heading count, with `order` running across sections.
  - `scheduleGroup` with today `2026-10-27`: `2026-10-20` and `2026-10-27` are `today`,
    `2026-10-28` `tomorrow`, `2026-10-29` and `2026-11-03` `week`, `2026-11-04` and `2026-12-31`
    `later`. With today `2026-10-31`, `2026-11-07` is `week` and `2026-11-08` `later`.
  - `groupSchedule` puts `Groceries` before `Home` on the same day, keeps file order within a list,
    and leaves out an empty `tomorrow`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build `ScheduleView`.** `getDisplayText` is "Schedule", `getIcon` `calendar`.
  - **Finding lists:** `vault.getMarkdownFiles()` filtered on `isMarkerValue(getFileCache(file)?.
    frontmatter)`, each read with `vault.cachedRead`, and `scheduledItems` per file with
    `contentStartLine(text)`. It keeps each list's items by path.
  - **Drawing:** a heading per group, and its own rows with the class `princelists-item`: a
    checkbox, `disabled` until Task 11 ticks it; `renderInline` of the title with the list's path
    as `sourcePath`; `addStar`; the list's name in a `princelists-schedule-list` span in
    `--text-muted`; and `addWhen`, except for items in Today whose day is today. "No items have a
    When." in gray when there are no groups. A redraw keeps the scroll position.
  - **Updating:** `onOpen`, and `active-leaf-change` to its own leaf, run `refresh`. A metadata
    cache `changed` for a file that is or was a list replaces that file's items from the event's
    `data` and redraws. A vault `rename` or `delete` of one does the same. All through
    `registerEvent`; no timer.
  - **Opening:** the "Open schedule" command and a `calendar` ribbon icon reuse a leaf of the type
    if there is one, with `setActiveLeaf(leaf, {focus: true})`; else `getLeaf('tab').setViewState
    ({type: VIEW_TYPE_SCHEDULE, active: true})`.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. Items with a When from three lists appear in the right groups, in the right order, with the
     list's name and the day. Overdue items show their date in Today.
  2. Setting a When in a list, ticking, renaming or deleting a list updates the open view.
  3. **Design risk 7:** in a test vault with 300 generated lists of 30 items each, opening the view and
     updating it after an edit feel quick, and only the lists' files are read (count the
     `cachedRead` calls in the developer tools). If it's slow, stop and raise it.
- [ ] **Step 6: Commit** with the message "Show a Schedule view".

### Task 11: Tick and open items from the Schedule view

**Files:**
- Create: `src/obsidian/file-edit.ts`, `src/view/open-item.ts`
- Modify: `src/view/schedule-view.ts`; the design's "When and the Schedule view"

**Interfaces:**
- Consumes: `toggleItem`, `tryEdit`, `openAsList`.
- Produces, in `src/obsidian/file-edit.ts`: `editListFile(app: App, file: TFile, expected: string,
  next: string): Promise<WriteResult>`, a `vault.process` through `guardedApply`. A failure shows
  "Couldn't save the change to this list." and gives `'failed'`; a refusal shows "This list changed
  elsewhere. Try again." and gives `'refused'`.
- Produces, in `src/view/open-item.ts`: `openItem(view: PrinceListView, titleLine: number, line:
  string): void`, which opens the card when the view's line there is still `line`, and otherwise
  opens nothing **(call)**.

- [ ] **Step 1: Tick in place.** The rows' boxes are enabled. A click on one cancels it, then plans
  `toggleItem` on the list's text as the view last read it, at `titleLine`, through `tryEdit`, so a
  repeating item shows "Repeating items can't be ticked here yet.". It writes with `editListFile`,
  with that text as `expected`. The `changed` event redraws.
- [ ] **Step 2: Open the item.** A click elsewhere on a row, not on a link, opens the list: in a
  leaf whose list view already shows that file, else `getLeaf('tab')` **(call)**. Then `openAsList`,
  `setActiveLeaf(leaf, {focus: true})` and `openItem(view, titleLine, line)`.
- [ ] **Step 3: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 4: Check it by hand on the Mac and the iPhone.**
  1. Ticking a row writes the tick to its list, and the row grays. A repeating item shows the
     message.
  2. A click on a row opens its list with its card open; a second click reuses that tab.
  3. A link in a row's title opens the link.
  4. With the list open in another pane and typing in a card not yet saved, ticking in the Schedule
     view keeps the typing and the list view shows the tick. Cmd+Z there then writes nothing from
     before the tick.
  5. Rename and then delete a list right after ticking one of its rows: the tick lands in the
     renamed list or shows "This list changed elsewhere. Try again.", and no other file changes.
- [ ] **Step 5: Update the design** under "When and the Schedule view": which tab a click opens in,
  and that the card opens only while the item's line is unchanged.
- [ ] **Step 6: Commit** with the message "Tick and open items from the Schedule view".

### Task 12: Show a list inside another note

**Files:**
- Create: `src/core/block-source.ts`, `tests/core/block-source.test.ts`, `src/view/list-block.ts`
- Modify: `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: `RowHost`, `buildRow` and `buildHeading` (Task 9); `ListEditing`; `guardedWrite`
  and `planAndWrite`; `serialQueue`; `visibleSections`; `toggleItem` and `tryEdit`.
- Produces, in `src/core/block-source.ts`: `blockLink(source: string): string | null`: the link
  text of a source whose only non-blank line is `[[target]]` or `[[target|alias]]`, without the
  alias; else null.
- Produces, in `src/view/list-block.ts`: `class ListBlock extends MarkdownRenderChild implements
  RowHost`, built with `(app: App, containerEl: HTMLElement, source: string, sourcePath:
  string)`, with:
  - `file: TFile | null`, the resolved list; `editing: ListEditing`, its text; `enqueue`, a
    `serialQueue`
  - `rowsEl: HTMLElement`, which holds the rows
  - `outsideChanges: number`, counted up on each outside change, as the list view's is
  - `dragsRows` and `dragsHeadings`, both false: nothing in a block drags until Task 15
  - `write(next: string, expected: string, edit: OwnEdit): Promise<WriteResult>`: `guardedWrite`
    with a target whose `save` does nothing, whose `took` is `editing.applyOwn`, and whose `reread`
    reads the file and draws
  - `draw(): void`
- Produces: in `main.ts`, `registerMarkdownCodeBlockProcessor('princelists', (source, el, ctx) =>
  ctx.addChild(new ListBlock(this.app, el, source, ctx.sourcePath)))`.

- [ ] **Step 1: Write the failing tests** in `tests/core/block-source.test.ts`: `[[Groceries]]`,
  `\n  [[Groceries]]  \n` and `[[Groceries|Shop]]` give `Groceries`; `[[Lists/Groceries]]` gives
  `Lists/Groceries`; `''`, `Groceries`, `[[A]]\n[[B]]` and `[[A]] and more` give null.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build `ListBlock`.**
  - **Resolving:** `metadataCache.getFirstLinkpathDest(getLinkpath(link), sourcePath)`. No link, no
    file, a file whose text isn't `isListText`, or the note the block is in, each draws its gray
    line in a `princelists-block-message` div instead of rows.
  - **Drawing:** a `princelists-block` root holding an `a.internal-link` with the list's name and
    `data-href` its path, then `visibleSections` with `{showArchived: false, query: '', keepLine:
    null, collapsed: new Set()}`, drawn with `buildHeading` and `buildRow` and the list's path as
    `sourcePath`, leaving out content the plugin leaves alone and the list note **(call)**.
  - **Listening,** all through `registerEvent` and `registerDomEvent`: `onload` reads the file with
    `cachedRead`. A metadata cache `changed` for the file whose `data` isn't `editing.text` counts
    up `outsideChanges`, goes to `editing.outsideChange` and redraws; the block's own write comes
    back equal and redraws nothing. A vault `create`, `rename` or `delete` resolves the link again,
    and redraws when the result changed.
  - **Clicks:** one delegated listener on the root. A link goes to `handleLinkClick(app,
    sourcePath, …)`. A box ticks, as `tick.ts` does, on the block's queue: track the line and
    record `outsideChanges`; when it runs, a changed count shows `CHANGED_ELSEWHERE_NOTICE`;
    otherwise plan `toggleItem` on `editing.text`, `write`, then `draw`.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone,** in a daily note holding a block.
  1. The block shows the list's name as a link, its headings and items with the star and the When,
     in reading view and Live Preview. The list note and notes don't show; archived items don't.
  2. Ticking works, and a repeating item shows its message.
  3. Editing the list elsewhere redraws the block; removing its marker shows "isn't a list".
  4. Each gray line shows for its case.
  5. With the list open in a list view in another pane, a tick in the block shows there. With
     typing not yet saved in that view's card, the typing survives.
  6. **Design risk 3:** rename the list. Record whether Obsidian updates the `[[link]]` in the block. If
     it doesn't, the block shows "doesn't lead to a note"; raise it for the owner to accept or
     change the format. Nothing may fix it in the background.
  7. **Design risk 4, clicks:** a tick or a link click in Live Preview doesn't move the cursor into the
     block's source. If it does, stop and raise it.
  8. Rename and then delete the list right after a tick in the block: no other file changes, and
     the block shows its gray line.
  9. Rows and headings in the block don't drag yet.
- [ ] **Step 6: Update the design** under "A list inside another note": the block leaves out the
  list note and content the plugin leaves alone.
- [ ] **Step 7: Commit** with the message "Show a list inside another note".

### Task 13: Add, rename and delete items in a block

**Files:**
- Create: `src/view/block-fields.ts`
- Modify: `src/view/list-block.ts`, `src/view/delete.ts`, `styles.css`; the design's "A list inside
  another note"

**Interfaces:**
- Consumes: `planItemInsert`, `planItemDelete`, `planItemLineEdit`, `setTitle`, `parseItemLine`,
  `keepStar`, `splitStar`, `planRemoval` and `InsertedItem`.
- Produces, in `src/view/delete.ts`: `showUndoNotice(message: string, onUndo: () => void): void`,
  taken out of `offerUndo`, which now uses it.
- Produces, in `src/view/block-fields.ts`:
  - `interface BlockField { line: TrackedLine; el: HTMLTextAreaElement; inserted: InsertedItem |
    null }`, held as `ListBlock.field: BlockField | null`
  - `openBlockField(block: ListBlock, titleLine: number, inserted: InsertedItem | null): void`,
    `closeBlockField(block: ListBlock, save: boolean): void`, `addBlockItem(block: ListBlock,
    place: ItemPlace): void` and `deleteBlockItem(block: ListBlock, titleLine: number): void`

- [ ] **Step 1: Build the title field.** A click on a row's title, not on a link, replaces the
  title with a `princelists-field` textarea holding `splitStar(title).plain`, with a trash button
  (`trash-2`, `aria-label` "Delete item") at its end.
  - Enter or leaving saves with `planItemLineEdit(text, cs, line, (l) => setTitle(l, keepStar(
    parseItemLine(l)?.title ?? '', typed)))`; Escape closes without saving.
  - Closing a new item's field with its title empty removes the item through `planRemoval`, as
    the list view does.
  - Shift+Enter saves, then adds the next item below. On an empty new item it only closes the
    field, which removes the item.
  - **An outside change while the field is open** goes to `editing.outsideChange`, but the block
    doesn't redraw until the field closes **(call)**: the field saves to its tracked line, and a
    line that went shows "This list changed elsewhere. Try again." and writes nothing.
- [ ] **Step 2: Add "New item"** below the rows: a `button` with the `plus` icon and the text "New
  item". It adds an item with `planItemInsert(text, cs, 'first')`, then opens its field with
  `inserted`.
- [ ] **Step 3: Delete.** The trash button's `pointerdown` is canceled so the field keeps focus,
  and its click deletes the item without saving the typed title **(call)**. On the Mac, a
  right-click on a row shows a `Menu` with "Delete" (`trash-2`, `setWarning(true)`). Both use
  `planItemDelete` and `showUndoNotice('Item deleted.', …)`, whose Undo writes `undo.next`
  expecting `undo.expected`.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on the Mac and the iPhone.**
  1. Click a title, retype it, press Enter: only the title changes, and a star stays.
  2. "New item", type, Shift+Enter, type, Enter: two items at the top of the list. "New item" and
     leaving it empty adds nothing.
  3. The trash button deletes on both devices, and Undo brings the item back. Right-click Delete
     on the Mac does the same.
  4. **Design risk 4, typing:** typing in the field in Live Preview stays in the field and never reaches
     the note's source. If it doesn't, stop and raise it.
  5. Cmd+Z in the list view doesn't undo a block's edit.
- [ ] **Step 6: Update the design** with the calls this task made: the field's trash button
  deletes without saving, and an outside change waits for the field to close.
- [ ] **Step 7: Commit** with the message "Add, rename and delete items in a block".

### Task 14: Move row dragging onto a host

**Files:**
- Create: `src/view/drag-host.ts`
- Modify: `src/view/drag-mouse.ts`, `src/view/drag-touch.ts`, `src/view/list-view.ts`

**Interfaces:**
- Produces, in `src/view/drag-host.ts`:
  - `interface RowDragHost { readonly component: Component; readonly rowsEl: HTMLElement; readonly
    edgeScroll: { scrollEl: HTMLElement; visibleBottomEl: HTMLElement } | null; readonly
    dragsHeadings: boolean; swallowNextClick: boolean; beforeLift(): void; track(line: number):
    TrackedLine; untrack(tracked: TrackedLine): void; drop(line: number, drop: RowDrop): void }`
  - `listDragHost(view: PrinceListView): RowDragHost`: `rowsEl` is `listScrollEl`, `edgeScroll`
    uses it and the `princelists-visible-bottom` element, which moves here from `drag-touch.ts`,
    `beforeLift` is `closeCard`, `dragsHeadings` is true, and `drop` is `queueDrop`
- Produces: `enableMouseDrag(host: RowDragHost)` and `enableTouchDrag(host: RowDragHost)`, with
  their listeners on `host.rowsEl`. Without `edgeScroll`, the touch drag measures boxes from
  `rowsEl`'s own top and doesn't scroll at the edges **(call)**: a note's scroller is Obsidian's.

- [ ] **Step 1: Move both drags onto `RowDragHost`,** with no change in behavior, then run `npm
  run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 2: Check it by hand.** Repeat the 1a plan's Task 11 mouse checks 1 to 5 on the Mac,
  the 1b plan's Task 2 checks 2, 6 and 8 on the iPhone, and Task 6's checks 1 and 5 on both.
- [ ] **Step 3: Commit** with the message "Move row dragging onto a host".

### Task 15: Drag items in a block

**Files:**
- Modify: `src/view/list-block.ts`; the design's "A list inside another note"

**Interfaces:**
- Consumes: `RowDragHost`, `enableMouseDrag` and `enableTouchDrag` (Task 14); `planItemMove`.
- Produces: `ListBlock.dragsRows` becomes true; `dragsHeadings` stays false (the design).
- Produces: `ListBlock.dragHost(): RowDragHost`, with `edgeScroll` null and `dragsHeadings` false.
  Its `beforeLift` closes the field, saving it, as a click elsewhere does. Its `drop` tracks the
  item and its anchor as `queueMove` does, then plans `planItemMove` on the block's queue, writes
  and draws; when either line went, it shows `CHANGED_ELSEWHERE_NOTICE` and writes nothing.

- [ ] **Step 1: Enable both drags in the block.** On the iPhone, the block also cancels
  `contextmenu` on rows in the capture phase and swallows the next click, as `registerFieldEvents`
  does for the list view.
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`, then check it by hand on the Mac
  and the iPhone.
  1. Drag within a section and into another, with the mouse and with hold-and-move. The drop line
     shows where the item lands, and notes move with it. Headings don't drag.
  2. A swipe on the block scrolls the note; holding a row opens no menu.
  3. **Design risk 4, drags:** in Live Preview, a drag and a drop stay in the block and insert nothing
     into the note's source. If they don't, stop and raise it.
  4. An open list view of the same file follows the drag.
- [ ] **Step 3: Update the design:** no edge scroll in a block, and why.
- [ ] **Step 4: Commit** with the message "Drag items in a block".

### Task 16: Finish step two and release 0.4.0

**Files:**
- Create: `docs/superpowers/notes/<date>-step-2-checks.md`
- Modify: both designs (reconcile them), `README.md`, `package.json`, `package-lock.json`,
  `manifest.json`, `versions.json`

- [ ] **Step 1: Run every manual check of Tasks 1 to 15 again on the iPhone** in the test vault,
  with the release build.
- [ ] **Step 2: Check alongside Tasks and Kanban:** a Tasks query reads a When as scheduled, a
  starred done item is still done, and Kanban still opens its own boards.
- [ ] **Step 3: Write the notes file:** each check, its result and how it ran, naming no devices,
  vaults or home paths.
- [ ] **Step 4: Reconcile the designs.** Check each step-two claim against the code, record decided
  deviations with their reasons, raise anything undecided, and set `verified`. Keep the step-two
  design at `status: building` until the owner confirms its "Done when" (lists moved in); then
  `live`. In step one's design, move what step two built out of "Not in step one" and say in the
  opening paragraph that the Schedule view spans lists.
- [ ] **Step 5: Update the README:** "What it does" gains the star, the When and the Schedule view,
  Cmd+F, checklists, dragging and collapsing headings, "Turn into list" and the `princelists` code
  block, and the status line names `0.4.0`.
- [ ] **Step 6: Bump the version** with `npm version minor --no-git-tag-version`, which gives
  `0.4.0` and adds `"0.4.0": "1.5.7"` to `versions.json`. Check that `minAppVersion` is still
  `1.5.7` and that `npm run lint` passes.
- [ ] **Step 7: Commit** the notes, the designs, `README.md` and the version files with the message
  "Finish step two". Open the pull request; the owner merges it.
- [ ] **Step 8: Release `0.4.0`.** The owner pushes the signed tag `0.4.0`, approves the `release`
  environment, checks the draft and publishes it (`AGENTS.md`, "Releases").
