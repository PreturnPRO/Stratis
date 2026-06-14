Use this. Replace whole `README.md`.

Current repo is Vite React frontend, Express backend, SQLite local DB, shared types, and separate AI service. Vite proxies `/api` to backend port `3001` [7]. Backend scripts include `dev`, `db:migrate`, `db:seed`, `db:reset`, `typecheck`, and `build` [4]. Env files are ignored except `.env.example` [8].

```md
# Stratis

Stratis is an AI co-facilitator for team meetings.

It listens during meetings, captures transcript chunks, sends facilitator-only suggestion cards, and prepares the foundation for post-meeting summaries, PM document updates, and strategy/tree records.

---

## Current Stack

### Frontend

- React
- TypeScript
- Vite
- Inline component styling for MVP
- WebSocket client for live suggestion cards

### Backend

- Node.js
- Express
- SQLite via Node `node:sqlite`
- JWT auth
- WebSocket hub
- AI provider abstraction
- Mock-first local development

### AI Service

- Provider switch:
  - `mock`
  - `groq`
  - `ollama`
- Structured JSON parser
- Current MVP AI block contract:
  - `TextBlock`
  - `DecisionNode`
  - `SummaryBlock`
  - `QuestionSuggestion`

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
│   │   ├── Stats.tsx
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
│   │   ├── useDraggableNodes.d.ts
│   │   ├── useDraggableNodes.js
│   │   ├── useMediaRecorder.ts
│   │   └── useSuggestionSocket.ts
│   │
│   ├── mocks/
│   │   ├── suggestionCards.ts
│   │   └── summaryMock.ts
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Decisions.tsx
│   │   ├── Documents.tsx
│   │   ├── Inbox.tsx
│   │   ├── Landing.tsx
│   │   ├── LiveVoicePipelineTest.tsx
│   │   ├── Login.tsx
│   │   ├── Meeting.tsx
│   │   ├── Projects.tsx
│   │   ├── Register.tsx
│   │   ├── Settings.tsx
│   │   ├── StrategyMap.tsx
│   │   └── SummaryView.tsx
│   │
│   ├── schema/
│   │   └── block-types.json
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
│       │   ├── database.ts
│       │   ├── migrate.ts
│       │   ├── schema.sql
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
│           └── types.ts
│
├── shared/                      # Shared frontend/backend types
│   ├── types.ts
│   └── schema/
│       ├── document-patch-output.schema.json
│       ├── live-card-output.schema.json
│       ├── participant-summary-output.schema.json
│       └── tree-node-output.schema.json
│
├── schema/                      # Formal Stratis AI JSON schemas
│   ├── block-types.json
│   ├── live-card-output.schema.json
│   ├── document-patch-output.schema.json
│   ├── tree-node-output.schema.json
│   └── participant-summary-output.schema.json
│
├── data/                        # Local SQLite runtime files, ignored
│   ├── stratis.db
│   ├── stratis.db-shm
│   └── stratis.db-wal
│
├── dist/                        # Frontend build output, ignored
│   ├── index.html
│   └── assets/
│       ├── index-BQy-6a84.js
│       └── index-V4592Tcs.css
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
- `QuestionSuggestion` blocks should route to the suggestion card stack, not the transcript renderer.
- AI output must be validated before frontend receives it.
- Meeting session ID anchors:
  - transcripts
  - live AI outputs
  - suggestion cards
  - future summaries
  - future document outputs
  - future tree nodes
- PM document is the source of truth.
- Tree / strategy map is visual, historical, and retrieval layer only.

---

## AI Output Architecture

Stratis uses four formal AI output gateways:

```txt
live_card_output
document_patch_output
tree_node_output
participant_summary_output
```

Formal schemas live in:

```txt
schema/live-card-output.schema.json
schema/document-patch-output.schema.json
schema/tree-node-output.schema.json
schema/participant-summary-output.schema.json
```

Current Sprint 1 MVP also uses block-style AI output:

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

Block schema:

```txt
schema/block-types.json
```

Shared TypeScript contract:

```txt
shared/types.ts
```

AI parser:

```txt
ai-service/src/schema.ts
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

Frontend runs with Vite.

Default Vite URL:

```txt
http://localhost:5173
```

API requests to `/api` are proxied to:

```txt
http://localhost:3001
```

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

### Run backend dev server

```bash
npm run dev
```

Backend default URL:

```txt
http://localhost:3001
```

WebSocket hub:

```txt
ws://localhost:3001/ws
```

### Typecheck backend

```bash
npm run typecheck
```

---

## Full Local Setup

From repo root:

```bash
npm install
cd backend
npm install
npm run db:reset
npm run dev
```

In another terminal:

```bash
npm run dev
```

Open:

```txt
http://localhost:5173
```

---

## Demo Login

After running backend seed:

