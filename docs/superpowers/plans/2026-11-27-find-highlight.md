# Find highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While Find holds text, color each word it matches: in item titles in a list and the
Schedule, the list's name in the Schedule, and an open card's notes.

**Architecture:** Core gains `pieceSpans`: given the text of an element in pieces, one per text
node with the block it's in, it returns where each word Find matches starts and ends, with each
word's search passed in as `Find.words`. The view collects the pieces, turns the spans into DOM
`Range`s, and puts them in one CSS Custom Highlight, `princelists-find`, per window; each view owns
its ranges through a `FindPaint`. The notes editor colors its text lines with a CodeMirror mark
decoration, and its drawn blocks through the same `FindPaint` as titles.

**Tech Stack:** TypeScript, Obsidian's plugin API, CodeMirror 6, the CSS Custom Highlight API,
vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-find-highlight-design.md`

## Global Constraints

- The color is `var(--text-highlight-bg)`, in `styles.css` only. Never a hard-coded color.
- Documented APIs only: `prepareSimpleSearch` and `SearchResult.matches` from `obsidian.d.ts`,
  Obsidian's `Node.win` and `Node.doc`, the DOM's `CSS.highlights`, `Highlight` and `Range`, and
  CodeMirror's decorations.
- Where `CSS.highlights` is missing (iOS and iPadOS before 17.2), titles and drawn blocks stay
  plain with no error; the notes editor's marks still show.
- `src/core/` has no Obsidian or DOM imports, and never calls `String.prototype.normalize`.
- Nothing is written to a file: coloring is drawing only.
- Each word is matched on its own, every place it appears; spans that overlap or touch merge.

## Review Focus

1. A word that appears twice in a title colors both, whether `prepareSimpleSearch` reports one
   match or all, and right after itself as in "milkmilk" (Task 1's `findSpans` tests).
2. Typing "mi" then "mil" in the Schedule, with the same items shown, recolors to "mil" (Task 1,
   by hand: `draw()`'s early return still paints).
3. A title rendered as Markdown, `**oat** milk` or `[[Oat milk]]`, is colored once its render
   finishes (Task 1, by hand).
4. Closing Find, by Escape or the filter icon, clears every color in the list, the Schedule and an
   open card (Tasks 1 and 2, by hand).
5. A list and the Schedule filtering at once, each in its own pane, keep their own colors when one
   closes its filter (Task 1, by hand).

---

### Task 1: Color Find's words in titles

**Files:**
- Create: `src/core/find-spans.ts`, `src/view/find-highlight.ts`, `tests/core/find-spans.test.ts`
- Modify: `src/core/display.ts` (`Find`), `src/view/filter.ts` (`findOf`), `src/view/notes.ts`
  (`MarkdownHost`, `renderNotes`), `src/view/redraw.ts` (end of `redraw`), `src/view/card.ts`
  (`putRowBack`), `src/view/list-view.ts` (`findPaint`, `markdownRendered`, `onClose`),
  `src/view/schedule-view.ts` (`findPaint`, `markdownRendered`, `draw`, `onClose`), `styles.css`,
  `tests/styles.test.ts`, `tests/core/edit-helpers.ts`, `tests/core/display.test.ts:286`,
  `tests/core/schedule.test.ts:244`,
  `docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md`,
  `docs/superpowers/specs/2026-11-27-find-highlight-design.md` (header)

**Interfaces:**
- Produces:
  - `src/core/find-spans.ts`:
    - `type Span = readonly [from: number, to: number]`;
      `type WordSearch = (text: string) => readonly Span[] | null`.
    - `findSpans(text: string, words: readonly WordSearch[]): Span[]`.
    - `interface TextPiece { text: string; block: number }`, the text of one text node and the
      block it's in; `interface PiecePoint { piece: number; offset: number }`.
    - `pieceSpans(pieces: readonly TextPiece[], words: readonly WordSearch[]): { start: PiecePoint; end: PiecePoint }[]`.
  - `Find.words: readonly WordSearch[]`, one per space-separated word of `Find.text`.
  - `src/view/find-highlight.ts`: `FIND_HIGHLIGHT = 'princelists-find'`; `class FindPaint` with
    `paint(el: HTMLElement, find: Find | null): void`,
    `paintAll(els: readonly HTMLElement[], find: Find | null): void` (paints each, and forgets any
    element it painted that isn't in `els`), `forget(el: HTMLElement): void` and `clear(): void`.
  - `MarkdownHost.markdownRendered?(el: HTMLElement): void`, called by `renderNotes` once
    Obsidian's render of `el` resolves.

- [ ] **Step 1: Write the failing tests** in `tests/core/find-spans.test.ts`, with two stand-ins
  for a word's search, case-insensitive like Obsidian's: `first(word)`, which returns only the
  first match, and `every(word)`, which returns all of them.

```ts
findSpans('milk and milk', [first('milk')])  // [[0, 4], [9, 13]]: every place, though the search reports one
findSpans('milk and milk', [every('milk')])  // [[0, 4], [9, 13]], no duplicates
findSpans('milkmilk', [first('milk')])  // [[0, 8]]: a repeat right after a match is found, and touching spans merge
findSpans('Oat milk', [first('milk'), first('oat')])  // [[0, 3], [4, 8]], in text order
findSpans('milk', [first('mil'), first('ilk')])  // [[0, 4]]: overlapping spans merge
findSpans('oat milk', [first('rice')])  // []
findSpans('', [first('milk')])  // []

