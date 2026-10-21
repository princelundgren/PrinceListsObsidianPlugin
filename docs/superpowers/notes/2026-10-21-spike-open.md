# Spike 1: opening a list note in the list view

Plan step 1a, Task 2, Steps 7 to 10. The maintainer runs these checks by hand and fills in each
**Result** line. Until then, every check here is pending.

- **Build under test:** the commit of this pull request, built with `npm run build` and copied to
  the test vault with `npm run install-vault -- <path to the test vault>`.
- **Never use a vault with real notes** (`AGENTS.md`).
- **Fill in:** the Obsidian version on the Mac, and the Obsidian and iOS versions on the iPhone.
  - Mac: Obsidian
  - iPhone: Obsidian , iOS

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
   - **Result:**
2. Opening it from a link in another note shows the placeholder.
   - **Result:**
3. Opening it from the Quick switcher shows the placeholder.
   - **Result:**
4. Back, after opening it from another note, returns to that other note, not to this one as
   Markdown.
   - **Result:**
5. After "Open as Markdown", switching to another tab and back leaves this pane as Markdown.
   - **Result:**
6. Restarting Obsidian brings the pane back as the list view.
   - **Result:**
7. After deleting the frontmatter in Markdown, "Open as list" isn't offered, in the pane's ⋯ menu
   or in the command palette.
   - **Result:**
8. With a list open in the list view, open the same note as Markdown in a second pane and delete
   its `princelists: true` line. Expected: about 2 seconds after the edit, once the Markdown pane
   saves, the list pane switches to Markdown without an error in the developer console, and
   "Open as list" isn't offered for it.
   - The second pane switches to the list view when the note opens there, so choose "Open as
     Markdown" in it first.
   - **Result:**
9. Where the frontmatter ends, with LF and with CRLF line endings. Expected: `contentStartLine` is
   3 and `isListText` is `true` for both.
   - For this check only, and without committing it, add `getFrontMatterInfo` to the `obsidian`
     import in `src/main.ts`, and `contentStartLine` to its `./obsidian/marker` import. Then add
     this line at the start of `onload`, rebuild, and read the developer console:

     ```ts
     for (const text of ['---\nprincelists: true\n---\nNote', '---\r\nprincelists: true\r\n---\r\nNote']) console.log(JSON.stringify(text), getFrontMatterInfo(text).contentStart, contentStartLine(text), isListText(text));
     ```

   - **Result, LF:** `contentStart` = , `contentStartLine` = , `isListText` =
   - **Result, CRLF:** `contentStart` = , `contentStartLine` = , `isListText` =
10. After check 8, press Back in the pane that switched. Expected: the note's name, "This note
    isn't a list" and an "Open as Markdown" button. One more Back reaches the previous note, with
    no flicking between list and Markdown and no console error.
    - **Result:**
    - Then quit Obsidian with a list note open in the list view, remove its `princelists: true`
      line with another editor, and start Obsidian. Expected: the pane shows the same message and
      button, with no error. The button opens the note as Markdown.
    - **Result:**
11. After "Open as Markdown", "Open as list" is offered in the pane's ⋯ menu and in the command
    palette, opens the list view, and the pane stays a list after switching tabs and back.
    Right-clicking a link to `Spike list.md` offers no "Open as list".
    - **Result:**
12. Cmd+click `Spike list` in the file explorer, and Cmd+click the link in `Link test`, a note that
    links to `Spike list` (in Source mode, Cmd+Shift+click). Each opens a new tab in the list view.
    - **Result, file explorer:**
    - **Result, link:**

## Step 8: the iPhone

Repeat checks 1, 2, 4, 5 and 12 from Step 7, numbered as there.

- **Check 1:** opening it from the file explorer shows the placeholder.
  - **Result:**
- **Check 2:** opening it from a link in another note shows the placeholder.
  - **Result:**
- **Check 4:** Back, after opening it from another note, returns to that other note.
  - **Result:**
- **Check 5:** after "Open as Markdown", switching to another tab and back leaves this pane as
  Markdown.
  - **Result:**
- **Check 12:** opening it in a new tab from the long-press menu, in the file explorer and on the
  link in `Link test`, shows the placeholder. If the phone offers no way to open a new tab there,
  record that.
  - **Result, file explorer:**
  - **Result, link:**

## Step 9: a note from outside the vault, on the Mac

The design's "Notes outside the vault", in its implementation notes, says what each check is for.

1. **The installer.** Settings → General shows the installer version, with a notice when a newer
   one is available. Opening a file from outside the vault needs the latest installer, so update
   it before going on.
   - **Installer version:**
2. **The control,** with PrinceLists disabled. Copy `Spike list.md` to a folder outside any vault,
   open the copy as Markdown, and restart Obsidian. If Obsidian doesn't bring the copy back, check
   3.2 below doesn't apply: record it as Obsidian's behavior.
   - **Result:**
3. **With PrinceLists enabled,** open the copy with the command "Open file from outside the
   vault…".
   - For this check only, and without committing it, add this line at the top of the `file-open`
     handler in `src/obsidian/switch.ts`, then rebuild:

     ```ts
     console.log('file-open', file?.path, file ? plugin.app.vault.getAbstractFileByPath(file.path) === file : null);
     ```

   1. It opens as the placeholder.
      - **Result:**
   2. Restarting Obsidian brings it back as the list view.
      - **Result:**
   3. The logged value of `getAbstractFileByPath(file.path) === file` for the outside note.
      - **Result:**

Record each failure here with the design's proposed fallback, for the owner to decide in Step 10:

- **If 3.1 or 3.2 fails:** the proposed fallback is that outside notes open as Markdown, like
  ordinary notes.
- **If 3.3 logs `true`:** the lookup returns the outside note, so it can't tell outside notes
  apart, and the design's fallbacks rely on it. The alternative, `instanceof TExternalFile`, means
  raising `minAppVersion` to 1.14.4, which is the owner's call.
- **Failures and proposed fallbacks:**

## Step 10: checkpoint

The owner decides each point here. Nothing falls back before that decision.

- **The flash before the switch** (acceptable or not). If it's unacceptable, work stops here, and
  patching Obsidian's internals is not an option.
  - **Verdict:**
- **Back history.** If Step 7's check 4 failed, work stops and it's reported: that
  `result.history = false` keeps the entry out is observed only, not documented.
  - **Outcome:**
- **Each fallback that Step 9 proposed.**
  - **Decisions:**
