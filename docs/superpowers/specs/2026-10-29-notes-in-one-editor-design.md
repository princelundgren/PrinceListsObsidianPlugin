---
status: live
verified: 2026-10-30
governs: [src/**, styles.css, manifest.json]
---

# PrinceLists for Obsidian: notes in one editor

A card's notes and the list note edited a block at a time: Obsidian's renderer drew them, and the
block you clicked became a plain-text field (step two, "Editing notes a block at a time"). Hands-on
testing on macOS, iOS and Android found that the seams between blocks are where notes broke or
stopped feeling like a note: arrow keys, selecting across blocks, joining two blocks, and key
handling that each platform needed its own fixes for (#182). This design puts the notes in one
CodeMirror 6 editor that looks like Obsidian's Live Preview, and the block fields are gone
**(owner)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-10-29 unless another date is given; **(call)** means
the designer did, and a builder may revisit it. Step one's rules still hold: an edit replaces only
the lines it concerns, nothing is written in the background, and only documented Obsidian APIs are
used.

**Keys:** Cmd in this design means Obsidian's `Mod` key, which is Ctrl on Windows and Linux.

## At a glance

- **One editor** holds a card's notes, and another the list note **(owner)**, both in the same
  release, replacing step two's "Editing notes a block at a time".
- **It looks like a note:** Markdown shows only where the cursor is, as in Obsidian's Live Preview.
  Tables, code blocks, callouts, math and embedded notes are drawn by Obsidian's renderer until the
  cursor enters them **(owner)**.
- **Keys, selection and undo** are CodeMirror's, across the whole notes, with no custom handling
  per platform.
- **Saving changes only the lines a change touched,** through the same checks as before.
- **On mobile the format bar is one row** that scrolls sideways **(owner)**.

## The editor

- **CodeMirror 6, Obsidian's own editor library (owner, #182).** Obsidian documents CodeMirror only
  as extensions to its own editor (`registerEditorExtension`), and no way to put that editor in a
  plugin's view. So the plugin makes its own `EditorView`, with CodeMirror's public API and the
  packages Obsidian gives plugins at runtime: `@codemirror/state`, `view`, `language` and
  `commands` stay out of `main.js`, as the build already marks them. No private Obsidian API, and
  nothing reaches into Obsidian's DOM.
- **Two new dependencies (owner, #182),** bundled: `@codemirror/lang-markdown` and
  `@lezer/markdown`, both MIT. Only `markdownLanguage`, `insertNewlineContinueMarkupCommand` and
  `deleteMarkupBackward` are imported: `markdown()` would bundle the HTML, CSS and JavaScript
  parsers too, about 146 kB more. AGENTS.md's dependency line changed with the build.
- **What it holds:** the notes line for line, without the item's indent, as the block fields held a
  block. Every line in the editor is one line in the file, so a change knows exactly which file
  lines it touched **(call)**.
- **It's always there:** the card's notes and the list note are the editor itself, focused or not;
  a click puts the caret where it lands, so step one's `caretPositionFromPoint` rule goes. Empty
  notes show the gray "Notes", and a card's stay three lines tall (step one, "A card's notes are at
  least three lines tall").
- **Each open card has one,** and the list note one; the Schedule view and a list inside another
  note have no cards and no editor. Closing the card or the view destroys it.
- **Listeners:** clicks on drawn checkboxes, links and blocks go through one
  `EditorView.domEventHandlers` per editor, as AGENTS.md's one delegated listener per container
  asks.

## What shows drawn (owner: as Obsidian's Live Preview)

Compared with Obsidian's own editor side by side on desktop:

- **Inline:** bold, italic, strikethrough, `<u>`, inline code, links, pictures, checkboxes and list
  bullets are drawn, and show their Markdown only while the selection touches them.
- **By line:** headings, quotes and horizontal rules show their Markdown while the cursor is on
  their line.
- **Big blocks:** a table, a code block, a callout, a `$$` math block at the notes' own left margin
  (where the save reads one), an embed alone on its line that isn't a picture, such as a note or a
  PDF, and an HTML block other than a comment are drawn by `MarkdownRenderer.render`, each into a
  block widget with its own `Component`, until the cursor or selection enters it; then the whole
  block shows its Markdown.
  - The widgets come from a `StateField`: CodeMirror takes block decorations only from state, not
    from a view plugin.
  - A click on a drawn block puts the caret at the start of its first line **(call)**; with Shift or
    another modifier held, it selects as anywhere in the editor. A link in it opens, and a button
    the renderer draws, such as a code block's copy button, works as in a note.
  - Up and Down onto a drawn block stop at its start or end, as Live Preview's arrow keys enter a
    block **(call)**: CodeMirror's own vertical motion passes a block widget by.
  - A widget is drawn again only when its own Markdown changes, so typing elsewhere doesn't redraw
    it **(call)**.
- **While the editor isn't focused,** nothing shows its Markdown, wherever the selection was left.
- **Anything else shows as typed (call),** such as a tag or a footnote, in the editor's text style.
- **Styles:** Obsidian's CSS variables only, as everywhere in the plugin.

## Checkboxes

- **A drawn checkbox ticks its own line (call):** the editor knows which line drew it, so step
  two's count check and its `%%` and `$$` rule no longer apply to it. A click turns `[ ]` into
  `[x]` and back, saved at once, with no `✔` date, focused or not. A tick while the editor has
  focus is its own change, in its history, saved like typing. A tick while it hasn't is the list's,
  as a tick on a row is: the list's Cmd+Z takes it back, and it clears the editor's history like
  any change the editor didn't make.
- **It looks as in Live Preview:** the box takes the place of a bullet's `- [ ]`, and a numbered
  item keeps its number. A ticked line's text is struck through.
- **A box in a quote shows as typed (call),** as Live Preview shows it: the plugin reads no checklist
  line that starts with `>`, so a tick there couldn't be saved.
- **A box inside a drawn big block draws disabled (owner),** such as one in a callout or an embedded
  note: step two's count in "Ticking checklists" can't line it up with its line, since it reads no
  list item behind `>`, and tables, code, math, HTML and another note's embed hold no checklist line
  of these notes. A click on one shows the block's Markdown, where its `[ ]` can be typed.

## Keys and touch

- **CodeMirror's own:** arrow keys across the whole notes, except that Up and Down stop on a drawn
  block ("Big blocks"), Shift and the arrows, Cmd+A for all the notes, word and line moves, double
  and triple clicks, Backspace and Delete joining lines, and input methods.
- **Lists, as in a note:** Enter continues a list item of its kind
  (`insertNewlineContinueMarkupCommand`): a checklist's starts unticked, a numbered one counts on
  and renumbers the items after it. Enter on an empty nested item moves it one level out, and on a
  top-level one takes its marker off. A tight list stays tight (`nonTightLists: false`), as in a
  note **(call)**. Backspace right after a marker turns it into spaces, and a second Backspace
  takes them (`deleteMarkupBackward`).
- **Tab and Shift+Tab** indent and outdent the list items the selection is on, by one tab,
  Obsidian's default indent **(call)**. On other lines Tab leaves the editor, as from any field, so
  a keyboard user can get out **(call)**.
- **Cmd+B, Cmd+I and Cmd+K** make the selection bold, italic or a link, as before, now in the
  editor's own keymap.
- **Escape** leaves the notes, as before. **Cmd+F** stays the list's filter: CodeMirror's search
  isn't loaded **(call)**.
- **Links:** a click on a drawn link follows it, as in Live Preview: a link to a note through
  Obsidian's `openLinkText`, and a web link through `window.open`, which Obsidian handles as a
  clicked link, since the browser follows no link in editable content. A `mailto:` or app link,
  such as `obsidian://`, stays unopened in the editor **(call)**: `window.open` doesn't pass it on,
  and Obsidian's reading view didn't open an `obsidian://` link on a real click either. The caret
  reaches a link with the arrow keys or a click beside it.
- **Right-click on desktop:** on a link, Obsidian's link menu (step one); on a picture, the picture
  menu (step two, "Right-click menus"). Elsewhere in the notes the plugin opens no menu of its own,
  and the list's background menu no longer covers the list note **(call)**. A press of a button
  other than the main one on a picture the editor draws, or on a drawn block, leaves it drawn and
  the editor's focus as it was: Windows opens the menu on release, after a focus would have shown
  the Markdown.

## Undo (call)

- **While the editor has focus,** Cmd+Z and Cmd+Shift+Z, and the format bar's Undo and Redo, step
  through the editor's own history, across the whole notes.
- **Outside the editor,** they stay the list's (step one, "Undo (1b, call)"), where a visit to the
  notes is one step, as typing in a field was.
- **Any change the editor didn't make** clears its history, as an outside change clears the list's:
  an outside change, the list's undo, or a tick from elsewhere. So the editor's undo never takes
  back a change it didn't make.

## The format bar

- **Under the editor while it has focus,** with the same buttons and rules as step two's "Formatting
  in a card". A press keeps focus in the editor, so a phone's keyboard stays up.
- **On mobile, one row that scrolls sideways (owner),** with no scroll bar, as Obsidian's own
  toolbar above the keyboard does. On desktop, whole groups still wrap on a narrow card.

## Saving

- **After each change, only the lines it touched (call).** From the change's first touched line to
  its last, the lines are written back, one file line per editor line, through the check that the
  list's layout can take them (`replaceRun` with the notes' block keys), empty lines at the end
  included. A touched line keeps its own indent, and a new line takes the item's; so does a touched
  lazy line, short of the item's indent, so a list marker typed on it stays in the notes. The
  notes' other lines keep every byte. The core saves a given line range directly, with no open,
  type and close session around each change.
- **Notes directly under the title,** with no empty line between, as another editor can leave them,
  stay so until a change would make a heading of the title, such as a `---` line, or a lone `-` as
  the first key of a bullet. That change also writes the empty line under the title, as step one's
  "Item notes" requires, and a lazy first line takes the notes' indent, or it would leave the item
  **(call)**.
- **Empty notes** get the empty line under the title with their first text, so it can't join the
  title, as the block fields did.
- **Empty lines typed at the end of the notes (call)** stay in the file and in the editor while the
  visit lasts. The parse ends the notes at their last line with text, as CommonMark ends a block,
  so once the visit ends the editor leaves them out, and the file keeps them as empty lines after
  the notes. Notes the editor holds as one empty line are empty; two or more are written as empty
  lines.
- **Empty lines typed at the end of a file without a final newline** can't stay in the file, which
  drops them (AGENTS.md). The editor keeps them, and the text typed after them writes them back
  **(call)**.
- **A refused change never lands (call):** an `EditorState.changeFilter` asks the core whether
  the list's layout can take it and stops it when it can't, so it never reaches the editor's text
  or its history, with step one's notice that the list's layout can't take that change, once per
  visit to the notes. Taking it back after it landed let undo restore a refused deletion twice. So
  the editor never holds lines the file doesn't, and nothing is left to save when the card closes.
- **Outside changes** show in the editor at once, mapped so the caret stays on its text. Step one's
  rule that an outside change to the open block's lines leaves the field unable to save goes: there
  is no unsaved field. An outside change that loses track of the item still closes the card as step
  one says, with its "Copy text".
  - While the editor has focus, it holds the lines its visit started with, and the lines typed
    since **(call)**. An outside change to one of them ends the visit, and the editor shows the
    notes as they now are. Lines added next to them show once the visit ends: the notes as parsed
    can start or end on other lines than the visit's, so only the visit's own lines map one to one
    to the editor's.
- **The list note keeps its rules:** what would turn it into a heading or an item warns before it
  saves, checked on the whole note as it would be saved, and it takes no pictures.

## Pictures

- **Step one's "Pictures show at once" and "Where the links go" hold,** with the block the caret is
  in as the open block: the links go in a block of their own after it, or after its whole list,
  drawn at once, and the caret moves to an empty line below them. Text typed there joins the
  picture's paragraph, as in Live Preview, not a new block of its own as in step one **(owner,
  2026-10-29)**. On an empty line between blocks,
  they take its place, as they take an empty new block's. A picture dropped on the notes goes after
  the block it's dropped on **(call)**.
- **The picture menu's Remove image and Delete image** show for every picture the editor draws,
  since it knows each one's own link. A picture Obsidian's renderer draws in a big block is lined
  up with that block's picture links, and gets neither when they don't line up, as when one is in
  code; one in an embedded note still gets none.

## What went, and what changed in the other designs

- **The block-field view code:** the note-piece fields, their keys and slots, and drawing notes a
  block at a time. Core functions that only served them went with them: finding the neighbor block
  for Up and Down, the piece saves, placing the caret from a click's point, and counting rendered
  checkboxes against checklist lines.
- **A new core entry point** saves a given line range of the notes, in place of the open, type and
  close session the fields used; it came with its tests first, as every change in `src/core/` does.
- **Step one changed with the build:**
  - "Notes use Obsidian's own Markdown rendering" becomes: big blocks do, and the editor draws the
    rest.
  - "The piece's own field fits its text" goes.
  - "The list note and item notes": drawn a block at a time, where the caret goes, and the
    `caretPositionFromPoint` rule are replaced by "The editor" **(owner, #182)**. A click still
    lands on the character clicked, and a link still follows.
  - "Pictures show at once" and "Where the links go" say "the block the caret is in" for "the open
    field", and a picture dropped on the notes goes after the block it's dropped on.
  - "An outside change to the lines of the block a focused field writes" is replaced by "Saving".
  - "Undo (1b, call)" points here for the notes.
- **Step two changed with the build:**
  - "Editing notes a block at a time" is replaced by this design, its rule for a picture dropped
    on the drawn notes included.
  - "Formatting in a card" points its format bar and keys here, and drops the wrapped rows on
    mobile.
  - "Ticking checklists" no longer applies to the notes: a drawn box ticks its own line, and one
    inside a drawn big block is disabled ("Checkboxes").
  - "Right-click menus": the background no longer includes the list note, and Remove and Delete
    image wait for pictures to line up with links only in a big block.

## What this costs (call)

- **Size:** about 42 kB more `main.js`, minified, less the block-field code, about 21 kB.
- **Our own Live Preview:** the drawn look is the plugin's, not Obsidian's, so it can differ from a
  note in small ways, and a theme that styles Obsidian's editor doesn't style this one.
- **A CodeMirror update in Obsidian** could stop matching the bundled Markdown package. Risk 1
  checks it at the build, and again whenever `minAppVersion` moves.
- **Obsidian 1.13.4 or later** (risk 1), where step two ran on 1.5.7.
- **A drawn block shows its whole Markdown** once the cursor enters it: a table shows its pipes.
- **A numbered checklist item,** `1. [ ]`, continues as a numbered item without a box: the command
  carries a box only for bullets.

## Risks to check during the build

1. **Versions:** the dependency ranges of `@codemirror/lang-markdown` and `@lezer/markdown`
   include the `@codemirror/*` and `@lezer/common` that Obsidian ships from `minAppVersion` on, and
   the editor loads there. `@lezer/markdown` 1.7 and later need `@lezer/common` 1.5, which public
   Obsidian ships from 1.13.4 on (checked in each release's `app.js`), so `minAppVersion` goes
   from 1.5.7 to 1.13.4 **(owner, 2026-10-29)**. Those on an older Obsidian keep PrinceLists 1.0.
2. **Byte for byte:** focusing and leaving changes nothing; typing changes only the touched lines;
   mixed tab and space indents stay as they were; a file without a final newline and one with CRLF
   endings keep both (AGENTS.md).
3. **The save cases the block fields got wrong** become tests: emptying a block in the middle, at
   the end and at the start of the notes, and the same in the list note.
4. **Empty lines at the end of the notes:** one typed there stays in the editor and in the file,
   except at the end of a file without a final newline ("Saving"). The next parse ends the notes at
   their last line with text, so the editor leaves it out once the visit ends ("Saving").
5. **iOS:** Backspace on an empty line, the keyboard's autocorrect and dictation, a Japanese input
   method's Enter, which only confirms a word, and a refused change taken back mid-word. Checked
   by hand on an iPhone for 1.1.0, but for the Japanese Enter and the refused change mid-word: the
   maintainer set this design live with those two open.
6. **Android:** the on-screen keyboard's Backspace and Enter, and the format bar above it.
7. **A drawn block:** a click inside a drawn table or callout enters it without jumping the card's
   scroll, and a widget with an embedded note unloads when it's taken away.
8. **Right-click elsewhere in the notes** on desktop shows what a text field shows in Obsidian, or
   nothing, and never the item menu.

## Order (call)

One release, in plan tasks that each keep the plugin working: saving a line range in the core;
the editor for a card's notes, with saving, the refused-change rule, undo, keys, Tab and the
format bar; the inline and line drawing; checkboxes; big blocks; pictures; the list note; then
removing the block-field code and updating step one's and step two's designs. The plan put saving,
undo and keys with the first editor, so a card never held text that wasn't saved and no key
regressed, and the drawing after it.
