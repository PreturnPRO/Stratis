# Launch Fixes (Aug 15) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the 15 defects found on stratis-beta.vercel.app on 2026-08-12 so the public site, the sign-in path, and the room-code flow are presentable on launch day.

**Architecture:** All frontend except one backend string. No new dependencies, no schema change, no new routes on the server. Work happens in five existing pages (`Landing`, `Login`, `Pricing`, `Room`, `App`), `index.html`, and one copy fix in `backend/src/lib/invites.ts`. Each task ends with a typecheck + build and a browser assertion run against the dev server.

**Tech Stack:** React 18 + Vite (no test runner on the frontend), TypeScript, Express + Postgres on the backend, `node --test` for backend suites.

## Global Constraints

- Branch: `main`. The repo was left on `Alpha`; check out `main` before starting.
- Verification for every task: `npx tsc --noEmit` at the repo root, `npm run build`, and for backend changes `npm --prefix backend run typecheck && npm --prefix backend test`.
- Frontend has no unit-test runner. Where behaviour is checkable in a browser, the step gives the exact JS assertion to run against `http://localhost:5173` and the exact expected value. Do not claim a UI fix works from a passing typecheck — the project's standing rule.
- Never introduce a hardcoded colour. Every colour comes from `useTheme()`; `COLORS` is the dark-palette constant and is banned outside `tokens/`.
- Do not quote ฿ prices anywhere in the product or on the marketing pages. Pricing is unvalidated.
- Copy style: sentence case, no exclamation marks, no "oops". An error tells the person what to do next.
- Commit per task, message in the repo's existing style (`fix(scope): …` / `feat(scope): …`), ending with the Co-Authored-By trailer.

---

### Task 1: Team cards — restore the photos, remove the personal contact details

The About-us section renders three empty coloured rectangles: `TeamCard` sets the `background` shorthand and then `backgroundImage`, and in the production build the shorthand wins, so the fetched photo is never painted. The same cards publish three personal Gmail addresses, three personal mobile numbers, and three LINE QR codes on a public page. Decision taken 2026-08-12: names and roles only.

**Files:**
- Modify: `src/pages/Landing.tsx:53-70` (the `TEAM` table), `src/pages/Landing.tsx:565-640` (`TeamCard`)
- Delete: `public/line-naphat.jpg`, `public/line-thananarin.jpg`, `public/line-phuwich.jpg`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `TEAM` entries narrow to `{ name: string; role: string; photo: string; photoZoom: number; photoPos: string }`. No later task reads them.

- [ ] **Step 1: Reproduce the empty box**

Start the dev server, open `http://localhost:5173`, scroll to About us, and run:

```js
[...document.querySelectorAll('div')]
  .filter(d => { const r = d.getBoundingClientRect(); return r.width > 250 && r.height > 250 && !d.children.length })
  .map(d => getComputedStyle(d).backgroundImage)
```

Expected now: `["none","none","none"]`. That is the bug.

- [ ] **Step 2: Replace the shorthand with the longhand**

In `TeamCard`, `background: colors.border` and `backgroundImage` cannot both be set — the shorthand resets the image. Change the one line:

```tsx
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.border,
          backgroundImage: `url('${person.photo}')`,
```

- [ ] **Step 3: Verify the photo paints**

Re-run the Step 1 snippet. Expected: three `url("https://i.ibb.co/…")` values, not `none`.

- [ ] **Step 4: Cut the contact fields from the data**

`TEAM` becomes, verbatim:

```tsx
const TEAM: {
  name: string
  role: string
  photo: string
  photoZoom: number
  photoPos: string
}[] = [
  { name: 'Naphat Nirunsitirut', role: 'Interface Designer', photo: 'https://i.ibb.co/9mvscLW2/image-1.jpg', photoZoom: 1.5, photoPos: '32.5% 25%' },
  { name: 'Thananarin Saisornthananant', role: 'Software Architect', photo: 'https://i.ibb.co/279tD5s4/FB-IMG-1783759688169.jpg', photoZoom: 1.5, photoPos: '55% 45%' },
  { name: 'Phuwich Khamteja', role: 'Project Lead', photo: 'https://i.ibb.co/DP8FSnzS/fqs-2569-01-14-144852-111.jpg', photoZoom: 2, photoPos: '75% 45%' },
]
```

