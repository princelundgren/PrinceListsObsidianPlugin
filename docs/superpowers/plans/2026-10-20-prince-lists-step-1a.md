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
- Each task lands as its own pull request, and the owner squash-merges it.
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
  - Interface text is in sentence case. Menu, command and button labels are exactly these:
    "New list", "Open as list", "Open as Markdown", "Show archived", "New item below",
    "New heading below", "New item", "Delete", "Rename heading", "Delete heading", "Undo".
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
  `master`. Record the commit SHA in the commit message.
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
  `src/view/list-view.ts`, `src/core/frontmatter.ts`, `tests/core/frontmatter.test.ts`
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
    file text, and `getViewType()` returning `VIEW_TYPE_LIST`.
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
  - `setViewData(data, clear)` sets `this.text`, re-renders a placeholder (the file's basename in
    an `h2` plus a line that reads "List view"), and switches the pane to Markdown when
    `!isListText(data)`.
  - `clear()` empties `this.text`.
  - Leave `canAcceptExtension` at its default.
  - In `setState(state, result)`, call super and then set `result.history = false` (spec,
    Implementation notes, "Back history").
- [ ] **Step 4: Implement `registerAutoSwitch`** exactly as the spec's Implementation notes,
  "Opening and switching views", describe it:
  - Listen to `file-open`.
  - Require `getActiveViewOfType(MarkdownView)` and `view.file === file`.
  - Skip leaves in a module-level `WeakSet<WorkspaceLeaf>` named `markdownChosen`.
  - Test `isListText(view.data)`.
  - Call `openAsList`.
  - `openAsMarkdown` adds the leaf to `markdownChosen`. `openAsList` removes it.
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
  6. Restarting Obsidian brings the pane back as the list view.
  7. After deleting the frontmatter in Markdown, "Open as list" isn't offered.
  8. For this check only, log `getFrontMatterInfo(text).contentStart` and
     `contentStartLine(text)` at `onload` for `---\nprincelists: true\n---\nNote` and for the
     same text with CRLF endings, and don't commit the logging. Expected: `contentStartLine` is 3
     for both. Record both `contentStart` values in the notes file.
- [ ] **Step 8: Repeat checks 1, 2, 4 and 5 on the iPhone.**
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
  - `TASKS_SIGNIFIERS`, the 18 emoji from the spec's "Where ✔ goes".
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
    that opens a fenced code block, a `%%` comment or a `$$` math block that never closes, or
    `null`. Such a block runs to the end of the file, so there is at most one.
  - Line numbers are 0-based indexes into `lines`, and every `end` is exclusive.
  - `endLine` excludes trailing blank lines.
  - `notesIndent` is the leading whitespace of the first non-blank notes line when that line
    reaches the item's content column. Otherwise, when the item has no notes or that line is a
    lazy line (indented less than the content column), it is `"\t"` if the content column is 4 or
    less, and that many spaces if it is wider. The content column is where `[` starts, counting a
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
  `tests/core/guard.test.ts`
- Modify: `src/core/lines.ts`, `tests/core/lines.test.ts`

**Interfaces:**
- Consumes: `Line`, `splitLines`, `joinLines` and `dominantEol` (Task 1); `parseItemLine`,
  `isDoneStatus`, `tickLine`, `untickLine`, `setTitle` and `isRepeating` (Task 4); `ItemBlock`,
  `Section`, `ListModel` and `parseList` (Task 6).
- Produces, in `src/core/lines.ts`:
  `spliceLines(lines: readonly Line[], start: number, deleteCount: number, insert: readonly Line[]): Line[]`.
  It splices, then sets the endings at the end of the file as the Global Constraints' "Writing to
  files" says. Every edit in 7a and 7b writes through it.
