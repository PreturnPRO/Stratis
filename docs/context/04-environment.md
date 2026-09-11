# 04 — Environment and tooling

How to run things here, and **what does not work**. Check the log before
debugging a failing command — it has probably already been paid for once.

---

## Layout

- Repo: `C:\Users\DMAX2\Downloads\AI PROJECT\Stratis`
- Frontend at the root, backend in `backend/`, shared types in `shared/`,
  AI providers in `ai-service/`.
- Deployed: frontend → Vercel (`stratis-beta.vercel.app`), backend → Render
  (`stratis-9s5r.onrender.com`), database → Supabase.
- **Branches:** `main` is what deploys. `Alpha` is behind it. Check which branch
  is checked out before assuming the working tree matches production.

## Backups

```bash
npm --prefix backend run db:backup            # writes backend/backups/stratis-<stamp>.ndjson.gz
npm --prefix backend run db:restore -- <file> # replays it into DATABASE_URL
```

- Logical export, written by Node, not `pg_dump` — neither the Windows laptop
  nor the Render container has Postgres client binaries, and a backup that needs
  someone to install something is a backup that will not exist on the day it is
  needed.
- Rows only. `schema.sql` rebuilds structure; `db:restore` applies it first, then
  replays rows parent-first with `ON CONFLICT DO NOTHING`, so a partial restore
  can be repeated safely.
- Keeps the last 7 locally, and **exits non-zero on an empty backup** — a file
  with no rows is the failure that looks like success.
- `backups/` is gitignored. These are real customer rows.
- **This is the copy you can hold, not the copy you cannot lose.** A file on a
  laptop is one accident away from the accident it protects against. Confirm the
  hosted database's own point-in-time recovery is on as well; the free Supabase
  tier does not have it.
- Verified 2026-08-14 against the live database: 2291 rows across 24 tables,
  read back with zero unparseable lines. `db:restore` refuses a non-local target
  unless `I_UNDERSTAND_THIS_WRITES_OVER_DATA=yes`.


## Running it

```bash
npm run dev                       # frontend, port 5173
npm --prefix backend run dev      # backend, needs .env + Postgres
npm --prefix backend run db:migrate
```

**Dev mock** — the frontend runs with no backend at all:

| Flag | Effect |
|---|---|
| `?mock=1` / `?mock=0` | fake API, signed in as Dana Reviewer (sticks) |
| `?as=admin` | mocked role becomes admin, for the Admin panel |
| `?plan=pro` | mocked workspace is Pro, for the unlocked side of `ProLock` |
| `?fail=1` | every API call rejects, for offline behaviour |

All dev-only, gated behind `import.meta.env.DEV`.

---

## Commands and tools that do not work here

> Format: **`what failed`** — **use instead:** `what works` — **why:** the actual
> mechanism.

**`getComputedStyle(el)` for verifying a UI change** — use instead:
`el.getAttribute("style")` — why: the browser pane is frequently hidden and not
compositing. A page that is not painted does not run style recalculation, so
`getComputedStyle` returns the *last* computed value and lags React by one
change. It looks exactly like a repaint bug and is not one. The inline `style`
attribute is what React actually wrote and is always current. This cost a full
round of false bug reports.

**`computer{action:"screenshot"}` on the preview pane** — use instead:
`read_page`, `get_page_text`, or `javascript_tool` reading the DOM — why: same
cause. "The Browser pane is not displayed, so the page is not compositing
frames" and the capture times out. Verify structurally; ask the human for visual
judgement.

**`requestAnimationFrame` inside `javascript_tool`** — use instead: a plain
`setTimeout`, or read the DOM synchronously — why: rAF never fires in a
non-compositing page, so the call hangs until the 30s tool timeout.

**Reading state immediately after a synthetic `.click()`** — use instead: await
a short `setTimeout` **and** read the inline style attribute — why: React
batches; the same JS turn sees the pre-update DOM. Combined with the stale
`getComputedStyle` above this produces very convincing phantom bugs.

**`vite --root <dir>`** — use instead: pass the directory as a positional,
`node <path>/vite/bin/vite.js <projectDir> --port 5173` — why: the Vite CLI takes
root as a positional argument; `--root` raises `CACError: Unknown option`.

**`preview_start` finding `.claude/launch.json`** — use instead: create the
launch file in the **current working directory**, not the project directory —
why: it resolves relative to cwd, which in this setup is not the Stratis repo.

**`mcp__claude-in-chrome__*`** — use instead: the in-app browser
(`mcp__Claude_Browser__*`) — why: the Chrome extension is not connected in this
environment.

**Python heredocs matching multi-line source exactly** — use instead: anchor on a
short unique substring, and `assert s.count(old) == 1` before replacing — why:
the repo has mixed CRLF/LF line endings, so a multi-line match silently finds
zero occurrences and the write is skipped. Always assert the count.

**`Edit` after a script rewrote the file** — use instead: `Read` it again first —
why: the harness tracks file state and refuses an edit against a stale read.

**Running Google STT locally with the `.env` credential path** — use instead:
`GOOGLE_APPLICATION_CREDENTIALS="$(cd .. && pwd -W)/STT-service.key.json" npx tsx <script>`
from `backend/` — why: the `.env` value points at a drive that does not exist on
this laptop, and dotenv never overrides a variable that is already set, so the
inline value wins. `pwd -W` gives Git Bash a Windows path, which Node needs.
