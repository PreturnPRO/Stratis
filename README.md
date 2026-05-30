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

- Node.js 18+
- npm 9+ (or pnpm / yarn)

### Installation

```bash

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
# Output is in dist/
```

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