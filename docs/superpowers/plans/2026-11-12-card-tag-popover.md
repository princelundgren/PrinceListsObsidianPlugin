# PrinceLists card tag popover Implementation Plan

> **For agentic workers:** implement this plan task by task, one task per pull request. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the open card, the tag button opens a popover that moves nothing, and the item's tags
follow the title as on a closed row (#340).

**Architecture:**
- **The popover is a `div` in the card's tools,** absolutely placed under the tag button. It holds
  the tag input that `openTagInput` puts in the tags box today, with the same `TagSuggest`, so the
  suggestions, the write and `undo.ts`'s empty-input rule stay as they are.
- **The title and the tags share a title line,** a flex row in the card's head. The title field
  sizes to its text with `field-sizing: content` under `@supports`, and keeps today's full width
  without it.

**Tech Stack:** as in step two. No new dependency.

**Design:** [filtering by tag](../specs/2026-11-07-tag-filter-design.md), "The card", risks 6 to 8,
and items 6 and 7 of its "Order".

**How work lands:** one pull request per task, from `main`, squash-merged by the owner, so "Commit
with the message X" means the pull request's title is X. Each task updates the design sections it
names, or says in one line that they still hold, and sets `verified`; the second task sets the
design's `status` back to `live`. Manual checks run in a test vault (AGENTS.md, "Working on a
change"), on macOS and on the Android emulator, with the steps each task lists. iOS isn't reachable
for these checks; #372 tracks it.

## Global Constraints

- AGENTS.md's rules: Obsidian's CSS variables only, no hard-coded colors, no `:has()`, documented
  APIs only, sentence case, listeners through `registerDomEvent`, one delegated listener per
  container.
- The popover: the card's `--background-modifier-border`, `--radius-m` and `--shadow-s`, its
  background as the card's (`--background-primary`, `--background-secondary` in a dark theme), and
  `z-index: var(--layer-popover)`. Not the HTML `popover` attribute.
- The field's label: "Add tag", through `addHiddenLabel` (`src/view/dom.ts`), not `aria-label`,
  which Obsidian shows as a tooltip; placeholder "Tag" as today. The tag button carries
  `aria-expanded`, `"false"` while closed.
- The popover: `width: 16em`, never wider than the card.
- Each task updates the comments and doc comments its change makes false, and removes code it
  leaves unreachable.

## Review Focus

1. **A pick by click or tap** adds the tag: the focus rule doesn't close the popover before
   `selectSuggestion` runs (risk 6). Enter on a suggestion adds it once and doesn't reach the tag
   button that takes focus, which would reopen the popover.
2. **Escape twice:** the first closes the popover and its suggestions with focus on the tag button,
   the second closes the card.
3. **Cmd+Z after a pick,** with focus on the tag button, undoes the tag; in the empty field it
   steps through the list's history.
4. **The card's layout doesn't move** when the popover opens or closes: the title's and notes'
   boxes are where they were.
5. **A redraw while the popover is open** (an outside change to the file, a tag's write landing)
   keeps the popover, its field's text and its focus, as the tags box keeps the input today.

---

### Task 1: The tag button opens a popover

**Files:**
- Modify: `src/view/card-tags.ts`, `src/view/tag-suggest.ts`, `src/view/events.ts`,
  `src/view/list-view.ts`, `src/view/card.ts`, `styles.css`
- Modify: the design, "The card" (still holds for the popover; the tags move in Task 2)

**Interfaces:**
- Produces: `toggleTagPopover(view: PrinceListView): void`, `closeTagPopover(view:
  PrinceListView): void` and `escapeTagPopover(view: PrinceListView): void` in `card-tags.ts`,
  replacing `openTagInput`, `closeTagInput` and `escapeTagInput`; `PrinceListView.tagPopover: { el:
  HTMLElement; input: HTMLInputElement; suggest: TagSuggest } | null`, replacing `tagInput`. The
  popover's class is `princelists-tag-popover`; the input keeps `TAG_INPUT_CLASS`.

- [ ] **Step 1:** `toggleTagPopover` closes the popover when it's open. Otherwise it builds it as
  the last child of `.princelists-card-tools` (made `position: relative`), with the input, its
  hidden label and its `TagSuggest`, sets the tag button's `aria-expanded` to `"true"`, focuses
  the input and scrolls the popover into view with `scrollIntoView({ block: 'nearest' })`.
  `closeTagPopover` closes the suggestions, removes the popover and sets `aria-expanded`
  to `"false"`. `escapeTagPopover` closes it and focuses the tag button.
- [ ] **Step 2:** `TagSuggest.selectSuggestion` queues the edit as today, then calls
  `escapeTagPopover`, in place of clearing the input and keeping it focused.
- [ ] **Step 3:** In `onFocusOut`, focus leaving `view.tagPopover.input` for an element outside the
  popover, while `target.doc.hasFocus()`, calls `closeTagPopover`. While the popover is open, a
  `mousedown` on the tag button, in `onMouseDown`, calls `preventDefault`, so the field keeps focus
  and the click that follows closes it through `toggleTagPopover`. Safari doesn't focus a clicked button, so a
  rule that read the focusout's `relatedTarget` would miss it there.
- [ ] **Step 4:** `showCardTags` and `toggleTagsBox` stop looking for the input: the box shows when
  it has a chip. `buildTagButton` sets `aria-expanded="false"`.
- [ ] **Step 5:** `styles.css`: the popover's rule (Global Constraints), under the button with
  `top: 100%` and `inset-inline-end: 0`, its input full width. `input.princelists-tag-input` loses
  its flex sizing.
- [ ] **Step 6:** `npm run lint`, `npm run build`, `npm test` pass. On macOS and Android: the
  popover opens focused without moving the card; typing suggests; Enter and a click or tap on a
  suggestion each add the tag once and close it with focus on the tag button; the tag button
  pressed while it's open; Escape twice; a tap outside; Cmd+Z after a pick and in the empty field;
  a card on the list's last row; a pane 480 pixels wide or narrower.
- [ ] **Step 7:** Commit with the message "Open the card's tag input in a popover under the tag
  button (#340)".

### Task 2: The card's tags follow the title

**Files:**
- Modify: `src/view/card.ts` (`createCardElement`'s head), `styles.css`
- Modify: the design, "The card", and step one, "Editing" ("The card shows the tail's tags after
  the title")

**Interfaces:**
- Produces: `princelists-card-title-line`, a `div` first in `.princelists-card-head` holding the
  title field and the tags box. `CARD_TITLE_CLASS` and the tags box's class stay.

- [ ] **Step 1:** `createCardElement` builds the title line, with the title field and
  `buildCardTags(titleLine)` in it in that order, before the tools.
- [ ] **Step 2:** `styles.css`: the title line takes the rules `.princelists-card-head >
  .princelists-card-title` has today (`flex: 1`, `min-width: 8em`, `flex-basis: 100%` at 480
  pixels or narrower). In it, `display: flex`, `flex-wrap: wrap`, `align-items: baseline` and the
  tags' gap; the title field `flex: 1 1 100%`, and under `@supports (field-sizing: content)`,
  `field-sizing: content`, `width: auto`, `flex: 0 1 auto` and `max-width: 100%`, with a selector
  that outranks `textarea.princelists-field`, whose `width: 100%` would otherwise keep the field
  full width. The tags box's `margin-top`
  applies only without `field-sizing`.
- [ ] **Step 3:** `npm run lint`, `npm run build`, `npm test` pass. On macOS and Android, risk 8's
  cases: an empty, a short and a wrapping title, typing that wraps and unwraps it, a done item, a
  narrow pane, and the field's height fitting its text after each.
- [ ] **Step 4:** Set the design's `status` to `live` and `verified`, then commit with the message
  "Show the card's tags after its title, as on a closed row (#340)".
