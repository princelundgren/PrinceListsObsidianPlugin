# Notes in one editor: checks

Plan [notes in one editor](../plans/2026-10-29-notes-in-one-editor.md), Task 9, Steps 1 and 2:
every manual check of Tasks 2 to 8 again, with the release build.

- **How they ran:** scripts run in a test vault, through Obsidian's CLI (`obsidian eval`) and the
  DevTools protocol on macOS and Windows, and through the web view's DevTools protocol and `adb` on
  an Android emulator. Clicks, keys and taps are real input events: CDP mouse and key events on the
  desktop, `adb` taps and key events on Android. The scripts read the files back byte for byte. The
  iPhone checks were run by hand.
- **Versions:** Obsidian 1.14.5 on macOS 27 and Windows 11, and 1.14.4 on Android 16. The plugin
  was built from `main` after #199 merged: `main.js` is 306,976 bytes.
- **Result:** 127 checks on macOS, 124 on Windows and 26 on Android pass, and the drawing scripts'
  output, read by eye, shows what the design says, the same on macOS and Windows. The Windows run
  found one bug, fixed in #199 before this build (below). Some older checks expected what the design
  has since changed, or sent the wrong keys on Windows, and were corrected rather than the plugin.
  One more is left failing on purpose (below).
- **Task 8** removed the block fields and added no check of its own: its hand check is the run of
  Tasks 2 to 7 here.

## macOS

- **Editing (Task 2), 41 checks, and 8 more on arrows, selection, clicks and Cmd+F:** a click
  focuses the editor and shows the bar, and leaving without typing writes nothing. Typing saves only
  its line, also in a CRLF file without a final newline. Enter continues a bullet, a numbered item
  (renumbering the rest) and a ticked checklist item unticked, and on an empty top-level item takes
  the marker off. Backspace after a new marker turns it into spaces, and a second takes them. Tab
  and Shift+Tab indent and outdent a list item by one tab, and Tab on a paragraph leaves the editor.
  The arrow keys move the caret across lines, Shift and the arrows select across them, and a double
  and a triple click select a word and a line. Cmd+Enter adds an item, Cmd+F opens the list's
  filter, Escape closes the card, and right-click opens no item menu. Cmd+Z, Cmd+Shift+Z, Cmd+B and
  the bar's buttons work in the editor, and after leaving, the list's Cmd+Z takes the visit back as
  one step. A refused change, a Backspace joining two lines among them, doesn't land, with one
  notice per visit, and Cmd+Z after it doubles nothing. An outside change shows in the focused
  editor, and one that takes the item locks it and says so. The same list in two panes stays in
  step. Switching apps keeps the visit.
- **Drawing (Task 3), 16 checks and a drawing script:** each mark, link, picture and bullet shows
  its Markdown only while the selection touches it, and headings, quotes and rules only on the
  caret's line. Nothing shows its Markdown once the editor loses focus. A click lands on the
  character clicked. An internal link opens, Cmd+click in a new tab, and a web link in the web
  viewer; a `javascript:` link opens nothing. A web picture draws with its alt and size, as in a
  note.
- **Checkboxes (Task 4), 18 checks:** in notes holding `%%`, each box ticks its own line, nested
  and numbered too, focused and not, with no `✔` date. Focused, focus and the caret stay and the
  editor's Cmd+Z takes the tick back. Unfocused, the editor stays unfocused and the list's Cmd+Z
  takes it back. A box in a quote shows as typed, and the caret touching a box shows its Markdown.
- **Blocks (Task 5), 17 checks:** a table, code, a callout, math, an embedded note, HTML and code
  in a list item draw with their Markdown hidden. A click or the arrow keys show a block's
  Markdown, with no jump in the card's scroll, and leaving draws it again. Typing elsewhere redraws
  no block. A box in a callout or an embedded note draws disabled, and a click on it shows the
  block and ticks nothing. A link in a callout opens, and a code block's copy button doesn't open
  the block. Taking an embed away unloads its widget's Component, and only that line leaves the
  file.