- [ ] **Step 5: Cut the contact block from the card**

In `TeamCard`, delete the email line, the tel line, and the `<img>` that renders `person.lineQr`, leaving the STRATIS eyebrow, the name, and the role. Drop the now-unused `lineQr`/`lineQrSize` handling. The lower card keeps `minHeight: 200` — with the contact rows gone the three cards still line up.

- [ ] **Step 6: Delete the QR assets**

```bash
git rm public/line-naphat.jpg public/line-thananarin.jpg public/line-phuwich.jpg
```

- [ ] **Step 7: Verify nothing personal survives**

```js
['@gmail.com','+66'].map(s => document.body.innerText.includes(s))
```

Expected: `[false,false]`. Then `document.querySelectorAll('img').length` — expected `0` on the landing page.

- [ ] **Step 8: Typecheck, build, commit**

```bash
npx tsc --noEmit && npm run build
git add -A && git commit -m "fix(landing): paint the team photos, drop the personal contact details"
```

---

### Task 2: Head metadata — favicon, sharing card, per-route title

The tab shows Chrome's default globe (no `link[rel=icon]` at all), and pasting the URL into LINE or Facebook produces a bare link because there is no Open Graph block. There is no image asset to ship as `og:image`, so the card is text-only — `summary`, not `summary_large_image`.

**Files:**
- Modify: `index.html`
- Modify: `src/App.tsx` (title effect, near the `hashchange` effect around line 336)

**Interfaces:**
- Consumes: `PAGE_LABELS` and `entryRoute` from `AppShell`, already in scope.
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the head block**

Replace the contents of `<head>` in `index.html` with:

```html
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Stratis listens to your meetings, surfaces the questions nobody asked, and keeps the project's living PM document up to date." />
    <title>Stratis</title>

    <!-- Inline SVG so the tab has an icon without shipping a binary. -->
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%238FAE6D'/%3E%3Cpath d='M13 3 5.5 13.5H11l-1 7.5 8-11h-5.5z' fill='%23ffffff'/%3E%3C/svg%3E"
    />

    <!-- What LINE, Facebook and Slack read when the link is pasted. No image
         asset exists yet, so this is a text card on purpose. -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Stratis" />
    <meta property="og:title" content="Stratis — decide better while the meeting is still happening" />
    <meta property="og:description" content="Stratis listens to your meeting, tracks whether the decision is complete, and writes the record your team never has time to write." />
    <meta property="og:url" content="https://stratis-beta.vercel.app/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Stratis — decide better while the meeting is still happening" />
    <meta name="twitter:description" content="Stratis listens to your meeting, tracks whether the decision is complete, and writes the record your team never has time to write." />
```

- [ ] **Step 2: Give each route its own title**

In `AppShell`, beside the existing `hashchange` effect:

```tsx
  // The tab is a wayfinding surface once someone has three Stratis tabs open.
  useEffect(() => {
    const page = entryRoute.page || active;
    const label = PAGE_LABELS[page] ?? (page === "room" ? "Join a room" : page === "pricing" ? "Plans" : "");
    document.title = label ? `${label} · Stratis` : "Stratis";
  }, [entryRoute, active]);
```

- [ ] **Step 3: Verify**

```js
JSON.stringify({
  icon: !!document.querySelector('link[rel=icon]'),
  og: document.querySelectorAll('meta[property^="og:"]').length,
  title: document.title,
})
```

Expected: `icon: true`, `og: 6`. Navigate to `#/pricing`; expected `title: "Plans · Stratis"`.

- [ ] **Step 4: Typecheck, build, commit**

```bash
npx tsc --noEmit && npm run build
git add index.html src/App.tsx && git commit -m "feat(head): favicon, sharing card, and a title per route"
```

---

### Task 3: Sign-in — deep links, password managers, heading, copy

`#/login` renders the marketing page: the auth screens are `authPage` component state and `hashToEntry` only validates against `PAGE_LABELS`, so the hash is dropped. The form's inputs carry no `autocomplete` or `name`, so Chrome and 1Password neither fill nor offer to save. The screen has no `h1`. The submit button says "Enter Control Room", a phrase that appears nowhere else in the product.

