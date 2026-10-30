---
status: draft
---

# PrinceLists for Obsidian: table cells in the notes

**On hold (owner, 2026-10-30):** this isn't enough without plus buttons, handles and a menu. #213 takes
it over, with what a prototype showed on an iPhone, and the toolbar has no Table button until then.

A table in the notes stays drawn while you edit it, and you type into its cells, as in a note's Live
Preview **(owner, 2026-10-30)**. A table showing its Markdown once a click enters it is hard to read,
most of all on a phone. So this changes "Big blocks" in the
[notes in one editor design](2026-10-29-notes-in-one-editor-design.md) for tables at the notes' own
left margin, in a card and in the list note. Issue #191, now part of #213. Tags mean what they mean in that design;
what has none is a **(call)**.

## Drawing and focus

- **The plugin builds the table's own elements** from the row lines, and draws each cell's text with
  `MarkdownRenderer.render`, so it never reads or changes the renderer's output to find a cell.
  Obsidian's API has no table editor, and this uses documented APIs only.
- **One small CodeMirror editor, in the cell being edited.** A click on a cell opens it through the
  notes editor's one `domEventHandlers`. The table's widget ignores the open cell's events
  (`WidgetType.ignoreEvent`), so they stay the cell's.
- **While a cell is open,** the table's widget stays, whatever its Markdown does, as an exception to
  "drawn again only when its own Markdown changes", and the visit stays open. A new row is added to
  the drawn table. The whole table is drawn again when the cell closes.
- **Links and modifiers:** a link in a cell opens on a click, as in any drawn block. A cell holding
  only a link is reached by a click on its padding, Tab or Enter. Shift or another modifier selects,
  as anywhere in the editor.

## Editing

- **The notes editor stays the one document.** A cell's change is a change to it, so the save, the
  layout check, the history and the visit work as for typing. Opening or leaving a cell writes nothing.
- **A change the check refuses never lands,** as in the notes: the cell's editor asks the same check.
- **A cell edit replaces only that cell's text in its row's line.** Its padding and every other byte
  stay. Spaces at the cell's ends aren't saved.
- **A `|` typed in a cell** is saved as `\|`, and shows as `|`. **A pasted line break** becomes a space.
- **A cell shows its Markdown only while it's open,** so bold shows as `**bold**` then.
- **A row with fewer cells than the table** gains its missing cells' pipes when one is first typed
  into. Cells past the table's width aren't drawn, and their bytes stay.
- **Moving:** Tab and Shift+Tab go to the next and previous cell, Enter and Down to the cell below, Up
  to the cell above. Past the table's edge, they leave it for the notes line there, except Enter (see
  "Rows"). Focus moves before
  the old cell is drawn, so a phone's keyboard stays up.
- **Escape** leaves the cell, with focus on the card, or on the list in the list note. A second Escape
  closes the card, as now. Cmd+A selects the cell's text.
- **Undo** in a cell is the notes editor's, and a cell it changes is drawn again. **If undo or an
  outside change takes the open cell's row,** the cell closes without writing, and focus goes to the
  notes editor.
- **The format bar** stays under the notes while a cell is open. Its Undo and Redo go to the notes
  editor, its formats and their keys act on the cell's selection, and a press keeps focus in the cell.

## Rows, columns and the Markdown (owner, 2026-10-30)

- **Rows:** Enter on the last row adds a row, unless that row is empty: then Enter removes it and
  leaves the table for the notes line below, as Enter ends a list. Backspace in the first cell of an
  empty row removes it too.
- **Columns** change only in the Markdown.
- **The Markdown still shows** on Up and Down onto a table from the notes, as now, with a selection
  that enters or crosses it, and through a command that works on a phone too. The command has no
  default hotkey, and acts on the table of the open cell or the one last open in this visit, so it
  still works after Obsidian's palette takes focus.
- **If a phone's route fails,** "Open as Markdown" and "Edit in Markdown" still reach every table.

## To check before building

1. **An iPhone's keyboard** stays up moving between cells by a tap and by Enter, and on Enter adding a
   row. It has only been checked on an Android emulator, between cells, where it held. This decides
   the approach: if it drops, the maintainer weighs that against the decision above.
2. **A selection from above the table into it,** by mouse and by touch.
3. **The command** from the palette, on an iPhone and on Android.
4. **Backspace in the first cell of an empty row,** and a Japanese input method's Enter in a cell, on both phones. The
   notes design's risk 5 is still open on an iPhone, and Enter here moves the caret.

## What a prototype showed

On macOS and an Android emulator: typing and Enter. On macOS also Tab, a `|`, undo and an input
method's composition. Each changed only the cell's text in the file. It didn't build the table's
elements, the row changes, the command, short rows or Escape's focus. It also showed what to get
right: row heights jump when a cell opens, and a cell changed by undo wasn't redrawn while another was
open.

## What changes in the notes design at the build

"What shows drawn" and "Big blocks", the risk that a drawn block shows its whole Markdown, and the
check that a click enters a drawn table.
