# Alignment Checkpoint — design spec

Date: 2026-07-18
Branch: `feat/alignment-checkpoint`

## Problem

Meetings fail silently. A team agrees to a sentence ("phased rollout"), not to the
same plan — vague words survive nodding. Nobody withheld a question; nobody felt
confused. The misalignment surfaces weeks later as rework and a repeat meeting.

Existing meeting tools start after the meeting and polish ambiguity into fluent
minutes, which makes fake alignment look real. Stratis' job is the opposite:
**force every fuzzy decision to become a specific one, in the last minutes of the
meeting, while fixing it costs nothing.**

## Target user

The **meeting owner** — the PM-function person, whatever their title (founder, lead,
account manager). One per meeting. They called it and they get blamed when it
produces nothing. They operate Stratis. Participants do nothing new and get a
ratified summary instead of vague minutes.

## Meeting setups (all supported by one design)

- **Nothing / table** — facilitator reads the checkpoint aloud from their laptop.
  This is the base case; it must work standalone.
- **Projector** — same checkpoint, plus an optional fullscreen "present" view.
- **Remote call** — facilitator screen-shares the present view. Same as projector.

Voice-script is the base; present mode is a thin display layer, not a separate build.

## The five features

### 1. Decision Extractor (the gate)

An AI gateway that reads the full transcript + rolling memory and returns structured
decisions. Runs at wrap-up and at session end — NOT per chunk.

Output per decision: `{ text, due_date?, owner?, scope?, status }` where
`status = complete | incomplete | open`.

- `incomplete` — a real decision missing a **due date** (universal) — or missing an
  owner **only when owner-tracking is enabled for the meeting**.
- `open` — deliberately undecided/parked (has a revisit note, not a gap).
- `complete` — has what it needs.

This is the make-or-break. Everything else reads it. Bar before building on top:
on real recordings, extracted decisions match a human's list ≥80%, with near-zero
hallucinated decisions.

Owner is **contextual**: default off. Meeting owner toggles "track owners" per
meeting. Due date is **always** the completeness test.

### 2. Closing Checkpoint (the hero)

- Wrap-up window (last 15 min, already tracked by TimeRiver) surfaces a quiet chip:
  "heard N decisions, M missing a date."
- Facilitator taps **when they choose** — never auto-interrupt.
- Shows the decision list in the meeting's language, one line each, missing pieces
  marked. Facilitator reads it aloud; the room reacts. That verbal reaction is the
  product's value — human to human.
- Per decision, tap to: set a date, set an owner (if enabled), or mark
  **deliberately open**. ~3 minutes.
- Then End Meeting.

Degradation: no time → read only the top incomplete decision. Skipped → summary
still ships with incomplete decisions labeled UNCONFIRMED. STT misheard → edit or
dismiss a line before reading.

### 3. Present Mode

Fullscreen render of the same checkpoint list for projector / screenshare. Optional.

### 4. Completeness metric

% of decisions leaving the meeting with a due date. Stored per meeting. This is the
traction number and the product's own proof it works. Secondary later:
repeat-meeting rate.

### 5. Honest summary

Summary persisted at session end (today it regenerates per GET, unstored).
Incomplete decisions stamped **UNCONFIRMED** so the team sees the gap instead of a
polished paraphrase.

## Build order

1. Decision Extractor — prove on real transcripts. Go/no-go gate. No UI.
2. Honest summary + persistence — backend, cheap, reuses extractor.
3. Completeness metric — falls out of stored decisions.
4. Closing Checkpoint UI — only after extractor proven.
5. Present Mode — thin layer on the checkpoint.

## Explicitly out of scope (for now)

Structure tree, participant push-delivery, 5-minute SLA, owner-tracking-everywhere.

## Architecture notes

- New AI gateway `extractDecisionsCall(ctx)` mirrors `liveCardCall` — its own
  `SYSTEM_PROMPT_DECISION_EXTRACT`, `parseDecisionExtract` validator, and DTO types
  in `shared/types.ts`. snake_case DTOs (AI JSON + DB), camelCase view types.
- Decisions persist in a new `decisions` table keyed by session + meeting, so the
  checkpoint, summary, and metric all read one source.
- Runs off the request path at session end, like the live-card routing already does.
