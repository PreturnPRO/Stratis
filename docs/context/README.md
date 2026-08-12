# Stratis context library

Everything an agent needs to work on Stratis without re-deriving it, and without
the human repeating themselves. **Read the file that matches what you are about
to touch. Read `02` and `03` before writing any code.**

| File | What is in it | Read it when |
|---|---|---|
| [`01-core-product.md`](01-core-product.md) | What Stratis is, who it is for, positioning, pricing, plan gating, team | Anything customer-facing: copy, pitch, packaging, deciding if a feature belongs |
| [`02-ux-ui.md`](02-ux-ui.md) | Navigation, loading and failure behaviour, language, visual system | Any change with a screen in it |
| [`03-engineering.md`](03-engineering.md) | Architecture, conventions, security posture, verification standard | Any code change |
| [`04-environment.md`](04-environment.md) | How to run things, **commands that do not work and what to use instead** | Before running an unfamiliar command; whenever one fails |
| [`05-corrections.md`](05-corrections.md) | Corrections the human has made, dated, with what changed | Start of a session; before repeating a past approach |
| [`../DECISIONS.md`](../DECISIONS.md) | Long-form reasoning behind non-obvious code | When code looks wrong and you are tempted to "simplify" it |

---

## The update protocol

**This library is only worth having if it is current. Updating it is part of the
work, not an afterthought.**

After a change is made **and the human has approved it**, update this library in
the same session:

1. **A correction** — the human told you an approach, wording, or assumption was
   wrong → add a dated entry to `05-corrections.md`, and change the rule it
   contradicts in `01`–`04` so the wrong version is gone, not merely annotated.
2. **A new standing rule** — "always do X", "never put Y there" → add it to the
   matching category file. One rule, one place. Do not restate it in three files.
3. **A tool or command that failed** → log it in `04-environment.md` in the
   required shape:

   > `<command that failed>` — **use instead:** `<the one that works>` —
   > **why:** `<the actual mechanism, not "it errored">`

   This applies to shell commands, build steps, MCP tools, and verification
   methods that gave a wrong answer.
4. **A product decision** — something cut, kept, gated, repriced → `01`, and a
   dated line in `05`.

### Rules for writing entries

- **State the rule, then the reason.** A rule without its reason gets
  "optimised" away by the next agent.
- **Replace, do not append.** If a rule changed, edit it. A file that
  contradicts itself is worse than no file.
- **Dated entries in `05` only.** The category files describe the world as it is
  now, with no history in them.
- **Be specific enough to act on.** "Improve error handling" is not a rule.
  "Never show a raw `Failed to fetch`; `lib/http.ts` converts it" is.

### When not to write

Do not record what the code already says, what git history already shows, or
anything true for only one task. This is a library of things that are expensive
to re-derive — not a changelog.
