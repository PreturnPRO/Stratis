# 15-minute live test script

For the first real meeting on the deployed build. You speak, Stratis listens, and
afterwards we read what it understood.

**Meeting goal to set when you create it:**
> ตัดสินใจว่าจะเปิดตัว Stratis แบบไหนในวันที่ 15 และใครรับผิดชอบอะไร

Set the length to **15 minutes** so the pacing chip has something to work
against. Speak normally — do not read faster or more clearly than you would in a
real meeting, or the test proves nothing about real meetings.

---

## What each part is testing

| Minute | You say | What it should produce |
|---|---|---|
| 0–3 | Opening + context | Rolling notes start; no cards yet |
| 3–6 | A decision with no owner | Checkpoint: decision, **missing owner** |
| 6–9 | An untested assumption | Question card: has anyone validated this |
| 9–11 | A deliberate detour | Drift, or at least no false decision |
| 11–13 | A decision, fully specified | Checkpoint: complete — owner + date |
| 13–15 | Close | Summary with 3 decisions, 1 open question |

Say the **owner names and dates out loud** — that is what completeness is scored
on. If you never say a name, an incomplete decision is correct behaviour, not a
miss.

---

## 0:00 — Opening (about 90 seconds)

> เริ่มประชุมนะครับ วันนี้เรามีเรื่องต้องตัดสินใจสามเรื่องก่อนเปิดตัววันที่ 15
> เรื่องแรกคือ pricing tier ที่จะเปิดให้ใช้ตอน launch
> เรื่องที่สองคือใครดูแล onboarding ของทีมเบต้า
> เรื่องที่สามคือเราจะรับ feedback จากผู้ใช้ทางไหน

*Watch:* the notes ribbon should start filling. No suggestion cards yet — three
topics named is context, not a decision.

## 1:30 — Context, code-switching on purpose

> ตอนนี้ Free tier ให้ 30 นาทีต่อเดือน ส่วน Pro เป็น unlimited meeting
> แต่ limit ที่ projects ไว้ที่ 10 projects
> เราคิดว่า SME ในเชียงใหม่น่าจะเริ่มจาก Free ก่อน แล้วค่อย upgrade

*Watch:* Thai and English in one sentence — this is the Chirp 2 code-switching
test. Check the transcript keeps "Free tier", "unlimited meeting", "projects",
"upgrade" in English rather than transliterating them.

## 3:00 — A decision with no owner (deliberate)

> ตกลงว่าเราจะเปิดตัวด้วย Free tier ที่ 30 นาทีต่อเดือนนะ
> อันนี้สรุปแล้ว ไม่ต้องกลับมาคุยอีก

*Watch:* this should land in the checkpoint as a decision, marked **incomplete —
no owner**. Nobody was named. If Stratis marks it complete, that is a real miss
and worth a bug.

## 5:00 — An assumption nobody has tested

> เราเชื่อว่า 30 นาทีพอสำหรับให้ทีมลองใช้จริง
> น่าจะพอนะ ทีมส่วนใหญ่ประชุมกันไม่เกินครึ่งชั่วโมงอยู่แล้ว

*Watch:* a suggestion card asking whether this has been validated. The words
"เราเชื่อว่า" and "น่าจะ" are the signal — an assumption stated as fact.

## 7:00 — Answer the card out loud

> จริง ๆ เรายังไม่เคยถามทีมไหนเลยว่า 30 นาทีพอไหม
> เอาไว้ถามตอน beta แล้วกัน

*Watch:* auto-answer detection should strike through that card, because the
question was raised and answered in the room.

## 9:00 — Drift, on purpose (90 seconds)

> เออ พูดถึง beta แล้ว เมื่อวานผมไปกินข้าวกับเพื่อนที่ทำ startup อีกเจ้า
> เขาเล่าว่าตลาด AI ตอนนี้แข่งกันดุมาก มีคนทำ note taker เยอะมาก
> ราคาก็ลงเรื่อย ๆ

*Watch:* either a drift alert, or — just as important — **no fabricated
decision**. Nothing here was decided, and a checkpoint entry from this stretch
would be a false positive.

## 11:00 — A complete decision, said properly

> กลับมาเรื่องเรานะ
> เรื่อง onboarding ทีมเบต้า ให้ Owen เป็นคนดูแลนะครับ
> ขอภายในวันที่ 20 สิงหาคม ก่อนทีมแรกเริ่มใช้จริง

*Watch:* checkpoint entry with **owner = Owen** and **due = 20 August**, marked
complete. This is the one that proves the completeness model works, so say the
name and the date clearly.

## 13:00 — One more, then close

> เรื่องสุดท้าย ช่องทาง feedback เราจะใช้ LINE group ก่อน
> ยังไม่ต้องทำ in-app feedback ตอนนี้
> ที่เหลือไว้คุยประชุมหน้า ปิดประชุมครับ

*Watch:* a third decision, and "ไว้คุยประชุมหน้า" should leave something as an
open question rather than a decision.

---

## After you press end

Check in this order and note what is wrong before fixing anything:

1. **Transcript** — does the Thai read as Thai, and did the English terms survive?
2. **Rolling notes** — do they describe the meeting or just repeat sentences?
3. **Cards** — how many fired, how many were useful, how many were noise? A card
   that repeats something already said is the failure mode to watch.
4. **Checkpoint** — 3 decisions expected: one incomplete (no owner), one complete
   (Owen, 20 Aug), one about LINE. Plus at least one open question.
5. **Summary** — is it something you would send to a team, or does it need
   rewriting? Rewriting it is fine; not being able to is the problem.
6. **Room code** — open the code on a phone mid-meeting and tick one decision, so
   the guest path gets exercised at least once before real teams use it.

Screenshot anything that looks wrong rather than describing it afterwards — the
transcript at the moment it went wrong is worth more than the memory of it.
