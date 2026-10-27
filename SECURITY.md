# Security policy

PrinceLists is an Obsidian plugin that reads and edits the notes you open in Obsidian, in your
vault or from outside it. A vulnerability in it could damage or leak those notes, so security
reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.** A public report tells potential
attackers about a flaw before users have had a chance to update.

Use one of these private channels instead:

1. **GitHub private vulnerability reporting** (preferred). On this repository, open the
   **Security and quality** tab (or the "···" menu if you don't see it directly) and click
   **Report a vulnerability**, or go straight to
   <https://github.com/princelundgren/PrinceListsObsidianPlugin/security/advisories/new>. Only you
   and the maintainer can see the report, and the same thread can be used to coordinate a fix and publish
   an advisory.
2. **Email.** Send it to [contact@princelundgren.com](mailto:contact@princelundgren.com), with
   "PrinceLists" in the subject line so it doesn't get lost.

In your report, please include:

- **What's wrong:** a clear description of the issue and its impact.
- **How to reproduce it:** the steps, and a sample list note with your personal content removed.
  A screen recording helps.
- **Versions:** the PrinceLists version, the Obsidian version, and the device you saw it on
  (macOS, Windows, Linux, iPhone, iPad, Android, or other).
- **A fix:** any suggested fix or mitigation, if you have one.

## What counts

Anything that could:

- damage or leak someone's notes
- run code or open links from a note without the user choosing to
- make the plugin send data anywhere (it makes no network requests)

## What you can expect

- **Acknowledgment within 72 hours** of receiving the report.
- **An initial assessment within 7 days,** confirming the severity and giving a tentative timeline
  for a fix.
- **Coordinated disclosure.** We'll agree on a public-disclosure timeline that gives users time to
  update. The default is 90 days from the first report: shorter if a fix ships earlier, longer if
  the fix is hard.
- **Public credit** in the fix's release notes, if you want it. There is no bug bounty; this is a
  small independent project.

## Supported versions

Only the latest release receives security fixes.

## Out of scope

These aren't treated as vulnerabilities in PrinceLists:

- **Problems elsewhere:** issues in Obsidian itself, Obsidian Sync or other plugins. Please report
  those to their maintainers.
- **Attacks that need a foothold already:** bugs that require malicious code already running inside
  Obsidian, such as another plugin, with the same access as PrinceLists.
- **Theory without a demonstration:** attacks with no working proof of concept.

If you're not sure whether something qualifies, report it privately anyway. It's better to decline
an out-of-scope report than to miss a real one.
