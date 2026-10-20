# Contributing to PrinceLists

Thanks for helping. PrinceLists has one maintainer, so the process below keeps contributions easy
to review.

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part, you agree to
uphold it.

## Reporting bugs

- **Use the bug report form.** It asks for your PrinceLists and Obsidian versions, your device,
  and the steps that trigger the bug.
- **Strip personal content from samples.** If you attach a sample of a list note, take your
  personal content out first.
- **Security problems** don't go in a public issue: see [SECURITY.md](SECURITY.md).

## Suggesting features

- **Use the feature request form,** and start from the problem you're trying to solve.
- **Read the [design](docs/superpowers/specs/2026-10-20-prince-lists-design.md) first.** It explains
  what the plugin does and why.
  - Decisions marked **(owner)** were made deliberately. Changing one starts with an issue.
  - Decisions marked **(call)** are open to a better argument.

## Contributing code

**For anything bigger than a small fix, open an issue first,** so we can agree on the change before
you spend time on it.

### Rules every change follows

The rules come from the design, the plan, and Obsidian's developer policies and plugin guidelines,
and they apply to people and coding agents alike. They're listed in
[AGENTS.md](AGENTS.md#rules-that-are-never-broken), which also says how to work on a change. A pull
request that breaks one won't be merged; to change a rule, open an issue first.

### Pull requests

- **Keep each pull request to one change, and add tests** for any change to the core: the parsing,
  the edits and the archived rule.
- **Fill in the pull request template,** in 400 words or fewer. It asks what the change does, why,
  how you tested it, steps to reproduce, and related issues.
- **CI must pass.** For now it checks the docs and the pull request's title and description; the
  plugin's lint, build and tests join it with the project scaffold. To check your description
  before you open the pull request, save it to a file and run
  `node scripts/check-docs.mjs --pr-title="<title>" --pr-body-file <file>`.
- **Your commits don't need to be signed.** The maintainer squash-merges pull requests, and GitHub
  signs the merged commit.

### Development setup

The commands are in [AGENTS.md](AGENTS.md#commands). The docs check works now, with Node.js 22 or
later; the npm commands work once the project scaffold from the plan's Task 1 has landed.
