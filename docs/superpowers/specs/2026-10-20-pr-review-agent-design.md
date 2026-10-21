---
status: building
verified: 2026-10-20
governs: [.github/workflows/claude-code-review.yml, .github/workflows/claude.yml]
---

# PrinceLists: the pull request review agent

[The main design](2026-10-20-prince-lists-design.md) has an agent give pull requests and issues a
first pass. This note covers pull requests, which get it now. Issues get it later; issue triage
has no design yet.

Decisions are marked **(owner)** and **(call)** as in the main design.

## What it does

- **Automatic review (owner, 2026-10-20).** `claude-code-review.yml` runs when a pull request from a
  branch in this repository is opened, pushed to, reopened or marked ready for review. Claude
  reviews it against `AGENTS.md`, the main design and the plan task it implements, then posts an
  inline comment for each finding and one summary comment.
  - Drafts are skipped. A person's new push cancels a review that is still running.
- **`@claude` on demand (owner, 2026-10-20).** `claude.yml` runs when a comment on an issue, or on
  a pull request from a branch in this repository, mentions `@claude`. Claude answers in a comment.
- **Forks get neither (owner, 2026-10-20).** The maintainer reviews a fork's pull request.
- **Claude reviews and answers; it doesn't change code (call).** Neither workflow lets it commit
  or push. Asking it to fix something gets a suggested change in a comment. Letting it push would
  need the Claude GitHub App's token, which carries the app's full permissions.
