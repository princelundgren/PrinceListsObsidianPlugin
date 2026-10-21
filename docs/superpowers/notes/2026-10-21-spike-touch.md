# Spike 2: hold-to-drag on the iPhone

Plan step 1a, Task 3. The maintainer ran the five checks on the iPhone on 2026-10-21, and every
one passed. The 500 ms hold "feels just right", and nothing felt wrong.

The spike branch, `spike/touch-drag`, was never merged and is deleted after this note. "What was
built" therefore says enough to rebuild the gesture in 1b without it.

- **Build under test:** the spike branch's one commit, 83bcb02, built with `npm run build` and
  copied to the test vault with `npm run install-vault -- <path to the test vault>`.
- **Never use a vault with real notes** (`AGENTS.md`).
- **Versions:**
  - iPhone: not recorded

## What was built

The list view's placeholder showed 40 plain-text rows, "Row 1" to "Row 40". A tap on a row
showed a notice naming it. A drop reordered the rows in memory only and wrote nothing to the file.
The design's "Touch on the iPhone" gives the approach, and Kanban's `DragManager.ts` gave ideas,
with no code copied.

### The listeners

- **One child component owns the gesture.** It's added with `addChild` (since 0.12.0), so it
  loads and unloads with the view.
- **Each listener is registered once, in that component's `onload`,** with `registerDomEvent` on
  the view's `contentEl`. It checks the gesture's state instead of being added and removed for
  each drag, which is what Kanban does with its `window` listeners.
- **`registerDomEvent` takes listener options on every overload** (`options?: boolean |
  AddEventListenerOptions`, since 0.14.8), so the non-passive listener needs nothing else.

| Event | Options | What it does |
|---|---|---|
| `pointerdown` | none | Starts a press: a touch, the primary pointer, on a row |
| `pointermove` | none | Before the lift, cancels the hold. After it, moves the row and finds the drop index |
| `pointerup` | none | Ends the press, dropping the row if it was lifted |
| `pointercancel` | none | Ends the press and drops nothing |
| `touchmove` | `{ passive: false }` | While a row is lifted, calls `preventDefault` and `stopPropagation` |
| `contextmenu` | `{ capture: true }` | While a press is open, calls `preventDefault` and `stopPropagation` |
| `click` | `{ capture: true }` | Swallows the first click after a lift |

The `touchmove` listener is the one that stops the scroll:

```ts
this.registerDomEvent(el, 'touchmove', (e) => {
  if (this.press?.phase !== 'dragging') return;
  e.preventDefault();
  e.stopPropagation();
}, { passive: false });
```

It's registered for the view's whole life, so it's already in place when a touch starts. It
cancels nothing until a row lifts, which is why a swipe still scrolls.

### A press, step by step

1. **Down.** A `pointerdown` counts only with `pointerType` `'touch'` and `isPrimary`. The row
   comes from `e.targetNode`: `instanceOf(HTMLElement)`, then `closest` on the row class. The
   press records where the finger started and starts `window.setTimeout` for 500 ms. A press
   still open from an earlier touch, whose `pointerup` never reached the view, is ended first.
2. **The 5 px cancel.** A `pointermove` more than 5 px from the start, in a straight line
   (`Math.hypot`), clears the timer and leaves the touch to scrolling. The press stays open until
   `pointerup` or `pointercancel`, so the `contextmenu` cancel still covers it.
3. **The lift.** When the timer fires, the press becomes a drag. It takes the other rows in order,
   with each row's vertical midpoint from `getBoundingClientRect`. These stay true because the list
   can't scroll during a drag. The row gets a class with an `--interactive-accent` outline, a
   `--shadow-l` shadow, a `--background-primary` fill, `position: relative` and `z-index: 1`.
4. **Following the finger.** Each `pointermove` sets a CSS custom property on the row, with
   `setCssProps`, to the finger's vertical distance from where the press started. The lifted
   class turns it into `transform: translateY(...)`. The row moves only up and down. Any move over
   5 px cancels the hold, so the row lifts within 5 px of the finger and doesn't jump.
