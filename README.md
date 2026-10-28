<h1 align="center">PrinceLists</h1>

<p align="center"><b>Todo lists for Obsidian, kept as plain Markdown notes.</b></p>

<p align="center">
  <a href="https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest"><img src="https://img.shields.io/github/v/release/princelundgren/PrinceListsObsidianPlugin" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/princelundgren/PrinceListsObsidianPlugin" alt="MIT license"></a>
</p>

PrinceLists turns a note into a todo list you can tick, drag and plan, on desktop and on your
phone. A Schedule view gathers the dated items of all your lists in one place. It's simple to use,
and powerful when you need it.

![In a todo list in Obsidian, a new item gets a title, notes with a link and a pasted picture, a star and a day, then it is dragged into place and another item is ticked](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-desktop.gif)

A ticked item grays out, and after 24 hours it's archived out of sight. **Show archived**, the
checkbox icon in the pane's header, brings archived items back, each with a blue checkbox.

![In a todo list, an item is ticked and grays out, then Show archived in the pane's header brings back three items ticked days ago, with blue checkboxes, and hides them again](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/archive.gif)

**Open schedule**, from the ribbon or a list's ⋯ menu, gathers the dated items of every list under
Today, Tomorrow, Next 7 days and Later. Tick them there, or open one in its list.

![The Schedule opens from the ribbon and scrolls through dated items from several lists, under Today, Tomorrow, Next 7 days and Later](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/schedule.gif)

On your phone, add items with the floating **+**, hold an item for half a second to drag it, and
tap a heading or an open item's ⋯ for its menu.

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/tick-and-drag.gif" alt="On a phone, in a grocery list with sections, stars and a floating add button, an item is ticked, then another is held and dragged into a different section" width="300">

Name a list in a `princelists` code block to show its items in any note, where you can tick and
edit them. If you rename the list, update the name in the block.

````markdown
```princelists
[[Groceries]]
```
````

## Full feature list

**Lists**

- **Any note can be a list.** Make a new one, or turn a note with checkboxes into one.
  **Open as Markdown** shows the plain note, and **Open as list** turns it back.
- **Sections** come from headings. Drag a section by its heading, fold it with the arrow, or
  collapse and expand them all from a menu.
- **A note for the list** under its title, for what the list is about.

**Items**

- **Add** with the **+** in the pane's header or Cmd+Enter, and **drag** to reorder.
- **A star and a date,** set in the item's open card and shown on its row.
- **Tick and forget.** A ticked item grays out and hides after 24 hours. **Show archived** brings
  archived items back, with blue checkboxes.
- **Delete** from an item's or a heading's menu, with Undo for a few seconds.

**Notes on an item**

- **Any Markdown:** links, checklists you can tick, tables and code.
- **Edited a block at a time,** with a format bar for bold, italic, strikethrough, underline, code,
  links, lists, checklists, code blocks and tables.
- **Pictures:** paste or drop them in. Right-click one to copy, remove or delete it.

**Across lists**

- **The Schedule** gathers every list's dated items under Today (overdue ones too), Tomorrow,
  Next 7 days and Later. Tick them there, or open one in its list.
- **A list inside another note:** tick, add, rename, delete and drag its items there.
- **Dates use the Tasks plugin's format,** so Tasks can read them too.

**Keys and devices**

- **Keys:** Cmd+F filters the list, Cmd+Z and Cmd+Shift+Z undo and redo, and Cmd+B, Cmd+I and
  Cmd+K format. Enter closes an open item, and Shift+Enter adds the next one. Use Ctrl on Windows
  and Linux.
- **Right-click menus** on an item, a heading, a picture and the list itself.
- **On a phone:** a floating **+**, buttons sized for a finger, hold an item to drag it, and drag
  near the edge to scroll.
- **Your theme,** light or dark: PrinceLists uses Obsidian's own colors and icons.

## Quick start

1. **Install** PrinceLists from Settings → Community plugins → Browse, and enable it.
2. **Make a list** with the list icon in the ribbon, or right-click a folder and choose
   **New list**.
3. **Add items** with the **+** in the pane's header. Click an item to write notes, star it or give
   it a date.

Already have a note with checkboxes? Right-click it in the file explorer and choose
**Turn into list**.

| The list icon in the ribbon | A folder's menu | A note's menu |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/new-list-ribbon.png" alt="The pointer on the list icon in Obsidian's ribbon, with its tooltip Create new list" width="220"> | <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/new-list-folder.png" alt="A folder's right-click menu in the file explorer, with New list highlighted" width="220"> | <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/turn-into-list.png" alt="A note's right-click menu in the file explorer, with Turn into list highlighted" width="220"> |

<details>
<summary>Install by hand instead</summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/princelists/`.
3. In Settings → Community plugins, turn on community plugins if Restricted mode is on, and enable
   PrinceLists under Installed plugins.

</details>

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
