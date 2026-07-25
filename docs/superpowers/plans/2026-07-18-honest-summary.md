# Honest Persisted Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the post-meeting summary once at session end, and show the session's decisions with UNCONFIRMED stamps on incomplete ones — instead of re-running the AI on every page view and polishing vagueness into prose.

**Architecture:** New `summaryStore` lib generates the AI summary once and writes it to the existing (unused) `participant_summaries` + `summary_blocks` tables. Session end chains it after decision extraction, off the response path. The GET route returns the stored summary (lazy-generating once for old sessions) and joins the `decisions` table live so facilitator checkpoint edits show up. SummaryView renders a structured Decisions section with status badges.

**Tech Stack:** Express + pg (Supabase), existing `structuredCall` AI gateway, React (inline-style system).

## Global Constraints

- No new dependencies; no test runner exists — each task verifies via a live API script against `localhost:3001` (backend `npm run dev` must be running).
- DTOs snake_case (AI JSON + DB); view types camelCase (see `shared/types.ts`).
- Decisions status meanings (spec): `complete` = has due date; `incomplete` = real decision missing one → **UNCONFIRMED** in the summary; `open` = deliberately parked, carries `revisit`.
- The decisions list joins live at read time from the `decisions` table — never snapshot it into the stored summary (facilitator edits after the meeting must show).
- Match surrounding code style; comments only for non-obvious constraints.

---

### Task 1: summaryStore lib — generate once, persist, read back

**Files:**
- Create: `backend/src/lib/summaryStore.ts`
- Reference (read only): `backend/src/routes/summary.ts` (prompt + block mapping live here today), `backend/src/db/schema.sql:256-286` (tables)

**Interfaces:**
- Consumes: `structuredCall(prompt)` from `@ai/index`; `db` from `../db/database`; `newId`, `now` from `./ids`.
- Produces (Task 2 relies on these exact signatures):
  - `interface StoredSummary { id: string; sessionId: string; summaryTitle: string; summarySubtitle: string; participants: string[]; durationMinutes: number; blocks: Array<{ block_type: string; title: string; content: string; visible_to_participants: boolean }>; provider: string | null; createdAt: string; }`
  - `async function getStoredSummary(sessionId: string): Promise<StoredSummary | null>`
  - `async function generateAndSaveSummary(sessionId: string): Promise<StoredSummary | null>` — returns existing stored summary if one already exists (idempotent); null when the session has no transcript or the AI output fails validation (callers treat null as "not available yet", never throw).

- [ ] **Step 1: Move-and-adapt the generation code into the lib**

