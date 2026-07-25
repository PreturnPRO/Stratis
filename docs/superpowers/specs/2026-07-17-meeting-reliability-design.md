# Meeting Reliability — Design Spec

**Date:** 2026-07-17
**Branch:** extreme
**Sub-project of:** Beta-ready MVP (10 Northern Thailand teams, daily use)
**Status:** Approved design → ready for implementation plan

---

## Purpose

Make a live Stratis meeting survive the messy realities of daily use by real teams:
laptops sleeping, flaky Wi-Fi, proxy idle timeouts, transient DB hiccups, and
facilitators who close the lid without pressing **End**. The core product promise
is "we capture the reasoning record your team never has time to write" — a meeting
that silently drops audio or loses a transcript row breaks that promise in front
of a paying team.

This spec covers **only** meeting-session reliability. It is the first of five
beta-ready workstreams (the others: STT Thai quality, privacy/consent, deploy/ops
visibility, multi-team onboarding).

## Success criteria

- A facilitator can run a full weekly meeting start-to-finish, survive a network
  blip and a laptop sleep, and lose **zero** finalized transcript rows.
- Dead/half-open sockets are detected and pruned server-side within ~1 minute.
- A meeting abandoned without pressing **End** is auto-ended (and its summary
  triggered) rather than lingering `active` forever.
- After a reconnect the transcript panel shows the same rows the database holds —
  no silent gap.

## Already solid (explicitly out of scope — do not rebuild)

Verified in code during design:

- STT gRPC stream rotation before Google's ~305s limit + restart on restartable
  gRPC errors incl. max-duration (`backend/src/lib/sttStream.ts`).
- STT auto-resume after reconnect (`src/pages/Meeting.tsx:338` re-sends `stt:start`).
- Session recovery endpoint + hook (`GET /api/session/recover`,
  `src/hooks/useSessionRecovery.ts`).
- WS client auto-reconnect + card resync on reopen (`src/hooks/useSuggestionSocket.ts`).
- Pre-auth message queue on the hub; optimistic card-answer with rollback.

## Deferred (not in this spec)

- **Gap 5 — reconnect backoff/jitter/cap + richer "connection lost" UI.** Current
  fixed 3s reconnect is acceptable for 10 teams. Revisit if backend restarts cause
  reconnect storms.
- **True crash-durable transcript queue** (disk/DB-backed). See component 2 trade-off.
- `?since=` incremental transcript fetch (component 4 optimization).

---

## Components

A shared **per-session liveness** state is added to the hub: facilitator socket
presence (already tracked in the `facilitators` map) plus a `lastAudioAt`
timestamp updated on each inbound binary frame / final result. Components 1 and 3
both read it.

### 1. WebSocket heartbeat (ping/pong)

**Problem:** the hub never pings. Half-open sockets (laptop sleep, NAT/Render idle
timeout) are never detected — stale `Client` entries accumulate in `facilitators`
and `userConnections` (memory leak + broadcasts to dead sockets), and a half-open
client can believe it is still connected while its audio silently drops.

**Approach:**
- Server (`backend/src/realtime/hub.ts`): on `attachHub`, start a `setInterval`
  (~30s). Add `isAlive` to `Client`. Attach `socket.on('pong', () => isAlive = true)`.
  Each tick, per client: if `!isAlive` → `socket.terminate()` + `unsubscribe` +
  `stopSttStream`; else set `isAlive = false` and `socket.ping()`. Clear the
  interval when `wss` closes.
- Client (`src/hooks/useSuggestionSocket.ts`): browsers auto-reply to server ping
  frames (no JS ping API), so server-side ping alone prunes dead clients and keeps
  NAT mappings warm. Optional client watchdog: if no frame received for >45s, force
  `socket.close()` so the existing reconnect path fires.

**Trade-off:** OS-level TCP keepalive would not prune the hub's in-memory maps, so
an app-level ping is required. 30s interval is the conventional default.

**Files:** `backend/src/realtime/hub.ts` (+ optional `src/hooks/useSuggestionSocket.ts`).

