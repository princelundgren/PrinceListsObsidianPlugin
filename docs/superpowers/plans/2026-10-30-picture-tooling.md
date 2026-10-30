# PrinceLists picture tooling Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the demo vault and the scripts that take the README's pictures and the community
listing's screenshots in the repository, retake them all with those scripts, and add a release step
that checks them.

**Architecture:**
- **The demo vault is a folder of the repository,** `demo/vault/`. A copy script writes it to a
  vault folder you give, moving its dates so that what's due today, tomorrow or overdue, and what's
  archived, is the same on any day. The plugin goes in with `npm run install-vault`, as for any
  test vault.
- **Every picture is taken through the DevTools protocol (CDP):** Obsidian runs with a DevTools
  port, and a script connects to it, sets the page's size and scale, drives it with CDP input
  events and saves the page's own pixels. Nothing depends on the screen, the window's place or
  which app is in front, and the same scripts drive Obsidian on an Android emulator.
- **One scene per picture,** each in its own small module: it sets up the view, then takes a still
  or records frames. An encode step turns the result into the published format.

**Tech Stack:** Node.js 22 or later (its global `fetch` and `WebSocket`), and no new npm packages.
New tools outside npm: `ffmpeg` and `cwebp` for encoding, and the Android SDK's emulator and `adb`
for the phone pictures.

**Spec:** issue #201, "Keep the demo vault and picture scripts in the repo, and check the pictures
at each release". No design changes: the scripts aren't part of the plugin. Where the plan departs
from the issue, and why:
- **Obsidian is started by a documented command, not a script.** Each picture script connects to a
  running Obsidian. Starting it is one command per system (`AGENTS.md`, Task 2), and a script
  couldn't do more: a new vault is opened and trusted by hand the first time, the executable's
  place differs by system and install, and an Obsidian that's already running ignores the flag.
- **No third-party plugin is needed.** None of the pictures shows Tasks, Kanban or Editing Toolbar,
  so the demo vault turns on only PrinceLists. `Dashboard.md` and `Projects/Garden board.md` stay,
  since the file explorer shows them, and read as plain Markdown without those plugins.

**How work lands:** as in the earlier plans. Each task is one pull request that the owner
squash-merges, so "Commit with the message X" means the pull request's title is X. Shots run in a
vault made by the copy script, never in a vault with real notes, and the scripts refuse any other.

## Global Constraints

- **Everything in `AGENTS.md` holds,** above all: everything here is public, so no machine names,
  home-directory paths, vault ids or accounts in the scripts, the demo vault or the pull requests.
  Paths and ports are arguments.
- **The scripts live in `scripts/pictures/`,** as `.mjs` modules with tabs and single quotes. Their
  `node:test` tests sit beside them as `*.test.mjs` and run with
  `node --test "scripts/pictures/*.test.mjs"` (a folder argument fails on Node 22 and 24). ESLint
  ignores `scripts/**`, and that stays so.
- **The scripts reach Obsidian through its `app` global,** a debugging handle that `obsidian.d.ts`
  doesn't declare. Through it they call only what `obsidian.d.ts` documents (`app.workspace`,
  `app.vault`, `app.vault.adapter`), never `app.plugins`, `app.commands` or Obsidian's own DOM
  beyond reading where an element is, and adding the drawn pointer or finger mark (`pointer.mjs`),
  which takes no events and which `shoot.mjs` removes when the scene ends. Clicks, keys, touches and drags are CDP
  input events.