// <strong>oa</strong>t milk: one block
pieceSpans([{ text: 'oa', block: 0 }, { text: 't milk', block: 0 }], [first('oat')])
	// [{ start: { piece: 0, offset: 0 }, end: { piece: 1, offset: 1 } }]
// A match ending at a piece's end ends in that piece, not at the next one's start
pieceSpans([{ text: 'oat', block: 0 }, { text: ' milk', block: 0 }], [first('oat')])
	// [{ start: { piece: 0, offset: 0 }, end: { piece: 0, offset: 3 } }]
// Two table cells: a word can't run from one block into the next
pieceSpans([{ text: 'Oat', block: 0 }, { text: 'milk', block: 1 }], [first('tmi')])  // []
pieceSpans([{ text: 'Oat', block: 0 }, { text: 'milk', block: 1 }], [first('milk')])
	// [{ start: { piece: 1, offset: 0 }, end: { piece: 1, offset: 4 } }]
// An empty text node is passed over
pieceSpans([{ text: '', block: 0 }, { text: 'milk', block: 0 }], [first('milk')])
	// [{ start: { piece: 1, offset: 0 }, end: { piece: 1, offset: 4 } }]
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/core/find-spans.test.ts`
Expected: FAIL, `findSpans` and `pieceSpans` don't exist.

- [ ] **Step 3: `findSpans` and `pieceSpans`.**
  - **`findSpans`:** for each word, search `text.slice(at)`, add `at` to its matches, move `at` to
    the last match's end, and repeat until the search returns null or no match, or a match ends at
    or before `at`. Then sort by start and merge spans that overlap or touch.
  - **`pieceSpans`:** join the pieces, with `'\n'` where `block` changes, run `findSpans`, and map
    each span's ends back to pieces. A start goes in the piece it falls in, an end in the piece it
    ends.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/core/find-spans.test.ts`
Expected: PASS.

- [ ] **Step 5: `Find.words`.** Add the field to `Find`. `findOf` builds one per word of
  `text.split(' ')`, leaving out empty strings, each `prepareSimpleSearch(word)` returning
  `result?.matches ?? null`. Give the test stand-ins words too: `containing` in `edit-helpers.ts`
  and the `anyDay` stand-ins in `display.test.ts` and `schedule.test.ts`.

Run: `npm test`
Expected: PASS, every existing test unchanged.

