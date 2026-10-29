# PrinceLists notes in one editor Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a card's notes and the list note in one CodeMirror 6 editor each, drawn as Obsidian's
Live Preview draws a note, saving only the lines a change touched. Remove the block fields, and
release it as `1.1.0`.

**Architecture:**
- **One visit, one range.** While an editor has focus, `ListEditing` holds a visit over all the
  notes' file lines. Each change replaces the file lines it touched, one file line per editor line,
  through the piece save's layout check (`replaceRun` with the notes' block keys), and moves the
  visit's start and end by the lines it added or removed. A visit is one step of the list's undo.
  The piece saves' `typedLines`, which drops empty lines at the end, isn't used: an editor line is
  always a file line.
- **Editor line `n` is file line `start + n`,** where `start` is the visit's first line. The notes
  as parsed leave out empty lines at their start and end (a card's from `notesStartLine`, the list
  note's from its first line with text), so the editor takes the notes as parsed only outside a
  visit: when it's created, on a redraw while it hasn't focus, when a visit ends, and when an
  outside change loses the visit. While a visit lasts, a sync takes the visit's own file lines, and
  the editor's own changes never reload it. Empty notes are the one exception to `start + n`: the
  editor holds one empty line that maps to no file line.
- **A change the layout can't take never lands.** An `EditorState.changeFilter` asks the core
  whether the change fits and stops it when it doesn't, so it never reaches the document or the
  editor's history.
- **The view is CodeMirror's API only:** an `EditorView` per notes, extensions for saving, keys,
  inline and line drawing (a view plugin) and big blocks (a `StateField`). Rules that need tests go
  in `src/core/`: which lines changed, where wikilinks are, which blocks are drawn whole, and ticking
  one line.
- **The block fields stay until Task 8,** which removes them once the card (Task 2) and the list
  note (Task 7) no longer use them. Each task keeps the plugin working.

**Tech Stack:** as in step two, plus `@codemirror/lang-markdown` and `@lezer/markdown`, bundled, and
`@codemirror/state`, `view`, `language` and `commands`, which Obsidian provides at runtime.

**Spec:** `docs/superpowers/specs/2026-10-29-notes-in-one-editor-design.md`, "the design" below. It
replaces step two's "Editing notes a block at a time" and leans on [step
one](../specs/2026-10-20-prince-lists-design.md) and [step
two](../specs/2026-10-27-prince-lists-step-2-design.md), cited by heading.

**How work lands:** as in step two. Each task is one pull request that the owner squash-merges, so
"Commit with the message X" means the pull request's title is X. Each pull request checks the design
against the change and updates it, or says in one line that it still holds, and sets its `verified`
date. Every manual check runs in a test vault, never in a vault with real notes, on desktop and on
an iPhone or Android device where the task says mobile. `main` isn't released between Task 2 and
Task 9, since the notes draw less until Task 5 and the list note keeps the block fields until Task
7; a fix release in that window branches from the last tag.