Create `backend/src/lib/summaryStore.ts`. Lift `transcriptToPrompt`, `blockTypeFromAI`, `aiBlocksToSummaryBlocks`, `fallbackSummaryBlock`, `minutesBetween`, `uniqueParticipants` logic from `backend/src/routes/summary.ts` (copy, don't import — Task 2 deletes them from the route). Store provider in `participant_summaries.summary_subtitle`? No — provider is transient; persist it in a `provider` column? Schema has none. Keep provider out of the DB: store `NULL`-equivalent by returning `provider: null` from `getStoredSummary`, and only `generateAndSaveSummary` returns the live provider string. Persistence:

```ts
export async function generateAndSaveSummary(sessionId: string): Promise<StoredSummary | null> {
  const existing = await getStoredSummary(sessionId);
  if (existing) return existing;

  const meta = await getSessionMeta(sessionId); // meeting_title, started_at, ended_at (single JOIN query)
  if (!meta) return null;
  const transcripts = await getTranscripts(sessionId);
  if (transcripts.length === 0) return null;

  const aiResult = await structuredCall(transcriptToPrompt(meta.meeting_title, transcripts));
  const blocks = aiResult.ok && aiResult.data.blocks.length > 0
    ? aiBlocksToSummaryBlocks(aiResult.data.blocks)
    : [fallbackSummaryBlock(transcripts)];

  const id = newId("sum");
  const ts = now();
  const participants = uniqueParticipants(transcripts);
  const durationMinutes = minutesBetween(meta.started_at, meta.ended_at);
  await db.query(
    `INSERT INTO participant_summaries (id, session_id, summary_title, summary_subtitle, participants_json, duration_minutes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, sessionId, `Summary: ${meta.meeting_title}`,
     `${durationMinutes} min · ${participants.length} participant${participants.length === 1 ? "" : "s"}`,
     JSON.stringify(participants), durationMinutes, ts],
  );
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    await db.query(
      `INSERT INTO summary_blocks (id, summary_id, block_type, title, content, visible_to_participants, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId("blk"), id, b.block_type, b.title, b.content, b.visible_to_participants, i],
    );
  }
  const stored = await getStoredSummary(sessionId);
  return stored ? { ...stored, provider: aiResult.ok ? aiResult.provider : "fallback" } : null;
}
```

`getStoredSummary` reads `participant_summaries` by session_id + its `summary_blocks` ordered by `sort_order`, maps to `StoredSummary` with `provider: null`.

Note: `structuredCall` failure does NOT abort — a fallback block is stored. An empty transcript DOES abort (null) so ending an unused session stores nothing.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit` (ignore the two pre-existing `stt.ts` errors)
Expected: no new errors.

- [ ] **Step 3: Verify with a live script**

Script (scratchpad, node): signup → meeting → session → 3 transcript chunks via `POST /api/transcript/chunk` → import nothing; instead call the lib through Task 2's endpoint — **not yet possible**, so for THIS task verify via `npx tsx` one-liner from `backend/`:

```ts
// backend/_tmp_sumstore_test.ts
import { generateAndSaveSummary, getStoredSummary } from "./src/lib/summaryStore";
const sessionId = process.argv[2];
console.log("generated:", JSON.stringify(await generateAndSaveSummary(sessionId), null, 2)?.slice(0, 600));
console.log("second call is idempotent:", (await generateAndSaveSummary(sessionId))?.id === (await getStoredSummary(sessionId))?.id);
process.exit(0);
```

Run with a sessionId that has transcript rows (create via the existing scratchpad setup script). Expected: blocks stored, second call returns same id (no second AI call — verify by absence of a second delay). Delete `_tmp_sumstore_test.ts` after.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/summaryStore.ts
git commit -m "feat(summary): summaryStore lib — generate once, persist, read back"
```

---

### Task 2: wire session end + rewrite GET route

**Files:**
- Modify: `backend/src/routes/session.ts` (endSession, ~line 150)
- Modify: `backend/src/routes/summary.ts` (GET /:sessionId — gut the per-GET AI call)

**Interfaces:**
- Consumes: `generateAndSaveSummary`, `getStoredSummary` (Task 1); `getDecisions`, `completenessFromRecords` from `../lib/decisions`.
- Produces: `GET /api/summary/:sessionId` response shape (Task 3 relies on it):

```jsonc
{ "ok": true, "data": {
    "summary": { /* ParticipantSummaryOutput — same shape as before */ },
    "decisions": [ /* DecisionRecord[] (camelCase) */ ],
    "metric": { "committed": 2, "withDueDate": 1, "open": 1, "total": 3, "completenessRate": 50 },
    "provider": "stored",
    "transcriptCount": 12
} }
```

- [ ] **Step 1: Chain summary persist at session end**

In `endSession` (session.ts), replace the existing fire-and-forget extraction line with a sequential chain — decisions first, then summary, both off the response path:

```ts
void extractAndSaveDecisions(session.id)
  .catch((err) => console.error(`[session:end] decision extraction failed for ${session.id}:`, err))
  .then(() => generateAndSaveSummary(session.id))
  .then((s) => { if (s) console.log(`[session:end] summary stored for ${session.id}`); })
  .catch((err) => console.error(`[session:end] summary persist failed for ${session.id}:`, err));
```

- [ ] **Step 2: Rewrite GET /api/summary/:sessionId**

Keep: `getSessionForSummary` access check, 404 branch. Replace the transcript-fetch + `structuredCall` body with:

```ts
let stored = await getStoredSummary(sessionId);
if (!stored) {
  // Sessions ended before persistence existed (or whose end-hook failed):
  // generate once now, store, serve stored from then on.
  stored = await generateAndSaveSummary(sessionId);
}
if (!stored) {
  return res.status(409).json({ ok: false, error: "No transcript rows found for this session" });
}

const decisions = await getDecisions(sessionId);
const summary: ParticipantSummaryOutput = {
  output_type: "participant_summary_output",
  session_id: sessionId,
  summary_title: stored.summaryTitle,
  summary_subtitle: stored.summarySubtitle,
  participants: stored.participants,
  duration_minutes: stored.durationMinutes,
  summary_blocks: stored.blocks as SummaryBlock[],
  action_items: [],
};
res.json({
  ok: true,
  data: {
    summary,
    decisions,
    metric: completenessFromRecords(decisions),
    provider: stored.provider ?? "stored",
    transcriptCount: stored.blocks.length, // transcript rows no longer fetched; field kept for UI compat
  },
});
```

Delete the now-unused local helpers the route no longer calls (`transcriptToPrompt`, `aiBlocksToSummaryBlocks`, `blockTypeFromAI`, `fallbackSummaryBlock`, `getTranscripts`, `minutesBetween`, `uniqueParticipants`) and the `structuredCall` import.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit` — expected: only pre-existing stt.ts errors.

- [ ] **Step 4: Verify end-to-end with a live script**

Scratchpad node script: signup → meeting → session → feed the standard 3-line Thai transcript (one dated decision, one undated, one parked — reuse lines from `checkpoint-ui-setup.mjs`) → `POST /api/session/:id/end` → poll `GET /api/summary/:sessionId` every 3s until 200 (end-hook runs extraction + summary in background; first poll may 409 briefly only if hook hasn't stored yet — acceptable) → assert: `data.decisions.length === 3`, `data.metric.completenessRate === 50`, second GET returns instantly (stored — measure <500ms, no AI delay), `summary.summary_blocks.length >= 1`.
Expected output: printed decisions with one `incomplete`, metric 50, second-GET latency under 500ms.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/session.ts backend/src/routes/summary.ts
git commit -m "feat(summary): persist at session end, serve stored + decisions from GET"
```

---

### Task 3: SummaryView — decisions section with UNCONFIRMED stamps

**Files:**
- Modify: `src/pages/SummaryView.tsx` (fetch handler ~line 316-339; render section after the stat chips ~line 431)

**Interfaces:**
- Consumes: Task 2's GET response (`data.decisions: DecisionRecord[]`, `data.metric.completenessRate`).
- Produces: user-visible decisions section; no exports.

- [ ] **Step 1: Capture decisions + metric in state**

```tsx
import type { DecisionRecord } from "../../shared/types";
// in component state:
const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
const [completenessRate, setCompletenessRate] = useState<number | null>(null);
// in the fetch success branch (after setSummary):
setDecisions(data.data.decisions ?? []);
setCompletenessRate(data.data.metric?.completenessRate ?? null);
```

- [ ] **Step 2: Render the decisions section**

Insert a section titled "Decisions" ABOVE the AI prose blocks, rendered only when `decisions.length > 0`. Hide the AI's own DECISIONS prose block when the structured list exists (`visibleBlocks.filter(b => decisions.length === 0 || b.block_type !== "DECISIONS")`) — the structured list is the verified record; the prose paraphrase is exactly what this feature exists to replace. Per decision row (match the app's card style — `COLORS.surfaceMuted` background, `RADIUS.md`, `FONT.size.body` text):