**Files:**
- Modify: `src/App.tsx:200-222` (`hashToEntry`), `src/App.tsx:444-460` (`AppShell` state init), `src/App.tsx:565-590` (auth screen switch)
- Modify: `src/pages/Login.tsx:126-168`

**Interfaces:**
- Consumes: `AuthPage` type, already exported in `App.tsx`.
- Produces: `readAuthPageFromHash(): AuthPage | null` in `App.tsx`, used only inside `AppShell`.

- [ ] **Step 1: Reproduce**

Open `http://localhost:5173/#/login` in a fresh tab and run `document.querySelectorAll('input').length`. Expected now: `0` — the landing page rendered instead.

- [ ] **Step 2: Read the auth screen out of the hash**

Add beside `hashToEntry` in `App.tsx`:

```tsx
/**
 * `#/login` and `#/register` are not app pages — they are states of the
 * signed-out shell. Reading them here is what makes the two links someone
 * actually sends ("sign in here") land where they say they will.
 */
function readAuthPageFromHash(): AuthPage | null {
  const page = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return page === "login" || page === "register" ? page : null;
}
```

- [ ] **Step 3: Seed and sync the state**

In `AppShell`, change the initialiser and add the sync effect:

```tsx
  const [authPage, setAuthPage] = useState<AuthPage>(() => readAuthPageFromHash() ?? "landing");
```

```tsx
  // Back and forward have to move between the marketing page and the form,
  // and the hash has to survive a reload — both fail if this lives only in
  // component state.
  useEffect(() => {
    const onHashChange = () => setAuthPage(readAuthPageFromHash() ?? "landing");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (isAuthed) return;
    const wanted = authPage === "login" || authPage === "register" ? `#/${authPage}` : "#/";
    if (window.location.hash !== wanted && !entryRoute.page) {
      window.history.replaceState(null, "", wanted);
    }
  }, [authPage, isAuthed, entryRoute.page]);
```

- [ ] **Step 4: Verify the deep link**

Reload `http://localhost:5173/#/login`. Expected: `document.querySelectorAll('input').length === 2`. Click through to register; expected `location.hash === "#/register"`.

- [ ] **Step 5: Make the form autofillable and give it a heading**

In `Login.tsx`, add to the email input `name="email"` and `autoComplete="email"`; to the password input `name="password"` and `autoComplete="current-password"`. Above the form, add the heading the screen never had:

```tsx
        <h1 style={{ fontSize: FONT.size.h2, fontWeight: FONT.weight.bold, color: colors.text, margin: '0 0 6px' }}>
          Sign in
        </h1>
```

Change the submit label from `'Enter Control Room'` to `'Sign in'` and the busy label from `'Accessing...'` to `'Signing in…'`.

> If `Register.tsx` carries the same input pattern, give it `autoComplete="email"` and `autoComplete="new-password"` in the same commit.

- [ ] **Step 6: Verify**

```js
JSON.stringify([...document.querySelectorAll('input')].map(i => [i.name, i.autocomplete]))
```

Expected: `[["email","email"],["password","current-password"]]`, and `document.querySelectorAll('h1').length === 1`.

- [ ] **Step 7: Typecheck, build, commit**

```bash
npx tsc --noEmit && npm run build
git add src/App.tsx src/pages/Login.tsx src/pages/Register.tsx && git commit -m "fix(auth): deep-linkable sign-in, autofill, heading, plain copy"
```

---

### Task 4: Keep the expired-session error off the public pages

A visitor whose stored token has expired sees a red "Invalid or expired token" strip above the marketing hero before they have done anything. The boot check is right to end the session; the public pages are the wrong place to say so.

**Files:**
- Modify: `src/App.tsx:551-560` (the signed-out `SystemNotice`)

**Interfaces:**
- Consumes: `endedReason`, `clearEndedReason`, `oauthError` — already in `AppShell`.
- Produces: nothing.

- [ ] **Step 1: Reproduce**

