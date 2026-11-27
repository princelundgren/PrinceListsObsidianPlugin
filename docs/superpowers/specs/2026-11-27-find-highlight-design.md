---
status: live
verified: 2026-11-27
governs: [src/**, styles.css]
---

# PrinceLists for Obsidian: highlighting what Find finds

Find (Cmd+F, [step two](2026-10-27-prince-lists-step-2-design.md), "Cmd+F: filter the list or the
Schedule") hides the items its words don't find. The items left can still be long, and nothing shows
where the word is, so the eye has to search each one again. Each word Find matches should stand out
with a background color, in the rows and in an open card's notes, so it's quick to spot
**(owner, 2026-11-27)**.

**How decisions are marked:** as in the [step one design](2026-10-20-prince-lists-design.md).
**(owner)** means the owner decided it on 2026-11-27; **(call)** means the designer did, and a
builder may revisit it. Step one's rules still hold: only documented Obsidian APIs, Obsidian's CSS
variables and no `:has()`.

## At a glance

- **While Find holds text, each word it matches gets a background color (owner):** in item titles,
  in a list and in the Schedule, and in the notes of an item whose card is open.
- **The color is Obsidian's `--highlight-background` (owner, 2026-11-27),** the one Obsidian gives
  `==marked==` text, so it follows the theme. Obsidian (1.15.1, checked) no longer sets
  `--text-highlight-bg`, which its docs still list as "Highlighted text background": a theme may
  set it, and `--highlight-background` takes it then, else a yellow.
- **Titles use the browser's CSS Custom Highlight API (owner).** It colors text without changing the
  page, so a title's links, tags and formatting stay exactly as Obsidian rendered them.
- **The notes editor uses a CodeMirror mark decoration (call),** the route CodeMirror's guide gives
  for styling its content, which it redraws itself.
- **Where the API is missing, what needs it isn't colored (owner).** Find still filters, and the
  notes editor's marks still color its text lines, since they don't need the API. Titles and the
  notes' drawn blocks stay plain. That's iOS and iPadOS before 17.2, which Obsidian still installs
  on (its App Store page: "Requires iOS 15.6 or later"), so an iPhone 8 or X, which stop at iOS 16.

## Approaches

1. **The CSS Custom Highlight API for titles, a mark decoration in the notes editor (chosen,
   owner).** Ranges over the rendered text go in a `Highlight`, and a `::highlight()` rule colors
   them. Nothing in the rendered title changes, and clearing the ranges takes the color away. It
   needs Chromium 105 and Safari 17.2 (MDN's browser compatibility data), which desktop Obsidian and
   Android have, and iOS 15 and 16 don't.
2. **Wrap the matched text in elements.** Obsidian's `renderMatches` does it for plain text, and it
   works on every device. A title with Markdown is rendered by Obsidian's renderer, though, and
   wrapping text inside that HTML means splitting its text nodes around every match, inside links
   and tags too. That's fragile, and it changes elements other code reads, such as a link's text.
3. **Require a newer iOS or macOS.** Not possible: a plugin's manifest sets only `minAppVersion`,
   Obsidian's own version, and `isDesktopOnly`. Desktop Obsidian brings its own Chromium in
   Electron, so macOS's version doesn't change what the page can do.

## What's colored

- **The word's text as shown, not as written (call).** Each word is searched in the title's rendered
  text, so `**oat** milk` shows "oat" colored, and a link's shown text is searched, not its target.
- **Each word on its own (call).** Find needs every word somewhere in the item, but a title shows
  only the words it holds: with "milk recipe", "milk" is colored in the title and "recipe" in the
  notes.
- **Every place a word appears (call),** not only the first.
- **Matching as Find matches (call):** with Obsidian's `prepareSimpleSearch`, one word at a time, so
  case and accents are ignored as they are when filtering, and "mi" colors the "mi" of "milk".
  `src/` can't fold accents itself, since `String.prototype.normalize` is ruled out there.
- **In a list: item titles (call).** Not the tags at a title's end, drawn as chips, since Find
  doesn't search them; a tag written inside the title is part of its text and is colored. Headings
  show while filtering but aren't searched, so they aren't colored.
- **In the Schedule: item titles, and the list's name (call),** since Find searches the list's name
  there: under a title in "Sort by date", and in the list's subheading when grouped by list, the
  default.
- **Not a list block's rows (call),** where a card's notes hold another list: they are that list's
  items, which this item's Find didn't search.
- **In an open card: its notes, in the notes editor (owner),** drawn blocks included: a table,
  callout, code block or embed the editor shows rendered is colored like a title (owner). The text
  lines match as the editor holds them **(call)**, so a word only in a hidden part, such as a link's
  target while the editor isn't focused, finds the item but shows no color. Not the card's title,
  which is a text field: a highlight colors only the page's text, not the text inside a field.
- **Not the When (call).** It matches as the file writes it, `2026-11-28`, while the row shows
  "Tomorrow", so there's no shown text to color.
- **Only while Find holds text.** Emptying the field or closing it takes every color away.

## How it's drawn

- **One highlight named `princelists-find` per window (call),** registered in `CSS.highlights` of the
  window the view is in (`el.win`), so a list in a pop-out window works too. Each view adds its own
  ranges and removes only those, so a list and the Schedule filtering at once don't clear each other.
- **Text is read block by block (call).** The text nodes of one block element are joined as they
  are, so `**oa**t` is one word, while a line break goes between blocks, so a word can't run from
  one table cell or line into the next.
- **Recomputed on every `render()` (call),** for every row shown, since a redraw keeps rows whose
  content didn't change and the ranges on them must still match the query. The Schedule's `draw()`
  returns early when the rows shown are unchanged, as they are going from "mi" to "mil", so the
  ranges are recomputed before that early return. A row drawn outside a redraw, as when a card
  closes and its row comes back, is colored as it's drawn.
- **A title rendered as Markdown is colored once Obsidian has rendered it (call).**
  `MarkdownRenderer.render` finishes later, so its ranges are added when it resolves, and dropped if
  the row is gone by then.
- **The notes editor learns the query from the view (call)** and redraws its marks when it changes.
  Its drawn blocks are rendered by Obsidian's renderer into widgets, which the marks can't reach,
  so each widget adds highlight ranges over its rendered text once its render finishes, as a title
  does, and removes them when the widget goes.
- **`styles.css`:** `::highlight(princelists-find) { background-color: var(--highlight-background); }`
  **(call)**. A mark in the notes editor uses the same variable through a class.

## Not in this design

- **Coloring titles and drawn blocks on iOS 15 and 16.** Find filters there as everywhere; that
  color needs the API those versions lack, and wrapping text (Approach 2) for them alone would keep
  the fragile path.
- **Moving between matches** with keys or buttons, as a text editor's Find does. Find filters items;
  it doesn't step through hits.
- **Coloring the list note,** which Find doesn't search.

## Docs to update in the build

- **[Step two](2026-10-27-prince-lists-step-2-design.md), "Cmd+F":** a line that matched words are
  colored, pointing here.
- **README:** the Find bullet in the feature list, and the filter GIF and the listing's
  `desktop-4-filter` shot retaken to show the color, with the GIF's alt text saying so.

## Risks to check during the build

1. **`prepareSimpleSearch`'s `matches` for a word that appears more than once.** Searching again
   after the last match, until nothing is found, is right whether it reports one match or all, and
   catches a repeat right after a match, as in "milkmilk". A core test covers both.
2. **The color on Android,** whose system WebView must be Chromium 105 or later. Checked on the
   emulator.
3. **The color under a selection, and beside `==highlight==`:** a row's title can't be selected,
   but text selected in the notes should still show it's selected. Obsidian gives `==marked==` text the same color,
   so a title or note that uses it looks like a match there. It's accepted as the cost of the
   owner's color, which keeps to the theme **(call)**.
   Checked by hand in the dark and light themes.
4. **A long list:** recomputing every shown row per redraw should keep typing smooth; the redraw
   already waits for typing to pause for 100 ms. Checked by hand on the demo vault's longest list.

## Left to the builder

- **Where the range code lives,** as long as core stays free of Obsidian and DOM: the offsets of a
  word's matches in a string can be a pure function core tests, given the matcher.
- **How the notes editor gets the query:** a facet, a state effect or a compartment.
