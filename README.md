# PrinceLists

Todo lists for Obsidian, kept as plain Markdown notes.

> **Work in progress.** There's nothing to install yet. The design is approved and the first part
> is about to be built. You can follow along in the
> [design](docs/superpowers/specs/2026-10-20-prince-lists-design.md) and the pull requests.

## What it does

- **Each list is an ordinary note** with `princelists: true` at the top. Open it and you see a
  clean todo list. Turn the plugin off and it is still a readable note.
- **Headings make sections, and checkboxes are items.** Anything indented under an item is that
  item's notes, and notes can hold any Markdown: links, pictures, bullet lists.
- **Ticking an item** grays it out where it is. Twenty-four hours later it's archived and hidden,
  and "Show archived" brings archived items back.
- **It's built for the Mac and the iPhone.** Use the floating "+" to add items. On the Mac,
  right-click for actions and drag items with the mouse. On the iPhone, item actions are in the ⋯
  button on an open item, and tapping a heading opens its menu. Other devices aren't tested.

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

## Privacy

PrinceLists works only on notes you open in Obsidian: in your vault, or on the Mac a note opened
from outside it. It makes no network requests, collects no data, and needs no account.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), the rules
in [AGENTS.md](AGENTS.md#rules-that-are-never-broken) and the [code of conduct](CODE_OF_CONDUCT.md).
To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