```js
localStorage.setItem('stratis.auth.v1', JSON.stringify({ token: 'not-a-real-token' })); location.reload()
```

Expected: the red strip appears over the landing page.

- [ ] **Step 2: Show it only where it means something**

The notice belongs on the sign-in and register screens, where "sign in again" is an instruction the person can act on:

```tsx
        {/* An expired token is news on the sign-in screen and noise on the
            marketing page — the visitor there has not asked for a session. */}
        {(oauthError || (endedReason && authPage !== "landing")) && (
          <SystemNotice
            tone="danger"
            message={oauthError ?? endedReason?.message ?? ""}
            onDismiss={() => {
              setOauthError(null);
              clearEndedReason();
            }}
          />
        )}
```

- [ ] **Step 3: Verify both halves**

Repeat Step 1: expected no strip on the landing page. Then click Sign in: expected the strip appears above the form. An OAuth failure (`#/oauth?error=denied`) must still show it.

- [ ] **Step 4: Clean up and commit**

```js
localStorage.removeItem('stratis.auth.v1')
```

```bash
npx tsc --noEmit && npm run build
git add src/App.tsx && git commit -m "fix(shell): stop showing an expired-session error on the marketing page"
```

---

### Task 5: Room screen — the code field, the Join button, and the error copy

The code input's placeholder `ACDEF4` is centred and letter-spaced exactly like a real value, so it reads as prefilled. `Join` is a low-emphasis outline button while every other primary action in the product is solid. And a wrong code answers "This invite link is not valid" — the invite subsystem's wording on a screen where the person typed six characters off a whiteboard.

**Files:**
- Modify: `backend/src/lib/invites.ts:83`
- Modify: `src/pages/Room.tsx:210-285`

**Interfaces:**
- Consumes: `checkInvite`'s `{ ok: false; reason: string }` shape, unchanged.
- Produces: nothing.

- [ ] **Step 1: Fix the backend copy**

`invites.ts:83` becomes:

```ts
  if (!row) return { ok: false, reason: "That code does not match a meeting" };
```

- [ ] **Step 2: Backend gates**

```bash
npm --prefix backend run typecheck && npm --prefix backend test
```

Expected: typecheck clean, 151 tests passing.

- [ ] **Step 3: Make the placeholder look like a hint**

In `Room.tsx`, change the code input's placeholder from `"ACDEF4"` to `"6 characters"` and drop the centring/letter-spacing from the *placeholder* presentation by keeping the typed value styled and leaving the placeholder at normal tracking:

```tsx
            placeholder="6 characters"
```

- [ ] **Step 4: Promote the Join button**

The Join button becomes the screen's primary action:

```tsx
          <Button variant="primary" fullWidth type="submit" disabled={busy || !code.trim() || !name.trim()}>
            {busy ? "Joining…" : "Join"}
          </Button>
```

- [ ] **Step 5: Verify against the deployed backend**

With the dev server pointed at production (`VITE_API_BASE=https://stratis-9s5r.onrender.com`), enter code `ZZZZZZ` and any name. Expected message: "That code does not match a meeting". Expected network: `GET /api/room/ZZZZZZ` → 410.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit && npm run build
git add backend/src/lib/invites.ts src/pages/Room.tsx && git commit -m "fix(room): say code not link, and make Join the primary action"
```

---

### Task 6: Pricing card — the wishlist CTA and the list marks

Both plans carry an identical green "Get started" although the page says Pro is wishlist-only, so the button contradicts the paragraph above it. The two limit lines in each card ("5 meetings a month", "Up to 3 members") sit without the check mark every other line has, and the Free card leaves a hole above its button because the cards match height across 3 features and 7. Decision taken 2026-08-12: fix the CTA, publish no numbers.

**Files:**
- Modify: `src/pages/Pricing.tsx:120-160`

**Interfaces:**
- Consumes: `plan.id` from `/api/billing/plans`, values `"free" | "pro"`.
- Produces: nothing.

- [ ] **Step 1: Label the button for what it does**

The signed-out branch at `Pricing.tsx:141-144` gives both plans the same label. Pro is not purchasable, so its button must say so:

```tsx
                {!isAuthed ? (
                  <Button fullWidth variant="primary" onClick={() => onNav?.("dashboard")}>
                    {plan.id === "pro" ? "Join the wishlist" : "Get started"}
                  </Button>
                ) : isCurrent ? (
```

The signed-in branch already reads `Wishlist ${plan.name}` — change it to `Join the wishlist` so one phrase covers both states.

- [ ] **Step 2: Give the limit lines a mark of their own**

The two limit `<li>`s at `Pricing.tsx:115-122` are bare text while every feature line carries a `<Check>`, so the list reads as if it starts mid-way. Give the limits a neutral mark — not a check, because a cap is not a feature:

```tsx
                <li
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "flex-start",
                    fontSize: FONT.size.label,
                    color: colors.textMuted,
                  }}
                >
                  <Minus size={13} style={{ marginTop: 2, color: colors.textDim, flexShrink: 0 }} />
                  {plan.limits.meetingsPerMonth === null
                    ? "Unlimited meetings"
                    : `${plan.limits.meetingsPerMonth} meetings a month`}
                </li>
