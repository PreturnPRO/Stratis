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
`org_id`, and `role === "admin"` is never a substitute for it.**

- "admin" is a role *inside one workspace*. Signup lets an account choose it, so
  an unscoped admin check is an open door for anyone who can register.
- An admin administers the workspace — accounts, plan, settings. That is **not**
  entitlement to read someone else's meeting. Transcripts, sessions, documents
  and summaries are scoped to the facilitator who ran them.
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
