# Dashboard rewire + checkpoint one-way door

**Date:** 2026-07-26
**Status:** approved, ready to implement

Two independent defects, one spec. Both are wiring problems: the same object
offers two different actions, or an action has no inverse.

## Problem 1 — the dashboard shows every meeting twice

`ReminderCard` renders a three-column grid: *Upcoming meetings*, *Recent
summaries*, *Next up*. Columns 1 and 3 are derived from the same `meetings`
array, so a live meeting appears in both — as a `Resume` button in column 1 and
as a `LIVE NOW · join` card in column 3.

The two copies do different things:

| | column 1 | column 3 |
|---|---|---|
| click | start or resume the session | join if live, else navigate to Docket |
| order | backend order, unsorted | live first, then by scheduled time |
| time | `formatDate` — renders `Unscheduled` when null | same, plus a `LIVE NOW` state |

The grid is also hidden behind a collapsed `N REMINDERS` toggle, so the primary
content of the page requires a click to see.

### Design

Two columns, not three.

**Column 1 — "Ready to start".** One list, one sort order: live sessions first,
then meetings with a `scheduledAt` ascending, then the undated ones in the order
the backend returned them (the payload carries no created-at to sort on). One
action per row: `Resume` when `activeSession` is set, `Start` otherwise. The
whole row is clickable and does exactly what its button does — no second
branch, no route-to-Docket path.

**Column 2 — "Recent summaries".** Unchanged.

*Next up* is deleted. `Open the docket` survives as a single link below the
meeting list.

The `N REMINDERS` toggle is deleted; the lists render directly.

### Unscheduled is a first-class state

Meetings without a time are normal, not broken. A meeting can exist because a
decision is open, and forcing a date onto it contradicts the Docket model
(scheduling is a decision queue, not a calendar).

Therefore:

- Unscheduled meetings appear in the same list, sorted last.
- The word "Unscheduled" is not shown. Absent time means the meta line shows the
  project alone. Only real times are stamped.
- No "set a date" prompt or nag anywhere on the dashboard. Dates are Docket's job.

`formatDate` keeps returning `"Unscheduled"` for other callers; the dashboard
list checks for a null time itself and omits the stamp.

## Problem 2 — "Deliberately open" is a one-way door

In `CheckpointPanel`, the row controls are gated:

```tsx
{!present && decision.status !== "open" && ( /* date, owner, Deliberately open */ )}
```

Pressing **Deliberately open** sets `status: "open"`, which fails that same
condition and unmounts the entire block — including the button just pressed. No
control anywhere sets a status other than `open` back onto the record.

Neither apparent escape works:

- **Dismiss → Undo** patches `dismissed: false` and leaves `status` at `open`.
- **Re-read meeting** cannot resurrect it. `updateDecision` sets
  `source = 'facilitator'` on every edit; re-extraction deletes only
  `source = 'ai'` rows, and passes facilitator rows to the model as
  `confirmedDecisions` so it is instructed not to re-emit them.

The row is permanently stuck: wording stays editable via the pencil, but date,
owner, and status are unreachable. Because `completenessFromRecords` excludes
`open` rows from `committed`, the completeness percentage cannot be corrected
either.

### Design

Every path in gets a path out.

- Drop the `status !== "open"` gate. The control block renders for any
  non-dismissed row when `!present`; the branching happens inside it.
- **Deliberately open becomes a toggle.** It renders in a pressed state while
  `status === "open"`. Clicking it again sets `complete` if the row has a due
  date, `incomplete` if it does not.
- The date input stays visible on open rows, giving a second exit: entering a
  date sets `status: "complete"`.
- The date input becomes controlled (`value`, not `defaultValue`) so it reflects
  status changes instead of holding a stale first render.
- The owner input is never gated on status.

No backend change. Once the toggle has an inverse, the `source = 'facilitator'`
behavior is correct as written.

`present` mode stays read-only — that is the projector view and is intentional.

## Out of scope

Duplicate summary rows on the dashboard (two near-identical records minutes
apart) are a backend defect in summary creation, tracked separately. This spec
does not change summary generation.

## Verification

- `completenessFromRecords` unit tests still pass unchanged.
- New test: a decision patched to `open` and then toggled back reaches
  `incomplete` when it has no due date and `complete` when it has one.
- Dashboard renders no meeting id in more than one list.
- Typecheck (frontend + backend), full test suite, production build.
