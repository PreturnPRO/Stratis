# 03 — Engineering

Architecture, conventions and the standard of proof. Read before any code
change.

---

## Stack

| Layer | What |
|---|---|
| Frontend | React + Vite (no Next.js) → Vercel |
| Backend | Node (tsx), Express, PostgreSQL on Supabase → Render |
| STT | Google Speech v2 **Chirp 2** (th-TH), streaming PCM over WebSocket, clip-upload fallback, mock when creds absent |
| LLM | **Gemini** via OpenAI-compatible endpoint; `AI_PROVIDER` switchable, mock when key absent |
| Real-time | `ws` hub at `/ws` — cards, interim/final transcript, live notes |

Both mocks are **silent**. A deploy with `STT_PROVIDER` unset looks healthy right
up until the first meeting transcribes `[mock transcript]` — `/api/health`
reports the resolved provider names for exactly this reason.

## Multi-tenancy — the rule that keeps being broken

**Every query that reads or writes meeting content must be scoped by
`org_id`, and no role is ever a substitute for it.**

- **There is one role: `facilitator`.** Every account runs its own meetings.
  Participants are not accounts — they arrive with a code and live in
  `session_guests` (no org, no role, token dies with the session).
  `roleSurface.test.ts` fails the build if `Role` grows a second member, if a
  guard names another role, or if signup starts reading a role from the body.
  A guest's role *inside a meeting* is `SessionRole`, which is a different type
  on purpose.
- **The organisation still scopes every query, and no screen shows it.** One
  container per account, auto-created at signup, never named by anyone. Keeping
  it is what let the workspace disappear from the product without rewriting the
  isolation that protects meetings.
- **The Stratis team is not a role.** `PLATFORM_ADMIN_EMAILS` +
  `requirePlatformAdmin` is the only operator path, it is resolved from the
  database row behind the token, and it reaches usage and beta codes — never a
  meeting. `User.platformAdmin` is the client's copy of that answer and decides
  only what to render.
- **A guest may vote on the record and never write it.** Holding the meeting
  code buys reading the checkpoint and the transcript, one tick or flag per
  decision, and a note attached to a flag. It does not buy an edit: six
  characters are read out loud in a room and forwarded afterwards, so an edit
  path there is a licence for anyone who overheard them to rewrite what the
  meeting decided under the facilitator's name. There is no `PATCH` under
  `/api/room` — the route is deleted rather than guarded, because a route that
  must never succeed should not exist to be reasoned about.
- Owning the workspace is **not** entitlement to read someone else's meeting.
  Transcripts, sessions, documents and summaries are scoped to the facilitator
  who ran them.
- `/api/admin` holds both kinds of route, so **no blanket `.use()` role guard**:
  each route names `requireFacilitator` or `requirePlatformAdmin`, and
  `adminGuards.test.ts` fails the build if one does not.
- Two people entitled to write one project document is how it forks.
- **A route that takes a session id must prove the caller owns it.** Five routes
  in `ai.ts` had `requireAuth` and nothing else, so any account could read
  another workspace's live cards and push cards onto a stranger's screen
  mid-meeting. Use `requireSessionAccess()`; `sessionGuards.test.ts` fails the
  build if a route file reads a session id without one.
- **Global switches are operator switches.** `POST /admin/release` sets a
  force-logout cutoff with no org column — behind `requireRole("admin")` that was
  a product-wide kill switch reachable by anyone who signed up. Anything without
  an `org_id` belongs behind `requirePlatformAdmin`.

## The meeting clock is the session's, not the tab's

Elapsed time is `now − started_at` where `started_at` is a **server** timestamp
and `now` is corrected by the offset in `serverNow` from `/api/session/recover`.
A browser that closed for five minutes missed five minutes of meeting.

**The screen and the biller run the same subtraction.** `entitlements.ts`
counts `COALESCE(ended_at, NOW()) − started_at`; the display counting from page
load instead is what made the timer restart on every refresh and disagree with
the minutes deducted. `meetingClock.test.ts` holds the two together. An
unstarted session shows no elapsed time — never `Date.now()`.

The sweeper's rule is unchanged: an *abandoned* session still ends at the last
moment audio arrived. A facilitator who kept the meeting open is a different
case from one whose laptop closed.

## Every way into a meeting records presence

Joining by code writes `session_guests` **and** `session_participants`, and the
guest's checkpoint poll refreshes `last_seen_at`. It wrote neither for months —
only the invite-link path did — so the facilitator saw nobody and the usage
rollup counted an empty room. `presence.test.ts` fails the build if a join path
skips it. Two minutes without a poll reads as *away*, never as gone.

## Concurrency

Anything that reads a row, computes from it, and writes it back must run in
`db.tx()` with `SELECT … FOR UPDATE` on the row it read.

**A guard that spans an await is not a guard.** `extractAndSaveDecisions` checked
"no decisions yet" and then spent 90 seconds in the model before inserting, so
the wrap-up warm-up and the End button both passed the check and both wrote —
every decision twice, with fresh ids, which also reset the review state. Work
that cannot be made atomic in SQL gets a per-key in-flight map, and callers await
the run already in progress. `db.query` takes a
connection per call, so a read-then-write built from it is **not atomic** — two
requests interleave and both act on the same "before" state. This is what
produced two overlapping PM document versions.

## Silence is not audio, and a recogniser must never be told otherwise

**The browser does not stream audio unless someone is speaking.** Chirp does not
return nothing when it is fed nothing: room tone, a fan and a pause all produce
its best guess at what that could have been — digits, "ครับ", half a sentence —
and each one became a transcript row nobody said, which the AI then reasoned
over and the summary reported.

