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
    replaced step two's block-at-a-time notes.
    - Decisions marked **(owner)** are the maintainer's. Don't change one without an issue the
      maintainer agrees to.
    - Decisions marked **(call)** are open to a better argument.
  - The plans in `docs/superpowers/plans/` give the tasks, with exact interfaces and tests. The
    latest one for the plugin is [notes in one editor](docs/superpowers/plans/2026-10-29-notes-in-one-editor.md),
    and [picture tooling](docs/superpowers/plans/2026-10-30-picture-tooling.md) covers the
    README's and the listing's pictures. Implement a task as written, one task per pull request.
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
- **Dependencies:** no UI framework. The runtime dependencies are `commonmark`, and
  `@codemirror/lang-markdown` and `@lezer/markdown` for the notes editor. Adding one needs an issue
  or a plan task that names it. The design allows one small drag library if touch dragging needs it.
  A bump of either editor package reruns the notes design's risk 1: the packages they need from
  Obsidian must ship with Obsidian at `minAppVersion`.
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

The README's pictures and the community listing's screenshots are taken in a copy of the demo
vault, `demo/vault/`. Never open `demo/vault/` itself in Obsidian, which rewrites a vault's
workspace files when it opens it. These need Node.js 22 or later too:

| Command | What it does |
|---|---|
| `node scripts/pictures/demo-vault.mjs <folder> [--theme dark\|light] [--today YYYY-MM-DD]` | Copy the demo vault into `<folder>`, its dates moved from the day they were written for to today. It writes only into a folder with no notes or an earlier copy, never through a linked `.obsidian/`, and keeps `.obsidian/plugins/` |
| `node --test "scripts/pictures/*.test.mjs"` | Run the picture scripts' tests. Quote the glob so Node expands it in every shell; a folder argument fails on Node 22 and 24 |
| `node scripts/pictures/shoot.mjs --port <port> --out <folder> <scene>...` | Take the named scenes in `scripts/pictures/scenes/` from a demo vault that Obsidian has open with a DevTools port, writing each as `<scene>.webp` or `<scene>.gif` in `<folder>`. It needs `cwebp` and `ffmpeg`, and stops unless the vault is a copy in the scene's theme with "Native menus" off |
| `node scripts/pictures/push-vault.mjs --port <port> <folder>` | Write the copy in `<folder>` and the build into the vault Obsidian has open on an emulator, after removing everything in it but its plugins. It stops if the open vault has notes and isn't a copy |

To make a demo vault: close an earlier copy in Obsidian if it's open, run the copy script, then
`npm run build` and `npm run install-vault -- <folder>`. The first time, open the folder in
Obsidian with "Open folder as vault", trust it and turn on PrinceLists. After that,
`obsidian://open?path=<absolute path to the folder's Groceries.md, URI-encoded>` opens it.

To take pictures, quit Obsidian, then start it with a DevTools port: on macOS
`open -a Obsidian --args --remote-debugging-port=<port>`, on Windows and Linux Obsidian's
executable with the same flag. A DevTools port lets any program on the machine control Obsidian,
with Node.js access, so open only the demo vault while it's on, in Obsidian's only window, and quit
Obsidian when the pictures are done.

The phone pictures, `tick-and-drag` and the `phone-` scenes, run on an Android emulator with Obsidian
installed. The first time, make a new vault in Obsidian there and turn on community plugins. Then
each time, with `adb`:

1. Forward the port: `adb shell pidof md.obsidian`, then
   `adb forward tcp:<port> localabstract:webview_devtools_remote_<pid>`.
2. Make a copy in the scene's theme (`tick-and-drag` is light, the `phone-` scenes dark) and run
   `push-vault.mjs` on it.
3. Restart Obsidian, so it reads the files: `adb shell am force-stop md.obsidian`, then
   `adb shell am start -n md.obsidian/.MainActivity`. After the first push, trust the vault there.
4. Forward the port again, since the pid changed, and run `shoot.mjs` on it.

The forward gives any program on the machine the same control as a DevTools port, so keep only the
demo vault on the emulator and end it with `adb forward --remove tcp:<port>`.

## Layout

- **`src/main.ts`:** the plugin lifecycle only (load, unload, registering things).
- **`src/core/`:** pure TypeScript with no Obsidian imports: the line model, item lines, the
  archived rule, parsing and edits. Every change here comes with unit tests.
- **`src/obsidian/` and `src/view/`:** the Obsidian glue and the user interface.
- **`tests/`:** vitest tests and Markdown fixtures.
- **`demo/vault/`:** the demo vault the pictures are taken in: made-up lists, notes and drawn
  pictures. The docs check reads its notes like any other doc.
