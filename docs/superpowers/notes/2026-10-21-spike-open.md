# Spike 1: opening a list note in the list view

Plan step 1a, Task 2, Steps 7 to 10. Every check passed on the final build, though check 12 on the
iPhone wasn't reported separately. The maintainer saw no flash on the Mac or the iPhone.

The Mac checks, Steps 7 and 9, ran in the test vault through Obsidian's own command-line interface
(`obsidian eval`, with `dev:cdp` for real clicks and keys). "Restart" in checks 6 and 10 was
closing and reopening the vault's window, and Step 9's check 3.2 was a full restart by the
maintainer. The maintainer ran the iPhone checks and judged the flash by eye.

- **Build under test:** the commit of this pull request, built with `npm run build` and copied to
  the test vault with `npm run install-vault -- <path to the test vault>`.
- **Never use a vault with real notes** (`AGENTS.md`).
- **Versions:**
  - Mac: Obsidian 1.14.4 (installer 1.14.4)
  - iPhone: not recorded

## Step 7: the Mac, in the test vault

First create `Spike list.md` in the test vault, containing:

```markdown
---
princelists: true
---
- [ ] a
```

1. Opening it from the file explorer shows the placeholder: its name as a heading, then
   "List view".
   - **Result:** pass.
2. Opening it from a link in another note shows the placeholder.
   - **Result:** pass, in reading view and in Live Preview.
3. Opening it from the Quick switcher shows the placeholder.
   - **Result:** pass, with the name typed and Enter.
4. Back, after opening it from another note, returns to that other note, not to this one as
   Markdown.
   - **Result:** pass. Back returns to the other note, and Forward goes straight to the list view.
5. After "Open as Markdown", switching to another tab and back leaves this pane as Markdown.
   - **Result:** pass, with "Open as Markdown" from the ⋯ menu.
6. Restarting Obsidian brings the pane back as the list view.
   - **Result:** pass.
7. After deleting the frontmatter in Markdown, "Open as list" isn't offered, in the pane's ⋯ menu
   or in the command palette.
   - **Result:** pass. It's offered in neither.
8. With a list open in the list view, open the same note as Markdown in a second pane and delete
   its `princelists: true` line. Expected: about 2 seconds after the edit, once the Markdown pane
   saves, the list pane switches to Markdown without an error in the developer console, and
   "Open as list" isn't offered for it.
   - The second pane switches to the list view when the note opens there, so choose "Open as
     Markdown" in it first.
   - **Result:** pass. About 2 seconds after the edit saves, the list pane switches to Markdown,
     with no console error, and "Open as list" isn't offered for it.
9. Where the frontmatter ends, with LF and with CRLF line endings. Expected: `contentStartLine` is
   3 and `isListText` is `true` for both.
   - For this check only, and without committing it, add `getFrontMatterInfo` to the `obsidian`
     import in `src/main.ts`, and `contentStartLine` to its `./obsidian/marker` import. Then add
     this line at the start of `onload`, rebuild, and read the developer console:

     ```ts
     for (const text of ['---\nprincelists: true\n---\nNote', '---\r\nprincelists: true\r\n---\r\nNote']) console.log(JSON.stringify(text), getFrontMatterInfo(text).contentStart, contentStartLine(text), isListText(text));
     ```

   - **Result, LF:** `contentStart` = 26, `contentStartLine` = 3, `isListText` = `true`
   - **Result, CRLF:** `contentStart` = 29, `contentStartLine` = 3, `isListText` = `true`
10. After check 8, press Back in the pane that switched. Expected: the note's name, "This note
    isn't a list" and an "Open as Markdown" button. One more Back reaches the previous note, with
    no flicking between list and Markdown and no console error.
    - **Result:** pass, after the maintainer's decision to show a message (design, "Opening a
      list"). The first build failed: Back landed on the same note's list view, which stayed a
      list. Now Back shows the message and the button, and a second Back reaches the previous
      note, with no flicking and no console error.
    - Then quit Obsidian with a list note open in the list view, remove its `princelists: true`
      line with another editor, and start Obsidian. Expected: the pane shows the same message and
      button, with no error. The button opens the note as Markdown.
    - **Result:** pass. The pane shows the message, with no error.
11. After "Open as Markdown", "Open as list" is offered in the pane's ⋯ menu and in the command
    palette, opens the list view, and the pane stays a list after switching tabs and back.
    Right-clicking a link to `Spike list.md` offers no "Open as list".
    - **Result:** pass. "Open as list" is offered in the ⋯ menu and in the palette, and it opens
      the list view, which stays after switching tabs. Right-clicking a link, or the note in the
      file explorer, offers no "Open as list".