5. **The drop index.** It's the number of other rows whose midpoint is above the finger's
   `clientY`, which is the row's index once it's moved. A 2 px inset `--interactive-accent` line
   shows at the top of the row it would land before, or at the bottom of the last row for the end.
   No line shows while the index is the row's own.
6. **The release.** A `pointerup` with a new index calls the view's `onDrop(from, to)`. The view
   moved the row's element with `remove` and `insertBefore` instead of re-rendering, so the
   content's height and the scroll position stayed as they were. A `pointercancel` drops nothing.
   Either way the next `click` is swallowed, so letting go of a lifted row, even one that didn't
   move, never counts as a tap. The flag clears on the next `pointerdown`, so it can't eat a later
   tap.

### Styles

- **The rows have `-webkit-user-select: none`, `user-select: none` and
  `-webkit-touch-callout: none`,** so a still hold selects no text and shows no magnifier or
  callout. MDN's compatibility data says iOS Safari supports `user-select` only with the
  `-webkit-` prefix.
- **Colors and sizes are Obsidian's variables only:** the three above, plus
  `--background-modifier-border` for the line under each row and `--size-4-3` and `--size-4-2`
  for padding.
- **The scrolling element was the view's own `contentEl`,** with no wrapper. Obsidian 1.14.4's
  stylesheet gives `.workspace-leaf-content .view-content` `overflow: auto`. That was read from the
  stylesheet and isn't documented.

## Timings and constants

| Constant | Value | What it is |
|---|---|---|
| `HOLD_MS` | 500 | A still hold before a row lifts |
| `MOVE_TOLERANCE_PX` | 5 | Movement before the lift that cancels the hold and leaves the touch to scrolling |
| `SPIKE_ROW_COUNT` | 40 | Dummy rows |

Moves weren't throttled: each one sets one CSS property and compares the finger against 39 cached
midpoints.

## Step 2: the iPhone

1. A quick swipe scrolls the list.
   - **Result:** pass.
2. Holding about half a second and then moving drags the row smoothly, and dropping reorders it.
   - **Result:** pass.
3. Holding still never opens a menu, the text magnifier or a text selection.
   - **Result:** pass.
4. A tap is still a tap.
   - **Result:** pass.
5. Scrolling right after a drop still works.
   - **Result:** pass.

**What felt wrong:** nothing reported.

## Step 3: checkpoint

- **Verdict:** pass (the maintainer, 2026-10-21).
- **Pass bar:** the five checks above, on the iPhone. Keep the 500 ms hold. Nothing felt wrong,
  and 5 px wasn't changed.

## Open points for 1b

- **No scrolling at the edges.** In the spike a row could only move among the rows on screen. 1b
  needs it for longer lists. Untested: whether setting `scrollTop` works while `touchmove` is
  canceled. The midpoints are viewport positions taken at the lift, so they'd need taking again as
  the list scrolls.
- **Touch only.** A mouse doesn't drag. Dragging on the Mac is Task 11, with HTML5 drag and
  `Platform.isDesktop`.
- **The `contextmenu` cancel's scope.** It runs in the capture phase on the view's element, and
  only while a finger is down on a row.
  - The spike didn't show whether Obsidian sends a `contextmenu` at all. The design's 800 ms is
    still unconfirmed, and check 3 passes either way.
  - It would miss a menu that Obsidian opens after the finger lifts, and a `contextmenu` listener
    of Obsidian's that runs in the capture phase on `document` or `window`, before the view.
  - If a menu ever shows, the fallback is Kanban's: `stopPropagation` on `touchstart` on the rows.
    Raise it before reaching for a listener on `document`.
- **Which measures check 3 needed wasn't isolated.** The three CSS properties and the
  `contextmenu` cancel were all in place, so keep all of them. Whether `stopPropagation` on
  `touchmove` matters wasn't tested either.
- **The rows were plain text in one section.** 1b's rows have a checkbox, open a card on a tap,
  and sit in sections around hidden archived rows (design, "Selecting and adding"). None of that
  was tried.
- **A long-press on a folder in the iPhone file explorer reaching `file-menu`** (design, "Touch on
  the iPhone") wasn't part of this spike, and it's still unconfirmed.