```

Apply the same wrapper to the seats line. Import `Minus` from `lucide-react` beside the existing `Check`.

- [ ] **Step 3: Verify**

At `#/pricing`:

```js
[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(t => t.includes('start') || t.includes('wishlist'))
```

Expected: `["Get started","Join the wishlist"]`. No `฿` anywhere: `document.body.innerText.includes('฿')` → `false`.

> **Not fixed here:** the empty space under the Free card's shorter list. The
> cards are a flex row with `marginTop: "auto"` on the button, so both buttons
> sit on the same baseline — standard behaviour for a plan comparison, and the
> alternative (cards of different heights) reads worse. Left alone deliberately.

- [ ] **Step 4: Typecheck, build, commit**

```bash
npx tsc --noEmit && npm run build
git add src/pages/Pricing.tsx && git commit -m "fix(pricing): name the wishlist action and even up the plan lists"
```

---

### Task 7: The landing's mislabelled button

> **The dark-mode header bleed was withdrawn on 2026-08-12 after testing.**
> Sampling `elementFromPoint` at four heights across five x positions and five
> scroll offsets on the deployed page returned an element inside `<nav>` every
> time, with `background-color: rgb(9, 9, 11)` and `z-index: 10` holding. The
> screenshot that showed text over the header was a frame captured mid-scroll.
> Nothing was changed.

Scrolling the landing in dark mode shows body text through the sticky nav, even though the nav sets `background: colors.bg` — something below it is painting into a higher stacking context. Separately, "In a meeting right now?" is itself the button, so a screen reader announces a question where the action is "Join with a room code".

**Files:**
- Modify: `src/pages/Landing.tsx:160-172` (nav), and the hero's room-code line (~line 300)

**Interfaces:** none.

- [ ] **Step 1: Find what paints over the nav**

Scroll the landing to the "Ready to see it in your next meeting?" band in dark mode and run:

```js
(() => { const nav = document.querySelector('nav'); const under = document.elementFromPoint(760, 20);
  return JSON.stringify({ navZ: getComputedStyle(nav).zIndex, navBg: getComputedStyle(nav).backgroundColor,
    hit: under?.tagName + '|' + (under?.textContent||'').trim().slice(0,30),
    hitZ: getComputedStyle(under).zIndex, parentTransform: getComputedStyle(under.parentElement).transform }) })()
```

The element returned by `elementFromPoint` at y=20 must be the nav or its child. If it is page content, the ancestor's `transform` or `opacity` is creating the stacking context that defeats `zIndex: 10`.

- [ ] **Step 2: Fix at the cause**

If the offender is a transformed ancestor, remove the transform from the scrolling section (it is decorative) or raise the nav out of the contest:

```tsx
          position: 'sticky',
          top: 0,
          zIndex: 100,
          isolation: 'isolate',
```

- [ ] **Step 3: Verify in both themes**

Re-run the Step 1 snippet in dark and in light. Expected in both: `hit` is `NAV` or a nav child.

- [ ] **Step 4: Name the button after its action**

