---
status: building
verified: 2026-11-14
governs: [src/**, styles.css]
tracking: ["#320"]
---

# PrinceLists for Obsidian: repeating items

Some todos come back: watering the plants every 3 days, a weekly review, rent each month, a
yearly renewal. Without this design a ticked item hides after the archive delay and the next one
is added by hand, and a line that already repeats (`🔁`, written by hand or by the Tasks plugin)
can't be ticked, since ticking it without the next date would quietly end the repeat. This design
lets an item repeat: ticked, it is done until its next date, and then it comes back open with that
date.

## At a glance

- **The rule is Tasks' own `🔁` field,** worded as Tasks words it, so Tasks still reads it.
- **An end is a field of PrinceLists' own, `🔚`:** an end date, or a count of times left.
- **Ticking it is an ordinary tick:** `[x]` and `✔`, keeping its repeat. It grays and archives
  like any done item, so a daily item ticked today shows done today **(owner, 2026-11-14)**.
- **On its next date it comes back on the same line:** open, with that date, its count down by one
  and its checklist fresh. PrinceLists writes this itself when the list opens, redraws or gets
  focus, the one thing it writes on its own. No new line, no history of past ticks.
- **An item nobody brought back on time comes back on its latest date in its rhythm,** so a daily
  one isn't days overdue.
- **Set from the card or the row's menu,** with the next three dates shown while choosing.

## Goals

- Repeat daily, weekly, monthly or yearly, every so many, counted from the item's date or from
  the day it's ticked, until an end if it has one (#320).
- A list stays readable by Tasks: its queries see the item as repeating and its dates as dates,
  and a rule the plugin writes gives the dates Tasks would give, except where "The next date"
  names a deliberate difference.
- Ticking a repeat never loses it: a line the plugin can't repeat is refused with a message,
  never ticked as if it didn't repeat.
- **The file tells the truth to every reader (owner, 2026-11-14):** a ticked repeating item is
  `[x]` until it comes back, so Tasks, plain Markdown and any other app showing the list see it
  done, then open, with no rule of PrinceLists' own to learn.

## Not in this design

- **Rules the picker doesn't write,** such as `every weekday`, `every week on Tuesday, Friday` or
  `every month on the 2nd last Friday`. A line with one keeps the current message. Each can be added
  later, one rule at a time.
- **Setting a repeat on a selection.** The selection's menu and bar get no Repeat entry.
- **A history of past ticks,** and showing future dates in the Schedule: that belongs with a
  calendar (#75).
- **A time with the date** (#322) and **alerts** (#321).

## Anti-goals: failures even if it works

- **A repeat that silently stops,** as Tasks' does when its date is invalid.
- **A file that grows with every tick.** A daily item would add about 365 lines a year.
- **A new dependency or ported code** for date arithmetic this small (Approaches).

## Approaches (owner, 2026-11-13: B)

- **A. Port Tasks' recurrence code and add `rrule`.** Every Tasks rule would tick, with Tasks'
  exact dates. It adds a package of about 690 KB unpacked whose last GitHub release is v2.7.1
  (2022; npm has 2.8.1), with 187 open issues and 33 open pull requests and no push since June
  2024. Tasks is MIT, so a port is legal with its notice, but Obsidian's developer policies say a
  project that diverges from an existing one "should inherit no code from the original repo
  without explicit permission". That's written about forks, but a strict reviewer could read it
  against a ported module.
- **B. A small calculator of the plugin's own (chosen).** It reads and writes only the rules
  listed under "The rule", in Tasks' wording. No dependency and no ported code, and Tasks' monthly
  workaround becomes a clamp to the month's last day. Its cost: other rules keep the
  current message.
- **C. `rrule` with the plugin's own code around it.** It avoids the port but keeps the
  dependency, and still has to rebuild Tasks' month-end fixes.

### When it comes back (owner, 2026-11-14: 3)

1. **Move the dates at the tick and leave it open (2026-11-13's design).** The box reopens at once,
   so a daily item never looks done. Rejected for that.
2. **Move the dates at the tick, and draw it done until its next date.** Nothing is written later,
   but the file says `[ ]` from the tick, so every other reader of the list shows it open at once.
3. **An ordinary tick, written back open on its next date (chosen).** Every reader sees it done,
   then open. It needs a write nobody makes by hand, an exception to step one's "Background
   writes" anti-goal, which the owner made for this.

Tasks' own way, a done copy plus a new open line, is the anti-goal above.

## What's written in the file

### The rule (owner, 2026-11-13: Tasks' `🔁`)

- **Written and read in Tasks' wording,** after `🔁 ` among the title line's trailing Tasks
  fields, placed as a When is (step two's design, "When"):
  - `every day`, `every N days`
  - `every week`, `every N weeks`
  - `every month`, `every N months`, `every month on the last`, `every N months on the last`
  - `every year`, `every N years`
  - any of these followed by ` when done`
- **Read case-insensitively, with an optional U+FE0F after `🔁`,** as Tasks does. Written in
  lower case, with N from 2 up (`every 1 day` reads, `every day` is written) **(call)**.
- **Any other `🔁` text is a rule the plugin can't repeat** ("Lines it can't repeat").

### The end (owner, 2026-11-13: `🔚`)

- **Tasks can't express one:** its docs rule out `for x times` and `until <date>`.
- **Two forms:** `🔚 YYYY-MM-DD`, the last date the item may have, and `🔚 Nx`, the times left
  counting the current one. `🔚` is none of Tasks' signifiers, so Tasks shows it as part of the
  title.
- **The order on a line with everything (call):**
  `- [x] Physio ⭐ 🔚 5x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14 ^id`. The title, the star,
  the end, any `✔` marks, the Tasks fields, a block ID. The star is read only at the end of the
  title, and `✔` marks only as the run just before the Tasks fields, so the end goes between them.
  The line parser takes the end as its own part, so editing the title keeps it.
- **An end the plugin can't read** (`🔚 soon`) makes the line one it can't repeat.

## Ticking a repeating item (owner, 2026-11-14)

- **An ordinary tick:** `[x]` and `✔ date time`, as on any item (the design, "Completion"). The
  `🔁`, the end and the dates stay as written. It grays, then archives after the delay, and
  unticking it is an ordinary untick.
- **A notice says when it comes back (call),** such as "Back Tue 17 Nov", or nothing when it won't
  (see "Ending").
- **The same in a list, the Schedule, a list inside another note and a selection.** The selection
  bar no longer skips `🔁` lines.

### Lines it can't repeat (owner, 2026-11-13)

- **A rule or end it can't read, or a date on the line that doesn't exist** (`2026-02-30`), the
  anchor or another that would move: the tick is refused with a message naming the problem. Tasks
  ticks such a line and drops the repeat.

## The next date (owner, 2026-11-13)

- **The anchor is the line's first date in Tasks' order:** due (`📅`, or `📆` or `🗓` as Tasks
  reads them), then scheduled (`⏳` or `⌛`), then start (`🛫`).
- **Only those dates move,** each by the anchor's change in whole days, so their distances stay
  as they were, as in Tasks. `➕`, `❌` and the end date stay as written.
- **One step,** from a date d:
  - days and weeks: d plus N days, or 7N
  - months: the same day N months on, or the target month's last day if it is shorter, so 31 Jan
    goes to 28 Feb, as Tasks does
  - `on the last`: d's own month's last day if d is before it, otherwise the last day N months
    on. From 14 Nov that's 30 Nov, then 31 Jan for `every 2 months on the last`, as Tasks gives
  - years: the same day N years on, 29 Feb going to 28 Feb
- **From its date:** one step from the anchor, then more steps, each from the previous result,
  while the result is the tick's day or earlier. Ticked late, it comes back on the first date in
  its rhythm after that day, so an every-Sunday item stays on Sundays. A monthly item on the 31st
  drifts as Tasks' does: 31 Jan, 28 Feb, 28 Mar. Ticked early, it steps once from its date. Tasks
  steps once, even into the past: catching up is a deliberate difference.
- **`when done`, and a line with no date:** one step from the tick's day.
- **The tick's day is the date of the `✔` mark that counts** for archiving (the design, "When an
  item is archived"), so a line with two marks after a Sync merge uses the earliest. When no mark
  counts, the anchor stands in for it, and a line with no anchor either comes back at once with
  today's `⏳` **(call)**. Today is the device's local date.
- **Dates are counted as calendar dates, never as times,** so daylight-saving changes can't shift
  a day (Tasks needs a workaround for that).

## Coming back (owner, 2026-11-14)

- **Which lines:** a done line with `🔁` and a `✔` mark whose rule, end and dates the plugin can
  read. A done `🔁` line with no `✔` is a history line Tasks left when it added the next one
  itself, and stays as it is; unticking one makes it an open repeating item again.
- **When:** once today is on or after its next date.
- **One edit:** `[ ]`, the `✔` marks and any `✅` removed as unticking removes them, the anchor on
  the date it came due and the other dates moved with it, the count down by one, and every
  checklist line in the item's notes unticked, so each repeat starts its checklist fresh
  **(owner, 2026-11-13)**. Nothing else in the line or the notes changes (the design, "Editing
  never rebuilds the file").
- **The date it came due:** the latest date in its rhythm that is today or earlier, so a daily item
  comes back today, not days overdue, and a weekly one on its latest weekday. `when done`, and a
  `🔁` line with no date, have no rhythm: they come back on their next date however late, the line
  with no date gaining a `⏳`. Skipped dates don't use up the count.
- **When it's written (owner, 2026-11-14):** "when a list is opened, or when the day changes while
  one is open", by PrinceLists on the device that shows it. It is the one exception to step one's
  "Background writes" anti-goal.
  - **Every item in the list's file,** hidden ones included: archived, under a collapsed heading,
    outside a tag filter or a search. A weekly item archived since its tick still comes back.
  - **The day change is seen when the list redraws or gets focus (call),** as the Schedule sees it
    on focus: no timer, as everywhere in the plugin, so a list left untouched over midnight brings
    its items back when it's next used.
  - **The Schedule and a list inside another note (owner, 2026-11-14):** when the user opens one
    or it gets focus, for the items it gathers, which leaves out archived ones. Not when a list
    changes, as when Sync brings a change in, and not for a tab Obsidian restored at startup that
    hasn't been shown yet.
  - **A list nobody opens** keeps its items done in the file until someone does.
- **Worked out on the file's current text,** with the guarded write of a one-off action (the
  design, "Saving, outside changes, sync conflicts, undo"). When the guard refuses it, because
  another view of the same list wrote first, it writes nothing, shows nothing, and is tried again
  at the next redraw.
- **Not an Undo step (call):** nobody typed it. The build clears the list's undo history with it,
  as an outside change clears it, since a step recorded before it may no longer apply. An open
  card's notes editor shows the unticked checklist; a change typed there first is saved before it,
  so neither is lost.
- **Two devices** bringing the same item back on the same day write the same line. On different
  days they write different dates to one line, which merges as any two edits to one line do (the
  design, "Saving, outside changes, sync conflicts, undo").

### Ending (owner, 2026-11-13)

- **It doesn't come back** when its next date would be after the end date, or its count is `1x`.
  It stays done and archives, with the `🔁` and the end on the line.
- **Late past its end date (call):** its next date is within the end but today is past it. It comes
  back on the latest date in its rhythm that is on or before the end date, overdue, since it came
  due and wasn't done.

## Setting a repeat (call)

- **"Repeat…" in the row's right-click menu,** in the date entries' group after Remove date, so the
  row's menu still does what the card does (the design, "Item actions", owner, 2026-10-29). From
  the row it opens the card with the popover open.
- **And in the card's ⋯ menu,** which has no date entries, in a group of its own after Select,
  where the row's date group stands. A repeating item's card has its repeat button instead
  ("Showing a repeat").
- **A popover,** as the card's tag button opens one, anchored to the card's date. The card's date
  is the platform's own `<input type="date">` picker (step two's design, "When"), which can't hold
  more controls.
- **The popover:** how often (Day, Week, Month, Year); every how many; from its date or from when
  it's ticked; for months, the same day or the last day; an end (Never, On a date, After so many
  times); the next three dates, updated as it changes; and Remove repeat.
- **Nothing is written until Save:** #320 asks to check the next dates "before it's saved". The
  popover holds a draft; Save makes one write and one Undo step, and Escape or a click outside
  drops the draft. If the line changes from outside while it's open, Save is refused with a notice
  and the popover reopens on the new line.
- **A line whose rule or end the popover can't write** (`every weekday`, written with Tasks) shows
  that rule read-only, with only Remove repeat, so a richer rule is never overwritten without the
  user removing it first.
- **A done item given a repeat (call)** comes back as any ticked repeating item does: at the next
  redraw if its next date has passed, which clears the Save's Undo step with the rest of the
  history. A done line with no `✔` is a history line, and doesn't come back.
- **A repeat needs at least one date** on the line: due, scheduled or start.
  - **Setting a repeat on a line with none** gives it today's `⏳`. A line with a due or start date
    gets no `⏳` it didn't ask for.
  - **Clearing the card's date** removes the repeat and its end only when it leaves the line with
    no date, with a notice. A Tasks line repeating on `📅` keeps its repeat. The row menu's Remove
    date and the selection's date entries follow the same rule for each item.
  - **Removing the repeat removes the end too.**

## Showing a repeat

- **A row shows Lucide's `repeat` icon (owner, 2026-11-13)** just before its day, or alone at the
  row's end when the line shows no day, as a Tasks line repeating on `📅` alone does. Step two
  dropped the `⏳` icon from rows because a date reads as one without it (owner, 2026-11-05); a
  repeat doesn't, so it earns the room. A ticked row that will come back keeps the icon, so a
  grayed row says it isn't gone for good; a done line that won't, ended or a Tasks history line,
  shows none **(call)**.
- **The card of a repeating item shows the same icon as a button after its date,** in the card's
  tool group and its spacing **(call)**. It opens the popover. While the card shows it, its ⋯
  menu has no Repeat…, as the ⋯ leaves out what the card already shows (the design, "Item
  actions", owner, 2026-10-29 and 2026-11-11).

## What it changes elsewhere

- **`RepeatingItemError`** is thrown only for the lines it can't repeat.
- **The selection bar's skipped count** counts only those lines.
- **Overdue items (#163)** need nothing new: a repeating item is overdue like any other.
- **Cmd+F's match on a date as written** sees the line's new date.
- **A time with the date (#322)** would move with the date unchanged.

## What the build changes in the other docs

Main and the popover's pull request (#400) say a tick moves a repeating item. The same pull
request as the code that makes each of these false changes it:

- **AGENTS.md:** the summary says repeating items are done until their next date, then come back;
  "No background writes" names coming back as its one exception; the plans' line points to the
  plan that builds coming back.
- **README.md:** the feature list says ticking a repeating item marks it done until its next date;
  "Other Tasks fields, such as 📅, stay as they are" says a repeating item's 📅 and 🛫 move when it
  comes back.
- **Step one's design:**
  - "Anti-goals" names coming back as the one exception to "Background writes".
  - "Items", "Dates" and "Completion" say a repeating item is ticked like any other and its dates
    move when it comes back.
  - "Saving, outside changes, sync conflicts, undo" lists coming back with the one-off actions, and
    its undo history is cleared when an item comes back too.
- **Step two's design:** "Ticking works in place" in the Schedule ticks a repeating item like any
  other; the Schedule's "It updates" and "A list inside another note" say when they bring items
  back.
- **Selecting several rows:** a repeating item is ticked like any other.
- **The other designs' "nothing is written in the background"** (step two, notes in one editor,
  selecting several rows, filtering by tag) stay as written: each defers to step one's rules,
  which now name the exception.
- **The plan of 2026-11-13** stays as the record of what was built; a new plan builds coming back.

## Accepted costs

- **Ticked from Tasks' own views,** Tasks adds a new line its own way and ignores the end, which it
  copies into the title of both lines.
- **No record of when a repeating item was done,** once it has come back.
- **Coming back on a stale copy can lose another device's edit (owner, 2026-11-14).** A list
  opened before Sync brings in a change from another device writes from the older copy, and Sync's
  merge can read that write as deleting the change (the design, "Saving, outside changes, sync
  conflicts, undo"). The same holds for any edit made in a list then, but nobody typed this one.
  The lost change can be a later tick, which brings the item back open, or any other edit to that
  list.
- **A repeat ticked by anything that doesn't write PrinceLists' `✔`,** such as Obsidian's own
  checkbox, writes `[x]` with no `✔` and reads as a Tasks history line: it stays done. So does a
  done line whose rule or end is edited into one the plugin can't read.
- **A list nobody opens** shows its items done to other readers past their next date.

## Left to the builder

- The notice's wording and how long it shows, and what a selection's tick says.
- How the popover's controls look on a phone, within the design's touch rules.

## Tests

- Every rule form, read and written, in both cases and with U+FE0F; every end form; a line with
  star, end, marks, fields and block ID parsed and written in the order above.
- The next date for each step kind, including 31 Jan monthly, `on the last` from mid-month and from
  a month's end, 29 Feb yearly, ticked early, ticked on the day, ticked late, a 31st monthly item
  missed by several months, and `when done`, checked against Tasks' "Recurring Tasks" docs page
  where they agree.
- Due, scheduled and start moving together; `➕` and the end staying; the anchor picked from each
  form of due and scheduled.
- Ticking keeps the `🔁`, the end and the dates byte for byte; every line it can't repeat is
  refused and left unchanged, including an invalid non-anchor date.
- Coming back: not before its next date; on it; days later on the latest date in its rhythm; `when
  done` and a line with no date late; the count down by one; not past the end date or from `1x`;
  late past its end date, on the last date before it; two `✔` marks; no readable mark; a Tasks
  history line never.
- Coming back changes only the title line and the checklist lines, with no card open and with the
  card's notes editor open, keeping a change typed there.
- It comes back when a list opens, redraws and gets focus, never while nothing shows the list, and
  for hidden items: archived, under a collapsed heading, outside a tag filter.
- Two views of one list bringing the same item back: one writes, the other writes nothing and
  shows nothing; the list's undo history is cleared.
- The Schedule and a list inside another note bring items back when opened and on focus, skip
  archived items, and write nothing when a list changes or for a restored tab not yet shown.
- The "Back …" notice, and none for a line that won't come back; the repeat icon on a done row
  that will come back, and none on an ended or history row; a done item given a repeat.
- Ticking several: repeating items tick, unrepeatable ones are skipped and counted.
- The popover writes once on Save, nothing on Escape, and refuses a Save after an outside change.
- Clearing a date keeps a repeat that still has a date, and removes one that doesn't.
