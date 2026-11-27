---
status: building
verified: 2026-11-25
governs: [.github/workflows/claude-code-review.yml]
---

# PrinceLists: the pull request review agent

[The main design](2026-10-20-prince-lists-design.md) has an agent give pull requests and issues a
first pass. This note covers pull requests, which get it now. Issues get it later; issue triage
has no design yet.

Decisions are marked **(owner)** and **(call)** as in the main design.

## What it does

- **Automatic review (owner, 2026-10-20).** `claude-code-review.yml` runs when a pull request from a
  branch in this repository is opened, pushed to, reopened or marked ready for review. Claude
  posts an inline comment for each issue and one summary comment, whose first line names the
  commit it reviewed: "## Claude review of" and the pull request's head commit, so whoever merges
  can check that the review saw the commit being merged **(owner, 2026-11-18)**.
  - **It calls the shared review (owner, 2026-11-18).** `claude-code-review.yml` is a caller of
    [prince-claude-pr-review-workflow](https://github.com/princelundgren/prince-claude-pr-review-workflow)'s
    `claude-review.yml` at its `v2` tag, granting `id-token: write` and passing only the
    `CI_SECRETS_AWS_ACCOUNT` secret: `v2` reads the Claude token from the maintainer's AWS
    Parameter Store over GitHub OIDC **(owner, 2026-11-25)**. The prompt, the
    tools and the job's safeguards live there; its README's "What it does" and "What it guards"
    describe them.
  - It reads `AGENTS.md` first, so this repository's rules, keeping `docs/` true among them, apply
    to every review.
  - Findings are 🔴 Critical Issues, 🟡 Suggestions and 🔵 Nits, and the summary lists under ✅
    Checked what the review found sound. Every push starts another review, so a 🔵 is fixed only
    in a push that also fixes something else; otherwise it gets a reply saying why not, and its
    thread is resolved.
  - The shared workflow's job skips drafts, a fork's pull request, and anything a bot opened or
    sent. The caller's `concurrency` lets a person's new push cancel a review that is still running.
- **No `@claude` (owner, 2026-11-25).** The mention workflow, `claude.yml`, was removed: from
  2026-10-21 nobody asked it anything, and replies that only named it started runs that spent
  subscription usage.
- **Forks get no review (owner, 2026-10-20).** The maintainer reviews a fork's pull request.
- **Claude reviews; it doesn't change code (call).** The review can't commit or push. Letting it
  push would need the Claude GitHub App's token, which carries the app's full permissions.
- **The actions.** The review calls the shared workflow at `v2`, a moving tag for releases with the
  same caller contract.

## Why

- **One maintainer.** A first pass catches broken rules and drift from the design before the
  owner reads the change.
- **A shared review, not a copy (owner, 2026-11-18).** Several repositories use the same review,
  so a fix to it lands once, and `v2` brings it here without a change in this repository.
- **A review prompt, not the code-review plugin (call).** The documentation offers both.
  The prompt wins because:
  - The plugin can't be pinned the documented way. The action's `plugin_marketplaces` input takes
    Git URLs and accepts one only if it ends in `.git`, so a URL can't name a ref. The action's
    source also accepts a local path, so a step could check the marketplace out at a commit, but
    the docs don't describe that, so it isn't used. Unpinned, the plugin's instructions change
    whenever its repository does.
  - The plugin stops on any pull request Claude has already commented on, so later pushes would go
    unreviewed.
  - The plugin checks rules only in `CLAUDE.md` files, and its agents get their paths, not their
    contents. This repository keeps its rules in `AGENTS.md` and has no `CLAUDE.md`, so those
    checks would find none. The plugin doesn't check the design.
  - It starts at least seven subagents per review, which costs subscription usage.

## Trust model

The review's settings below are the shared workflow's, at whatever `v2` points to.

- **Who starts Claude.** The shared workflow's job runs the review only for a pull request from a
  branch here, opened by a person, so its author has write access. It leaves `allowed_bots` empty
  and doesn't use `allowed_non_write_users`.
  - Claude doesn't review Dependabot's pull requests, or any other bot's: the gate covers the pull
    request's author and the event's sender, so the review never reads the text of a pull request
    a bot opened, and a bot's events can't cancel a review. Commits inside a person's pull request
    can come from anyone.
- **The token (call).** The review gives the action the job's own token. It can read the code
  and write to pull requests, but it can't push. The Claude GitHub
  App's token is the action's default, but it carries the app's full permissions, including
  writing code and workflows, and a workflow can't narrow them. Comments therefore come from
  `github-actions[bot]`.
- **The tools (call).**
  - The review's tools, and how it reads the pull request's title, description and commits, are
    the shared workflow's (its README, "What it guards"): three exact `gh` commands for its own
    pull request, inline comments, and no way to read anyone else's comments. It isn't given each
    commit's changed lines, so the author checks the commit size rule in `AGENTS.md`.
  - The review can't use `WebFetch`, which would otherwise reach some preapproved domains without
    asking.
- **Reads stay in the working directory (call).** The shared workflow sets Claude Code's
  `blockReadsOutsideWorkingDirectories`, so Claude's file tools and its shell reads can't reach
  outside the checkout. That matters because the action's own processes keep the Claude token in
  their environment, readable under `/proc`.
- **The environment scrub (call).** The shared workflow sets `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`,
  so the commands Claude runs don't get the credentials it recognizes, such as the Claude token. GitHub
  tokens stay, so `gh` works. It cleans only the processes Claude starts, not the action's own,
  hence the read block above. Claude Code also runs those commands in their own process
  namespace, which hides the action's processes from them.
  - **It needs bubblewrap, and fails closed without it.** The first run stopped with "error:
    bubblewrap is required for subprocess env scrubbing and isolation". So a step before the action
    installs bubblewrap and lifts Ubuntu 24.04's AppArmor block on user namespaces, as the action's
    own isolation step does. That step only runs with `allowed_non_write_users`. A failed install
    fails the job.
- **No approvals.** No tool can approve, and the repository doesn't let the job's token approve
  pull requests. The owner merges, or an agent the owner asks to.
- **Configuration and rules.** The action restores a fixed list of paths at the repository's root,
  such as `.claude/`, `.mcp.json` and `CLAUDE.md`, from the base branch. `AGENTS.md` and a
  `CLAUDE.md` in a subfolder aren't on that list, so a pull request that edits or adds one is
  reviewed against its own version. Only people with write access open pull requests from
  branches here, and the review doesn't run on a fork's, so a fork's `AGENTS.md` never reaches
  Claude.
- **Untrusted text.** Issues and comments can come from anyone and carry hidden instructions.
  - The review reads, unfiltered, the pull request's title, description, commit messages and diff,
    written or pushed by someone with write access, and its own summaries. Its prompt says the
    same.
  - The limited token and tools bound what a successful injection could do.
- **The job token is readable.** The action writes the job's token into the
  checkout's git configuration, in the origin URL, whatever checkout's `persist-credentials` says.
  Claude can read it there. That's accepted: the token can't push, and it expires with the job.
  So `persist-credentials: false` is tidiness, not a control.

## Auth and cost (owner, 2026-10-20)

- **A Claude subscription token**, made with `claude setup-token`. It lasts a year. The review
  reads it from Parameter Store through the shared workflow. Runs count against the
  subscription's usage, not API billing. The review doesn't need the Claude GitHub App. Replies
  post as `github-actions[bot]`.
- **Bounded runs (call).** The shared workflow allows 50 turns and 20 minutes. A run that reaches
  the turn limit ends with an error, possibly before the review's summary is posted. A person's
  new push cancels a review that is still running.

## Since going public (2026-10-22)

- **A ruleset for `main`** requires a pull request, squash merges, resolved review threads, the
  `ci` and `docs` checks on an up-to-date branch, and signed commits, and blocks force pushes and
  deletion. It has no bypass. Since 2026-10-28 it also requires CodeQL results with no error
  alerts and no high or critical security alerts, so auto-merge can't merge before CodeQL ends.
- **Auto-merge** is on (2026-10-28). A personal account's repository can't use a merge queue, so a
  pull request that falls behind `main` still needs its branch updated before it merges.
- **A ruleset for tags** covers creating, updating and deleting them, since a pushed tag starts
  the release workflow. Only the repository admin role bypasses it.
- **Actions** allow only GitHub's own actions, `anthropics/claude-code-action`, the
  `oven-sh/setup-bun` it uses, the shared review's repository
  (`princelundgren/prince-claude-pr-review-workflow/*`), and the token reader it runs,
  `princelundgren/prince-ssm-secrets-action` with the `aws-actions/configure-aws-credentials` it
  uses. Runs from outside contributors' fork pull requests wait for approval.

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