- **Pictures (Task 6), 13 checks:** a picture pasted in a paragraph, a list item, a table and the
  last paragraph goes after that block, or after the whole list, drawn, with the caret on the empty
  line below; a dropped one goes after the block under the pointer. Remove image on either of two
  pictures on one line takes out only its link, also with the caret on that line and in a drawn
  callout, and typing before a picture keeps it drawn and its menu working. Delete image trashes
  the file. In the list note, the menu removes a picture's link.
- **The list note (Task 7), 14 checks:** typing `- [ ] x` at the top level warns before it saves,
  and leaving draws `x` as a row; a nested one under a plain bullet saves without a warning. Enter
  continues a bullet, adding only that line. A table and a callout draw. A typed blank line at the
  end writes the blank line after the note once. Right-click opens no list menu. The format bar
  shows while focused, and Bold works. A box ticks focused or not, and focus stays. Cmd+Z after
  leaving takes back the whole visit. A pasted picture leaves the file as it was and saves no
  picture file.

## Android

With `adb` taps and the on-screen keyboard (Gboard):

- **Typing (Task 2), 6 checks:** a letter saves to its line, and Backspace deletes it. Enter
  continues a list. Backspace after a new marker turns it into spaces, and a second takes them.
  Enter on a paragraph line starts a new line, and Gboard capitalizes its first letter, as in a
  note.
- **Drawing (Task 3), read by eye and not counted:** the marks, links, a picture, a bullet, a
  quote, a rule and a heading draw unfocused. A tap on an internal link opens it without the
  keyboard, and a web link opens in the browser. A web picture loads with its size.
- **Checkboxes (Task 4), 8 checks:** unfocused, a tap ticks its own line and the keyboard stays
  down. Focused, it ticks its own line, and focus and the keyboard stay.
- **Blocks (Task 5), 5 checks:** seven blocks draw. A tap in a table shows its Markdown with the
  caret at its start and the keyboard up. A tap on a callout's box shows the callout, and leaving
  draws every block again.
- **Pictures (Task 6), 1 check:** a picture pasted in a list item goes after the list, drawn,
  with the caret on the empty line below and the keyboard up.
- **The list note (Task 7), 6 checks:** a tap brings up the keyboard. The format bar is one row
  that scrolls sideways. Gboard's Enter continues a bullet. Typing `- [ ] x` at the top level
  warns, and leaving draws it as a row. A tap on a box ticks it without focus or the keyboard.

## Windows

The macOS scripts, with Ctrl in place of Cmd. Every macOS check above passes but three left out
of the count: switching apps, which needs macOS's own app switching, and the two on typing before a
picture, which passed on the build before #199.

- **A right-click on a picture** opened no picture menu when the notes were unfocused and the caret
  was at the picture, inline or in a drawn callout: Windows opens the menu on release, after the
  press had focused the editor and shown the Markdown. Fixed in #199. With this build, the menu
  opens on both, on Windows and on macOS.

## iPhone

By hand, in a test vault: typing, Enter continuing a list, Backspace on an empty line, autocorrect
and dictation, ticking a box focused and not, and pasting and dropping a picture all work as on
the other platforms.

## Scripts corrected, not the plugin

- **Backspace after a new marker** on Android expected one Backspace to take the marker. The design
  ("Keys") turns it into spaces first, and a second Backspace takes them.
- **Gboard's capital** at the start of a new line: capitals are on in the notes, as in a note.
- **Ctrl+Shift+Z and Ctrl+click on Windows:** the scripts sent a lowercase `z` with Shift, where a
  keyboard sends `Z`, and the Mac's Cmd bit for the click. Sent as a keyboard and mouse send them,
  both pass.

## Left failing

- **An external link keeping Obsidian on the list** was Task 3's first expectation, and fails on
  macOS and Windows. Web links open since then, as the design says, and their own checks pass.

## Not checked

- **On the iPhone:** Enter on a Japanese keyboard that confirms a word, and a refused change in the
  middle of a word.
- **On Windows:** switching apps during a visit.
- **On desktop:** Enter on an empty nested list item, which moves it out.
- **On Android:** a picture dropped into the notes.
- **Linux.**
