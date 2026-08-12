# 05 — Corrections

Dated log of corrections the product owner has made. **Read this before
repeating a past approach.** The rule itself lives in the category file; this
records that it was got wrong once, so it is not got wrong twice.

Add an entry only after a fix is approved. Newest first.

---

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
