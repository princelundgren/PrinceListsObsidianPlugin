---
status: building
verified: 2026-10-28
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
  posts an inline comment for each issue and one summary comment.
  - **The prompt is GitHub Docs' "Review code" prompt file (owner, 2026-10-21),** kept generic:
    security, performance, code quality, architecture and design, and testing and documentation.
    The owner's additions: it reads `AGENTS.md` first for the rules, and it checks drift from the
    documentation under `docs/`.
  - **Left out on purpose (owner, 2026-10-21):** the earlier prompt's lines asking for confident
    findings only, no nits the linters catch, and the rule or design section each finding breaks.
    The owner revisits that after a few real reviews, so a review shouldn't ask to restore them.
  - Issues are 🔴 critical (fix before merge) or 🟡 suggestions, each with line references, the
    problem, a suggested fix with code, and the reason. The summary adds one line on what's done
    well **(owner, 2026-10-21)**.
  - The prompt is used under CC BY 4.0
    ([source](https://docs.github.com/en/copilot/tutorials/customization-library/prompt-files/review-code),
    [license](https://creativecommons.org/licenses/by/4.0/)). The workflow's comment above it lists
    what was changed.
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
  - The review may run three exact commands, each naming its pull request: `gh pr diff`, a
    `gh pr view` query that returns only its own earlier summaries, and `gh pr comment --body-file
    -`, which posts from standard input. A redirect could feed it a file inside the checkout, but
    that adds no reach: Claude could retype anything it can read there. It can also post inline
    comments. It can't read anyone else's comments.
  - The title and description come from the pull request event: a step writes them to `.pr-text/`
    in the checkout, through environment variables as `docs.yml` does, and Claude reads the files.
    Two more `gh pr view` commands read them before, but they worked only when Claude typed them
    exactly, and the reviews of #141 and #142 said they couldn't read either. The files hold the
    text as it was when the event fired, so an edit without a push reaches the next review.
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
  - The review reads, unfiltered, the pull request's title, description and diff, written by
    someone with write access, and its own summaries. Its prompt says the same.
  - The limited token and tools bound what a successful injection could do.
- **The job token is readable.** In both workflows the action writes the job's token into the
  checkout's git configuration, in the origin URL, whatever checkout's `persist-credentials` says.
  Claude can read it there. That's accepted: the token can't push, and it expires with the job.
  So `persist-credentials: false` is tidiness, not a control. Both workflows set it; `claude.yml`
  could only once the repository was public, because while it was private the action's branch
  setup fetched with checkout's credential before setting its own.
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
  - The review allows 50 turns, `@claude` 30. This prompt's first run took 8 turns on an 86-line
    workflow change; the earlier, narrower prompt took 13 on a 598-line code change. This one
    covers five review areas and checks all of `docs/` for drift, so 50 leaves room for a large
    change, and the 20-minute job timeout still bounds a run.

## Since going public (2026-10-22)

- **A ruleset for `main`** requires a pull request, squash merges, resolved review threads, the
  `ci` and `docs` checks on an up-to-date branch, and signed commits, and blocks force pushes and
  deletion. It has no bypass. Since 2026-10-28 it also requires CodeQL results with no error
  alerts and no high or critical security alerts, so auto-merge can't merge before CodeQL ends.
- **Auto-merge** is on (2026-10-28). A personal account's repository can't use a merge queue, so a
  pull request that falls behind `main` still needs its branch updated before it merges.
- **A ruleset for tags** covers creating, updating and deleting them, since a pushed tag starts
  the release workflow. Only the repository admin role bypasses it.
- **`persist-credentials: false` in `claude.yml`,** for tidiness only (see "The job token is
  readable").
- **Actions** allow only GitHub's own actions, `anthropics/claude-code-action` and the
  `oven-sh/setup-bun` it uses, each pinned to a full commit SHA. Runs from outside contributors'
  fork pull requests wait for approval.

## Verified on the first runs (2026-10-21)

- **Both workflows run.** The review ran on the pull request that added it and posted its summary
  as `github-actions[bot]`. `@claude` answered a check issue. So the job token's permissions are
  enough for both.
- **The read block works on the runner.** Asked to use its Read tool on `/etc/hostname`, `@claude`
  was refused by `permissions.blockReadsOutsideWorkingDirectories`; only the checkout and
  `_temp/github-ci-logs` were readable.
- **The scrub and the process namespace apply.** The log lists `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: 1`
  in the action's environment, and `ps aux | wc -l` gave 5 inside Claude's shell.
- **The exact comment rule matches.** The review posted with `gh pr comment N --body-file -`.

## Not yet verified

- **Which calls the permission rules refused.** The first review reported 4 refusals, one of them
  `node scripts/check-docs.mjs`; the full output is hidden, so the others aren't known. Local
  `claude -p` probes showed the exact rules refuse near misses and the deny rules stop `git commit`
  and the push script.
- **The `@AGENTS.md` import.** Both prompts name `AGENTS.md` themselves, so a review that cites it
  doesn't show the import loaded.