- [ ] **Step 6: `FindPaint`** in `src/view/find-highlight.ts`.
  - **What it keeps:** a `Map<HTMLElement, { highlight: Highlight; ranges: Range[] }>`, so an
    element's ranges leave the highlight they went into, even if the element later moves to
    another window.
  - **`paint`:** forgets `el`, then, with a `find`, collects its pieces and adds a `Range`
    (`el.doc.createRange()`) per span of `pieceSpans`.
  - **The pieces:** `el`'s text nodes, from `el.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT)`,
    leaving out any under a `.princelists-block`. A piece's `block` numbers the node's closest
    `p, li, td, th, pre, blockquote, h1, h2, h3, h4, h5, h6, div` ancestor.
  - **The window's highlight:** `const win = el.win as Window & typeof globalThis`, since
    `lib.dom` declares `CSS` and `Highlight` on the global and not on `Window`. When
    `!('highlights' in win.CSS)`, `paint` does nothing. Otherwise the highlight is
    `win.CSS.highlights.get(FIND_HIGHLIGHT)`, set to a `new win.Highlight()` the first time.

- [ ] **Step 7: Paint the list's titles.**
  - **The paint:** `PrinceListView` gets `readonly findPaint = new FindPaint()`. At the end of
    `redraw`, call `view.findPaint.paintAll(ownElements(listSizerEl, '.princelists-item-title'),
    findOf(view.filter ?? ''))`.
  - **Rows drawn elsewhere:** `putRowBack` paints the new row's title the same way.
  - **Markdown titles:** `renderNotes` calls `host.markdownRendered?.(el)` after it disables the
    boxes, and the view's `markdownRendered(el)` paints `el` when it's one of its own titles.
  - **Closing:** `onClose` calls `findPaint.clear()`.

- [ ] **Step 8: Paint the Schedule's titles and list names.** The same: a `findPaint`, a
  `markdownRendered`, and `clear()` in `onClose`. The elements are
  `.princelists-item-title, .princelists-schedule-list, .princelists-schedule-list-name` under
  `groupsEl`, painted at both of `draw()`'s exits: the early return when nothing shown changed,
  and the end.

- [ ] **Step 9: The color and its test.** In `styles.css`:
  `::highlight(princelists-find) { background-color: var(--text-highlight-bg); }`. In
  `tests/styles.test.ts`, a test that reads the rule's body:

```ts
const rule = styles.match(/::highlight\(princelists-find\) \{([^}]*)\}/)?.[1];
expect(rule).toContain('background-color: var(--text-highlight-bg);');
```

Run: `npx vitest run tests/styles.test.ts`
Expected: PASS.

- [ ] **Step 10: The docs.**
  - **Step two's design, "Cmd+F", after the "As you type" bullet:** "While the field holds text,
    each word it matches is colored", linked to this design as "highlighting what Find finds".
    Bump its `verified` date.
  - **This design's header:** `status: building`, and `governs: [src/**, styles.css]`, as the
    other designs.

- [ ] **Step 11: Check it all.**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: each passes with no warning.