At `Landing.tsx:370-386` the whole sentence is the `<button>` and the action is a
`<span>` inside it, so the accessible name is a question. Swap them: the sentence
becomes a `<p>` carrying the same inline styles the button had, and only the
action is focusable.

```tsx
          <p
            style={{
              margin: 0,
              fontSize: FONT.size.label,
              color: colors.textMuted,
              textAlign: 'left',
            }}
          >
            In a meeting right now?{' '}
            <button
              type="button"
              onClick={onJoinRoom}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                cursor: 'pointer',
                color: colors.accent,
                textDecoration: 'underline',
              }}
            >
              Join with a room code
            </button>
          </p>
```

Keep the surrounding `<div>` and the `onJoinRoom` prop as they are.

- [ ] **Step 5: Verify**

```js
[...document.querySelectorAll('button')].map(b => b.innerText.trim()).find(t => t.includes('room code'))
```

Expected: `"Join with a room code"`, and no button whose whole name is "In a meeting right now?".

- [ ] **Step 6: Typecheck, build, commit**

```bash
npx tsc --noEmit && npm run build
git add src/pages/Landing.tsx && git commit -m "fix(landing): keep the nav above the page and label the room-code action"
```

---

### Task 8: Ship it and check it in production

**Files:** none — this is the release.

- [ ] **Step 1: Push**

```bash
git push origin main
```

Watch the CI run (typecheck, backend tests, frontend build) go green before touching Vercel.

- [ ] **Step 2: Confirm the deploy carries the work**

```
https://stratis-9s5r.onrender.com/api/system/version
```

Expected: the short SHA of the last commit from Task 7.

- [ ] **Step 3: Walk the public site**

On `https://stratis-beta.vercel.app` confirm, in this order: tab shows the Stratis icon; the landing hero has no red strip; About us shows three photographs and no email, phone, or QR; `#/pricing` shows "Join the wishlist" on Pro; `#/login` opens the form directly; `#/room` with `ZZZZZZ` says "That code does not match a meeting".

- [ ] **Step 4: Sharing card**

Paste `https://stratis-beta.vercel.app` into a LINE chat with yourself. Expected: a card with the title and description, not a bare URL.

- [ ] **Step 5: Ask the dev who holds Render for one number**

Confirm the backend service is on a paid instance type. A free instance sleeps after ~15 minutes idle and the first request then takes 30–60 seconds — on launch day that is the first thing a visitor meets. Measured warm response today: 132 ms.

---

## Execution record — 2026-08-12

Tasks 1–7 are implemented and committed on `main` (`0a39095`, `017c5f9`,
`5b768d4`, `5ac5c7b`, `993079e`, `8366d14`). Verified against a production
build served by `vite preview`, not by typecheck:

- team photos survive two theme toggles (they did not before); no `@gmail.com`,
  no `+66`, zero `<img>` on the landing page
- favicon present, 5 `og:` + 3 `twitter:` tags, `document.title` is "Stratis"
  on the marketing page, "Plans · Stratis" and "Join a room · Stratis" on those
- `#/login` renders the form; inputs report `[["email","email"],
  ["password","current-password"]]`; one `h1`; the button says "Sign in"
- an expired session shows no banner on the landing page and does show one on
  the sign-in screen (driven by dispatching the real `stratis:session-ended`
  event, since the local preview has no backend)
- room code placeholder reads "6 characters", Join renders `rgb(102, 174, 50)`

Not verified locally: the pricing CTAs, because the plan cards come from
`/api/billing/plans` and no backend runs beside the preview. Check them on the
deployed site as part of Task 8.

Task 8 (push and production walk-through) is not done — the deploy is the
user's call.

## Not in this plan

- **Mobile layout.** Could not be verified on 2026-08-12 — the Chrome window would not relayout while minimised, so `innerWidth` stayed at desktop. Re-test with the window visible before launch; any fix belongs in its own plan.
- **Everything behind sign-in** — the authed header, checkpoint, and the room-reactions loop were not exercised in production.
- **PDPA / consent.** Handled outside the codebase; policy lands after the 15th. `consent_logs` still has no writer.
- **`document.documentElement.lang`.** Reported as a defect on first pass and it is not one: `useLang` already sets it, and the page read `en` because English was the selected language.
