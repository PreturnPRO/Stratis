# 02 — UX / UI

Standing rules for anything with a screen in it. These are not suggestions; each
one is here because it had to be said more than once.

---

## Navigation

- **No dead ends.** Every screen has a way back and a way on.
- Public screens (landing, login, register, room, pricing) carry the shared
  **`BackLink`** — `position: fixed`, top-left of the viewport, never inside a
  card. One component, one position, every page.
- **The sidebar is navigation only.** Theme, language and every other preference
  live in **Settings → Preferences**. Nothing that is not a destination goes in
  the rail.
- Every route has a link into it. A route nothing links to is unfinished; a link
  to a route that does not exist is a bug.
- The signed-in shell owns the hash **only when signed in**. Public pages must
  not have `#/dashboard` written over them.
- `hashToEntry` validates against the known page list — an unknown hash resolves
  to the dashboard rather than becoming a phantom breadcrumb.

## Nothing half-wired

- A control must do something. A setting nothing reads, a button with no
  endpoint, a table nothing fills — **finish it or delete it**.
- Storing a preference nothing consumes is a promise the product does not keep.
- If a feature exists on one side only, say so and propose cut-or-build. Never
  ship the half and call it done.
- A locked Pro feature must work the moment it is unlocked. A showroom that does
  nothing when bought is the same defect wearing a badge.

## Loading

- **Structure never waits on the server.** Shell, nav, tabs, card titles, field
  labels and static copy are in the code — they render immediately. Only
  *values* wait.
- **No page-level gate.** `if (!data) return <Loading/>` at the top of a page is
  banned. Skeletons go inside the slot that is loading.
- Fields render disabled-but-present rather than absent. Use `…` while loading
  and `—` once known-failed, so waiting and failed do not look the same.
- Late-arriving data may hydrate a form once, and never over a field the person
  has already started editing.

## Failure

- **Failures surface at the action, not on arrival.** A failed background load is
  not announced. The page renders normally; when a button that needs the server
  is pressed, warn *then*.
- Keep the load error and the action error in **separate variables**. One slot
  fed by both paints a red banner nobody asked for.
- **Never show a raw `Failed to fetch`.** `lib/http.ts` converts a network
  failure into `ApiError(status 0, "Could not reach Stratis…")`.
- **Empty states must not lie.** "No meetings yet" and "could not be loaded" are
  different claims. Never tell a team with data that they have none.
- Every message says the data is *safe* and the *screen* failed. On a
  cold-starting backend that difference is the whole customer experience.

## Language

- **Thai is first-class.** The language is chosen **before** the app is used —
  `LanguageGate` renders ahead of every route on a first visit, with ไทย and
  English at equal weight and no default nudged.
- Absent storage means "not asked yet", not "English".
- **Untranslated strings in Thai mode are defects.** New user-facing copy ships
  with its `src/i18n/th.ts` entry in the same change.
- Deliberate exceptions (team job titles, the hero headline) are recorded as
  comments in `th.ts` so nobody "fixes" them again.
- Translation is DOM-based (`i18n/translateDom.ts`) — no `t()` calls in
  components. Keys are whole text nodes.

## Theme and colour

- **Light is the default**, in the hook *and* as the base `body` rule in
  `index.css`. `ThemeProvider` sets `data-theme` in an effect, after first paint,
  so whichever theme is in the base rule is what a new visitor sees for a frame.
- Accent presets are **one vivid hue each**. Readability is derived by
  `adaptAccent`, which clamps lightness per theme and floors saturation.
  Hand-picking a "safe" value per theme produces mud.
- Swatches show the colour **as it will be applied** on the current theme, not
  the raw hue.

## Visual system

The "Control Room" system: Signal Matcha accent, mono for data, generous
negative space. Status is carried by a **left edge**, not only a badge — a list
is read by scanning down the margin. A number that matters gets a shape (a bar,
a ring) as well as a value.
