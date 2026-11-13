---
status: building
verified: 2026-11-13
governs: [src/**, styles.css]
tracking: ["#320"]
---

# PrinceLists for Obsidian: repeating items

Some todos come back: watering the plants every 3 days, a weekly review, rent each month, a
yearly renewal. Today a ticked item hides after the archive delay and the next one is added by
hand, and a line that already repeats (`🔁`, written by hand or by the Tasks plugin) can't be
ticked at all: the plugin shows a message, since ticking it without the next date would quietly
end the repeat (the design, "Items"). This design lets an item repeat, and makes ticking it bring
it back with its next date.

## At a glance

- **The rule is Tasks' own `🔁` field,** worded as Tasks words it, so Tasks still reads it.
- **An end is a field of PrinceLists' own, `🔚`:** an end date, or a count of times left.
- **Ticking moves the date forward on the same line.** The line stays open, its notes and place
  stay put, its checklist starts fresh, and a notice with Undo says the next date. No new line,
  no history of past ticks.
- **A missed item jumps to its next date after today,** keeping its rhythm.
- **Set from the card or the row's menu,** with the next three dates shown while choosing.

## Goals

- Repeat daily, weekly, monthly or yearly, every so many, counted from the item's date or from
  the day it's ticked, until an end if it has one (#320).
- A list stays readable by Tasks: its queries see the item as repeating and its dates as dates,
  and a rule the plugin writes gives the dates Tasks would give, except where "The next date"
  names a deliberate difference.
- Ticking a repeat never loses it: a line the plugin can't repeat is refused with a message,
  never ticked as if it didn't repeat.

## Not in this design

- **Rules the picker doesn't write,** such as `every weekday`, `every week on Tuesday, Friday` or
  `every month on the 2nd last Friday`. A line with one keeps today's message. Each can be added
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
  workaround becomes a clamp to the month's last day. Its cost: other rules keep today's message.
- **C. `rrule` with the plugin's own code around it.** It avoids the port but keeps the
  dependency, and still has to rebuild Tasks' month-end fixes.

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

## Ticking a repeating item

### The next date (owner, 2026-11-13)

- **The anchor is the line's first date in Tasks' order:** due (`📅`, or `📆` or `🗓` as Tasks
  reads them), then scheduled (`⏳` or `⌛`), then start (`🛫`).
- **Only those dates move,** each by the anchor's change in whole days, so their distances stay
  as they were, as in Tasks. `➕`, a leftover `✅` or `❌`, and the end date stay as written.
- **One step,** from a date d:
  - days and weeks: d plus N days, or 7N
  - months: the same day N months on, or the target month's last day if it is shorter, so 31 Jan
    goes to 28 Feb, as Tasks does
  - `on the last`: d's own month's last day if d is before it, otherwise the last day N months
    on. From 14 Nov that's 30 Nov, then 31 Jan for `every 2 months on the last`, as Tasks gives
  - years: the same day N years on, 29 Feb going to 28 Feb
- **From its date:** one step from the anchor, then more steps, each from the previous result,
  while the result is today or earlier. A missed item lands on the first date after today, so an
  every-Sunday item stays on Sundays. A monthly item on the 31st drifts as Tasks' does: 31 Jan,
  28 Feb, 28 Mar. Ticked early, it steps once from its date. Tasks steps once, even into the past:
  catching up is a deliberate difference.
- **`when done`:** one step from today.
- **Today is the device's local date** at the tick.
- **Dates are counted as calendar dates, never as times,** so daylight-saving changes can't shift
  a day (Tasks needs a workaround for that).

### Ending (owner, 2026-11-13)

- **The last tick is an ordinary tick** when the next anchor date would be after the end date, or
  the count is `1x`: `[x]` and `✔`, then it archives. The `🔁` and the end stay on the done line.
- **Otherwise a count goes down by one per tick.** Dates skipped by a missed item don't use it up.

### The write

- **One edit:** the title line's dates and count change in place, and every checklist line in the
  item's notes is unticked, so each repeat starts its checklist fresh **(owner, 2026-11-13)**.
  Nothing else in the line or the notes changes (the design, "Editing never rebuilds the file").
- **An open card's notes editor** shows the unticked checklist after the tick, and a change typed
  there first is saved before it, so neither is lost. No tick wrote into the notes before, so the
  build checks this.
- **No `✔` and no `[x]`** on a tick that moves the date.
- **A notice says the next date, with Undo** **(call)**, such as "Next: Tue 17 Nov". Undo puts the
  title line and the checklist back as they were.
- **The same in a list, the Schedule and a list inside another note.** In the Schedule the item
  moves to its new group.
- **Ticking several at once** moves each repeating item forward. The selection bar no longer skips
  them. A line it can't repeat is still skipped and counted in the message.
- **Two devices ticking the same item on the same day** before a sync write the same line, so the
  merge is clean.

### Lines it can't repeat (owner, 2026-11-13)

- **A rule or end it can't read, or a date on the line that doesn't exist** (`2026-02-30`), the
  anchor or another that would move: the tick is refused with a message naming the problem, as
  ticking a repeat is refused today. Tasks ticks such a line and drops the repeat.
- **A line that is already done** never repeats: only a tick from not done to done does, as in
  Tasks. A file kept with Tasks holds many `[x] … 🔁` history lines; they stay as they are.
  Unticking one makes it an open repeating item again.
- **A `🔁` line with no date** gets a `⏳` one step from today, as `when done` would, and a count
  goes down as on any tick.

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
  repeat doesn't, and a ticked repeating row doesn't go away, so it earns the room.
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

The same pull request as the code that makes each one false:

- **README.md:** the feature list gains repeating items, and "Other Tasks fields, such as 📅, stay
  as they are" says that a tick moves a repeating item's 📅 and 🛫 too.
- **Step one's design:** "Items" no longer refuses to tick 🔁 lines but points here; "Dates" says
  a repeating item's tick moves its dates; "Item actions" adds Repeat… to the row's menu, in the
  date group, and to the card's ⋯, in a group of its own after Select; its test list's "refusing
  to tick 🔁" becomes this design's tests; its later features no longer list repeating items.
- **Step two's design:**
  - "When" and its "On a row" say a row shows no icon with its day, except a repeating item's
    `repeat`, pointing here.
  - "When and the Schedule view" no longer shows a message for a 🔁 item.
  - "Star" puts `🔚` between the star and the `✔` marks in its order, and adds a repeating card's
    repeat button to the card's tool group (owner, 2026-11-07, #339).
- **Selecting several rows:** a repeating item is moved, not skipped, by Tick.

## Accepted costs

- **Ticked from Tasks' own views,** Tasks adds a new line its own way and ignores the end, which it
  copies into the title of both lines.
- **A task that waits on a repeating one** (`⛔` naming its `🆔`) stays blocked, since the line
  never becomes done.
- **No record of when a repeating item was done.**

## Left to the builder

- The notice's wording and how long it shows.
- How the popover's controls look on a phone, within the design's touch rules.

## Tests

- Every rule form, read and written, in both cases and with U+FE0F; every end form; a line with
  star, end, marks, fields and block ID parsed and written in the order above.
- The next date for each step kind, including 31 Jan monthly, `on the last` from mid-month and from
  a month's end, 29 Feb yearly, ticked early, ticked on the day, a 31st monthly item missed by
  several months, and `when done`, checked against Tasks' "Recurring Tasks" docs page where they
  agree.
- Due, scheduled and start moving together; `➕` and the end staying; the anchor picked from each
  form of due and scheduled.
- The end date reached; the count reaching `1x`; a missed item not using up the count.
- Every line it can't repeat is refused and left unchanged, including an invalid non-anchor date.
- The write changes only the title line and the checklist lines, and Undo restores them byte for
  byte; ticked with the card's notes editor open, it keeps a change typed there.
- Ticking several: repeating items move, unrepeatable ones are skipped and counted.
- The popover writes once on Save, nothing on Escape, and refuses a Save after an outside change.
- Clearing a date keeps a repeat that still has a date, and removes one that doesn't.
