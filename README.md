<h1 align="center">PrinceLists</h1>

<p align="center"><b>Todo lists for Obsidian, kept as plain Markdown notes.</b></p>

<p align="center">
  <a href="https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest"><img src="https://img.shields.io/github/v/release/princelundgren/PrinceListsObsidianPlugin" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/princelundgren/PrinceListsObsidianPlugin" alt="MIT license"></a>
</p>

PrinceLists turns a note into a todo list, and a Schedule view shows what's coming up across all
your lists. It's simple to use, and powerful when you need it.

![In a todo list in Obsidian, a new item gets a title, notes with a link and a pasted picture, a star and a day, then it is dragged into place and another item is ticked](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/list-desktop.gif)

Make a list from the ribbon, a folder, or a note you already have.

| Click the list icon in the ribbon | Right-click a folder in the sidebar | Right-click a note to turn it into a list |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/new-list-ribbon.webp" alt="The pointer on the list icon in Obsidian's ribbon, with its tooltip Create new list" width="220"> | <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/new-list-folder.webp" alt="A folder's right-click menu in the file explorer, with New list highlighted" width="220"> | <img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/turn-into-list.webp" alt="A note's right-click menu in the file explorer, with Turn into list highlighted" width="220"> |

Ticked items hide after a day. Show archived brings them back, with blue checkboxes.

![In a todo list, an item is ticked and grays out, then Show archived in the pane's header brings back three items ticked days ago, with blue checkboxes, and hides them again](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/archive.gif)

Each item has a title, a date, a star and powerful notes, with a toolbar for formatting.

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/notes.webp" alt="An open item whose notes hold bold text, a link, a checklist, a table and a picture, with the format bar under the line being edited" width="520">

The Schedule shows the dated items from all your lists.

![The Schedule opens from the ribbon and scrolls through dated items from several lists, under Today, Tomorrow, Next 7 days and the start of Later](https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/schedule.gif)

It works great on your phone too.

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/tick-and-drag.gif" alt="On a phone, in a grocery list with sections, stars and a floating add button, an item is ticked, then another is held and dragged into a different section" width="300">

You can embed lists in normal notes.

````markdown
```princelists
[[Hardware store]]
```
````

<img src="https://raw.githubusercontent.com/princelundgren/PrinceListsObsidianPlugin/main/docs/images/embedded-list.webp" alt="An ordinary note with a paragraph above and below the Hardware store list, shown with its checkboxes, a star and a New item button" width="540">

## Full feature list

**Lists**

- **Any note can be a list:** make a new one, or turn a note with checkboxes into one.
- **Back to Markdown** any time with **Open as Markdown**.
- **Sections** come from headings. Drag them, collapse one, or collapse them all.
- **A note for the list** sits under its title.

**Items**

- **Add** with the **+**, and **drag** to reorder.
- **Star** an item and give it a date.
- **Tick and forget:** ticked items hide after a day.
- **Delete** with Undo.

**Notes on an item**

- **Any Markdown:** links, checklists, tables and code.
- **A toolbar** for bold, italic, links, lists, tables and more.
- **Pictures:** paste or drop them in.

**Across lists**

- **The Schedule** sorts dated items into Today (with anything overdue), Tomorrow, Next 7 days and
  Later.
- **A list inside another note** can be ticked and edited there. If you rename the list, update
  the block.
- **Works with Tasks:** dates use the Tasks plugin's format.

**Keys and devices**

- **Shortcuts:** Cmd+Enter adds an item, Cmd+F filters, Cmd+Z undoes, and Cmd+B, Cmd+I and Cmd+K
  format. Use Ctrl on Windows and Linux.
- **Right-click menus** on items, headings, pictures and the list.
- **Made for touch:** a floating **+**, finger-sized buttons, and hold to drag.
- **Fits your theme,** light or dark.

## Quick start

1. **Install** PrinceLists from Settings → Community plugins → Browse, and enable it.
2. **Make a list** with the list icon in the ribbon, or right-click a folder and choose
   **New list**.
3. **Add items** with the **+**. Click one to add notes, a star or a date.

Already have a note with checkboxes? Right-click it and choose **Turn into list**. Items already
ticked hide at once, and **Show archived** shows them.

<details>
<summary>Install by hand instead</summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/princelundgren/PrinceListsObsidianPlugin/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/princelists/`, where `<vault>` is your vault's folder.
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

- **`princelists: true`** makes a note a list.
- **Headings** are sections, **checkboxes** are items, and lines indented under an item are its
  notes.
- **An item's date** is the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)
  plugin's scheduled date, ⏳. Other Tasks fields, such as 📅, stay as they are.
- **`✔` with a time** marks when you ticked an item. Tasks still sees it as done.
- **Only the lines you edit change.** The rest of the note stays as you wrote it.

The full format is in the
[design](docs/superpowers/specs/2026-10-20-prince-lists-design.md#file-format).

## Good to know

- **Private:** PrinceLists works only on notes Obsidian opens: your vault's, and on desktop a
  note you open from outside it. No network requests of its own, no data collected, no account. A
  picture linked from the web loads as in any note. What Obsidian's plugin directory notes:
  - **Vault enumeration:** to find your lists, the Schedule goes through your vault's list of
    notes, and reads only the lists.
  - **Clipboard access:** only when you ask. Copy image and Copy text write to it, and a picture you
    paste into an item's notes is read from your paste. PrinceLists never reads the clipboard by
    itself.
- **Obsidian Sync:** turn on Sync's "Active community plugin list" and "Installed community plugin
  list" to get PrinceLists on your other devices. If two devices edit a list within seconds, Sync
  can drop one change, as in any note. Sync's "Create conflict file" setting keeps both, as extra
  lists.
- **Made for** Obsidian on macOS, iOS, Android and Windows. If something looks wrong,
  [open an issue](https://github.com/princelundgren/PrinceListsObsidianPlugin/issues).

## Contributing

Bug reports, ideas and pull requests are welcome.

- Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the
  [rules in AGENTS.md](AGENTS.md#rules-that-are-never-broken).
- Be kind: see the [code of conduct](CODE_OF_CONDUCT.md).
- The designs for [step one](docs/superpowers/specs/2026-10-20-prince-lists-design.md) and
  [step two](docs/superpowers/specs/2026-10-27-prince-lists-step-2-design.md) say what the plugin
  does and why.
- To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The built `main.js` includes commonmark.js, entities and mdurl, under their own
licenses: see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).