- **The published set is taken on macOS,** in English (dates follow Obsidian's language), so
  fonts and labels match from one release to the next. CDP sees only the page, so macOS's window
  buttons, which today's README GIFs show, are gone from the retakes; that's accepted.
- **A DevTools port gives anyone on the machine control of Obsidian, with Node access.** Start
  Obsidian with one only on the demo vault, and quit it afterwards.
- **Sizes:** each picture is taken at 2x its CSS size, except the GIFs, at 1x, and isn't scaled:

  | Picture | Where | Page (CSS px) | Clip (CSS px) | Scale | Theme |
  |---|---|---|---|---|---|
  | `list-desktop.gif`, `archive.gif`, `schedule.gif` | README | 720 x 603 | none | 1 | dark |
  | `tick-and-drag.gif` | README | 390 x 844, phone | none | 1 | light |
  | `embedded-list.webp` | README | 720 x 603 | 540 x 495, the note | 2 | dark |
  | `notes.webp` | README | 720 x 603 | 520 x 610, the card | 2 | dark |
  | `new-list-ribbon.webp`, `new-list-folder.webp`, `turn-into-list.webp` | README | 720 x 603 | 220 x 170, the tooltip or menu | 2 | dark |
  | `desktop-1-groceries`, `-2-schedule`, `-3-rich-notes`, `-5-menu` | listing | 1200 x 800 | none | 2 | dark |
  | `phone-1-groceries`, `-2-collapsed`, `-3-schedule` | listing | 450 x 800, phone | none | 2 | dark |

  The clip's width is the width the README shows the picture at, so its `width` attributes don't
  change. There's no `desktop-4`: the maintainer took it off the listing, and the names match the
  listing's.
- **Encoding:** stills are `cwebp -lossless -z 9`, or `-near_lossless 60 -z 9` where that looks
  the same and is smaller. GIFs come from PNG frames through `ffmpeg`, one palette per GIF, each
  frame shown for as long as it lasted when recorded.

## Review Focus

1. **A vault with real notes.** The copy script writes only into a folder with no notes or one it
   made before (it holds the marker file `.princelists-demo`), and every scene checks for the
   marker through `app.vault.adapter.exists` before it touches anything, stopping with the vault's
   name if it's missing. Pinned by Task 1's and Task 2's tests.
2. **The day the pictures are taken.** Every date in the vault moves by the days between
   `ANCHOR_DAY` and today. Today, Tomorrow, overdue and archived come out the same; weekday names
   and dates further out follow the day of the shot. A release retakes a picture when what it shows
   of the plugin changed, never for its dates. Pinned by Task 1's tests, month, year and leap-day
   ends included.
3. **No pointer in the frames.** CDP saves only the page, so scenes draw a pointer (desktop) or a
   finger mark (phone) and move it with each input event. A still shows it only where its alt text
   names it, as in `new-list-ribbon.webp`. Checked by eye in Tasks 2 and 3.
4. **The wrong page.** With DevTools or a second window open, the client picks the one `page`
   target whose URL is Obsidian's app page, and stops listing the targets if there are none or
   several. Pinned by Task 2's tests.
5. **A copy over a vault Obsidian has open.** Obsidian writes its layout back as it closes, over
   the fresh copy. The copy script says to close the vault first, and the scenes set their own
   leaves, so an old layout changes nothing they show.

---

### Task 1: Put the demo vault in the repository, with a script that copies it

**Files:**
- Create: `demo/vault/`, from the demo vault the maintainer provides: its Markdown notes and
  `Attachments/`, and in `.obsidian/` `app.json`, `appearance.json`, `core-plugins.json`,
  `types.json`, `workspace.json`, `workspace-mobile.json` and `community-plugins.json` holding only
  `princelists`. No `plugins/` folder, no `graph.json`, and not its empty `Untitled.md`.
- Create: `scripts/pictures/demo-vault.mjs`
- Test: `scripts/pictures/demo-vault.test.mjs`
- Modify: `.github/workflows/docs.yml` (run the new tests), `AGENTS.md` (Commands and Layout)

**Interfaces:**
- Produces:
  - `node scripts/pictures/demo-vault.mjs <folder> [--theme dark|light] [--today YYYY-MM-DD]`:
    after `checkTarget`, deletes everything in `<folder>` but the marker and
    `.obsidian/plugins/` (which holds the installed build), writes the demo vault with its dates
    moved, sets `appearance.json`'s `theme` to `obsidian` (dark, the default) or `moonstone`
    (light), and writes the marker. `--today` defaults to the local date.
  - `export const ANCHOR_DAY = '2026-10-28'`: the day the vault's dates were written for, the
    day `list-desktop.gif` shows "return the library books" under Today.
  - `export function shiftDates(text: string, days: number): string`: moves every `YYYY-MM-DD`
    in the text by `days` calendar days and changes nothing else. No file name or link in the
    vault holds a date, so only text moves.
  - `export function checkTarget(folder: string): void`: throws, naming the folder, unless it's
    missing, holds nothing outside `.obsidian/` (a vault just made in Obsidian), or holds
    `.princelists-demo`.

- [ ] **Step 1: Copy the vault in.** Keep `appearance.json`'s `nativeMenus: false`, so menus are
  drawn in the page, where CDP sees them.
- [ ] **Step 2: Write the failing tests**

```js
test('shiftDates moves each date and keeps the time and the rest of the line', () => {
	assert.equal(shiftDates('- [ ] a ⏳ 2026-10-28\n- [x] b ✔ 2026-10-27 07:45\n', 5),
		'- [ ] a ⏳ 2026-11-02\n- [x] b ✔ 2026-11-01 07:45\n');
});
test('shiftDates crosses a year end, a leap day, and goes back', () => {
	assert.equal(shiftDates('2026-12-30', 3), '2027-01-02');
	assert.equal(shiftDates('2028-02-28', 1), '2028-02-29');
	assert.equal(shiftDates('2026-03-01', -1), '2026-02-28');
});
test('checkTarget refuses a folder with a file and no marker', () => {
	// a temp folder holding note.md: throws, and the message holds the folder's path
});
test('checkTarget takes a missing folder, a new vault and an earlier copy', () => {
	// a missing path, a folder holding only .obsidian/app.json, an earlier copy: none throws
});
test('a copy moves the dates, keeps the plugins folder and writes the marker', () => {
	// copy with --today 2026-11-04 over an earlier copy holding .obsidian/plugins/x/main.js:
	// To do.md has "⏳ 2026-11-04" where the vault has "⏳ 2026-10-28", x/main.js is still there,
	// and .princelists-demo exists
});
```

- [ ] **Step 3:** Run `node --test "scripts/pictures/*.test.mjs"`. Expected: FAIL, the module
  doesn't exist.
- [ ] **Step 4:** Write `demo-vault.mjs`. Dates are calendar days counted with `Date.UTC`, so a
  daylight-saving change can't move one by a day.
- [ ] **Step 5:** Run the tests and `node scripts/check-docs.mjs`. Expected: PASS.
- [ ] **Step 6:** In `docs.yml`, run `node --test "scripts/pictures/*.test.mjs"` beside the docs
  check's tests.
- [ ] **Step 7:** In `AGENTS.md`, add `demo/` to Layout, and to Commands: close the vault in
  Obsidian, copy, `npm run build`, `npm run install-vault -- <folder>`. The first time, open the
  folder in Obsidian by hand ("Open folder as vault"), trust it and turn on PrinceLists; after
  that, `obsidian://open?path=<folder>` opens it.
- [ ] **Step 8:** Commit with the message `Keep the demo vault in the repository (#201)`.

### Task 2: Take the README's stills through the DevTools protocol

**Files:**
- Create: `scripts/pictures/cdp.mjs`, `scripts/pictures/shoot.mjs`, `scripts/pictures/encode.mjs`,
  `scripts/pictures/pointer.mjs`, `scripts/pictures/scenes/` (one module per picture)
- Test: `scripts/pictures/cdp.test.mjs`
- Modify: `docs/images/embedded-list.webp`, `new-list-ribbon.webp`, `new-list-folder.webp`,
  `turn-into-list.webp`, `notes.webp`; `README.md` (`notes.webp`'s alt text); `AGENTS.md`
  (Commands and Layout)

**Interfaces:**
- Consumes: a vault made by Task 1.
- Produces:
  - In `cdp.mjs`:
    - `pickPage(targets: {type: string, url: string, webSocketDebuggerUrl: string}[]): string`:
      the `webSocketDebuggerUrl` of the one `page` target whose URL starts with
      `app://obsidian.md` (desktop) or `http://localhost` (Android); throws listing every
      target's type and URL otherwise.
    - `connect(port: number): Promise<Session>`, a `Session` being `send(method, params)`,
      `on(event, handler)` for CDP events, `evaluate(expression)` (awaits a promise, returns the
      value, throws the page's exception text) and `close()`.
    - `checkDemoVault(session): Promise<void>`: throws with the vault's name unless
      `app.vault.adapter.exists('.princelists-demo')`.
  - In `pointer.mjs`: `pointer(session, x, y, state: 'move' | 'down' | 'up' | 'hide')`: moves the
    drawn pointer, or on a phone page the finger mark, to `x, y` in CSS pixels.
  - A scene module: `export default { name, phone: boolean, page: {width, height}, clip?: {x, y,
    width, height} | (session) => Promise<clip>, scale: 1 | 2, theme: 'dark' | 'light',
    setup(session), shoot(session, out) }`.
  - `node scripts/pictures/shoot.mjs --port <port> --out <folder> <scene>...`
  - In `encode.mjs`: `toWebp(png: string, out: string)` and `toGif(frames: {file: string, ms:
    number}[], out: string)`, running `cwebp` and `ffmpeg` and naming the tool that's missing if
    one is.

- [ ] **Step 1: Write the failing tests**

```js
const target = (type, url) => ({ type, url, webSocketDebuggerUrl: `ws://x/${url}` });
const desktop = target('page', 'app://obsidian.md/index.html');
test('pickPage takes the app page among DevTools and a worker', () => {
	assert.equal(pickPage([target('page', 'devtools://devtools/inspector.html'),
		target('service_worker', 'app://obsidian.md/sw.js'), desktop]), desktop.webSocketDebuggerUrl);
});
test('pickPage takes the Android app page', () => {
	const phone = target('page', 'http://localhost/');
	assert.equal(pickPage([phone]), phone.webSocketDebuggerUrl);
});
test('pickPage throws listing the targets when there is no app page', () => {
	assert.throws(() => pickPage([target('page', 'devtools://devtools/inspector.html')]),
		/page devtools:\/\/devtools\/inspector\.html/);
});
test('pickPage throws listing the targets when there are two app pages', () => {
	assert.throws(() => pickPage([desktop, desktop]), /page app:\/\/obsidian\.md\/index\.html/);
});
test('checkDemoVault throws naming the vault when the marker is missing', async () => {
	// a fake session whose evaluate answers false for the marker and 'Notes' for the vault's name
	await assert.rejects(checkDemoVault(fakeSession({ marker: false, name: 'Notes' })), /Notes/);
});
test('checkDemoVault passes a demo copy', async () => {
	await checkDemoVault(fakeSession({ marker: true, name: 'Demo' }));
});
```

- [ ] **Step 2:** Run `node --test "scripts/pictures/*.test.mjs"`: FAIL. Write `cdp.mjs`, run
  again: PASS.
- [ ] **Step 3:** Write `shoot.mjs`: it connects, runs `checkDemoVault`, sets
  `Emulation.setDeviceMetricsOverride` to the scene's page and scale (`mobile: true` on a phone),
  runs `setup` and `shoot`, and closes the session, which drops the override. A still is
  `Page.captureScreenshot` as PNG, with `clip: {…, scale: 1}`, since the page's scale already
  doubles it.
- [ ] **Step 4:** One scene per still, as its README alt text says. `new-list-ribbon` hovers the
  ribbon's list icon with a CDP mouse move and draws the pointer there. `notes` is "Garden"'s open
  item with the caret in its notes.
- [ ] **Step 5:** Start Obsidian with `--remote-debugging-port=<port>` on a fresh copy (dark),
  check that the page's URL is `app://obsidian.md/…` (Review Focus 4), and run the five scenes.
  Expected: each matches the committed picture in what it shows of the plugin, at the new size.
  Replace the five.
- [ ] **Step 6:** In `README.md`, change `notes.webp`'s alt text from "with the format bar under
  the line being edited" to "with the format bar under the notes".
- [ ] **Step 7:** In `AGENTS.md`, add `scripts/pictures/` to Layout, and to Commands the `shoot.mjs`
  row and how to start Obsidian with a DevTools port: on macOS `open -a Obsidian --args
  --remote-debugging-port=<port>`, on Windows and Linux the executable with the same flag, with
  Obsidian quit first. Say what the port allows (Global Constraints).
- [ ] **Step 8:** Commit with the message `Take the README's stills with a script (#201)`.

### Task 3: Record the README's GIFs on desktop and on an Android emulator

**Files:**
- Create: `scripts/pictures/record.mjs`, `scripts/pictures/push-vault.mjs`, and scenes for
  `list-desktop`, `archive`, `schedule` and `tick-and-drag`
- Test: `scripts/pictures/push-vault.test.mjs`
- Modify: `docs/images/list-desktop.gif`, `archive.gif`, `schedule.gif`, `tick-and-drag.gif`;
  `README.md` (`list-desktop.gif`'s alt text); `AGENTS.md` (Commands)

**Interfaces:**
- Consumes: `connect`, `checkDemoVault`, `pointer`, the scene shape and `toGif` from Task 2.
- Produces:
  - `record(session, act: () => Promise<void>, folder: string): Promise<{file, ms}[]>`: PNG frames
    from `Page.startScreencast`, each acknowledged and saved with the time it arrived, while `act`
    runs.
  - `node scripts/pictures/push-vault.mjs --port <port> <folder>`: writes a copy made by Task 1,
    and the build's three files into `<configDir>/plugins/princelists/`, into the vault Obsidian
    has open on the emulator, through `app.vault.adapter`. It refuses a vault that holds files
    outside `<configDir>` and no marker, as `checkTarget` does, and first removes everything but
    the marker and `<configDir>/plugins/`.
  - `export function filesToPush(folder: string): {path: string, base64: string}[]`, the vault's
    files with their paths inside it.

- [ ] **Step 1:** Write the failing test, then `push-vault.mjs`, and run the tests: PASS.

```js
test('filesToPush lists every file once, with its path inside the vault', () => {
	// a temp folder holding .princelists-demo, To do.md and Attachments/suitcase.jpg:
	// the paths, sorted, are ['.princelists-demo', 'Attachments/suitcase.jpg', 'To do.md'],
	// with '/' on every system, and suitcase.jpg's base64 decodes to its bytes
});
```
- [ ] **Step 2:** Write `record.mjs`.
- [ ] **Step 3:** The desktop scenes, each as its alt text says: `list-desktop` adds an item with a
  title, notes with a link and a picture, a star and a day, drags it into place and ticks another;
  `archive` ticks an item, then shows the archived items and hides them; `schedule` opens the
  Schedule from the ribbon and scrolls it. Rows drag with HTML drag and drop, and the picture comes
  in by a drop, so both go through `Input.setInterceptDrags` and `Input.dispatchDragEvent`. The
  dropped file is `demo/vault/Attachments/raised-bed.jpg` in the repository, its absolute path
  found from the script's own (`import.meta.url`), since `DragData.files` takes paths on the
  machine. If Obsidian ignores the synthetic drop, stop and raise it in the pull request, as
  `AGENTS.md` asks, rather than working around it. Change `list-desktop.gif`'s alt text from "a
  pasted picture" to "a dropped picture".
- [ ] **Step 4:** The emulator, once: a Google Play system image, Obsidian from Play, a vault made
  in it by hand with community plugins on, and PrinceLists turned on after the first push. Then
  each time: `adb shell pidof md.obsidian`, `adb forward tcp:<port>
  localabstract:webview_devtools_remote_<pid>`, `push-vault.mjs` with a light copy, then `adb shell
  am force-stop md.obsidian`, start it again, and forward again with the new pid.
- [ ] **Step 5:** The `tick-and-drag` scene on the 390 x 844 phone page: tick `bananas`, then hold
  `greek yogurt` and drag it onto `spinach` with `Input.dispatchTouchEvent`, the finger mark drawn.
- [ ] **Step 6:** Record each against a fresh copy and look at every frame of each GIF: the pointer
  or finger shows where each input lands, and nothing from outside the demo vault shows. Replace
  the four.
- [ ] **Step 7:** Add the `push-vault.mjs` and emulator steps to `AGENTS.md`'s Commands.
- [ ] **Step 8:** Commit with the message `Record the README's GIFs with a script (#201)`.

### Task 4: Take the listing's screenshots, and check the pictures at each release

**Files:**
- Create: scenes for the seven listing shots; `docs/listing/` with their `.webp` files
- Modify: `AGENTS.md` (Releases)

**Interfaces:**
- Consumes: Tasks 1 to 3.

- [ ] **Step 1:** The scenes, all dark: `desktop-1-groceries` (Groceries with "greek yogurt"'s
  notes open), `desktop-2-schedule` (Groceries beside the Schedule), `desktop-3-rich-notes` ("fresh
  basil"'s notes in the editor: formatted text, a link, and a checklist whose caret line draws its
  box, as 1.1.0 does), `desktop-5-menu` (an item's right-click menu); on the emulator
  `phone-1-groceries`, `phone-2-collapsed` (sections collapsed) and `phone-3-schedule`.
- [ ] **Step 2:** Shoot all seven into `docs/listing/` and check each by eye against 1.1.0. Keeping
  them in the repository is a (call): the release step compares against them, and the maintainer
  uploads them from there.
- [ ] **Step 3:** In `AGENTS.md`'s Releases, before tagging: check the README's pictures and
  `docs/listing/` against the release, and retake with the scripts, in the version pull request,
  any whose view of the plugin changed. After publishing, the maintainer uploads any changed
  listing shot. The README loads its pictures from `main`, so a retake shows there once it merges.
- [ ] **Step 4:** Run `node scripts/check-docs.mjs`. Expected: PASS.
- [ ] **Step 5:** Commit with the message
  `Take the listing's screenshots with a script, and check them at each release (#201)`. The pull
  request asks the maintainer to upload `desktop-3-rich-notes.webp` to the listing in place of
  the one taken before 1.1.0.
