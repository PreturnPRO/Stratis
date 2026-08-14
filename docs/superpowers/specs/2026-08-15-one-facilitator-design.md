# One facilitator, guests by code, and an operator console

Design, 2026-08-15. Approved in conversation before writing.

Stratis has been carrying a workspace: members, invite-a-teammate, seats, team
analytics. None of it serves the product. One person runs the meeting; everyone
else arrives with a code the way they would join a Kahoot, sees the transcript,
and corrects what concerns them. This removes the rest and fixes the five
defects that made the meeting screen itself unreliable.

---

## 1. The model

**One role.** `Role` becomes `"facilitator"` and nothing else. Signup stops
accepting a role. `participant` disappears as an account: the only participants
are guests, which is already what `session_guests` is — no org, no role, and a
token scoped to one session that dies with it.

**Organizations stay, invisibly.** The row remains, one per account,
auto-created at signup with no name asked for and none displayed. Every query
keeps its `org_id` scoping, so nothing about meeting isolation is rewritten.
This is the whole reason the change is safe to make in days rather than weeks:
the security-critical part of the schema does not move.

**Joining is the Kahoot flow.** A code, a display name, in. Nobody is added to
anything, and there is no list of people to maintain before a meeting can run.

### Deleted, not hidden

| Surface | Why it goes |
|---|---|
| Settings → Workspace (Members, Invites, team usage) | The workspace is not a thing the user has |
| Daily-active-members, team metrics | Analytics about a team of one |
| Workspace rename | Nothing displays the name |
| Seats limit | No seats to sell |
| `/admin/users*`, `/admin/workspace`, `/admin/metrics` | Backend half of the above |
| Workspace-kind invites (`invites.kind = 'workspace'`) | Teammates are the thing being removed |

Session invites and room codes **stay**. They are how a guest gets in.

Existing workspaces with more than one member: the extra accounts keep working
and keep their own meetings. Nothing is deleted from the database — the screens
that managed them are what go.

---

## 2. The five defects

### 2.1 The meeting code is invisible

The code renders only inside `CheckpointPanel`, and only after `openRoom()` is
pressed — three call sites, all of them behind a panel most meetings never open.

It moves to the meeting header: always present while a session is live, in mono,
with a copy button. The code is ensured when the session starts rather than on
demand, so it is there before anyone asks for it.

### 2.2 The clock is local and restarts

`startMs` is read from `recovery.session.started_at`, which is NULL until the
session starts, and falls back to `Date.now()` — so the timer restarts on every
refresh and every navigation.

**The clock is the session's, not the browser's.** Elapsed is
`now − started_at`, where `started_at` comes from the server and `now` is
corrected by a server-time offset captured when the page loads. It ticks locally
between syncs and re-syncs on window focus and on each recovery poll. Disconnect
for five minutes without ending the session and it reads five minutes further
on, because the session never stopped.

**The displayed clock and the deducted minutes are the same formula.**
`entitlements.ts` already computes usage as
`COALESCE(ended_at, NOW()) − started_at`, server-side, running while nobody is
watching. The display is being corrected to agree with the biller, not the other
way round, and a test holds the two together.

The idle sweeper's rule is unchanged: an *abandoned* session still ends at the
last moment audio arrived. A facilitator who kept the meeting open is a
different case from one whose laptop closed, and only the second is silence
nobody asked to be billed for.

### 2.3 A duplicate project name fails silently

The server already de-duplicates the slug, so the failure the user sees is an
error the client discards. The create path surfaces the server's message at the
button that caused it, and the server returns a message that names the actual
conflict rather than a generic 500.

### 2.4 The operator console is unreachable

`PLATFORM_ADMIN_EMAILS` is read by `requirePlatformAdmin` and appears in no
`.env.example` — documented in the context library and nowhere a deploy picks it
up.

It gets an entry in `backend/.env.example`, a line in the deploy notes, and a
`GET /api/admin/whoami` that answers whether the calling account is recognised,
so the answer to "am I an operator" is one request rather than a guess.

