# PrinceLists: instructions for coding agents

These instructions are for any coding agent working in this repository (Claude Code, Codex, Copilot,
Cursor and others), and they hold for human contributors too. They adapt the `AGENTS.md` that ships
with [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) to
this project.

## Project overview

- **An Obsidian community plugin** that shows plain Markdown notes as todo lists. It's written in
  TypeScript and bundled to `main.js`, which Obsidian loads.
- **Targets:** Obsidian on desktop and mobile: macOS, Windows, Linux, iOS, iPadOS and Android.
  `isDesktopOnly` is `false`. Hands-on checks have run on macOS, an iPhone (step one), an
  Android emulator (step two) and Windows so far.
- **Release artifacts:** `main.js`, `manifest.json` and `styles.css`.
- **Read before working:**
  - [The design](docs/superpowers/specs/2026-10-20-prince-lists-design.md) says what the plugin does
    and why, and [step two's design](docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md)
    adds what step two builds. [Notes in one editor](docs/superpowers/specs/2026-10-29-notes-in-one-editor-design.md)
    replaces step two's block-at-a-time notes once it's built.
    - Decisions marked **(owner)** are the maintainer's. Don't change one without an issue the
      maintainer agrees to.
    - Decisions marked **(call)** are open to a better argument.
  - The plans in `docs/superpowers/plans/` give the tasks, with exact interfaces and tests. The
    current one is [step two](docs/superpowers/plans/2026-10-27-prince-lists-step-2.md). Implement
    a task as written, one task per pull request.
  - [CONTRIBUTING.md](CONTRIBUTING.md) covers the pull request process.

## Rules that are never broken

- **Everything here is public:** files, commit messages, and pull request and issue text. State
  the requirement and its reason. Never write personal details, yours or the maintainer's
  (vaults, notes, machines, accounts, other projects, history), or anything from an employer's
  work.
- **Documented Obsidian APIs only.**
  - Check `node_modules/obsidian/obsidian.d.ts` and [docs.obsidian.md](https://docs.obsidian.md)
    before using an API.
  - No monkey-patching, no private APIs (`(app as any)…`), and no reaching into Obsidian's own DOM.
  - If no documented route exists, stop and raise it in the issue or the pull request. Don't
    work around it.
- **Never rewrite a list file.**
  - An edit replaces only the lines it concerns. Every byte outside those lines stays as it was.
  - It keeps the file's line endings and whether it ends with a newline. A line that moves off
    the end takes the file's usual ending, and the new last line takes the old last line's ending.
    In a file without a final newline, empty lines an edit would leave at the end go.
  - Never call `String.prototype.normalize` in `src/`. Tests may, to build NFD input.
  - Never re-serialize the frontmatter: no `fileManager.processFrontMatter`.
- **No background writes.** Write a file only in response to a user action: in the view, or a
  command, ribbon icon or menu item such as New list. Never write on open, close or a timer.
- **No telemetry of any kind, and no network requests** unless one is agreed on in an issue first
  (the design's privacy rule). Obsidian's developer policies require any network use to be
  disclosed in the README. A picture linked from the web in a rendered note loads through
  Obsidian's renderer, as in any note; that is decided and disclosed in the README (the design's
  privacy rule).
- **It must work on mobile:** no Node.js or Electron APIs in `src/`.
- **Styling:** use only Obsidian's CSS variables and its built-in icons (`setIcon`, Lucide). Never
  hard-code colors.
- **Listeners:**
  - Workspace, vault, metadata cache, `window` and `document` listeners go through
    `registerEvent` or `registerDomEvent`, so the plugin unloads cleanly.
  - The view's own elements use one delegated listener per container.
- **Interface text** is in sentence case.
- **Stable IDs:** never change the plugin `id` (`princelists`), command IDs or the view type once
  they're released.
- **No default hotkeys** on commands (Obsidian's plugin guidelines).
- **Dependencies:** no UI framework, and `commonmark` is the only runtime dependency. Adding one
  needs an issue or a plan task that names it. The design allows one small drag library if touch
  dragging needs it.
- **`minAppVersion`:** using an API whose `@since` is newer than `minAppVersion` in
  `manifest.json` means raising it. Say so in the pull request.
- **Code style:** follow `.editorconfig`: tabs and single quotes in code. Snippets in the plan
  show the logic, not the formatting.

## Commands

The docs check needs only Node.js 22 or later, and CI runs it:

| Command | What it does |
|---|---|
| `node scripts/check-docs.mjs` | Check the docs for British spellings, the letters a-ring, a-umlaut and o-umlaut, home-directory paths and broken links |
| `node scripts/check-docs.mjs --pr-title="<title>" --pr-body-file <file>` | Also check a pull request's title, and its description saved in `<file>`: the template's five parts, 400 words at most |
| `node --test scripts/check-docs.test.mjs` | Run the docs check's tests |

The project's npm commands:

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Build in watch mode |
| `npm run build` | Type-check and build `main.js` for production |
| `npm test` | Run the unit tests (vitest) |
| `npm run lint` | ESLint with `eslint-plugin-obsidianmd`, Obsidian's own lint rules for plugins. Any warning fails it |
| `npm run install-vault -- <path>` | Copy the build into a vault's `.obsidian/plugins/princelists/` |

## Layout

- **`src/main.ts`:** the plugin lifecycle only (load, unload, registering things).
- **`src/core/`:** pure TypeScript with no Obsidian imports: the line model, item lines, the
  archived rule, parsing and edits. Every change here comes with unit tests.
- **`src/obsidian/` and `src/view/`:** the Obsidian glue and the user interface.
- **`tests/`:** vitest tests and Markdown fixtures.
- **`scripts/`:** Node scripts that aren't part of the plugin, such as the docs check. Its
  `node:test` tests sit beside it, outside `tests/`, because vitest collects the test files there.
- **File size:** keep each file under about 300 lines; split by responsibility.

## Working on a change

- **Start from an issue or a plan task,** except for small fixes, and read the design section it
  touches.
- **In `src/core/`, write the failing test first,** then the code.
- **Before opening a pull request:**
  - `npm run lint`, `npm run build` and `npm test` pass.
  - The docs check passes, on the docs and on the title and description (see Commands).
  - The template's five parts are filled in, in 400 words or fewer.
  - Each commit does one thing, with a message that says what and why.
- **Keep the design true.** If a change makes the design describe something that's no longer so,
  update the design in the same pull request. If the code looks wrong against the design, raise it
  instead of rewriting the design.
- **Manual checks run in a test vault,** never in a vault with real notes.
- **Never commit** `main.js`, `node_modules/` or secrets.

## Releases

Only the maintainer releases.

1. **Bump the version in a pull request.** Set `minAppVersion` in `manifest.json` if it changes,
   then run `npm version patch|minor|major --no-git-tag-version`. That updates `package.json`,
   `package-lock.json`, `manifest.json` and `versions.json`.
2. **Tag after the merge.** Tag that commit on `main` with exactly the version (`x.y.z`, no `v`)
   and push the tag. The release workflow waits for the maintainer's approval in the `release`
   environment, stops if the tag isn't `manifest.json`'s version, then builds a draft release with
   an attestation.
3. **Publish.** The maintainer reviews the draft and publishes it.

Agents never push to `main`, merge pull requests, push tags or publish releases.

## References

- [Obsidian plugin docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Obsidian's ESLint plugin](https://github.com/obsidianmd/eslint-plugin)
