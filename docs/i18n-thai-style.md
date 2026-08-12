# Thai copy standard

The rule for every Thai string in `src/i18n/th.ts`. The goal is not literal
translation — it is that Stratis reads like a Thai SaaS product built for people
who run product, project and startup teams.

`docs/i18n-review-th.md` is the working file: every string side by side with its
Thai, where it appears, and the line to paste back. Edit there or edit `th.ts`
directly; this file is what "correct" means for both.

## What must not change

- **The English key is load-bearing.** Translation is DOM-based
  (`i18n/translateDom.ts`) and matches rendered English text against these keys.
  Change a key and the string silently stops translating.
- Placeholders, arrows, ellipses, symbols and formatting survive intact:
  `{n}` `→` `…` `✓` `—` `·` `#` `**bold**`.
- English source strings are never edited to suit a translation, even when the
  English is awkward.
- Never translate: Stratis · project and meeting names · people's names · dates ·
  Google · LINE · Notion · WebSocket · STT · PM · AI · PRO · Signal Matcha ·
  `en-US` / `th-TH` · any technical identifier.
- Never invent functionality the English does not claim, and never drop meaning
  to make a line shorter.

## Terminology

One English concept, one Thai term, everywhere.

| Concept | Thai |
|---|---|
| Meeting / Meetings | การประชุม |
| Facilitator | ผู้ดำเนินการประชุม |
| Facilitator-only | เฉพาะผู้ดำเนินการประชุม |
| AI facilitator / co-facilitator | AI ผู้ช่วยดำเนินการประชุม |
| Decision / Decisions | การตัดสินใจ |
| Decision text | ข้อความการตัดสินใจ |
| Checkpoint | จุดตรวจสอบ |
| Question | คำถาม |
| Open question | คำถามที่ยังค้างอยู่ |
| Assumption | ข้อสมมติ |
| Risk | ความเสี่ยง |
| Drift | ออกนอกประเด็น |
| Action item | งานที่ต้องทำ |
| Owner | ผู้รับผิดชอบ |
| Goal | เป้าหมาย |
| Agenda | วาระการประชุม |
| Project | โปรเจกต์ |
| Workspace | เวิร์กสเปซ |
| PM document | เอกสาร PM |
| Summary | สรุป |
| Transcript | บทถอดเสียง |
| Live transcript | บทถอดเสียงแบบเรียลไทม์ |
| Real-time | แบบเรียลไทม์ |
| Suggestion | ข้อเสนอ |
| Suggest | แนะนำ |
| Record | บันทึก |
| Review | ตรวจทาน |
| Dismiss | ปิด |
| Re-open | เปิดอีกครั้ง |
| Due date | กำหนดส่ง |
| Sign in / Sign out | เข้าสู่ระบบ / ออกจากระบบ |
| Guest | ผู้เยี่ยมชม |
| Dashboard | แดชบอร์ด |
| Settings | ตั้งค่า |
| Profile | โปรไฟล์ |
| Notification | การแจ้งเตือน |
| Account | บัญชี |
| Security | ความปลอดภัย |

Three of these carry weight beyond consistency:

- **Facilitator is always ผู้ดำเนินการประชุม** — never ผู้ดำเนินการ,
  ผู้จัดประชุม, ผู้ควบคุมการประชุม or ผู้ดูแลการประชุม.
- **Decision is การตัดสินใจ, never มติ** unless the English genuinely means a
  formal organisational resolution. "Decision meeting" is ประชุมเพื่อตัดสินใจ;
  "missing decision" is ยังไม่มีการตัดสินใจ.
- **Assumption is ข้อสมมติ, not ข้อสันนิษฐาน** — something the team is relying on
  without having validated it.
- **Open question is คำถามที่ยังค้างอยู่**, not the literal คำถามเปิด, which does
  not read as product UI in Thai.

## Voice

Professional, clear, concise, friendly without being casual — workplace
software for people who already read English tech vocabulary daily. Prefer
natural phrasing over formal or bureaucratic construction.

| Instead of | Write |
|---|---|
| ระบบจะดำเนินการทำการตรวจสอบบทสนทนา | กำลังตรวจสอบบทสนทนา |
| การประชุมนี้มิได้ก่อให้เกิดการเปลี่ยนแปลงต่อสถานะของโปรเจกต์ | การประชุมนี้ไม่ได้ทำให้สถานะของโปรเจกต์เปลี่ยนแปลง |
| โปรดทำการตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของท่าน | กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ |

Loanwords Thai teams already use are correct, not lazy: โปรเจกต์ เวิร์กสเปซ
เซสชัน รีเฟรช ซิงก์ แดชบอร์ด โปรไฟล์ อีเมล. Don't force a formal Thai
alternative to avoid them. Keep technical terms in English with Thai around
them — "Continuous STT Capture" is ถอดเสียงต่อเนื่อง, "WEBSOCKET SYNCED" is
ซิงก์ผ่าน WebSocket.

**Labels** stay short, use familiar UI vocabulary, and drop pronouns.
**Explanatory copy** reads as a whole Thai sentence and keeps the full meaning of
the English.

## Positioning

Stratis is an AI Decision Facilitator, not a transcription or note-taking tool
(see `docs/context/01-core-product.md`). Thai copy must not make it sound like a
meeting recorder, an AI notetaker, a chatbot or an automated secretary.

Lean on what the product actually claims: following the discussion, surfacing
unanswered questions, naming assumptions and risks, tracking decisions, helping
the facilitator, checking alignment, keeping the meeting on its goal.

## Before you call a string done

1. Would a Thai professional understand it immediately?
2. Does it read as a real product rather than machine translation?
3. Is it short enough for the control it sits in?
4. Does it carry the exact meaning of the English?
5. Is the terminology the same as everywhere else in the product?

If any answer is no, improve it. If all are yes, **leave it alone** — rewriting
an accurate, natural line is churn, and it costs a review pass to notice nothing
changed.
