# Stratis

Stratis is an AI co-facilitator for team meetings.

It listens during meetings, captures transcript chunks, sends facilitator-only suggestion cards, and generates post-meeting summaries plus change-based PM document updates. The strategy/tree record is the historical retrieval layer.

---

## Deployment

Stratis runs as two deployed services:

| Service | Host | Notes |
|---|---|---|
| Frontend (React + Vite) | **Vercel** | Static build. Talks to the backend via `VITE_API_BASE` / `VITE_WS_BASE` set at build time. |
| Backend (Express) + Database | **Railway** | Node service + managed **PostgreSQL**. Backend reads `DATABASE_URL`. |

The frontend has no dev proxy in production — every request goes to `API_BASE`/`WS_BASE` resolved in [`src/lib/api.ts`](src/lib/api.ts):

```ts
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";
export const WS_BASE  = import.meta.env.VITE_WS_BASE  ?? API_BASE.replace(/^http/, "ws");
```

- On Vercel, set `VITE_API_BASE` to the Railway backend URL (e.g. `https://stratis-api.up.railway.app`). `WS_BASE` auto-derives `https → wss`, so a single var usually covers both.
- The `localhost:3001` fallbacks and the Vite proxy in `vite.config.js` apply to **local dev only**.

---

## Current Stack

### Frontend

- React + TypeScript
- Vite
- Inline component styling for MVP
- WebSocket client for live suggestion cards
- Hosted on Vercel

### Backend

- Node.js + Express
- **PostgreSQL** via the `pg` driver (hosted on Railway)
- JWT auth
- WebSocket hub
- AI provider abstraction
- STT provider abstraction
- Mock-first local development

### AI Service

- Provider switch:
  - `mock`
  - `groq`
  - `ollama`
  - `typhoon` (Thai-tuned LLM, for Thai/English meetings)
