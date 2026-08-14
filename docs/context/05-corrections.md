# 05 — Corrections

Dated log of corrections the product owner has made. **Read this before
repeating a past approach.** The rule itself lives in the category file; this
records that it was got wrong once, so it is not got wrong twice.

Add an entry only after a fix is approved. Newest first.

---

## 2026-08-14 — The room may correct its own record

**Decision:** participants holding the meeting code can now edit checkpoint
items — wording, owner, date, done — and read the transcript, without an
account. Chosen over "code to view, account to edit" knowing the trade: the
code is a shared secret, so it is now as sensitive as the record itself.
Revoking the invite kills every token minted from it, which is the mitigation.

Dismissing an item and setting a decision's status stay with the facilitator.
Those decide what the record *is*, not what it says.

Usage for the operator console is read from `session_rollups`, written once
when a meeting ends. Never aggregate live for that screen: on a launch morning
every operator refresh would otherwise scan every workspace's sessions and
transcripts on the database that is recording the meetings.

→ `03-engineering.md` (multi-tenancy, guests).

## 2026-08-14 — Admin was a workspace role, and should not have existed

**Correction:** *"the admin however is not for the user — which we tested it and
found out that instead of Stratis admin it just an organizer admin which is out
of the scope"*.

Two roles now: `facilitator` and `participant`. The facilitator inherits
everything the workspace admin could do (team, invites, plan request, beta-code
redemption) and those screens moved to **Settings → Workspace**. `/admin` is the
Stratis operator console, shown only to `PLATFORM_ADMIN_EMAILS`.

Two capabilities were deliberately dropped rather than handed to every
facilitator: seeing the whole workspace's invite links, and revoking someone
else's. You see and revoke the links you made — widening that to every
facilitator would have handed each of them the others' live join links.

→ `03-engineering.md` (multi-tenancy), `01-core-product.md` (roles).

## 2026-08-14 — A stored value nothing draws is not saved

**What happened:** the profile picture "would not update". It was saving
correctly the whole time — `avatar_url` was written, returned by `/api/profile`
and re-read on every refresh. Nothing in the UI ever rendered it, so the only
evidence the save existed was the field you had just typed into.

Before calling a write path broken, check that something reads it. Search for
the field name across `src/` — one hit in the form and none anywhere else is the
signature.

→ `02-ux-ui.md` already bans half-wired controls; this is the read side of the
same rule.

## 2026-08-14 — Dark mode is not a paid feature

**Decision:** *"I want to make the theme to be free use on black and white but
the colors should be pro"*.

The `custom_theme` lock covered light/dark and the accent together, so a Free
workspace could not turn the lights off. Light and dark are now free on every
plan; the eight accents and the custom picker stay behind `ProLock`. Free keeps
the default matcha accent — deliberately not swapped for a neutral grey, so no
existing workspace changes appearance.

The feature key is still `custom_theme` (it now means the colour), and the
pricing label changed to match: a plan page that still advertised "Dark mode"
as Pro would be selling something already given away.

→ `01-core-product.md` (plan gating).

## 2026-08-12 — Verify against the DOM, not computed style

**Correction:** *"then you should fix that problem"* — after I reported a
possible repaint bug and handed the check to him instead of settling it.

There was no bug. `getComputedStyle` was stale because the browser pane was not
compositing; React had written the correct colour to the DOM all along. The
defect was my verification method, and I should have recognised the signature —
correct after reload, wrong before it — instead of escalating a non-issue.

→ `04-environment.md` broken-command log; verification note in `03`.

## 2026-08-12 — Pro must be visible, not hidden

**Correction:** *"customer have to see the pro product in someway to make it
convincing"* — and then that the colours *"look depressing"*.

Hiding paid features means nobody learns they exist; greying them to death reads
as broken. Locked-but-visible (`ProLock`) replaced both. The muted palette came
from hand-picking a "safe" value per theme; derived readability replaced it.

→ `01-core-product.md` (locked ≠ hidden), `02-ux-ui.md` (theme and colour).

## 2026-08-12 — Failures belong at the action

**Correction:** *"I didn't mean change the wordings"* — I had rewritten error
copy when the ask was structural; then *"just make every fail to fetch item move
to another layer"*.

A page must render normally on a failed load and warn only when a button that
needs the server is pressed. Load errors and action errors are separate
variables.

→ `02-ux-ui.md` (loading, failure).

## 2026-08-12 — Structure must not wait on the server

**Correction:** *"if I press setting, it shouldn't load from the server entirely
and showing white page"*.

Page-level fetch gates banned. Shell, tabs and field labels are static and render
instantly.

→ `02-ux-ui.md` (loading).

## 2026-08-12 — Sidebar is navigation only; Thai comes first

**Correction:** *"I don't like how the mode button are in the side bar"*, then
*"I can still see the language change are on the side bar … the website not even
thai before using!"*

Theme and language moved to Settings → Preferences. `LanguageGate` now asks
before the app is used. The bell was deleted rather than left with one
notification source.

→ `02-ux-ui.md` (navigation, language).

## 2026-08-12 — No placeholders

**Correction:** *"everything should be linked up not just for a place holder or
never used"* — and the decision to cut send-to-participants in favour of an
exportable document.

Five of six Settings toggles were writing values nothing read. A control either
does something or is deleted.

→ `02-ux-ui.md` (nothing half-wired), `01-core-product.md` (no email).

## 2026-08-14 — A recording outranks navigation

**Correction:** *"is it occurred when we just navigating or always happening?
since it listen through browser and we want nothing else to interrupt it"*

An overnight audit found the microphone still live after leaving the meeting
screen, and the first fix stopped capture on unmount. Wrong trade: a
facilitator who clicks Docket mid-meeting to check a date would lose the
recording, and a recording is the one thing here that cannot be redone.

The meeting now lives in a slot outside the keyed page container — mounted
while it is on screen *or* recording, hidden rather than dropped — with a
Recording chip in the header as the way back. Nothing may end a capture except
the person who started it.

→ `02-ux-ui.md` (the meeting outlives navigation).

## 2026-08-14 — Verify the class, not the instance

**What happened:** the overnight audit found four defects that typechecked
clean and passed every test — a route family with no ownership check, a TEXT
column compared to a timestamp, an ink token that could not match its own
fill, and a race that inserted the checkpoint twice.

Each fix ships with a test that reads the *source* rather than exercising it,
because none of these can be caught at runtime without a database, a model
call, or a browser: `sessionGuards`, `columnTypes`, `extractionLock`,
`accentContrast`.

→ `03-engineering.md` (mechanical checks for silent classes).
