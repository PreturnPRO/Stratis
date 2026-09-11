# 05 — Corrections

Dated log of corrections the product owner has made. **Read this before
repeating a past approach.** The rule itself lives in the category file; this
records that it was got wrong once, so it is not got wrong twice.

Add an entry only after a fix is approved. Newest first.

---

## 2026-09-11 — The desktop app is a remake, not a wrapper

**Correction:** *"we're going to remake the desktop app, only using similar theme
and better feature, this is not related to stratis website, that is just an MVP
so don't need to be react"*.

I had proposed an Electron shell around the website's React build, sharing
`src/`. The owner wants a separate native product instead: C# .NET + Avalonia in
its own repo, the Control Room theme carried over as tokens, the backend and
accounts reused, participants still in the browser. Native audio settled the
stack — Windows' echo cancellation with the speakers as reference and per-app
loopback capture are not reachable from a browser engine.

Also decided the same day: the website's audio defects are fixed directly on
`main`, and speech-to-text stays `chirp_2`.

→ `01-core-product.md` (the website and the desktop app).

## 2026-08-15 — Five defects found in the room, and one decision reversed

Reported together, all five marked critical.

- **The room may not correct its own record after all.** *"the person who joins
  through code can fix the details of the checkpoint, this could be a major
  issue instead of just being able to vote if its right or wrong"* — this
  reverses the decision below dated 2026-08-14. The trade was taken knowingly
  and it was the wrong one: the meeting code is read out loud in a room and
  forwarded afterwards, so an edit control on that screen let anyone who
  overheard six characters rewrite what a meeting decided, under the
  facilitator's name. The tick and the flag stay; the flag carries a note
  saying what the room actually decided, and the facilitator applies it. The
  `PATCH /api/room/session/:id/decisions/:id` route is deleted, not guarded —
  a route that must never succeed should not exist.
- **The AI co-facilitator could only be answered out loud.** The card stack's
  one action was "Mark answered", so replying to it meant interrupting whoever
  was speaking in order to talk to a machine. Every card now carries a text box;
  the typed answer is written into the transcript as a facilitator turn, so the
  live pass stops re-raising the question and the summary can see what settled
  it.
- **The recogniser invented transcripts out of silence.** Chirp does not return
  nothing when it is fed nothing — room tone produced digits and half-sentences
  that became transcript rows and then AI input. Fixed at the source: the
  browser does not stream audio unless someone is speaking.
- **A guest's transcript never updated.** It was fetched once and never again,
  so the panel froze the moment it opened and a browser refresh was the only way
  to see another line.
- **A document was titled with its own primary key.** "Prj 733f4654 9ced 4750
  A8e2 D773de95c349" instead of "Stratis Review": the heading was derived from
  the project id because no document payload carried `projects.name`. Every
  document route returns `projectName` now.

→ `02-ux-ui.md` (the room, answering a card), `03-engineering.md` (guest write
boundary, the silence gate, ids are not names).

## 2026-08-15 — The workspace was never the product

**Correction:** *"I make this so the facilitator is the only and only user
hosting the whole meeting with an outsider participant to see the transcript
and edit — not this kind of work space bullshit"*, and *"like a kahoot system
for user to easily use the product rather than adding everyone one by one"*.

One role. Members, invite-a-teammate, seats and team analytics are deleted —
front and back — and Settings is Profile, Preferences, Plan & usage, Security.
The organisation row stays as an invisible container so `org_id` scoping is not
rewritten.

The four defects underneath it, each of which had a cause worth keeping:

- **The meeting code was invisible** — minted on demand from inside the
  checkpoint panel. It is now opened with the session and sits in the header.
- **The clock restarted on every refresh** — it counted from page load and fell
  back to `Date.now()`. It is the session's clock now, and the same subtraction
  the biller does.
- **A duplicate project name returned "Internal server error"** — and not even
  the user's own duplicate: `projects.id` is a *global* primary key while the
  existence check is scoped to the workspace, so a name any other workspace had
  used broke the insert. The id gets a suffix; the name is left alone.
- **Nobody could see who joined** — joining by code recorded no presence at all.

Spec: `docs/superpowers/specs/2026-08-15-one-facilitator-design.md`.

→ `01-core-product.md`, `03-engineering.md` (roles, clock, presence).

## 2026-08-14 — The room may correct its own record — **reversed 2026-08-15**

**Decision, since overturned:** participants holding the meeting code could edit
checkpoint items — wording, owner, date, done — and read the transcript, without
an account. Chosen over "code to view, account to edit" knowing the trade: the
code is a shared secret, so the record became as sensitive as the code.

That trade did not survive contact with a real room. See the 2026-08-15 entry:
guests vote and flag, and only the facilitator writes. Reading the transcript
without an account survives unchanged — a participant who was there already
heard every word.

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
