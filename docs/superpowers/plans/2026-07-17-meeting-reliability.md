# Meeting Reliability Implementation Plan

**Goal:** Ship the 4-gap meeting-reliability spec (WS heartbeat, transcript durability, zombie auto-end, reconnect backfill) on branch `extreme`.

**Architecture:** Extract pure logic (`withRetry`, `isSessionStale`, `mergeTranscripts`) as standalone units tested with Node's built-in `node:test` (zero new deps). Wire the side-effectful parts (hub ping loop, session sweeper, streamIngest buffer, Meeting.tsx refetch) into existing modules and verify at runtime + `tsc --noEmit`.

**Tech Stack:** Node 22 (tsx), Express, `ws`, PostgreSQL (`pg`), React 18 (Vite), `node:test` + `node:assert`.

## Global Constraints
- Backend ESM, `type: module`, Node >= 22.5. Run tests: `node --import tsx --test <file>`.
- No new runtime dependencies. Test runner = built-in `node:test`.
- Local-only docs (`/docs/` gitignored). Commits go on `extreme`.
- Follow existing style: `ok/data/error` response envelope, `console.*` logging with `[scope]` tags.

---

## File map
- Create `backend/src/lib/withRetry.ts` (+ `.test.ts`) — generic async retry/backoff.
- Modify `backend/src/routes/transcript.ts` — durable `streamIngest` (retry + dead-letter buffer + flush).
- Modify `backend/src/realtime/hub.ts` — heartbeat ping/pong + `isAlive`; expose per-session liveness (`facilitatorCount`, `lastAudioAt`) + bump `lastAudioAt` on binary frame.
- Create `backend/src/realtime/liveness.ts` (+ `.test.ts`) — pure `isSessionStale()` predicate + liveness registry.
- Modify `backend/src/routes/session.ts` — extract `endSession(sessionId)` shared by end-route + sweeper.
- Create `backend/src/realtime/sessionSweeper.ts` — interval that ends idle sessions; wire in `backend/src/index.ts`.
- Create `src/lib/mergeTranscripts.ts` (+ `.test.ts`) — dedupe/merge transcript rows by id.
- Modify `src/pages/Meeting.tsx` — refetch + merge transcript on reconnect.

---

## Task 1: Transcript durability
**Files:** Create `backend/src/lib/withRetry.ts`, `backend/src/lib/withRetry.test.ts`; Modify `backend/src/routes/transcript.ts` (`streamIngest` ~301, `saveTranscriptChunk` ~46).

**Produces:** `withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseMs?: number }): Promise<T>` — resolves on first success, waits `baseMs * 2^attempt` between tries, rejects with the last error after `retries` exhausted.

- [ ] Failing test: succeeds first try (1 call); succeeds on 3rd try (3 calls); throws after retries with last error.
- [ ] Run `node --import tsx --test backend/src/lib/withRetry.test.ts` → FAIL (module missing).
- [ ] Implement `withRetry`.
- [ ] Run test → PASS.
- [ ] Wire into `streamIngest`: wrap `saveTranscriptChunk` in `withRetry`; on final failure push row input to in-memory `deadLetter` Map<sessionId, input[]>, log `[stt:ingest] buffered`, return null; flush buffered rows before the next save attempt for that session.
- [ ] `cd backend && npm run typecheck` → clean.
- [ ] Commit.

## Task 2: WS heartbeat
**Files:** Modify `backend/src/realtime/hub.ts`.

- [ ] Add `isAlive: boolean` to `Client`; init true in connection handler.
- [ ] `socket.on("pong", () => { client.isAlive = true; })`.
- [ ] In `attachHub`, `setInterval` (30s): for each client across `facilitators`, if `!isAlive` → `socket.terminate()` (close/error handlers unsubscribe); else `isAlive=false` + `socket.ping()`. Store interval; `wss.on("close", () => clearInterval(...))`.
- [ ] Bump `liveness.markAudio(sessionId)` in `handleMessage` binary branch (Task 3 dependency).
- [ ] `npm run typecheck` → clean. Runtime verify: start backend, connect a ws, observe `ping` + a forced-dead client terminated.
- [ ] Commit.

## Task 3: Zombie session auto-end
**Files:** Create `backend/src/realtime/liveness.ts` (+ `.test.ts`), `backend/src/realtime/sessionSweeper.ts`; Modify `backend/src/routes/session.ts`, `backend/src/index.ts`, `backend/src/realtime/hub.ts`.

**Produces:**
- `isSessionStale(input: { facilitatorCount: number; lastAudioAt: number | null; now: number; idleLimitMs: number }): boolean` — true when `facilitatorCount === 0` AND (`lastAudioAt === null` ? session created-but-silent handled by caller : `now - lastAudioAt > idleLimitMs`).
- liveness registry: `markAudio(sessionId)`, `lastAudioAt(sessionId)`, `facilitatorCount(sessionId)` (delegates to hub), `activeSessionIds()`.
- `endSession(sessionId: string): Promise<SessionRow | undefined>` in `session.ts` — the extracted end logic (status→ended, timestamps, `clearProjectDocCache`, summary-trigger seam).

- [ ] Failing test for `isSessionStale` (stale when no socket + old audio; not stale with socket; not stale when recent audio).
- [ ] Run test → FAIL.
- [ ] Implement `liveness.ts`.
- [ ] Run test → PASS.
- [ ] Extract `endSession()` from `session.ts` end-route; route calls it.
- [ ] Create `sessionSweeper.ts`: `setInterval` (60s) → for each `active` session id (DB query) compute `isSessionStale` from liveness + `IDLE_LIMIT_MS=900_000`; if stale, `endSession`. Export `startSessionSweeper()`/`stopSessionSweeper()`.
- [ ] Wire `startSessionSweeper()` in `index.ts` after `attachHub`.
- [ ] `npm run typecheck` → clean.
- [ ] Commit.

## Task 4: Reconnect transcript backfill
**Files:** Create `src/lib/mergeTranscripts.ts` (+ `.test.ts`); Modify `src/pages/Meeting.tsx` (transcript loader ~388, connected effect ~338).

**Produces:** `mergeTranscripts(existing: T[], incoming: T[]): T[]` where `T = { id: string; timestamp: string }` — union deduped by id, sorted by timestamp asc.

- [ ] Failing test: disjoint merge sorted; overlapping ids deduped (no dupes); stable order.
- [ ] Run `node --import tsx --test src/lib/mergeTranscripts.test.ts` → FAIL.
- [ ] Implement `mergeTranscripts`.
- [ ] Run test → PASS.
- [ ] In `Meeting.tsx`, on `connected` transitioning true (reconnect), refetch `GET /api/transcript/session/:id` and `setTranscripts(prev => mergeTranscripts(prev, rows))`.
- [ ] Frontend `npm run build` (tsc+vite) → clean. Runtime verify: drop + restore socket, transcript intact.
- [ ] Commit.

## Self-review
- Spec gaps 1–4 each mapped to a task; gap 5 + crash-durable queue deferred per spec. ✓
- No placeholders; signatures consistent across tasks (`endSession`, `isSessionStale`, `markAudio`). ✓
