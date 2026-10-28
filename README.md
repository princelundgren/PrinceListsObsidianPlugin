# PrinceLists

Todo lists for Obsidian, kept as plain Markdown notes.

> **Work in progress.** Step one's two parts are built and checked on macOS and an iPhone: 1a in
> `0.1.0`, and 1b, which adds dragging by touch, pictures in cards and Cmd+Z undo (Ctrl+Z on
> Windows and Linux), in `0.2.0`. `0.3.0` adds small fixes from first use with a real list.
> `0.4.0` adds step two: the star, an item's date and the Schedule view, a list inside another
> note, and the rest listed below, checked on macOS and an Android emulator. You can follow along
> in the designs for [step one](docs/superpowers/specs/2026-10-20-prince-lists-design.md) and
> [step two](docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md), and in the pull
> requests.

## What it does

- **Each list is an ordinary note** with `princelists: true` at the top. Open it and you see a
  clean todo list. Turn the plugin off and it is still a readable note. The "Create new list"
  command and ribbon icon, or "New list" in a folder's menu, make one, and "Turn into list" makes
  one of a note you already have.
- **Headings make sections, and checkboxes are items.** Anything indented under an item is that
  item's notes, and notes can hold any Markdown: links, pictures, bullet lists.
- **Headings drag and collapse.** Drag a heading to move its whole section, and click the arrow
  beside it to fold the section away.
- **Ticking an item** grays it out where it is. Twenty-four hours later it's archived and hidden,
  and the checkbox icon in the pane's header, or "Show archived" in its ⋯ menu, brings archived
  items back.
- **It's built for desktop and mobile.** Use the "+" in the pane's header to add items, or on
  mobile the floating "+" too. On desktop, right-click for actions and drag items with the mouse.
  On mobile, hold an item for half a second and drag it; item actions are in the ⋯ button on an
  open item, and tapping a heading opens its menu. Step one has been checked on macOS and an
  iPhone, and step two on macOS and an Android emulator. Step two isn't checked on an iPhone yet,
  and neither step on Windows, Linux or an iPad.
- **Star an item** with the star in its card, and the row shows it.
- **Give an item a date** with the calendar icon in its card. The row shows the day, and the
  Schedule view ("Open schedule", from the ribbon or the list's ⋯ menu) gathers the dated items of
  every list under Today, Tomorrow, Next 7 days and Later. Tick them there too.
- **Cmd+F** (Ctrl+F on Windows and Linux) filters the list to the items that match. On mobile, use
  the "Find in list" command.
- **Checklists in an item's notes** tick right in the open card.
- **Notes are edited a block at a time.** Click a paragraph, a table or a list item and only that
  part turns into its Markdown; the rest stays drawn as in a note. Enter continues a list, and Up
  and Down move between the parts.
- **Formatting in a card:** Cmd+B, Cmd+I and Cmd+K (Ctrl on Windows and Linux) make the selection
  bold, italic or a link, and a format bar under the part you're editing has the rest, from
  strikethrough to tables. "Edit in Markdown", in an item's or a heading's menu, opens the list as
  Markdown at that line, where Obsidian's own tools work.
- **Right-click menus:** an item and a heading have their own, and on desktop the list's background
  has New item, New heading, Edit in Markdown, Show archived and Open schedule.
- **A list inside another note:** a `princelists` code block naming a list shows its items, to tick
  and edit there.

  ````markdown
  ```princelists
  [[Groceries]]
  ```
  ````

- **Pictures:** paste or drop one into an open item's notes. It's saved where Obsidian saves
  attachments, and the notes link to it.
- **Cmd+Z and Cmd+Shift+Z** (Ctrl+Z and Ctrl+Shift+Z on Windows and Linux) undo and redo the
  list's own edits on desktop. After a delete, an Undo button brings the item back on any device.

## Installing

PrinceLists isn't in Obsidian's community plugins yet, so it's installed by hand from a release:

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [releases page](https://github.com/princelundgren/PrinceListsObsidianPlugin/releases).
2. Put them in `<vault>/.obsidian/plugins/princelists/`, where `<vault>` is your vault's folder.
3. In Obsidian, open Settings → Community plugins, turn on community plugins if Restricted mode is
   on, and enable PrinceLists under Installed plugins.

To get it on your other devices through Obsidian Sync, turn on Sync's "Active community plugin
list" and "Installed community plugin list".

## How a list is stored

```markdown
---
princelists: true
---
Stuff for the new apartment.

## Kitchen
- [ ] cutting board
- [ ] freezer storage boxes ⏳ 2026-10-21 📅 2026-10-30

	Buy 6:
	- one for the freezer
	- five for the pantry
- [x] glass jars 1 l ✔ 2026-10-20 23:55
```

- **Dates use the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin's format,**
  so Tasks and other tools can still read them.
- **A ticked item gets `✔` with the date and time.** This is PrinceLists' own field, because Tasks'
  `✅` holds only a date. The plugin uses it to hide the item 24 hours later. Tasks still sees the
  item as done, but not when, and shows the `✔` text as part of the item.
- **The plugin changes only the lines you edit.** Everything else in the note stays exactly as you
  wrote it.

The full format is in the [design](docs/superpowers/specs/2026-10-20-prince-lists-design.md#file-format).

## Syncing

If you edit the same list on two devices within a few seconds of each other, Obsidian Sync's
automatic merge can lose a change, as it can in any note. If that takes text you were typing in an
item, PrinceLists offers to copy it. Sync's "Create conflict file" setting avoids silent merges; the
conflict copies show up as extra lists.

## Privacy

PrinceLists works only on notes in Obsidian: the notes in your vault, and on desktop a note opened
from outside it (checked on macOS). It makes no network requests of its own, collects no data, and
needs no account. A list's notes are rendered by Obsidian, so a picture from the web in them loads
as it does in any note.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), the rules
in [AGENTS.md](AGENTS.md#rules-that-are-never-broken) and the [code of conduct](CODE_OF_CONDUCT.md).
To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
