# 01 — Core product

The business side: what Stratis is, who buys it, and what we sell. Read this
before writing customer-facing copy or deciding whether a feature belongs.

---

## What it is

**Stratis is an AI Decision Facilitator.** It tracks the *quality of the
decision-making process* in real time. Not a chat, not a note taker.

The loop, in this order:

1. The team sets the **goal of the meeting** before it starts.
2. Stratis transcribes and continuously summarises the **state of the meeting**.
3. It checks whether the team is converging or drifting.
4. It evaluates whether the decision is **structurally complete**.
5. If an element is missing, it suggests the question that fills it — before the
   meeting closes.

**Hero feature: the end-of-meeting alignment checkpoint.** An n=18 survey showed
the demand is post-meeting alignment — what was decided, by whom, by when — not
missed-question suggestions. The live cards and the tree are plumbing. Lead with
the checkpoint.

## How to talk about it

- Say Stratis tracks **decision progress**. Never "the AI analyses every
  sentence" — that reads as a note taker.
- Lead with **value created**, not pain. Approved: *"we don't just help the team
  remember what was discussed — we help the team decide better while the meeting
  is happening."*
- Not a replacement for the human facilitator. Not a competitor to note takers.
  A **co-facilitator**.
- **Questions are convergent, never adversarial.** They pull the room toward
  shared understanding. Correct: *"Does the team have enough information to
  decide?"* Wrong: anything that challenges a participant.

## Differentiators

"We're the only ones live in the meeting" is **no longer true**. Lead with:

1. **Decision-process tracking** — knows which stage the decision is at and what
   is missing. Rivals capture the conversation; none score the decision.
2. **Reasoning memory** — the checkpoint and PM document preserve *why*, across
   meetings.
3. **Thai/local fit** — Thai-first STT, Thai-market pricing, built in Chiang Mai.

## The website and the desktop app

The website is the MVP. **Stratis Desktop** is where the product goes: a
from-scratch Windows app (C# .NET + Avalonia, its own repo `stratis-desktop`)
with the same Control Room theme and no shared frontend code. It exists for what
a browser cannot do — hear the online side of a meeting (computer audio,
labelled apart from the room microphone), keep an encrypted local backup, record
without internet, and sit over the meeting app as a mini-bar. It uses the same
backend and accounts; participants still join by code in the browser. This is
not a Zoom or Meet integration: nothing connects to their APIs.

Spec: `stratis-desktop/docs/specs/2026-09-11-desktop-app-design.md`.

## Market

Beachhead: SMEs, local startups and public-sector teams in **Northern Thailand**,
specifically Chiang Mai. They make real decisions in small weekly meetings with
no documentation infrastructure.

## Pricing and plan gating

Workspace-based subscription — one price for the team, no per-seat maths.

**Never quote a specific price externally.** Pricing is unvalidated. Say
"monthly/yearly workspace subscription". The plans page is a **wishlist**: Pro is
not on sale, the button adds interest so the team can email them later.

**One user.** A **facilitator** runs their own meetings. Everyone else arrives
with a code, the way they would join a Kahoot — no account, no adding people
one by one, nothing to manage before a meeting can run. There is no workspace
in the product: the organisation row survives as an invisible container so
queries stay scoped, and no screen names it. The Stratis team's own access is
an email allowlist, not a role. See `03-engineering.md`.

**Free is capped on recorded minutes and nothing else.** Seats, meetings a
month and a projects cap were three more numbers to explain for limits that no
longer mean anything; minutes is the one that tracks what a meeting costs to
serve, and it is counted from the same clock the meeting screen shows.

| Plan | Carries |
|---|---|
| **Free** | `live_suggestions`, `checkpoint`, `pm_document`, `session_invites`, `guest_access` |
| **Pro** | everything in Free, plus `transcript_export`, `custom_theme` |
| **Beta** | everything, internal, for invited beta workspaces |

The reasoning:

- **Free is generous on purpose.** It carries the product's point (the PM
  document) and the things that grow the room (invites, guests). The seat that
  starts the meeting is the one that pays; charging for the people they invite
  only makes the room smaller.
- **Pro sells taking the record out** (`transcript_export`) and cosmetics
  (`custom_theme`).
- **Light and dark are free on every plan.** `custom_theme` covers the workspace
  *colour* only — the eight accents and the custom picker. A theme is how a room
  is lit: a facilitator on a projector needs light, one in an evening meeting
  needs dark, and charging either of them for being able to read the screen sells
  nothing and reads as petty. The colour is the part that is decoration, so the
  colour is the part that is Pro.
- **Locked ≠ hidden.** Pro features render in full with a lock badge; pressing
  one explains what it is and links to the plans page. A customer has to see the
  product to want it. Use the `ProLock` component.

## What is deliberately not built

- **No email.** Nothing is ever sent to anyone. The summary is a document the PM
  exports and distributes. Do not reintroduce a "send to participants" flow.
- **No payment gateway.** An operator activates a plan by hand.
- Drift detection as a separate feature — dropped; it exists as a live card type.
- Owner accounts — decision owners are free text. Decided; do not relitigate.
- Zoom / Google Meet integration — not built.
- Structure tree — WIP, not part of the pitch.

## Team

| Member | Owns |
|---|---|
| Windsurf | Backend, AI pipeline, database, API, sessions, WebSocket |
| Nick | Frontend and all visual design |
| Owen | PM & QA, sprint planning, test plans, beta teams |

Product owner: Phuwich Khamteja.