This cannot be repaired downstream. By the time text exists, the fact that the
room was silent is gone, and no filter can tell an invented "fifteen" from a
real one. `lib/speechGate.ts` holds the decision and `usePcmStream` applies it;
`sttText.isSttNoise` catches only the residue that carries no word at all.

Two rules for anyone tuning it:

- **The floor is a minimum over a window, never an average.** An averaging
  estimator only learns the room while it believes nobody is speaking, so a room
  noisier than its starting guess is heard as speech for ever and it never
  adapts — the exact case (a café, air conditioning) the gate exists for. This
  was written that way first and deadlocked open in every noisy room.
- **The floor is capped** (`MAX_TRACKED_FLOOR`). Someone already mid-sentence
  when Record is pressed fills the window with speech, and an uncapped estimator
  would take that for the room and gate the speaker out.

The server closes an idle recogniser after 8s (`IDLE_CLOSE_MS`) rather than
holding one open with no audio in it, which Google times out itself and reports
as a gRPC error against the next thing anyone says.

## Audio is never dropped on the way to the recogniser

Three places used to throw speech away without a trace. Each now holds it, and
each rule has a pure module and a test.

- **Before the recogniser is open, audio is queued, not dropped**
  (`backend/src/lib/pendingAudio.ts`, `sttStreamCore.ts`). A Google stream opens
  asynchronously, and the 8-second idle close means the first words after every
  pause arrive during an open. The queue holds 10 seconds, releases a short burst
  and then real-time pace — Google requires streaming audio at about real time.
  The idle close never fires over held audio.
- **While the socket is down, the client keeps up to 30 seconds**
  (`src/lib/audioBacklog.ts`) and uploads it as one WAV clip with `capturedAt`
  once the socket is back. It is not written into the live stream. Frames are
  not sent before `stt:start` on the current socket: the hub drops them.
  `clampCapturedAt` believes the client's time only inside the session.
- **LIVE means frames are arriving** (`src/lib/captureHealth.ts`). Five seconds
  without a worklet frame, an ended track or a suspended context starts a
  recovery; the header says so. Recovery never ends a recording — a lost
  microphone shows Try again, and only Stop ends it.

## Ids are keys, not names

**Never render an id.** A project id is `prj_733f4654-9ced-4750-…`, and
title-casing it produced "Prj 733f4654 9ced 4750 A8e2 D773de95c349" as the
heading of a document the facilitator had named "Stratis Review". If a payload
does not carry the name, the fix is to add the name to the payload — every
document route returns `projectName` — not to prettify the key.

## Types the database actually has

`schema.sql` is the source of truth, and TypeScript cannot see it. `due_date` is
**TEXT** — the room says "end of month" and we keep the phrase — so
`due_date <= NOW()` does not return the wrong rows, it fails to *parse*, on zero
rows, and takes the endpoint down for everyone. Compare only with a guarded cast.
`columnTypes.test.ts` reads the declared types and fails the build on date
arithmetic against TEXT.

## Costs and quotas

- Any endpoint reaching the LLM or STT needs auth. An unauthenticated AI route is
  a metered bill anyone can run up.
- Unauthenticated endpoints (login, signup, invite preview, room join) are rate
  limited. In-memory, single-instance scope — if the backend is ever scaled, the
  real limiter moves to the edge.
- `bcrypt` async, never `*Sync`: the same event loop streams meeting audio.
- **Bill for what happened, not for when you noticed.** The idle sweeper ends a
  session at the last moment audio arrived; stamping its own clock charged 16
  minutes of silence against a 30-minute monthly allowance.
- **In-memory liveness is empty after a restart**, so every running meeting looks
  abandoned. The sweeper waits out a grace period before its first pass, or it
  ends live meetings and the client streams into a closed session.

## Gates

A gate that only exists in the browser is not a gate. If a paid feature must be
enforced, **the server produces the artefact** — which is why the summary export
is built server-side behind `requireFeature`, not assembled in the client from
data it already holds. Cosmetic gates (theme) are honestly cosmetic; do not count
them as revenue protection.

## Conventions

- Errors: `{ ok: false, error }`; success `{ ok: true, data }`. `apiFetch`
  unwraps `data` — a mock that adds a wrapper key will crash the page.
- Optional chaining guards the object, not the array it reaches into.
  `a?.b.includes()` still throws. Write `a?.b?.includes()`.
- Modules covered by `node --test` import siblings with an explicit `.ts`
  extension (type stripping does not resolve like a bundler); `tsconfig` sets
  `allowImportingTsExtensions`.
- Schema changes are additive and idempotent (`IF NOT EXISTS`), appended to the
  ALTER block at the bottom of `schema.sql`.
- Comments explain **why**, especially where the obvious-looking code is wrong.
  See `../DECISIONS.md`.

## Verification — the standard

Before claiming anything works:

```bash
npx tsc --noEmit              # frontend
npm run build                 # frontend
npm --prefix backend run typecheck
npm --prefix backend test
```

Then **say plainly what was not run.** Compiling is not working. A backend change
that has never touched Postgres is unverified, and saying so is part of the job.
See `04-environment.md` for how to verify UI without lying to yourself.

## Working style

- Diff stat is the review surface. Surgical edits over rewrites; check
  `git status` before assuming churn.
- Do the whole agreed batch, then summarise short. Do not narrate each step or
  stop for permission mid-way.
- Never commit or push unless asked.