- **The actions.** Both workflows pin [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
  and `actions/checkout` to full commit SHAs. Dependabot proposes updates.

## Why

- **One maintainer.** A first pass catches broken rules and drift from the design before the
  owner reads the change.
- **A prompt in the workflow, not the code-review plugin (call).** The documentation offers both.
  The prompt wins because:
  - The plugin can't be pinned the documented way. The action's `plugin_marketplaces` input takes
    Git URLs and accepts one only if it ends in `.git`, so a URL can't name a ref. The action's
    source also accepts a local path, so a step could check the marketplace out at a commit, but
    the docs don't describe that, so it isn't used. Unpinned, the plugin's instructions change
    whenever its repository does.
  - The plugin stops on any pull request Claude has already commented on, so later pushes would go
    unreviewed.
  - The plugin checks rules only in `CLAUDE.md` files, and its agents get their paths, not their
    contents. Here `CLAUDE.md` is one line that imports `AGENTS.md`, so those checks would find
    the rules only if an agent followed the import. The plugin doesn't check the design.
  - It starts at least seven subagents per review, which costs subscription usage.

## Trust model

- **Who starts Claude.** The review runs only for a pull request from a branch here, opened by a
  person, so its author has write access. `claude.yml` starts only for a comment by a person whose
  association with the repository is owner, member or collaborator. The action then checks the
  commenter's write access and rejects bots. Both workflows leave `allowed_bots` empty and don't
  use `allowed_non_write_users`.
  - Claude doesn't review Dependabot's pull requests, or any other bot's: the review skips a pull
    request a bot opened and any event a bot sends, so the review never reads a bot's pull request
    text, and those events can't cancel a review. `@claude` does read it when someone with write
    access asks on a bot's pull request.
- **The token (call).** Both workflows give the action the job's own token. It can read the code
  and write to pull requests (and, for `@claude`, issues), but it can't push. The Claude GitHub
  App's token is the action's default, but it carries the app's full permissions, including
  writing code and workflows, and a workflow can't narrow them. Comments therefore come from
  `github-actions[bot]`.
- **The tools (call).**
  - The review may run five exact commands, each naming its pull request: `gh pr diff`, three
    `gh pr view` commands (the title, the description, and a query that returns only its own
    earlier summaries) and `gh pr comment --body-file -`, which posts from standard input. A
    redirect could feed it a file inside the checkout, but that adds no reach: Claude could retype
    anything it can read there. It can also post inline comments. It can't read anyone else's
    comments.
  - For `@claude`, deny rules take back the file-edit tools, `git add`, `git commit`, `git rm` and
    the push that the action grants when it's mentioned. In the action's `acceptEdits` mode, shell
    commands such as `mkdir`, `mv` or `sed` can still change files in the checkout, but nothing
    can commit or push them.
  - Neither workflow can use `WebFetch`, which would otherwise reach some preapproved domains
    without asking.
- **Reads stay in the working directory (call).** Both workflows set Claude Code's
  `blockReadsOutsideWorkingDirectories`, so Claude's file tools and its shell reads can't reach
  outside the checkout. That matters because the action's own processes keep the Claude token in
  their environment, readable under `/proc`. `@claude` also gets the folder where the action
  writes CI job logs.
- **The environment scrub (call).** Both workflows set `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`, so the
  commands Claude runs don't get the credentials it recognizes, such as the Claude token. GitHub
  tokens stay, so `gh` works. It cleans only the processes Claude starts, not the action's own,
  hence the read block above. Claude Code also runs those commands in their own process
  namespace, which hides the action's processes from them.
  - **It needs bubblewrap, and fails closed without it.** The first run stopped with "error:
    bubblewrap is required for subprocess env scrubbing and isolation". So a step before the action
    installs bubblewrap and lifts Ubuntu 24.04's AppArmor block on user namespaces, as the action's
    own isolation step does. That step only runs with `allowed_non_write_users`. A failed install
    fails the job.
- **No approvals.** No tool can approve, and the repository doesn't let the job's token approve
  pull requests. The owner merges.
- **Configuration and rules.** The action restores `.claude/`, `.mcp.json`, `CLAUDE.md` and similar
  files from the base branch. `AGENTS.md` isn't on that list, so a pull request that edits it is
  reviewed against its own version. Only people with write access open pull requests from
  branches here, and neither workflow runs on a fork's, so a fork's `AGENTS.md` never reaches
  Claude.
- **Untrusted text.** Issues and comments can come from anyone and carry hidden instructions.
  - For `@claude`, the action strips hidden markup from the context it gathers, and its docs warn
    that new bypasses may emerge. An appended system prompt tells Claude that this text, and a pull
    request's code, is material to read, never instructions.
  - The review reads through `gh`, unfiltered: the pull request's title, description and diff,
    written by someone with write access, and its own summaries. Its prompt says the same.
  - The limited token and tools bound what a successful injection could do.
- **The job token is readable.** In both workflows the action writes the job's token into the
  checkout's git configuration, in the origin URL, whatever checkout's `persist-credentials` says.
  Claude can read it there. That's accepted: the token can't push, and it expires with the job.
  So `persist-credentials: false` is tidiness, not a control. The review sets it. `claude.yml`
  doesn't while the repository is private, because the action fetches branches before it sets
  the token.
- **Accepted: the summary filter.** The review reads earlier comments by `github-actions` that
  start with "## Claude review". `@claude`'s comments come from the same account, so an injected
  `@claude` could plant one. That would need `@claude` to be injected first, which already reaches
  further.

## Auth and cost (owner, 2026-10-20)

- **A Claude subscription token.** The workflows read a `CLAUDE_CODE_OAUTH_TOKEN` secret, made
  with `claude setup-token`. It lasts a year. Runs count against the subscription's usage, not
  API billing. Neither workflow needs the Claude GitHub App, only this secret. Replies post as
  `github-actions[bot]`.
- **Bounded runs (call).** Each workflow sets `--max-turns` and a job timeout. A run that reaches
  the turn limit ends with an error, possibly before the review's summary is posted. A person's
  new push cancels a review that is still running.

## Before going public

- **A ruleset for `main`.** Until one protects `main`, nothing on GitHub's side stops a push there.
- **A ruleset for tags** that covers creating, updating and deleting them, since a pushed tag
  starts the release workflow.
- **`persist-credentials: false` in `claude.yml`,** for tidiness only (see "The job token is
  readable"). Once the repository is public, the action's branch setup can fetch without it.

## Not yet verified

- **Neither workflow has run.** They need the secret. With it set, the review should also run on
  the pull request that adds it.
- **The job token's permissions are enough.** The action's docs support passing it, and GitHub's
  docs list the permissions each call needs, but no run has shown it.
- **The permission rules.** Local `claude -p` probes on macOS, with the read block on, showed:
  the exact rules allow their commands and refuse near misses; a heredoc on standard input
  passes; a `$(cat <<EOF)` body is refused; and the deny rules stop `git commit` and the push
  script. With `Read` allowed, as the action allows it for `@claude`, the Read tool read a file
  outside the working directory without the read block and was refused with it. The action's
  argument parser was replayed locally too. No run on the runner has tested them.
- **The scrub.** The first run's log should list `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: 1` in the
  environment of the action's "Run Claude Code Action" step.
- **The process namespace.** With bubblewrap installed it should apply. Asking `@claude` to run
  `ps aux | wc -l` confirms it: the count should be in single digits.
- **The `@AGENTS.md` import.** Claude Code's docs say a `CLAUDE.md` import loads the file, and
  the action loads project settings. No run has shown it yet.
