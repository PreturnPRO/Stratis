# Audio that survives the meeting

Design, 2026-09-11. Approved in conversation before writing (A1–A4).

Facilitators reported four things from real meetings: people on the online call
are missing, words are cut or dropped, the text is wrong or invented, and the
recording stops. Reading the capture and streaming path found three causes in
code, one limit of the browser, and one open configuration question. This
design fixes the three code causes in the path the website uses today and
records the rest so the next report starts from here.

Work lands directly on `main` (the owner's choice). `main` deploys to Vercel
and Render, so nothing is committed or pushed without an explicit go-ahead.

---

## 1. What is wrong, and where

| Report | Cause | Where |
|---|---|---|
| Words cut, wrong words | Audio written while a Google stream is opening is discarded | `backend/src/lib/sttStream.ts`, `write()` |
| Words dropped | Frames captured while the socket reconnects are discarded | `src/hooks/useSuggestionSocket.ts` `sendAudioFrame`, `src/pages/Meeting.tsx` `onFrame` |
| Recording stops | A microphone that ends is never noticed | `src/hooks/usePcmStream.ts` |
| Online voices missing | Only the microphone is captured | `usePcmStream.ts` `getUserMedia` — **out of scope**, the desktop app owns computer audio |
| Wrong Thai text | Open question, see §6 | `STT_LOCATION` |

---

## 2. A1 — Audio is held while the recogniser opens

**The mechanism.** `write()` calls `ensureStream()`, which starts an
asynchronous open and returns. The next line, `stream?.write({ audio })`, finds
no stream, and the chunk is gone.

That window is not rare. The server closes an idle stream after 8 seconds
(`IDLE_CLOSE_MS`), so in any meeting where someone pauses longer than that, the
next sentence arrives at a closed stream. Its pre-roll — the frames the client
holds back precisely so the first consonant survives (`PRE_ROLL_FRAMES`) — is
flushed in one burst and lost inside the open window together with the onset.
The same window opens on the 240-second rotation and after every error. This is
why "ตกลง" can still arrive as "กลง" although the client was fixed for exactly
that.

**The change.**

- A pending-audio queue in a pure module, `backend/src/lib/pendingAudio.ts`,
  beside `sttStreamPolicy.ts` and in the same style: `push(chunk)`, `drain()`,
  capped by bytes at 10 seconds of audio for the stream's sample rate
  (`sampleRate × 2 bytes × 10`). Full means the oldest chunk is dropped and the
  dropped duration is counted.
- `write()` pushes to the queue whenever `stream` is null. When the open
  resolves, the queue drains into the new stream **before** any newer chunk.
- An open that fails keeps the queue (still capped) for the next attempt the
  backoff allows. `stop()` clears it.
- An overflow logs once per episode with the duration dropped.

**The 8-second idle close stays.** Holding a stream open through silence is the
thing it exists to prevent: Google times the stream out itself and reports a
gRPC error against the next thing anyone says.

One cost of that choice is measured before beta scale rather than assumed:
Google allows 300 concurrent StreamingRecognize sessions per region per
5-minute window, and every reopen after a pause is a new session. The Render
logs (`Closing idle stream`) show how many sessions a real meeting opens; if
that number times the expected concurrent meetings approaches the quota, the
idle close is revisited with that evidence.

**Bursts.** Google requires streaming audio at approximately real time, at most
25 KB per request. Drained chunks are split to 25 KB or less. A backlog under
2 seconds — the normal case, one open — is written at once; that is the size of
burst the pre-roll already sends today. A longer backlog is written at
real-time pace and catches up during the silences the gate already produces.
The first plan task tried to measure Google's reaction with the real key and
could not: with the local configuration (`us-central1`, `th-TH,en-US`) every
streaming session is rejected before any audio, `INVALID_ARGUMENT` on
`language_codes`. The owner kept the existing settings (2026-09-11), so the
2-second allowance ships unmeasured.

**Tests.** `pendingAudio.test.ts`: order kept, cap drops oldest and counts it,
drain empties, byte cap per sample rate, split at 25 KB. And the defect itself:
`createGoogleStream` takes an injectable opener, and a test whose opener
resolves *after* three writes asserts the stream receives all three in order.
That test fails on today's code.

---

## 3. A2 — Audio survives a dropped connection

**The mechanism.** `sendAudioFrame` returns `false` when the socket is not open,
and `Meeting.tsx` ignores the return value. A reconnect waits 3 seconds plus the
handshake. Everything said in that window is gone, and nothing on screen says so.

**The change.**

- `src/lib/audioBacklog.ts`, pure: a ring of `{ frame, capturedAt }` capped at
  30 seconds of audio, with `push`, `takeAll()` and `droppedMs`.
- `Meeting.tsx` pushes a frame to the backlog whenever `sendAudioFrame` returns
  `false`.
- On reconnect the existing effect re-sends `stt:start` and live frames stream
  again at once. **The backlog is not written into the live stream**: a
  30-second burst breaks the real-time requirement and would hold live speech
  behind it.
- The backlog is encoded client-side as one WAV (16-bit mono) and posted to the
  existing `POST /api/transcript/audio-chunk`, which already decodes through
  `autoDecodingConfig`, with a new optional `capturedAt` — the time of its
  first frame.
- Server: `capturedAt` is accepted only if it parses, is not before the
  session's `started_at` and not after now; otherwise the server's own clock is
  used. `saveTranscriptChunk` takes an optional timestamp. The transcript read
  already orders by `timestamp`, so the recovered line lands where it was said,
  and the meeting screen inserts it by timestamp instead of appending.
- The plan confirms the clip route applies the same `cleanSttText`,
  `isSttNoise` and echo filters as the stream ingest, and adds them if it does
  not.
- A post that fails is retried with backoff. A session that ended meanwhile
  (`409`) drops the backlog and says so.
- Frames in the backlog already passed the speech gate, so silence is never
  posted and nothing is billed that streaming would not have billed.

**When more than 30 seconds is lost**, the oldest audio goes and the meeting
header says how much could not be kept, for example *"Connection lost for 45s —
15s of it could not be kept."* Thai for every new string ships in the same
change, per `docs/i18n-thai-style.md`.

**Tests.** `audioBacklog.test.ts` (cap, order, first `capturedAt`, dropped
duration), `wav.test.ts` (RIFF sizes, sample rate, byte order), and a pure
`clampCapturedAt` on the server.

---

## 4. A3 — A microphone that stops is noticed

**The mechanism.** `usePcmStream` never listens for the track ending, for a
device change, or for the `AudioContext` leaving `running`. A Bluetooth headset
switching profile, a USB microphone unplugged, Windows changing the default
device, a laptop sleeping — capture ends, `status` stays `"streaming"`, and the
header keeps saying LIVE.

**The change.**

- `src/lib/captureHealth.ts`, a pure state machine: `live → recovering → lost`,
  fed by track-ended, context state, and the time of the last worklet frame.
  No frame for 5 seconds while `live` means `recovering`. The watchdog exists
  for the cases where a track stops delivering without reporting that it ended.
- `usePcmStream` listens to `track.onended`, `navigator.mediaDevices`
  `devicechange` and `ctx.onstatechange`. Recovering tries `ctx.resume()` first
  when the context is only suspended, then tears down and reopens the default
  microphone with backoff (1s, 2s, 4s, up to 5 attempts), re-sending `stt:start`
  if the sample rate changed.
- Header: `recovering` shows *"Microphone disconnected — reconnecting"*; `lost`
  shows *"Not recording — microphone unavailable"* with Retry. LIVE is shown
  **only** in `live`.
- Recovery never sets `RecordingContext.recording` to false by itself. Nothing
  ends a recording except the person who started it (`02-ux-ui.md`); a lost
  microphone is shown as lost and stays one press of Retry away.

**Tests.** `captureHealth.test.ts`: every transition, the watchdog, the backoff
schedule, resume before reopen.

---

## 5. A4 — The gate is not retuned without evidence

`speechGate.ts` constants stay. After A1–A3 ship, dropped-word reports are
checked against real meetings first. Every constant there carries its reason in
`03-engineering.md`, and retuning blind is how the averaging deadlock shipped
once.

---

## 6. Open question — Thai on Chirp 2 (not changed here)

The model stays `chirp_2` (the owner's decision). Google's language table lists
`th-TH` for `chirp_2` in `asia-southeast1` and `europe-west4`, and the Chirp 2
page's StreamingRecognize language list does not include Thai. The local `.env`
sets `STT_LOCATION=us-central1`; the Render value is unconfirmed. Recorded so
the next accuracy complaint starts here.

Measured 2026-09-11 with that local configuration: Google rejects every
streaming session with `INVALID_ARGUMENT` on `language_codes` — *"Multiple
language recognition is only available in the following locations: eu, global,
us."* If Render runs the same two values, live streaming cannot start in
production, and its logs show `[stt:stream] gRPC error (code 3`. The owner's
decision is to keep the existing settings; this plan changes none of them.

---

## 7. Verification

Run: `npx tsc --noEmit`, `npm run build`, `npm --prefix backend run typecheck`,
`npm --prefix backend test`. New test files are added by name to the `test`
script in `backend/package.json` — it lists files, it does not glob.

**Not verifiable here** without a microphone, Google credentials and a deployed
backend: a real reconnect mid-sentence, a real device unplug, and Google's
response to a drained burst. These stay marked unverified until run by hand
with the owner.

## 8. Out of scope

Computer audio and online participants (desktop app). Gate retuning (A4). Model
or region changes (§6). The room and guest screens.

## 9. Library updates once shipped

`03-engineering.md`: audio written before the recogniser is open is queued,
never dropped; a socket that is down keeps up to 30 seconds of audio; LIVE is
shown only while frames arrive. A dated entry in `05-corrections.md`.