### 2. Transcript durability on ingest failure

**Problem:** `hub.ts` `onFinal` calls `streamIngest` (`routes/transcript.ts`). If
the DB write throws, the finalized utterance is **lost** — the only signal is an
`stt:error` to the client, with no retry and no buffer. A transient DB blip drops a
decision from the record.

**Approach:**
- Wrap the ingest DB write in a retry (3 attempts, backoff 200/500/1000ms).
- If all attempts fail, push the row into an in-memory, per-session dead-letter
  buffer and emit `stt:error`. Flush the buffer on the next successful write or on a
  periodic timer.
- Continue to broadcast `transcript:final` only after a successful save (already the
  case) so clients never render a row that isn't persisted.

**Trade-off:** the in-memory buffer is lost if the whole server process crashes.
True crash durability needs a disk- or DB-backed queue — **deferred**: for beta,
DB errors are overwhelmingly transient, and a full crash is both rarer and already
mitigated by the session-recover path.

**Files:** `backend/src/routes/transcript.ts` (`streamIngest`), small retry util.

### 3. Zombie `active` session auto-end

**Problem:** if a facilitator closes the lid without pressing **End**, the session
stays `active` forever: the post-meeting summary never fires and `/api/session/recover`
keeps resurfacing the stale session.

**Approach:**
- Extract the end logic from the `POST /api/session/:id/end` route
  (`backend/src/routes/session.ts:586`) into a shared `endSession(sessionId)`
  function so route and sweeper produce identical effects (status → `ended`,
  `clearProjectDocCache`, summary trigger seam).
- Add a sweeper interval (~60s). For each `active` session where there is no
  connected facilitator socket **and** `now - lastAudioAt > IDLE_LIMIT` (15 min),
  call `endSession`.

**Note:** the end-route summary trigger is currently stubbed (`session.ts:633`).
Auto-end reuses whatever `endSession` does — wiring real summary generation is a
separate (Sprint 2 / STT-quality) concern, not part of this spec.

**Trade-off:** `IDLE_LIMIT` of 15 min is deliberately conservative so a real meeting
on a coffee break is not killed. A server-side sweeper is more robust than a
client-side beacon, which a crash would never send.

**Files:** `backend/src/routes/session.ts` (extract `endSession`), sweeper
(new `backend/src/realtime/` or `backend/src/lib/` module wired in `index.ts`),
`backend/src/realtime/hub.ts` (expose `lastAudioAt` + socket presence).

### 4. Reconnect transcript backfill

**Problem:** on WS reconnect the client resyncs the card stack (`fetchCards`) but
**not** the transcript. Rows finalized during the disconnect window are never
refetched, leaving a silent hole in the visible record.

**Approach:**
- Client tracks the last-seen transcript row id. On reconnect (`connected` → true),
  alongside `fetchCards`, refetch `GET /api/transcript/session/:id` and merge/dedupe
  by row id (reuse the existing loader at `src/pages/Meeting.tsx:388`). A full
  refetch is fine at meeting scale (hundreds of rows).

**Trade-off:** a `?since=<lastSeenId>` incremental fetch is a later optimization.

**Files:** `src/pages/Meeting.tsx` (refetch transcript on reconnect + dedupe).

---

## Testing (TDD — red/green/refactor)

- **Heartbeat:** with fake timers, a client that never pongs is `terminate`d and
  removed from both maps; a ponging client survives.
- **Durability:** mock the ingest DB write to throw N times → assert retry then
  dead-letter buffering, and that a later success flushes the buffer (row saved once,
  no duplicate broadcast).
- **Auto-end:** fake timers; an `active` session with no socket and stale
  `lastAudioAt` triggers `endSession` (status → `ended`); a live/recent session does
  not.
- **Backfill:** simulate reconnect → transcript is refetched and merged without
  duplicate rows.

## Rollout order (suggested for the plan)

1 (heartbeat) → 2 (durability) → 3 (auto-end, depends on the liveness state from 1)
→ 4 (client backfill). Each independently shippable.
