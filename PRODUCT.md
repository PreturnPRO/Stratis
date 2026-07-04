# Product

## Register

product

## Users

Primary: **Facilitators** running live team meetings — they watch a live transcript, receive facilitator-only AI suggestion cards during the meeting, and review/commit AI-proposed PM-document patches after it ends. This is the core power-user workflow and the default lens for design decisions.

Secondary: **Participants**, who join meetings and receive post-meeting summaries with lighter-weight needs. **Admins** manage organizations/users, outside the live meeting flow.

## Product Purpose

Stratis is an AI co-facilitator for team meetings. It listens during meetings, captures transcript chunks, surfaces facilitator-only suggestion cards in real time, and generates post-meeting summaries plus change-based PM-document updates. The strategy/tree record is the historical retrieval layer. Success looks like a facilitator running a meeting with less cognitive overhead — the tool surfaces the right prompt or gap at the right moment without becoming a distraction.

## Brand Personality

Focused and professional. Calm, competent, gets-out-of-the-way — confidence without flash. Copy and motion should support a live, in-progress meeting: quick to parse, not showy. Existing token comment already captures the intended visual direction: "dark, depth-aware surfaces with a refined amber accent."

## Anti-references

Avoid generic SaaS-dashboard cliché (hero-metric tiles, gradient text, tiny uppercase eyebrows on every section, identical icon-card grids). Avoid anything that reads as a marketing/campaign surface bleeding into the app shell — the product pages are a working tool used mid-meeting, not a pitch.

## Design Principles

- Facilitator-first: every live-meeting surface optimizes for a person mid-conversation, not a person evaluating the product.
- Suggestions augment, never interrupt: live AI cards must stay peripheral (facilitator-only, bottom-of-stack) rather than blocking the transcript or forcing action.
- Change is visible, not silent: PM-document updates are patch-based and reviewable, never silent full rewrites — the UI should always show what changed before it's committed.
- Calm dark surface, one accent: the existing amber-on-near-black palette carries the brand; new UI should extend it rather than introduce competing color language.
- Real-time trust: live/session state (recording, connection, suggestion delivery) must always be legible at a glance — silent failure is worse than a visible error.

## Accessibility & Inclusion

Standard WCAG AA baseline: body text ≥4.5:1 contrast, large text ≥3:1, full keyboard navigation, and `prefers-reduced-motion` alternatives for all motion/animation.
