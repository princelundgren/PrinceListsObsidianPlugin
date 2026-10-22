# PrinceLists step 1a Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build part 1a of the PrinceLists Obsidian plugin. It covers the two spikes the spec puts
first, the full list view on the Mac, and the iPhone basics (open, tick, add, edit, the card's ⋯
actions and the heading menu).
It also covers creating lists. At the end it is installed in a vault with real notes so the
two-week trial can start.

**Architecture:**
- **A pure TypeScript core** (`src/core/`, no Obsidian imports) holds the file as a list of lines,
  finds sections and items with commonmark.js source positions, and does every edit as a
  whole-line replacement. It is unit-tested against fixtures.
- **A thin Obsidian layer** (`src/obsidian/`, `src/view/`) does the rest. It switches list notes
  into a `TextFileView` subclass, draws the list with Obsidian's DOM helpers, and writes one-off
  actions through a guarded `vault.process`.
- **Part 1b** (iPhone dragging, pasting pictures into a card, Cmd+Z undo) gets its own plan after
  Task 3's touch spike.

**Tech Stack:** TypeScript 6.0, esbuild 0.28 and ESLint 10 with `eslint-plugin-obsidianmd` (from
`obsidianmd/obsidian-sample-plugin`, updated in Task 1), `obsidian` 1.14.4 types, `commonmark`
0.31.x (runtime), `vitest` (tests only), GitHub Actions on Node 26.

**Spec:** `docs/superpowers/specs/2026-10-20-prince-lists-design.md` (approved 2026-10-20). Read it
first. This plan cites its sections by heading.

**How work lands:**
- The repo is open source (MIT). `AGENTS.md` holds the rules every change follows, and
  `CONTRIBUTING.md` the pull request process.
- Each task lands as its own pull request, and the owner squash-merges it. The squash uses the
  pull request's title and description as the commit message, so "Commit with the message X"
  means the pull request's title is X. Details meant for `main`, such as the sample plugin's SHA,
  go in the pull request description.
- Each task's pull request checks the design against the change and updates it, or says in one
  line that it still holds (`AGENTS.md`, "Keep the design true").
- **`<test vault>`** below means the path to a test vault on the Mac that holds no real notes and
  syncs to the iPhone. **`<everyday vault>`** means the path to the vault with real notes where
  the two-week trial runs.

## Global Constraints

- **Obsidian APIs:**
  - Documented Obsidian APIs only: no monkey-patching, no `(app as any)` calls, no reaching into
    Obsidian's own DOM.
  - No Node.js or Electron APIs anywhere in `src/`. `manifest.json` has `"isDesktopOnly": false`.
- **The manifest and its IDs:**
  - `manifest.json`: `"id": "princelists"`, `"name": "PrinceLists"`, `"minAppVersion": "1.5.7"`
    (the newest API used is `getFrontMatterInfo`, `@since 1.5.7`; spec, "Verified facts"),
    `"version": "0.1.0"`.
  - View type `princelists-view`. Command IDs (stable once released): `new-list`, `open-as-list`,
    `open-as-markdown`. No default hotkeys.
- **The file format:**
  - The marker is frontmatter `princelists: true`. Only the YAML boolean `true` counts.
  - The completion stamp is `✔ YYYY-MM-DD HH:mm`, in local time on a 24-hour clock, written as
    U+2714 with no U+FE0F.
  - The archive delay is exactly 24 hours (`86_400_000` ms). It is fixed, with no setting and no
    settings tab.
- **Writing to files:**
  - Never rebuild the file. An edit replaces whole lines and keeps the file's line endings and
    its final-newline state. A line that moves off the end of the file takes `dominantEol`, and
    the line that becomes last takes the old last line's ending.
  - Never call `String.prototype.normalize` in `src/`. Tests may, to build NFD input.
  - No background writes. Write only in response to a user action (in the view, or a command,
    ribbon icon or menu item such as New list), and never on open, close or a timer.
- **The UI:**
  - No UI framework. Use only Obsidian CSS variables and `setIcon` (Lucide); no hard-coded
    colors.
  - Interface text is in sentence case. Menu, command and button labels, and the list view's
    message, are exactly these: "New list", "Open as list", "Open as Markdown",
    "This note isn't a list", "Show archived", "New item below", "New heading below", "New item",
    "Item actions", "Delete", "Rename heading", "Delete heading", "Undo". The icon-only "+" and ⋯
    buttons get the accessible names (`aria-label`) "New item" and "Item actions".