- Structured JSON parser + schema validation
- Four AI output gateways (see [AI Output Architecture](#ai-output-architecture))

### Speech-to-Text

- Provider switch:
  - `mock`
  - `typhoon` (Typhoon Whisper turbo via HuggingFace inference)

---

## Project Structure

```txt
STRATIS-APP/
├── src/                         # Frontend React app
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── BlockRenderer.tsx
│   │   ├── MeetingTransition.tsx
│   │   ├── NodeTypes.tsx
│   │   ├── Sidebar.tsx
│   │   ├── states.tsx
│   │   ├── SuggestionCardStack.tsx
│   │   └── ui.tsx
│   │
│   ├── constants/
│   │   ├── index.d.ts
│   │   └── index.js
│   │
│   ├── context/
│   │   └── AuthContext.tsx
│   │
│   ├── hooks/
│   │   ├── useAiBlocks.ts
│   │   ├── useMediaRecorder.ts
│   │   ├── useSessionRecovery.ts
│   │   └── useSuggestionSocket.ts
│   │
│   ├── lib/
│   │   └── api.ts               # API_BASE / WS_BASE (env-driven)
│   │
│   ├── mocks/
│   │   └── summaryMock.ts
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── DocumentView.tsx
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Meeting.tsx
│   │   ├── Projects.tsx
│   │   ├── Register.tsx
│   │   └── SummaryView.tsx
│   │
│   └── tokens/
│       └── colors.ts
│
├── backend/                     # Express backend
│   ├── package.json
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── index.ts
│       │
│       ├── auth/
│       │   ├── jwt.ts
│       │   ├── middleware.ts
│       │   └── routes.ts
│       │
│       ├── config/
│       │   └── env.ts
│       │
│       ├── db/
│       │   ├── database.ts      # pg Pool, DATABASE_URL
│       │   ├── migrate.ts       # applies schema.sql (--reset drops tables)
│       │   ├── schema.sql       # PostgreSQL schema
│       │   └── seed.ts
│       │
│       ├── lib/
│       │   ├── ids.ts
│       │   └── stt.ts
│       │
│       ├── middleware/
│       │   ├── errorHandler.ts
│       │   └── validateAiOutput.ts
│       │
│       ├── realtime/
│       │   ├── autodetect.ts
│       │   ├── hub.ts
│       │   └── suggestions.ts
│       │
│       └── routes/
│           ├── _placeholder.ts
│           ├── ai.ts
│           ├── document.ts
│           ├── index.ts
│           ├── meeting.ts
│           ├── session.ts
│           ├── summary.ts
│           └── transcript.ts
│
├── ai-service/                  # AI provider + structured output layer
│   └── src/
│       ├── index.ts
│       ├── schema.ts
│       │
│       └── providers/
│           ├── groq.ts
│           ├── mock.ts
│           ├── ollama.ts
│           ├── typhoon.ts
│           └── types.ts
│
├── shared/                      # Shared frontend/backend types + schemas
│   ├── types.ts
│   └── schema/
│       ├── document-patch-output.schema.json
│       └── live-card-output.schema.json
│
├── dist/                        # Frontend build output, ignored
│
├── .github/
├── node_modules/
│
├── .env.example
├── .gitignore
├── index.html
├── package.json                 # Frontend package
├── package-lock.json
├── vite.config.js
├── tsconfig.json
├── tsconfig.node.json
└── README.md
```

---

## Main Product Rules

- Live meeting suggestions are facilitator-only.
- Live AI cards (`live_card_output`) route to the suggestion card stack, not the transcript renderer.
- AI output must be validated against its schema before the frontend receives it.
- Meeting session ID anchors:
  - transcripts
  - live AI outputs / suggestion cards
  - summaries
  - document versions
  - tree nodes
- PM document is the source of truth; updates are change-based (patch → version), never full rewrites.
- Tree / strategy map is the visual, historical retrieval layer.

---

## AI Output Architecture

Stratis uses four formal AI output gateways:

```txt
live_card_output          # in-meeting facilitator cards + chunk classification
document_patch_output     # post-meeting PM-document section patches
tree_node_output          # structure tree nodes
participant_summary_output# participant-facing post-meeting summary
```

Formal JSON schemas live in:

```txt
shared/schema/live-card-output.schema.json
shared/schema/document-patch-output.schema.json
```

Sprint 1 MVP also uses a simpler block-style AI output (legacy structured path), still used by `/api/ai/structure` and the summary route:

```json
{
  "blocks": [
    {
      "type": "TextBlock",
      "title": "Short label",
      "content": "Plain text body",
      "metadata": {}
    }
  ]
}
```

Block types: `TextBlock`, `DecisionNode`, `SummaryBlock`, `QuestionSuggestion`.

Shared TypeScript contract (single source of truth):

```txt
shared/types.ts
```

AI parser + system prompts:

```txt
ai-service/src/schema.ts
ai-service/src/index.ts
```

---

## Frontend

### Install

```bash
npm install
```

### Run dev server

```bash
npm run dev
```

Frontend runs with Vite. Default URL: `http://localhost:5173`.

In dev, API requests to `/api` and `/ws` are proxied to `http://localhost:3001` (see `vite.config.js`). In production, set `VITE_API_BASE` (and optionally `VITE_WS_BASE`) at build time — the Vercel build uses these instead of the proxy.

### Build

```bash
npm run build
```

### Preview build

```bash
npm run preview
```

---

## Backend

The backend connects to PostgreSQL via `DATABASE_URL`. In production this is the Railway Postgres connection string; for local dev you can point it at a local Postgres instance or a Railway database URL.

### Install

```bash
cd backend
npm install
```

### Run database migration

```bash
npm run db:migrate
```

### Seed demo data

```bash
npm run db:seed
```

### Reset database

```bash
npm run db:reset
```

`db:reset` drops all tables (`CASCADE`) then re-applies `schema.sql` and re-seeds.

### Run backend dev server

```bash
npm run dev
```

Backend default URL: `http://localhost:3001`. WebSocket hub: `ws://localhost:3001/ws`.

### Typecheck backend

```bash
npm run typecheck
```

---

## Full Local Setup

From repo root, with a `DATABASE_URL` pointing at a reachable PostgreSQL database in your `.env`:

```bash
npm install
cd backend
npm install
npm run db:reset
npm run dev
```

In another terminal (repo root):

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

---

## Demo Login

After running the backend seed:

```txt
facilitator@stratis.dev / password123
participant@stratis.dev / password123
admin@stratis.dev       / password123
```

---

## Environment Setup

Create local env from template:

```bash
cp .env.example .env
```

The backend loads:

```txt
.env.<NODE_ENV>
.env
```

Real env values must not be committed. `.gitignore` ignores real env files (`.env`, `.env.*`, `**/.env*`) but keeps templates (`.env.example`, `**/.env.example`).

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `NODE_ENV` | all | `development`, `staging`, or `production` |
| `PORT` | backend | Express port, default `3001` |
| `CLIENT_ORIGIN` | backend | Allowed CORS origin, default `http://localhost:5173` |
| `DATABASE_URL` | backend | **PostgreSQL** connection string (Railway in prod) |
| `JWT_SECRET` | backend | JWT signing secret |
| `JWT_EXPIRES_IN` | backend | JWT lifetime, default `7d` |
| `AI_PROVIDER` | ai-service | `groq`, `ollama`, `typhoon`, or `mock` |
| `AI_TIMEOUT_MS` | ai-service | AI request timeout, default `10000` |
| `GROQ_API_KEY` | ai-service | Groq API key |
| `GROQ_MODEL` | ai-service | Groq model, default `llama-3.3-70b-versatile` |
| `OLLAMA_BASE_URL` | ai-service | Ollama URL, default `http://localhost:11434` |
| `OLLAMA_MODEL` | ai-service | Ollama model, default `llama3.1` |
| `TYPHOON_API_KEY` | ai-service | Typhoon (OpenTyphoon) API key |
| `STT_PROVIDER` | backend | `typhoon` or `mock` |
| `STT_TIMEOUT_MS` | backend | STT timeout, default `15000` |
| `HF_TOKEN` | backend | HuggingFace token for Typhoon Whisper STT |
| `VITE_API_BASE` | frontend | Backend base URL (build time). Defaults to `http://localhost:3001`. |
| `VITE_WS_BASE` | frontend | Backend WS base (build time). Derived from `VITE_API_BASE` if unset. |

The app can run with no external AI/STT keys:

- AI falls back to `mock` if a provider is selected but its key is missing.
- STT can use `mock` mode.

A PostgreSQL database (`DATABASE_URL`) is required for the backend to start.

---

## Backend API

### Health

```txt
GET /api/health
```

### Auth

```txt
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

### Meeting

```txt
GET    /api/meeting
GET    /api/meeting/upcoming
GET    /api/meeting/dashboard
GET    /api/meeting/projects
POST   /api/meeting/projects
POST   /api/meeting
GET    /api/meeting/:id
PATCH  /api/meeting/:id
DELETE /api/meeting/:id
```

### Session

```txt
GET  /api/session
GET  /api/session/active
GET  /api/session/recover
GET  /api/session/:id
POST /api/session
POST /api/session/:id/start
POST /api/session/:id/end
```

### Transcript

```txt
GET  /api/transcript
GET  /api/transcript/session/:sessionId
POST /api/transcript/chunk
POST /api/transcript/audio-chunk
```

### AI

```txt
GET  /api/ai
GET  /api/ai/test
POST /api/ai/structure
POST /api/ai/suggest
POST /api/ai/suggest/scan
POST /api/ai/suggest/answer
GET  /api/ai/suggest/:sessionId
```

### Summary

```txt
GET /api/summary
GET /api/summary/:sessionId
```

Generates a participant summary from the session's saved transcript via the validated AI call.

### Document

```txt
POST /api/document/session/:sessionId/generate   # propose PM-document patches (transient)
POST /api/document/session/:sessionId/commit      # apply approved patches → next version
GET  /api/document/:projectId                      # current PM document + version history
```

---

## Live Meeting Flow

Text chunk flow (live cards):

```txt
Meeting.tsx
→ POST /api/transcript/chunk
→ save transcript row
→ auto-detect answered cards
→ liveCardCall() → live_card_output (validated)
→ backend creates suggestion cards (facilitator only)
→ WebSocket pushes to facilitator
→ SuggestionCardStack renders bottom-right cards
```

Audio flow:

```txt
Meeting.tsx
→ useMediaRecorder
→ POST /api/transcript/audio-chunk
→ backend STT (typhoon | mock)
→ transcript saved
→ liveCardCall() → live_card_output
→ suggestion cards updated
```

Structured-block flow (legacy / manual):

```txt
useAiBlocks.send()
→ POST /api/ai/structure
→ ai-service structuredCall()
→ parse + validate JSON
→ frontend renders valid blocks
```

Post-meeting document flow:

```txt
End session
→ DocumentView: POST /api/document/session/:sessionId/generate
→ documentPatchCall() → document_patch_output (validated)
→ facilitator reviews/edits patches
→ POST /api/document/session/:sessionId/commit
→ new document version + notification
```

---

## Realtime WebSocket

URL shape:

```txt
ws://localhost:3001/ws?token=<jwt>&sessionId=<sessionId>
```

(In production: `wss://<railway-host>/ws?...`.)

Server events:

```ts
{ type: "connected", sessionId, role }
{ type: "suggestion:new", card }
{ type: "suggestion:answered", sessionId, cardId, source }
```

Rules:

- Only the session's facilitator socket receives suggestion events (verified against `sessions.facilitator_id`).
- Participants can connect but do not receive suggestion cards.
- Answered cards can be auto-detected from the transcript or manually marked.

---

## Database

PostgreSQL. Schema lives in:

```txt
backend/src/db/schema.sql
```

Main tables:

```txt
organizations
users
meetings
sessions
transcripts
documents
document_versions
nodes
node_relationships
notifications
consent_logs
```

The runtime database is hosted (Railway Postgres in production); there are no local SQLite files.

---

## Important Frontend Files

```txt
src/App.tsx
src/lib/api.ts
src/context/AuthContext.tsx
src/pages/Meeting.tsx
src/pages/DocumentView.tsx
src/pages/SummaryView.tsx
src/hooks/useAiBlocks.ts
src/hooks/useSuggestionSocket.ts
src/hooks/useMediaRecorder.ts
src/hooks/useSessionRecovery.ts
src/components/BlockRenderer.tsx
src/components/SuggestionCardStack.tsx
src/components/states.tsx
```

---

## Important Backend Files

```txt
backend/src/index.ts
backend/src/routes/index.ts
backend/src/routes/ai.ts
backend/src/routes/session.ts
backend/src/routes/transcript.ts
backend/src/routes/meeting.ts
backend/src/routes/document.ts
backend/src/routes/summary.ts
backend/src/realtime/hub.ts
backend/src/realtime/suggestions.ts
backend/src/realtime/autodetect.ts
backend/src/db/database.ts
backend/src/db/schema.sql
backend/src/config/env.ts
```

---

## Development Notes

### AI output validation

AI output must be validated before the frontend receives it. Validation path:

```txt
ai-service/src/schema.ts        # parse + schema validation
backend/src/middleware/validateAiOutput.ts
backend/src/routes/ai.ts
backend/src/routes/transcript.ts
backend/src/routes/document.ts
backend/src/routes/summary.ts
```

### Suggestion routing rule

Live cards are not transcript content. Correct route:

```txt
live_card_output
→ backend realtime suggestion store
→ WebSocket (facilitator only)
→ SuggestionCardStack
```

### Mock-heavy pages

Some pages still use mock data and should be wired to live endpoints in later tasks:

```txt
src/pages/Projects.tsx
src/mocks/summaryMock.ts
```

---

## Git Hygiene

Do not commit:

```txt
.env
.env.*
dist/
node_modules/
```

Safe to commit:

```txt
.env.example
shared/schema/*.json
shared/types.ts
source files
README.md
```

---

## Common Commands

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

Backend:

```bash
cd backend
npm run dev
npm run db:migrate
npm run db:seed
npm run db:reset
npm run typecheck
npm run build
```
