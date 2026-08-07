# Checkpoint Fix-it Pack + Notes Revival — design spec

Date: 2026-07-18 · Branch: Alpha · Approved by user in chat.

## Problems

1. A wrong/garbled extracted decision can't be corrected or removed at the
   checkpoint (only its date can change). Backend PATCH already accepts `text`.
2. The facilitator can't add an owner — the owner input is gated behind an
   `ownerTracking` flag no UI ever sets.
3. "Strategic Meeting Notes" panel has never rendered anything: it waits for a
   response field (`ai.blocks`) no code path sends. Meanwhile the rolling
   memory — the AI's real running notes — is stored but shown nowhere.
4. (Rider bug) New-meeting modal closes on backdrop click, wiping the form.

## Principles

- Transcript = evidence, immutable. Decisions = interpretation, editable.
- No hard deletes. Everything recoverable (Undo, or re-extract from transcript).
- Owner stays free text — accounts deferred (standing decision).

## Design

### A. Fix-it pack (CheckpointPanel, normal mode only; present mode read-only)

- **Edit text**: pencil icon on each card → inline textarea → save → existing
  PATCH `text`; row becomes facilitator-source (re-extract can't overwrite).
- **Dismiss**: ✕ icon → soft-dismiss. New `dismissed BOOLEAN NOT NULL DEFAULT
  FALSE` column on `decisions` (additive migration — same approved mechanism as
  before). Dismissed card collapses to one line: "Dismissed — Undo". Undo
  restores. Dismissed rows: kept in DB, excluded from metric and summary,
  still returned by GET (with flag) so the checkpoint can render Undo.
  Re-extract won't resurrect them (containment dedupe sees their text; row
  flips to facilitator-source on dismiss).
- **Owner always-on**: owner text input on every committed (non-open) decision,
  `<datalist>` suggestions = unique speaker names from the session transcript.
  Remove the `ownerTracking` gate entirely.

### B. Notes revival

- When `routeTextToAi` writes a new rolling summary, also
  `pushNotes(sessionId, text)` → hub broadcast `{type: "notes:update",
  sessionId, text}` (mirrors pushSuggestion).
- `useSuggestionSocket` gains an `onNotesUpdate` handler option.
- Meeting.tsx keeps `liveNotes` state; "Strategic Meeting Notes" renders it
  (falls back to placeholder when empty). On page load, seed from the session's
  stored rolling_summary via the existing recovery/session fetch if available;
  otherwise it fills on the next IMPORTANT chunk.

### C. Modal backdrop fix

- `Modal` gains `closeOnBackdrop?: boolean` (default true — current behavior).
- NewMeetingModal passes `closeOnBackdrop={false}`: closes on Cancel or
  Escape only. (Escape kept: it's deliberate, not a mouse slip.)

## Out of scope

Post-meeting editing (checkpoint is the fix window), bulk actions, owner
accounts, editing open items' revisit text.

## Verification

Live browser e2e: garble a decision → pencil-edit text → dismiss one → Undo →
re-extract (dismissed stays gone) → owner typed via datalist → metric/summary
exclude dismissed → notes panel fills after an IMPORTANT chunk → new-meeting
modal survives backdrop click.