**Auth: the normal login.** The console is gated by the allowlist, resolved from
the database row behind the token. A second credential store for one person
would be more attack surface, not less, and less hardened than the login already
in use. Issuing and withdrawing grants is logged with the operator's user id.
The property worth protecting — that the console cannot open anybody's meeting —
comes from the route guards and holds regardless of how the operator signs in.

### 2.5 The facilitator cannot see who joined

`POST /room/:code/join` writes a guest row and a redemption but **no
`session_participants` row**; only the invite-link path records presence. So
there is nothing to read, and the usage rollup's participant count is low for
the same reason.

Every join records presence, code-joined included, with `last_seen_at` refreshed
by the guest's existing checkpoint poll. The meeting header shows a live count;
the roster lists the names, with anyone unseen for two minutes shown as away
rather than removed — a guest on a phone that slept has not left the meeting.

---

## 3. Plans

Free is capped on **recorded minutes a month** and nothing else. Pro is more
minutes plus transcript export and the workspace colour.

`seats`, `meetingsPerMonth` and `projects` are removed from `PlanLimits`, from
enforcement, and from the pricing page. Minutes come from the universal clock in
§2.2, so the number on the meeting screen and the number deducted cannot
disagree.

Prices are never quoted: "monthly/yearly subscription", per the standing rule.

---

## 4. Settings

Profile · Preferences · Plan & usage · Security.

Plan & usage shows minutes used against the limit, and the plan. Nothing else.

---

## 5. The operator console

Three screens, all read-only except the codes.

**Usage** reads `session_rollups` — one row written when a meeting ends, so an
operator refreshing during a launch cannot compete with the database work of the
meetings being recorded. Numbers move when a meeting *finishes*.

**Every chart is labelled.** A bar, a segment or a band carries its own number,
printed on or beside it — no colour-only encoding, no reading values off an
axis, and no legend that has to be matched back to a shape. Every figure comes
from the database; nothing on this console is generated, sampled or estimated.
Where a number is zero it is printed as zero rather than omitted, and where data
has not arrived the cell says so instead of showing an empty bar.

Charts to build:

| Chart | Data |
|---|---|
| Meetings per day, last 30 days | `session_rollups` grouped by day, each bar labelled with its count |
| Minutes recorded per day | same grouping, summed minutes, each bar labelled |
| Per workspace | rows: meetings, minutes, decisions, last met — figures, not bars |

**Beta codes** — create, see which email redeemed each, revoke the code, or
withdraw one workspace's grant. Already built; unchanged by this design.

**Feedback** — unchanged.

---

## 6. Proof

The standing verification stays: `tsc --noEmit`, `npm run build`,
`npm --prefix backend run typecheck`, `npm --prefix backend test`.

Three new mechanical checks, in the style the repo already uses for classes of
defect that typecheck clean:

1. **`roleSurface.test.ts`** — fails if `Role` gains a second member, or if any
   route guard names a role other than facilitator.
2. **`meetingClock.test.ts`** — fails if the elapsed-time formula used by the
   screen and the minutes formula used by `entitlements.ts` stop agreeing.
3. **`presence.test.ts`** — fails if a join path writes a guest without writing
   presence.

What cannot be proven here, and will be said plainly rather than implied: none
of this has run against a live Postgres in this environment, and the guest flow
has no coverage in the dev mock. Browser verification is structural — read the
DOM, not a screenshot, per `04-environment.md`.

---

## 7. Order of work

1. Role collapse to one, signup stops asking, invisible org.
2. Delete the workspace surfaces, front and back.
3. Clock: server-authoritative, agreeing with the biller.
4. Meeting code in the header; presence recorded on every join; roster.
5. Duplicate-project error surfaced at the action.
6. Plans reduced to minutes.
7. Operator console: env documented, `whoami`, labelled charts.

Steps 1 and 2 are one migration and touch the most files; everything after is
independent of everything else, so a failure late does not strand the earlier
work.

---

## 8. Out of scope

- Ripping `organizations` out of the schema. The row stays; only its screens go.
- A second login for operators. §2.4.
- Deleting existing multi-member workspaces' accounts.
- Participant accounts of any kind.
