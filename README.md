## Features

| Screen | Description |
|---|---|
| **Projects** | Grid overview of all active strategy projects |
| **Strategy Map** | Draggable node canvas with bezier arrows and canvas panning |
| **Meeting** | Live transcript view with participant sidebar and captured signals |
| **Decisions** | Accordion list of open decisions with status filters |
| **Signals Inbox** | Feed of signals from Slack, Notion, Jira, Calendar, and AI |
| **Settings** | Integration manager + Pebble hardware device status |

**Meeting transition** — clicking the Meeting icon triggers a cinematic animation: two "MEETING" words slide in from opposite sides, shift from white → amber, then fade out to reveal the meeting screen.

**Draggable map** — every node on the strategy map can be freely dragged. The canvas itself can be panned by clicking and dragging the background. Bezier arrows update in real time as nodes move. A "Reset" button restores the default layout.

---

## Project Structure

```
Stratis-app/
├── index.html                  # HTML entry point
├── vite.config.js              # Vite + React plugin config
├── package.json
└── src/
    ├── main.jsx                # ReactDOM render entry
    ├── App.jsx                 # Root layout: Sidebar + page router + meeting transition
    ├── index.css               # Global reset + scrollbar styling
    │
    ├── constants/
    │   └── index.js            # COLORS, NAV_ITEMS, INITIAL_NODES, ARROWS,
    │                           # PROJECTS, MEETING_MESSAGES, DECISIONS, SIGNALS
    │
    ├── hooks/
    │   └── useDraggableNodes.js  # Node drag + canvas pan logic
    │
    ├── components/
    │   ├── ui.jsx              # Shared: btnAccent, btnGhost, Avatar, Badge, tagStyle
    │   ├── Sidebar.jsx         # Left navigation rail with badges and active state
    │   └── MeetingTransition.jsx  # Animated intro screen for Meeting nav
    │
    └── pages/
        ├── Projects.jsx        # All projects grid
        ├── StrategyMap.jsx     # Draggable canvas with SVG arrows
        ├── Meeting.jsx         # Transcript + sidebar
        ├── Decisions.jsx       # Accordion decisions list
        ├── Inbox.jsx           # Signals feed
        └── Settings.jsx        # Integrations + Pebble device
```

---

## Getting Started

### Prerequisites

- **Node.js 22.5+** — the backend uses the built-in `node:sqlite` driver, available from 22.5.
- npm 9+ (or pnpm / yarn)

### Installation

```bash
# Frontend (root) deps
npm install

# Backend deps
npm --prefix backend install
```

### Environment setup

```bash
# Create your local dev env from the template, then fill in values
cp .env.example .env
```

The same template covers every environment — copy it to `.env.staging` or
`.env.production` and override the values per environment. The backend loads
`.env.<NODE_ENV>` first, then falls back to `.env`. Real values are **never**
committed: `.gitignore` ignores all `.env*` files except `.env.example`.

### Run

```bash
# Backend API (http://localhost:3001)
npm --prefix backend run dev

# Frontend dev server (http://localhost:5173) — proxies /api to the backend
npm run dev
```

First run only — create and seed the local database:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

### Build for production

```bash
npm run build   # frontend → dist/
```

---

## Environment Variables

All keys are defined in [`.env.example`](./.env.example). The app runs with **no
keys set** — AI falls back to a deterministic offline mock and voice falls back
to the browser Web Speech API.

| Variable | Used by | Description |
|---|---|---|
| `NODE_ENV` | all | `development` \| `staging` \| `production`. Selects which `.env.<NODE_ENV>` loads. |
| `PORT` | backend | Express port (default `3001`). |
| `CLIENT_ORIGIN` | backend | Allowed CORS origin (default `http://localhost:5173`). |
| `DATABASE_URL` | backend | SQLite file path (default `file:./data/stratis.db`). |
| `JWT_SECRET` | backend | Secret for signing JWTs. **Set a long random value in staging/prod.** |
| `JWT_EXPIRES_IN` | backend | Token lifetime (default `7d`). |
| `AI_PROVIDER` | ai-service | `groq` \| `ollama` \| `mock`. Falls back to `mock` if `groq` has no key. |
| `GROQ_API_KEY` | ai-service | Key for hosted Llama 3.3 70B (free at console.groq.com). |
| `GROQ_MODEL` | ai-service | Groq model id (default `llama-3.3-70b-versatile`). |
| `OLLAMA_BASE_URL` | ai-service | Local Ollama endpoint (default `http://localhost:11434`). |
| `OLLAMA_MODEL` | ai-service | Local model name (default `llama3.1`). |
| `AI_TIMEOUT_MS` | ai-service | Provider request timeout (default `10000`). |

> Never commit real secrets. Only `.env.example` is tracked; every other
> `.env*` file is gitignored.

---

## Using the Strategy Map

| Action | How |
|---|---|
| **Drag a node** | Click and hold a node card, then drag |
| **Pan the canvas** | Click and hold on the background (empty space), then drag |
| **Reset layout** | Click the **⊕ Reset** button in the top-right |

Arrows are drawn as smooth bezier curves that exit the right edge of the source node and enter the left edge of the target. They update live as nodes are moved.

---

## Architecture Notes

### State management
All state is local React (`useState`). No Redux or Zustand — the app is small enough that prop drilling is minimal and context was not needed.

### Dragging system (`useDraggableNodes.js`)
The hook stores node positions in state and uses `window` mouse event listeners (rather than React synthetic events) so that fast drags don't lose tracking when the cursor leaves the element. Two separate refs track the active drag target and the canvas pan start point.

### Data
All mock data lives in `src/constants/index.js`. To wire up a real backend, replace the constant arrays with API calls and lift state up to `App.jsx` or a context provider.

### Styling
Pure inline styles with a shared `COLORS` token object. No CSS-in-JS library, no Tailwind — intentional to keep the dependency footprint minimal and make the design tokens easy to audit in one place.

---

## Customisation

**Change the color scheme** — edit `COLORS` in `src/constants/index.js`.

**Add a new nav item** — add an entry to `NAV_ITEMS` in constants, create a new page in `src/pages/`, and add a case to the `renderPage` switch in `App.jsx`.

**Add a map node** — add an entry to `INITIAL_NODES` and, if connected, an entry to `ARROWS` in constants. Both use the node `id` string to reference each other.

---