# Thai translation review

One row per string. Edit the Thai in the last column, or copy the snippet, change it, and paste it
back into `src/i18n/th.ts` over the matching line — the key on the left must stay exactly as it is,
because the translator matches rendered text against it.

543 strings. Anything not in this file stays English on purpose (project names, meeting titles,
people's names, dates).


## Sidebar / global nav

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Dashboard | แดชบอร์ด | app shell / header, left sidebar, dashboard | `Dashboard: "แดชบอร์ด",` |
| Docket | วาระการประชุม | app shell / header, useCreateMeeting, offline demo data | `Docket: "วาระการประชุม",` |
| Projects | โปรเจกต์ | app shell / header, new meeting dialog, projects list | `Projects: "โปรเจกต์",` |
| Project | โปรเจกต์ | app shell / header, new meeting dialog, start recording dialog | `Project: "โปรเจกต์",` |
| Meeting | การประชุม | app shell / header, MeetingTransition, new meeting dialog | `Meeting: "การประชุม",` |
| Meetings | การประชุม | offline demo data, admin panel, dashboard | `Meetings: "การประชุม",` |
| Document | เอกสาร | app shell / header, project document, projects list | `Document: "เอกสาร",` |
| Settings | ตั้งค่า | app shell / header, first-run language choice, left sidebar | `Settings: "ตั้งค่า",` |
| Admin | ผู้ดูแลระบบ | app shell / header, left sidebar, AuthContext | `Admin: "ผู้ดูแลระบบ",` |
| Send feedback | ส่งความคิดเห็น | feedback dialog, left sidebar | `"Send feedback": "ส่งความคิดเห็น",` |
| Sign out | ออกจากระบบ | left sidebar, admin panel, invite link screen | `"Sign out": "ออกจากระบบ",` |
| Sign in | เข้าสู่ระบบ | app shell / header, public landing page, sign-in screen | `"Sign in": "เข้าสู่ระบบ",` |
| Collapse sidebar | ย่อเมนู | left sidebar | `"Collapse sidebar": "ย่อเมนู",` |
| Expand sidebar | ขยายเมนู | left sidebar | `"Expand sidebar": "ขยายเมนู",` |
| Guest | ผู้เยี่ยมชม | left sidebar, invite link screen, plans page | `Guest: "ผู้เยี่ยมชม",` |
| Toggle theme | เปลี่ยนธีม | public landing page | `"Toggle theme": "เปลี่ยนธีม",` |
| Light mode | โหมดสว่าง | not found in the UI source — may be dead | `"Light mode": "โหมดสว่าง",` |
| Dark mode | โหมดมืด | plans page, settings | `"Dark mode": "โหมดมืด",` |
| Switch language | เปลี่ยนภาษา | public landing page | `"Switch language": "เปลี่ยนภาษา",` |
| Primary | เมนูหลัก | end-of-meeting checkpoint, Markdown, NodeTypes | `Primary: "เมนูหลัก",` |
| Back | ย้อนกลับ | app shell / header, AmbientBackground, new meeting dialog | `Back: "ย้อนกลับ",` |
| Go back | ย้อนกลับ | app shell / header | `"Go back": "ย้อนกลับ",` |
| Forward | ถัดไป | app shell / header | `Forward: "ถัดไป",` |
| Go forward | ไปข้างหน้า | app shell / header | `"Go forward": "ไปข้างหน้า",` |

## Landing

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| THAI + ENGLISH | ไทย + อังกฤษ | public landing page | `"THAI + ENGLISH": "ไทย + อังกฤษ",` |
| How it works | วิธีการทำงาน | public landing page | `"How it works": "วิธีการทำงาน",` |
| How Stratis works | Stratis ทำงานอย่างไร | public landing page | `"How Stratis works": "Stratis ทำงานอย่างไร",` |
| See it live | ดูการทำงานจริง | public landing page | `"See it live": "ดูการทำงานจริง",` |
| Get started | เริ่มใช้งาน | public landing page, plans page | `"Get started": "เริ่มใช้งาน",` |
| Get started → | เริ่มใช้งาน → | public landing page | `"Get started →": "เริ่มใช้งาน →",` |
| As the conversation unfolds, Stratis surfaces the question nobody thought to ask — privately, to the facilitator — and marks it answered when the room gets there. | ระหว่างการประชุม Stratis จะช่วยหยิบยกคำถามที่อาจถูกมองข้ามขึ้นมาให้ผู้ดำเนินการประชุมเห็นแบบส่วนตัว และจะทำเครื่องหมายว่าได้รับคำตอบแล้วเมื่อมีการพูดถึงในที่ประชุม | not found in the UI source — may be dead | `"As the conversation unfolds, Stratis surfaces the question nobody thought to ask — privately, to the facilitator — and marks it answered when the room gets there.": "ระหว่างการประชุม Stratis จะช่วยหยิบยกคำถามที่อาจถูกมองข้ามขึ้นมาให้ผู้ดำเนินการประชุมเห็นแบบส่วนตัว และจะทำเครื่องหมายว่าได้รับคำตอบแล้วเมื่อมีการพูดถึงในที่ประชุม",` |
| About us | เกี่ยวกับเรา | public landing page | `"About us": "เกี่ยวกับเรา",` |
| Just like every other meeting, except no one leaves on a misunderstanding ever again. | เหมือนการประชุมทั่วไป แต่ช่วยให้ทุกคนออกจากห้องประชุมด้วยความเข้าใจตรงกัน | public landing page | `"Just like every other meeting, except no one leaves on a misunderstanding ever again.": "เหมือนการประชุมทั่วไป แต่ช่วยให้ทุกคนออกจากห้องประชุมด้วยความเข้าใจตรงกัน",` |
| Listen | ฟัง | app shell / header, AmbientBackground, shared buttons and dialogs | `Listen: "ฟัง",` |
| Suggest | แนะนำ | BlockRenderer, meeting pacing chips, live suggestion cards | `Suggest: "แนะนำ",` |
| Record | บันทึก | app shell / header, end-of-meeting checkpoint, Markdown | `Record: "บันทึก",` |
| Stratis joins your meeting and captures the live transcript — every speaker, every claim, in real time. | Stratis เข้าร่วมการประชุมและถอดเสียงแบบเรียลไทม์ เก็บทั้งสิ่งที่แต่ละคนพูดและประเด็นสำคัญระหว่างการประชุม | public landing page | `"Stratis joins your meeting and captures the live transcript — every speaker, every claim, in real time.": "Stratis เข้าร่วมการประชุมและถอดเสียงแบบเรียลไทม์ เก็บทั้งสิ่งที่แต่ละคนพูดและประเด็นสำคัญระหว่างการประชุม",` |
| Facilitator-only cards surface the question nobody thought to ask, flag untested assumptions, and mark them answered when the room gets there. | การ์ดสำหรับผู้ดำเนินการประชุมจะช่วยชี้คำถามที่อาจถูกมองข้าม เตือนถึงข้อสมมติที่ยังไม่ได้ตรวจสอบ และทำเครื่องหมายเมื่อมีการตอบประเด็นนั้นแล้ว | public landing page | `"Facilitator-only cards surface the question nobody thought to ask, flag untested assumptions, and mark them answered when the room gets there.": "การ์ดสำหรับผู้ดำเนินการประชุมจะช่วยชี้คำถามที่อาจถูกมองข้าม เตือนถึงข้อสมมติที่ยังไม่ได้ตรวจสอบ และทำเครื่องหมายเมื่อมีการตอบประเด็นนั้นแล้ว",` |
| Afterward, Stratis writes the participant summary and proposes changes to the living PM document — decisions, assumptions, risks. | หลังจบการประชุม Stratis จะสรุปเนื้อหาสำหรับผู้เข้าร่วม และเสนอการแก้ไขเอกสาร PM ตามสิ่งที่เกิดขึ้นจริง เช่น การตัดสินใจ ข้อสมมติ และความเสี่ยง | public landing page | `"Afterward, Stratis writes the participant summary and proposes changes to the living PM document — decisions, assumptions, risks.": "หลังจบการประชุม Stratis จะสรุปเนื้อหาสำหรับผู้เข้าร่วม และเสนอการแก้ไขเอกสาร PM ตามสิ่งที่เกิดขึ้นจริง เช่น การตัดสินใจ ข้อสมมติ และความเสี่ยง",` |
| Listens live | ฟังแบบเรียลไทม์ | public landing page | `"Listens live": "ฟังแบบเรียลไทม์",` |
| Suggests privately | แนะนำแบบส่วนตัว | public landing page | `"Suggests privately": "แนะนำแบบส่วนตัว",` |
| Updates the PM doc | อัปเดตเอกสาร PM | public landing page | `"Updates the PM doc": "อัปเดตเอกสาร PM",` |
| Remembers every decision | เก็บทุกการตัดสินใจ | public landing page | `"Remembers every decision": "เก็บทุกการตัดสินใจ",` |
| Flags drift | เตือนเมื่อเริ่มออกนอกประเด็น | public landing page | `"Flags drift": "เตือนเมื่อเริ่มออกนอกประเด็น",` |
| Ready to see it in your next meeting? | พร้อมลองใช้ในการประชุมครั้งหน้าหรือยัง? | public landing page | `"Ready to see it in your next meeting?": "พร้อมลองใช้ในการประชุมครั้งหน้าหรือยัง?",` |
| Stratis — Live meeting | Stratis — การประชุมสด | public landing page | `"Stratis — Live meeting": "Stratis — การประชุมสด",` |
| TRANSCRIPT | บทถอดเสียง | offline demo data, public landing page | `TRANSCRIPT: "บทถอดเสียง",` |
| QUESTION | คำถาม | NodeTypes, live suggestion cards, offline demo data | `QUESTION: "คำถาม",` |
| ASSUMPTION | ข้อสมมติ | NodeTypes, live suggestion cards, offline demo data | `ASSUMPTION: "ข้อสมมติ",` |
| We missed Q2 by 12% — root cause looks like enterprise pricing. | ไตรมาส 2 เราพลาดเป้าไป 12% ดูเหมือนว่าสาเหตุหลักจะมาจากราคาแพ็กเกจสำหรับลูกค้าองค์กร | public landing page | `"We missed Q2 by 12% — root cause looks like enterprise pricing.": "ไตรมาส 2 เราพลาดเป้าไป 12% ดูเหมือนว่าสาเหตุหลักจะมาจากราคาแพ็กเกจสำหรับลูกค้าองค์กร",` |
| Agreed, but the sales cycle lengthened too. | เห็นด้วย แต่ระยะเวลาการขายก็ยาวขึ้นเหมือนกัน | offline demo data, public landing page | `"Agreed, but the sales cycle lengthened too.": "เห็นด้วย แต่ระยะเวลาการขายก็ยาวขึ้นเหมือนกัน",` |
| 8 of 12 churned customers cited pricing. That’s signal. | ลูกค้าที่เลิกใช้ 8 จาก 12 รายพูดถึงเรื่องราคา นี่น่าจะเป็นสัญญาณสำคัญ | public landing page | `"8 of 12 churned customers cited pricing. That’s signal.": "ลูกค้าที่เลิกใช้ 8 จาก 12 รายพูดถึงเรื่องราคา นี่น่าจะเป็นสัญญาณสำคัญ",` |
| Who owns the pricing decision before next meeting? | ก่อนประชุมครั้งหน้า ใครเป็นคนรับผิดชอบตัดสินใจเรื่องราคา? | public landing page | `"Who owns the pricing decision before next meeting?": "ก่อนประชุมครั้งหน้า ใครเป็นคนรับผิดชอบตัดสินใจเรื่องราคา?",` |
| Discussed, but no owner was named. | คุยเรื่องนี้แล้ว แต่ยังไม่ได้ระบุว่าใครเป็นคนรับผิดชอบ | public landing page | `"Discussed, but no owner was named.": "คุยเรื่องนี้แล้ว แต่ยังไม่ได้ระบุว่าใครเป็นคนรับผิดชอบ",` |
| Has anyone validated SMB accepts metered billing? | มีใครลองตรวจสอบหรือยังว่า SMB ยอมรับการคิดค่าบริการตามการใช้งาน? | public landing page | `"Has anyone validated SMB accepts metered billing?": "มีใครลองตรวจสอบหรือยังว่า SMB ยอมรับการคิดค่าบริการตามการใช้งาน?",` |
| A core assumption no one has tested. | เป็นข้อสมมติสำคัญที่ยังไม่มีใครทดสอบ | public landing page | `"A core assumption no one has tested.": "เป็นข้อสมมติสำคัญที่ยังไม่มีใครทดสอบ",` |

## Room code (participants)

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Join the room | เข้าร่วมห้องประชุม | guest room-code screen | `"Join the room": "เข้าร่วมห้องประชุม",` |
| Type the code the facilitator read out. | พิมพ์รหัสที่ผู้ดำเนินการประชุมอ่านให้ฟัง | guest room-code screen | `"Type the code the facilitator read out.": "พิมพ์รหัสที่ผู้ดำเนินการประชุมอ่านให้ฟัง",` |
| Room code | รหัสห้อง | app shell / header, offline demo data, guest room-code screen | `"Room code": "รหัสห้อง",` |
| How the room knows you | ชื่อที่คนในห้องจะเห็น | guest room-code screen | `"How the room knows you": "ชื่อที่คนในห้องจะเห็น",` |
| Joining… | กำลังเข้าร่วม… | invite link screen, guest room-code screen | `"Joining…": "กำลังเข้าร่วม…",` |
| Leave | ออกจากห้อง | NodeTypes, left sidebar, shared buttons and dialogs | `Leave: "ออกจากห้อง",` |
| ← Back to Stratis | ← กลับไปที่ Stratis | not found in the UI source — may be dead | `"← Back to Stratis": "← กลับไปที่ Stratis",` |
| ← Back | ← ย้อนกลับ | not found in the UI source — may be dead | `"← Back": "← ย้อนกลับ",` |
| No account needed. You can see and comment on this meeting's decisions for as long as it is running. | ไม่ต้องสร้างบัญชี คุณดูและแสดงความเห็นต่อการตัดสินใจของการประชุมนี้ได้ตลอดเวลาที่ประชุมยังดำเนินอยู่ | not found in the UI source — may be dead | `"No account needed. You can see and comment on this meeting's decisions for as long as it is running.": "ไม่ต้องสร้างบัญชี คุณดูและแสดงความเห็นต่อการตัดสินใจของการประชุมนี้ได้ตลอดเวลาที่ประชุมยังดำเนินอยู่",` |
| Nothing on the checkpoint yet. It fills in as the meeting reaches decisions. | ยังไม่มีอะไรในจุดตรวจสอบ จะเพิ่มขึ้นเมื่อที่ประชุมเริ่มตัดสินใจ | guest room-code screen | `"Nothing on the checkpoint yet. It fills in as the meeting reaches decisions.": "ยังไม่มีอะไรในจุดตรวจสอบ จะเพิ่มขึ้นเมื่อที่ประชุมเริ่มตัดสินใจ",` |
| Updates every few seconds while the meeting runs. | อัปเดตทุกไม่กี่วินาทีระหว่างที่ประชุมดำเนินอยู่ | guest room-code screen | `"Updates every few seconds while the meeting runs.": "อัปเดตทุกไม่กี่วินาทีระหว่างที่ประชุมดำเนินอยู่",` |
| What did the room actually decide? | จริง ๆ แล้วที่ประชุมตัดสินใจว่าอะไร? | guest room-code screen | `"What did the room actually decide?": "จริง ๆ แล้วที่ประชุมตัดสินใจว่าอะไร?",` |
| ROOM CODE | รหัสห้อง | end-of-meeting checkpoint | `"ROOM CODE": "รหัสห้อง",` |
| Open to the room | เปิดให้คนในห้องเข้าร่วม | end-of-meeting checkpoint | `"Open to the room": "เปิดให้คนในห้องเข้าร่วม",` |
| Opening… | กำลังเปิด… | end-of-meeting checkpoint | `"Opening…": "กำลังเปิด…",` |
| Colours are adjusted to stay readable on the theme you are using. | สีจะถูกปรับให้อ่านง่ายกับธีมที่คุณใช้อยู่ | settings | `"Colours are adjusted to stay readable on the theme you are using.": "สีจะถูกปรับให้อ่านง่ายกับธีมที่คุณใช้อยู่",` |
| Custom colour | สีที่กำหนดเอง | settings | `"Custom colour": "สีที่กำหนดเอง",` |
| Signal Matcha | Signal Matcha | useTheme | `"Signal Matcha": "Signal Matcha",` |
| Violet | ม่วง | useTheme | `Violet: "ม่วง",` |
| Magenta | บานเย็น | useTheme | `Magenta: "บานเย็น",` |
| Coral | ส้มปะการัง | useTheme | `Coral: "ส้มปะการัง",` |
| Indigo | คราม | useTheme | `Indigo: "คราม",` |
| Cobalt | น้ำเงิน | useTheme | `Cobalt: "น้ำเงิน",` |
| Amber | เหลืองอำพัน | useTheme | `Amber: "เหลืองอำพัน",` |
| Teal | เขียวน้ำทะเล | useTheme, docket | `Teal: "เขียวน้ำทะเล",` |

## Pro locks

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| PRO | PRO | new meeting dialog, Pro upgrade prompt, index.d | `PRO: "PRO",` |
| See what Pro includes → | ดูว่าแพ็กเกจ Pro มีอะไรบ้าง → | Pro upgrade prompt | `"See what Pro includes →": "ดูว่าแพ็กเกจ Pro มีอะไรบ้าง →",` |
| Not now | ไว้ทีหลัง | Pro upgrade prompt | `"Not now": "ไว้ทีหลัง",` |
| Theme and workspace colour | ธีมและสีของเวิร์กสเปซ | settings | `"Theme and workspace colour": "ธีมและสีของเวิร์กสเปซ",` |
| Theme and workspace colour is part of Pro | ธีมและสีของเวิร์กสเปซเป็นฟีเจอร์ของแพ็กเกจ Pro | not found in the UI source — may be dead | `"Theme and workspace colour is part of Pro": "ธีมและสีของเวิร์กสเปซเป็นฟีเจอร์ของแพ็กเกจ Pro",` |
| Exporting the record | การส่งออกบันทึกการประชุม | meeting summary | `"Exporting the record": "การส่งออกบันทึกการประชุม",` |
| Exporting the record is part of Pro | การส่งออกบันทึกการประชุมเป็นฟีเจอร์ของแพ็กเกจ Pro | meeting summary | `"Exporting the record is part of Pro": "การส่งออกบันทึกการประชุมเป็นฟีเจอร์ของแพ็กเกจ Pro",` |
| Dark mode, eight workspace colours, and any custom colour you like. | โหมดมืด สีเวิร์กสเปซ 8 แบบ และสีที่คุณกำหนดเองได้ตามต้องการ | settings | `"Dark mode, eight workspace colours, and any custom colour you like.": "โหมดมืด สีเวิร์กสเปซ 8 แบบ และสีที่คุณกำหนดเองได้ตามต้องการ",` |
| Take the summary out of Stratis as a file you can paste into LINE, email or Notion. | นำสรุปออกจาก Stratis เป็นไฟล์ที่วางลงใน LINE อีเมล หรือ Notion ได้ | meeting summary | `"Take the summary out of Stratis as a file you can paste into LINE, email or Notion.": "นำสรุปออกจาก Stratis เป็นไฟล์ที่วางลงใน LINE อีเมล หรือ Notion ได้",` |
| Theme and workspace colour. Applies to this browser. | ธีมและสีของเวิร์กสเปซ มีผลกับเบราว์เซอร์นี้ | settings | `"Theme and workspace colour. Applies to this browser.": "ธีมและสีของเวิร์กสเปซ มีผลกับเบราว์เซอร์นี้",` |

## Settings: profile actions

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Save changes | บันทึกการเปลี่ยนแปลง | settings | `"Save changes": "บันทึกการเปลี่ยนแปลง",` |
| Saving… | กำลังบันทึก… | project document, settings, meeting summary | `"Saving…": "กำลังบันทึก…",` |

## Settings: language & appearance

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Language | ภาษา | app shell / header, first-run language choice, left sidebar | `Language: "ภาษา",` |
| Appearance | การแสดงผล | settings | `Appearance: "การแสดงผล",` |
| Applies to the whole interface. | มีผลกับทั้งระบบ | settings | `"Applies to the whole interface.": "มีผลกับทั้งระบบ",` |
| Applies to this browser. | มีผลกับเบราว์เซอร์นี้ | settings | `"Applies to this browser.": "มีผลกับเบราว์เซอร์นี้",` |
| Light | สว่าง | BlockRenderer, end-of-meeting checkpoint, NodeTypes | `Light: "สว่าง",` |
| Dark | มืด | useTheme, plans page, settings | `Dark: "มืด",` |
| See Pro → | ดูแพ็กเกจ Pro → | not found in the UI source — may be dead | `"See Pro →": "ดูแพ็กเกจ Pro →",` |
| Changing the theme is part of Pro. Your current theme stays as it is. | การเปลี่ยนธีมเป็นฟีเจอร์ของแพ็กเกจ Pro ธีมปัจจุบันของคุณจะยังคงเดิม | not found in the UI source — may be dead | `"Changing the theme is part of Pro. Your current theme stays as it is.": "การเปลี่ยนธีมเป็นฟีเจอร์ของแพ็กเกจ Pro ธีมปัจจุบันของคุณจะยังคงเดิม",` |
| Tells you when a project document is updated after a meeting. | แจ้งเตือนเมื่อเอกสารโปรเจกต์ถูกอัปเดตหลังการประชุม | settings | `"Tells you when a project document is updated after a meeting.": "แจ้งเตือนเมื่อเอกสารโปรเจกต์ถูกอัปเดตหลังการประชุม",` |

## Summary

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Meeting summary | สรุปการประชุม | summaryExport, meeting summary | `"Meeting summary": "สรุปการประชุม",` |
| Export | ส่งออก | meeting summary | `Export: "ส่งออก",` |
| Copy | คัดลอก | admin panel, meeting summary | `Copy: "คัดลอก",` |
| Copied | คัดลอกแล้ว | admin panel, meeting summary | `Copied: "คัดลอกแล้ว",` |
| Done editing | แก้ไขเสร็จแล้ว | meeting summary | `"Done editing": "แก้ไขเสร็จแล้ว",` |
| Task | งาน | summaryExport, meeting summary | `Task: "งาน",` |
| Due | กำหนดส่ง | end-of-meeting checkpoint, useCheckpoint, summaryExport | `Due: "กำหนดส่ง",` |
| no date | ไม่มีกำหนด | summaryExport, guest room-code screen, meeting summary | `"no date": "ไม่มีกำหนด",` |
| Back to dashboard | กลับไปที่แดชบอร์ด | meeting summary | `"Back to dashboard": "กลับไปที่แดชบอร์ด",` |
| Open the project document → | เปิดเอกสารโปรเจกต์ → | meeting summary | `"Open the project document →": "เปิดเอกสารโปรเจกต์ →",` |
| This summary could not be loaded | ไม่สามารถโหลดสรุปนี้ได้ | meeting summary | `"This summary could not be loaded": "ไม่สามารถโหลดสรุปนี้ได้",` |
| Review it, then export and share it however your team works. | ตรวจทานแล้วส่งออกเพื่อแบ่งปันตามวิธีที่ทีมของคุณใช้ | meeting summary | `"Review it, then export and share it however your team works.": "ตรวจทานแล้วส่งออกเพื่อแบ่งปันตามวิธีที่ทีมของคุณใช้",` |
| Editing — correct the AI before you send this out | กำลังแก้ไข — ปรับข้อความของ AI ให้ถูกต้องก่อนส่งออก | meeting summary | `"Editing — correct the AI before you send this out": "กำลังแก้ไข — ปรับข้อความของ AI ให้ถูกต้องก่อนส่งออก",` |

## Landing / auth entry points

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Pricing | ราคา | app shell / header, Pro upgrade prompt, offline demo data | `Pricing: "ราคา",` |
| Join a meeting | เข้าร่วมการประชุม | public landing page | `"Join a meeting": "เข้าร่วมการประชุม",` |
| Join with a room code | เข้าร่วมด้วยรหัสห้อง | public landing page | `"Join with a room code": "เข้าร่วมด้วยรหัสห้อง",` |
| In a meeting right now? | กำลังประชุมอยู่ใช่ไหม? | public landing page | `"In a meeting right now?": "กำลังประชุมอยู่ใช่ไหม?",` |
| Joining a meeting? | กำลังจะเข้าร่วมประชุม? | sign-in screen | `"Joining a meeting?": "กำลังจะเข้าร่วมประชุม?",` |
| Enter a room code | กรอกรหัสห้อง | sign-in screen | `"Enter a room code": "กรอกรหัสห้อง",` |

## Shell & failure copy

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Loading… | กำลังโหลด… | app shell / header, docket, plans page | `"Loading…": "กำลังโหลด…",` |
| Dismiss | ปิด | app shell / header, end-of-meeting checkpoint, live suggestion cards | `Dismiss: "ปิด",` |
| No meeting is running right now. | ตอนนี้ยังไม่มีการประชุมที่กำลังดำเนินอยู่ | live meeting screen | `"No meeting is running right now.": "ตอนนี้ยังไม่มีการประชุมที่กำลังดำเนินอยู่",` |
| Could not reach Stratis. Check your connection and try again. | เชื่อมต่อกับ Stratis ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ | http | `"Could not reach Stratis. Check your connection and try again.": "เชื่อมต่อกับ Stratis ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",` |
| Your meetings could not be loaded. They are safe — this screen just could not reach the server. | โหลดรายการประชุมของคุณไม่ได้ ข้อมูลยังอยู่ครบ เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ | dashboard | `"Your meetings could not be loaded. They are safe — this screen just could not reach the server.": "โหลดรายการประชุมของคุณไม่ได้ ข้อมูลยังอยู่ครบ เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้",` |
| Recent summaries could not be loaded. | โหลดสรุปล่าสุดไม่ได้ | dashboard | `"Recent summaries could not be loaded.": "โหลดสรุปล่าสุดไม่ได้",` |
| The docket could not be loaded. Nothing has been lost — this screen just could not reach the server. | โหลดวาระการประชุมไม่ได้ ไม่มีข้อมูลสูญหาย เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ | docket | `"The docket could not be loaded. Nothing has been lost — this screen just could not reach the server.": "โหลดวาระการประชุมไม่ได้ ไม่มีข้อมูลสูญหาย เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้",` |
| Your projects could not be loaded. They are safe — this screen just could not reach the server. | โหลดโปรเจกต์ของคุณไม่ได้ ข้อมูลยังอยู่ครบ เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ | projects list | `"Your projects could not be loaded. They are safe — this screen just could not reach the server.": "โหลดโปรเจกต์ของคุณไม่ได้ ข้อมูลยังอยู่ครบ เพียงแต่หน้านี้เชื่อมต่อเซิร์ฟเวอร์ไม่ได้",` |
| Your plan and usage could not be loaded. Nothing about your subscription has changed. | โหลดข้อมูลแพ็กเกจและการใช้งานไม่ได้ การสมัครใช้งานของคุณไม่มีการเปลี่ยนแปลง | settings | `"Your plan and usage could not be loaded. Nothing about your subscription has changed.": "โหลดข้อมูลแพ็กเกจและการใช้งานไม่ได้ การสมัครใช้งานของคุณไม่มีการเปลี่ยนแปลง",` |

## Admin (workspace admins)

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Usage | การใช้งาน | admin panel | `Usage: "การใช้งาน",` |

## Auth: login / register / join

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Sign in to Stratis | เข้าสู่ระบบ Stratis | sign-in screen | `"Sign in to Stratis": "เข้าสู่ระบบ Stratis",` |
| Access the Control Room | เข้าสู่ห้องควบคุม | not found in the UI source — may be dead | `"Access the Control Room": "เข้าสู่ห้องควบคุม",` |
| Email Address | อีเมล | sign-in screen, sign-up screen | `"Email Address": "อีเมล",` |
| Email | อีเมล | admin panel, sign-in screen, sign-up screen | `Email: "อีเมล",` |
| Password | รหัสผ่าน | admin panel, sign-in screen, sign-up screen | `Password: "รหัสผ่าน",` |
| Confirm Password | ยืนยันรหัสผ่าน | sign-up screen | `"Confirm Password": "ยืนยันรหัสผ่าน",` |
| Continue with Google | ดำเนินการต่อด้วย Google | sign-in screen | `"Continue with Google": "ดำเนินการต่อด้วย Google",` |
| Enter Control Room | เข้าสู่ห้องควบคุม | not found in the UI source — may be dead | `"Enter Control Room": "เข้าสู่ห้องควบคุม",` |
| Accessing... | กำลังเข้าสู่ระบบ... | not found in the UI source — may be dead | `"Accessing...": "กำลังเข้าสู่ระบบ...",` |
| Deploy Workspace | สร้างเวิร์กสเปซ | not found in the UI source — may be dead | `"Deploy Workspace": "สร้างเวิร์กสเปซ",` |
| Initializing... | กำลังเตรียมระบบ... | not found in the UI source — may be dead | `"Initializing...": "กำลังเตรียมระบบ...",` |
| Don't have an account? | ยังไม่มีบัญชี? | sign-in screen | `"Don't have an account?": "ยังไม่มีบัญชี?",` |
| Create one | สร้างบัญชี | sign-in screen, projects list | `"Create one": "สร้างบัญชี",` |
| Create your account | สร้างบัญชีของคุณ | sign-up screen | `"Create your account": "สร้างบัญชีของคุณ",` |
| Create an account | สร้างบัญชี | invite link screen | `"Create an account": "สร้างบัญชี",` |
| Access accounts | เข้าถึงบัญชี | sign-up screen | `"Access accounts": "เข้าถึงบัญชี",` |
| Already registered? | มีบัญชีอยู่แล้ว? | sign-up screen | `"Already registered?": "มีบัญชีอยู่แล้ว?",` |
| Full Name | ชื่อ-นามสกุล | sign-up screen | `"Full Name": "ชื่อ-นามสกุล",` |
| Organization Name | ชื่อองค์กร | sign-up screen | `"Organization Name": "ชื่อองค์กร",` |
| Initialize Master Organizational Tenant | สร้างองค์กรหลัก | sign-up screen | `"Initialize Master Organizational Tenant": "สร้างองค์กรหลัก",` |
| Min. 8 chars, 1 letter, 1 number | อย่างน้อย 8 ตัวอักษร และต้องมีตัวอักษรกับตัวเลขอย่างละ 1 ตัว | sign-up screen | `"Min. 8 chars, 1 letter, 1 number": "อย่างน้อย 8 ตัวอักษร และต้องมีตัวอักษรกับตัวเลขอย่างละ 1 ตัว",` |
| Your name | ชื่อของคุณ | invite link screen, guest room-code screen | `"Your name": "ชื่อของคุณ",` |
| How you appear in the room | ชื่อที่จะแสดงในห้องประชุม | invite link screen | `"How you appear in the room": "ชื่อที่จะแสดงในห้องประชุม",` |
| Continue | ดำเนินการต่อ | invite link screen, sign-in screen | `Continue: "ดำเนินการต่อ",` |
| I already have an account | ฉันมีบัญชีอยู่แล้ว | invite link screen | `"I already have an account": "ฉันมีบัญชีอยู่แล้ว",` |
| Or join as a guest — no account, this meeting only. | หรือเข้าร่วมในฐานะผู้เยี่ยมชม ไม่ต้องสร้างบัญชี และใช้ได้เฉพาะการประชุมนี้ | invite link screen | `"Or join as a guest — no account, this meeting only.": "หรือเข้าร่วมในฐานะผู้เยี่ยมชม ไม่ต้องสร้างบัญชี และใช้ได้เฉพาะการประชุมนี้",` |
| You're in | เข้าร่วมเรียบร้อยแล้ว | invite link screen | `"You're in": "เข้าร่วมเรียบร้อยแล้ว",` |
| Go to Stratis | ไปที่ Stratis | invite link screen | `"Go to Stratis": "ไปที่ Stratis",` |
| This link no longer works | ลิงก์นี้ใช้ไม่ได้แล้ว | invite link screen | `"This link no longer works": "ลิงก์นี้ใช้ไม่ได้แล้ว",` |
| Stratis records and transcribes the meeting to build the summary. Everyone in the room should know it is running. | Stratis จะบันทึกและถอดเสียงการประชุมเพื่อใช้สร้างสรุป ทุกคนในห้องประชุมควรทราบว่าระบบกำลังทำงาน | not found in the UI source — may be dead | `"Stratis records and transcribes the meeting to build the summary. Everyone in the room should know it is running.": "Stratis จะบันทึกและถอดเสียงการประชุมเพื่อใช้สร้างสรุป ทุกคนในห้องประชุมควรทราบว่าระบบกำลังทำงาน",` |

## Dashboard

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Welcome back, | ยินดีต้อนรับกลับ | dashboard | `"Welcome back,": "ยินดีต้อนรับกลับ",` |
| + NEW MEETING | + เริ่มการประชุม | dashboard | `"+ NEW MEETING": "+ เริ่มการประชุม",` |
| LIVE NOW | กำลังประชุม | dashboard | `"LIVE NOW": "กำลังประชุม",` |
| Ready to start | พร้อมเริ่ม | dashboard | `"Ready to start": "พร้อมเริ่ม",` |
| Recent summaries | สรุปล่าสุด | dashboard | `"Recent summaries": "สรุปล่าสุด",` |
| Open the docket | เปิดวาระการประชุม | dashboard | `"Open the docket": "เปิดวาระการประชุม",` |
| Refresh | รีเฟรช | end-of-meeting checkpoint, dashboard, settings | `Refresh: "รีเฟรช",` |

## Docket

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| New meeting | ประชุมใหม่ | new meeting dialog, dashboard, docket | `"New meeting": "ประชุมใหม่",` |
| Schedule | จัดตาราง | new meeting dialog, docket | `Schedule: "จัดตาราง",` |
| Schedule the first one | จัดตารางการประชุมครั้งแรก | docket | `"Schedule the first one": "จัดตารางการประชุมครั้งแรก",` |
| Live | สด | app shell / header, live suggestion cards, checkpointReview | `Live: "สด",` |
| Join | เข้าร่วม | app shell / header, docket, invite link screen | `Join: "เข้าร่วม",` |
| Goal: | เป้าหมาย: | docket | `"Goal:": "เป้าหมาย:",` |
| No goal yet — the AI has nothing to aim at. | ยังไม่มีเป้าหมาย — AI ยังไม่มีบริบทสำหรับช่วยติดตาม | docket | `"No goal yet — the AI has nothing to aim at.": "ยังไม่มีเป้าหมาย — AI ยังไม่มีบริบทสำหรับช่วยติดตาม",` |
| Open questions | คำถามที่ยังค้างอยู่ | docket | `"Open questions": "คำถามที่ยังค้างอยู่",` |
| Open project document | เปิดเอกสารโปรเจกต์ | docket | `"Open project document": "เปิดเอกสารโปรเจกต์",` |
| Prep — project document | เตรียมตัว — เอกสารโปรเจกต์ | docket | `"Prep — project document": "เตรียมตัว — เอกสารโปรเจกต์",` |
| Decision meeting | ประชุมเพื่อตัดสินใจ | docket | `"Decision meeting": "ประชุมเพื่อตัดสินใจ",` |
| Carried from earlier meetings on | ต่อเนื่องจากการประชุมก่อนหน้าเมื่อ | docket | `"Carried from earlier meetings on": "ต่อเนื่องจากการประชุมก่อนหน้าเมื่อ",` |
| add to your calendar (.ics) | เพิ่มลงปฏิทินของคุณ (.ics) | docket | `"add to your calendar (.ics)": "เพิ่มลงปฏิทินของคุณ (.ics)",` |
| unowned | ยังไม่มีผู้รับผิดชอบ | docketCarry.test, docketCarry, summaryExport | `unowned: "ยังไม่มีผู้รับผิดชอบ",` |

## Projects

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| All projects | โปรเจกต์ทั้งหมด | docket, project document, projects list | `"All projects": "โปรเจกต์ทั้งหมด",` |
| + NEW PROJECT | + โปรเจกต์ใหม่ | projects list | `"+ NEW PROJECT": "+ โปรเจกต์ใหม่",` |
| New project | โปรเจกต์ใหม่ | offline demo data, projects list | `"New project": "โปรเจกต์ใหม่",` |
| Project name | ชื่อโปรเจกต์ | projects list | `"Project name": "ชื่อโปรเจกต์",` |
| e.g. Pricing v2 | เช่น Pricing v2 | projects list | `"e.g. Pricing v2": "เช่น Pricing v2",` |
| Loading projects… | กำลังโหลดโปรเจกต์… | projects list | `"Loading projects…": "กำลังโหลดโปรเจกต์…",` |
| No projects yet. Create one, or start a meeting from the dashboard. | ยังไม่มีโปรเจกต์ สร้างโปรเจกต์ใหม่หรือเริ่มการประชุมจากแดชบอร์ด | projects list | `"No projects yet. Create one, or start a meeting from the dashboard.": "ยังไม่มีโปรเจกต์ สร้างโปรเจกต์ใหม่หรือเริ่มการประชุมจากแดชบอร์ด",` |
| PM document | เอกสาร PM | new meeting dialog, project document, public landing page | `"PM document": "เอกสาร PM",` |

## Meeting room

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| LIVE | สด | dashboard, live meeting screen | `LIVE: "สด",` |
| Live transcript | บทถอดเสียงแบบเรียลไทม์ | live meeting screen | `"Live transcript": "บทถอดเสียงแบบเรียลไทม์",` |
| Active suggestions | ข้อเสนอที่กำลังทำงาน | live meeting screen | `"Active suggestions": "ข้อเสนอที่กำลังทำงาน",` |
| End Meeting | จบการประชุม | live meeting screen | `"End Meeting": "จบการประชุม",` |
| End the meeting? | ต้องการจบการประชุมหรือไม่? | live meeting screen | `"End the meeting?": "ต้องการจบการประชุมหรือไม่?",` |
| Keep going | ประชุมต่อ | live meeting screen | `"Keep going": "ประชุมต่อ",` |
| Pause | พักชั่วคราว | end-of-meeting checkpoint, live meeting screen | `Pause: "พักชั่วคราว",` |
| Checkpoint | จุดตรวจสอบ | end-of-meeting checkpoint, useCheckpoint, offline demo data | `Checkpoint: "จุดตรวจสอบ",` |
| Back to meeting | กลับไปที่การประชุม | live meeting screen | `"Back to meeting": "กลับไปที่การประชุม",` |
| Jump to latest | ไปยังข้อความล่าสุด | live meeting screen | `"Jump to latest": "ไปยังข้อความล่าสุด",` |
| Jump to latest and resume auto-scroll | ไปยังข้อความล่าสุดและเลื่อนอัตโนมัติต่อ | live meeting screen | `"Jump to latest and resume auto-scroll": "ไปยังข้อความล่าสุดและเลื่อนอัตโนมัติต่อ",` |
| Facilitator Only | เฉพาะผู้ดำเนินการประชุม | live meeting screen | `"Facilitator Only": "เฉพาะผู้ดำเนินการประชุม",` |
| Facilitator only | เฉพาะผู้ดำเนินการประชุม | meeting summary | `"Facilitator only": "เฉพาะผู้ดำเนินการประชุม",` |
| Continuous STT Capture | ถอดเสียงต่อเนื่อง | live meeting screen | `"Continuous STT Capture": "ถอดเสียงต่อเนื่อง",` |
| Flushing chunk... | กำลังส่งข้อมูลเสียง... | live meeting screen | `"Flushing chunk...": "กำลังส่งข้อมูลเสียง...",` |
| REALTIME SYNCED | ซิงก์แบบเรียลไทม์ | live meeting screen | `"REALTIME SYNCED": "ซิงก์แบบเรียลไทม์",` |
| WEBSOCKET SYNCED | ซิงก์ผ่าน WebSocket | live meeting screen | `"WEBSOCKET SYNCED": "ซิงก์ผ่าน WebSocket",` |
| Go to dashboard to start one | ไปที่แดชบอร์ดเพื่อเริ่มการประชุม | live meeting screen | `"Go to dashboard to start one": "ไปที่แดชบอร์ดเพื่อเริ่มการประชุม",` |
| Agenda | วาระการประชุม | meeting pacing chips, new meeting dialog, live meeting screen | `Agenda: "วาระการประชุม",` |
| Preparing session | กำลังเตรียมเซสชัน | MeetingTransition | `"Preparing session": "กำลังเตรียมเซสชัน",` |
| Strategic notes · live | บันทึกเชิงกลยุทธ์ · สด | live notes ribbon | `"Strategic notes · live": "บันทึกเชิงกลยุทธ์ · สด",` |

## Suggestion cards

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Question | คำถาม | BlockRenderer, live suggestion cards, useAiBlocks | `Question: "คำถาม",` |
| Assumption | ข้อสมมติ | NodeTypes, live suggestion cards, meeting summary | `Assumption: "ข้อสมมติ",` |
| Risk | ความเสี่ยง | NodeTypes, meeting summary | `Risk: "ความเสี่ยง",` |
| Summary | สรุป | app shell / header, BlockRenderer, NodeTypes | `Summary: "สรุป",` |
| Drift | ออกนอกประเด็น | AmbientBackground, live suggestion cards | `Drift: "ออกนอกประเด็น",` |
| Missing decision | ยังไม่มีการตัดสินใจ | live suggestion cards | `"Missing decision": "ยังไม่มีการตัดสินใจ",` |
| Open question | คำถามที่ยังค้างอยู่ | NodeTypes, docket | `"Open question": "คำถามที่ยังค้างอยู่",` |
| Mark answered | ทำเครื่องหมายว่าตอบแล้ว | live suggestion cards | `"Mark answered": "ทำเครื่องหมายว่าตอบแล้ว",` |
| ✓ Answered | ✓ ตอบแล้ว | live suggestion cards | `"✓ Answered": "✓ ตอบแล้ว",` |
| Not relevant | ไม่เกี่ยวข้อง | live suggestion cards | `"Not relevant": "ไม่เกี่ยวข้อง",` |
| Re-open | เปิดอีกครั้ง | live suggestion cards | `"Re-open": "เปิดอีกครั้ง",` |
| Bring to front | นำมาไว้ด้านหน้า | live suggestion cards | `"Bring to front": "นำมาไว้ด้านหน้า",` |
| Reviewing the conversation | กำลังตรวจสอบบทสนทนา | live suggestion cards | `"Reviewing the conversation": "กำลังตรวจสอบบทสนทนา",` |
| Reviewing the conversation… | กำลังตรวจสอบบทสนทนา… | live suggestion cards | `"Reviewing the conversation…": "กำลังตรวจสอบบทสนทนา…",` |
| The AI got this one wrong — remove it without recording an answer | AI เข้าใจประเด็นนี้ผิด — ลบออกได้โดยไม่บันทึกคำตอบ | live suggestion cards | `"The AI got this one wrong — remove it without recording an answer": "AI เข้าใจประเด็นนี้ผิด — ลบออกได้โดยไม่บันทึกคำตอบ",` |

## Checkpoint panel

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Before we close | ก่อนจบการประชุม | end-of-meeting checkpoint | `"Before we close": "ก่อนจบการประชุม",` |
| Close checkpoint | ปิดจุดตรวจสอบ | end-of-meeting checkpoint | `"Close checkpoint": "ปิดจุดตรวจสอบ",` |
| Decision text | ข้อความการตัดสินใจ | end-of-meeting checkpoint | `"Decision text": "ข้อความการตัดสินใจ",` |
| Edit decision text | แก้ไขข้อความการตัดสินใจ | end-of-meeting checkpoint | `"Edit decision text": "แก้ไขข้อความการตัดสินใจ",` |
| Edit wording (STT sometimes mishears) | แก้ไขข้อความ (ระบบถอดเสียงอาจฟังผิด) | end-of-meeting checkpoint | `"Edit wording (STT sometimes mishears)": "แก้ไขข้อความ (ระบบถอดเสียงอาจฟังผิด)",` |
| Dismiss decision | ยกเลิกการตัดสินใจ | end-of-meeting checkpoint | `"Dismiss decision": "ยกเลิกการตัดสินใจ",` |
| Not a real decision — dismiss (undoable) | ไม่ใช่การตัดสินใจจริง — ยกเลิกได้ | end-of-meeting checkpoint | `"Not a real decision — dismiss (undoable)": "ไม่ใช่การตัดสินใจจริง — ยกเลิกได้",` |
| Deliberately open | ตั้งใจให้ยังเปิดอยู่ | end-of-meeting checkpoint | `"Deliberately open": "ตั้งใจให้ยังเปิดอยู่",` |
| Due date | กำหนดส่ง | end-of-meeting checkpoint | `"Due date": "กำหนดส่ง",` |
| Due: | กำหนด: | end-of-meeting checkpoint, meeting summary | `"Due:": "กำหนด:",` |
| Owner | ผู้รับผิดชอบ | end-of-meeting checkpoint, summaryExport, meeting summary | `Owner: "ผู้รับผิดชอบ",` |
| have a date | มีกำหนดแล้ว | end-of-meeting checkpoint | `"have a date": "มีกำหนดแล้ว",` |
| NEEDS A DATE | ต้องระบุวันที่ | end-of-meeting checkpoint | `"NEEDS A DATE": "ต้องระบุวันที่",` |
| READY | พร้อม | end-of-meeting checkpoint | `READY: "พร้อม",` |
| OPEN | ยังเปิดอยู่ | end-of-meeting checkpoint, NodeTypes, useSuggestionSocket | `OPEN: "ยังเปิดอยู่",` |
| Save | บันทึก | end-of-meeting checkpoint, project document, settings | `Save: "บันทึก",` |
| Cancel | ยกเลิก | end-of-meeting checkpoint, feedback dialog, new meeting dialog | `Cancel: "ยกเลิก",` |
| Undo | เลิกทำ | end-of-meeting checkpoint | `Undo: "เลิกทำ",` |
| Nothing to confirm yet. Run the checkpoint once the team has decided something. | ยังไม่มีอะไรให้ยืนยัน ใช้จุดตรวจสอบหลังจากทีมมีการตัดสินใจแล้ว | end-of-meeting checkpoint | `"Nothing to confirm yet. Run the checkpoint once the team has decided something.": "ยังไม่มีอะไรให้ยืนยัน ใช้จุดตรวจสอบหลังจากทีมมีการตัดสินใจแล้ว",` |

## New meeting modal

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Start something new | เริ่มการประชุมใหม่ | new meeting dialog | `"Start something new": "เริ่มการประชุมใหม่",` |
| Title | หัวข้อ | new meeting dialog, useCreateMeeting, dashboard | `Title: "หัวข้อ",` |
| e.g. Weekly sync | เช่น ประชุมทีมประจำสัปดาห์ | new meeting dialog | `"e.g. Weekly sync": "เช่น ประชุมทีมประจำสัปดาห์",` |
| Kind of meeting | ประเภทการประชุม | new meeting dialog | `"Kind of meeting": "ประเภทการประชุม",` |
| Kickoff | เริ่มโปรเจกต์ | new meeting dialog | `Kickoff: "เริ่มโปรเจกต์",` |
| Check-in | ติดตามงาน | new meeting dialog | `"Check-in": "ติดตามงาน",` |
| Decision | การตัดสินใจ | BlockRenderer, end-of-meeting checkpoint, new meeting dialog | `Decision: "การตัดสินใจ",` |
| Other | อื่น ๆ | new meeting dialog | `Other: "อื่น ๆ",` |
| Custom | กำหนดเอง | new meeting dialog, AuthContext, useTheme | `Custom: "กำหนดเอง",` |
| Regular team update | อัปเดตทีมตามปกติ | new meeting dialog | `"Regular team update": "อัปเดตทีมตามปกติ",` |
| Choose between options | เลือกจากตัวเลือก | new meeting dialog | `"Choose between options": "เลือกจากตัวเลือก",` |
| Goal — what this meeting has to settle | เป้าหมาย — สิ่งที่ต้องหาข้อสรุปในการประชุมนี้ | new meeting dialog | `"Goal — what this meeting has to settle": "เป้าหมาย — สิ่งที่ต้องหาข้อสรุปในการประชุมนี้",` |
| One line is enough | เขียนสั้น ๆ แค่บรรทัดเดียวก็พอ | new meeting dialog | `"One line is enough": "เขียนสั้น ๆ แค่บรรทัดเดียวก็พอ",` |
| Agenda or context | วาระหรือบริบท | new meeting dialog | `"Agenda or context": "วาระหรือบริบท",` |
| Anything the AI co-facilitator should know before it listens | ข้อมูลที่ AI ผู้ช่วยดำเนินการประชุมควรรู้ก่อนเริ่มฟัง | new meeting dialog | `"Anything the AI co-facilitator should know before it listens": "ข้อมูลที่ AI ผู้ช่วยดำเนินการประชุมควรรู้ก่อนเริ่มฟัง",` |
| How long | ระยะเวลา | new meeting dialog | `"How long": "ระยะเวลา",` |
| Meeting length in minutes | ระยะเวลาประชุมเป็นนาที | new meeting dialog | `"Meeting length in minutes": "ระยะเวลาประชุมเป็นนาที",` |
| Stratis warns you when 15 minutes are left. | Stratis จะแจ้งเตือนเมื่อเหลือเวลา 15 นาที | new meeting dialog | `"Stratis warns you when 15 minutes are left.": "Stratis จะแจ้งเตือนเมื่อเหลือเวลา 15 นาที",` |
| Meeting date | วันที่ประชุม | new meeting dialog | `"Meeting date": "วันที่ประชุม",` |
| Start time | เวลาเริ่ม | new meeting dialog | `"Start time": "เวลาเริ่ม",` |
| Pick a time | เลือกเวลา | new meeting dialog | `"Pick a time": "เลือกเวลา",` |
| Starts | เริ่ม | new meeting dialog | `Starts: "เริ่ม",` |
| Now | ตอนนี้ | app shell / header, new meeting dialog, offline demo data | `Now: "ตอนนี้",` |
| Name a new project | ตั้งชื่อโปรเจกต์ใหม่ | new meeting dialog | `"Name a new project": "ตั้งชื่อโปรเจกต์ใหม่",` |
| Already exists — pick it so the history stays together | มีโปรเจกต์นี้อยู่แล้ว — เลือกโปรเจกต์เดิมเพื่อเก็บประวัติไว้ด้วยกัน | new meeting dialog | `"Already exists — pick it so the history stays together": "มีโปรเจกต์นี้อยู่แล้ว — เลือกโปรเจกต์เดิมเพื่อเก็บประวัติไว้ด้วยกัน",` |
| (optional) | (ไม่บังคับ) | new meeting dialog | `"(optional)": "(ไม่บังคับ)",` |
| Today | วันนี้ | new meeting dialog | `Today: "วันนี้",` |
| Tomorrow | พรุ่งนี้ | new meeting dialog | `Tomorrow: "พรุ่งนี้",` |
| Add an agenda or context | เพิ่มวาระหรือบริบท | new meeting dialog | `"Add an agenda or context": "เพิ่มวาระหรือบริบท",` |
| Starts now | เริ่มตอนนี้ | new meeting dialog | `"Starts now": "เริ่มตอนนี้",` |
| · {n} min | · {n} นาที | not found in the UI source — may be dead | `"· {n} min": "· {n} นาที",` |
| Start {n}-min meeting | เริ่มประชุม {n} นาที | not found in the UI source — may be dead | `"Start {n}-min meeting": "เริ่มประชุม {n} นาที",` |
| Schedule meeting | จัดตารางการประชุม | new meeting dialog | `"Schedule meeting": "จัดตารางการประชุม",` |
| Scheduling... | กำลังจัดตาราง... | new meeting dialog | `"Scheduling...": "กำลังจัดตาราง...",` |
| Starting... | กำลังเริ่ม... | new meeting dialog | `"Starting...": "กำลังเริ่ม...",` |

## Document view

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| PM Documents | เอกสาร PM | project document | `"PM Documents": "เอกสาร PM",` |
| PM DOCUMENT · SOURCE OF TRUTH | เอกสาร PM · ข้อมูลอ้างอิงหลัก | project document | `"PM DOCUMENT · SOURCE OF TRUTH": "เอกสาร PM · ข้อมูลอ้างอิงหลัก",` |
| Contents | สารบัญ | project document | `Contents: "สารบัญ",` |
| Table of contents | สารบัญ | project document | `"Table of contents": "สารบัญ",` |
| Versions | เวอร์ชัน | project document | `Versions: "เวอร์ชัน",` |
| Restore this version | กู้คืนเวอร์ชันนี้ | project document | `"Restore this version": "กู้คืนเวอร์ชันนี้",` |
| Edit section | แก้ไขหัวข้อ | project document | `"Edit section": "แก้ไขหัวข้อ",` |
| Section content | เนื้อหาหัวข้อ | project document | `"Section content": "เนื้อหาหัวข้อ",` |
| Proposed change | การแก้ไขที่เสนอ | project document | `"Proposed change": "การแก้ไขที่เสนอ",` |
| Proposed change content | เนื้อหาการแก้ไขที่เสนอ | project document | `"Proposed change content": "เนื้อหาการแก้ไขที่เสนอ",` |
| Approve all | อนุมัติทั้งหมด | project document | `"Approve all": "อนุมัติทั้งหมด",` |
| Markdown supported (#, **bold**, - lists). | รองรับ Markdown (#, **ตัวหนา**, - รายการ) | project document | `"Markdown supported (#, **bold**, - lists).": "รองรับ Markdown (#, **ตัวหนา**, - รายการ)",` |
| Loading document… | กำลังโหลดเอกสาร… | project document | `"Loading document…": "กำลังโหลดเอกสาร…",` |
| No projects yet. | ยังไม่มีโปรเจกต์ | project document, projects list | `"No projects yet.": "ยังไม่มีโปรเจกต์",` |
| Select a project to view its living document. | เลือกโปรเจกต์เพื่อดูเอกสารที่อัปเดตต่อเนื่อง | project document | `"Select a project to view its living document.": "เลือกโปรเจกต์เพื่อดูเอกสารที่อัปเดตต่อเนื่อง",` |
| Remove document? | ต้องการลบเอกสารหรือไม่? | project document | `"Remove document?": "ต้องการลบเอกสารหรือไม่?",` |
| Remove document… | ลบเอกสาร… | project document | `"Remove document…": "ลบเอกสาร…",` |
| This permanently deletes the PM document and its entire version history. This can't be undone. | การลบนี้จะลบเอกสาร PM และประวัติเวอร์ชันทั้งหมดอย่างถาวร และไม่สามารถย้อนกลับได้ | project document | `"This permanently deletes the PM document and its entire version history. This can't be undone.": "การลบนี้จะลบเอกสาร PM และประวัติเวอร์ชันทั้งหมดอย่างถาวร และไม่สามารถย้อนกลับได้",` |
| This meeting didn't change the project's state. | การประชุมนี้ไม่ได้ทำให้สถานะของโปรเจกต์เปลี่ยนแปลง | project document | `"This meeting didn't change the project's state.": "การประชุมนี้ไม่ได้ทำให้สถานะของโปรเจกต์เปลี่ยนแปลง",` |

## Summary view

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Decisions | การตัดสินใจ | useCheckpoint, offline demo data, admin panel | `Decisions: "การตัดสินใจ",` |
| Action items | งานที่ต้องทำ | summaryExport, meeting summary | `"Action items": "งานที่ต้องทำ",` |
| Edit | แก้ไข | end-of-meeting checkpoint, new meeting dialog, useCheckpoint | `Edit: "แก้ไข",` |
| One line per item. | หนึ่งรายการต่อหนึ่งบรรทัด | meeting summary | `"One line per item.": "หนึ่งรายการต่อหนึ่งบรรทัด",` |
| UNCONFIRMED | ยังไม่ยืนยัน | meeting summary | `UNCONFIRMED: "ยังไม่ยืนยัน",` |
| Edited by facilitator | แก้ไขโดยผู้ดำเนินการประชุม | meeting summary | `"Edited by facilitator": "แก้ไขโดยผู้ดำเนินการประชุม",` |
| Rewritten by the facilitator — not the AI's wording | เขียนใหม่โดยผู้ดำเนินการประชุม — ไม่ใช่ข้อความที่ AI สร้าง | meeting summary | `"Rewritten by the facilitator — not the AI's wording": "เขียนใหม่โดยผู้ดำเนินการประชุม — ไม่ใช่ข้อความที่ AI สร้าง",` |
| No summary available. | ยังไม่มีสรุป | meeting summary | `"No summary available.": "ยังไม่มีสรุป",` |
| Generating summary from meeting transcript... | กำลังสร้างสรุปจากบทถอดเสียงการประชุม... | meeting summary | `"Generating summary from meeting transcript...": "กำลังสร้างสรุปจากบทถอดเสียงการประชุม...",` |

## Settings

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Your profile | โปรไฟล์ของคุณ | settings | `"Your profile": "โปรไฟล์ของคุณ",` |
| Profile | โปรไฟล์ | settings | `Profile: "โปรไฟล์",` |
| Account | บัญชี | admin panel, settings | `Account: "บัญชี",` |
| Preferences | การตั้งค่า | left sidebar, settings | `Preferences: "การตั้งค่า",` |
| Notifications | การแจ้งเตือน | settings | `Notifications: "การแจ้งเตือน",` |
| Accessibility | การช่วยการเข้าถึง | not found in the UI source — may be dead | `Accessibility: "การช่วยการเข้าถึง",` |
| Security | ความปลอดภัย | settings | `Security: "ความปลอดภัย",` |
| About | เกี่ยวกับ | public landing page, settings | `About: "เกี่ยวกับ",` |
| Display name | ชื่อที่แสดง | settings | `"Display name": "ชื่อที่แสดง",` |
| How your name appears on decisions, summaries, and the meeting room. | ชื่อที่จะแสดงในส่วนการตัดสินใจ สรุป และห้องประชุม | settings | `"How your name appears on decisions, summaries, and the meeting room.": "ชื่อที่จะแสดงในส่วนการตัดสินใจ สรุป และห้องประชุม",` |
| Role or title | ตำแหน่งหรือบทบาท | settings | `"Role or title": "ตำแหน่งหรือบทบาท",` |
| Shown next to your name — e.g. Product Lead | แสดงถัดจากชื่อของคุณ เช่น Product Lead | settings | `"Shown next to your name — e.g. Product Lead": "แสดงถัดจากชื่อของคุณ เช่น Product Lead",` |
| Optional. A line of context for teammates. | ไม่บังคับ ใส่ข้อความสั้น ๆ เพื่อให้ทีมรู้บริบทของคุณ | settings | `"Optional. A line of context for teammates.": "ไม่บังคับ ใส่ข้อความสั้น ๆ เพื่อให้ทีมรู้บริบทของคุณ",` |
| Avatar image URL | ลิงก์รูปโปรไฟล์ | settings | `"Avatar image URL": "ลิงก์รูปโปรไฟล์",` |
| An https link to an image. There is no file upload in this build yet. | ลิงก์ https ของรูปภาพ ขณะนี้เวอร์ชันนี้ยังไม่รองรับการอัปโหลดไฟล์ | settings | `"An https link to an image. There is no file upload in this build yet.": "ลิงก์ https ของรูปภาพ ขณะนี้เวอร์ชันนี้ยังไม่รองรับการอัปโหลดไฟล์",` |
| Time zone | เขตเวลา | settings | `"Time zone": "เขตเวลา",` |
| Used for meeting times and due dates. | ใช้สำหรับเวลาเริ่มประชุมและกำหนดส่งงาน | settings | `"Used for meeting times and due dates.": "ใช้สำหรับเวลาเริ่มประชุมและกำหนดส่งงาน",` |
| Transcript language | ภาษาที่ใช้ถอดเสียง | settings | `"Transcript language": "ภาษาที่ใช้ถอดเสียง",` |
| The primary language Stratis listens for. | ภาษาหลักที่ Stratis ใช้ในการถอดเสียง | not found in the UI source — may be dead | `"The primary language Stratis listens for.": "ภาษาหลักที่ Stratis ใช้ในการถอดเสียง",` |
| English (en-US) | อังกฤษ (en-US) | not found in the UI source — may be dead | `"English (en-US)": "อังกฤษ (en-US)",` |
| Thai (th-TH) | ไทย (th-TH) | not found in the UI source — may be dead | `"Thai (th-TH)": "ไทย (th-TH)",` |
| How Stratis behaves while you are running a session. | การทำงานของ Stratis ระหว่างที่คุณกำลังประชุม | not found in the UI source — may be dead | `"How Stratis behaves while you are running a session.": "การทำงานของ Stratis ระหว่างที่คุณกำลังประชุม",` |
| Sound on new suggestion | เสียงแจ้งเตือนเมื่อมีข้อเสนอใหม่ | not found in the UI source — may be dead | `"Sound on new suggestion": "เสียงแจ้งเตือนเมื่อมีข้อเสนอใหม่",` |
| A quiet tone when a card arrives. Off by default — the room can hear you. | เสียงแจ้งเตือนเบา ๆ เมื่อมีการ์ดใหม่เข้ามา ปิดไว้เป็นค่าเริ่มต้น เพราะคนในห้องอาจได้ยิน | not found in the UI source — may be dead | `"A quiet tone when a card arrives. Off by default — the room can hear you.": "เสียงแจ้งเตือนเบา ๆ เมื่อมีการ์ดใหม่เข้ามา ปิดไว้เป็นค่าเริ่มต้น เพราะคนในห้องอาจได้ยิน",` |
| In-app notifications | การแจ้งเตือนในแอป | settings | `"In-app notifications": "การแจ้งเตือนในแอป",` |
| Email me the post-meeting summary | ส่งสรุปหลังประชุมให้ฉันทางอีเมล | not found in the UI source — may be dead | `"Email me the post-meeting summary": "ส่งสรุปหลังประชุมให้ฉันทางอีเมล",` |
| Email delivery is not connected in this build — the preference is stored and will apply when it is. | เวอร์ชันนี้ยังไม่ได้เชื่อมต่อระบบส่งอีเมล ระบบจะบันทึกการตั้งค่านี้ไว้และนำไปใช้เมื่อระบบพร้อม | not found in the UI source — may be dead | `"Email delivery is not connected in this build — the preference is stored and will apply when it is.": "เวอร์ชันนี้ยังไม่ได้เชื่อมต่อระบบส่งอีเมล ระบบจะบันทึกการตั้งค่านี้ไว้และนำไปใช้เมื่อระบบพร้อม",` |
| Send the summary automatically | ส่งสรุปโดยอัตโนมัติ | not found in the UI source — may be dead | `"Send the summary automatically": "ส่งสรุปโดยอัตโนมัติ",` |
| Skip the review step and release the summary to participants when the meeting ends. | ข้ามขั้นตอนตรวจทานและส่งสรุปให้ผู้เข้าร่วมทันทีเมื่อการประชุมจบ | not found in the UI source — may be dead | `"Skip the review step and release the summary to participants when the meeting ends.": "ข้ามขั้นตอนตรวจทานและส่งสรุปให้ผู้เข้าร่วมทันทีเมื่อการประชุมจบ",` |
| Reduce motion | ลดการเคลื่อนไหว | not found in the UI source — may be dead | `"Reduce motion": "ลดการเคลื่อนไหว",` |
| Shorter transitions between screens. | ลดเอฟเฟกต์การเปลี่ยนหน้าจอ | not found in the UI source — may be dead | `"Shorter transitions between screens.": "ลดเอฟเฟกต์การเปลี่ยนหน้าจอ",` |
| Current password | รหัสผ่านปัจจุบัน | settings | `"Current password": "รหัสผ่านปัจจุบัน",` |
| New password | รหัสผ่านใหม่ | settings | `"New password": "รหัสผ่านใหม่",` |
| Confirm new password | ยืนยันรหัสผ่านใหม่ | settings | `"Confirm new password": "ยืนยันรหัสผ่านใหม่",` |
| At least 8 characters. | อย่างน้อย 8 ตัวอักษร | settings | `"At least 8 characters.": "อย่างน้อย 8 ตัวอักษร",` |
| Password changed. Every device signed in as this account has been signed out — including this one. Please sign in again. | เปลี่ยนรหัสผ่านแล้ว อุปกรณ์ทุกเครื่องที่เข้าสู่ระบบด้วยบัญชีนี้ถูกออกจากระบบ รวมถึงเครื่องนี้ กรุณาเข้าสู่ระบบอีกครั้ง | not found in the UI source — may be dead | `"Password changed. Every device signed in as this account has been signed out — including this one. Please sign in again.": "เปลี่ยนรหัสผ่านแล้ว อุปกรณ์ทุกเครื่องที่เข้าสู่ระบบด้วยบัญชีนี้ถูกออกจากระบบ รวมถึงเครื่องนี้ กรุณาเข้าสู่ระบบอีกครั้ง",` |
| Sign-in method | วิธีเข้าสู่ระบบ | settings | `"Sign-in method": "วิธีเข้าสู่ระบบ",` |
| Member since | เป็นสมาชิกตั้งแต่ | settings | `"Member since": "เป็นสมาชิกตั้งแต่",` |
| Plan & usage | แพ็กเกจและการใช้งาน | settings | `"Plan & usage": "แพ็กเกจและการใช้งาน",` |
| Meetings this month | การประชุมเดือนนี้ | settings | `"Meetings this month": "การประชุมเดือนนี้",` |
| Sessions this month | เซสชันเดือนนี้ | settings | `"Sessions this month": "เซสชันเดือนนี้",` |
| Change plan | เปลี่ยนแพ็กเกจ | settings | `"Change plan": "เปลี่ยนแพ็กเกจ",` |
| See plans | ดูแพ็กเกจ | settings | `"See plans": "ดูแพ็กเกจ",` |
| During beta, upgrades are arranged by the Stratis team rather than charged in-app. | ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป | settings | `"During beta, upgrades are arranged by the Stratis team rather than charged in-app.": "ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป",` |
| This workspace is on the beta programme — thank you. Your feedback shapes what ships next. | เวิร์กสเปซนี้อยู่ในโปรแกรมเบต้า ขอบคุณสำหรับความคิดเห็น เพราะความคิดเห็นของคุณช่วยกำหนดสิ่งที่เราจะพัฒนาต่อ | settings | `"This workspace is on the beta programme — thank you. Your feedback shapes what ships next.": "เวิร์กสเปซนี้อยู่ในโปรแกรมเบต้า ขอบคุณสำหรับความคิดเห็น เพราะความคิดเห็นของคุณช่วยกำหนดสิ่งที่เราจะพัฒนาต่อ",` |
| Members | สมาชิก | admin panel, settings | `Members: "สมาชิก",` |
| Sessions | เซสชัน | admin panel, settings | `Sessions: "เซสชัน",` |
| Role | บทบาท | AuthContext, useSuggestionSocket, offline demo data | `Role: "บทบาท",` |
| Email & password | อีเมลและรหัสผ่าน | settings | `"Email & password": "อีเมลและรหัสผ่าน",` |

## Pricing

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Plans | แพ็กเกจ | app shell / header, plans page, meeting summary | `Plans: "แพ็กเกจ",` |
| Your plan | แพ็กเกจของคุณ | plans page, settings | `"Your plan": "แพ็กเกจของคุณ",` |
| current | ปัจจุบัน | app shell / header, AmbientBackground, CurtainTransition | `current: "ปัจจุบัน",` |
| What happens when you request an upgrade | เมื่อคุณขออัปเกรดจะเกิดอะไรขึ้น | not found in the UI source — may be dead | `"What happens when you request an upgrade": "เมื่อคุณขออัปเกรดจะเกิดอะไรขึ้น",` |
| One price covers the whole workspace — there is no per-seat maths. During the beta, upgrades are arranged by the Stratis team rather than charged in the app. | ราคาเดียวครอบคลุมทั้งเวิร์กสเปซ ไม่คิดตามจำนวนผู้ใช้ ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป | not found in the UI source — may be dead | `"One price covers the whole workspace — there is no per-seat maths. During the beta, upgrades are arranged by the Stratis team rather than charged in the app.": "ราคาเดียวครอบคลุมทั้งเวิร์กสเปซ ไม่คิดตามจำนวนผู้ใช้ ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป",` |

## Feedback modal

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| How is Stratis going for you so far? | ตอนนี้การใช้งาน Stratis เป็นอย่างไรบ้าง? | feedback dialog | `"How is Stratis going for you so far?": "ตอนนี้การใช้งาน Stratis เป็นอย่างไรบ้าง?",` |
| What kind of thing is this? | เรื่องนี้เกี่ยวกับอะไร? | feedback dialog | `"What kind of thing is this?": "เรื่องนี้เกี่ยวกับอะไร?",` |
| Something is broken | มีบางอย่างทำงานผิดปกติ | feedback dialog | `"Something is broken": "มีบางอย่างทำงานผิดปกติ",` |
| I want something | อยากได้ฟีเจอร์ใหม่ | feedback dialog | `"I want something": "อยากได้ฟีเจอร์ใหม่",` |
| This worked well | ฟีเจอร์นี้ใช้งานได้ดี | feedback dialog | `"This worked well": "ฟีเจอร์นี้ใช้งานได้ดี",` |
| Something else | เรื่องอื่น ๆ | feedback dialog | `"Something else": "เรื่องอื่น ๆ",` |
| Tell us what happened | เล่าให้เราฟังว่าเกิดอะไรขึ้น | feedback dialog | `"Tell us what happened": "เล่าให้เราฟังว่าเกิดอะไรขึ้น",` |
| What you were doing, what you expected, what you got. | บอกว่าเมื่อกี้กำลังทำอะไร คาดหวังให้เกิดอะไร และผลที่ได้เป็นอย่างไร | feedback dialog | `"What you were doing, what you expected, what you got.": "บอกว่าเมื่อกี้กำลังทำอะไร คาดหวังให้เกิดอะไร และผลที่ได้เป็นอย่างไร",` |
| Optional. | ไม่บังคับ | feedback dialog, admin panel, settings | `"Optional.": "ไม่บังคับ",` |
| Thank you | ขอบคุณ | feedback dialog | `"Thank you": "ขอบคุณ",` |
| Sent. Your workspace admins can see it, and we read every one during the beta. | ส่งเรียบร้อยแล้ว ผู้ดูแลเวิร์กสเปซของคุณจะเห็นข้อความนี้ และเราจะอ่านทุกความคิดเห็นในช่วงเบต้า | feedback dialog | `"Sent. Your workspace admins can see it, and we read every one during the beta.": "ส่งเรียบร้อยแล้ว ผู้ดูแลเวิร์กสเปซของคุณจะเห็นข้อความนี้ และเราจะอ่านทุกความคิดเห็นในช่วงเบต้า",` |
| Close | ปิด | app shell / header, AmbientBackground, end-of-meeting checkpoint | `Close: "ปิด",` |
| Send | ส่ง | feedback dialog, left sidebar, useAiBlocks | `Send: "ส่ง",` |
| Sent from | ส่งจาก | feedback dialog | `"Sent from": "ส่งจาก",` |
| . No transcript or meeting content is attached. |  ไม่มีการแนบบทถอดเสียงหรือเนื้อหาการประชุม | feedback dialog | `". No transcript or meeting content is attached.": " ไม่มีการแนบบทถอดเสียงหรือเนื้อหาการประชุม",` |

## Admin

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Team | ทีม | admin panel, public landing page, plans page | `Team: "ทีม",` |
| Members, access, invite links, and how the beta is going. | สมาชิก สิทธิ์การเข้าถึง ลิงก์เชิญ และภาพรวมการใช้งานช่วงเบต้า | not found in the UI source — may be dead | `"Members, access, invite links, and how the beta is going.": "สมาชิก สิทธิ์การเข้าถึง ลิงก์เชิญ และภาพรวมการใช้งานช่วงเบต้า",` |
| This area is for workspace admins. Ask an admin on your team to change your role if you need access. | ส่วนนี้สำหรับผู้ดูแลเวิร์กสเปซ หากต้องการเข้าถึงส่วนนี้ ให้ขอผู้ดูแลในทีมเปลี่ยนบทบาทให้คุณ | not found in the UI source — may be dead | `"This area is for workspace admins. Ask an admin on your team to change your role if you need access.": "ส่วนนี้สำหรับผู้ดูแลเวิร์กสเปซ หากต้องการเข้าถึงส่วนนี้ ให้ขอผู้ดูแลในทีมเปลี่ยนบทบาทให้คุณ",` |
| Who is using it | ใครกำลังใช้งาน | admin panel | `"Who is using it": "ใครกำลังใช้งาน",` |
| Active today | ใช้งานวันนี้ | admin panel | `"Active today": "ใช้งานวันนี้",` |
| Active this week | ใช้งานสัปดาห์นี้ | admin panel | `"Active this week": "ใช้งานสัปดาห์นี้",` |
| Active this month | ใช้งานเดือนนี้ | admin panel | `"Active this month": "ใช้งานเดือนนี้",` |
| Active members, counted from tracked events. | จำนวนสมาชิกที่ใช้งาน โดยนับจากกิจกรรมที่ระบบบันทึกไว้ | admin panel | `"Active members, counted from tracked events.": "จำนวนสมาชิกที่ใช้งาน โดยนับจากกิจกรรมที่ระบบบันทึกไว้",` |
| Daily active members | สมาชิกที่ใช้งานในแต่ละวัน | admin panel | `"Daily active members": "สมาชิกที่ใช้งานในแต่ละวัน",` |
| What they do most | สิ่งที่สมาชิกทำบ่อยที่สุด | admin panel | `"What they do most": "สิ่งที่สมาชิกทำบ่อยที่สุด",` |
| Top tracked events, last 30 days. | กิจกรรมที่ถูกบันทึกมากที่สุดในช่วง 30 วันที่ผ่านมา | admin panel | `"Top tracked events, last 30 days.": "กิจกรรมที่ถูกบันทึกมากที่สุดในช่วง 30 วันที่ผ่านมา",` |
| Last 30 days. | 30 วันที่ผ่านมา | admin panel | `"Last 30 days.": "30 วันที่ผ่านมา",` |
| Meetings and sessions | การประชุมและเซสชัน | admin panel | `"Meetings and sessions": "การประชุมและเซสชัน",` |
| Avg length | ระยะเวลาเฉลี่ย | admin panel | `"Avg length": "ระยะเวลาเฉลี่ย",` |
| Complete rate | อัตราการจบการประชุม | admin panel | `"Complete rate": "อัตราการจบการประชุม",` |
| Sessions with decisions | เซสชันที่มีการตัดสินใจ | admin panel | `"Sessions with decisions": "เซสชันที่มีการตัดสินใจ",` |
| Decisions captured | การตัดสินใจที่บันทึกไว้ | admin panel | `"Decisions captured": "การตัดสินใจที่บันทึกไว้",` |
| Decisions with an owner and a date | การตัดสินใจที่มีผู้รับผิดชอบและกำหนดวัน | admin panel | `"Decisions with an owner and a date": "การตัดสินใจที่มีผู้รับผิดชอบและกำหนดวัน",` |
| The number that says whether the product is doing its job. | ตัวเลขที่ช่วยบอกว่าผลิตภัณฑ์กำลังทำหน้าที่ได้ตามที่ควรหรือไม่ | admin panel | `"The number that says whether the product is doing its job.": "ตัวเลขที่ช่วยบอกว่าผลิตภัณฑ์กำลังทำหน้าที่ได้ตามที่ควรหรือไม่",` |
| Beta usage | การใช้งานช่วงเบต้า | not found in the UI source — may be dead | `"Beta usage": "การใช้งานช่วงเบต้า",` |
| Feedback | ความคิดเห็น | app shell / header, feedback dialog, left sidebar | `Feedback: "ความคิดเห็น",` |
| Feedback status | สถานะความคิดเห็น | admin panel | `"Feedback status": "สถานะความคิดเห็น",` |
| New | ใหม่ | new meeting dialog, offline demo data, admin panel | `New: "ใหม่",` |
| Triaged | คัดแยกแล้ว | admin panel | `Triaged: "คัดแยกแล้ว",` |
| Resolved | แก้ไขแล้ว | admin panel | `Resolved: "แก้ไขแล้ว",` |
| Won't fix | จะไม่แก้ไข | admin panel | `"Won't fix": "จะไม่แก้ไข",` |
| Notes | บันทึก | live notes ribbon, useSuggestionSocket, admin panel | `Notes: "บันทึก",` |
| Name | ชื่อ | app shell / header, new meeting dialog, left sidebar | `Name: "ชื่อ",` |
| Label | ป้ายกำกับ | app shell / header, CurtainTransition, new meeting dialog | `Label: "ป้ายกำกับ",` |
| Add a member | เพิ่มสมาชิก | admin panel | `"Add a member": "เพิ่มสมาชิก",` |
| Add member | เพิ่มสมาชิก | admin panel | `"Add member": "เพิ่มสมาชิก",` |
| Invite someone to this workspace | เชิญสมาชิกเข้าสู่เวิร์กสเปซ | admin panel | `"Invite someone to this workspace": "เชิญสมาชิกเข้าสู่เวิร์กสเปซ",` |
| Invites | คำเชิญ | admin panel | `Invites: "คำเชิญ",` |
| Existing links | ลิงก์ที่มีอยู่ | admin panel | `"Existing links": "ลิงก์ที่มีอยู่",` |
| Create link | สร้างลิงก์ | admin panel | `"Create link": "สร้างลิงก์",` |
| Role they join as | บทบาทเมื่อเข้าร่วม | admin panel | `"Role they join as": "บทบาทเมื่อเข้าร่วม",` |
| Expires in (hours) | หมดอายุใน (ชั่วโมง) | admin panel | `"Expires in (hours)": "หมดอายุใน (ชั่วโมง)",` |
| Leave blank for no expiry. | เว้นว่างไว้หากไม่ต้องการกำหนดวันหมดอายุ | admin panel | `"Leave blank for no expiry.": "เว้นว่างไว้หากไม่ต้องการกำหนดวันหมดอายุ",` |
| Maximum uses | จำนวนครั้งที่ใช้ได้สูงสุด | admin panel | `"Maximum uses": "จำนวนครั้งที่ใช้ได้สูงสุด",` |
| Blank means unlimited. | เว้นว่างไว้หากต้องการใช้ได้ไม่จำกัด | admin panel | `"Blank means unlimited.": "เว้นว่างไว้หากต้องการใช้ได้ไม่จำกัด",` |
| For your own reference — e.g. 'Beta team, batch 2'. | ใช้สำหรับอ้างอิงภายใน เช่น 'ทีมเบต้า รอบ 2' | admin panel | `"For your own reference — e.g. 'Beta team, batch 2'.": "ใช้สำหรับอ้างอิงภายใน เช่น 'ทีมเบต้า รอบ 2'",` |
| Optional. Shown to admins, not to participants. | ไม่บังคับ แสดงให้ผู้ดูแลเห็นเท่านั้น ไม่แสดงให้ผู้เข้าร่วม | admin panel | `"Optional. Shown to admins, not to participants.": "ไม่บังคับ แสดงให้ผู้ดูแลเห็นเท่านั้น ไม่แสดงให้ผู้เข้าร่วม",` |
| Anyone with the link can join with the role you pick, until it expires or is used up. | ทุกคนที่มีลิงก์สามารถเข้าร่วมด้วยบทบาทที่คุณกำหนดได้ จนกว่าลิงก์จะหมดอายุหรือถูกใช้ครบจำนวน | admin panel | `"Anyone with the link can join with the role you pick, until it expires or is used up.": "ทุกคนที่มีลิงก์สามารถเข้าร่วมด้วยบทบาทที่คุณกำหนดได้ จนกว่าลิงก์จะหมดอายุหรือถูกใช้ครบจำนวน",` |
| Copy this now — the link is not shown again. | คัดลอกลิงก์นี้ไว้ตอนนี้ — ลิงก์จะไม่แสดงอีกหลังจากนี้ | admin panel | `"Copy this now — the link is not shown again.": "คัดลอกลิงก์นี้ไว้ตอนนี้ — ลิงก์จะไม่แสดงอีกหลังจากนี้",` |
| Changing a role or revoking access takes effect immediately — the member is signed out on their next request. | การเปลี่ยนบทบาทหรือยกเลิกสิทธิ์จะมีผลทันที และสมาชิกจะถูกออกจากระบบเมื่อมีการส่งคำขอครั้งถัดไป | admin panel | `"Changing a role or revoking access takes effect immediately — the member is signed out on their next request.": "การเปลี่ยนบทบาทหรือยกเลิกสิทธิ์จะมีผลทันที และสมาชิกจะถูกออกจากระบบเมื่อมีการส่งคำขอครั้งถัดไป",` |
| Participants join meetings. Facilitators run them. Admins manage the workspace. | ผู้เข้าร่วมเข้าประชุม ผู้ดำเนินการเป็นคนนำการประชุม และผู้ดูแลจัดการเวิร์กสเปซ | admin panel | `"Participants join meetings. Facilitators run them. Admins manage the workspace.": "ผู้เข้าร่วมเข้าประชุม ผู้ดำเนินการเป็นคนนำการประชุม และผู้ดูแลจัดการเวิร์กสเปซ",` |
| Participant | ผู้เข้าร่วม | summaryExport, offline demo data, admin panel | `Participant: "ผู้เข้าร่วม",` |
| Facilitator | ผู้ดำเนินการประชุม | summaryExport, offline demo data, admin panel | `Facilitator: "ผู้ดำเนินการประชุม",` |
| Account created | สร้างบัญชีเมื่อ | admin panel | `"Account created": "สร้างบัญชีเมื่อ",` |
| Suspend | ระงับ | admin panel | `Suspend: "ระงับ",` |
| Restore | คืนสิทธิ์ | admin panel, project document | `Restore: "คืนสิทธิ์",` |
| Revoke | ยกเลิกสิทธิ์ | admin panel | `Revoke: "ยกเลิกสิทธิ์",` |
| revoked | ยกเลิกสิทธิ์แล้ว | AuthContext, useSuggestionSocket, http | `revoked: "ยกเลิกสิทธิ์แล้ว",` |
| suspended | ถูกระงับ | AuthContext, http, offline demo data | `suspended: "ถูกระงับ",` |
| active | ใช้งานอยู่ | app shell / header, shared page panels, left sidebar | `active: "ใช้งานอยู่",` |
| Done | เสร็จสิ้น | app shell / header, MeetingTransition, empty / loading states | `Done: "เสร็จสิ้น",` |
| Sign everyone out | ออกจากระบบทุกคน | admin panel | `"Sign everyone out": "ออกจากระบบทุกคน",` |
| End every session this member has open | จบทุกเซสชันที่สมาชิกคนนี้เปิดอยู่ | admin panel | `"End every session this member has open": "จบทุกเซสชันที่สมาชิกคนนี้เปิดอยู่",` |
| Check no session is active. A forced sign-out cuts a live recording. | ตรวจสอบให้แน่ใจก่อนว่าไม่มีเซสชันที่กำลังใช้งานอยู่ เพราะการบังคับออกจากระบบจะหยุดการบันทึกที่กำลังดำเนินอยู่ | admin panel | `"Check no session is active. A forced sign-out cuts a live recording.": "ตรวจสอบให้แน่ใจก่อนว่าไม่มีเซสชันที่กำลังใช้งานอยู่ เพราะการบังคับออกจากระบบจะหยุดการบันทึกที่กำลังดำเนินอยู่",` |
| Release | รีลีส | useUpdateGuard, admin panel | `Release: "รีลีส",` |
| Version | เวอร์ชัน | new meeting dialog, useUpdateGuard, track | `Version: "เวอร์ชัน",` |
| Publish a release | เผยแพร่รีลีส | admin panel | `"Publish a release": "เผยแพร่รีลีส",` |
| Before you publish | ก่อนเผยแพร่ | admin panel | `"Before you publish": "ก่อนเผยแพร่",` |
| Whatever you deployed — a tag, a date, or a commit. | ระบุสิ่งที่คุณเพิ่งดีพลอย เช่น tag, วันที่ หรือ commit | admin panel | `"Whatever you deployed — a tag, a date, or a commit.": "ระบุสิ่งที่คุณเพิ่งดีพลอย เช่น tag, วันที่ หรือ commit",` |
| Records the version you have just deployed, and optionally ends every session that started before it. | บันทึกเวอร์ชันที่คุณเพิ่งดีพลอย และเลือกได้ว่าจะจบทุกเซสชันที่เริ่มก่อนเวอร์ชันนี้หรือไม่ | admin panel | `"Records the version you have just deployed, and optionally ends every session that started before it.": "บันทึกเวอร์ชันที่คุณเพิ่งดีพลอย และเลือกได้ว่าจะจบทุกเซสชันที่เริ่มก่อนเวอร์ชันนี้หรือไม่",` |
| Run the database migration first if the release adds columns. | หากรีลีสนี้มีการเพิ่มคอลัมน์ ให้รัน database migration ก่อน | admin panel | `"Run the database migration first if the release adds columns.": "หากรีลีสนี้มีการเพิ่มคอลัมน์ ให้รัน database migration ก่อน",` |
| Open suggestion cards are held in memory — deploying the backend loses them. | การ์ดข้อเสนอที่ยังเปิดอยู่จะเก็บไว้ในหน่วยความจำ การดีพลอย backend จะทำให้การ์ดเหล่านี้หายไป | admin panel | `"Open suggestion cards are held in memory — deploying the backend loses them.": "การ์ดข้อเสนอที่ยังเปิดอยู่จะเก็บไว้ในหน่วยความจำ การดีพลอย backend จะทำให้การ์ดเหล่านี้หายไป",` |
| Use this when the release changes the API or the login flow. Do not use it while a meeting is being recorded — it will end the facilitator's session. | ใช้เมื่อรีลีสมีการเปลี่ยน API หรือขั้นตอนการเข้าสู่ระบบ ห้ามใช้ระหว่างที่กำลังบันทึกการประชุม เพราะจะทำให้เซสชันของผู้ดำเนินการประชุมจบลง | admin panel | `"Use this when the release changes the API or the login flow. Do not use it while a meeting is being recorded — it will end the facilitator's session.": "ใช้เมื่อรีลีสมีการเปลี่ยน API หรือขั้นตอนการเข้าสู่ระบบ ห้ามใช้ระหว่างที่กำลังบันทึกการประชุม เพราะจะทำให้เซสชันของผู้ดำเนินการประชุมจบลง",` |

## Counted phrases. {n} matches any run of digits, in order.

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| {n} PROJECT | {n} โปรเจกต์ | not found in the UI source — may be dead | `"{n} PROJECT": "{n} โปรเจกต์",` |
| {n} PROJECTS | {n} โปรเจกต์ | not found in the UI source — may be dead | `"{n} PROJECTS": "{n} โปรเจกต์",` |
| {n} meeting | {n} การประชุม | not found in the UI source — may be dead | `"{n} meeting": "{n} การประชุม",` |
| {n} meetings | {n} การประชุม | not found in the UI source — may be dead | `"{n} meetings": "{n} การประชุม",` |
| {n} meeting ahead | อีก {n} การประชุม | not found in the UI source — may be dead | `"{n} meeting ahead": "อีก {n} การประชุม",` |
| {n} meetings ahead | อีก {n} การประชุม | not found in the UI source — may be dead | `"{n} meetings ahead": "อีก {n} การประชุม",` |
| {n} open question | {n} คำถามที่ยังค้างอยู่ | not found in the UI source — may be dead | `"{n} open question": "{n} คำถามที่ยังค้างอยู่",` |
| {n} open questions | {n} คำถามที่ยังค้างอยู่ | not found in the UI source — may be dead | `"{n} open questions": "{n} คำถามที่ยังค้างอยู่",` |
| {n} open thread carried in | ยกมา {n} ประเด็นที่ยังค้างอยู่ | not found in the UI source — may be dead | `"{n} open thread carried in": "ยกมา {n} ประเด็นที่ยังค้างอยู่",` |
| {n} open threads carried in | ยกมา {n} ประเด็นที่ยังค้างอยู่ | not found in the UI source — may be dead | `"{n} open threads carried in": "ยกมา {n} ประเด็นที่ยังค้างอยู่",` |
| {n} still unowned | {n} รายการยังไม่มีผู้รับผิดชอบ | not found in the UI source — may be dead | `"{n} still unowned": "{n} รายการยังไม่มีผู้รับผิดชอบ",` |
| {n} min | {n} นาที | not found in the UI source — may be dead | `"{n} min": "{n} นาที",` |
| {n} of {n} min | {n} จาก {n} นาที | not found in the UI source — may be dead | `"{n} of {n} min": "{n} จาก {n} นาที",` |
| planned {n} min | วางแผนไว้ {n} นาที | not found in the UI source — may be dead | `"planned {n} min": "วางแผนไว้ {n} นาที",` |
| TARGET: {n}m | เป้าหมาย: {n} นาที | not found in the UI source — may be dead | `"TARGET: {n}m": "เป้าหมาย: {n} นาที",` |
| Low priority · {n} | ความสำคัญต่ำ · {n} | not found in the UI source — may be dead | `"Low priority · {n}": "ความสำคัญต่ำ · {n}",` |

## Meeting room status

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Live meeting | การประชุมสด | offline demo data, public landing page, live meeting screen | `"Live meeting": "การประชุมสด",` |
| STANDBY | รอเริ่ม | live meeting screen | `STANDBY: "รอเริ่ม",` |
| Mic off | ปิดไมค์ | meeting pacing chips | `"Mic off": "ปิดไมค์",` |
| AI listening | AI กำลังฟัง | meeting pacing chips | `"AI listening": "AI กำลังฟัง",` |
| Hearing you | ได้ยินคุณ | meeting pacing chips | `"Hearing you": "ได้ยินคุณ",` |
| Thinking… | กำลังคิด… | meeting pacing chips | `"Thinking…": "กำลังคิด…",` |
| Suggestion ready | มีข้อเสนอพร้อมแล้ว | meeting pacing chips | `"Suggestion ready": "มีข้อเสนอพร้อมแล้ว",` |
| On track | เป็นไปตามแผน | meeting pacing chips | `"On track": "เป็นไปตามแผน",` |
| Overtime | เกินเวลา | meeting pacing chips | `Overtime: "เกินเวลา",` |
| (OVERTIME) | (เกินเวลา) | live meeting screen | `"(OVERTIME)": "(เกินเวลา)",` |
| Wrap-up window | ช่วงสรุปก่อนจบ | meeting pacing chips | `"Wrap-up window": "ช่วงสรุปก่อนจบ",` |
| left | เหลือ | app shell / header, AmbientBackground, end-of-meeting checkpoint | `left: "เหลือ",` |
| over | เกิน | app shell / header, AmbientBackground, BlockRenderer | `over: "เกิน",` |
| high | สูง | not found in the UI source — may be dead | `high: "สูง",` |
| medium | ปานกลาง | public landing page, sign-in screen, sign-up screen | `medium: "ปานกลาง",` |
| low | ต่ำ | app shell / header, AmbientBackground, end-of-meeting checkpoint | `low: "ต่ำ",` |
| answered | ตอบแล้ว | live suggestion cards, useLang, useSuggestionSocket | `answered: "ตอบแล้ว",` |
| open | ยังค้างอยู่ | app shell / header, end-of-meeting checkpoint, first-run language choice | `open: "ยังค้างอยู่",` |
| Start | เริ่ม | new meeting dialog, start recording dialog, useCreateMeeting | `Start: "เริ่ม",` |

## Docket / projects list chrome

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| s |  | app shell / header, main, vite-env.d | `s: "",` |
| S |  | app shell / header, main, vite-env.d | `S: "",` |
| meeting | การประชุม | app shell / header, end-of-meeting checkpoint, CurtainTransition | `meeting: "การประชุม",` |
| meetings | การประชุม | first-run language choice, start recording dialog, docketCarry.test | `meetings: "การประชุม",` |
| Session | เซสชัน | NodeTypes, AuthContext, useCreateMeeting | `Session: "เซสชัน",` |
| PROJECT | โปรเจกต์ | new meeting dialog, index.d, offline demo data | `PROJECT: "โปรเจกต์",` |
| PROJECTS | โปรเจกต์ | index.d, offline demo data | `PROJECTS: "โปรเจกต์",` |
| · last: | · ล่าสุด: | projects list | `"· last:": "· ล่าสุด:",` |
| This week | สัปดาห์นี้ | offline demo data, docket | `"This week": "สัปดาห์นี้",` |
| Later | ภายหลัง | offline demo data, docket | `Later: "ภายหลัง",` |
| Unscheduled | ยังไม่ได้กำหนดเวลา | dashboard, docket | `Unscheduled: "ยังไม่ได้กำหนดเวลา",` |
| carried in | ยกมา | docket | `"carried in": "ยกมา",` |
| open thread | ประเด็นที่ยังค้างอยู่ | docket | `"open thread": "ประเด็นที่ยังค้างอยู่",` |
| open threads | ประเด็นที่ยังค้างอยู่ | not found in the UI source — may be dead | `"open threads": "ประเด็นที่ยังค้างอยู่",` |
| still unowned | ยังไม่มีผู้รับผิดชอบ | docket | `"still unowned": "ยังไม่มีผู้รับผิดชอบ",` |
| open question | คำถามที่ยังค้างอยู่ | docket, live meeting screen | `"open question": "คำถามที่ยังค้างอยู่",` |
| open questions | คำถามที่ยังค้างอยู่ | docket | `"open questions": "คำถามที่ยังค้างอยู่",` |
| Unresolved from your checkpoints, oldest first. Scheduling one carries its wording into the new meeting's goal. | ประเด็นที่ยังไม่จบจากจุดตรวจสอบ เรียงจากเก่าสุดไปใหม่สุด เมื่อจัดตารางประชุม ประเด็นนี้จะถูกนำไปใช้เป็นเป้าหมายของการประชุมใหม่ | not found in the UI source — may be dead | `"Unresolved from your checkpoints, oldest first. Scheduling one carries its wording into the new meeting's goal.": "ประเด็นที่ยังไม่จบจากจุดตรวจสอบ เรียงจากเก่าสุดไปใหม่สุด เมื่อจัดตารางประชุม ประเด็นนี้จะถูกนำไปใช้เป็นเป้าหมายของการประชุมใหม่",` |

## Error / empty states

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Loading... | กำลังโหลด... | empty / loading states | `"Loading...": "กำลังโหลด...",` |
| Something broke on this screen | หน้านี้เกิดข้อผิดพลาด | ErrorBoundary | `"Something broke on this screen": "หน้านี้เกิดข้อผิดพลาด",` |
| Technical details | รายละเอียดทางเทคนิค | ErrorBoundary | `"Technical details": "รายละเอียดทางเทคนิค",` |
| Try again | ลองอีกครั้ง | ErrorBoundary, meeting summary | `"Try again": "ลองอีกครั้ง",` |
| Reload | โหลดใหม่ | app shell / header, ErrorBoundary | `Reload: "โหลดใหม่",` |
| Your meeting data is safe — the transcript is saved as it happens. Reloading this screen will pick up where you left off. | ข้อมูลการประชุมของคุณยังปลอดภัย บทถอดเสียงจะถูกบันทึกระหว่างการประชุม การโหลดหน้านี้ใหม่จะกลับมาทำงานต่อจากเดิม | not found in the UI source — may be dead | `"Your meeting data is safe — the transcript is saved as it happens. Reloading this screen will pick up where you left off.": "ข้อมูลการประชุมของคุณยังปลอดภัย บทถอดเสียงจะถูกบันทึกระหว่างการประชุม การโหลดหน้านี้ใหม่จะกลับมาทำงานต่อจากเดิม",` |
| No blocks yet | ยังไม่มีบล็อก | BlockRenderer | `"No blocks yet": "ยังไม่มีบล็อก",` |
| (empty) | (ว่าง) | Markdown | `"(empty)": "(ว่าง)",` |

## Demo / seeded content shown in the product tour

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Q2 revenue miss | รายได้ไตรมาส 2 พลาดเป้า | not found in the UI source — may be dead | `"Q2 revenue miss": "รายได้ไตรมาส 2 พลาดเป้า",` |
| Restructure pricing tier... | ปรับโครงสร้างแพ็กเกจราคา... | not found in the UI source — may be dead | `"Restructure pricing tier...": "ปรับโครงสร้างแพ็กเกจราคา...",` |
| Seat-based + overages | คิดตามจำนวนผู้ใช้ + ค่าบริการส่วนเกิน | not found in the UI source — may be dead | `"Seat-based + overages": "คิดตามจำนวนผู้ใช้ + ค่าบริการส่วนเกิน",` |
| Pure usage-based | คิดตามการใช้งานล้วน | not found in the UI source — may be dead | `"Pure usage-based": "คิดตามการใช้งานล้วน",` |
| Value-based pricing | ตั้งราคาตามคุณค่า | not found in the UI source — may be dead | `"Value-based pricing": "ตั้งราคาตามคุณค่า",` |
| SMB accepts metered bill... | SMB ยอมรับการคิดค่าบริการตามการใช้... | not found in the UI source — may be dead | `"SMB accepts metered bill...": "SMB ยอมรับการคิดค่าบริการตามการใช้...",` |
| Engineering ships in 6 w... | ทีมวิศวกรรมส่งงานใน 6 สัป... | not found in the UI source — may be dead | `"Engineering ships in 6 w...": "ทีมวิศวกรรมส่งงานใน 6 สัป...",` |
| Engineering capacity con... | ข้อจำกัดด้านกำลังของทีมวิศวกรรม... | not found in the UI source — may be dead | `"Engineering capacity con...": "ข้อจำกัดด้านกำลังของทีมวิศวกรรม...",` |
| triggers | กระตุ้นให้เกิด | not found in the UI source — may be dead | `triggers: "กระตุ้นให้เกิด",` |
| depends on | ขึ้นอยู่กับ | not found in the UI source — may be dead | `"depends on": "ขึ้นอยู่กับ",` |
| blocked by | ติดอยู่ที่ | not found in the UI source — may be dead | `"blocked by": "ติดอยู่ที่",` |
| Safe | ปลอดภัย | not found in the UI source — may be dead | `Safe: "ปลอดภัย",` |
| High effort | ใช้ความพยายามสูง | not found in the UI source — may be dead | `"High effort": "ใช้ความพยายามสูง",` |
| AI recommended | AI แนะนำ | not found in the UI source — may be dead | `"AI recommended": "AI แนะนำ",` |
| Validated | ตรวจสอบแล้ว | app shell / header, NodeTypes | `Validated: "ตรวจสอบแล้ว",` |
| Pricing v2 | ราคาเวอร์ชัน 2 | projects list | `"Pricing v2": "ราคาเวอร์ชัน 2",` |
| Mobile launch | เปิดตัวโมบาย | not found in the UI source — may be dead | `"Mobile launch": "เปิดตัวโมบาย",` |
| Enterprise GTM | แผนบุกตลาดองค์กร | not found in the UI source — may be dead | `"Enterprise GTM": "แผนบุกตลาดองค์กร",` |
| Q3 OKRs | OKR ไตรมาส 3 | not found in the UI source — may be dead | `"Q3 OKRs": "OKR ไตรมาส 3",` |
| In progress | กำลังดำเนินการ | not found in the UI source — may be dead | `"In progress": "กำลังดำเนินการ",` |
| Explore | สำรวจ | not found in the UI source — may be dead | `Explore: "สำรวจ",` |
| Align | หาข้อสรุปร่วมกัน | end-of-meeting checkpoint, CurtainTransition, ErrorBoundary | `Align: "หาข้อสรุปร่วมกัน",` |
| Draft | ร่าง | end-of-meeting checkpoint, meeting summary | `Draft: "ร่าง",` |
| Blocked | ติดขัด | NodeTypes | `Blocked: "ติดขัด",` |
| Needs input | ต้องการข้อมูลเพิ่มเติม | not found in the UI source — may be dead | `"Needs input": "ต้องการข้อมูลเพิ่มเติม",` |
| Strategy map | แผนกลยุทธ์ | not found in the UI source — may be dead | `"Strategy map": "แผนกลยุทธ์",` |

## Docket: resolving an open question

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Mark done | ทำเสร็จแล้ว | docket | `"Mark done": "ทำเสร็จแล้ว",` |
| Marking… | กำลังบันทึก… | docket | `"Marking…": "กำลังบันทึก…",` |
| Nothing booked yet | ยังไม่มีการประชุมที่นัดไว้ | docket | `"Nothing booked yet": "ยังไม่มีการประชุมที่นัดไว้",` |

## Starting a meeting

| English | Thai | Where it appears | Paste back |
|---|---|---|---|
| Start recording? | เริ่มบันทึกเสียงหรือไม่ | start recording dialog | `"Start recording?": "เริ่มบันทึกเสียงหรือไม่",` |
| Start recording | เริ่มบันทึกเสียง | start recording dialog | `"Start recording": "เริ่มบันทึกเสียง",` |
| Starting… | กำลังเริ่ม… | start recording dialog, docket | `"Starting…": "กำลังเริ่ม…",` |
| Length | ความยาว | feedback dialog, start recording dialog, invite link screen | `Length: "ความยาว",` |
| Goal | เป้าหมาย | new meeting dialog, start recording dialog, docket | `Goal: "เป้าหมาย",` |
| No goal set — Stratis has nothing to aim at | ยังไม่ได้ตั้งเป้าหมาย — Stratis จะไม่รู้ว่าต้องช่วยเรื่องอะไร | start recording dialog | `"No goal set — Stratis has nothing to aim at": "ยังไม่ได้ตั้งเป้าหมาย — Stratis จะไม่รู้ว่าต้องช่วยเรื่องอะไร",` |
| The microphone opens as soon as you confirm, and everyone in the room should know they are being recorded. | ไมโครโฟนจะเปิดทันทีที่ยืนยัน และทุกคนในห้องควรรู้ว่ากำลังถูกบันทึกเสียง | not found in the UI source — may be dead | `"The microphone opens as soon as you confirm, and everyone in the room should know they are being recorded.": "ไมโครโฟนจะเปิดทันทีที่ยืนยัน และทุกคนในห้องควรรู้ว่ากำลังถูกบันทึกเสียง",` |
| Nothing waiting to start. New meetings and anything you have scheduled appear here. | ยังไม่มีการประชุมที่รอเริ่ม การประชุมใหม่และที่นัดไว้จะแสดงที่นี่ | dashboard | `"Nothing waiting to start. New meetings and anything you have scheduled appear here.": "ยังไม่มีการประชุมที่รอเริ่ม การประชุมใหม่และที่นัดไว้จะแสดงที่นี่",` |
