# Decisions

Non-obvious choices in the codebase, and the reasoning that is expensive to
re-derive. The code itself carries only short pointers; the argument lives here.

Written 2026-07-26.

---

## 1. A 429 and a 5xx need opposite fixes

`ai-service/src/providers/gemini.ts`

Google's endpoint fails two different ways and they look similar in a log:

| Failure | Meaning | Fix |
|---|---|---|
| 500 / 502 / 503 / 504 | the requested model is overloaded | retry on a **lighter** model (`GEMINI_MODEL_FALLBACK`) |
| 429 | the project's quota is spent (free tier: 15/min, 500/day) | honour `Retry-After`, back off, retry the **same** model |

The fallback model shares the same `GEMINI_API_KEY` and project quota, so
switching models **cannot** cure a 429 — it just spends another request against
an already-exhausted budget. That is why 429 is deliberately absent from
`RETRYABLE_STATUSES`. Adding it there would look like a fix and make things
worse.

## 2. Request pacing happens at two levels, for two reasons

- `AI_MIN_CALL_INTERVAL_MS` (`backend/src/routes/transcript.ts`) paces **one
  session's** live-card loop. Rows arriving inside the gap coalesce; nothing is
  lost because each call re-reads the recent transcript window from the DB.
- `GEMINI_MIN_REQUEST_INTERVAL_MS` (`rateLimit.ts` `createPacer`) paces **every
  Gemini request in the process**. The per-session gate cannot stop N concurrent
  meetings, nor the meeting-end doc-patch and decision-extract calls, which
  bypass it entirely.

The pacer is a serialised promise chain. It is safe only because the sole `await`
inside the gate is a bounded sleep — the network fetch and any 429 backoff sit
**outside** the chain, and rejections are swallowed. Awaiting a fetch inside the
gate would let one slow request block every session's AI calls.

## 3. Model output is recovered, not trusted

`ai-service/src/schema.ts` — `extractJsonObject`

Models wrap valid JSON in prose ("Here are the decisions: {...}") or fences.
`JSON.parse` then throws on the whole response and callers drop the result, so a
single stray sentence could make the alignment checkpoint show **zero
decisions** — on a heavy, un-retried ~90s call.

The scanner finds the outermost balanced `{...}` and is string-literal aware, so
a brace inside decision text or markdown cannot unbalance it. It must never be
allowed to weaken validation: the recovered substring still passes through the
same strict field checks as before.

## 4. Thai needs character n-grams, not word tokens

`backend/src/lib/textSimilarity.ts`

Thai has no spaces between words, so a whitespace tokenizer returns **zero**
tokens for a Thai string — meaning the near-duplicate defence silently did
nothing in the product's primary market while appearing to work. Thai runs
therefore become overlapping character trigrams (the standard primitive for
unsegmented scripts), namespaced `th:` so they can never collide with a Latin
token. Mixed Thai+English sentences legitimately produce both kinds.

## 5. STT language is a per-meeting choice

`backend/src/lib/sttLanguage.ts`, `STT_LANGUAGES`

Multiple BCP-47 codes are what enable Chirp 2's code-switching. `STT_LANGUAGES`
was `th-TH` **alone**, so English speech was forced through a Thai-only
recogniser and came back with Thai words spliced into English sentences —
garbage that then poisoned the rolling memory and the summary.

`langCodesFor("en")` deliberately excludes `th-TH`. A single-language list is the
fix, not an oversight.

## 6. A scheduled meeting must not start a session

`src/hooks/useCreateMeeting.ts`, `meetings.scheduled_at`

`scheduled_at IS NULL` means "started immediately" — the original behaviour. When
it is set, the meeting is created but **no session starts**: doing so would begin
recording an empty room. It waits on the Docket until someone presses Start.

## 7. The Docket is not a calendar

`src/pages/Docket.tsx`

A month grid answers *"when am I busy?"* — a question every team already has
Google Calendar for, and which Stratis would only ever answer worse; looking like
a calendar invites exactly that comparison. The Docket answers the question only
Stratis can: *"what needs deciding next, and when will we decide it?"*

So the unit is a **decision**, not a time block: the goal leads each card, time is
reduced to a stamp, cards show the threads they inherit from earlier meetings on
the project, and "Awaiting a date" turns unresolved checkpoint items into future
meetings. Busy-time stays with the real calendar via a per-meeting `.ics` link —
coexist, don't compete.

## 8. Live suggestion cards are persisted

`backend/src/realtime/suggestions.ts`, `live_cards` table

The stack used to live only in process memory, so a restart or deploy mid-meeting
silently erased every open card — the facilitator's pending questions vanished
with no message, which reads as "the AI gave up". Writes are now write-through
and fire-and-forget (a DB blip must never stall a live meeting); `hydrate()`
restores a session when the process has no memory of it.

## 9. The workbench does not animate

`src/index.css`, `src/components/ui.tsx`

Landing may be theatrical. Dashboard / Meeting / Document are work surfaces:
native cursor, stationary targets, no decorative motion. Specifically removed and
not to be reintroduced —

- **custom cursor**: erased the whole cursor vocabulary (I-beam, `not-allowed`),
  and its magnet effect moved click targets as the pointer approached
- **press-scale on buttons**: squished the control being aimed at
- **per-letter hover roll**: duplicated every character in the DOM with no
  `aria-hidden`, so button accessible names read as `"GGeett ssttaarrtteedd"`
- **fake signals**: a `Math.random()` "LATENCY" readout and hardcoded nav badges
  that never cleared

Animation that encodes real state (REC pulse, live caret, thinking dots) stays.

## 10. Tests are in CI on purpose

`.github/workflows/ci.yml`

The suite covers logic no reviewer can eyeball — JSON recovery from prose, Thai
and English near-duplicate matching, `Retry-After` parsing, backoff caps. Break
one and nothing crashes; the transcript just quietly gets worse. The suite
previously existed but CI never ran it, so it only protected whoever remembered
`npm test`. It is now a required step.
