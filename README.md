# PrinceLists

Todo lists for Obsidian, kept as plain Markdown notes.

![In a todo list in Obsidian, a new item gets a title, notes with a link and a pasted picture, a star and a day, then it is dragged into place and another item is ticked](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-desktop.gif)

Each list is an ordinary note. PrinceLists shows it as a clean todo list you can tick, drag and
plan, on desktop and on your phone. Turn the plugin off and the note is still readable Markdown,
and the Tasks plugin can still read its dates.

## Getting started

1. Install PrinceLists (see [Installing](#installing)).
2. Click the list icon in the ribbon, or run "Create new list" from the command palette. A list
   called "Untitled list" opens with its title ready to rename. "New list" in a folder's menu makes
   one in that folder.
3. Add items with the "+" in the pane's header, or on mobile the floating "+". Click an item to open
   it, and write notes, star it or give it a date.

To make a list of a note you already have, run "Turn into list" from the note's menu or the command
palette.

## What it does

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/tick-and-drag.gif" alt="On a phone, an item is ticked, then another is held and dragged into a different section" width="300">

- **Headings make sections, and checkboxes are items.** Anything indented under an item is its
  notes, in any Markdown.
- **Drag to reorder** an item, or a heading with its whole section. On mobile, hold first.
- **Ticked items** gray out and hide after 24 hours. "Show archived" brings them back.
- **Star an item or give it a date** in its open card.
- **Notes edit a block at a time,** with a format bar. Paste or drop pictures straight in.
- **Cmd+F** filters the list and **Cmd+Z** undoes (Ctrl on Windows and Linux).
- **Right-click** an item, a heading or the list for its menu. On mobile, tap a heading, or ⋯ on
  an open item.

### The Schedule

"Open schedule", from the ribbon or a list's ⋯ menu, gathers the dated items of every list under
Today, Tomorrow, Next 7 days and Later. Tick them there too, or open one in its list.

![The Schedule opens from the ribbon and scrolls through dated items from several lists, under Today, Tomorrow, Next 7 days and Later](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/schedule.gif)

### On your phone

The same lists, with a floating "+" for new items.

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-phone.png" alt="A grocery list on a phone, with sections, starred items and a floating add button" width="300">

### A list inside another note

A `princelists` code block naming a list shows its items, to tick and edit there. Renaming the list
doesn't change the name in the block, so type the new one in.

````markdown
```princelists
[[Groceries]]
```
````

## Installing

In Obsidian, open Settings → Community plugins, select Browse, search for PrinceLists, then install
and enable it.

**By hand:**

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest).
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

- **`princelists: true`** in the note's properties makes it a list.
- **Dates use the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin's format,**
  so Tasks and other tools can still read them.
- **A ticked item gets `✔` with the date and time.** This is PrinceLists' own field, because
  Tasks' `✅` holds only a date. The plugin uses it to hide the item 24 hours later. Tasks still
  sees the item as done, but not when, and shows the `✔` text as part of the item.
- **The plugin changes only the lines you edit.** Everything else in the note stays exactly as you
  wrote it.

The full format is in the
[design](docs/superpowers/specs/2026-10-20-prince-lists-design.md#file-format).

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

## Devices

PrinceLists runs on Obsidian for desktop and mobile. Step one's features were checked by hand on
macOS and an iPhone, and step two's (the star, dates, the Schedule, block editing and a list inside
another note) on macOS and an Android emulator. Step two isn't checked on an iPhone yet, and nothing
is checked on Windows, Linux, an iPad or a real Android device. If something looks wrong on your
device, please [open an issue](https://github.com/princelundgren/PrinceListsObsidianPlugin/issues).

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), the rules
in [AGENTS.md](AGENTS.md#rules-that-are-never-broken) and the [code of conduct](CODE_OF_CONDUCT.md).
To report a security problem, see [SECURITY.md](SECURITY.md). What the plugin does and why is in the
designs for [step one](docs/superpowers/specs/2026-10-20-prince-lists-design.md) and
[step two](docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md).

## License

[MIT](LICENSE). The built `main.js` includes commonmark.js, entities and mdurl, under their own
licenses: see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).