12. Cmd+click `Spike list` in the file explorer, and Cmd+click the link in `Link test`, a note that
    links to `Spike list` (in Source mode, Cmd+Shift+click). Each opens a new tab in the list view.
    - **Result, file explorer:** pass.
    - **Result, link:** pass. The Quick switcher with Cmd+Enter passes too.
    - An earlier build left new tabs as Markdown, which the maintainer found. The switch has to
      wait until the tab's text has loaded (design, "Opening and switching views").

## Step 8: the iPhone

Repeat checks 1, 2, 4, 5 and 12 from Step 7, numbered as there.

- **Check 1:** opening it from the file explorer shows the placeholder.
  - **Result:** pass.
- **Check 2:** opening it from a link in another note shows the placeholder.
  - **Result:** pass.
- **Check 4:** Back, after opening it from another note, returns to that other note.
  - **Result:** pass.
- **Check 5:** after "Open as Markdown", switching to another tab and back leaves this pane as
  Markdown.
  - **Result:** pass.
- The maintainer reported checks 1, 2, 4 and 5 together: "iPhone is good".
- **Check 12:** opening it in a new tab from the long-press menu, in the file explorer and on the
  link in `Link test`, shows the placeholder. If the phone offers no way to open a new tab there,
  record that.
  - **Result:** not reported separately.

## Step 9: a note from outside the vault, on the Mac

The design's "Notes outside the vault", in its implementation notes, says what each check is for.

1. **The installer.** Settings → General shows the installer version, with a notice when a newer
   one is available. Opening a file from outside the vault needs the latest installer, so update
   it before going on.
   - **Installer version:** 1.14.4.
2. **The control,** with PrinceLists disabled. Copy `Spike list.md` to a folder outside any vault,
   open the copy as Markdown, and restart Obsidian. If Obsidian doesn't bring the copy back, check
   3.2 below doesn't apply: record it as Obsidian's behavior.
   - **Result:** pass. With PrinceLists disabled, the outside copy opened as Markdown, and after a
     full restart Obsidian brought it back.
3. **With PrinceLists enabled,** open the copy with the command "Open file from outside the
   vault…".
   - For this check only, and without committing it, add this line at the top of the `file-open`
     handler in `src/obsidian/switch.ts`, then rebuild:

     ```ts
     console.log('file-open', file?.path, file ? plugin.app.vault.getAbstractFileByPath(file.path) === file : null);
     ```

   1. It opens as the placeholder.
      - **Result:** pass.
   2. Restarting Obsidian brings it back as the list view.
      - **Result:** pass. After a full restart it came back as the list view, and it was still
        there 12 seconds later.
   3. The logged value of `getAbstractFileByPath(file.path) === file` for the outside note.
      - **Result:** `true`. The lookup returns the outside note, so it can't tell outside notes
        apart.

Record each failure here with the design's proposed fallback, for the owner to decide in Step 10:

- **If 3.1 or 3.2 fails:** the proposed fallback is that outside notes open as Markdown, like
  ordinary notes.
- **If 3.3 logs `true`:** the lookup returns the outside note, so it can't tell outside notes
  apart, and the design's fallbacks rely on it. The alternative, `instanceof TExternalFile`, means
  raising `minAppVersion` to 1.14.4, which is the owner's call.
- **Failures and proposed fallbacks:**
  - Opening needs no fallback.
  - 3.3 means the design's way of telling outside notes apart doesn't work. If a later check needs
    a fallback (rendering, writing or renaming, in Tasks 8 and 9), the maintainer decides then
    whether to raise `minAppVersion` to 1.14.4 for `instanceof TExternalFile`.

## Step 10: checkpoint

The owner decides each point here. Nothing falls back before that decision.

- **The flash before the switch** (acceptable or not). If it's unacceptable, work stops here, and
  patching Obsidian's internals is not an option.
  - **Verdict:** not visible on the Mac or the iPhone (the maintainer, 2026-10-21). Measured in the
    page: about 10 ms of Markdown before the list view, in the same tab or a new one, which is
    under one frame at 60 Hz.
- **Back history.** If Step 7's check 4 failed, work stops and it's reported: that
  `result.history = false` keeps the entry out is observed only, not documented.
  - **Outcome:** check 4 passed, so work goes on.
- **Each fallback that Step 9 proposed.**
  - **Decisions:**
    - Opening needs no fallback.
    - A note that loads in the list view without the marker shows a message (the maintainer's
      choice; design, "Opening a list").
    - `minAppVersion` stays 1.5.7.
