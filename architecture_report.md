
# Stratis Architecture Report

Date: 2026-07-18

Scope: reverse-engineer the application architecture and recommend an AI model architecture for Stratis, an AI meeting facilitator.

Security note: sensitive files were intentionally skipped. I did not open `.env`, `.env.*`, `STT-service.key.json`, private key files, service account JSON files, certificates, `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `coverage/`, or logs.

## Executive Summary

Stratis is a React/Vite frontend with a Node/Express backend, PostgreSQL persistence, JWT auth, a WebSocket hub, Google Speech v2 STT, and a small AI provider abstraction in `ai-service/`.

The implemented AI architecture is a set of structured gateways, not a single agent:

1. Live meeting gateway: classifies transcript chunks, updates rolling memory, and emits facilitator-only cards.
2. Legacy structured block gateway: returns generic renderable blocks and is still used by `/api/ai/structure` and the summary route.
3. Document patch gateway: proposes section-based PM document patches after a meeting.
4. Participant summary gateway: implemented as a wrapper around generic blocks, not a dedicated formal summary schema yet.

The best production architecture for this codebase is multi-model routing: a fast model for live transcript/card work, a stronger model for post-meeting summary/document/memory reconciliation, STT as a separate service, and structured state persisted during the meeting.

## Part 1 - High Level Architecture

### Frontend

Stack: React 18, TypeScript, Vite, JWT-backed auth context, fetch-based REST, WebSocket live sync, streaming PCM microphone capture, and MediaRecorder fallback audio chunks.

Important frontend files:

| File | Purpose |
|---|---|
| `src/App.tsx` | Top-level route/navigation shell. |
| `src/lib/api.ts` | Resolves `API_BASE` and `WS_BASE` from Vite env. |
| `src/context/AuthContext.tsx` | Auth state and token handling. |
| `src/pages/Meeting.tsx` | Live meeting workspace, recording controls, transcript UI, suggestion stack. |
| `src/hooks/useSuggestionSocket.ts` | WebSocket connection, live cards, STT interim/final events, reconnects. |
| `src/hooks/useMediaRecorder.ts` | Browser audio clip capture fallback. |
| `src/hooks/usePcmStream.ts` | Streaming PCM capture for WebSocket STT. |
| `src/hooks/useAiBlocks.ts` | Legacy `/api/ai/structure` client hook. |
| `src/pages/DocumentView.tsx` | Generates, reviews, edits, commits PM document patches. |
| `src/pages/SummaryView.tsx` | Loads generated participant summary. |
| `src/components/SuggestionCardStack.tsx` | Renders facilitator-only live cards. |

### Backend

Stack: Node.js, Express, TypeScript, PostgreSQL through `pg`, JWT auth, `ws` WebSocket hub, Google Speech v2 batch/streaming STT, AI provider abstraction, in-memory live suggestion store, and a PostgreSQL schema for meetings, sessions, transcripts, documents, versions, notifications, live cards, summaries, action items, nodes, evidence, and document patches.

Important backend files:

| File | Purpose |
|---|---|
| `backend/src/index.ts` | Express server, CORS, routes, WebSocket hub, session sweeper, provider boot log. |
| `backend/src/routes/meeting.ts` | Project/meeting creation, listing, update, delete. |
| `backend/src/routes/session.ts` | Session lifecycle: create, recover, start, end. |
| `backend/src/routes/transcript.ts` | Transcript ingest, live context building, async AI routing. |
| `backend/src/routes/ai.ts` | AI test, legacy structured blocks, manual suggestion endpoints. |
| `backend/src/routes/summary.ts` | Builds post-meeting summary prompt from full transcript. |
| `backend/src/routes/document.ts` | Generates and commits PM document patches. |
| `backend/src/realtime/hub.ts` | WebSocket auth, facilitator routing, streaming STT frames, notifications. |
| `backend/src/realtime/suggestions.ts` | In-memory suggestion card store, dedupe, card cap. |
| `backend/src/realtime/autodetect.ts` | Deterministic heuristic for marking suggestion cards answered. |
| `backend/src/lib/stt.ts` | Google Speech v2 batch STT and mock fallback. |
| `backend/src/lib/sttStream.ts` | Google Speech v2 streaming recognizer and mock stream. |
| `backend/src/lib/pmDocument.ts` | PM document JSONB conversion and prompt rendering. |
| `backend/src/db/schema.sql` | PostgreSQL schema. |
| `backend/src/config/env.ts` | Environment provider switches and defaults. |

### Database, Auth, Deployment, Storage

Database is PostgreSQL via `pg`. README says Railway Postgres in production. The schema header mentions Supabase, but runtime code is generic PostgreSQL through `DATABASE_URL`.

Auth is JWT-based. Protected REST routes use `requireAuth`. Roles are `facilitator`, `participant`, and `admin`. The WebSocket hub verifies JWT before subscribing a socket to a session. Live suggestions are facilitator-only.

README describes Vercel for frontend, Railway for backend, and Railway PostgreSQL for database. The frontend uses `VITE_API_BASE` and optional `VITE_WS_BASE`. Backend uses `DATABASE_URL`, `JWT_SECRET`, AI provider credentials, and Google STT credentials.

Audio is not persisted as a blob/file in current code. PM documents are stored as JSONB in `documents.state_json`; versions are stored in `document_versions.state_json` and `patch_json`.

### AI Providers

Configured by `AI_PROVIDER` in `backend/src/config/env.ts`.

| Provider | File | Default/model | Notes |
|---|---|---|---|
| `groq` | `ai-service/src/providers/groq.ts` | `llama-3.3-70b-versatile` | OpenAI-compatible chat completions, JSON mode, low temperature, 4096 max tokens, serialized request gate, 429 backoff. |
| `gemini` | `ai-service/src/providers/gemini.ts` | `gemini-2.5-flash` | OpenAI-compatible Gemini endpoint. Low temperature, but no explicit `response_format` in current code. |
| `typhoon` | `ai-service/src/providers/typhoon.ts` | `typhoon-v1.5x-70b-instruct` | OpenAI-compatible endpoint. Low temperature, no explicit JSON mode. |
| `ollama` | `ai-service/src/providers/ollama.ts` | `llama3.1` | Local `/api/chat`, no JSON mode configuration in current code. |
| `mock` | `ai-service/src/providers/mock.ts` | deterministic mock | Emits valid mock live cards, document patches, and blocks. |

There is no OpenAI, Anthropic, DeepSeek, or Qwen provider implemented yet.

### STT Providers

Configured by `STT_PROVIDER`. Current source implements `google` and `mock`. Google uses Speech v2 batch `recognize` and streaming `_streamingRecognize`, default model `chirp_2`, default language `th-TH`. README mentions Typhoon STT, but the source code currently uses Google STT plus mock.

### ASCII Architecture Diagram

```txt
Browser / Vercel React
  | REST /api/* and WebSocket /ws
  v
Railway Express Backend
  +-- JWT auth
  +-- meeting/session routes
  +-- transcript ingest
  |     +-- text -> transcripts
  |     +-- audio clips -> Google Speech v2 -> transcripts
  |     +-- PCM over WS -> Google StreamingRecognize -> transcripts
  +-- live AI router, async per session
  |     +-- goal + brief + rolling memory + PM doc + open cards + recent rows
  |     +-- ai-service liveCardCall()
  |     +-- in-memory suggestions -> WS push to facilitator
  +-- summary route -> full transcript -> structuredCall()
  +-- document route -> PM doc + full transcript -> documentPatchCall()
        -> review -> commit document version

PostgreSQL
  +-- orgs/users/projects/meetings/sessions/transcripts
  +-- documents/document_versions/document_patches
  +-- live_cards/evidence, summaries/action_items, nodes/relationships

External services
  +-- Google Speech v2
  +-- LLM provider: Groq/Gemini/Typhoon/Ollama/Mock
```

## Part 2 - Complete AI Pipeline

### AI-Related Files

| File path | Purpose | Dependencies | Called by | Calls |
|---|---|---|---|---|
| `ai-service/src/index.ts` | Selects provider and exposes `complete`, `structuredCall`, `liveCardCall`, `documentPatchCall`; builds live and document prompts. | Env, providers, `schema.ts`, shared types. | Backend AI, transcript, summary, document routes. | Active provider `complete()`, parsers. |
| `ai-service/src/schema.ts` | System prompts and hand-written JSON parsing/validation for structured blocks, live cards, document patches. | Shared types. | `ai-service/src/index.ts`. | `JSON.parse`, validators. |
| `ai-service/src/providers/types.ts` | Provider interface and fetch timeout helper. | Native fetch. | Provider modules. | `fetch`. |
| `ai-service/src/providers/groq.ts` | Groq provider with JSON mode and rate limiting. | Env, provider types. | `selectProvider()`. | Groq `/chat/completions`. |
| `ai-service/src/providers/gemini.ts` | Gemini OpenAI-compatible provider. | Env, provider types. | `selectProvider()`. | Gemini `/chat/completions`. |
| `ai-service/src/providers/typhoon.ts` | OpenTyphoon provider. | Env, provider types. | `selectProvider()`. | OpenTyphoon `/chat/completions`. |
| `ai-service/src/providers/ollama.ts` | Local Ollama provider. | Env, provider types. | `selectProvider()`. | Ollama `/api/chat`. |
| `ai-service/src/providers/mock.ts` | Offline deterministic provider. | Provider types. | `selectProvider()`. | None. |
| `shared/types.ts` | AI DTOs, PM document types, WebSocket event types. | None. | Frontend/backend/ai-service. | None. |
| `shared/schema/live-card-output.schema.json` | JSON schema contract for live card output. | None. | Contract/documentation. | None. |
| `shared/schema/document-patch-output.schema.json` | JSON schema contract for document patch output. | None. | Contract/documentation. | None. |
| `backend/src/routes/transcript.ts` | Transcript ingest, live AI context, async AI scheduling, rolling memory persistence, card push. | Auth, DB, STT, AI, suggestions, hub, PM document helper. | `/api/transcript/*`, stream ingest. | STT, `liveCardCall`, DB, WS push. |
| `backend/src/routes/ai.ts` | AI test, legacy structured endpoint, suggestion endpoints. | AI, auth, suggestions, validation, hub. | `/api/ai/*`. | `firstCall`, `structuredCall`, WS push. |
| `backend/src/routes/summary.ts` | Full transcript to participant summary. | Auth, DB, `structuredCall`. | `GET /api/summary/:sessionId`. | DB, AI. |
| `backend/src/routes/document.ts` | PM patch proposal and commit. | Auth, DB, AI, PM helpers. | `/api/document/*`. | `documentPatchCall`, DB, notifications. |
| `backend/src/realtime/suggestions.ts` | In-memory live cards, dedupe, max open cap, confidence filter. | Shared types, IDs. | Transcript/AI routes. | None. |
| `backend/src/realtime/autodetect.ts` | Rule-based answered-card detection. | Shared types. | Transcript/AI routes. | None. |
| `backend/src/realtime/hub.ts` | WebSocket auth, card/notification push, binary STT frames. | JWT, DB, STT stream. | Server entrypoint, transcript route. | `createSttStream`, socket sends. |
| `backend/src/lib/stt.ts` | Batch Google STT and mock STT. | Google Speech v2, env. | Transcript route. | Google recognize. |
| `backend/src/lib/sttStream.ts` | Streaming STT wrapper and mock stream. | STT context, env. | WebSocket hub. | Google streaming recognize. |
| `backend/src/lib/pmDocument.ts` | PM document load/render helpers. | DB, shared PM sections. | Transcript/document routes. | DB reads. |
| `src/pages/Meeting.tsx` | Live capture UI and meeting control room. | Auth, media/STT/socket hooks. | User UI. | Transcript/session APIs, WebSocket. |
| `src/hooks/useSuggestionSocket.ts` | WS client, card sync, manual answered action. | Auth, API bases. | Meeting page. | `/api/ai/suggest/*`, `/ws`. |
| `src/pages/DocumentView.tsx` | Document patch generation/review/commit. | Auth, PM types. | User UI. | `/api/document/*`. |
| `src/pages/SummaryView.tsx` | Summary loading/rendering. | Auth. | User UI. | `/api/summary/:sessionId`. |

### Runtime Flow

```txt
Meeting creation
  -> POST /api/meeting
  -> stores title, project, goal, brief, duration
  -> row in meetings

Session starts
  -> POST /api/session
  -> POST /api/session/:id/start
  -> row in sessions, status active

Transcript arrives
  -> WebSocket PCM -> Google StreamingRecognize -> final transcript
  -> or MediaRecorder clip -> POST /api/transcript/audio-chunk -> Google recognize
  -> or text -> POST /api/transcript/chunk
  -> transcript row saved

Context building
  -> transcript.ts buildLiveContext()
  -> session rolling_summary + meeting goal/brief + project/org
  -> cached current PM document
  -> unresolved open cards
  -> last 12 transcript rows

Prompt construction
  -> SYSTEM_PROMPT_LIVE_CARD + liveContextPrompt(ctx)

LLM request
  -> liveCardCall(ctx)
  -> selectProvider()
  -> provider.complete(messages)

Returned JSON
  -> parseLiveCard()
  -> validate chunk_signal and cards
  -> inject session_id

Popup reminder
  -> createFromLiveCards()
  -> filter low confidence, duplicates, over-cap
  -> WebSocket suggestion:new
  -> useSuggestionSocket()
  -> SuggestionCardStack

Database updates
  -> transcripts.chunk_signal updated
  -> sessions.rolling_summary replaced on IMPORTANT chunks
  -> live cards are currently in-memory only

Meeting summary
  -> SummaryView GET /api/summary/:sessionId
  -> summary route sends full transcript to structuredCall()
  -> maps legacy blocks to participant_summary_output
  -> currently not persisted

Project updates
  -> DocumentView POST /api/document/session/:id/generate
  -> current PM doc + rolling memory + full transcript -> documentPatchCall()
  -> facilitator reviews/edits
  -> POST /commit
  -> documents + document_versions + notifications updated
```

### Pipeline Diagram

```txt
Audio/Text Input
  +-- WS PCM -> Streaming STT -> final transcript
  +-- REST audio -> batch STT -> transcript
  +-- REST text -> transcript
                       |
                       v
                transcripts table
                       |
                       v
            async per-session live AI scheduler
                       |
       +---------------+----------------+
       |                                |
       v                                v
build live context              auto-detect answered
PM doc + goal + brief           open suggestion cards
rolling memory + recent rows            |
       |                                v
       v                         suggestion:answered WS
SYSTEM_PROMPT_LIVE_CARD
       |
       v
provider.complete()
       |
       v
parseLiveCard validation
       |
       +-- chunk_signal -> transcripts.chunk_signal
       +-- rolling_memory_update -> sessions.rolling_summary
       +-- cards -> in-memory suggestions -> WS -> facilitator

Session end
  +-- SummaryView -> full transcript -> structuredCall -> summary response
  +-- DocumentView -> PM doc + transcript + memory -> documentPatchCall -> review -> commit
```

## Part 3 - AI Task Breakdown

| AI task | Implemented | Latency | Complexity | Output format | Context size | Frequency |
|---|---:|---|---|---|---|---|
| Live transcript understanding | Yes | Low, target 2-5s after final text | Medium | `live_card_output.chunk_signal` | System + goal/brief + PM doc + rolling memory + last 12 rows | Up to one per final chunk; scheduler skips intermediate chunks under load |
| Missing context detection | Yes | Low | Medium-high | Live `QUESTION_SUGGESTION` | Same live context | Same as live cards |
| Question generation | Yes | Low | Medium | `suggested_question` | Same live context | Same as live cards, capped to 4 open cards |
| Decision extraction | Partial | Low/background | Medium | Live `MISSING_DECISION`, summary `DecisionNode` | Live or full transcript | Live frequent; summary on fetch |
| Action item extraction | Partial | Background | Medium | Summary asks for it, but `action_items` is returned empty | Full transcript | Once per summary fetch |
| Risk detection | Partial | Low/background | Medium | Live card or summary/document text | Live/full transcript | Live plus post-meeting |
| Contradiction detection | Prompted indirectly | Low/background | High | Usually question card | Depends on rolling memory quality | Live frequent |
| Summary generation | Yes | Background | Medium-high | Participant summary assembled from legacy blocks | Full transcript | On summary route fetch; can rerun |
| Document generation/update | Yes | Background | High | `document_patch_output` | Full transcript + PM document + rolling memory | On generate request; can rerun |
| Project memory update | Partial | Background | High | PM document patches and rolling summary | Transcript + PM doc | Rolling during meeting, document after meeting |
| Embeddings | No | Background | Low-medium | None | None | None |
| Search/RAG | No | Future | Medium | None | Direct PM document injection only | None |
| Classification | Yes | Low | Low-medium | `IMPORTANT`, `LOW_SIGNAL`, `IGNORE` | Live context | Per live AI call |
| Answered-card detection | Yes, non-LLM | Very low | Low | card IDs | Latest transcript chunk + open cards | Every routed chunk/scan |

## Part 4 - Prompts

| Prompt | File path | Purpose | Estimated token size | Variables inserted | Runtime changes | Reusable |
|---|---|---|---:|---|---:|---:|
| `SYSTEM_PROMPT_JSON` | `ai-service/src/schema.ts` | Force generic JSON block output. | 230-350 | None | No | Yes |
| `SYSTEM_PROMPT_LIVE_CARD` | `ai-service/src/schema.ts` | Force live JSON output, chunk classification, rolling memory, at most one card. | 900-1,300 | None | No | Yes |
| `SYSTEM_PROMPT_DOC_PATCH` | `ai-service/src/schema.ts` | Force JSON document patch output for PM sections. | 450-650 | None | No | Yes |
| `firstCall` hardcoded prompt | `ai-service/src/index.ts` | Provider diagnostic. | 25 | None | No | Diagnostic only |
| `liveContextPrompt()` | `ai-service/src/index.ts` | User prompt for live card gateway. | 200 fixed + context | PM doc, goal, brief, rolling summary, open questions, recent transcript | Yes | Yes |
| `docPatchPrompt()` | `ai-service/src/index.ts` | User prompt for PM document patching. | 80 fixed + context | project id, base version, PM doc, rolling memory, transcript | Yes | Yes |
| `transcriptToPrompt()` | `backend/src/routes/summary.ts` | User prompt for participant summary. | 120 fixed + transcript | meeting title, timestamped transcript | Yes | Yes |
| Manual `/api/ai/suggest` input | `backend/src/routes/ai.ts` | Facilitator-triggered suggestion. | Caller supplied | request body input | Yes | Endpoint reuse |

Prompt assessment:

- Live prompt is the strongest: specific, bounded, JSON-only, multilingual, and includes silence/garbled-STT rules.
- Document patch prompt has good section-level patch semantics.
- Summary prompt is weaker because it routes through generic blocks instead of a dedicated summary schema.
- Validators protect downstream UI from malformed JSON.
- Groq is the only current provider that requests JSON mode explicitly.

## Part 5 - Context Management

| Context item | Live card | Summary | Document patch |
|---|---:|---:|---:|
| Meeting goal | Yes | No | Indirect only |
| Agenda/brief | Yes | No | Indirect only |
| Current PM document | Yes, cached per session | No | Yes |
| Previous meetings | Indirect through PM document | No | Indirect through PM document |
| Transcript | Last 12 rows | Full transcript | Full transcript |
| Rolling memory | Yes | No | Yes |
| Open questions | Yes, from in-memory cards | No | No |
| Decisions/risks/action items | Indirect | From transcript | From transcript/PM doc |
| Evidence | Tables exist, not populated | No | No evidence rows persisted |
| Project tree/nodes | No | No | No |
| Vector memory/RAG | No | No | No |

Estimated prompt size:

| Request type | Average prompt size | Worst-case today | Notes |
|---|---:|---:|---|
| Live card | 2,000-4,500 input tokens | 8,000-15,000+ if PM doc grows | Does not resend full transcript. |
| Summary | 7,000-15,000 for 30-60 min | 25,000+ for 90 min | Sends full transcript every fetch. |
| Document patch | 9,000-20,000 for 30-60 min | 35,000+ for 90 min plus large PM doc | Sends full transcript and full rendered PM doc. |
| Legacy structure | Caller-dependent | Caller-dependent | No app-level context builder. |

Full transcript reuse:

- Live AI: no, it uses rolling memory plus recent transcript rows.
- Summary AI: yes.
- Document patch AI: yes.
- Incremental context exists only through `sessions.rolling_summary`.

Recommended context architecture:

1. Persist structured meeting state incrementally: decisions, assumptions, risks, open questions, action items.
2. Store transcript evidence references.
3. Use the full transcript once for final reconciliation, not on every view refresh.
4. Use PM document plus structured state as primary context.
5. Add embeddings/RAG only after structured state exists.

## Part 6 - Database

| Table | AI relevance | Current runtime use |
|---|---|---|
| `projects` | Project-level grouping for meetings and PM memory. | Used. |
| `meetings` | Stores title, goal, brief, duration, project. Goal/brief feed live AI. | Used. |
| `sessions` | Runtime anchor and `rolling_summary`. | Used. |
| `transcripts` | Canonical transcript rows and chunk signal. | Used. |
| `documents` | Current PM document JSONB, source of truth. | Used. |
| `document_versions` | Version history for PM document commits. | Used. |
| `document_patches` | Intended persistent metadata for AI patch proposals. | Not used during generate. |
| `document_patch_items` | Intended persistent patch operations. | Not used during generate/commit. |
| `document_patch_evidence` | Intended traceability to transcript quotes. | Not populated. |
| `nodes` | Intended strategy/tree memory for decisions, assumptions, risks, open questions, summaries. | Not populated by AI runtime. |
| `node_relationships` | Intended graph/tree edges. | Not populated by AI runtime. |
| `node_evidence` | Intended transcript evidence for nodes. | Not populated. |
| `live_cards` | Intended persistent live-card store. | Runtime uses in-memory store instead. |
| `live_card_evidence` | Intended card evidence links. | Not populated. |
| `participant_summaries` | Intended persisted summary envelope. | Summary route returns transient response. |
| `summary_blocks` | Intended persisted summary blocks. | Not populated. |
| `action_items` | Intended persisted action items. | Not populated; route returns empty action list. |
| `notifications` | Notifies users after document commits. | Used. |

Relationship sketch:

```txt
organizations
  -> users
  -> projects
       -> meetings
            -> sessions
                 -> transcripts
                 -> live_cards -> live_card_evidence -> transcripts
                 -> participant_summaries -> summary_blocks/action_items
                 -> document_versions
       -> documents -> document_versions
       -> nodes -> node_relationships/node_evidence
       -> document_patches -> document_patch_items -> document_patch_evidence
```

Persistence gap: the schema is more ambitious than the runtime. The current runtime mostly persists transcript rows, transcript chunk signal, session rolling summary, document state/version commits, and notifications. Important live AI state remains in memory.

## Part 7 - Latency Analysis

| Request | Trigger | Blocking | Streaming | UX impact |
|---|---|---:|---:|---|
| `firstCall()` | `/api/ai/test` | Yes | No | Diagnostic only. |
| `structuredCall(input)` | `/api/ai/structure` | Yes | No | Caller waits for response. |
| Manual `/api/ai/suggest` | Facilitator request | Yes | No | Facilitator waits; cards pushed afterward. |
| `liveCardCall(ctx)` | After transcript row save | No for transcript HTTP response | No | Suggestions can lag, transcript stays responsive. |
| Summary AI | `GET /api/summary/:sessionId` | Yes | No | Summary page loading waits. |
| Document patch AI | `POST /api/document/session/:id/generate` | Yes | No | Document review page loading waits. |
| Google batch STT | Audio chunk REST | Yes per chunk | No | Transcript delayed until STT returns. |
| Google streaming STT | WebSocket PCM | No REST block | Yes | Best live UX; interim text appears before final row. |

Strengths:

- Transcript persistence is separated from live AI response.
- Live AI scheduler prevents per-session concurrency explosion.
- Groq provider serializes requests and retries 429s.
- WebSocket pushes cards without polling.
- Streaming STT avoids 6s clip-boundary latency when enabled.

Risks:

- Live LLM output is not streamed; cards arrive only after full JSON completion.
- Summary and document generation are request/response blocking.
- Post-meeting full transcript prompts grow linearly with meeting length.
- Groq global request gate serializes all sessions behind one provider bottleneck.
- In-memory cards are lost on backend restart.
- Providers other than Groq lack explicit JSON-mode configuration in current code.

Improvements:

1. Add provider-specific structured output support.
2. Add per-task model routing and per-provider queues.
3. Persist live cards to `live_cards`.
4. Persist structured meeting state during the meeting.
5. Move summary/document generation into background jobs with status polling or WebSocket completion events.
6. Cache static prompt segments and PM document context where supported.
7. Add cheap local pre-filtering before live LLM calls.

## Part 8 - Token Estimation

Assumptions:

- Spoken transcript: 180-240 tokens/minute; use 220 tokens/minute for planning.
- Live call cadence: roughly one call every 6 seconds in batch mode, up to 10 calls/minute.
- Live input per call: average 2,500 tokens including system prompt, PM document, rolling memory, open questions, recent transcript.
- Live output per call: 100-200 tokens.
- Summary input: full transcript plus about 200 fixed tokens.
- Document patch input: full transcript plus PM document plus 80 fixed tokens, usually transcript + 2,000-5,000.

Transcript tokens:

| Meeting length | Transcript tokens at 220/min |
|---:|---:|
| 30 min | ~6,600 |
| 60 min | ~13,200 |
| 90 min | ~19,800 |

Estimated total LLM tokens:

| Meeting length | Live calls | Live input | Live output | Summary input/output | Document input/output | Estimated total |
|---:|---:|---:|---:|---:|---:|---:|
| 30 min | ~300 | ~750k | ~30k-60k | ~7k / ~1k | ~10k / ~1k-3k | ~800k-830k |
| 60 min | ~600 | ~1.5M | ~60k-120k | ~13.5k / ~1.5k | ~17k / ~2k-4k | ~1.6M-1.66M |
| 90 min | ~900 | ~2.25M | ~90k-180k | ~20k / ~2k | ~25k / ~3k-6k | ~2.39M-2.48M |

Live cards dominate cost because they are frequent. Post-meeting work is larger per call but much less frequent.

## Part 9 - Architecture Review

| Category | Score | Explanation |
|---|---:|---|
| Prompt design | 7/10 | Live and document prompts are concrete, JSON-only, and domain-specific. Summary prompt needs a dedicated schema. |
| Context management | 6/10 | Live path uses rolling memory and recent window. Post-meeting routes resend full transcripts and do not use structured state/evidence. |
| AI architecture | 7/10 | Clear gateway separation, provider abstraction, and validation. Missing task routing, repair retries, jobs, and persistent live-card state. |
| Streaming architecture | 7/10 | Streaming STT is strong. LLM and post-meeting work are not streamed/backgrounded. |
| JSON reliability | 6/10 | Validators protect UI. Groq has JSON mode. Other providers rely mainly on prompt discipline. |
| Meeting memory | 5/10 | Rolling summary and PM document exist. Node/evidence/memory tables are not populated yet. |
| Scalability | 5/10 | Good MVP behavior. Global provider gate, in-memory cards, no job queue, and full transcript prompts limit production scale. |
| Cost efficiency | 6/10 | Live avoids full transcript replay, but frequent calls dominate cost. No caching, prefiltering, or model routing yet. |

## Part 10 - Model Recommendation

Sources used for current public model/pricing facts:

- OpenAI GPT-5: https://developers.openai.com/api/docs/models/gpt-5
- OpenAI GPT-5 Mini: https://developers.openai.com/api/docs/models/gpt-5-mini
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Anthropic Claude pricing: https://platform.claude.com/docs/en/about-claude/pricing
- DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing/
- Qwen/Alibaba pricing: https://help.aliyun.com/en/model-studio/model-pricing

Current-doc notes:

- OpenAI docs list GPT-5 and GPT-5 Mini as supporting streaming and structured outputs. GPT-5 is documented as previous-generation relative to GPT-5.6, but this comparison uses the requested models only.
- Gemini 2.5 Flash/Pro have large context and published caching/pricing. Gemini 2.5 Flash is already the configured default in this codebase.
- Anthropic current docs mark Claude Sonnet 4 as retired except on Bedrock/Google Cloud; Sonnet 4.5/4.6 are current successors. This report still evaluates Sonnet 4 because requested.
- DeepSeek official docs list V4 Flash/Pro with OpenAI/Anthropic-compatible APIs, JSON output, tool calls, 1M context, and very low token pricing. V3 is older; V4 is the active DeepSeek target.
- Qwen pricing depends heavily on region and model family.

### Model Comparison For This Codebase

| Model | Strengths | Weaknesses | Expected latency | Expected cost | Fit |
|---|---|---|---|---|---|
| GPT-5 Mini | Strong structured JSON fit, good for low-cost live calls, easy provider addition. | Less ideal for nuanced final synthesis than larger models. | Low | Low-medium | Best OpenAI live-card model. |
| GPT-5 | Stronger reasoning, structured output, summaries, document patches, memory reconciliation. | Too expensive for every live chunk. | Medium | Medium-high | Best OpenAI post-meeting model. |
| Gemini 2.5 Flash | Already aligned with config, low cost, fast, large context. | Current provider lacks explicit JSON mode. | Low | Low | Strong live default if JSON support is hardened. |
| Gemini 2.5 Pro | Large context, stronger reasoning, good for document patches. | Higher cost and latency; overkill for live chunks. | Medium-high | Medium-high | Strong post-meeting model. |
| Claude Sonnet 4 | Strong synthesis and writing quality. | Exact requested model is currently retired except partner clouds; needs Anthropic provider. | Medium | High | Good if access exists, but use newer Sonnet if allowed. |
| DeepSeek V3/V4 | Very low cost, OpenAI-compatible, V4 supports JSON output and 1M context. | Provider not implemented; compliance/reliability needs evals; V3 superseded. | Low-medium | Very low | Strong cost-optimized candidate. |
| Qwen 3 | Good regional/cost options, large context variants. | Provider not implemented; pricing and regions are complex; schema reliability needs evals. | Low-medium | Low-medium | Useful fallback/Asia-region option. |

### Suitability By Task

| Model | Live understanding | Popup questions | Decisions | Summary | Document generation | Memory updates |
|---|---|---|---|---|---|---|
| GPT-5 Mini | High | High | Medium-high | Medium | Medium | High incremental |
| GPT-5 | Medium-high | High | High | High | High | High |
| Gemini 2.5 Flash | High | High | Medium-high | Medium | Medium | High incremental |
| Gemini 2.5 Pro | Medium | High | High | High | High | High |
| Claude Sonnet 4 | Medium | High | High | High | High | High |
| DeepSeek V3/V4 | High for V4 Flash | Medium-high | Medium-high | Medium-high | Medium-high to high with V4 Pro | High incremental |
| Qwen 3 | Medium-high | Medium-high | Medium | Medium-high | Medium-high | Medium-high |

### Ranking For This Architecture

1. Gemini 2.5 Flash + Gemini 2.5 Pro
   - Best match to current code because Gemini provider/config already exists.
   - Use Flash for live cards and Pro for document/summary.
   - Add strict JSON/structured output support and retries.

2. GPT-5 Mini + GPT-5
   - Best reliability-oriented architecture if adding OpenAI is acceptable.
   - Use GPT-5 Mini for live cards and GPT-5 for document/summary.
   - Strong structured output fit and simple provider shape.

3. DeepSeek V4 Flash + V4 Pro
   - Best cost-optimized architecture if compliance constraints are acceptable.
   - Very attractive for high-volume live calls.
   - Requires provider implementation and real evals against Stratis schemas.

4. Claude Sonnet 4
   - Strong for synthesis, but exact model availability is awkward.
   - Better treated as current Claude Sonnet generation if the model list can be modernized.

5. Qwen 3
   - Practical fallback for cost/region strategy.
   - Needs more integration and schema eval work before becoming primary.

### CTO Recommendation

If I were CTO of Stratis, I would deploy a multi-model architecture, not a single model.

Recommended route:

```txt
Streaming STT
  -> Google Speech v2 or another dedicated realtime STT vendor

Live meeting AI
  -> Gemini 2.5 Flash if minimizing engineering change
  -> or GPT-5 Mini if prioritizing structured output reliability
  -> or DeepSeek V4 Flash if prioritizing cost after evals

Post-meeting summary/document patches
  -> Gemini 2.5 Pro if staying on Gemini
  -> or GPT-5 if using OpenAI
  -> or DeepSeek V4 Pro for low-cost scale after evals

Meeting memory
  -> fast model for incremental extraction
  -> stronger model for final reconciliation
```

Single model vs multiple models: single model is simpler but wrong for Stratis economics. Live calls dominate volume and need speed; post-meeting document updates need deeper reasoning and can wait. A single strong model wastes money on every live chunk. A single cheap model reduces quality in summaries and PM document patches.

### Target Production Architecture

```txt
Transcript final rows
  |
  +-- local filter: silence/filler/duplicate suppression
  |
  +-- live model route
  |     -> classify chunk
  |     -> update rolling memory
  |     -> emit at most one facilitator card
  |     -> persist live_card + evidence
  |
  +-- incremental state extractor
        -> decisions
        -> assumptions
        -> risks
        -> action items
        -> open questions
        -> evidence links

Session end
  |
  +-- background job: reconcile structured state against transcript
  +-- background job: participant summary
  +-- background job: PM document patch proposal
  +-- facilitator review
  +-- commit PM document version and notify participants
```

### Implementation Priorities

1. Add a task router above `selectProvider()` so `live_card`, `summary`, `document_patch`, and `memory_update` can use different models/timeouts.
2. Add strict structured output support for each provider, especially Gemini.
3. Persist live cards and evidence instead of relying on in-memory maps.
4. Persist structured meeting state incrementally into nodes/action/evidence tables.
5. Move summary/document generation to background jobs and cache output by session/version.
6. Add evals for JSON validity, Thai/English code switching, card usefulness, and document patch correctness.

## Final Answer

For Stratis today, the practical deployment choice is:

- Use Gemini 2.5 Flash for live cards if you want the least engineering change.
- Use Gemini 2.5 Pro for document patches and summaries.
- Add task-level routing now, even if both routes initially point to Gemini.
- If reliability matters more than minimizing integration change, implement OpenAI and use GPT-5 Mini for live cards plus GPT-5 for post-meeting work.
- If cost is the top constraint, evaluate DeepSeek V4 Flash/Pro against the Stratis JSON schemas before using it in production.

The most important architecture decision is not the brand of model. It is separating live, incremental, low-latency AI from slower post-meeting synthesis, and persisting structured meeting state so the system stops depending on repeated full-transcript prompts.