**Order (the design's is a call):** saving, undo and keys come with the editor in Task 2, so a card
never holds text that isn't saved and no key regresses; drawing follows in Tasks 3 to 5.

## Global Constraints

- **Everything in the earlier plans' Global Constraints still holds,** and so does `AGENTS.md`.
- **Dependencies:** `@codemirror/lang-markdown` `^6.5.2` and `@lezer/markdown` `^1.8.1` in
  `dependencies`. `@codemirror/language` and `@codemirror/commands` in `devDependencies`, for their
  types, and `@codemirror/state` and `view` at the exact versions `obsidian` names as peers, since
  the lint wants every imported package listed. `esbuild.config.mjs`'s
  `external` already holds every `@codemirror/*` package these import (`autocomplete` included) and
  `@lezer/common`, `@lezer/highlight` and `@lezer/lr`, so the syntax tree's `NodeProp`s and `Tag`s
  are Obsidian's own; it stays so, and only `@codemirror/lang-markdown` and `@lezer/markdown` are
  bundled. From `@codemirror/lang-markdown` import only `markdownLanguage`,
  `insertNewlineContinueMarkupCommand` and `deleteMarkupBackward`, never `markdown()`.
- **`main.js` grows by about 42 kB** minified, less what Task 8 removes. Each pull request that
  adds editor code says the size before and after.
- **The manifest:** Task 2 raises `minAppVersion` from `1.5.7` to `1.13.4` (design risk 1).
  Obsidian APIs this plan names, checked in `obsidian.d.ts` 1.14.4: `MarkdownRenderer.render`,
  `Workspace.openLinkText` and `MetadataCache.getFirstLinkpathDest`, already used; and
  `Vault.getResourcePath(file)`, `@since 0.9.7`, new here (not `DataAdapter.getResourcePath`, which
  the mobile `CapacitorAdapter` has only `@since 1.7.2`).
- **CodeMirror APIs** this plan names, from its reference manual: `EditorView`,
  `EditorView.updateListener`, `EditorView.domEventHandlers`, `EditorView.lineWrapping`,
  `EditorView.editorAttributes`, `EditorView.findFromDOM`, the `dispatchTransactions` option
  (`@codemirror/view` 6.17.0), `EditorState.readOnly`,
  `EditorView.posAtCoords`, `EditorView.focusChangeEffect` (`@codemirror/view` 6.9.0, part of design
  risk 1's check), `EditorState.create`, `EditorState.changeFilter`, the `filter: false` transaction
  option, `Transaction.addToHistory`, `Transaction.newDoc`, `Annotation`, `Compartment`,
  `StateField`, `ViewPlugin`, `Decoration`,
  `WidgetType`, `placeholder`, `keymap`, `history`, `historyKeymap`, `defaultKeymap`, `undo`, `redo`,
  `indentMore`, `indentLess`, `indentUnit` and `syntaxTree`. Not `EditorView.setState` or `reset`:
  they redraw every widget.
- **Interface text:** nothing new. The editor's placeholder is step one's "Notes"; a refused change
  shows step one's notice that the list's layout can't take it.
- **Classes** start with `princelists-notes-`. Colors, sizes and fonts are Obsidian's CSS
  variables; a drawn link also takes Obsidian's `internal-link` or `external-link` class, so it
  looks like a link in a note and `handleLinkClick` and `handleLinkMenu` work on it unchanged.
- **Listeners:** one `EditorView.domEventHandlers` per editor; no listener on an element the editor
  draws.
- **No timers,** and no save except from a change the user made in the editor or a click.

## Review Focus

- **A write from elsewhere between two keystrokes** (the Schedule view, a block in another note,
  sync). No keystroke lands on another line, and the editor shows the file's notes after it. Task 1
  tests it in the core; Task 2 checks it by hand.
- **An input method or dictation on a phone,** with a refused change stopped mid-word. No text is
  lost or doubled. Task 2 checks it on the iPhone and Android.
- **The same list in two panes with the same card open.** Typing in one shows in the other once it
  saves, with that card's notes in step and its caret kept. Task 2 checks it by hand.
- **Notes with empty lines at their start or end, and mixed tab and space indents.** An editor line
  keeps writing the same file line until the visit ends, and a touched line keeps its own indent.
  Task 1 tests it.
- **Cmd+Z in the list right after leaving the notes, then back into them.** The list's undo takes
  back the whole visit as one step, and the editor has no history left to undo. Task 1 tests the
  step; Task 2 checks the editor's history by hand.

---

### Task 1: Save a line range of the notes

**Files:**
- Create: `src/core/notes-lines.ts`, `tests/core/notes-lines.test.ts`, `src/core/notes-visit.ts`
  (the visit's state and saves, which `ListEditing` holds, so `editing.ts` stays near 300 lines)
- Modify: `src/core/editing.ts`, `src/core/edit-piece.ts`, `src/core/edit-list-note.ts`,
  `tests/core/editing.test.ts`, `docs/superpowers/specs/2026-10-29-notes-in-one-editor-design.md`
  (header and "Saving")

**Interfaces:**
- Produces, in `src/core/notes-lines.ts`:
  - `NotesChange { from: number; to: number; lines: string[] }`: lines `[from, to)` of the notes,
    as the editor held them before the change, become `lines`. `from === to` inserts; an empty
    `lines` deletes.
  - `changedLines(before: string, after: string): NotesChange | null`: the shortest run of whole
    lines between the lines the two texts share at their start and at their end, which never
    overlap; null when the texts are equal. An inserted line among equal lines rewrites none of
    them.
  - `NotesSpan { range: LineRange; indent: string; separator: boolean; blankAfter: boolean }`: the
    editor's notes in file lines. An editor holding one empty line is empty notes, an empty `range`,
    and that line maps to no file line: a change to empty notes saves as an insert at `range.start`
    of every line the editor then holds, and a change that leaves the editor one empty line removes
    the whole range. `separator`: the empty line above `range.start` is the one the notes' first
    text wrote under the title, which a change that empties the notes takes again; `openNotes` sets
    it when the notes are empty. `blankAfter` is the list note's, as in `ListNotePiece`.
  - `saveItemNotesLines(lines: readonly Line[], model: ListModel, item: ItemBlock, span: NotesSpan,
    change: NotesChange): { lines: Line[]; span: NotesSpan }` and `saveListNoteLines(lines, model,
    span, change): { lines: Line[]; span: NotesSpan; note: string }`: file lines `[range.start +
    from, range.start + to)` replaced by `change.lines`, one file line each, with no empty lines
    trimmed. A new line takes the span's indent; a line that was in the file keeps its own leading
    whitespace when the change kept it; an empty line is written as `''`. The run goes through
    `replaceRun` and throws `UnsafeEditError` as the piece saves do. Task 1 moves the item's block
    keys out of `setNotesPiece`, and the list note's block keys and `planSave`'s blank-after and
    unclosed-block rules out of `setListNotePiece` and `planSave`, into exported helpers that take
    file lines, without `typedLines`; both saves call them, so Task 8 keeps them.
- Produces, in `src/core/editing.ts`, on `ListEditing`, taking the open piece's place so
  `followRange` and `mapPieceRange` serve a visit as they serve a piece:
  - `openNotes(kind: 'item' | 'listNote'): string | null`: starts a visit to the open card's notes
    or the list note, over the lines the parse gives them: from `notesStartLine` to `item.endLine`
    (for the list note, from its first line with text to `listNote.end`), ending any other visit or
    piece. So it returns the same text as the notes as parsed, without the notes' indent, which the
    editor already holds, or null when the card's item is gone.
  - `visitText(): string | null`: the visit's own file lines as the editor holds them, after an
    outside change that kept the visit; null once the visit is lost.
  - `notesChangeFits(change: NotesChange): boolean`: whether the visit's notes can take the change,
    by running its save on the current text without keeping it. It changes nothing.
  - `saveNotes(change: NotesChange): Typed` and `saveListNote(change: NotesChange): TypedListNote`:
    save a change to the visit's notes. All of a visit's saves are one step of the list's undo. No
    visit, or one whose lines an outside change took, gives `{ lost: true }`. A card's save is
    recorded as `typeNotesPiece`'s is, a `change` at the item's title line; a list note's starts at
    the line above the lines it writes, or is an `insert` at their start when none is above, as
    `typeListNote`'s is.
  - `closeNotes()` and `closeListNote()` end a visit as they end a piece.

- [ ] **Step 1: Set the design's header** to `status: building`, `verified` today, and `governs:
  [src/**, styles.css, manifest.json]`, as step two's design has. In its "Saving", say the lines go
  through the piece save's layout check (`replaceRun`) rather than `setNotesPiece` itself, since
  that drops empty lines at the end of what it saves; and that a refused change never lands,
  stopped by an `EditorState.changeFilter`, since taking it back afterward let undo restore a
  refused deletion twice.
- [ ] **Step 2: Write the failing tests:**
  - `changedLines`: typing in line 2 of 3 gives `{ from: 1, to: 2, lines: ['ab'] }`; Enter at the
    end of `a` in `x\na\ny` gives `{ from: 2, to: 2, lines: [''] }`; joining two lines; erasing all
    of `a` gives `{ from: 0, to: 1, lines: [''] }`; equal texts give null.
  - Byte for byte (design risk 2): in a CRLF file without a final newline, whose notes hold a
    whitespace-only line, a lazy line and lines indented with a tab and with four spaces, a change to
    one line rewrites that file line only, and a touched line indented with four spaces keeps them.
  - In `x\na\ny`, Enter at the end of `a`, then `b` on the new line: the file's notes read `x`, `a`,
    `b`, `y`, and `y`'s line is untouched. Erasing the text of `a` leaves an empty file line between
    `x` and `y`.
  - Enter at the start of the first line puts an empty file line there, and the next keystroke lands
    on the first line of text.
  - Enter in the middle of a line, then a keystroke on the new line: both land on their own lines,
    and the span's end grows by one.
  - Emptying a block in the middle, at the end and at the start of the notes (design risk 3), each
    as the editor sends it: nothing outside the touched lines changes, and the notes read back equal
    the editor's text without its empty lines at the start and end. The same three in the list
    note.
  - Empty notes: the first text gets one empty line under the title, as a new piece does, and the
    span's start moves past it; erasing it again takes that line too; typing again writes it once.
  - Enter in empty notes, then `x` on the second line: the file holds the empty line under the
    title, an empty line and `x`, and `visitText` equals the editor's text.
  - An empty line typed at the end of the notes, then text on it: the text lands on the line the
    empty one took, and the next item's title is untouched (design risk 4). The list note writes
    its blank line after the note once.
  - A list note with two empty lines under the frontmatter: `openNotes('listNote')` starts at its
    first line with text, and a change to it leaves the empty lines as they were.
  - A card's notes and a list note, each with empty lines above and below their text:
    `openNotes` returns exactly the notes as parsed (`getItemNotes`, and `getListNote` from the
    first line with text), so the editor's lines line up with the visit's.
  - The list note `Old` above `  - [ ] a`: `notesChangeFits` with `- a` is false and the text is
    unchanged; with `ab` it is true.
  - A line tracked at an empty list note's start follows the note's first text.
  - Three saves in one visit, then `history.undo`: the text is back to before the visit, in one
    step.
  - An outside change above the notes moves the span, the next save lands on the right lines, and
    `visitText` gives the visit's lines with a typed empty line at the end kept; one that changes a
    line of the notes gives `{ lost: true }` and `visitText` null.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with the message "Save a line range of the notes".

### Task 2: Edit a card's notes in one editor

**Files:**
- Create: `src/view/notes-editor.ts` (creating, syncing, saving), `src/view/notes-keys.ts` (the
  keymap and the format bar's actions), `src/view/notes-source.ts`
- Modify: `package.json`, `package-lock.json`, `AGENTS.md` (the dependency line),
  `THIRD_PARTY_NOTICES`, `README.md` (its license line), `src/view/card.ts`, `src/view/events.ts`,
  `src/view/format.ts`, `src/view/pictures.ts`, `src/view/menus.ts`, `src/view/notes-host.ts`,
  `src/view/note-piece-field.ts`, `styles.css`, `.github/dependabot.yml`, and the `minAppVersion`
  lines of `manifest.json`, the designs and `src/view/delete.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces, in `src/view/notes-source.ts`: `NotesSource { kind: 'item' | 'listNote'; read(): {
  markdown: string; start: number } | null; open(): string | null; visitText(): string | null;
  visitStart(): number | null; fits(change: NotesChange): boolean; save(change: NotesChange): Typed;
  close(): void }`, the notes an editor holds, and `cardNotesSource(view: PrinceListView, card:
  Card): NotesSource`. `read` gives the notes as parsed, `open` starts a visit, `visitText` and
  `fits` are Task 1's, `visitStart` is the visit's `range.start` or null outside one, `save` goes
  through `saveNotes` and returns its `Typed` to the editor, which passes it to `view.handleTyped`.
  A source does anything else its save needs itself, so Task 7's list note source keeps
  `saveListNote`'s `note` and checks its warnings inside `save`, and the interface stays as it is.
- Produces, in `src/view/notes-editor.ts`:
  - `showNotesEditor(view: PrinceListView, source: NotesSource, area: HTMLElement): EditorView`:
    creates the editor in `area` once, or, for the one already there, syncs it. The card keeps it
    in `card.editor` in place of `card.notes`, and closing the card destroys it.
  - `syncNotesEditor(editor: EditorView, markdown: string): void`: unless the text is already
    `markdown`, dispatches the change `changedLines` gives, annotated as a sync, with
    `Transaction.addToHistory.of(false)` and `filter: false`, so the selection maps through it and
    no change filter sees it. It then clears the editor's history in two more transactions,
    reconfiguring the `history()` extension's `Compartment` to nothing and then back (both in one
    leaves the history in place), so its undo never takes back a change it didn't make. A sync is
    never saved.
  - When a sync runs: on creating and on blur (the visit ends, `source.close()`), with
    `source.read()`; on each redraw while the editor hasn't focus, with `source.read()`; and with
    focus, after an outside change, the list's undo or redo, or a tick from elsewhere, with
    `source.visitText()`, or with `source.read()` and a new visit when that is null. On focus,
    `source.open()` starts a visit, and the editor syncs to the text it returns, which is the text it
    already holds unless the file changed unseen. Focus comes from the DOM's `focus` and `blur`,
    through `EditorView.domEventHandlers`: CodeMirror sends `focusChangeEffect`'s transaction a
    moment later, after an update that carries a keystroke, so the first keystroke could be saved
    before the visit opened.
    Moving to another window or app doesn't end a visit, as `onFocusOut` in `events.ts` keeps the
    list title's field.
  - An `EditorState.changeFilter` returns true when `!tr.docChanged`; otherwise it stops the change
    when `source.fits` is false for `changedLines(tr.startState.doc.toString(),
    tr.newDoc.toString())`, and shows step one's notice once per visit, so a refused change never
    reaches the document or the editor's history (design, "Saving"). A change with no visit open,
    as a drop from another app makes without a focus event, opens one, and is refused, closing it,
    when the notes no longer read as the editor shows them. After the change the editor syncs, and
    the visit ends unless the editor has focus by then.
  - Saving, from the editor's `dispatchTransactions`, after `editor.update(trs)`: for each
    transaction that changed the doc and isn't a sync, `changedLines(tr.startState.doc.toString(),
    tr.state.doc.toString())` to `source.save`, then `view.handleTyped`, so a sync batched into the
    same update is never saved. A lost or refused one syncs at once, which an update listener
    can't, since it may not dispatch during an update. When the item itself is gone the card
    closes as step one says, with its "Copy text", and `lockNotesEditor(editor)` makes the editor
    read-only as `cardLost` makes the card's fields.
  - `appendNotesBlock(editor, markdown): boolean` focuses the editor and adds a block at the end of
    the notes through it, in place of notes that are only blank. Pictures use it until Task 6.
  - `EditorView.contentAttributes` turns spell check, autocorrect, capitals and writing suggestions
    back on, as a textarea has them, since CodeMirror turns them off.
- Produces, in `src/view/notes-keys.ts`: `notesKeymap()`, then
  `historyKeymap`, then `defaultKeymap` without its `Mod-Enter`, `Escape`, `Mod-[` and `Mod-]`
  bindings, filtered by `key`: Cmd+Enter stays the list's add, Escape the view's, which closes the
  card, and only Tab indents, on list items.
  - Enter: `insertNewlineContinueMarkupCommand({ nonTightLists: false })`; Backspace:
    `deleteMarkupBackward`.
  - Cmd+Shift+Z: `redo`, which `historyKeymap` binds only on macOS and Linux.
  - Tab and Shift+Tab: `indentMore` and `indentLess`, with `indentUnit` a tab, when every line the
    selection is on is a list item in `syntaxTree`; otherwise false, so focus leaves.
  - Cmd+B, Cmd+I and Cmd+K: `formatSelection` from `src/core/format.ts` on the selection, one
    change.
  - `runNotesBarAction(editor: EditorView, action: BarAction): void`: Undo and Redo through
    `undo` and `redo`, the rest as the keys. `format.ts` exports `BarAction`.
- `buildFormatBar(after: HTMLElement)` takes the element the bar follows, the editor's `dom` here.
  The bar shows only while the editor has CodeMirror's `cm-focused` class. A press keeps focus.
  `styles.css` gets the phone's one row: `.princelists-is-mobile .princelists-format-bar` with
  `flex-wrap: nowrap`, `overflow-x: auto`, and no scroll bar.
- The editor shows the gray "Notes" while empty and is at least three lines tall. Pictures pasted
  or dropped on a card's notes go in a block of their own at the end of the notes, through the
  editor, until Task 6.

- [ ] **Step 1: Add the dependencies** with `npm install @codemirror/lang-markdown@^6.5.2
  @lezer/markdown@^1.8.1` and `npm install --save-dev @codemirror/language @codemirror/commands`.
  Check design risk 1: `npm view @codemirror/lang-markdown@6.5.2 dependencies` against the
  `@codemirror/*` and `@lezer/common` that Obsidian at `minAppVersion` and the current Obsidian
  provide, and load the editor in both. If the older can't load it, stop and raise it: a new
  `minAppVersion` is the owner's call. After `npm run build`, check that `main.js` bundles no
  `@lezer/common`, `@lezer/lr` or `@lezer/highlight` (it `require`s them), so the parser's
  `NodeProp`s are Obsidian's single copy.
- [ ] **Step 2: Update** `AGENTS.md`'s dependency line to name the two new runtime packages,
  `THIRD_PARTY_NOTICES` with their MIT licenses, and the README's license line.
- [ ] **Step 3: Build it.** The rules are Task 1's tested functions.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on desktop, the iPhone and Android:**
  - Arrow keys, Shift and the arrows, and a selection across lines; double and triple clicks.
  - Enter continues a bullet, a numbered item (renumbering the rest) and a checklist item
    unticked; Enter on an empty nested item moves it out, and on a top-level one takes its marker
    off; Backspace after a marker.
  - Tab indents a list item by one tab and leaves the editor on a paragraph.
  - Cmd+Enter adds an item, Cmd+F opens the filter, Escape closes the card, and Cmd+Z, Cmd+Shift+Z
    and the bar's Undo and Redo step through the editor's history.
  - The format bar shows under the editor only while it has focus, and on a phone is one row that
    scrolls sideways with the keyboard up.
  - `git diff` after typing shows only the touched lines, in a CRLF file and one without a final
    newline; after focusing the notes and leaving without typing, it is empty (design risk 2).
  - A refused change doesn't land, with one notice per visit; a refused Backspace that would join
    two lines, then Cmd+Z: nothing is doubled.
  - Leaving the notes, then Cmd+Z in the list: the visit goes back as one step, and in the notes
    again Cmd+Z does nothing.
  - The same list in two panes: typing in one card shows in the other once it saves, with that
    card's notes in step.
  - Switching to another app and back keeps the visit: Cmd+Z after it still undoes the typing.
  - On the iPhone: Backspace on an empty line, autocorrect and dictation, and a Japanese keyboard's
    Enter that confirms a word (design risk 5). A refused change mid-word with autocorrect on: the
    word up to the refused step stays and nothing is doubled; if it doubles, raise it in the pull
    request. On Android: the keyboard's Backspace and Enter, and the bar above it (design risk 6).
  - Right-click in the notes on desktop shows no item menu (design risk 8).
  - Write down `main.js`'s size before and after.
- [ ] **Step 6: Commit** with the message "Edit a card's notes in one editor".

### Task 3: Draw a card's notes as Live Preview does

**Files:**
- Create: `src/core/wiki-links.ts`, `tests/core/wiki-links.test.ts`, `src/view/notes-drawing.ts`,
  `src/view/notes-widgets.ts` (the bullet, rule and picture widgets), `src/view/notes-links.ts`
  (what the drawing needs from Obsidian), and `src/core/drawn-links.ts` with
  `tests/core/drawn-links.test.ts` (`linkTarget`, `isWebAddress` and `pictureLook`)
- Modify: `src/view/notes-editor.ts`, `src/view/notes.ts`, `src/view/pictures.ts`, `styles.css`

**Interfaces:**
- Produces, in `src/core/wiki-links.ts`: `WikiLink { from: number; to: number; linkpath: string;
  display: string | null; embed: boolean }` and `wikiLinks(text: string): WikiLink[]`, every
  `[[…]]` and `![[…]]` in a line, in order, with columns `[from, to)`. `linkpath` is the part before
  `|`; `display`, the part after it. The Markdown parser has no wikilinks, so the drawing finds them
  here and skips those inside inline code or a code block by `syntaxTree`.
- Produces, in `src/view/notes-drawing.ts`: `notesDrawing(view: PrinceListView, sourcePath:
  string)`, a `ViewPlugin` whose decorations follow the design's "What shows drawn" for inline
  marks and lines, rebuilt when the doc, the selection, the focus, the viewport or the syntax tree
  changes:
  - Inline marks (`EmphasisMark`, `StrikethroughMark`, `InlineCode`'s `CodeMark`, `<u>`), links,
    wikilinks, pictures and bullets hide their Markdown unless the selection touches them; heading
    marks, quote marks and rules unless the caret's line is theirs. Without focus, nothing shows
    its Markdown.
  - Headings, quotes and code lines get a line class each, styled with Obsidian's heading, quote and
    code variables.
  - A picture (`Image`, or an embed whose path has a `PICTURE_EXTENSIONS` extension) is an `<img>`
    from `getFirstLinkpathDest` and `getResourcePath`; a link it can't find shows as typed. The
    drawing finds pictures with `pictureLinks`, as the picture menu does. A picture from the web,
    an `Image` whose address is http or https, is drawn by `MarkdownRenderer.render` from its
    Markdown, as Task 5 draws blocks: the privacy rule lets Obsidian's renderer load it, as in any
    note, and so is a web page it embeds, such as a video, which Obsidian's own styles fit to the
    card. Its widget's `Component` is a child of the list view, removed in `destroy`. As in a note,
    a last `|` part such as `100` or `100x80` sets a picture's size and the caption before it is its
    alt text; a wiki embed without one has its path as alt text. While
    the selection touches a picture, its Markdown shows with the picture after it.
  - The parser reads `[[a]]` as a link in brackets and `![[a]]` as an image, so the drawing skips
    `Link` and `Image` nodes that overlap a wikilink. A link without an address, `[a]`, shows as
    typed, and so does one split across lines: a view plugin can't hide a line break.
  - A `javascript:`, `vbscript:` or `data:` link gets no `href`, as in Obsidian's own notes.
    `linkTarget` decides, and `pictureLook` reads a picture's alt text and size.
  - A link is an `a` mark (`Decoration.mark({ tagName: 'a' })`) with `internal-link` and
    `data-href`, or `external-link` and `href`. The view's delegated click and right-click listeners
    in `events.ts` already follow it with `handleLinkClick` and show `handleLinkMenu`; the editor's
    own handlers leave links to them, so a link opens once. The editor's `mousedown` handler on a
    drawn link returns true and prevents the default, so the caret stays put and the link stays
    drawn for the click. The browser follows no link in editable content, so `handleLinkClick`
    opens a web address there with `window.open`, which Obsidian handles as a clicked link.
    `isWebAddress` limits it to http and https: `window.open` doesn't hand other schemes, such as
    `obsidian://`, on as a clicked link does, so they stay unopened in the editor.
  - Tags, footnotes, `%%` comments and anything else show as typed.

- [ ] **Step 1: Write the failing tests** for `wikiLinks`: `[[a]]`, `[[a|b]]`, `[[a#h|b]]`,
  `![[p.png]]`, two links on one line, and an unclosed `[[a`, which gives none.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the drawing.**
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on desktop and mobile,** side by side with the same Markdown in a
  note in Live Preview: each mark, link, picture and bullet shows its Markdown only while the
  selection touches it; headings, quotes and rules only on the caret's line; a click lands on the
  character clicked; a click on an internal link opens it, Cmd+click in a new tab, and a click on
  an external link opens it in the browser (if it doesn't inside the editor, raise it in the pull
  request rather than working around it); nothing shows its Markdown once the editor loses focus.
- [ ] **Step 6: Commit** with the message "Draw a card's notes as Live Preview does".

### Task 4: Tick checkboxes drawn in the notes

**Files:**
- Modify: `src/core/checklist.ts`, `tests/core/checklist.test.ts`, `src/view/notes-drawing.ts`,
  `src/view/notes-editor.ts`, `src/view/checklist.ts`, `src/view/events.ts`

**Interfaces:**
- Consumes: Task 3's drawing.
- Produces, in `src/core/checklist.ts`: `planNotesLineTick(text: string, contentStart: number,
  notesOf: number | 'listNote', line: number, lineText: string): PlannedLineEdit | null`: ticks
  file line `line` with `toggleChecklistLine` when it still reads `lineText`, lies within the notes'
  lines (of the item at title line `notesOf`, or of the list note) and `parseItemLine` reads it as a
  checklist item; null otherwise. Unlike `planChecklistTick`, it doesn't go through `checklistOf`,
  so `%%` and `$$` in the notes don't stop it.
- The editor's `domEventHandlers` handle every box it draws, Task 5's disabled ones included;
  `events.ts`'s `.task-list-item-checkbox` handling and `keepNotesFocused` leave boxes inside the
  editor to it, so a click ticks once.
- A `TaskMarker` outside a big block draws as a checkbox widget that knows its editor line. Its
  mousedown is prevented, so it never takes focus. A click with focus is the editor's own change, in
  its history. A click without focus writes through `planNotesLineTick` as `checklistClick` writes:
  queued with the item's tracked line, and refused with `CHANGED_ELSEWHERE_NOTICE` when an outside
  change came between. The sync after it clears the editor's history.

- [ ] **Step 1: Write the failing tests:** `- [ ] a` to `- [x] a` and back; a nested `\t\t- [ ] b`;
  a line in notes holding `%%`; a line that no longer reads `lineText`, a line in another item's
  notes and a line that isn't a checklist item, each null; the list note's nested box.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the widget.**
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on desktop and mobile:** a box ticks its own line, focused and not,
  with no `✔` date; focused, Cmd+Z takes it back; unfocused, the list's Cmd+Z does; the keyboard
  doesn't come up on a phone for an unfocused tick; a box in notes holding `%%` ticks.
- [ ] **Step 6: Commit** with the message "Tick checkboxes drawn in the notes".

### Task 5: Draw tables, code, callouts, math and embeds with Obsidian's renderer

**Files:**
- Create: `src/core/drawn-blocks.ts`, `tests/core/drawn-blocks.test.ts`,
  `src/view/notes-blocks.ts`
- Modify: `src/view/notes-editor.ts`, `src/view/notes-drawing.ts`, `src/view/events.ts`,
  `styles.css`, `docs/superpowers/specs/2026-10-29-notes-in-one-editor-design.md` ("Checkboxes")

**Interfaces:**
- Produces, in `src/core/drawn-blocks.ts`: `DrawnBlock { lines: LineRange; kind: 'table' | 'code'
  | 'callout' | 'math' | 'embed' | 'html' }` and `drawnBlocks(markdown: string): DrawnBlock[]`:
  each table, fenced or indented code block, callout (a quote whose first line is `> [!…]`), `$$`
  block, embed of a note alone on its line, and HTML block in the notes, in order, at any depth of
  list, but none inside another. It reads the notes as `notePieces` does, through `maskBlocks` and
  CommonMark, so it agrees with the save's and the ticks' parse.
- Produces, in `src/view/notes-blocks.ts`: `drawnBlocksField(view: PrinceListView, sourcePath:
  string)`, a `StateField` of block widgets (CodeMirror takes block decorations only from state):
  - One `Decoration.replace({ block: true })` over each block's lines, except the blocks the
    selection touches while the editor has focus. The field learns of focus from
    `EditorView.focusChangeEffect`, since a `StateField` can't read the view.
  - A widget renders its Markdown, less its first line's indent, with `MarkdownRenderer.render`
    and a `Component` of its own, a child of the list view, removed in the widget's `destroy`. Its
    `eq` compares the Markdown and kind, so typing elsewhere doesn't redraw it.
  - A mousedown on a drawn block puts the caret at the start of its first line and focuses the
    editor, without scrolling the card; on a link in it, the link opens instead.
  - Its boxes draw disabled (owner): step two's count can't line one up with its line, since it
    doesn't read list items behind `>`, and tables, code, math, HTML and another note's embed hold
    no checklist line of these notes. A click on one shows the block's Markdown, where `[ ]` can be
    typed. This task updates the design's "Checkboxes" bullet on boxes in a drawn block to say so,
    and why.
  - Task 3's drawing skips the lines of the drawn blocks.

- [ ] **Step 1: Write the failing tests** on notes holding a table, a fence with an empty line
  inside, a callout holding a list and a table, a plain quote (not drawn), a `$$` block with an
  empty line inside, `![[Other note]]` alone on its line, `![[p.png]]` alone on its line (not
  drawn), a `<div>` block, a fence inside a list item (only its own lines), and an unclosed fence,
  drawn to the end of the notes.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Build the field.**
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Check it by hand on desktop and mobile** (design risk 7): each kind draws as in a
  note and shows its Markdown once the caret enters it, with the arrow keys or a click; a click
  inside a drawn table or callout doesn't jump the card's scroll; typing elsewhere doesn't redraw a
  block; an embedded note's widget unloads when it's taken away, so its embed's own Component is
  gone; a box in a callout or an embedded note draws disabled, and a click on it shows the block's
  Markdown.
- [ ] **Step 6: Commit** with the message "Draw tables, code, callouts, math and embeds with
  Obsidian's renderer".

### Task 6: Put pictures after the caret's block, and keep their menu working

**Files:**
- Modify: `src/view/pictures.ts`, `src/view/picture-menu.ts`, `src/view/notes-drawing.ts`,
  `src/view/notes-editor.ts`

**Interfaces:**
- Consumes: `blockAfter(markdown, range)` in `src/core/note-pieces.ts`, which stays; Task 3's
  picture widget.
- A pasted picture's links go in a block of their own after the block the caret is in, or after its
  whole list (`blockAfter` on the caret's line), as one change in the editor, and the caret moves to
  an empty line below them (step one, "Where the links go"). A picture dropped on the notes goes
  after the block it's dropped on, found with `posAtCoords`, and focuses the editor.
- A picture widget carries its link's editor line and columns. The picture menu's Remove image and
  Delete image use them as the `PictureLinkAt` for `planPictureRemove`: the file line is
  `source.visitStart()` plus the editor line while a visit lasts, else `source.read().start` plus
  it, and the columns are moved by the length of the indent the editor left off that line. So every
  picture drawn from a link in the notes gets them. A picture inside a drawn embed gets none.

- [ ] **Step 1: Build it.**
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on desktop and mobile:** a picture pasted in a paragraph, in a list
  and in a table goes after that block, or after the whole list; a dropped one after the block under
  the pointer; the caret ends on the empty line below; Remove image and Delete image show for two
  pictures on one line and remove the right one; `git diff` shows only the new or removed link
  lines.
- [ ] **Step 4: Commit** with the message "Put pictures after the caret's block, and keep their menu
  working".

### Task 7: Edit the list note in one editor

**Files:**
- Modify: `src/view/notes-source.ts`, `src/view/fields.ts`, `src/view/redraw.ts`,
  `src/view/list-view.ts`, `src/view/events.ts`, `src/view/menus.ts`, `src/view/checklist.ts`,
  `styles.css`

**Interfaces:**
- Consumes: Tasks 1 to 6.
- Produces, in `src/view/notes-source.ts`: `listNoteSource(view: PrinceListView): NotesSource`:
  `read` through `getListNote` from the list note's first line with text, as Task 1's
  `openNotes('listNote')` starts, `open` through `openNotes('listNote')` and `save` through
  `saveListNote`: it checks `warnListNote` on the returned `note`, the whole note as saved, as
  `fields.ts` does for a piece, and returns the result as `Typed` without its `note`. Leaving the
  note still draws the whole list again when it warned or rows were held back, as `closeListNote`
  in `fields.ts` does now, alongside the sync on blur.
- `buildListNote` and `refreshListNote` show the list note's editor with `showNotesEditor`; the
  view keeps it in place of `listNoteNotes` and destroys it in `onClose` and when the note stops
  being a list.
- It takes no pictures: paste and drop do nothing in it. Its boxes tick as a card's do, with
  `'listNote'` for `notesOf`.
- The list's background menu (step two, "Right-click menus") no longer opens over the list note.

- [ ] **Step 1: Build it.**
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on desktop and mobile:** typing `- [ ] x` at the top level warns
  before it saves, and a nested one under a plain bullet doesn't; Enter continues a bullet; a
  table and a callout draw; `git diff` shows only the touched lines; a typed blank line at the end
  writes the blank line after the note once; right-click in the note opens no list menu.
- [ ] **Step 4: Commit** with the message "Edit the list note in one editor".

### Task 8: Remove the block fields, and update the designs

**Files:**
- Delete: `src/view/note-piece-field.ts`, `src/view/note-piece-keys.ts`,
  `src/view/note-piece-slot.ts`, `src/view/note-piece-state.ts`, `src/view/note-pieces.ts`,
  `src/view/click-caret.ts`, `src/view/notes-host.ts`
- Modify: `src/core/note-pieces.ts`, `src/core/editing.ts`, `src/core/edit-piece.ts`,
  `src/core/edit-list-note.ts`, `src/core/edit-lines.ts` and their tests, `src/view/events.ts`,
  `src/view/keys.ts`, `src/view/format.ts`, `src/view/field-undo.ts`, `styles.css`, the three
  designs

**Interfaces:**
- Goes from `ListEditing`: `openNotesPiece`, `typeNotesPiece`, `notesPieceOutdent`, `openListNote`,
  `typeListNote`, `listNoteRange`, `listNoteOutdent` and `listNoteAsTyped`. `notesPieceRange`
  stays, since the card's `visitStart` reads the visit's range through it. Goes from
  `src/core/note-pieces.ts`: `pieceEnter`, `nextItemMarker`, `neighborPiece`, `outdentMarker`,
  `itemPieces`, `pieceText` and `holdsOnly`, unless something that stays still calls one. `notePieces`, `blockAfter` and `pieceAround` stay. Goes too, unless
  something that stays still calls it: `listNoteWithPiece` in `edit-list-note.ts`,
  `holdsSeparatorLine`, `typedLines` and `withoutSeparatorLine` in `edit-lines.ts`, and
  `setNotesPiece` and `setListNotePiece` themselves.
- `Typed`'s comment in `editing.ts` says a refused field keeps its text for the next keystroke;
  update it, since a refused change now never lands.
- Goes from the view: the textarea paths of the format bar and `field-undo.ts` that only the
  notes used; the card's title keeps its own. `keys.ts` finds the notes by the editor, not
  `notesHostOf`.
- `src/view/block-fields.ts` stays: it is the `princelists` code block's title field.

- [ ] **Step 1: Remove the code,** and the tests of what goes.
- [ ] **Step 2: Check nothing orphaned is left:** `grep -rn` each name above in `src/` finds no
  definition and no caller. Then run `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Update the designs** as the design's "What goes, and what changes in the other
  designs" lists, item by item: step one's "Notes use Obsidian's own Markdown rendering", "The
  piece's own field fits its text", "The list note and item notes", "Pictures show at once", "Where
  the links go", the outside change to a focused field's block, and "Undo (1b, call)"; step two's
  "Editing notes a block at a time", "Formatting in a card", "Ticking checklists" and "Right-click
  menus". In this design, record each deviation the build decided with its reason, including
  design risk 4: a typed empty line at the end stays in the file, and leaves the editor when the
  visit ends, since the parse ends the notes at their last line with text. In its "Order", record
  the plan's order and why. Set `verified` on all three.
- [ ] **Step 4: Check it by hand on desktop and mobile** once more: a card's notes and the list note
  edit, draw, tick and take pictures as in Tasks 2 to 7.
- [ ] **Step 5: Commit** with the message "Remove the block fields, and update the designs". Write
  down `main.js`'s size.

### Task 9: Finish notes in one editor and release 1.1.0

**Files:**
- Create: `docs/superpowers/notes/<date>-notes-editor-checks.md`
- Modify: the design (status), `README.md`, `package.json`, `package-lock.json`, `manifest.json`,
  `versions.json`

- [ ] **Step 1: Run every manual check of Tasks 2 to 8 again** on desktop, the iPhone and Android,
  with the release build.
- [ ] **Step 2: Write the notes file:** each check, its result and how it ran, naming no devices,
  vaults or home paths.
- [ ] **Step 3: Update the README** where the notes are described, and its screenshot of a card's
  notes if the drawn notes look different.
- [ ] **Step 4: Set the design's status** to `live` once the owner confirms it, and step two's
  pointer in "Editing notes a block at a time" to the past tense.
- [ ] **Step 5: When the owner says,** bump the version with `npm version minor
  --no-git-tag-version`, which gives `1.1.0` and adds `"1.1.0": "1.13.4"` to `versions.json`.
- [ ] **Step 6: Commit** the notes, the designs, `README.md` and the version files with the message
  "Finish notes in one editor". The owner merges it, tags `1.1.0` and publishes the release
  (`AGENTS.md`, "Releases").