- **Dependencies:** the only runtime dependency is `commonmark`.
- **Privacy:** no telemetry, and no network requests unless one is agreed on in an issue first
  (the design's privacy rule).
- **Code layout:**
  - Keep each file under about 300 lines.
  - `src/main.ts` holds the plugin lifecycle only.
  - Listeners on the workspace, vault, metadata cache, `window` or `document` use
    `registerEvent` or `registerDomEvent`. Listeners on the view's own elements use one delegated
    listener per container, registered once.

## Review Focus

1. **A list changed on the iPhone through Sync while you're typing in it on the Mac.** The text
   you're typing must survive, and the redraw must show the phone's change (Task 7a's `mapLine`
   test, Task 9 manual check 3).
2. **Items pasted by hand from another app,** with `*` bullets, notes indented by 4
   spaces, or CRLF line endings. They must parse as items with notes, and nothing may be lost
   (Task 6 fixture, Task 1 CRLF test).
3. **A list with hundreds of items.** It must open and scroll without lag on the iPhone, and
   parsing 1500 items must take under 1 s (Task 6 test, Task 8 manual check).
4. **Accented letters, emoji and NFD text** in titles and notes must round-trip byte for byte
   (Task 1 test, Task 7a test).
5. **Other plugins' code blocks** (```` ```tasks ```` queries, Kanban or Excalidraw embeds) in the
   list note or between items must be left alone and never read as items (Task 6 fixture).

---

### Task 1: Project scaffold, line model and CI

**Files:**
- Create: `package.json`, `package-lock.json`, `.npmrc`, `version-bump.mjs`, `tsconfig.json`,
  `esbuild.config.mjs`, `eslint.config.mts`, `manifest.json`, `versions.json`, `styles.css`,
  `src/main.ts`, `src/core/lines.ts`, `tests/core/lines.test.ts`, `scripts/install.mjs`,
  `.github/workflows/ci.yml`
- Modify: `CONTRIBUTING.md`, `AGENTS.md`, `.github/dependabot.yml`,
  `docs/superpowers/specs/2026-10-20-prince-lists-design.md` (header only)

**Interfaces:**
- Produces:
  - `interface Line { text: string; eol: "" | "\n" | "\r\n" | "\r" }`
  - `splitLines(text: string): Line[]`
  - `joinLines(lines: readonly Line[]): string`
  - `dominantEol(lines: readonly Line[]): "\n" | "\r\n"`
  - `lineIndexAt(text: string, offset: number): number`
  - all from `src/core/lines.ts`

- [ ] **Step 1: Copy the scaffold.** Copy `package.json`, `tsconfig.json`, `esbuild.config.mjs`,
  `eslint.config.mts`, `.npmrc` and `version-bump.mjs` from `obsidianmd/obsidian-sample-plugin`
  `master`. Record the commit SHA in the pull request description.
  - Move `typescript` to `~6.0.3`. Not 7.x: TypeScript 7.0 ships no compiler API (one is planned
    for 7.1). The tilde keeps it inside typescript-eslint's supported range, `>=4.8.4 <6.1.0`.
  - In `tsconfig.json`, make these two changes for TypeScript 6:
    - Set `"moduleResolution": "bundler"`. The sample's `"node"` means `node10`, which TypeScript
      6 rejects with error TS5107.
    - Add `"types": ["node"]`. TypeScript 6 defaults `types` to `[]`, so `@types/node` is no
      longer loaded. Without it, `npm run lint` fails with `no-unsafe-assignment` at
      `tsconfigRootDir: import.meta.dirname` in `eslint.config.mts`, because typescript-eslint
      checks that file with `tsconfig.json`'s options (`projectService.defaultProject`). Tests
      need it too, to read fixtures with `node:fs`.
  - Bump `eslint` to `^10.13.0`. ESLint 9 reached end of life on 2026-08-06.
  - Keep the sample's `@eslint/js ^9.39.4`. `eslint-plugin-obsidianmd` still declares the peer
    `@eslint/js ^9.30.1`
    ([obsidianmd/eslint-plugin#144](https://github.com/obsidianmd/eslint-plugin/issues/144)),
    and `eslint.config.mts` doesn't import it. `^10.0.1` also installs and lints the same, so move
    to it once the plugin's peer allows 10.
  - `npm install` warns that `eslint@9.39.5` is deprecated. That's expected:
    `eslint-plugin-obsidianmd` 0.4.2 installs ESLint 9 for itself, because the import, React and
    SDL plugins it uses declare `eslint` peers that stop at 9. `npm run lint` runs ESLint 10 and
    lints the same without it, so leave it until the plugin drops it.
  - Bump `esbuild` to `^0.28`: vitest 5.0.5 pulls in vite 8.3.4, which needs esbuild
    `^0.27 || ^0.28`, and the sample pins `0.25.5`.
  - Pin `"obsidian": "1.14.4"`, not `latest`.
  - No other sample file needs a change for these versions: `esbuild.config.mjs` and
    `version-bump.mjs` run as they are on Node 26.
  - Set `name` to `princelists`, `version` to `0.1.0`, `license` to `MIT`, and `description` to
    the manifest description below.
  - Add `"test": "vitest run --dir tests"`. `--dir tests` keeps vitest out of `scripts/`, where
    it would collect the docs check's `node:test` file, `scripts/check-docs.test.mjs`, and fail
    on it.
  - Add the dependency `commonmark@^0.31.2`, and the dev dependencies `@types/commonmark` and
    `vitest`.
  - Run `npm install`, which writes `package-lock.json`. Commit it, because CI runs `npm ci`.
  - Add `tests/**/*.ts` to `tsconfig.json`'s `include`.
  - Add `'scripts/**'` to `eslint.config.mts`'s `globalIgnores`, as the sample does for its own
    `.mjs` files.
  - After `...obsidianmd.configs.recommended` in `eslint.config.mts`, add a config object with
    `files: ['tests/**']` that sets `'obsidianmd/no-nodejs-modules': 'off'`. Tests aren't shipped,
    and they read fixtures with `node:fs`, which that rule warns about. `src/` keeps the rule.
  - Change the `lint` script to `eslint . --max-warnings 0`, so any warning fails `npm run lint`,
    on a contributor's machine as in CI. The owner decided this on 2026-10-20:
    `obsidianmd/no-nodejs-modules` only warns, and `AGENTS.md`'s rule that the plugin must work on
    mobile needs CI to enforce it.
  - Write `manifest.json` with the Global Constraints values, plus
    `"description": "Todo lists on plain Markdown notes, with sections, item notes and drag and drop."` and
    `"author": "Prince Lundgren"`.
  - `versions.json` is `{"0.1.0": "1.5.7"}`.
- [ ] **Step 2: Write `src/main.ts`** as an empty `Plugin` subclass with `onload() {}`, and
  `styles.css` with one comment line and nothing else, so the spec's `governs` matches a tracked
  file.
- [ ] **Step 3: Write `scripts/install.mjs <vault-path>`.** It copies `main.js`, `manifest.json` and
  `styles.css` into `<vault-path>/.obsidian/plugins/princelists/`, creates the folder if missing,
  and exits 1 with a usage line when no argument is given. Add the script
  `"install-vault": "node scripts/install.mjs"`.
- [ ] **Step 4: Write the failing tests** in `tests/core/lines.test.ts`:

```ts
import { expect, test } from "vitest";
import { dominantEol, joinLines, lineIndexAt, splitLines } from "../../src/core/lines";

test("round-trips every line-ending shape byte for byte", () => {
  for (const t of ["", "a", "a\n", "a\r\nb\r\n", "a\nb\r\nc\rd", "\n\n", "x\n\n"]) {
    expect(joinLines(splitLines(t))).toBe(t);
  }
});
test("keeps NFD text untouched", () => {
  const nfd = "Crème brûlée à la carte".normalize("NFD");
  expect(joinLines(splitLines(nfd + "\n"))).toBe(nfd + "\n");
});
test("splitLines records the missing final newline", () => {
  expect(splitLines("a\nb")).toEqual([{ text: "a", eol: "\n" }, { text: "b", eol: "" }]);
});
test("dominantEol picks CRLF for a CRLF file and LF when there are no endings", () => {
  expect(dominantEol(splitLines("a\r\nb\r\nc\n"))).toBe("\r\n");
  expect(dominantEol(splitLines("a"))).toBe("\n");
});
test("lineIndexAt maps a character offset to its line", () => {
  expect(lineIndexAt("ab\ncd\nef", 4)).toBe(1);
  expect(lineIndexAt("---\nx: 1\n---\nbody", 13)).toBe(3);
  expect(lineIndexAt("---\nx: 1\n---", 12)).toBe(3); // an offset at the end maps past the last line
});
```

- [ ] **Step 5: Run** `npm test`. Expected: FAIL, with "Cannot find module
  '../../src/core/lines'".
- [ ] **Step 6: Implement `src/core/lines.ts`.** Split on `\r\n`, `\n` and a lone `\r`, in that
  order of precedence. `splitLines("")` is `[]`.
- [ ] **Step 7: Run** `npm test && npm run lint && npm run build`. Expected: all pass, and
  `main.js` exists.
- [ ] **Step 8: Write `.github/workflows/ci.yml`.** On pushes to `main` and on pull requests, it
  runs `npm ci`, `npm run lint`, `npm run build` and `npm test` on `ubuntu-latest` with Node 26.
  These are `docs.yml`'s triggers without its `edited` type, which only its pull request text
  check needs. A push to a pull request's branch then runs CI once, not twice.
  Node 26 is Active LTS from 2026-10-28, and Node 24 has been in maintenance since 2026-10-20.
  - The test step sets `env: TZ: America/New_York`, so code that works in local time, such as
    `formatStamp` and the archived rule, is tested at an offset from UTC with daylight saving
    time.
  - Pull requests run it, so it follows the read-only pattern of the docs check's
    `.github/workflows/docs.yml`, not the release workflow's: `permissions: contents: read`,
    `actions/checkout@v7` with `persist-credentials: false`, and `actions/setup-node@v7` with
    `node-version: 26` and no `cache`.
  - In `CONTRIBUTING.md`, replace "For now it checks the docs and the pull request's title and
    description; the plugin's lint, build and tests join it with the project scaffold." with "It
    runs the plugin's lint, build and tests, and checks the docs and the pull request's title and
    description." In its Development setup, drop the last sentence, "The docs check works now…".
  - Add an `npm` entry to `.github/dependabot.yml`, weekly, and delete its first line, "# npm is
    added when package.json arrives with the project scaffold."
  - In `AGENTS.md`, replace the line above the npm commands table, "These are available once the
    project scaffold from plan Task 1 has landed:", with "The project's npm commands:". Under
    "Before opening a pull request", drop " (after plan Task 1's scaffold)".
- [ ] **Step 9: Mark the spec as being built.** Set its header to `status: building` and add
  `governs: [src/**, styles.css, manifest.json]`. Leave out `verified`.
- [ ] **Step 10: Install and check in Obsidian.** Run
  `npm run install-vault -- <test vault>`, enable **PrinceLists** in the test vault, and check the
  developer console (Cmd+Opt+I). Expected: no errors.
- [ ] **Step 11: Commit** with the message "Scaffold the plugin with a line model that
  round-trips any file", and open the pull request. Check that the CI run is green.
- [ ] **Step 12: After it's merged, have the owner add the CI job to the `main` ruleset's required
  status checks,** next to the docs check's `docs` job, so later pull requests can't merge with
  failing tests.

### Task 2: Open list notes in the list view (spike 1: the flash and Back history)

**Files:**
- Create: `src/constants.ts`, `src/obsidian/marker.ts`, `src/obsidian/switch.ts`,
  `src/view/list-view.ts`, `src/core/frontmatter.ts`, `tests/core/frontmatter.test.ts`,
  `docs/superpowers/notes/<date>-spike-open.md`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `lineIndexAt`.
- Produces:
  - `VIEW_TYPE_LIST = "princelists-view"`, `MARKER_KEY = "princelists"` and
    `RIBBON_ICON = "list-checks"`, in `src/constants.ts`.
  - `isMarkerValue(yaml: unknown): boolean`, in `src/core/frontmatter.ts`. It is true only when
    `yaml` is an object whose `princelists` property is `=== true`.
  - `isListText(text: string): boolean` and `contentStartLine(text: string): number`, in
    `src/obsidian/marker.ts`. Both use `getFrontMatterInfo` and `parseYaml`; frontmatter counts
    only when `from` is right after a leading `---` at offset 0. `isListText` returns `false`
    when `parseYaml` throws. `contentStartLine` is `lineIndexAt(text, info.contentStart - 1) + 1`,
    the line after the closing `---`, whichever side of that line's break `contentStart` falls
    on, and 0 when no frontmatter counts. A file that is only frontmatter has `contentStartLine`
    equal to its line count, so it has no list note to overwrite.
  - `class PrinceListView extends TextFileView`, with a field `text: string` that holds the exact
    file text, and `getViewType()` returning `VIEW_TYPE_LIST`. `text` is separate from the
    inherited `TextFileView.data` because it holds each keystroke, for `getViewData` and
    Obsidian's merge.
  - From `src/obsidian/switch.ts`:
    - `registerAutoSwitch(plugin: Plugin): void`
    - `openAsList(leaf: WorkspaceLeaf, file: TFile): Promise<void>`
    - `openAsMarkdown(leaf: WorkspaceLeaf, file: TFile): Promise<void>`

- [ ] **Step 1: Write the failing tests** for `isMarkerValue`. It returns true for
  `{princelists: true}`. It returns false for `{princelists: "true"}`, `{princelists: false}`,
  `null`, `"princelists: true"` and `{}`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement `isMarkerValue`, and expect PASS.
- [ ] **Step 3: Implement `PrinceListView`.**
  - `getViewData()` returns `this.text`.
  - `setViewData(data, clear)` sets `this.text` and re-renders. With the marker, it shows a
    placeholder: the file's basename in an `h2`, plus a line that reads "List view". Without it
    (owner, 2026-10-21; spec, Implementation notes, "Opening and switching views"):
    - On a reload (`clear` is `false`), it switches the pane to Markdown with `leaf.setViewState`
      directly, not through `openAsMarkdown`, so the note doesn't join `markdownChosen`: the user
      didn't choose Markdown.
    - On a load (`clear` is `true`), it doesn't switch. It shows the basename in an `h2`, then
      "This note isn't a list", then a button "Open as Markdown" that calls `openAsMarkdown` for
      this pane. The button uses one delegated listener on the view's container.
  - `clear()` empties `this.text`.
  - Leave `canAcceptExtension` at its default.
  - In `setState(state, result)`, call super and then set `result.history = false` (spec,
    Implementation notes, "Opening and switching views").
- [ ] **Step 4: Implement `registerAutoSwitch`** exactly as the spec's Implementation notes,
  "Opening and switching views", describe it:
  - Listen to `file-open` and `active-leaf-change`, and run one guarded check on both:
    - `getActiveViewOfType(MarkdownView)` shows the file (on `file-open`, `view.file === file`);
    - the user hasn't chosen Markdown for that file in that leaf: a module-level
      `WeakMap<WorkspaceLeaf, WeakSet<TFile>>` named `markdownChosen` (owner, 2026-10-21: the
      choice holds per note in a pane, not for the whole pane; keyed by the file, so it survives a
      rename);
    - `view.data` is set, meaning the text has loaded;
    - `isListText(view.getViewData())`, the editor's text, because `data` waits for the save and
      would still hold a marker the user just deleted.
  - Then call `openAsList`. The first event that finds the text loaded switches. A switch made
    while the leaf is still loading is ignored, and a new tab fires `active-leaf-change` once before
    its text loads and once after (observed in 1.14.4).
  - `openAsMarkdown` adds the file to the leaf's set in `markdownChosen`. `openAsList` removes it.
- [ ] **Step 5: Wire up the view in `main.ts`.**
  - Call `registerView(VIEW_TYPE_LIST, …)` and `registerAutoSwitch`.
  - Add the commands `open-as-list` and `open-as-markdown`. Each is offered only when it applies,
    using `checkCallback`.
  - Add the view's ⋯ items with an `onPaneMenu` override: "Open as Markdown".
  - Add "Open as list" through `file-menu`, filtered on `leaf?.view instanceof MarkdownView` and
    `isListText`.
  - Any code that reaches into `leaf.view` first checks `instanceof PrinceListView` or
    `instanceof MarkdownView`, because background tabs may be deferred views after a restart.
- [ ] **Step 6: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 7: Check it by hand in the test vault on the Mac.** First create `Spike list.md` containing
  `---\nprincelists: true\n---\n- [ ] a`. Then check:
  1. Opening it from the file explorer shows the placeholder.
  2. Opening it from a link in another note shows the placeholder.
  3. Opening it from the Quick switcher shows the placeholder.
  4. Back, after opening it from another note, returns to that other note, not to this one as
     Markdown.
  5. After "Open as Markdown", switching to another tab and back leaves this pane as Markdown.
     Opening another list in that tab shows it as a list.
  6. Restarting Obsidian brings the pane back as the list view.
  7. After deleting the frontmatter in Markdown, "Open as list" isn't offered.
  8. With a list open in the list view, open the same note as Markdown in a second pane and
     delete its `princelists: true` line. Expected: about 2 seconds after the edit, once the
     Markdown pane saves, the list pane switches to Markdown without an error in the developer
     console, and "Open as list" isn't offered for it.
  9. For this check only, log `getFrontMatterInfo(text).contentStart`, `contentStartLine(text)`
     and `isListText(text)` at `onload` for `---\nprincelists: true\n---\nNote` and for the
     same text with CRLF endings, and don't commit the logging. Expected: `contentStartLine` is 3
     and `isListText` is `true` for both. Record both `contentStart` values in the notes file.
  10. After check 8, press Back in the pane that switched. Expected: the note's name, "This note
      isn't a list" and an "Open as Markdown" button. One more Back reaches the previous note, with
      no flicking between list and Markdown and no console error. Also, after a restart with a
      list note whose marker was removed outside Obsidian, the pane shows the same message, with
      no error.
  11. After "Open as Markdown", "Open as list" is offered in the pane's ⋯ menu and in the command
      palette, opens the list view, and the pane stays a list after switching tabs and back.
      Right-clicking a link to `Spike list.md` offers no "Open as list".
  12. Cmd+click `Spike list` in the file explorer, and Cmd+click the link in `Link test`, a note
      that links to `Spike list` (in Source mode, Cmd+Shift+click). Each opens a new tab in the
      list view.
- [ ] **Step 8: Repeat checks 1, 2, 4, 5 and 12 on the iPhone.** For check 12, open each in a new
  tab from its long-press menu. If the phone offers no way to do that, record it.
- [ ] **Step 9: Check a note from outside the vault on the Mac** (spec, Implementation notes,
  "Notes outside the vault").
  - First check the installer: Settings → General shows the installer version, with a notice when
    a newer one is available. Opening a file from outside the vault needs the latest installer,
    so update it before going on.
  - Copy `Spike list.md` to a folder outside any vault. As a control, with PrinceLists disabled,
    open the copy as Markdown and restart Obsidian. If Obsidian doesn't bring it back, check 2
    below doesn't apply: record it as Obsidian's behavior.
  - With PrinceLists enabled, open the copy with the command "Open file from outside the vault…".
    For this check only, log at the top of the `file-open` handler whether
    `app.vault.getAbstractFileByPath(file.path) === file`, and don't commit the logging. Check:
    1. It opens as the placeholder.
    2. Restarting Obsidian brings it back as the list view.
    3. Record the logged value in the notes file.
  - Record each failure in the notes file with the spec's proposed fallback, for Step 10. If check
    1 or 2 fails, that's opening outside notes as Markdown. If the lookup returns the outside
    note, say so: the spec's fallbacks rely on telling outside notes apart that way.
- [ ] **Step 10: CHECKPOINT. The owner judges the flash before the switch.** Record the verdict and
  check results in `docs/superpowers/notes/<date>-spike-open.md`.
  - If it's unacceptable, stop. The owner decides, and patching internals is not an option.
  - The owner decides on each fallback that Step 9 proposes. Nothing falls back before that.
  - If Step 7's check 4 fails, stop and report: `result.history = false` is the observed-only
    assumption.
- [ ] **Step 11: Commit** with the message "Open list notes in a list view with documented APIs
  only". Include the notes file.

### Task 3: Spike 2, hold-to-drag on the iPhone (throwaway)

**Files:**
- Branch `spike/touch-drag`, never merged.
- Create, in a pull request of its own: `docs/superpowers/notes/<date>-spike-touch.md`.

- [ ] **Step 1: Build 40 dummy rows.** On a branch, make the placeholder view render 40 rows. Use
  the Pointer Events approach in the spec's Implementation notes, "Touch on the iPhone":
  - a 500 ms hold timer, canceled if the finger moves more than 5 px first
  - once a drag is armed, a non-passive `touchmove` handler that calls `preventDefault`
  - a capture-phase `contextmenu` handler on the rows that cancels Obsidian's synthesized
    long-press menu
  - a row that follows the finger and drops into a new position (in memory only, writing
    nothing)
- [ ] **Step 2: Install in the test vault.** The owner then tests on the iPhone:
  1. A quick swipe scrolls the list.
  2. Holding about half a second and then moving drags the row smoothly, and dropping reorders it.
  3. Holding still never opens a menu, the text magnifier or a text selection.
  4. A tap is still a tap.
  5. Scrolling right after a drop still works.
- [ ] **Step 3: CHECKPOINT. The owner sets the pass bar.** Write the notes file: what worked, the
  timings used, what felt wrong, and the owner's verdict. The 1b plan is built from this file.
- [ ] **Step 4: Commit** the notes file on a new branch from `main` with the message "Record the
  iPhone touch-drag spike", and open it in a pull request of its own. Delete the spike branch.

### Task 4: Item line rules

**Files:**
- Create: `src/core/item-line.ts`, `tests/core/item-line.test.ts`

**Interfaces:**
- Produces:
  - ```ts
    interface ItemLineParts {
      before: string;      // up to and including "[", e.g. "- [" or "12. ["
      status: string;      // one character
      afterStatus: string; // "] "
      title: string;
      marks: string;       // the run of ✔ fields right before the tail, including the leading
                           // space, or ""
      tail: string;        // trailing Tasks fields, #tags, block ID and trailing whitespace,
                           // verbatim, or ""
    }
    ```
  - `parseItemLine(text: string): ItemLineParts | null`, which returns `null` for a line that
    isn't a task line.
  - `joinItemLine(p: ItemLineParts): string`
  - `isDoneStatus(status: string): boolean`, which is true when `status !== " "`.
  - `formatStamp(d: Date): string`, giving `"✔ 2026-10-20 23:55"`.
  - `tickLine(text: string, now: Date): string`
  - `untickLine(text: string): string`
  - `setTitle(text: string, title: string): string`
  - `isRepeating(text: string): boolean`
  - `TASKS_SIGNIFIERS`, the 18 emoji from the spec's "Where `✔` goes".
  - `MARK_PATTERN`, a `RegExp` without the `g` flag that matches one `✔` mark, as Step 3 defines
    it. A caller that needs every match uses a copy with the flag,
    `new RegExp(MARK_PATTERN, "g")`, so no shared `lastIndex` carries over between calls.
  - `markTime(mark: string): Date | null`, for one `✔` mark or one `✅ YYYY-MM-DD` field:
    - `✔ YYYY-MM-DD HH:mm` gives that local time.
    - A date-only `✔`, or a `✅`, gives that day at 23:59:59.999 local time.
    - A date or time that doesn't exist, such as `✔ 2026-13-01`, gives `null`.

- [ ] **Step 1: Write the failing tests** with these exact pairs (`now = new Date(2026, 9, 20, 23, 55)`):

| Call | Input | Expected |
|---|---|---|
| `tickLine` | `- [ ] cutting board` | `- [x] cutting board ✔ 2026-10-20 23:55` |
| `tickLine` | `- [ ] storage boxes ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123` | `- [x] storage boxes ✔ 2026-10-20 23:55 ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123` |
| `tickLine` | `* [ ] a 🔼` | `* [x] a ✔ 2026-10-20 23:55 🔼` |
| `tickLine` | `- [ ] a ✔ 2026-10-19 10:00` | `- [x] a ✔ 2026-10-20 23:55` |
| `untickLine` | `- [x] a ✔ 2026-10-20 23:55 ✅ 2026-10-20 📅 2026-10-30` | `- [ ] a 📅 2026-10-30` |
| `untickLine` | `- [X] a` | `- [ ] a` |
| `setTitle(…, "b")` | `- [ ] a ✔ 2026-10-19 10:00 📅 2026-10-30` | `- [ ] b 📅 2026-10-30` (a leftover mark on an open line is dropped) |
| `setTitle(…, "b")` | `- [x] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00` | `- [x] b ✔ 2026-10-20 09:00` (the earliest is kept) |
| `setTitle(…, "b")` | `- [x] a ✔ 2026-10-20 ✔ 2026-10-20 09:00` | `- [x] b ✔ 2026-10-20 09:00` (a date-only mark means the end of its day) |
| `isRepeating` | `- [ ] a 🔁 every week 📅 2026-10-30` | `true` |
| `parseItemLine` | `- [ ] a ✔\uFE0F 2026-10-20 10:00` | `marks` is `" ✔\uFE0F 2026-10-20 10:00"` (U+FE0F accepted) |
| `parseItemLine` | `- bullet`, `## h`, `-[ ] x`, `- [ab] x` | `null` |
| `markTime` | `✔ 2026-10-20 09:07` | `new Date(2026, 9, 20, 9, 7)` |
| `markTime` | `✔ 2026-10-20` | `new Date(2026, 9, 20, 23, 59, 59, 999)` |
| `markTime` | `✅ 2026-10-20` | `new Date(2026, 9, 20, 23, 59, 59, 999)` |
| `markTime` | `✔ 2026-13-01` | `null` |

  Also test that `joinItemLine(parseItemLine(t)!) === t` for every input above that parses, and
  that `setTitle(t, parseItemLine(t)!.title) === t` for lines with no doubled or leftover marks.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Marks:** a mark is `✔\uFE0F? +\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?`. A `✔` followed by
    anything else is title text. `setTitle`'s collapse keeps the mark with the earliest time that
    `markTime` can read, and the first mark when it can read none. A `null` time never counts as
    earliest.
  - **Building `tail`:** strip from the end of the line, in this order:
    1. trailing whitespace, because Tasks trims the line before it strips the block link
    2. a trailing ` ^[A-Za-z0-9-]+`
    3. repeatedly, a Tasks field or `#tag`, using the field patterns ported from Tasks'
       `src/TaskSerializer/DefaultTaskSerializer.ts` at the `8.6.0` tag, the release the spec
       verified, including 🔁's free-text value. Port from the tag, not `main`, which keeps
       moving; the file at the tag is byte-identical to `main` at `fa04fc1`. Cite the file, the
       tag and Tasks' MIT license in a comment.
  - **The `⛔` pattern stays linear:** Tasks' id list also allows spaces after each id, which
    backtracks exponentially on a long line. Leave those out: the text is trimmed first, so the
    pattern accepts the same lines.
  - **Where marks go:** they are matched right before `tail`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with the message "Parse and edit item lines without breaking Tasks
  fields".

### Task 5: The archived rule

**Files:**
- Create: `src/core/archive.ts`, `tests/core/archive.test.ts`
- Modify: `src/core/item-line.ts`

**Interfaces:**
- Consumes: `parseItemLine`, `isDoneStatus`, `MARK_PATTERN` and `markTime`.
- Produces:
  - `DONE_DATE_PATTERN`, in `src/core/item-line.ts`: Task 4's internal `DONE_DATE_FIELD`, Tasks'
    `✅ YYYY-MM-DD` field, exported without the `g` flag.
  - `ARCHIVE_DELAY_MS = 86_400_000`
  - `type DoneAt = { kind: "at"; time: Date } | { kind: "longAgo" }`
  - `doneAt(text: string, now: Date): DoneAt | null`, which returns `null` for an open line or a
    line that isn't a task.
  - `isArchived(text: string, now: Date): boolean`

- [ ] **Step 1: Write the failing tests.** Use local times, with `now = new Date(2026, 9, 20, 12, 0)`
  unless a row says otherwise:

| Line | Expected |
|---|---|
| `- [x] a ✔ 2026-10-20 11:00` | `at` 2026-10-20 11:00. Archived at now 2026-10-21 11:00, not at 2026-10-21 10:59. |
| `- [x] a ✔ 2026-10-19` | `at` 2026-10-19 23:59:59.999. Not archived at now; archived at 2026-10-21 00:00. |
| `- [x] a ✅ 2026-10-19` | the same as the row above |
| `- [x] a` | `longAgo`, archived |
| `- [x] a ✔ 2026-13-45 10:00` | `longAgo` |
| `- [x] a ✔ 2026-10-22 12:00` | `longAgo` (more than 24 h ahead) |
| `- [x] a ✔ 2026-10-21 11:00` | `at` that time (23 h ahead), not archived |
| `- [x] a ✔ 2026-10-21 12:00` | `at` that time (exactly 24 h ahead), not archived |
| `- [x] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00` | `at` 09:00 |
| `- [x] a ✔ 2026-10-20 09:00 ✔ 2026-13-45 10:00` | `at` 09:00 (the unreadable mark is skipped) |
| `- [x] a ✔ 2026-10-20 09:00 ✅ 2026-10-19` | `at` 2026-10-19 23:59:59.999 (the earliest) |
| `- [ ] a ✔ 2026-10-19 10:00` | `null` |
| `- [-] a`, `- [/] a`, `- [X] a` | `longAgo` (any non-space status is done) |

- [ ] **Step 2: Export `DONE_DATE_PATTERN`.** In `src/core/item-line.ts`, export the existing
  `DONE_DATE_FIELD` pattern as `DONE_DATE_PATTERN`, without the `g` flag. `untickLine` keeps
  removing every `✅` field, with a copy that has the flag.
- [ ] **Step 3: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
  - `doneAt` finds each `✔` mark in `marks` with `MARK_PATTERN` and each `✅` field in `tail`
    with `DONE_DATE_PATTERN`, and times every one with `markTime`. It reads no date itself, so
    the end-of-day rule lives only in `markTime`. The pattern also matches the spaces before
    `✅`, and `markTime` gives `null` for them, so trim each match first.
  - A mark is readable when `markTime` doesn't give `null` and the time is no more than 24 h
    after `now`. `doneAt` gives `at` the earliest readable time, and `longAgo` only when no mark
    is readable, including a done line with no mark at all.
- [ ] **Step 4: Commit** with the message "Work out when a done item is archived".

### Task 6: Find sections and items

**Files:**
- Create: `src/core/parse.ts`, `tests/core/parse.test.ts`, and these fixtures in `tests/fixtures/`:
  `example.md` (the spec's example, verbatim), `notes-everything.md`, `top-level-untouched.md`,
  `markers.md`, `lazy.md`, `title-heading.md`, `trailing-whitespace.md`, `pasted-items.md`,
  `list-note-query.md`, `unclosed.md`

**Interfaces:**
- Consumes: `Line` and `parseItemLine`.
- Produces:
  - ```ts
    interface ItemBlock { titleLine: number; endLine: number; notesIndent: string }
    interface Section { headingLine: number | null; items: ItemBlock[]; endLine: number }
    interface ListModel {
      contentStart: number;
      listNote: { start: number; end: number };
      sections: Section[];
      untouched: { start: number; end: number }[];
    }
    ```
  - `parseList(lines: readonly Line[], contentStart: number): ListModel`
  - `maskBlocks(lines: readonly Line[], contentStart: number): { text: string; unclosedStart: number | null }`.
    `text` is the copy that `parseList` parses: the lines from `contentStart` on, joined, with each
    top-level `%%` and `$$` region masked as Step 3 says. `unclosedStart` is the index of the line
    that opens a fenced code block, a `%%` comment, a `$$` math block or an HTML block of CommonMark
    types 1–5 (such as `<!--` or `<pre>`) that never closes, or `null`. Such a block runs to the end
    of the file, so there is at most one.
  - Line numbers are 0-based indexes into `lines`, and every `end` is exclusive.
  - `ItemBlock.endLine` excludes trailing blank lines.
  - `Section.endLine` is the next heading's line, or the end of the file, less trailing blank
    lines, so untouched content at the end of a section counts. For an unnamed section with no
    items, it is `listNote.end`.
  - `notesIndent` is the leading whitespace of the first non-blank notes line when that line
    reaches the item's content column but not 4 columns past it. Otherwise, when the item has no
    notes, that line is a lazy line (indented less than the content column) or it is indented code
    (4 or more columns past it), it is `"\t"` if the content column is 4 or less, and that many
    spaces if it is wider. The content column is where `[` starts, counting a
    tab as a move to the next multiple of 4. So `100. [ ] x` gets five spaces and `100.\t[ ] x`
    eight, because a tab only reaches column 4.
  - `sections[0]` is always the unnamed top section, with `headingLine: null`, even when it's
    empty.

- [ ] **Step 1: Write the fixtures and the failing tests.**
  - **`example.md`** (with `contentStart` 3) gives three sections:
    - unnamed: 1 item
    - "Kitchen": 3 items
    - "Living room": 1 item

    The "freezer storage boxes" item ends right after its `![[storage-box.jpg]]` line and has
    `notesIndent === "\t"`, and the list note covers exactly the "Stuff for the new apartment…"
    line.
  - **`notes-everything.md`:** one item whose notes hold a bullet list, `## not a section`, a
    `---` line, a callout, a `$$` block and a fenced block containing `- [ ] not an item`. The
    result is one section with one item covering every one of those lines.
  - **`top-level-untouched.md`:** `- [ ] first`, then the blocks, each after a blank line, then
    `- [ ] last`. The blocks are a fence holding `- [ ] x`, a multi-line `%% … %%` holding
    `- [ ] y`, a `$$ … $$` holding `- [ ] z`, an HTML block `<div>\n- [ ] w\n</div>`, a table and
    a plain `- bullet`. The result is exactly 2 items, with those six blocks in `untouched`.
  - **`markers.md`:** `* [ ] a`, `+ [ ] b`, `1. [ ] c`, `- [X] d`, `- [-] e`, `- [/] f` and
    `100. [ ] g` are 7 items, and g has `notesIndent === "     "` (five spaces).
  - **`lazy.md`:** `- [ ] a\nlazy line\n- [ ] b`. Item a is `{titleLine: 0, endLine: 2}` with
    `notesIndent === "\t"`. The same test parses two inline strings: in `- [ ] c\n lazy\n` (one
    space), c has `notesIndent === "\t"`; in `100. [ ] x\n\tlazy\n`, x has
    `notesIndent === "     "` (five spaces).
  - **`title-heading.md`:** `- [ ] a\n\t---\n- [ ] b` is two items, `{titleLine: 0, endLine: 2}`
    and `{titleLine: 2, endLine: 3}`. The plugin's blank line between title and notes applies on
    write (Task 7a).
  - **`trailing-whitespace.md`:** `- [ ] a  \n\n\tnote \t\n  \n- [ ] b\t\n` (check that the file
    keeps its trailing whitespace) is two items, `{titleLine: 0, endLine: 3}` and
    `{titleLine: 4, endLine: 5}`. The spaces-only line 3 counts as blank.
  - **`pasted-items.md`:** `*` bullets with notes indented by 4 spaces. Each item's notes are
    kept, and `notesIndent` is `"    "`.
  - **`list-note-query.md`:** a list note holding a ```` ```tasks ```` block that contains
    `- [ ] q`. No item comes from inside it, and the list note covers the whole block.
  - **`unclosed.md`:** `- [ ] a\n\n%%\n- [ ] b\n- [ ] c\n`, a comment that is never closed. Item
    a parses; from the `%%` line to the end of the file is one `untouched` block, so b and c are
    not items (CommonMark closes an unclosed fence at the end of the document, and the `%%` mask
    turns the comment into a fence). `maskBlocks(lines, 0).unclosedStart` is 2.
  - **CRLF:** `example.md` converted to CRLF in the test gives the same model.
  - **Speed:** 1500 generated items under 10 headings parse in under 1000 ms.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Parse with commonmark.js from `contentStart` on. Map `sourcepos` lines back to indexes into
    `lines`.
  - Before parsing, `maskBlocks` masks top-level `%%` and `$$` regions in a copy used only for
    parsing. It rewrites each region's opening and closing delimiter lines to a fence longer than
    any fence inside the region, so the line count stays the same.
  - A top-level list item is an `ItemBlock` when `parseItemLine` accepts its first line.
    Anything else at the top level is either the list note (before the first heading or item) or
    `untouched`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with the message "Find sections and items with CommonMark's own list
  rules".

### Task 7a: Item edits, line endings and the guarded write

Task 7 lands as two pull requests, 7a and then 7b. Its edits are split by responsibility into
item edits, headings, the list note, and `mapLine` with the guard, each with its own test file, so
every file stays under about 300 lines and each pull request stays reviewable.

**Files:**
- Create: `src/core/edit-items.ts`, `src/core/guard.ts`, `tests/core/edit-items.test.ts`,
  `tests/core/move-item.test.ts`, `tests/core/edit-timing.test.ts`, `tests/core/edit-helpers.ts`,
  `tests/core/guard.test.ts`
- Modify: `src/core/lines.ts`, `tests/core/lines.test.ts`, `src/core/parse.ts` (export `columnOf`
  and `isBlank`, add `topLevelBlocks`, and the `notesIndent` rule for notes that open with
  indented code), `tests/core/parse.test.ts`

**Interfaces:**
- Consumes, in `edit-items.ts`: `Line`, `splitLines` and `dominantEol` (Task 1); `parseItemLine`,
  `isDoneStatus`, `tickLine`, `untickLine`, `setTitle` and `isRepeating` (Task 4); `ItemBlock`,
  `Section` and `ListModel` (Task 6), and `columnOf`, `isBlank` and `topLevelBlocks`, which this
  task exports from or adds to Task 6's `parse.ts`. The tests also use `joinLines`, `parseList`
  and `maskBlocks`.
- Produces, in `src/core/parse.ts`: `topLevelBlocks(lines, contentStart): Block[]`, every top-level
  block with each list split into its items, as `{ type, start, end }`. `parseList` builds on it.
- Produces, in `src/core/lines.ts`:
  `spliceLines(lines: readonly Line[], start: number, deleteCount: number, insert: readonly Line[]): Line[]`.
  It splices, then sets the endings at the end of the file as the Global Constraints' "Writing to
  files" says. Every edit in 7a and 7b writes through it.
- Produces, in `src/core/edit-items.ts`. Each function returns a new `Line[]` and inserts new
  lines with `dominantEol`. Each except `moveItem` replaces one run of lines that starts at the
  edited item's `titleLine` (just after it for notes), or at the `titleLine` an insert returns:
  every line before the run stays where it was, and every line after it shifts by the change in
  length. Apart from that run, only the endings at the end of the file can change, which moves no
  line. Task 9 relies on this. Every top-level block the edit doesn't touch, the list note's
  included, must keep its type and source text; `topLevelBlocks` before and after decides. If it
  doesn't, the run ends with one empty line. If it still doesn't, the edit throws
  `UnsafeEditError` and changes nothing. A title with a line break throws an `Error`.
  - `toggleItem(lines, item: ItemBlock, now: Date): Line[]`, which throws `RepeatingItemError`
    when it would tick a 🔁 line.
  - `insertItem(lines, model, after: ItemBlock | null, title: string): { lines: Line[]; titleLine: number }`.
    With `after === null`, the item goes first in the list: it's inserted at the line of the first
    item or heading after the list note, or at the end of the file when there is none.
  - `insertItemInSection(lines, model, section: Section, title: string): { lines: Line[]; titleLine: number }`,
    which adds the item as the first under that heading. In a named section without items it goes
    at the section's `endLine`, after its content. For the unnamed top section it goes where
    `insertItem` puts it with `after === null`.
  - `deleteItem(lines, model, item): Line[]`. It removes the item's lines and, when the item sits
    between two gaps, the gap after it, so no double blank line is left.
  - `moveItem(lines, model, item, to: { after: ItemBlock } | { firstIn: Section }): Line[]`.
    `{ firstIn }` puts the item where `insertItemInSection` would put a new one.
  - `getItemNotes(lines, item): string`. It removes up to `notesIndent`'s width of indentation
    from each notes line, counting columns with a tab moving to the next multiple of 4, so a tab
    and 4 spaces strip alike. A tab that crosses that width leaves its remaining columns as
    spaces, as CommonMark does. It removes all leading whitespace from a lazy line.
  - `setItemNotes(lines, model, item, markdown: string, indent = item.notesIndent): Line[]`. It
    drops trailing blank lines from `markdown` first, because the editor writes on every keystroke:
    an Enter at the end would otherwise leave a stray blank line outside the item. `indent` is the
    notes indent the field captured when it took focus (Task 7b added it). Re-parsed after a save,
    `notesIndent` takes in spaces typed at the start of the notes, and the next save would add them
    to every line, so the notes would flip between a paragraph and code.
  - `setItemTitle(lines, item, title: string): Line[]`
  - `class RepeatingItemError extends Error`
  - `class UnsafeEditError extends Error`, thrown by the inserts, `deleteItem`, `setItemNotes` and
    `moveItem`
- Produces, in `src/core/guard.ts`:
  - `guardedApply(current: string, expected: string, next: string): string`, which returns `next`
    when `current === expected`, and `current` otherwise.
  - `mapLine(oldLines: readonly Line[], newLines: readonly Line[], line: number): number | null`.
    It keeps the common prefix and suffix (lines compare by `text`, and the suffix never overlaps
    the prefix), shifts a line in the suffix by the change in length, and returns `null` inside
    the changed range.

- [ ] **Step 1: Write the failing tests** with exact strings (`now` = 2026-10-20 23:55 local).
  First add two for `spliceLines` to `tests/core/lines.test.ts`:
  - `joinLines(spliceLines(splitLines("a\nb"), 2, 0, [{ text: "c", eol: "\n" }]))` is `"a\nb\nc"`:
    `b` moves off the end and takes LF, and `c` becomes last and takes `b`'s old ending, none.
  - `joinLines(spliceLines(splitLines("a\r\nb"), 1, 1, []))` is `"a"`: `a` becomes last and takes
    `b`'s old ending, none.

  The `mapLine` and `guardedApply` rows go in `tests/core/guard.test.ts`, the rest in
  `tests/core/edit-items.test.ts`:

| Call | Input | Expected |
|---|---|---|
| `toggleItem` | `- [ ] a\r\n- [ ] b\r\n` (item a) | `- [x] a ✔ 2026-10-20 23:55\r\n- [ ] b\r\n` |
| `insertItem(after: last)` | `- [ ] a` | `- [ ] a\n- [ ] new` (still no final newline) |
| `insertItem(after: null)` | `---\nprincelists: true\n---\nNote\n\n## H\n- [ ] a\n` | `---\nprincelists: true\n---\nNote\n\n- [ ] new\n## H\n- [ ] a\n` |
| `insertItem(after: null)` | `---\nprincelists: true\n---\n` | `---\nprincelists: true\n---\n- [ ] new\n` |
| `insertItemInSection(H, "new")` | `- [ ] a\n## H\n- [ ] b\n` | `- [ ] a\n## H\n- [ ] new\n- [ ] b\n` |
| `deleteItem(a)` | `- [ ] a\n\n\tn\n- [ ] b\n` | `- [ ] b\n` |
| `deleteItem(b)` | `- [ ] a\n- [ ] b` | `- [ ] a` |
| `deleteItem(b)` | `- [ ] a\n\n- [ ] b\n\n- [ ] c\n` | `- [ ] a\n\n- [ ] c\n` (one gap is left) |
| `setItemNotes` | `- [ ] a\n- [ ] b\n` with notes `Buy 6:\n- one\n\nlast` on a | `- [ ] a\n\n\tBuy 6:\n\t- one\n\n\tlast\n- [ ] b\n` |
| `setItemNotes` | an item with 4-space notes, new notes `x` | the notes line is `    x` |
| `setItemNotes` | `100. [ ] x\n` with notes `n` | `100. [ ] x\n\n     n\n` (five spaces: a tab would make a code block) |
| `setItemNotes(…, "")` | `- [ ] a\n\n\tnote\n- [ ] b\n` | `- [ ] a\n- [ ] b\n` |
| `setItemNotes(…, "x\n\n")` | `- [ ] a\n- [ ] b\n` (item a) | `- [ ] a\n\n\tx\n- [ ] b\n`, the same as notes `x` |
| `moveItem(a, {after: b})` | `- [ ] a\n\n\tn\n\n- [ ] b\n` | `- [ ] b\n\n- [ ] a\n\n\tn\n` (the gap stays where it was) |
| `moveItem(a, {after: c})` | `## G\n- [ ] a\n\n- [ ] b\n## K\n- [ ] c\n` | `## G\n- [ ] b\n\n## K\n- [ ] c\n- [ ] a\n` (the gap stays in G, at its end) |
| `moveItem(b, {firstIn: <top section>})` | `- [ ] a\n- [ ] b` | `- [ ] b\n- [ ] a` |
| `moveItem(a, {firstIn: H})` | `- [ ] a\n## H\n- [ ] b\n` | `## H\n- [ ] a\n- [ ] b\n` |
| `moveItem(b, {after: c})` | `## G\n- [ ] a\n\nNote\n\n- [ ] b\n## K\n- [ ] c\n` | `## G\n- [ ] a\n\nNote\n\n## K\n- [ ] c\n- [ ] b\n` (`Note` stays) |
| `moveItem(first, {after: last})` | `top-level-untouched.md` | `- [ ] last` becomes the first line and `- [ ] first` the last; nothing else changes |
| `mapLine(old, new, 0)`, `(…, 1)`, `(…, 2)` | old `a\nb\nc\n`, new `a\nx\ny\nc\n` | `0` (before the change), `null` (inside it), `3` (after it) |
| `guardedApply` | `("x","x","y")`, `("z","x","y")` | `"y"`, `"z"` |

  Also test:
  - toggling a `🔁` item throws `RepeatingItemError`
  - for every fixture from Task 6, `setItemTitle` with the item's current title leaves the text
    byte-identical
  - for every fixture item whose notes already start after a blank line, `setItemNotes` with
    `getItemNotes`'s output leaves the text byte-identical. For `lazy.md` it gives
    `- [ ] a\n\n\tlazy line\n- [ ] b`, and for `title-heading.md` it gives
    `- [ ] a\n\n\t---\n- [ ] b`. For `- [ ] c\n lazy\n` it gives `- [ ] c\n\n\tlazy\n`, and for
    `100. [ ] x\n\tlazy\n` it gives `100. [ ] x\n\n     lazy\n`. For
    `- [ ] a\n\n\tnote\n\n    more\n`, whose notes mix a tab and 4 spaces, it gives
    `- [ ] a\n\n\tnote\n\n\tmore\n`: the bytes change, but under commonmark the item holds the
    same blocks before and after (`paragraph`, `paragraph`, `paragraph`).
  - an NFD title survives `insertItem`
  - an insert, delete or move that one empty line can't make safe throws `UnsafeEditError`, as for
    `- [ ] z\n1. [ ] a\n\n   ```\n   x\n   ```\n  Text\n`, where `  Text` would become z's notes
  - `moveItem` never adds or loses a non-blank line, and every untouched block, heading and item
    keeps its text, for every move on every fixture and on cases where text could join an item.
    Across 20 random moves on `example.md`, on `example.md` with its final newline removed, and
    on `top-level-untouched.md`, where nothing can join, it adds or loses no line at all.
  - inserts, deletes and notes written back keep every other item, heading and untouched block
    as it parsed; notes written back render the same HTML when they follow a blank line
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
  - Every edit splices whole `Line` objects with `spliceLines`, which sets the endings at the end
    of the file. Only LF and CRLF count as a file's ending, as in the spec, so a file that uses
    a lone CR gets LF on new lines. Say so in a comment at `spliceLines`.
  - **In `moveItem`, only items change order.** Blank-line gaps and untouched blocks stay in their
    slots, as in the table's `moveItem` rows. When an item moves to another section, it is
    inserted without a gap. In the section it leaves, the gap after it moves to the end of that
    section when it no longer sits directly between two items, or when a gap also comes before the
    item, so no double blank line is left between items; when only blank lines follow the item in
    its section, both gaps end up at its end. The gap before the item stays: moved away, untouched
    text after the item would become a lazy line of the item above. An untouched block that the
    move leaves outside a pair of items stays where it is. Where a boundary the move makes would
    let the text below join the block above, the move adds one empty line there, and checks again,
    since one can uncover the next. If no changed block points at a boundary, as when a block joins
    or vanishes into a link reference definition, it writes one at every boundary it made. If the
    blocks still differ, it throws `UnsafeEditError`.
  - Notes are written with a blank line between the title and the notes. They are indented with
    the item's `notesIndent`, and their blank lines are written empty.
- [ ] **Step 3: Commit** with the message "Edit items by replacing only the lines that change".

### Task 7b: Heading and list-note edits

**Files:**
- Create: `src/core/edit-check.ts`, `src/core/edit-lines.ts`, `src/core/edit-headings.ts`,
  `src/core/edit-list-note.ts`, `tests/core/edit-headings.test.ts`, `tests/core/edit-list-note.test.ts`
- Modify: `src/core/edit-items.ts` (its check moves to `edit-check.ts` and its line helpers to
  `edit-lines.ts`, and `setItemNotes` takes the notes indent from focus), `tests/core/edit-helpers.ts`,
  `tests/core/edit-timing.test.ts` (the fastest of several runs counts)
- Create, for `setItemNotes`: `tests/core/notes-typing.test.ts`

**Interfaces:**
- Consumes: `Line`, `splitLines`, `joinLines` and `dominantEol` (Task 1); `ItemBlock`, `Section`,
  `ListModel`, `parseList` and `maskBlocks` (Task 6); `spliceLines` (Task 7a).
- Produces, in `src/core/edit-check.ts`: Task 7a's check, moved out of `edit-items.ts` with no
  change in behavior so that every edit shares it: `replaceRun`, `blockKeys`, `blockKey`,
  `sameBlocks` and `class UnsafeEditError`. `replaceRun` takes the keys of the blocks a run removes
  and adds as arrays, since a list note holds several. `edit-items.ts` still exports
  `UnsafeEditError`.
- Produces, in `src/core/edit-lines.ts`: `typedLines` (a field's lines without its trailing blank
  lines), `hasLineBreak`, `gapEnd` and `isBlankAt`, moved out of `edit-items.ts` with no change in
  behavior so that the item, heading and list-note edits share them.
- Every edit below keeps the rest of the file parsing as it did, as Task 7a's edits do: each
  top-level block it doesn't touch, the list note's included, keeps its type and source text. If
  it wouldn't, the run ends with one empty line, and if it still wouldn't, `insertHeading`,
  `deleteHeading` and `setListNote` throw `UnsafeEditError` and change nothing. `deleteHeading`
  and `setHeadingText` take the `model` for its `contentStart`, which that parse needs.
- Produces, in `src/core/edit-headings.ts`. Each function returns a new `Line[]`, or `null` where
  its signature says so, and inserts new lines with `dominantEol`. Like 7a's edits, each replaces
  one run of lines, here starting at the section's `headingLine` or the `headingLine` an insert
  returns.
  - `insertHeading(lines, model, at: { afterItem: ItemBlock } | { afterSection: Section }, text: string): { lines: Line[]; headingLine: number }`.
    This writes `## text`, or `##` when `text` is empty, at the item's or the section's
    `endLine`. A section's `endLine` comes after its hidden archived rows, so they stay in their
    section (spec, "Selecting and adding"). A text with a line break throws an `Error`.
  - `deleteHeading(lines, model, section): Line[]`. It removes the heading's lines, a setext
    heading's underline included. Link reference definitions that open a setext heading's
    paragraph stay. As `deleteItem` does, a heading between two gaps takes the gap after it, so
    no double blank line is left.
  - `setHeadingText(lines, model, section, text: string): Line[] | null`. It rewrites only the
    heading's own lines and keeps the heading's level: the `#` run, any indent, any closing `#`s
    and the line ending stay as written. An empty ATX heading such as `##` gets one space between
    the `#` run and the text. A setext heading keeps its `===` or `---` underline, and its content
    lines become one line holding the text. It returns `null` when the result wouldn't parse as a
    heading of the same level whose raw content is exactly `text`, with every other block as it
    was. Raw content is the source before inline parsing: for an ATX heading, what lies between
    the `#` run and any closing sequence, without leading or trailing spaces and tabs; for a
    setext heading, its content lines. The whole file is parsed to decide, since the lines above
    a setext heading can take in its text: indented to an item's content column, it joins the
    item.
- Produces, in `src/core/edit-list-note.ts`. `setListNote` replaces one run of lines that starts
  at the list note's `start`, like 7a's edits.
  - `getListNote(lines, model): string`
  - `setListNote(lines, model, note: { start: number; end: number }, markdown: string): { lines: Line[]; note: { start: number; end: number } }`.
    - `note` is the range of lines the editor's previous save wrote. The view seeds it from
      `model.listNote` when the field takes focus, and passes on the range each save returns: the
      lines the new note now fills. Re-parsing can't stand in for it, since a keystroke can change
      how the note's own lines parse, and replacing the re-parsed list note would then delete or
      repeat lines (spec, "The list note").
    - It drops trailing blank lines from `markdown` first, as `setItemNotes` does. When the new
      note isn't empty and an item or heading follows the range directly, it writes one blank line
      between them, outside the returned range, so a note that ends in an HTML block can't swallow
      the first item.
    - The note's blocks are replaced by the new note's, which may include a heading or an item.
      When `listNoteUnclosedBlock` is true for the new note or for the lines it replaces, it writes
      the note without the check, so typing is never lost (owner, 2026-10-21). What follows stays
      hidden while the block is open, and is never lost.
    - Any other note throws `UnsafeEditError` when the lines outside the range wouldn't parse as
      they did, as when the first item would join a list item in the note.
  - `listNoteWouldRestructure(markdown: string): boolean`, true when
    `parseList(splitLines(markdown), 0)` finds a heading or an item
  - `listNoteUnclosedBlock(markdown: string): boolean`, true when
    `maskBlocks(splitLines(markdown), 0).unclosedStart` isn't `null`: the list note opens a fenced
    code block, a `%%` comment, a `$$` math block or an HTML block of CommonMark types 1–5 (such as
    `<!--` or `<pre>`) and never closes it

- [ ] **Step 1: Write the failing tests** with exact strings, in `tests/core/edit-headings.test.ts`
  and `tests/core/edit-list-note.test.ts`:

| Call | Input | Expected |
|---|---|---|
| `insertHeading({afterItem: a}, "H")` | `- [ ] a\n- [ ] b\n` | `- [ ] a\n## H\n- [ ] b\n` |
| `insertHeading({afterSection: G}, "H")` | `## G\n- [ ] a\n## K\n- [ ] b\n` | `## G\n- [ ] a\n## H\n## K\n- [ ] b\n` |
| `insertHeading({afterItem: a}, "")` | `- [ ] a\n- [ ] b\n` | `- [ ] a\n##\n- [ ] b\n` |
| `deleteHeading(H)` | `## G\n- [ ] a\n## H\n- [ ] b\n` | `## G\n- [ ] a\n- [ ] b\n` |
| `deleteHeading(<empty>)` | `- [ ] a\n##\n- [ ] b\n` | `- [ ] a\n- [ ] b\n` |
| `setHeadingText(Kitchen, "Pantry")` | `## Kitchen\n- [ ] a\n` | `## Pantry\n- [ ] a\n` |
| `setHeadingText(Old, "New")` | `### Old\n- [ ] a\n` | `### New\n- [ ] a\n` |
| `setHeadingText(Kitchen, "Pantry")` | `## Kitchen\r\n- [ ] a\r\n` | `## Pantry\r\n- [ ] a\r\n` |
| `setHeadingText(Old, "New")` | `## Old ##\n- [ ] a\n` | `## New ##\n- [ ] a\n` |
| `setHeadingText(Old, "New")` | `Old\n===\n- [ ] a\n` | `New\n===\n- [ ] a\n` |
| `setHeadingText(Old, "New")` | `  ## Old\n- [ ] a\n` | `  ## New\n- [ ] a\n` |
| `setHeadingText(Old, "- [ ] New")` | `Old\n===\n- [ ] a\n` | `null` (it would become an item) |
| `setHeadingText(Old, "C #")` | `## Old\n- [ ] a\n` | `null` (` #` would close the heading) |
| `setHeadingText(Old, "New")` | `Old\nline two\n===\n- [ ] a\n` | `New\n===\n- [ ] a\n` |
| `setHeadingText(<empty>, "H")` | `- [ ] a\n##\n- [ ] b\n` | `- [ ] a\n## H\n- [ ] b\n` |
| `getListNote` | `---\nprincelists: true\n---\nStuff\n\nMore\n\n- [ ] a\n` | `Stuff\n\nMore` |
| `setListNote(…, "New note")` | `---\nprincelists: true\n---\nOld\n\n- [ ] a\n` | `---\nprincelists: true\n---\nNew note\n\n- [ ] a\n` |
| `setListNote(…, "Note")` | `---\nprincelists: true\n---\n` | `---\nprincelists: true\n---\nNote\n` |
| `setListNote(…, "New note\n\n")` | `---\nprincelists: true\n---\nOld\n\n- [ ] a\n` | `---\nprincelists: true\n---\nNew note\n\n- [ ] a\n`, the same as `"New note"` |
| `setListNote(…, "<div>x</div>")` | `---\nprincelists: true\n---\n- [ ] a\n` | `---\nprincelists: true\n---\n<div>x</div>\n\n- [ ] a\n` (`a` stays an item) |
| `listNoteWouldRestructure` | `Text\n---`; `## H`; `- [ ] x` | `true` |
| `listNoteWouldRestructure` | `Text\n\n---`; `plain *text*`; `- bullet` | `false` |
| `listNoteUnclosedBlock` | `` ```js\ncode ``; `%%\nhidden`; `$$\nx` | `true` |
| `listNoteUnclosedBlock` | `<!--\nhidden` | `true` |
| `listNoteUnclosedBlock` | `` ```\ncode\n``` ``; `%% inline %%`; `$$x$$`; `plain` | `false` |

  Also test:
  - `deleteHeading` on `Text\n## H\nMore\n` gives `Text\n\nMore\n`, and on `- [ ] a\n## H\nText\n`
    gives `- [ ] a\n\nText\n`; on `- [ ] a\n## H\n  more\n`, where `  more` would join `a`, it throws
    `UnsafeEditError`; on `- [ ] a\n\n## H\n\n- [ ] b\n` it gives `- [ ] a\n\n- [ ] b\n`
  - `insertHeading` after a section whose content ends in `<div>…</div>` throws `UnsafeEditError`
  - `setHeadingText` on `- [ ] a\n\nOld\n===\n- [ ] b\n` with `  New` returns `null`
  - `setListNote` with `` ```js\ncode `` above `- [ ] a` gives `` ```js\ncode\n\n- [ ] a\n `` after the
    frontmatter, and `listNoteUnclosedBlock` is true for that note; with a fenced block further
    down, which closes the note's block, it saves too; with `- bullet` above `  - [ ] a`, which
    would nest the item, it throws `UnsafeEditError`
  - typing sessions in the list note, one character at a time with a re-parse between saves, as
    Task 9 saves: an opening and closing fence, `%%`, `$$` and `<!--`; `Weekend` then `-` then
    ` eg`; `# K`; `Text` then `---`. In every session each save writes the typed note once, and
    the lines after the range are those after the note at the start, with at most the one blank
    line in front. Random sessions on every fixture keep every line outside the range.
  - typing ` x`, ` xy`, ` xyz` as the notes of `- [ ] a\n- [ ] b\n`, with a re-parse between saves
    and the indent captured at focus: every save renders the blocks typed, where the re-parsed
    indent made ` xy` code
  - every insert, delete, rename and list-note edit on every fixture leaves every other item,
    heading and untouched block as it parsed, or is refused, apart from a list note that leaves
    a block open; and in a file whose lines all end the same way, writing back a heading's
    current text, or `getListNote`'s output, leaves the file byte-identical, but for the list
    note's blank line
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS. Every edit writes
  through `spliceLines`.
- [ ] **Step 3: Commit** with the message "Edit headings and the list note by replacing only their
  lines".

### Task 8: Draw the list, tick items and hide archived ones

**Files:**
- Create: `src/view/render-list.ts`, `src/view/write.ts`, `src/core/display.ts`,
  `src/core/queue.ts`, `tests/core/display.test.ts`, `tests/core/queue.test.ts`
- Modify: `src/view/list-view.ts`, `styles.css`, `src/core/edit-headings.ts` (exports `splitAtx`
  for the heading text)

**Interfaces:**
- Consumes: `parseList(splitLines(view.text), contentStartLine(view.text))`, `parseItemLine`,
  `isArchived`, `toggleItem`, `RepeatingItemError`, `UnsafeEditError`, `joinLines` and
  `guardedApply`.
- Produces:
  - `writeAction(view: PrinceListView, next: string, expected = view.text, refusedNotice: string | null = "This list changed elsewhere. Try again."): Promise<boolean>`,
    in `src/view/write.ts`. It first awaits `view.save()` (`TextFileView.save`, public since
    0.10.12) so pending typing is on disk, then runs
    `vault.process(file, cur => guardedApply(cur, expected, next))`. Inside that callback, once
    the guard accepts, it sets `view.text = next`, so `setViewData`'s early return holds whatever
    the timing of Obsidian's modify echo. When the guard refused, it shows a `Notice` reading
    `refusedNotice`, unless that is `null`.
  - `tryEdit(edit: () => Line[]): Line[] | null`, in `src/view/write.ts`. It returns the edit's
    lines, or `null` when the edit throws `RepeatingItemError` or `UnsafeEditError`, after showing
    that error's `Notice` (Step 2). Any other error is thrown. Later tasks call their edits through
    it, so every refused edit shows the same notice.

- [ ] **Step 1: Implement the rendering** that the spec's "Layout" describes:
  - the title (the basename)
  - the list note, rendered in gray (as plain text until Task 9)
  - section headings with a rule
  - rows of a checkbox and a title, where the title is `parseItemLine(...).title` with no marks
    or tail shown
  - a done item: ticked and grayed, with no strikethrough
  - archived items left out unless "Show archived" is on
  - content the plugin leaves alone, such as paragraphs, tables and code between items, in its
    place as gray plain text, like the list note (spec, "Content the plugin leaves alone")
  - "Show archived" as a toggle in `onPaneMenu`. It's a field of the view that starts off, and
    `setViewData` turns it off when `clear` is true, which means the view is opening a different
    file (`TextFileView.setViewData`). Keep it out of the view's `getState` and out of local
    storage, so nothing restores it (spec, "Done and archived").

  Re-render whenever `setViewData` runs, except that it returns early when `clear` is false and
  `data === this.text`. The view's own writes come back that way (spec, "Saving and outside
  changes"), and a redraw then would tear down a field that has focus. A redraw keeps the scroll
  position, and a different file (`clear` true) opens at the top.
- [ ] **Step 2: Make the checkbox tick.** A click calls `writeAction(view, joinLines(toggleItem(...)))`,
  using `new Date()`. Once the write lands, only the clicked row changes, its checkbox and its done
  class, so focus and the scroll position stay. Taps queue (`serialQueue`): each waits for the
  previous one's write, then parses the current text, so two quick taps on one box tick and then
  untick it. A queued tap whose row a redraw removed is dropped, since lines may have moved. On
  `RepeatingItemError` it shows a `Notice` reading "Repeating items can't be ticked here yet." The
  click never opens a card. Later edits (Tasks 9 to 11) that throw `UnsafeEditError` write nothing
  and show a `Notice` reading "This list's layout can't take that change. Make it in Markdown
  instead."
- [ ] **Step 3: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 4: Check it by hand in the test vault on the Mac and the iPhone.**
  1. `example.md` matches the spec's "Layout" section.
  2. Ticking writes `✔ <now>` and leaves the line in place, grayed.
  3. Unticking restores the line.
  4. An item with `✔` older than 24 h is hidden, and "Show archived" shows it.
  5. "Show archived" is off again after closing and reopening the list, after restarting
     Obsidian, and after another list opens in the same pane.
  6. "Show archived" stays as it was while the open list is renamed.
  7. A generated 500-item list opens and scrolls without visible lag on the iPhone.
  8. Closing the list after only viewing it doesn't change the file: compare `git hash-object`
     and the modification time (`stat -f %m`) before and after, on a copy. Then tick an item, wait
     for the write, and close the list: the modification time stays at the tick's write.
  9. On the Mac, with a list from outside the vault (spec, "Notes outside the vault"): ticking
     writes the file, and an edit made to it in another app while it's open shows in the view.
     First check that the same edit shows in Obsidian's own Markdown view of that note. Then open
     the note from a second test vault's window, with PrinceLists installed there too, and check
     it works as a list there. Record the results in the pull request. If one fails, stop and
     record it in the pull request with the spec's proposed fallback. The owner decides before
     it's built.
  10. For this check only, log when `writeAction` sets `view.text` and when `setViewData` runs
      after a tick, and don't commit the logging. Record the order once in the pull request.
  11. Double-tap a box: it ticks and then unticks, with no "changed elsewhere" notice and no
      flicker. Tap two boxes quickly: both tick.
- [ ] **Step 5: Commit** with the message "Draw lists, tick items and hide archived ones".

### Task 9: The card, editing, and outside changes

**Files:**
- Create: `src/view/card.ts`, `src/view/notes.ts`, `src/view/fields.ts`, `src/view/events.ts`,
  `src/view/dom.ts`, and in `src/core/`: `editing.ts` (the view's text, `selected` and the typing
  sessions), `follow.ts`, `title-field.ts`, `empty-item.ts`, `inline.ts` and `action-write.ts`
- Modify: `src/view/list-view.ts`, `src/view/render-list.ts`, `src/view/write.ts`, `styles.css`

**Interfaces:**
- Consumes: `getItemNotes`, `setItemNotes`, `setItemTitle`, `deleteItem`, `UnsafeEditError`,
  `getListNote`, `setListNote`, `listNoteWouldRestructure`, `listNoteUnclosedBlock`, `mapLine`,
  `writeAction` and `tryEdit`.
- Produces:
  - `renderNotes(view: PrinceListView, el: HTMLElement, markdown: string): Component`, in
    `src/view/notes.ts`.
    - It calls `MarkdownRenderer.render(app, markdown, el, file.path, child)` with a fresh child
      `Component`, added through `view.addChild`. The caller passes the child to `removeChild` on
      re-render or close.
    - `a.internal-link` clicks go to `workspace.openLinkText(linktext, file.path, Keymap.isModEvent(evt))`,
      where `linktext` is the link's `data-href`, or its `href` when it has none, as Kanban reads
      it: a Markdown-style link's `href` can be URL-encoded.
    - When `Platform.isDesktop`, `contextmenu` on `a.internal-link` opens a new `Menu`, filled by
      `workspace.handleLinkContextMenu(menu, linktext, file.path)` and shown with
      `menu.showAtMouseEvent(evt)` (spec, "Rendering notes in the card"). On the iPhone there is
      no link menu.
    - Both are delegated once on the view's `contentEl` for every rendered block, not per
      `renderNotes` call: every row title renders through it, and a listener per call would put
      one on each row.
    - It triggers no `hover-link` event. Page previews wait until Obsidian documents that event's
      payload (spec, "Not in step one").
    - It disables `.task-list-item-checkbox`, and the view's click listener cancels clicks on one,
      for an embed that renders more of them later.
  - `openCard(view, titleLine: number, focusTitle = false, inserted?: { textBefore, textAfter }): void`
    and `closeCard(view): void`, in `src/view/card.ts`. `openCard` puts the cursor in the title
    only when `focusTitle` is true, so a tap on a row doesn't open the iPhone keyboard; otherwise
    the card itself takes focus, so Escape reaches it. A card opened on an item its own insert
    created passes `inserted`, the text on either side of the insert, which allows the empty-item
    removal below. `closeCard` queues that removal on `view.enqueue`, the view's write queue.
    `view.selected` holds the `titleLine` of the open item, or `null`. A line number is used
    because a new item's `ItemBlock` doesn't exist until the list is re-parsed.
  - `writeAction(view, next, expected?, refusedNotice?, edit?: OwnEdit)`: a write that moves lines
    passes its `edit` (`ownEdit(start, before, after, kind)` in `src/core/follow.ts`), so
    `selected` and every row's line follow it.
  - **A row's line, in `data-princelists-line`:** the plugin's own attribute, because Markdown that
    Obsidian renders carries its own `data-line`. Never trust it from an earlier render. Task 8's
    tick moves no line. After an edit that moves lines, the view shifts every row's line with the
    edit, by the same rule as `selected`, or draws the list again, before any is used again. Shifting
    in place keeps a redraw from replacing the element a click is landing on.
  - `PrinceListView.focusListTitle(): void`, which puts the cursor in the list title field.

- [ ] **Step 1: Build the card and editing** as the spec's "Ticking", "Editing" and "Selecting
  and adding" sections describe:
  - **The card:** clicking a row (not its checkbox or a link in it) opens it, and clicking empty
    space closes it. It shows the same checkbox.
  - **Row titles and headings (owner, 2026-10-21):** rendered as Markdown through `renderNotes`,
    in place of Task 8's plain text (spec, "Layout"). A click on a link in a row opens the link
    only: it doesn't tick the item or open the card.
  - **The title:** editing it calls `setItemTitle`, with typing saved through `requestSave`. The
    field replaces each line break in typed or pasted text with a space before calling it, since a
    title with a line break throws. The
    field keeps the title line as it was when it took focus, and each keystroke calls
    `setItemTitle` on the current lines with that saved line put back, which gives
    `setTitle(thatLine, typed)`. Starting from the current line instead would read a typed
    `#tag`, `📅 date` or ` ^id` as tail and copy it on every keystroke. The field refreshes the
    saved line only when something other than the field changed that line. A line that is still
    what the field wrote keeps the saved line, or the next keystroke would copy a typed `#tag`. One
    of the view's own writes to the line, such as a tick, is made to the saved line too (its
    `OwnEdit.retitle`), for the same reason.
  - **Notes:** rendered with `renderNotes`, and switched to a `<textarea>` of `getItemNotes` on
    click. They're saved with `setItemNotes` through `requestSave`, passing the item's
    `notesIndent` as the textarea had it when it took focus, not the one each re-parse gives.
  - **A refused edit while typing:** when a keystroke's edit throws `UnsafeEditError`, the field
    keeps what was typed and the next keystroke tries again. The unsafe-edit `Notice` shows once
    until the field loses focus, not on every keystroke.
  - **The list note:** edited the same way. While `listNoteWouldRestructure` is true, a gray line
    under the editor reads "A heading or checkbox line here becomes a section or item when
    saved." While `listNoteUnclosedBlock` is true, a second gray line reads "An unclosed block here
    hides the items below it." (spec, "The list note"). Such a note still saves, so typing is
    never lost, and the items below stay hidden while the block is open.
    - **The note's range:** when the field takes focus, the view seeds the range `setListNote`
      takes from `model.listNote`. Each save passes the range the previous one returned: the note's
      own lines. The session also carries the blank line its last save wrote under the note, and
      the next save replaces that line with the note too while it is still blank and directly under
      the note, so a note typed and erased again leaves none behind. A line another device added
      between the two keeps it: the next save writes a new blank line instead, or, when the added
      line joins the note's paragraph, is refused. The view carries the range, and that line,
      across its own writes as it does `selected`: an edit whose run starts after the range leaves
      it, and the range's own saves replace it.
    - **While the field has focus,** a redraw draws no row or heading for lines inside the range.
      They are still the note being typed, even where the file now parses an item there, and a
      row acted on would write a typed `- [ ] y` twice. When the field loses focus after such a
      redraw, the whole list is drawn again, as after a warning.
    - **An outside change** maps the range with `mapLine`: its `start`, and its last line,
      `end - 1`, when it isn't empty. An empty range is a position, not a line, so it maps
      through the line before it: the line at its start is the first item's, and an item added
      above that one goes after the note. When either maps to `null`, the field re-reads
      `getListNote` from the new text and seeds the range again from its model. A change inside
      the range that leaves both ends in place is overwritten by the next keystroke, as typing
      wins in any focused field.
  - **The list title:** renamed with `fileManager.renameFile` on Enter or blur. If the name is
    taken, show the `Notice` "A note with that name already exists." and keep the old name. A
    name with `/` or `\` would move the list to another folder, so it shows "A list name can't
    contain / or \." and keeps the old name. Escape puts the old name back. A rename that fails
    shows "The list couldn't be renamed." and keeps the old name.
  - **Empty items:** remove an item only when this card created it ("+", Enter, "New item" or "New
    item below"), its title is still empty, it has no notes, and the user closed the card in the
    view: Escape, a click elsewhere, "+", Enter or a drag start. Remove it by restoring the text
    from before the insert, `writeAction(view, textBeforeInsert, textAfterInsert)`, which applies
    `guardedApply(current, textAfterInsert, textBeforeInsert)`: `deleteItem` would leave behind
    an empty line the insert wrote. The restore is tried only while the view's text is still
    `textAfterInsert`; otherwise it goes straight to the fallback. Pass `refusedNotice` as `null`:
    if the guard refuses, because the file changed outside the view while the card was open, or
    typing landed while the write waited, fall back to `deleteItem` on the current text, with no
    `Notice`. If that throws `UnsafeEditError`, the empty item stays and the
    usual unsafe-edit `Notice` shows (Task 8). Never remove one from `setViewData`, `onClose` or a
    file switch, which would be a write on close or on an outside change.
  - **An empty list note:** shows a gray "Notes" placeholder to click, in any list, so a note can
    be added from the view. An empty item's notes in the card show the same placeholder.
  - **Accessible names:** the list title, an item's title and the notes fields are "List title",
    "Title" and "Notes".
  - **Keys:** Escape closes the card. Enter in an item's title writes no line break (Task 10 adds
    the next item there).
  - **Typing during a one-off write is never lost.** A write refuses, with no `Notice`, when the
    view's text changed while it waited (`guardedWrite` in `src/core/action-write.ts`). A queued
    tick then runs once more on the new text.
  - **A queued tick's line follows the view's own edits,** even when a redraw replaced its row. An
    outside change while it waits drops it, with the `Notice` "This list changed elsewhere. Try
    again.": a silent drop would look like a lost tick. A tick still queued when another file
    loads in the view, or the view closes, is dropped silently.
  - **`getViewData()` includes text being typed.** Apply each keystroke to `this.text`, so
    Obsidian's own merge on outside changes covers it.
  - **`setViewData(_, false)`** re-renders, but keeps any field that has focus: an item title,
    the notes, the list note or the list title. It updates that field only after blur, except the
    list note's re-read when its range can't be mapped (see above). It moves
    `selected` with `mapLine`, and closes the card after blur when that returns `null`.
    `mapLine` finds one changed run, so one outside change to lines both above and below the item
    returns `null` too (call): the card says the list changed elsewhere and closes after blur, and
    the typing up to that change is in the file. Until then the card keeps what it shows, and its
    fields are read-only, so typing that would go nowhere doesn't look saved.
  - **`selected` follows the view's own writes too.** The view knows which lines each of its own
    edits replaced. A `selected` line before them stays, one after them shifts by the change in
    length, and an edit to the selected item's own lines (typing in it, ticking it) leaves
    `selected` as it is. `mapLine` is for outside changes only: it compares lines by text, so it
    can't tell two empty new items apart.
    - The view learns the run from the edit it called, as Tasks 7a and 7b describe it: the run
      starts at the item's `titleLine`, the section's `headingLine`, the list note's `start`, or
      the `titleLine` or `headingLine` an insert returns. The change in length is
      `newLines.length - oldLines.length`.
    - A `selected` line at or after an insert's start shifts too, because the new lines go in
      before it: an insert at the first item, or `setListNote` when no list note exists yet.
    - Deleting the selected item closes its card. A drag closes any open card before it calls
      `moveItem` (Task 11), so a move never has a `selected` line to follow.
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on the Mac,** and check 11 on the iPhone.
  1. A picture embed and a link render in a card, and the link opens. Right-clicking the link
     shows Obsidian's link menu.
  2. Typing notes containing `- one` and `---` keeps the file valid: re-open it, and it's one item.
  3. While typing in a card on the Mac, edit another item of the same list on the iPhone. After
     Sync, both changes are in the file. Then, on the iPhone, add an item at the top. After Sync,
     keep typing on the Mac: the text lands in the same item.
  4. Renaming the list from the file explorer updates the open view's title.
  5. "+ then Escape" can't be checked until Task 10, so note it there.
  6. With a list from outside the vault (spec, "Notes outside the vault"), a picture embed and a
     link in a card render, and the link opens.
  7. Renaming that list from its title renames the file in its own folder, and the file stays
     outside the vault.
  8. Typing `buy #milk2` into an item's title leaves `#milk2` in the file's line once.
  9. Typing in a card of the generated 500-item list (Task 8, check 7) shows no lag.
  10. Bold text, a link, a `#tag` and an external link in an item title and in a heading render
      as Markdown. Clicking the link opens it, without ticking the item or opening its card. A
      click on the tag or the external link doesn't tick the item or open its card either.
  11. On the iPhone, the generated 500-item list (Task 8, check 7) still opens and scrolls
      without visible lag, now with rendered titles and headings.

  If check 6 or 7 fails, stop and record it in the pull request with the spec's proposed
  fallback. The owner decides before it's built.
- [ ] **Step 4: Commit** with the message "Open items into cards and edit titles and notes".

### Task 10: Adding items, menus, and deleting with Undo

**Files:**
- Create: `src/view/menus.ts`, `src/view/add-button.ts`
- Modify: `src/view/list-view.ts`, `src/view/card.ts`, `src/view/render-list.ts`, `styles.css`

**Interfaces:**
- Consumes: `insertItem`, `insertItemInSection`, `insertHeading`, `deleteItem`, `deleteHeading`,
  `UnsafeEditError`, `setHeadingText`, `mapLine`, `writeAction`, `tryEdit` and `openCard`.
  - Each insert passes its texts to `openCard` as `inserted`, so the empty-item removal (Task 9)
    applies, and each write that moves lines passes its `edit` to `writeAction` (Task 9's
    interfaces). Writes queue behind `closeCard`'s removal on `view.enqueue`.
- Produces: `itemMenu(view, item, menu: Menu): void` and `headingMenu(view, section, menu: Menu): void`.
  Each fills an Obsidian `Menu` with the spec's actions and labels. "Delete" and "Delete heading"
  call `setWarning(true)`, so they show in red (spec, "Item actions").

- [ ] **Step 1: Build adding, menus and Undo:**
  - **The floating "+":** a round button at the bottom right, placed outside the scrolling element
    (the view's `contentEl`, Task 8) and drawn with `setIcon(el, "plus")`, with the accessible
    name (`aria-label`) "New item". It calls `insertItem` after the selected item, or with `null`,
    then `openCard(view, titleLine, true)`, which puts the cursor in the title.
  - **Enter in an item's title** inserts the next item below it and opens it the same way.
  - **New item below and New item,** in `itemMenu` and `headingMenu`, insert with `insertItem`
    after the item or `insertItemInSection` first in the section, then
    `openCard(view, titleLine, true)`.
  - **In an empty list, Enter in the list title** first renames the file (Task 9), and then
    inserts the first item with `insertItem` and `after === null`, then
    `openCard(view, titleLine, true)`.
  - **Right-click on the Mac:** only when `Platform.isDesktop`, `contextmenu` on rows and headings
    opens `itemMenu` or `headingMenu` through `menu.showAtMouseEvent(evt)`. A right-click on a
    link in an open card shows only Obsidian's link menu (Task 9), not the item menu: the row
    handler returns early when the event's target is inside `a.internal-link`.
  - **No long-press menu on the iPhone:** Obsidian fires `contextmenu` after an 800 ms hold (not
    yet confirmed on a device; spec, "Touch on the iPhone"), so on the iPhone `contextmenu` on
    rows and headings is canceled in the capture phase, as Task 3's notes record.
  - **Tapping a heading on the iPhone** (`Platform.isMobile`) opens `headingMenu` through
    `menu.showAtMouseEvent(evt)` on the tap's `click` event (spec, "Item actions").
  - **The card's ⋯ button,** with the accessible name (`aria-label`) "Item actions", opens
    `itemMenu` through `menu.showAtPosition`, on both platforms.
  - **Rename heading:** in `headingMenu`, it opens an inline editor: a text field in place of the
    heading row, holding the heading's raw content (a setext heading's content lines joined with
    spaces). Taps inside the field don't open the heading menu. Enter or blur trims the name, then
    saves with `writeAction(view, joinLines(setHeadingText(...)))`. Escape cancels, and the blur
    that follows doesn't save. An empty (after trimming) or unchanged name writes nothing. When
    `setHeadingText` returns `null`, show a `Notice` reading "That name can't be used for this
    heading." and write nothing.
  - **New heading below,** in `itemMenu` and `headingMenu`, writes an empty heading with
    `insertHeading(…, "")`, then opens the same field as Rename heading on the returned
    `headingLine`, with the cursor in it. A name is saved as Rename heading saves it. Escape, or a
    name that is empty after trimming, removes the heading again with `deleteHeading`. A name
    that `setHeadingText` refuses shows "That name can't be used for this heading." and keeps the
    field open; Escape then removes the empty heading.
  - **The heading field survives outside changes.** `setViewData(_, false)` keeps a focused
    heading field, as it keeps the fields of Task 9. On save, map the heading's line with
    `mapLine` from the lines the field opened on to the current ones, and rename the section
    whose heading is on that line. When `mapLine` returns `null`, or no section's heading is on
    that line, cancel, write nothing and show the `Notice` "This list changed elsewhere. Try
    again."
  - **Delete with Undo:** after `deleteItem` or `deleteHeading`, show a `Notice` for 6 s holding
    an "Undo" button. The button calls `writeAction(view, before, after, refused)`, where `before`
    is the text from before the delete, `after` the text right after it, and `refused` is "This
    list changed since the delete, so it can't be undone." That replaces `writeAction`'s usual
    notice, because trying again can't succeed once the list has changed. Build the button in a
    `DocumentFragment` (`createFragment`) passed to `new Notice(fragment, 6000)`, not through
    `Notice.messageEl`, which is `@since 1.8.7` and would raise `minAppVersion`.
  - **Removing an empty new item or heading is a cancel, not a delete (call).** Whatever removes
    it, no Undo notice shows. The Undo notice follows Delete and Delete heading only.
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on the Mac and the iPhone.**
  1. "+" with nothing selected adds the item first in the list. With an item selected, it adds it
     right below that item.
  2. "+" then Escape leaves no empty line in the file.
  3. Each menu item does what the spec says, and "Delete heading" keeps its items. "Delete" and
     "Delete heading" show in red, in the right-click menus, the card's ⋯ and the iPhone's
     heading menu. Check with Settings → Appearance → Native menus off, and record what the Mac
     shows with it on. Right-clicking a link in an open card shows only the link menu.
  4. Undo after a delete restores the file exactly (`git diff` on a copy).
  5. On the iPhone, every item action is reachable through the card's ⋯, tapping a heading opens
     its menu, and holding a row or a heading for 2 s opens no menu.
  6. Type a title, press Enter at once, and no notice appears.
  7. "Rename heading" on a `###` heading: Enter saves the new text and the line keeps `###`.
     Escape, an empty name or the same name leaves the file unchanged. On the iPhone, tapping a
     heading and choosing "Rename heading" works the same way.
  8. Renaming a `===` heading to `- [ ] New` shows "That name can't be used for this heading."
     and leaves the file unchanged. With the field open, change that heading's line in the same
     note opened as Markdown in another pane, then press Enter: "This list changed elsewhere. Try
     again." shows and nothing is written.
  9. "New heading below" opens the heading field with the cursor in it, and Enter writes
     `## <name>`. Escape, or Enter with an empty name, leaves the file as it was before the menu
     opened (`git diff` on a copy). `C #` shows the notice and keeps the field open.
- [ ] **Step 4: Commit** with the message "Add items with the floating button and act on them
  from menus".

### Task 11: Dragging with the mouse

**Files:**
- Create: `src/view/drag-mouse.ts`
- Modify: `src/view/render-list.ts`, `styles.css`

**Interfaces:**
- Consumes: `moveItem`, `UnsafeEditError`, `writeAction` and `tryEdit`.
- Produces: `enableMouseDrag(view: PrinceListView, listEl: HTMLElement): void`. It is enabled only
  when `Platform.isDesktop`.

- [ ] **Step 1: Implement HTML5 drag on rows.** It shows a drop line between visible rows and
  calls `moveItem` with `{ after: <the visible item above the line> }`, or `{ firstIn: <section> }`
  directly under a heading. Hidden archived rows never move (spec, "Selecting and adding").
  - **A drag closes the open card first (call).** When a drag starts, the view closes any open
    card, and with it `selected`, before it calls `moveItem`. Pending typing is saved by
    `writeAction` as usual. The cost: after a drag, a click reopens the card.
  - **A drag start closes the card the way a click elsewhere does (call).** An empty new item is
    removed first (Task 9), and that is a cancel with no Undo. The drag then works on the
    re-parsed list, so `moveItem` gets fresh `ItemBlock`s. If the dragged row was that empty item,
    the drag ends.
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on the Mac.**
  1. Drag within a section.
  2. Drag into another section.
  3. Drag directly under a heading.
  4. An item's notes travel with it.
  5. With "Show archived" off, dragging past a hidden item leaves that item where it was in the
     file.
- [ ] **Step 4: Commit** with the message "Drag items with the mouse on the Mac".

### Task 12: Create lists

**Files:**
- Create: `src/obsidian/create-list.ts`, `src/core/untitled.ts`, `tests/core/untitled.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `MARKER_KEY`, `RIBBON_ICON` and `openAsList` (Task 2), and
  `PrinceListView.focusListTitle()` (Task 9).
- Produces:
  - `nextUntitledName(existing: ReadonlySet<string>): string`, in `src/core/untitled.ts`. It
    returns `"Untitled list"`, then `"Untitled list 1"`, `"Untitled list 2"` and so on, the first
    whose `<name>.md` isn't in `existing`.
  - `createList(app: App, folder: TFolder): Promise<TFile>`, in `src/obsidian/create-list.ts`. It
    writes `---\n${MARKER_KEY}: true\n---\n`, which is `---\nprincelists: true\n---\n`, and opens
    the file with `openAsList(leaf, file)` on `leaf = app.workspace.getLeaf(false)`. Once that
    resolves, it checks `leaf.view instanceof PrinceListView` and calls
    `leaf.view.focusListTitle()`.

- [ ] **Step 1: Write the failing tests.**
  - `nextUntitledName(new Set())` is `"Untitled list"`.
  - With `{"Untitled list.md"}` it's `"Untitled list 1"`.
  - With `{"Untitled list.md","Untitled list 1.md"}` it's `"Untitled list 2"`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
- [ ] **Step 3: Wire up the three routes:**
  - the command `new-list`, "New list", which uses `fileManager.getNewFileParent(activeFile?.path ?? "")`
  - the ribbon icon `RIBBON_ICON`, "New list"
  - `file-menu` on a `TFolder`, "New list", which creates the list in that folder
- [ ] **Step 4: Check it by hand.**
  1. All three routes work on the Mac.
  2. Long-pressing a folder on the iPhone offers "New list". If it doesn't, record that in the
     pull request, for Task 13 to copy into the 1a checks notes; the command still covers the
     phone.
  3. A second new list in the same folder is "Untitled list 1".
- [ ] **Step 5: Commit** with the message "Create lists the same ways as notes".

### Task 13: Finish 1a and start the trial

**Files:**
- Create: `docs/superpowers/notes/<date>-1a-checks.md`
- Modify: the spec (reconcile it), `README.md` (installing from the release, and the status line)

- [ ] **Step 1: Run the full check on the iPhone in the test vault.** It covers the basics:
  open, tick, add, edit, ⋯ actions, the heading menu and the archived toggle. Copy Task 12's
  folder long-press result from its pull request into the notes file.
- [ ] **Step 2: Check alongside other plugins.** Install Tasks and Kanban in the test vault and repeat
  the opening checks from Task 2, Step 7. A Tasks query (`not done`) must still list the items
  with their dates.
- [ ] **Step 3: Check one Sync conflict.** Put both devices offline, tick the same item on each,
  then go back online. Expected: two `✔` marks. The view shows one done item, and the next edit
  of that line collapses them.
- [ ] **Step 4: Check the fixtures in reading view.** Copy `tests/fixtures/` into the test vault
  and open each file in Obsidian's reading view. Expected: each item renders as one list item with
  its notes (spec, "Risks to check during the build", risk 4). Also check that `✔` reads well on
  the Mac and the iPhone (risk 6).
- [ ] **Step 5: Reconcile the spec.** Check each claim in the design against the code. Record
  any decided deviations with their reasons and raise anything undecided. Keep
  `status: building` (step one isn't done until 1b and the two weeks), and set `verified`.
- [ ] **Step 6: Commit** the notes, the spec and `README.md` with the message "Finish part 1a".
  In the README, replace the status line ("There's nothing to install yet…") with where 1a
  stands, and say how to install from the `0.1.0` release. Open the pull request; the owner
  merges it.
- [ ] **Step 7: Release `0.1.0`.** The owner pushes the tag `0.1.0` (no `v`); agents never push
  tags (`AGENTS.md`, "Releases"). It comes after the go-public checklist (the "Go public" issue)
  is done, because the release's attestation needs a public repository. The release workflow
  then builds a draft release, and the owner reviews and publishes it.
- [ ] **Step 8: Install in the everyday vault.** Run `npm run install-vault -- <everyday vault>`
  from the released commit. The owner moves one real list in by hand, and the two weeks start.
  Submitting to Obsidian's community directory isn't part of 1a.
  - During the two weeks, the owner also tries Obsidian's own iPhone features with that list
    (spec, "Not in step one"): the View Note widget, and Quick Capture and the Capture shortcuts
    into the list note.
    - Try the captures on a list in the test vault first. Text added to the start of a note might
      go above the frontmatter and stop the note being a list.
    - Record in an issue, with any screenshot taken of the test-vault list and nothing from the
      real list (`AGENTS.md`: everything here is public), how the list looks in the widget and
      whether a capture lands as a correctly formatted `- [ ]` item in the right place.
