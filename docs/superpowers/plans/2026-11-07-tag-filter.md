# PrinceLists filtering by tag Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an item's tags on its row and card, and filter a list and the Schedule by the tags its
items carry, from a strip above the rows.

**Architecture:**
- **Core decides every rule.** What a tag is, an item's tags, whether an item carries the lit tags,
  what the strip lists, and adding or removing a tag on a line are pure functions in `src/core/`,
  written test first. The views only draw and pass the lit tags in, as they pass the text matcher.
- **One tag rule.** `src/core/tags.ts` says which text after a `#` is a tag. The `Tag` parser in
  `obsidian-markdown.ts`, which Clear formatting uses, and the item reader both call it.
- **A title's tags come from the parser, a tail's from Tasks' fields.** A title is Markdown, so its
  tags are the `Tag` nodes `obsidianMarkdown` finds, which leaves out a `#` in a link or inline
  code. A tail's tags are the hashtag fields `parseItemLine` already peels off from the right, kept
  where their text is a tag by the rule.
- **Lit tags live on the view, like `starredOnly`:** an array of tags as the strip shows them, empty
  each time a view opens.

**Tech Stack:** as in step two. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-07-tag-filter-design.md`, "the design" below. It leans on
[step one](../specs/2026-10-20-prince-lists-design.md) and [step
two](../specs/2026-10-27-prince-lists-step-2-design.md), cited by heading.

**How work lands:** as in step two. Each task is one pull request that the owner squash-merges, so
"Commit with the message X" means the pull request's title is X. Each pull request checks the design
against the change and updates it, or says in one line that it still holds. The design is
`status: approved` from this plan's pull request, the owner having merged it. Task 1 sets its
`status: building` and `governs: [src/**, styles.css]`, as the other plugin designs govern, and the
last task sets `status: live` and `verified`. Manual checks run in a test vault, on desktop and on a phone
or Android emulator where the task says mobile.

## Global Constraints

- **Everything in `AGENTS.md` holds,** and so does every earlier plan's Global Constraints.
- **`minAppVersion` stays 1.13.4.** `AbstractInputSuggest` is `@since` 1.4.10, its
  `getSuggestions` 1.5.7 and `selectSuggestion` 1.6.6 (`obsidian.d.ts`).
- **Styling:** chips use Obsidian's tag variables (`--tag-size`, `--tag-color`, `--tag-background`,
  `--tag-border-color`, `--tag-border-width`, `--tag-padding-x`, `--tag-padding-y`,
  `--tag-radius`, `--tag-weight` and their `-hover` forms, from Obsidian's "Tag" CSS variables
  page). A lit strip tag uses `--interactive-accent` and `--text-on-accent`. No `:has()`.
- **Targets:** strip tags, the clear button, the card's tag button and each chip's × are at least
  24 by 24 CSS pixels.
- **Interface text, exactly:** setting "Tag strip", options "Always" and "While filtering"; tooltip
  "Clear tags"; card button "Add tag"; a chip's × "Remove tag"; the type-ahead's placeholder "Tag"
  and its last suggestion "New tag: #name".
- **Every regex with `\p{…}` has the `u` flag;** the Tasks patterns in `item-line.ts` keep theirs
  without it.
- **Files stay under about 300 lines:** `list-view.ts` and `schedule-view.ts` are already over and
  `events.ts` is close, so new view code goes in new files, and those three only gain fields and
  one-line calls.
- **Comments the change makes false** are rewritten in the same task; each task names the ones it
  knows of.
- **A tag is lit when it is `sameTag` as a lit tag,** never by `===`: a lit tag's casing can differ
  from the strip's after an edit.

## Review Focus

1. **A tag glued to the next field,** as in `- [ ] Fries #frozen⏳ 2026-11-08`: Tasks reads
   `#frozen` and the When, so the item carries `frozen`, and removing it leaves `- [ ] Fries
   ⏳ 2026-11-08`, with the space kept so the When doesn't touch the title. Task 3.
2. **An emoji tag,** `#🧊`, `#👨‍👩‍👧` (with joiners) and `#❄️` (with U+FE0F): each one tag,
   whole, in a title and in a tail, and Clear formatting leaves each whole. Task 1.
3. **A lit tag no item carries any more,** after an edit in another app: the strip still shows it,
   lit, and "No items match" shows. Task 2 (core) and Task 5 (the view).
4. **Typed text in the type-ahead that isn't a tag:** `#`, `# frozen`, `1984`, `frozen pantry`.
   No "New tag" is offered, and Enter writes nothing. Task 6 (core `tagChoices`).
5. **A stored "Tag strip" value from a later version or a hand edit,** such as `"never"`: it reads
   as "Always". Task 5.

---

### Task 1: One tag rule, used by Clear formatting

**Files:**
- Create: `src/core/tags.ts`
- Modify: `src/core/obsidian-markdown.ts:33-46` (the `Tag` parser)
- Modify: the design's header and "An item's tags"
- Test: `tests/core/tags.test.ts`, `tests/core/clear-formatting.test.ts`

**Interfaces:**
- Produces:
  - `tagBodyAt(text: string): string | null`: the tag body at the start of `text`, which is the
    text right after a `#`: the longest run of tag characters, or null when there is none or every
    character in it is `\p{N}`, `\p{M}` or U+200D (so `#1984` and an invisible tag aren't tags).
    Tag characters: `\p{L}`, `\p{N}`, `\p{M}`, `_`, `-`, `/`, U+200D, and any `\p{S}` outside
    ASCII, which takes in emoji, their modifiers and the regional indicators, and symbols such as
    `€` and `°` (Obsidian Help, "Tags": "commonly accepted Unicode characters, including emojis
    and other symbols"). ASCII symbols such as `+`, `$` and `^` aren't tag characters.
  - `isTagBody(text: string): boolean`: `tagBodyAt(text) === text`.
  - `sameTag(a: string, b: string): boolean`: equal ignoring case, with `toLocaleLowerCase()` on
    neither side (`toLowerCase()` both), so it doesn't depend on the device's language.
  - `tagOfTyped(typed: string): string | null`: `typed` trimmed, one leading `#` dropped, if what's
    left is a tag body; else null.

- [ ] **Step 1: Write the failing tests** in `tests/core/tags.test.ts`:
  - `tagBodyAt reads letters, numbers, _ - / and marks`: `'frozen rest'` → `'frozen'`,
    `'shop/frozen'` → `'shop/frozen'`, `'a_b-c'` → `'a_b-c'`, `'café'` (NFD, built with
    `normalize('NFD')`) → the whole word.
  - `tagBodyAt reads emoji whole`: `'🧊'`, `'\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'` (a family, with joiners), `'❄️'`, `'🇸🇪'`, `'frozen🧊'` → each whole.
  - `tagBodyAt needs a character that isn't a number`: `'1984'` → null, `'1984x'` → `'1984x'`,
    `''` → null, `' frozen'` → null, `'.x'` → null, `'\u200D\uFE0F'` (a joiner and U+FE0F, written as escapes) → null.
  - `tagBodyAt reads symbols outside ASCII`: `'a€b'` → `'a€b'`, `'20°'` → `'20°'`; and stops at
    ASCII ones: `'a+b'` → `'a'`, `'a$'` → `'a'`.
  - `tagBodyAt stops at punctuation`: `'frozen.'` → `'frozen'`, `'frozen,pantry'` → `'frozen'`,
    `'frozen#x'` → `'frozen'`, `'frozen;'` → `'frozen'`.
  - `sameTag ignores case only`: `('Frozen','frozen')` true, `('shop','shop/frozen')` false.
  - `tagOfTyped`: `'#frozen'` and `' frozen '` → `'frozen'`; `'#'`, `'# frozen'`, `'1984'`,
    `'frozen pantry'`, `'##frozen'` → null.
- [ ] **Step 2: Add to `tests/core/clear-formatting.test.ts`:** `keeps an emoji tag whole`: Clear
  formatting over `*a* #❄️-_x_` with the selection on all of it removes only the `*` marks,
  leaving `a #❄️-_x_`. Today's parser stops the tag at `❄`, so `-_x_` reads as emphasis after
  punctuation and is cleared to `#❄️-x`: this test fails before Step 4. (An all-number body can't
  be shown through Clear formatting, since such a body always ends before a character that isn't a
  tag character; the `tagBodyAt` tests cover it.)
- [ ] **Step 3: Run** `npx vitest run tests/core/tags.test.ts tests/core/clear-formatting.test.ts`.
  Expected: FAIL, `tags.ts` not found, and the emoji case fails.
- [ ] **Step 4: Implement `src/core/tags.ts`,** and make the `Tag` parser call `tagBodyAt` in place
  of `TAG_BODY`, keeping its check of the character before the `#`.
- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 6: Check by hand** in a test vault, on desktop and on an iPhone (the iOS regex bug
  `item-line.ts:24-26` notes is why its patterns have no `u` flag): a note holding
  `#👨‍👩‍👧 #❄️ #🇸🇪 #a€b #frozen; #1984 #a+b`. Record in the pull request which of these Obsidian
  draws as tags and how far each reaches, against `tagBodyAt`. A difference is fixed in the rule
  and its tests in this task.
- [ ] **Step 7: Update the design.** Header: `status: building`, `governs: [src/**, styles.css]`. In
  "An item's tags", the design says the notes editor's `Tag` parser: the parser is Clear
  formatting's (the notes editor itself reads no tags), so the sentence names Clear formatting, and
  "the notes editor follows" becomes "Clear formatting follows". Risk 2 likewise. Also in "An
  item's tags": a tail field such as `#frozen;` stays a Tasks field, hidden, and isn't a tag here,
  though Obsidian reads `#frozen` in it (a call: the tail's fields are Tasks' and are read whole).
- [ ] **Step 8: Commit** "Read tags as Obsidian does, emoji included, in Clear formatting (#325)".

### Task 2: An item's tags, and which items the lit tags show

**Files:**
- Create: `src/core/item-tags.ts`
- Modify: `src/core/item-line.ts` (export `splitTail`, add `tailFields`), `src/core/when.ts` (use
  the exported `splitTail`), `src/core/tags.ts`, `src/core/display.ts`, `src/core/schedule.ts`
- Modify: every caller that builds a `RowFilter` or `ScheduleFilter`, with `tags: []` for now:
  `src/view/render-list.ts:173`, `src/view/list-block.ts`, `src/view/schedule-view.ts:279`
- Modify, since `tsconfig.json` type-checks `tests/`: every `RowFilter` literal
  (`tests/core/render-timing.test.ts:37`, `tests/core/editing.test.ts:166`,
  `tests/core/display.test.ts:18,219,263,293,322`), every `ScheduleFilter` literal
  (`tests/core/schedule.test.ts:165,195,202`), every `ScheduledItem` literal
  (`tests/core/schedule.test.ts:95,119,151`), and the `row()` helper at `display.test.ts:21`,
  which gains `tags: []` and `tailTags: []` so its `toEqual`s hold. `grep -rn "starredOnly:"
  tests src` finds any left.
- Modify the comments this makes false: `display.ts:64-66` and `:99`, `schedule.ts:88-89`,
  `render-list.ts:171-172`.
- Test: `tests/core/item-tags.test.ts`, `tests/core/tags.test.ts`, `tests/core/display.test.ts`,
  `tests/core/schedule.test.ts`, `tests/core/item-line.test.ts`,
  `tests/core/render-timing.test.ts`

**Interfaces:**
- Consumes: `tagBodyAt`, `isTagBody`, `sameTag` (Task 1).
- Produces:
  - In `item-line.ts`: `splitTail(tail: string): { fields: string; end: string }`, moved from
    `when.ts` unchanged; and `tailFields(fields: string): { from: number; to: number }[]`, the
    fields `parseItemLine` peels off, left to right, without the whitespace between them, found
    with the same `TRAILING_FIELDS` loop (one loop, used by both).
  - In `item-tags.ts`: `itemTags(line: string): { tags: string[]; tailTags: string[] }`, or empty
    arrays for a line that isn't an item. `tailTags`: the tail's fields that are `#` and a tag body,
    as written, without `#`. `tags`: the title's `Tag` nodes, then `tailTags`. The title is
    parsed with `obsidianMarkdown` as `asInline(plain)` (`src/core/inline.ts:28`), with the star
    split off first, so it reads as the renderer draws it; a title with no `#` isn't parsed at
    all, since a parse per item runs several times per redraw. Both lists keep the first of tags
    that are `sameTag`.
  - In `tags.ts`:
    - `carriesTags(tags: readonly string[], lit: readonly string[]): boolean`: every lit tag is
      `sameTag` as one of `tags`, or is a parent of one: `t.toLowerCase().startsWith(l.toLowerCase() + '/')`.
    - `stripTags(carried: Iterable<readonly string[]>, lit: readonly string[]): string[]`: each tag
      once, by `sameTag`, in the casing met first, `carried` before `lit`, sorted by
      `a.toLowerCase().localeCompare(b.toLowerCase())`.
    - `toggleTag(lit: readonly string[], tag: string): string[]`: `lit` without `tag` if one is
      `sameTag`, else `lit` with `tag` at the end.
  - `ItemRow` and `ScheduledItem` gain `tags: string[]` and `tailTags: string[]`, from `itemTags`.
  - `RowFilter` and `ScheduleFilter` gain `tags: readonly string[]`: the lit tags.
  - `isFiltered(filter: { find: Find | null; starredOnly: boolean; tags: readonly string[] })` is
    also true while a tag is lit, and the item test in `visibleSections` and `shownSchedule` adds
    `carriesTags(row.tags, filter.tags)`.
  - `listStripTags(lines: readonly Line[], model: ListModel, now: Date, shown: { showArchived:
    boolean; archiveDelayMs: number }, lit: readonly string[]): string[]` in `display.ts`:
    `stripTags` of the `tags` of every item that `isShown` keeps (so archived ones only while
    "Show archived items" is on), in file order, with `lit`.
  - `scheduleStripTags(items: readonly ScheduledItem[], lit: readonly string[]): string[]` in
    `schedule.ts`: `stripTags` of the items' `tags`, the items sorted as `groupSchedule` sorts them
    (day, list name, place in the list), with `lit`.

- [ ] **Step 1: Write the failing tests.**
  - `item-line.test.ts`, `tailFields`: for `⏳ 2026-11-08 #frozen 🔼`, three spans whose slices
    are `⏳ 2026-11-08`, `#frozen`, `🔼`; for `#frozen⏳ 2026-11-08`, `#frozen` and
    `⏳ 2026-11-08`.
  - `item-tags.test.ts`:
    - `- [ ] Fries #frozen` → `tags` and `tailTags` `['frozen']`.
    - `- [ ] #frozen Fries` → `tags` `['frozen']`, `tailTags` `[]`.
    - `` - [ ] Fries `#code` [x](#heading) #frozen `` → `tags` `['frozen']`.
    - `- [ ] Fries #1984` → both empty: the tail field stays, and isn't a tag.
    - `- [ ] Fries #Frozen #frozen` → `['Frozen']`.
    - `- [x] Fries ⭐ ✔ 2026-11-07 10:00 #frozen ⏳ 2026-11-08 ^id` → `['frozen']`.
    - `- [ ] Fries #frozen⏳ 2026-11-08` → `['frozen']`.
    - A paragraph line → both empty.
  - `tags.test.ts`: `carriesTags(['shop/frozen'], ['Shop'])` true;
    `carriesTags(['shopping'], ['shop'])` false; `carriesTags(['a'], ['a', 'b'])` false;
    `carriesTags(['a'], [])` true. `stripTags([['b', 'A'], ['a', 'c']], ['Z'])` →
    `['A', 'b', 'c', 'Z']`. `toggleTag(['Frozen'], 'frozen')` → `[]`; `toggleTag(['a'], 'b')` →
    `['a', 'b']`.
  - `display.test.ts`: with tags lit, `visibleSections` shows only items carrying every lit tag,
    with the headings and untouched blocks as a query shows them; `findsNothing` is true when none
    carries them; lit tags with a query and with "Show starred only" combine by AND; the card's
    `keepLine` item shows regardless; `listStripTags` leaves out an archived item's tags until
    `showArchived`, keeps a lit tag no item carries, and leaves out a `#x` in an item's notes line.
  - `schedule.test.ts`: `shownSchedule` with `tags` lit, and `scheduleStripTags` taking the casing
    of the item first in the Schedule's order, not the file's.
  - `render-timing.test.ts`: the 500-item list gets a tag on some titles and some tails, and the
    budget stays as it is.
- [ ] **Step 2: Run** `npx vitest run tests/core`. Expected: FAIL on the new tests only, once the
  literals above have their new fields.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass; no view shows
  anything new yet, since every filter passes `tags: []`.
- [ ] **Step 5: Commit** "Read an item's tags and match them against lit tags (#325)".

### Task 3: Adding and removing a tag on a line

**Files:**
- Create: `src/core/tag-edit.ts`
- Test: `tests/core/tag-edit.test.ts`

**Interfaces:**
- Consumes: `parseItemLine`, `joinItemLine`, `splitTail`, `tailFields` (Task 2), `isTagBody`,
  `sameTag` (Task 1), `itemTags` (Task 2).
- Produces:
  - `addTag(line: string, tag: string): string`: `line` unchanged when `tag` isn't a tag body or
    the item's `tags` already hold one `sameTag` as it. Else `#tag` goes at the end of the tail's
    fields, before the block ID and trailing whitespace, with a space before it unless nothing
    stands before it on the line, as `setWhen` adds a When.
  - `removeTag(line: string, tag: string): string`: takes out every tail field `#t` with
    `sameTag(t, tag)`, each with the whitespace before it, except: the whitespace stays when the
    field is glued to the next one (no whitespace after it), and when it is the line's first
    content (`] ` is `afterStatus`, never the tail's): then the whitespace after it goes instead,
    if a field follows. Tags in the title stay: the card edits them as text.

- [ ] **Step 1: Write the failing tests,** each asserting the whole line, byte for byte:
  - `- [ ] Fries` + `frozen` → `- [ ] Fries #frozen`; `- [ ] ` + `errand` → `- [ ] #errand`;
    `- [ ]  ⭐` + `errand` → `- [ ]  ⭐ #errand`.
  - `- [x] Fries ⭐ ✔ 2026-11-07 10:00 ⏳ 2026-11-08 ^id  ` + `frozen` →
    `- [x] Fries ⭐ ✔ 2026-11-07 10:00 ⏳ 2026-11-08 #frozen ^id  `.
  - Already there in any case, in the tail or the title: `- [ ] Fries #Frozen` + `frozen`, and
    `- [ ] #frozen Fries` + `frozen` → unchanged. Not a tag: `- [ ] Fries` + `1984` → unchanged.
  - `removeTag`: `- [ ] Fries #frozen` → `- [ ] Fries`; `- [ ] #errand` → `- [ ] `;
    `- [ ]  ⭐ #errand` → `- [ ]  ⭐`; `- [ ] Fries #frozen ⏳ 2026-11-08 ^id` →
    `- [ ] Fries ⏳ 2026-11-08 ^id`; `- [ ] Fries #frozen⏳ 2026-11-08` →
    `- [ ] Fries ⏳ 2026-11-08`; `- [ ] Fries #Frozen #pantry #frozen` + `frozen` →
    `- [ ] Fries #pantry`; `- [ ] #errand ⏳ 2026-11-08` → `- [ ] ⏳ 2026-11-08`;
    `- [ ] #frozen Fries` → unchanged.
  - Round trip: for each line above that `addTag` changed, `removeTag(addTag(line, t), t)` is
    `line`.
  - Through `planItemLineEdit` (`src/core/list-actions.ts:138`) on a file with CRLF endings and
    no final newline: only the item's line changes, and the endings and the missing final newline
    stay.
- [ ] **Step 2: Run** `npx vitest run tests/core/tag-edit.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `addTag` and `removeTag` in `src/core/tag-edit.ts`.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 5: Commit** "Add and remove a tag on an item's line (#325)".

### Task 4: Rows show their tags

**Files:**
- Modify: `src/view/row-marks.ts` (add `addTags`), `src/view/render-list.ts:198` (`buildRow`),
  `src/view/schedule-row.ts:9` (`buildScheduleRow`), `styles.css`
- Modify: step one "Layout (owner)", step two "When and the Schedule view", and this design's
  "Rows" where Step 2's layout differs
- Test: `tests/styles.test.ts` runs as is

**Interfaces:**
- Consumes: `ItemRow.tailTags`, `ScheduledItem.tailTags` (Task 2).
- Produces: `addTags(parent: HTMLElement, tags: readonly string[]): void`, which adds nothing for
  no tags, else `span.princelists-tags` holding a `span.princelists-tag` with the text `#tag` per
  tag. `buildRow` calls it right after the title and before the star, and gives a row with tags
  the class `is-tagged` (no `:has()`); `buildScheduleRow` calls it in its title line
  (`.princelists-schedule-title-line`), also before the star, and gives that line `is-tagged`
  when it has tags. A list inside another note gets it
  through `buildRow`.

- [ ] **Step 1: Add the chips** as above. They take no listener: a click on one reaches the row's
  delegated listener, which opens the card, as a click on the day does.
- [ ] **Step 2: Lay them out** in `styles.css`, with the tag variables:
  - Wider than 480 pixels: the chips follow the title on its line, star and day after them. The
    title's text is drawn by Obsidian's renderer, so the chips can't flow inside it; they wrap
    among themselves when the line is full. This step updates the design's "wrap with the title's
    words" (a call) to say so.
  - 480 pixels or narrower, in the existing container query (`styles.css:998-1006`): only
    `.princelists-item.is-tagged` wraps (`flex-wrap: wrap`), since wrapping every row would move a
    long title under its checkbox and wrap the card, which is a `.princelists-item` too. In a
    tagged row the title takes `flex-basis: 0` with its `flex-grow`, so it stays beside the
    checkbox, and the chips take a line of their own under the title, at the title's start
    (`order` after the day, `flex-basis: 100%`, indented by the checkbox's width and the gap). The
    star and day stay on the title's first line. The DOM order stays title, tags, star, day.
  - The Schedule, at every width: its chips sit in the title line, already past the checkbox, so
    they need no indent. At 480 pixels or narrower a title line with chips wraps and puts them on a
    line of their own under the title, with a rule of its own.
  - A done row's chips are gray, as its title is (`.princelists-item.is-done .princelists-tag`).
- [ ] **Step 3: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 4: Check by hand,** on desktop and mobile, in a list, the Schedule and a list inside
  another note: a tagged row at a wide pane and in a sidebar; a long title with three tags; a long
  title without tags at 480 pixels, unchanged; the open card at 480 pixels, unchanged; a row
  with a tag in its title (no second chip) and what a tap on that title tag does (design risk 3,
  recorded in the pull request); a done row; a screen reader's reading order on one platform.
- [ ] **Step 5: Update the designs:** step one "Layout (owner)", that a row shows its tags too;
  step two "When and the Schedule view", that a Schedule row does.
- [ ] **Step 6: Commit** "Show an item's tags on its row (#325)".

### Task 5: The tag strip in a list, with its setting

**Files:**
- Create: `src/core/tag-strip-mode.ts`, `src/view/tag-strip.ts`
- Modify: `src/obsidian/settings.ts`, `src/main.ts:166` (`settingChanged`) and its
  `loadSettings` and `onExternalSettingsChange`, `src/view/filter.ts`, `src/view/redraw.ts`,
  `src/view/render-list.ts:173`, `src/view/events.ts`, `src/view/list-view.ts`, `styles.css`
- Modify, so the build holds: `src/view/schedule-view.ts`, which `implements FilterHost`
  (`schedule-view.ts:42`), and `src/main.ts:32`, which constructs it
- Modify the comments this makes false: `filter.ts:15-18` (`FILTER_TOGGLE_SELECTOR`, "toggles in
  the field's row") and `filter.ts:124` ("shows every row again")
- Modify: step one "Not in step one", step two "Cmd+F" and "Settings"
- Test: `tests/core/tag-strip-mode.test.ts`

**Interfaces:**
- Consumes: `listStripTags`, `toggleTag` (Task 2).
- Produces:
  - `type TagStripMode = 'always' | 'filtering'`, `DEFAULT_TAG_STRIP_MODE = 'always'` and
    `tagStripModeOf(stored: unknown): TagStripMode` in `tag-strip-mode.ts`, as
    `buttonPlatformsOf` reads its value.
  - `PrinceListsSettings.tagStrip: TagStripMode`; the dropdown "Tag strip", options "Always" and
    "While filtering", description "Where a list and the Schedule show their items' tags, to filter
    by: always, or only while the filter field is open."
  - `FilterHost` gains `litTags: string[]` and `tagStripMode(): TagStripMode`. `closeFilter` sets
    `litTags = []` when `tagStripMode()` is `'filtering'`.
  - `FILTER_TOGGLE_SELECTOR` takes in `.princelists-strip-tag` and `.princelists-clear-tags`, so a
    press on them keeps focus in the field, as on the other toggles.
  - In `tag-strip.ts`:
    - `showsTagStrip(view: FilterHost): boolean`: `'always'`, or the field open.
    - `buildTagStrip(parent: HTMLElement, tags: readonly string[], lit: readonly string[]): void`:
      nothing for no tags; else `div.princelists-tag-strip` (`role="group"`, `aria-label="Tags"`)
      with a `button.princelists-strip-tag` per tag, text `#tag`, `aria-pressed` and the class
      `is-lit` when lit, then, while a tag is lit, `button.princelists-clear-tags` with the `x`
      icon and the tooltip "Clear tags".
    - `stripClick(view: FilterHost, target: HTMLElement): boolean`: a strip tag's press sets
      `view.litTags = toggleTag(view.litTags, tag)`, the clear button's sets `[]`, each then
      `view.render()`; true when it handled the click. When the press had keyboard focus on the
      strip, focus goes back after the redraw to the same tag (found by `sameTag`), or to the
      strip's first tag after "Clear tags", so the view's own keys keep working (the note at
      `filter.ts:147` says why focus must not fall to the page).
- `rowFilter` passes `tags: view.litTags`. `redraw` builds the strip after the list note and the
  filter row, before the rows, when `showsTagStrip(view)`, from `listStripTags` with the view's
  `showArchived` and archive delay. `events.ts`'s click listener calls `stripClick` beside the
  field's starred and archived toggles (`events.ts:83-90`), so a strip press acts while a card is
  open, as those toggles do; the card's item stays shown through `keepLine`.
- `litTags` is reset to `[]` beside every reset of `starredOnly` in a list (`list-view.ts:163`,
  `redraw.ts`'s branch for a note that isn't a list).
- `ScheduleView` gains `litTags: string[] = []` and `tagStripMode()`, from a new constructor
  parameter `tagStripMode: () => TagStripMode` after `archiveDelay`, which `main.ts:32` passes from
  the settings. It draws no strip yet and passes `tags: []` still: Task 7 does the rest.

- [ ] **Step 1: Write the failing test:** `tagStripModeOf` returns `'always'` and `'filtering'` for
  those strings, and `'always'` for `undefined`, `'never'`, `1` and `null`.
- [ ] **Step 2: Run** `npx vitest run tests/core/tag-strip-mode.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `tag-strip-mode.ts`, the setting, and `settingChanged('tagStrip')` and
  an outside change to it redrawing every open list view.
- [ ] **Step 4: Implement** the strip, its clicks and the reset, as above, and its styles: it wraps
  onto more lines, each tag drawn with the tag variables, a lit one with the accent.
- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 6: Check by hand,** on desktop and mobile:
  - "Always": the strip shows under the list note, and under the field while it's open; a list with
    no tags shows none.
  - Tapping lights a tag and filters; a second narrows; a lit tag tapped turns off; "Clear tags"
    clears only tags; tags with typed text and "Show starred only" combine.
  - Escape and the filter icon leave lit tags lit. With "While filtering", they turn them off, and
    the strip shows only with the field.
  - On a phone, a press on a strip tag leaves the keyboard up while the field is open.
  - With the keyboard, Tab to a strip tag and press Space: it lights, and focus stays on it.
  - With a card open, a press on the strip lights the tag, and the card's item stays shown.
  - Strip tags and "Clear tags" are at least 24 by 24 CSS pixels on a phone (design risk 5).
  - A lit tag whose last item lost it in another app stays lit, and "No items match" shows.
  - Many tags on a phone (design risk 4), recorded in the pull request.
  - Reopening the list shows no tag lit.
- [ ] **Step 7: Update the designs:**
  - Step one "Not in step one": tags and tag filters are no longer only wanted later.
  - Step two "Cmd+F", lines 138 and 177: the filter icon and Escape show every row only once no tag
    is lit, or with "While filtering".
  - Step two "Settings": "Tag strip" joins the defaults that are an exception.
- [ ] **Step 8: Commit** "Filter a list by tag from a strip above its rows (#325)".

### Task 6: The card's tags

**Files:**
- Create: `src/core/tag-choices.ts`, `src/view/card-tags.ts`, `src/view/tag-suggest.ts`
- Modify: `src/view/card.ts` (`createCardElement`, `refreshCard`, `endCard`, `dismissCard`),
  `src/view/events.ts` (clicks and Escape), `src/view/list-view.ts` (one field), `styles.css`
- Modify: step one "Editing"
- Test: `tests/core/tag-choices.test.ts`

**Interfaces:**
- Consumes: `addTag`, `removeTag` (Task 3), `tagOfTyped` (Task 1), `listStripTags` (Task 2),
  `queueLineEdit(view, titleLine, change)` (`src/view/line-edit.ts:7`), which also makes the edit
  one step of Cmd+Z.
- Produces:
  - In `tag-choices.ts`: `type TagChoice = { tag: string; isNew: boolean }` and
    `tagChoices(listTags: readonly string[], itemTags: readonly string[], typed: string):
    TagChoice[]`: the `listTags` that contain `tagOfTyped(typed) ?? typed.trim()` ignoring case
    (all of them for empty text) and that no `itemTags` is `sameTag` as, in `listTags`' order,
    each `isNew: false`; then `{ tag: tagOfTyped(typed), isNew: true }` when `tagOfTyped(typed)` is
    a tag that no `listTags` or `itemTags` is `sameTag` as.
  - In `card-tags.ts`:
    - `buildTagButton(tools: HTMLElement): void`: `button.princelists-card-tag-button`, icon
      `tag`, `aria-label` "Add tag", inserted first in `.princelists-card-tools`, so the head reads
      tag, star, day, ⋯.
    - `showCardTags(cardEl: HTMLElement, tags: readonly string[]): void`: fills
      `div.princelists-card-tags`, between the head and the notes, with a chip per tail tag and a
      `button.princelists-card-tag-remove` (`aria-label` "Remove tag", icon `x`); hidden when there
      are none and no tag input is open. It replaces only the chips: an open tag input stays where
      it is, focused, since the redraw after each write refreshes the focused card
      (`redraw.ts:73`).
    - `openTagInput(view: PrinceListView): void`: an `input.princelists-tag-input` (placeholder
      "Tag") at the end of the card's tags, focused, with a `TagSuggest` on it, both kept in a new
      field `view.tagInput: { input: HTMLInputElement; suggest: TagSuggest } | null`.
    - `closeTagInput(view: PrinceListView): void`: closes the suggest's popover, which lives
      outside the view's element, removes the input and sets `view.tagInput = null`. `endCard` and
      `dismissCard` call it.
  - In `tag-suggest.ts`: `class TagSuggest extends AbstractInputSuggest<TagChoice>`.
    - `getSuggestions(query)`: `tagChoices` of the list's strip tags (`listStripTags` with no tags
      lit and the view's `showArchived`), the item's `tags`, and `query`.
    - `renderSuggestion`: `#tag`, or "New tag: #tag".
    - `selectSuggestion`: `queueLineEdit(view, view.selected, (text) => addTag(text,
      choice.tag))`, reading `view.selected` when the choice is made, then clears the input and
      keeps it open for the next tag. Nothing is written when `view.selected` is null.
- `refreshCard` calls `showCardTags(card.el, row.tailTags)`. A click on the tag button opens the
  input; on a chip's × it queues `removeTag`. Escape in the tag input closes the input, not the
  card; Enter with no suggestion chosen writes nothing.

- [ ] **Step 1: Write the failing tests** in `tests/core/tag-choices.test.ts`, with `listTags`
  `['Frozen', 'pantry', 'shop/frozen']`:
  - Empty text: all three, none new. `'fro'` and `'#fro'`: `Frozen` and `shop/frozen`, then
    `{ tag: 'fro', isNew: true }`.
  - `'frozen'`: `Frozen` and `shop/frozen`, no new tag (it is `sameTag` as `Frozen`).
  - With `itemTags` `['frozen']`: `'fro'` leaves out `Frozen`; `'frozen'` offers no new tag.
  - `'#'`, `'# frozen'`, `'1984'` and `'frozen pantry'`: no new tag.
- [ ] **Step 2: Run** `npx vitest run tests/core/tag-choices.test.ts`. Expected: FAIL, module not
  found. Then implement `tag-choices.ts` and run it again. Expected: PASS.
- [ ] **Step 3: Implement** the button, the chips and their clicks.
- [ ] **Step 4: Implement** `TagSuggest` and the input, and Escape for it in `events.ts`'s
  `onKeyDown`, before the card's own Escape.
- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 6: Check by hand,** on desktop and mobile: add a tag from a suggestion and a new one;
  add two in a row without the input closing; close the card with the suggestions open (the
  popover goes);
  `#`, `# frozen`, `1984` and `frozen pantry` offer no new tag and Enter writes nothing; add the
  same tag in another case (nothing written); remove one with ×, on a line with a When and a block
  ID, and on `- [ ] #errand`; Cmd+Z after each; typing `#tag` at the title's end shows it as a chip
  once the title loses focus; the head's order is tag, star, day, ⋯ at every width.
- [ ] **Step 7: Update the designs:** step one "Editing", that the card shows the tail's tags,
  though the title field still hides them.
- [ ] **Step 8: Commit** "Add and remove an item's tags in its card (#325)".

### Task 7: The Schedule's strip

**Files:**
- Modify: `src/view/schedule-view.ts`, `src/main.ts:166` (`settingChanged`)
- Modify: the design's header

**Interfaces:**
- Consumes: `scheduleStripTags` (Task 2), `buildTagStrip`, `stripClick`, `showsTagStrip`
  (Task 5), and `ScheduleView`'s `litTags` and `tagStripMode()` (Task 5).
- Produces: `draw` passes `tags: this.litTags` and builds the strip under the description, after
  the filter field, from `scheduleStripTags` of the unarchived dated items, when
  `showsTagStrip(this)`. `onClose` resets `litTags`. Its click listener calls `stripClick` first
  (the Schedule has no card), and its mousedown listener already keeps focus through
  `FILTER_TOGGLE_SELECTOR`. A change to "Tag strip" redraws open Schedules too.
- `draw` returns early while its `drawn` key is unchanged (`schedule-view.ts:283-284`). The key
  takes in `showsTagStrip(this)`, the strip's tags and the lit tags: with "While filtering",
  opening the field sets `filter = ''`, and `findOf('')` is null, so without them the key would
  stay the same and the strip would never appear; a "Tag strip" change likewise.

- [ ] **Step 1: Implement** the above.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build`. Expected: all pass.
- [ ] **Step 3: Check by hand,** on desktop and mobile: the Schedule's strip lists only dated items'
  tags, across lists, in the casing of the first in its order; lit tags with text and "Show starred
  only"; Escape and the filter icon in both modes; with "While filtering", opening the field shows
  the strip at once; changing the setting with the Schedule open; reopening shows none lit; the
  strip's targets on a phone (design risk 5).
- [ ] **Step 4: Reconcile the design** with the build: set `status: live` and `verified` to the
  day.
- [ ] **Step 5: Commit** "Filter the Schedule by tag (#325)".