Then, by hand, in a dark copy of the demo vault, then a light one (AGENTS.md, "To make a demo
vault"). In the copy, add an item "Milk and more milk" to Groceries and make one title
`**Oat** milk`.
- **Words:** type `milk oat`: both words are colored in each title that has them, "milk" twice in
  "Milk and more milk", and "Oat" in the bold title once it has rendered.
- **Typing on:** type `mi`, then `mil`: the color follows.
- **Closing:** press Escape: no color is left. Open the field again, type, and close it with the
  filter icon: the same.
- **A card:** open a colored item's card, close it: its row comes back colored.
- **Selection:** select colored text: the selection still shows.
- **The Schedule:** the list's name is colored in its subheading, and under titles with "Sort by
  date"; `mi`, then `mil`, recolors.
- **Two panes:** with a list and the Schedule both filtering, closing one's field leaves the
  other's colors.
- **A pop-out window:** a list there is colored.
- **A long list:** typing in the demo vault's longest list stays smooth.

- [ ] **Step 12: Commit**

```bash
git add src tests styles.css docs/superpowers/specs
git commit -m "Color Find's words in item titles"
```

### Task 2: Color Find's words in the card's notes

**Files:**
- Create: `src/view/notes-find.ts`
- Modify: `src/view/notes-editor.ts` (extensions), `src/view/notes-blocks.ts`
  (`BlockWidget.destroy`), `src/view/redraw.ts`, `src/view/card.ts` (`openCard`),
  `src/view/list-view.ts` (`markdownRendered`), `styles.css`, `tests/styles.test.ts`,
  `README.md`, `docs/images/filter.gif`, `docs/listing/desktop-4-filter.webp`,
  `docs/superpowers/specs/2026-11-27-find-highlight-design.md` (header)

**Interfaces:**
- Consumes: `findSpans`, `Find.words`, `FindPaint` (`paint`, `paintAll`, `forget`),
  `MarkdownHost.markdownRendered` (Task 1).
- Produces: `notesFind(): Extension`; `showNotesFind(editor: EditorView, find: Find | null): void`;
  `FIND_MARK_CLASS = 'princelists-find-match'`.

- [ ] **Step 1: The editor's marks.** In `src/view/notes-find.ts`, a `StateEffect<Find | null>`
  and a `StateField` holding the find and its `DecorationSet`: one
  `Decoration.mark({ class: FIND_MARK_CLASS })` per span of `findSpans(doc.toString(),
  find.words)`, rebuilt on the effect or a change to the document, and provided through
  `EditorView.decorations.from`. `showNotesFind` dispatches the effect only when `find?.text`
  differs from the field's. `notesFind()` joins `showNotesEditor`'s extensions.

- [ ] **Step 2: Give the card's editor the query, and paint its drawn blocks.**
  - **The query:** in the paint at the end of `redraw`, and at the end of `openCard`'s branch that
    swaps the row for the card, call `showNotesFind(view.card.editor, find)` when the card has an
    editor.
  - **Its blocks:** add the card's `.princelists-notes-block` elements (`NOTES_BLOCK_CLASS`) to the
    elements `paintAll` gets. The view's `markdownRendered(el)` paints a drawn block of the card's
    too, and `BlockWidget.destroy` calls `view.findPaint.forget(dom)`.

- [ ] **Step 3: The mark's color and its test.** In `styles.css`,
  `.princelists-find-match { background-color: var(--text-highlight-bg); }`, and in
  `tests/styles.test.ts` a test that reads that rule's body, as Task 1's does.

Run: `npx vitest run tests/styles.test.ts`
Expected: PASS.

- [ ] **Step 4: Check it all.**

Run: `npm run lint && npm run build && npm test && node scripts/check-docs.mjs`
Expected: each passes with no warning.

Then, by hand, in a dark copy of the demo vault, then a light one. In the copy, add a two-row
table and a callout to "fresh basil"'s notes, each with the word "leaves".
- **The notes:** type `pesto`, then open "fresh basil": "pesto" is colored in its notes.
- **Its blocks:** type `leaves`: it's colored in the table and the callout too.
- **Editing:** edit the notes: the color follows the text.
- **Closing:** press Escape: the card's color goes, in its text and its blocks.
- **Android:** on the emulator, titles and notes are colored.

- [ ] **Step 5: The docs and pictures.**
  - **README:** the **Find** bullet in the feature list says the words it finds are colored.
  - **Pictures:** retake the `filter` GIF and the `desktop-4-filter` listing shot with
    `scripts/pictures/shoot.mjs`. The GIF's alt text says the words are colored, and its last
    frame matches the alt text.
  - **This design's header:** `status: live`, with `verified` set to the day it's checked.

- [ ] **Step 6: Commit**

```bash
git add src tests styles.css README.md docs
git commit -m "Color Find's words in the card's notes"
```