```txt
facilitator@stratis.dev / password123
participant@stratis.dev / password123
admin@stratis.dev / password123
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

Real env values must not be committed.

`.gitignore` ignores real env files:

```txt
.env
.env.*
**/.env
**/.env.*
```

But keeps templates:

```txt
.env.example
**/.env.example
```

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `NODE_ENV` | all | `development`, `staging`, or `production` |
| `PORT` | backend | Express port, default `3001` |
| `CLIENT_ORIGIN` | backend | Allowed CORS origin, default `http://localhost:5173` |
| `DATABASE_URL` | backend | SQLite DB path, default `file:./data/stratis.db` |
| `JWT_SECRET` | backend | JWT signing secret |
| `JWT_EXPIRES_IN` | backend | JWT lifetime, default `7d` |
| `AI_PROVIDER` | ai-service | `groq`, `ollama`, or `mock` |
| `AI_TIMEOUT_MS` | ai-service | AI request timeout, default `10000` |
| `GROQ_API_KEY` | ai-service | Groq API key |
| `GROQ_MODEL` | ai-service | Groq model, default `llama-3.3-70b-versatile` |
| `OLLAMA_BASE_URL` | ai-service | Ollama URL, default `http://localhost:11434` |
| `OLLAMA_MODEL` | ai-service | Ollama model, default `llama3.1` |
| `STT_PROVIDER` | backend | `deepgram` or `mock` |
| `STT_TIMEOUT_MS` | backend | STT timeout, default `15000` |
| `DEEPGRAM_API_KEY` | backend | Deepgram API key |
| `DEEPGRAM_MODEL` | backend | Deepgram model, default `nova-2` |

The app can run with no external keys:

- AI falls back to mock if Groq is selected but no key exists.
- STT can use mock mode.

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
GET    /api/meeting/upcoming
GET    /api/meeting/dashboard
POST   /api/meeting
GET    /api/meeting/:id
PATCH  /api/meeting/:id
DELETE /api/meeting/:id
```

### Session

```txt
GET  /api/session
GET  /api/session/active
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
```

Currently skeleton for later post-meeting summary generation.

---

## Live Meeting Flow

Text input flow:

```txt
Meeting.tsx
→ useAiBlocks.send()
→ POST /api/ai/structure
→ ai-service structuredCall()
→ parse + validate JSON
→ frontend renders valid blocks
```

Suggestion flow:

```txt
Meeting.tsx
→ POST /api/ai/suggest
→ AI returns QuestionSuggestion blocks
→ backend creates suggestion cards
→ WebSocket pushes to facilitator
→ SuggestionCardStack renders bottom-right cards
```

Audio flow:

```txt
Meeting.tsx
→ useMediaRecorder
→ POST /api/transcript/audio-chunk
→ backend STT
→ transcript saved
→ AI structured output
→ suggestion cards updated
```

---

## Realtime WebSocket

URL shape:

```txt
ws://localhost:3001/ws?token=<jwt>&sessionId=<sessionId>
```

Server events:

```ts
{ type: "connected", sessionId, role }
{ type: "suggestion:new", card }
{ type: "suggestion:answered", sessionId, cardId, source }
```

Rules:

- Only facilitator sockets receive suggestion events.
- Participants can connect but do not receive suggestion cards.
- Answered cards can be auto-detected or manually marked.

---

## Database

SQLite schema lives in:

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

Runtime DB files live in:

```txt
data/
```

These are ignored by Git.

---

## Important Frontend Files

```txt
src/App.tsx
src/context/AuthContext.tsx
src/pages/Meeting.tsx
src/hooks/useAiBlocks.ts
src/hooks/useSuggestionSocket.ts
src/hooks/useMediaRecorder.ts
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
backend/src/realtime/hub.ts
backend/src/realtime/suggestions.ts
backend/src/realtime/autodetect.ts
backend/src/db/schema.sql
backend/src/config/env.ts
```

---

## Development Notes

### AI output validation

AI output must be validated before frontend receives it.

Current validation path:

```txt
ai-service/src/schema.ts
backend/src/routes/ai.ts
backend/src/routes/transcript.ts
```

### QuestionSuggestion rule

`QuestionSuggestion` is not normal transcript content.

Correct route:

```txt
QuestionSuggestion
→ backend realtime suggestion store
→ WebSocket
→ SuggestionCardStack
```

Fallback only:

```txt
BlockRenderer
```

### Mock-heavy pages

Some pages still use mock data:

```txt
src/pages/Dashboard.tsx
src/pages/Projects.tsx
src/pages/StrategyMap.tsx
src/pages/Decisions.tsx
src/pages/InBox.tsx
src/pages/Documents.tsx
src/pages/SummaryView.tsx
```

Backend endpoints exist for some of these and should be wired in later tasks.

---

## Git Hygiene

Do not commit:

```txt
.env
.env.*
data/*.db
data/*.db-shm
data/*.db-wal
dist/
node_modules/
```

Safe to commit:

```txt
.env.example
schema/*.json
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

---