- Produces, in `src/core/edit-items.ts`. Each function returns a new `Line[]` and inserts new
  lines with `dominantEol`.
  - `toggleItem(lines, item: ItemBlock, now: Date): Line[]`, which throws `RepeatingItemError`
    when it would tick a 🔁 line.
  - `insertItem(lines, model, after: ItemBlock | null, title: string): { lines: Line[]; titleLine: number }`.
    With `after === null`, the item goes first in the list: it's inserted at the line of the first
    item or heading after the list note, or at the end of the file when there is none.
  - `insertItemInSection(lines, model, section: Section, title: string): { lines: Line[]; titleLine: number }`,
    which adds the item as the first under that heading. For the unnamed top section it goes where
    `insertItem` puts it with `after === null`.
  - `deleteItem(lines, item): Line[]`
  - `moveItem(lines, model, item, to: { after: ItemBlock } | { firstIn: Section }): Line[]`.
    `{ firstIn }` puts the item where `insertItemInSection` would put a new one.
  - `getItemNotes(lines, item): string`. It removes `notesIndent` from each notes line that starts
    with it, and all leading whitespace from a lazy line.
  - `setItemNotes(lines, item, markdown: string): Line[]`
  - `setItemTitle(lines, item, title: string): Line[]`
  - `class RepeatingItemError extends Error`
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
| `setItemNotes` | `- [ ] a\n- [ ] b\n` with notes `Buy 6:\n- one\n\nlast` on a | `- [ ] a\n\n\tBuy 6:\n\t- one\n\n\tlast\n- [ ] b\n` |
| `setItemNotes` | an item with 4-space notes, new notes `x` | the notes line is `    x` |
| `setItemNotes` | `100. [ ] x\n` with notes `n` | `100. [ ] x\n\n     n\n` (five spaces: a tab would make a code block) |
| `setItemNotes(…, "")` | `- [ ] a\n\n\tnote\n- [ ] b\n` | `- [ ] a\n- [ ] b\n` |
| `moveItem(a, {after: b})` | `- [ ] a\n\n\tn\n\n- [ ] b\n` | `- [ ] b\n\n- [ ] a\n\n\tn\n` (the gap stays where it was) |
| `moveItem(a, {after: c})` | `## G\n- [ ] a\n\n- [ ] b\n## K\n- [ ] c\n` | `## G\n- [ ] b\n\n## K\n- [ ] c\n- [ ] a\n` (the gap stays in G, at its end) |
| `moveItem(b, {firstIn: <top section>})` | `- [ ] a\n- [ ] b` | `- [ ] b\n- [ ] a` |
| `moveItem(a, {firstIn: H})` | `- [ ] a\n## H\n- [ ] b\n` | `## H\n- [ ] a\n- [ ] b\n` |
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
    `100. [ ] x\n\tlazy\n` it gives `100. [ ] x\n\n     lazy\n`.
  - an NFD title survives `insertItem`
  - `moveItem` never adds or loses a line: across 20 random moves, the sorted texts of
    `splitLines(joinLines(result))` equal those before, on `example.md` and on `example.md` with
    its final newline removed
- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS.
  - Every edit splices whole `Line` objects with `spliceLines`, which sets the endings at the end
    of the file.
  - **In `moveItem`, items change order but the blank-line gaps stay in their slots,** as in the
    table's `moveItem` rows. When an item moves to another section, a gap in the section it
    leaves that no longer sits between two items moves to the end of that section, and the moved
    item is inserted without a gap.
  - Notes are written with a blank line between the title and the notes. They are indented with
    the item's `notesIndent`, and their blank lines are written empty.
- [ ] **Step 3: Commit** with the message "Edit items by replacing only the lines that change".

### Task 7b: Heading and list-note edits

**Files:**
- Create: `src/core/edit-headings.ts`, `src/core/edit-list-note.ts`,
  `tests/core/edit-headings.test.ts`, `tests/core/edit-list-note.test.ts`

**Interfaces:**
- Consumes: `Line`, `splitLines`, `joinLines` and `dominantEol` (Task 1); `ItemBlock`, `Section`,
  `ListModel`, `parseList` and `maskBlocks` (Task 6); `spliceLines` (Task 7a).
- Produces, in `src/core/edit-headings.ts`. Each function returns a new `Line[]`, or `null` where
  its signature says so, and inserts new lines with `dominantEol`.
  - `insertHeading(lines, model, at: { afterItem: ItemBlock } | { afterSection: Section }, text: string): { lines: Line[]; headingLine: number }`.
    This writes `## text`, or `##` when `text` is empty, at the item's or the section's
    `endLine`. A section's `endLine` comes after its hidden archived rows, so they stay in their
    section (spec, "Selecting and adding").
  - `deleteHeading(lines, section): Line[]`
  - `setHeadingText(lines, section, text: string): Line[] | null`. It rewrites only the heading's
    own lines and keeps the heading's level: the `#` run, any indent, any closing `#`s and the line
    ending stay as written. An empty ATX heading such as `##` gets one space between the `#` run
    and the text. A setext heading keeps its `===` or `---` underline, and its content lines
    become one line holding the text. It returns `null` when the result wouldn't parse as a
    heading of the same level whose raw content is exactly `text`. Raw content is the source
    before inline parsing: for an ATX heading, what lies between the `#` run and any closing
    sequence, without leading or trailing spaces and tabs; for a setext heading, its content
    lines.