- `complete` → green `Check` icon, text, `Due: {dueDate}`, owner when present
- `incomplete` → orange badge **UNCONFIRMED** + `missing` reason ("ยังไม่ยืนยัน — no deadline"); border `1px solid ${COLORS.orange}55`
- `open` → cyan badge **OPEN** + `Revisit: {revisit}`

Header row shows `completenessRate` when non-null: `{rate}% of decisions left with a date`.

```tsx
{decisions.length > 0 && (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: FONT.size.heading, color: COLORS.textPrimary }}>Decisions</h2>
      {completenessRate != null && (
        <span style={{ fontSize: FONT.size.label, color: completenessRate === 100 ? COLORS.green : COLORS.orange }}>
          {completenessRate}% left with a date
        </span>
      )}
    </div>
    {decisions.map((d) => (
      <div key={d.id} style={{ background: COLORS.surfaceMuted, border: `1px solid ${d.status === "incomplete" ? `${COLORS.orange}55` : COLORS.border}`, borderRadius: RADIUS.md, padding: "12px 16px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {d.status === "incomplete" && <span style={{ fontSize: FONT.size.micro, fontWeight: 700, color: COLORS.orange, letterSpacing: 0.6 }}>UNCONFIRMED</span>}
          {d.status === "open" && <span style={{ fontSize: FONT.size.micro, fontWeight: 700, color: COLORS.cyan, letterSpacing: 0.6 }}>OPEN</span>}
          {d.owner && <span style={{ fontSize: FONT.size.micro, color: COLORS.textDim }}>{d.owner}</span>}
        </div>
        <p style={{ margin: 0, fontSize: FONT.size.body, color: COLORS.textPrimary, lineHeight: 1.5 }}>{d.text}</p>
        <span style={{ fontSize: FONT.size.label, color: COLORS.textMuted }}>
          {d.dueDate ? `Due: ${d.dueDate}` : d.status === "open" ? (d.revisit ? `Revisit: ${d.revisit}` : "") : (d.missing ?? "No deadline")}
        </span>
      </div>
    ))}
  </div>
)}
```

(Adapt imports to what SummaryView already uses — it may import COLORS/FONT/RADIUS from `../constants`; follow the file's existing pattern. If it imports icons from lucide-react, `Check` optional — the badges carry the status without it.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` from repo root — expected clean.

- [ ] **Step 4: Verify in browser**

With backend+frontend dev servers running: reuse Task 2's script output (auth + sessionId), set localStorage (`stratis.auth.v1`, and navigate to `#/summary?sessionId=<id>` — check `src/App.tsx` `hashToEntry` for the exact param name first; Meeting.tsx's end-flow navigates with `onNav("document", { sessionId })`, SummaryView's own route id is in App.tsx). Confirm: Decisions section renders 3 rows — one plain with `Due:`, one **UNCONFIRMED** orange, one **OPEN** cyan with revisit; AI DECISIONS prose block absent; completeness % shown. Reload page — loads instantly (stored, no AI wait). Screenshot or DOM-dump as proof.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SummaryView.tsx
git commit -m "feat(summary): decisions section with UNCONFIRMED stamps in summary view"
```

---

## Self-review notes

- Spec coverage: "persist at session end" (Task 2 step 1), "stamp incomplete UNCONFIRMED" (Task 3), "stop per-GET reruns" (Task 2 step 2 + lazy backfill). Metric surfaced in summary too (bonus, spec-aligned).
- Type consistency: `StoredSummary` produced in Task 1, consumed by name in Task 2; `DecisionRecord` from shared/types used in Tasks 2-3; `completenessFromRecords` matches lib signature from the committed decisions backbone.
- Deliberate exclusions (YAGNI, spec's out-of-scope list): participant delivery/notifications, action_items population, 5-min SLA, provider column in DB.
