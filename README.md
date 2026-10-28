<h1 align="center">PrinceLists</h1>

<p align="center"><b>Todo lists for Obsidian, kept as plain Markdown notes.</b></p>

<p align="center">
  <a href="https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest"><img src="https://img.shields.io/github/v/release/princelundgren/PrinceListsObsidianPlugin" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/princelundgren/PrinceListsObsidianPlugin" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-a-list-is-stored">How a list is stored</a> ·
  <a href="https://github.com/princelundgren/PrinceListsObsidianPlugin/issues">Report a bug</a>
</p>

![In a todo list in Obsidian, a new item gets a title, notes with a link and a pasted picture, a star and a day, then it is dragged into place and another item is ticked](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-desktop.gif)

PrinceLists turns a note into a todo list you can tick, drag and plan, on desktop and on your
phone. Underneath, it stays plain Markdown that any editor can read.

## Quick start

1. **Install** PrinceLists from Settings → Community plugins → Browse, and enable it.
2. **Make a list:** right-click a note in the file explorer and choose **Turn into list**, or a
   folder and choose **New list**. The list icon in the ribbon makes a new one too.
3. **Add items** with the **+** in the pane's header. Click an item to write notes, star it or give
   it a date.

<details>
<summary>Install by hand instead</summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/princelists/`.
3. In Settings → Community plugins, turn on community plugins if Restricted mode is on, and enable
   PrinceLists under Installed plugins.

</details>

## Features

- **Sections and notes.** Headings make sections and checkboxes make items. Anything indented under
  an item is its notes, in any Markdown.
- **Drag to reorder** an item, or a heading with its whole section.
- **Tick and forget.** Ticked items gray out, then hide after 24 hours. **Show archived** brings
  them back.
- **Stars and dates,** set in an item's open card and shown on its row.
- **Notes edit a block at a time,** with a format bar. Paste or drop pictures straight in.
- **Find and undo:** Cmd+F filters the list and Cmd+Z undoes (Ctrl on Windows and Linux).
- **Menus** on a right-click of an item, a heading or the list.

### Schedule

**Open schedule**, from the ribbon or a list's ⋯ menu, gathers the dated items of every list under
Today, Tomorrow, Next 7 days and Later. Tick them there, or open one in its list.

![The Schedule opens from the ribbon and scrolls through dated items from several lists, under Today, Tomorrow, Next 7 days and Later](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/schedule.gif)

### On your phone

Add items with the floating **+**, hold an item for half a second to drag it, and tap a heading or
an open item's ⋯ for its menu.

<p>
  <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/tick-and-drag.gif" alt="On a phone, an item is ticked, then another is held and dragged into a different section" width="300">
  <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-phone.png" alt="A grocery list on a phone, with sections, starred items and a floating add button" width="300">
</p>

### A list inside another note

Name a list in a `princelists` code block to show its items in any note, where you can tick and
edit them. If you rename the list, update the name in the block.

````markdown
```princelists
[[Groceries]]
```
````

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

- **`princelists: true`** in a note's properties makes it a list.
- **Dates** use the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin's
  format, so Tasks can read them too.
- **`✔` with the date and time** marks when an item was ticked, which Tasks' date-only `✅` can't
  hold. Tasks still counts the item as done, and shows the `✔` text as part of it.
- **Only the lines you edit change.** The rest of the note stays exactly as you wrote it.

The full format is in the
[design](docs/superpowers/specs/2026-10-20-prince-lists-design.md#file-format).

## Good to know

- **Privacy:** PrinceLists makes no network requests of its own, collects no data and needs no
  account. Obsidian renders a list's notes, so a picture linked from the web loads as in any note.
- **Obsidian Sync:** turn on Sync's "Active community plugin list" and "Installed community plugin
  list" to get PrinceLists on your other devices. Sync's automatic merge can lose a change made on
  two devices within seconds, as in any note; PrinceLists offers to copy text you were typing.
  Sync's "Create conflict file" setting avoids that, and the copies show up as extra lists.
- **Tested on** macOS and an iPhone. Stars, dates, the Schedule, block editing and lists inside
  notes are so far tested on macOS and an Android emulator. Nothing is tested on Windows, Linux or
  an iPad yet: if something looks wrong there,
  [open an issue](https://github.com/princelundgren/PrinceListsObsidianPlugin/issues).

## Contributing

Bug reports, ideas and pull requests are welcome.

- [CONTRIBUTING.md](CONTRIBUTING.md) and the
  [rules in AGENTS.md](AGENTS.md#rules-that-are-never-broken) cover how to work on the code, and
  the [code of conduct](CODE_OF_CONDUCT.md) how we work together.
- The designs for [step one](docs/superpowers/specs/2026-10-20-prince-lists-design.md) and
  [step two](docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md) say what the plugin
  does and why.
- To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The built `main.js` includes commonmark.js, entities and mdurl, under their own
licenses: see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).