- Produces, in `src/core/edit-list-note.ts`:
  - `getListNote(lines, model): string`
  - `setListNote(lines, model, markdown: string): Line[]`. When the new note isn't empty and an
    item or heading follows the list note directly, it writes one blank line between them, so a
    note that ends in an HTML block can't swallow the first item (spec, "The list note").
  - `listNoteWouldRestructure(markdown: string): boolean`, true when
    `parseList(splitLines(markdown), 0)` finds a heading or an item
  - `listNoteUnclosedBlock(markdown: string): boolean`, true when
    `maskBlocks(splitLines(markdown), 0).unclosedStart` isn't `null`: the list note opens a fenced
    code block, a `%%` comment or a `$$` math block and never closes it

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
| `setListNote(…, "<div>x</div>")` | `---\nprincelists: true\n---\n- [ ] a\n` | `---\nprincelists: true\n---\n<div>x</div>\n\n- [ ] a\n` (`a` stays an item) |
| `listNoteWouldRestructure` | `Text\n---`; `## H`; `- [ ] x` | `true` |
| `listNoteWouldRestructure` | `Text\n\n---`; `plain *text*`; `- bullet` | `false` |
| `listNoteUnclosedBlock` | `` ```js\ncode ``; `%%\nhidden`; `$$\nx` | `true` |
| `listNoteUnclosedBlock` | `` ```\ncode\n``` ``; `%% inline %%`; `$$x$$`; `plain` | `false` |

- [ ] **Step 2: Run** `npm test`. Expected: FAIL. Then implement and expect PASS. Every edit writes
  through `spliceLines`.
- [ ] **Step 3: Commit** with the message "Edit headings and the list note by replacing only their
  lines".

### Task 8: Draw the list, tick items and hide archived ones

**Files:**
- Create: `src/view/render-list.ts`, `src/view/write.ts`
- Modify: `src/view/list-view.ts`, `styles.css`

**Interfaces:**
- Consumes: `parseList(splitLines(view.text), contentStartLine(view.text))`, `parseItemLine`,
  `isArchived`, `toggleItem`, `RepeatingItemError`, `joinLines` and `guardedApply`.
- Produces:
  - `writeAction(view: PrinceListView, next: string, expected = view.text, refusedNotice = "This list changed elsewhere. Try again."): Promise<boolean>`,
    in `src/view/write.ts`. It first awaits `view.save()` (`TextFileView.save`, public since
    0.10.12) so pending typing is on disk, then runs
    `vault.process(file, cur => guardedApply(cur, expected, next))`. It sets `view.text = next` on
    success, and shows a `Notice` reading `refusedNotice` when the guard refused.

- [ ] **Step 1: Implement the rendering** that the spec's "Layout" describes:
  - the title (the basename)
  - the list note, rendered in gray (as plain text until Task 9)
  - section headings with a rule
  - rows of a checkbox and a title, where the title is `parseItemLine(...).title` with no marks
    or tail shown
  - a done item: ticked and grayed, with no strikethrough
  - archived items left out unless "Show archived" is on
  - "Show archived" as a toggle in `onPaneMenu`. It's a field of the view that starts off, and
    `setViewData` turns it off when `clear` is true, which means the view is opening a different
    file (`TextFileView.setViewData`). Keep it out of the view's `getState` and out of local
    storage, so nothing restores it (spec, "Done and archived").

  Re-render whenever `setViewData` runs.
- [ ] **Step 2: Make the checkbox tick.** A click calls `writeAction(view, joinLines(toggleItem(...)))`,
  using `new Date()`. On `RepeatingItemError` it shows a `Notice` reading "Repeating items can't be
  ticked here yet." The click never opens a card.
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
     and the modification time (`stat -f %m`) before and after, on a copy.
  9. On the Mac, with a list from outside the vault (spec, "Notes outside the vault"): ticking
     writes the file, and an edit made to it in another app while it's open shows in the view.
     First check that the same edit shows in Obsidian's own Markdown view of that note. Then open
     the note from a second test vault's window, with PrinceLists installed there too, and check
     it works as a list there. Record the results in the pull request. If one fails, stop and
     record it in the pull request with the spec's proposed fallback. The owner decides before
     it's built.
- [ ] **Step 5: Commit** with the message "Draw lists, tick items and hide archived ones".

### Task 9: The card, editing, and outside changes

**Files:**
- Create: `src/view/card.ts`, `src/view/notes.ts`
- Modify: `src/view/list-view.ts`, `src/view/render-list.ts`, `styles.css`

**Interfaces:**
- Consumes: `getItemNotes`, `setItemNotes`, `setItemTitle`, `getListNote`, `setListNote`,
  `listNoteWouldRestructure`, `listNoteUnclosedBlock`, `deleteItem`, `mapLine` and `writeAction`.
- Produces:
  - `renderNotes(view: PrinceListView, el: HTMLElement, markdown: string): Component`, in
    `src/view/notes.ts`.
    - It calls `MarkdownRenderer.render(app, markdown, el, file.path, child)` with a fresh child
      `Component`, added through `view.addChild`. The caller passes the child to `removeChild` on
      re-render or close.
    - It delegates `a.internal-link` clicks to `workspace.openLinkText(href, file.path, Keymap.isModEvent(evt))`.
    - When `Platform.isDesktop`, it delegates `contextmenu` on `a.internal-link` too: a new `Menu`,
      filled by `workspace.handleLinkContextMenu(menu, href, file.path)` and shown with
      `menu.showAtMouseEvent(evt)` (spec, "Rendering notes in the card"). On the iPhone it adds
      no link menu.
    - It triggers no `hover-link` event. Page previews wait until Obsidian documents that event's
      payload (spec, "Not in step one").
    - It disables `.task-list-item-checkbox`.
  - `openCard(view, titleLine: number, focusTitle = false): void` and `closeCard(view): void`, in
    `src/view/card.ts`. `openCard` puts the cursor in the title only when `focusTitle` is true,
    so a tap on a row doesn't open the iPhone keyboard. `view.selected` holds the `titleLine` of
    the open item, or `null`. A line number is used because a new item's `ItemBlock` doesn't
    exist until the list is re-parsed.
  - `PrinceListView.focusListTitle(): void`, which puts the cursor in the list title field.

- [ ] **Step 1: Build the card and editing** as the spec's "Ticking", "Editing" and "Selecting
  and adding" sections describe:
  - **The card:** clicking a row (not its checkbox) opens it, and clicking empty space closes it.
    It shows the same checkbox.
  - **The title:** editing it calls `setItemTitle`, with typing saved through `requestSave`.
  - **Notes:** rendered with `renderNotes`, and switched to a `<textarea>` of `getItemNotes` on
    click. They're saved with `setItemNotes` through `requestSave`.
  - **The list note:** edited the same way. While `listNoteWouldRestructure` is true, a gray line
    under the editor reads "A heading or checkbox line here becomes a section or item when
    saved." While `listNoteUnclosedBlock` is true, a second gray line reads "An unclosed block here
    hides the items below it." (spec, "The list note").
  - **The list title:** renamed with `fileManager.renameFile` on Enter or blur. If the name is
    taken, show the `Notice` "A note with that name already exists." and keep the old name.
  - **Empty items:** an item whose title is empty when its card closes is removed with
    `deleteItem`.
  - **An empty list:** shows a gray "Notes" placeholder.
  - **Keys:** Escape closes the card.
  - **`getViewData()` includes text being typed.** Apply each keystroke to `this.text`, so
    Obsidian's own merge on outside changes covers it.
  - **`setViewData(_, false)`** re-renders, but keeps a `<textarea>` that has focus. It updates
    that textarea's item only after blur. It moves `selected` with `mapLine`, and closes the card
    after blur when that returns `null`.
- [ ] **Step 2: Run** `npm run lint && npm run build && npm test`. Expected: PASS.
- [ ] **Step 3: Check it by hand on the Mac.**
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

  If check 6 or 7 fails, stop and record it in the pull request with the spec's proposed
  fallback. The owner decides before it's built.
- [ ] **Step 4: Commit** with the message "Open items into cards and edit titles and notes".

### Task 10: Adding items, menus, and deleting with Undo

**Files:**
- Create: `src/view/menus.ts`, `src/view/add-button.ts`
- Modify: `src/view/list-view.ts`, `src/view/card.ts`, `src/view/render-list.ts`, `styles.css`

**Interfaces:**
- Consumes: `insertItem`, `insertItemInSection`, `insertHeading`, `deleteItem`, `deleteHeading`,
  `setHeadingText`, `mapLine`, `writeAction` and `openCard`.
- Produces: `itemMenu(view, item, menu: Menu): void` and `headingMenu(view, section, menu: Menu): void`.
  Each fills an Obsidian `Menu` with the spec's actions and labels. "Delete" and "Delete heading"
  call `setWarning(true)`, so they show in red (spec, "Item actions").

- [ ] **Step 1: Build adding, menus and Undo:**
  - **The floating "+":** a round button at the bottom right, placed outside the scrolling element
    and drawn with `setIcon(el, "plus")`. It calls `insertItem` after the selected item, or with
    `null`, then `openCard(view, titleLine, true)`, which puts the cursor in the title.
  - **Enter in an item's title** inserts the next item below it and opens it the same way.
  - **New item below and New item,** in `itemMenu` and `headingMenu`, insert with `insertItem`
    after the item or `insertItemInSection` first in the section, then
    `openCard(view, titleLine, true)`.
  - **In an empty list, Enter in the list title starts the first item,** with `insertItem` and
    `after === null`, then `openCard(view, titleLine, true)`.
  - **Right-click on the Mac:** only when `Platform.isDesktop`, `contextmenu` on rows and headings
    opens `itemMenu` or `headingMenu` through `menu.showAtMouseEvent(evt)`. A right-click on a
    link in an open card shows only Obsidian's link menu (Task 9), not the item menu.
  - **No long-press menu on the iPhone:** Obsidian fires `contextmenu` after an 800 ms hold (not
    yet confirmed on a device; spec, "Touch on the iPhone"), so on the iPhone `contextmenu` on
    rows and headings is canceled.
  - **Tapping a heading on the iPhone** (`Platform.isMobile`) opens `headingMenu` through
    `menu.showAtMouseEvent(evt)` on the tap's `click` event (spec, "Item actions").
  - **The card's ⋯ button** opens `itemMenu` through `menu.showAtPosition`, on both platforms.
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
    heading field, as it keeps a focused `<textarea>`. On save, map the heading's line with
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
- Consumes: `moveItem` and `writeAction`.
- Produces: `enableMouseDrag(view: PrinceListView, listEl: HTMLElement): void`. It is enabled only
  when `Platform.isDesktop`.

- [ ] **Step 1: Implement HTML5 drag on rows.** It shows a drop line between visible rows and
  calls `moveItem` with `{ after: <the visible item above the line> }`, or `{ firstIn: <section> }`
  directly under a heading. Hidden archived rows never move (spec, "Selecting and adding").
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
  2. Long-pressing a folder on the iPhone offers "New list". If it doesn't, record that in the 1a
     checks notes (Task 13); the command still covers the phone.
  3. A second new list in the same folder is "Untitled list 1".
- [ ] **Step 5: Commit** with the message "Create lists the same ways as notes".

### Task 13: Finish 1a and start the trial

**Files:**
- Create: `docs/superpowers/notes/<date>-1a-checks.md`
- Modify: the spec (reconcile it)

- [ ] **Step 1: Run the full check on the iPhone in the test vault.** It covers the basics:
  open, tick, add, edit, ⋯ actions, the heading menu and the archived toggle.
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
- [ ] **Step 6: Commit** the notes and the spec with the message "Finish part 1a".
  Open the pull request; the owner merges it.
- [ ] **Step 7: Release `0.1.0`.** The owner pushes the tag `0.1.0` (no `v`); agents never push
  tags (`AGENTS.md`, "Releases"). It comes after the go-public checklist is done, because the
  release's attestation needs a public repository. The release workflow then builds a draft
  release, and the owner reviews and publishes it.
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