- **`docs/listing/`:** the community listing's screenshots, which the release step compares against
  and the maintainer uploads from.
- **`scripts/`:** Node scripts that aren't part of the plugin, such as the docs check. Its
  `node:test` tests sit beside it, outside `tests/`, because vitest collects the test files there.
  `scripts/pictures/` copies the demo vault and takes the README's stills and GIFs and the listing's
  screenshots, one scene module per picture in `scenes/`. A scene that changes a note puts it back
  when it ends. The scripts reach Obsidian through its `app` global, calling only what
  `obsidian.d.ts` documents. They read the page only to find elements, where they are, which folders
  are open and whether it's a phone's, act through DevTools input events, and add only the drawn
  pointer (`pointer.mjs`).
- **File size:** keep each file under about 300 lines; split by responsibility.

## Working on a change

- **Start from an issue or a plan task,** except for small fixes, and read the design section it
  touches.
- **In `src/core/`, write the failing test first,** then the code.
- **Before opening a pull request:**
  - `npm run lint`, `npm run build` and `npm test` pass.
  - The docs check passes, on the docs and on the title and description (see Commands).
  - The template's five parts are filled in, in 400 words or fewer.
  - Each commit does one thing, with a message that says what and why. A commit over about 300
    changed lines is one mechanical change, or no part of it could pass lint, build and tests
    alone, and the description says why. `package-lock.json`, `.snap` files and a merge of the base
    branch don't count, and a deleted file counts as one line.
- **Keep the design true.** If a change makes the design describe something that's no longer so,
  update the design in the same pull request. If the code looks wrong against the design, raise it
  instead of rewriting the design.
- **Manual checks run in a test vault,** never in a vault with real notes.
- **Never commit** `main.js`, `node_modules/` or secrets.

## Releases

Only the maintainer releases.

1. **Check the pictures and the README, in the pull request that bumps the version.**
   - Compare the README's pictures and `docs/listing/` with the release, and retake with the scripts
     any whose view of the plugin changed. The README loads its pictures from `main`, so a retake
     shows there once it merges.
   - Compare the README's text (Full feature list, Good to know, Quick start) with the pull requests
     merged since the last tag.
2. **Bump the version in a pull request.** Set `minAppVersion` in `manifest.json` if it changes,
   then run `npm version patch|minor|major --no-git-tag-version`. That updates `package.json`,
   `package-lock.json`, `manifest.json` and `versions.json`.
3. **Tag after the merge.** Tag that commit on `main` with exactly the version (`x.y.z`, no `v`)
   and push the tag. The release workflow waits for the maintainer's approval in the `release`
   environment, stops if the tag isn't `manifest.json`'s version, then builds a draft release with
   an attestation.
4. **Publish.** The maintainer adds the release notes to the draft, reviews it and publishes it,
   then uploads any changed `docs/listing/` shot to the listing.
5. **Read the directory's review.** The directory checks for new releases periodically and
   reviews each one. To see the review now, the maintainer signs in at
   [community.obsidian.md](https://community.obsidian.md), opens PrinceLists, selects **Check for
   new releases** in its **...** menu, then reads the results. An error is fixed in a patch
   release, from step 1, and a warning where it can be. A recommendation the README's "Good to
   know" already discloses stays.

Agents never push to `main`, merge pull requests, push tags or publish releases.

### Release notes

The notes live only in the GitHub release, and are written for people using the plugin. Leave out a
section with nothing in it, and any change they wouldn't notice, such as docs, tests or tooling.
Name only the checks that ran on this release.

```markdown
One sentence on what this release gives you.

**Before you update:** only when something needs it, such as a new minimum Obsidian version.

### New
- What you can now do (#123)

### Improved
- What works better (#123)

### Fixed
- What no longer goes wrong (#123)

### Removed
- What's gone, and why (#123)

Checked by hand with Obsidian x.y.z on <the platforms checked>.

**Install:** in Obsidian, go to Settings → Community plugins → Browse and search for PrinceLists, or open its [listing](https://community.obsidian.md/plugins/princelists).

**Install by hand instead:** put `main.js`, `manifest.json` and `styles.css` in `<vault>/.obsidian/plugins/princelists/`, replacing any old files, then reload Obsidian or turn PrinceLists off and on.

The files carry a build attestation: `gh attestation verify main.js --repo princelundgren/PrinceListsObsidianPlugin`
```

## References

- [Obsidian plugin docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Obsidian's ESLint plugin](https://github.com/obsidianmd/eslint-plugin)
