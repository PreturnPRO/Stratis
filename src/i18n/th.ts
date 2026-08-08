// English source string -> Thai. Anything absent stays English.
// The DOM translator (i18n/translateDom.ts) matches whole text nodes and a few
// attributes against these keys, so no component has to call a t() function.
export const TH: Record<string, string> = {
  // --- Sidebar / global nav ---
  Dashboard: "แดชบอร์ด",
  Docket: "วาระการประชุม",
  Projects: "โปรเจกต์",
  Project: "โปรเจกต์",
  Meeting: "การประชุม",
  Meetings: "การประชุม",
  Document: "เอกสาร",
  Settings: "ตั้งค่า",
  Admin: "ผู้ดูแลระบบ",
  "Send feedback": "ส่งความคิดเห็น",
  "Sign out": "ออกจากระบบ",
  "Sign in": "เข้าสู่ระบบ",
  "Collapse sidebar": "ย่อเมนู",
  "Expand sidebar": "ขยายเมนู",
  Guest: "ผู้เยี่ยมชม",
  "Toggle theme": "เปลี่ยนธีม",
  "Light mode": "โหมดสว่าง",
  "Dark mode": "โหมดมืด",
  "Switch language": "เปลี่ยนภาษา",
  Primary: "เมนูหลัก",
  Back: "ย้อนกลับ",
  "Go back": "ย้อนกลับ",
  Forward: "ถัดไป",
  "Go forward": "ไปข้างหน้า",

  // --- Landing ---
  "THAI + ENGLISH": "ไทย + อังกฤษ",
  "How it works": "วิธีการทำงาน",
  "How Stratis works": "Stratis ทำงานอย่างไร",
  "See it live": "ดูการทำงานจริง",
  "Get started": "เริ่มใช้งาน",
  "Get started →": "เริ่มใช้งาน →",
  "As the conversation unfolds, Stratis surfaces the question nobody thought to ask — privately, to the facilitator — and marks it answered when the room gets there.":
    "ระหว่างการประชุม Stratis จะช่วยหยิบยกคำถามที่อาจถูกมองข้ามขึ้นมาให้ผู้ดำเนินการประชุมเห็นแบบส่วนตัว และจะทำเครื่องหมายว่าได้รับคำตอบแล้วเมื่อมีการพูดถึงในที่ประชุม",
  "About us": "เกี่ยวกับเรา",
  "Just like every other meeting, except no one leaves on a misunderstanding ever again.":
    "เหมือนการประชุมทั่วไป แต่ช่วยให้ทุกคนออกจากห้องประชุมด้วยความเข้าใจตรงกัน",
  Listen: "ฟัง",
  Suggest: "แนะนำ",
  Record: "บันทึก",
  "Stratis joins your meeting and captures the live transcript — every speaker, every claim, in real time.":
    "Stratis เข้าร่วมการประชุมและถอดเสียงแบบเรียลไทม์ เก็บทั้งสิ่งที่แต่ละคนพูดและประเด็นสำคัญระหว่างการประชุม",
  "Facilitator-only cards surface the question nobody thought to ask, flag untested assumptions, and mark them answered when the room gets there.":
    "การ์ดสำหรับผู้ดำเนินการประชุมจะช่วยชี้คำถามที่อาจถูกมองข้าม เตือนถึงข้อสมมติที่ยังไม่ได้ตรวจสอบ และทำเครื่องหมายเมื่อมีการตอบประเด็นนั้นแล้ว",
  "Afterward, Stratis writes the participant summary and proposes changes to the living PM document — decisions, assumptions, risks.":
    "หลังจบการประชุม Stratis จะสรุปเนื้อหาสำหรับผู้เข้าร่วม และเสนอการแก้ไขเอกสาร PM ตามสิ่งที่เกิดขึ้นจริง เช่น การตัดสินใจ ข้อสมมติ และความเสี่ยง",
  "Listens live": "ฟังแบบเรียลไทม์",
  "Suggests privately": "แนะนำแบบส่วนตัว",
  "Updates the PM doc": "อัปเดตเอกสาร PM",
  "Remembers every decision": "เก็บทุกการตัดสินใจ",
  "Flags drift": "เตือนเมื่อเริ่มออกนอกประเด็น",
  "Ready to see it in your next meeting?":
    "พร้อมลองใช้ในการประชุมครั้งหน้าหรือยัง?",
  "Stratis — Live meeting": "Stratis — การประชุมสด",
  TRANSCRIPT: "บทถอดเสียง",
  QUESTION: "คำถาม",
  ASSUMPTION: "ข้อสมมติ",
  // The About-us team roles stay English on purpose — they are how the team
  // writes their own titles.
  "We missed Q2 by 12% — root cause looks like enterprise pricing.":
    "ไตรมาส 2 เราพลาดเป้าไป 12% ดูเหมือนว่าสาเหตุหลักจะมาจากราคาแพ็กเกจสำหรับลูกค้าองค์กร",
  "Agreed, but the sales cycle lengthened too.":
    "เห็นด้วย แต่ระยะเวลาการขายก็ยาวขึ้นเหมือนกัน",
  "8 of 12 churned customers cited pricing. That’s signal.":
    "ลูกค้าที่เลิกใช้ 8 จาก 12 รายพูดถึงเรื่องราคา นี่น่าจะเป็นสัญญาณสำคัญ",
  "Who owns the pricing decision before next meeting?":
    "ก่อนประชุมครั้งหน้า ใครเป็นคนรับผิดชอบตัดสินใจเรื่องราคา?",
  "Discussed, but no owner was named.":
    "คุยเรื่องนี้แล้ว แต่ยังไม่ได้ระบุว่าใครเป็นคนรับผิดชอบ",
  "Has anyone validated SMB accepts metered billing?":
    "มีใครลองตรวจสอบหรือยังว่า SMB ยอมรับการคิดค่าบริการตามการใช้งาน?",
  "A core assumption no one has tested.":
    "เป็นข้อสมมติสำคัญที่ยังไม่มีใครทดสอบ",

  // --- Auth: login / register / join ---
  "Sign in to Stratis": "เข้าสู่ระบบ Stratis",
  "Access the Control Room": "เข้าสู่ห้องควบคุม",
  "Email Address": "อีเมล",
  Email: "อีเมล",
  Password: "รหัสผ่าน",
  "Confirm Password": "ยืนยันรหัสผ่าน",
  "Continue with Google": "ดำเนินการต่อด้วย Google",
  "Enter Control Room": "เข้าสู่ห้องควบคุม",
  "Accessing...": "กำลังเข้าสู่ระบบ...",
  "Deploy Workspace": "สร้างเวิร์กสเปซ",
  "Initializing...": "กำลังเตรียมระบบ...",
  "Don't have an account?": "ยังไม่มีบัญชี?",
  "Create one": "สร้างบัญชี",
  "Create your account": "สร้างบัญชีของคุณ",
  "Create an account": "สร้างบัญชี",
  "Access accounts": "เข้าถึงบัญชี",
  "Already registered?": "มีบัญชีอยู่แล้ว?",
  "Full Name": "ชื่อ-นามสกุล",
  "Organization Name": "ชื่อองค์กร",
  "Initialize Master Organizational Tenant": "สร้างองค์กรหลัก",
  "Min. 8 chars, 1 letter, 1 number":
    "อย่างน้อย 8 ตัวอักษร และต้องมีตัวอักษรกับตัวเลขอย่างละ 1 ตัว",
  "Your name": "ชื่อของคุณ",
  "How you appear in the room": "ชื่อที่จะแสดงในห้องประชุม",
  Continue: "ดำเนินการต่อ",
  "I already have an account": "ฉันมีบัญชีอยู่แล้ว",
  "Or join as a guest — no account, this meeting only.":
    "หรือเข้าร่วมในฐานะผู้เยี่ยมชม ไม่ต้องสร้างบัญชี และใช้ได้เฉพาะการประชุมนี้",
  "You're in": "เข้าร่วมเรียบร้อยแล้ว",
  "Go to Stratis": "ไปที่ Stratis",
  "This link no longer works": "ลิงก์นี้ใช้ไม่ได้แล้ว",
  "Stratis records and transcribes the meeting to build the summary. Everyone in the room should know it is running.":
    "Stratis จะบันทึกและถอดเสียงการประชุมเพื่อใช้สร้างสรุป ทุกคนในห้องประชุมควรทราบว่าระบบกำลังทำงาน",

  // --- Dashboard ---
  "Welcome back,": "ยินดีต้อนรับกลับ",
  "+ NEW MEETING": "+ เริ่มการประชุม",
  "LIVE NOW": "กำลังประชุม",
  "Ready to start": "พร้อมเริ่ม",
  "Recent summaries": "สรุปล่าสุด",
  "Open the docket": "เปิดวาระการประชุม",
  Refresh: "รีเฟรช",

  // --- Docket ---
  "New meeting": "ประชุมใหม่",
  Schedule: "จัดตาราง",
  "Schedule the first one": "จัดตารางการประชุมครั้งแรก",
  Live: "สด",
  Join: "เข้าร่วม",
  "Goal:": "เป้าหมาย:",
  "No goal yet — the AI has nothing to aim at.":
    "ยังไม่มีเป้าหมาย — AI ยังไม่มีบริบทสำหรับช่วยติดตาม",
  "Open questions": "คำถามที่ยังค้างอยู่",
  "Open project document": "เปิดเอกสารโปรเจกต์",
  "Prep — project document": "เตรียมตัว — เอกสารโปรเจกต์",
  "Decision meeting": "ประชุมเพื่อตัดสินใจ",
  "Carried from earlier meetings on": "ต่อเนื่องจากการประชุมก่อนหน้าเมื่อ",
  "add to your calendar (.ics)": "เพิ่มลงปฏิทินของคุณ (.ics)",
  unowned: "ยังไม่มีผู้รับผิดชอบ",

  // --- Projects ---
  "All projects": "โปรเจกต์ทั้งหมด",
  "+ NEW PROJECT": "+ โปรเจกต์ใหม่",
  "New project": "โปรเจกต์ใหม่",
  "Project name": "ชื่อโปรเจกต์",
  "e.g. Pricing v2": "เช่น Pricing v2",
  "Loading projects…": "กำลังโหลดโปรเจกต์…",
  "No projects yet. Create one, or start a meeting from the dashboard.":
    "ยังไม่มีโปรเจกต์ สร้างโปรเจกต์ใหม่หรือเริ่มการประชุมจากแดชบอร์ด",
  "PM document": "เอกสาร PM",
  // --- Meeting room ---
  LIVE: "สด",
  "Live transcript": "บทถอดเสียงแบบเรียลไทม์",
  "Active suggestions": "ข้อเสนอที่กำลังทำงาน",
  "End Meeting": "จบการประชุม",
  "End the meeting?": "ต้องการจบการประชุมหรือไม่?",
  "Keep going": "ประชุมต่อ",
  Pause: "พักชั่วคราว",
  Checkpoint: "จุดตรวจสอบ",
  "Back to meeting": "กลับไปที่การประชุม",
  "Jump to latest": "ไปยังข้อความล่าสุด",
  "Jump to latest and resume auto-scroll":
    "ไปยังข้อความล่าสุดและเลื่อนอัตโนมัติต่อ",
  "Facilitator Only": "เฉพาะผู้ดำเนินการประชุม",
  "Facilitator only": "เฉพาะผู้ดำเนินการประชุม",
  "Continuous STT Capture": "ถอดเสียงต่อเนื่อง",
  "Flushing chunk...": "กำลังส่งข้อมูลเสียง...",
  "REALTIME SYNCED": "ซิงก์แบบเรียลไทม์",
  "WEBSOCKET SYNCED": "ซิงก์ผ่าน WebSocket",
  "Go to dashboard to start one": "ไปที่แดชบอร์ดเพื่อเริ่มการประชุม",
  Agenda: "วาระการประชุม",
  "Preparing session": "กำลังเตรียมเซสชัน",
  "Strategic notes · live": "บันทึกเชิงกลยุทธ์ · สด",

  // --- Suggestion cards ---
  Question: "คำถาม",
  Assumption: "ข้อสมมติ",
  Risk: "ความเสี่ยง",
  Summary: "สรุป",
  Drift: "ออกนอกประเด็น",
  "Missing decision": "ยังไม่มีการตัดสินใจ",
  "Open question": "คำถามที่ยังค้างอยู่",
  "Mark answered": "ทำเครื่องหมายว่าตอบแล้ว",
  "✓ Answered": "✓ ตอบแล้ว",
  "Not relevant": "ไม่เกี่ยวข้อง",
  "Re-open": "เปิดอีกครั้ง",
  "Bring to front": "นำมาไว้ด้านหน้า",
  "Reviewing the conversation": "กำลังตรวจสอบบทสนทนา",
  "Reviewing the conversation…": "กำลังตรวจสอบบทสนทนา…",
  "The AI got this one wrong — remove it without recording an answer":
    "AI เข้าใจประเด็นนี้ผิด — ลบออกได้โดยไม่บันทึกคำตอบ",

  // --- Checkpoint panel ---
  "Before we close": "ก่อนจบการประชุม",
  "Close checkpoint": "ปิดจุดตรวจสอบ",
  "Decision text": "ข้อความการตัดสินใจ",
  "Edit decision text": "แก้ไขข้อความการตัดสินใจ",
  "Edit wording (STT sometimes mishears)":
    "แก้ไขข้อความ (ระบบถอดเสียงอาจฟังผิด)",
  "Dismiss decision": "ยกเลิกการตัดสินใจ",
  "Not a real decision — dismiss (undoable)":
    "ไม่ใช่การตัดสินใจจริง — ยกเลิกได้",
  "Deliberately open": "ตั้งใจให้ยังเปิดอยู่",
  "Due date": "กำหนดส่ง",
  "Due:": "กำหนด:",
  Owner: "ผู้รับผิดชอบ",
  "have a date": "มีกำหนดแล้ว",
  "NEEDS A DATE": "ต้องระบุวันที่",
  READY: "พร้อม",
  OPEN: "ยังเปิดอยู่",
  Save: "บันทึก",
  Cancel: "ยกเลิก",
  Undo: "เลิกทำ",
  "Nothing to confirm yet. Run the checkpoint once the team has decided something.":
    "ยังไม่มีอะไรให้ยืนยัน ใช้จุดตรวจสอบหลังจากทีมมีการตัดสินใจแล้ว",

  // --- New meeting modal ---
  "Start something new": "เริ่มการประชุมใหม่",
  Title: "หัวข้อ",
  "e.g. Weekly sync": "เช่น ประชุมทีมประจำสัปดาห์",
  "Kind of meeting": "ประเภทการประชุม",
  Kickoff: "เริ่มโปรเจกต์",
  "Check-in": "ติดตามงาน",
  Decision: "การตัดสินใจ",
  Other: "อื่น ๆ",
  Custom: "กำหนดเอง",
  "Regular team update": "อัปเดตทีมตามปกติ",
  "Choose between options": "เลือกจากตัวเลือก",
  "Goal — what this meeting has to settle":
    "เป้าหมาย — สิ่งที่ต้องหาข้อสรุปในการประชุมนี้",
  "One line is enough": "เขียนสั้น ๆ แค่บรรทัดเดียวก็พอ",
  "Agenda or context": "วาระหรือบริบท",
  "Anything the AI co-facilitator should know before it listens":
    "ข้อมูลที่ AI ผู้ช่วยดำเนินการประชุมควรรู้ก่อนเริ่มฟัง",
  "How long": "ระยะเวลา",
  "Meeting length in minutes": "ระยะเวลาประชุมเป็นนาที",
  "Stratis warns you when 15 minutes are left.":
    "Stratis จะแจ้งเตือนเมื่อเหลือเวลา 15 นาที",
  "Meeting date": "วันที่ประชุม",
  "Start time": "เวลาเริ่ม",
  "Pick a time": "เลือกเวลา",
  Starts: "เริ่ม",
  Now: "ตอนนี้",
  "Name a new project": "ตั้งชื่อโปรเจกต์ใหม่",
  "Already exists — pick it so the history stays together":
    "มีโปรเจกต์นี้อยู่แล้ว — เลือกโปรเจกต์เดิมเพื่อเก็บประวัติไว้ด้วยกัน",
  "(optional)": "(ไม่บังคับ)",
  Today: "วันนี้",
  Tomorrow: "พรุ่งนี้",
  "Add an agenda or context": "เพิ่มวาระหรือบริบท",
  "Starts now": "เริ่มตอนนี้",
  "· {n} min": "· {n} นาที",
  "Start {n}-min meeting": "เริ่มประชุม {n} นาที",
  "Schedule meeting": "จัดตารางการประชุม",
  "Scheduling...": "กำลังจัดตาราง...",
  "Starting...": "กำลังเริ่ม...",

  // --- Document view ---
  "PM Documents": "เอกสาร PM",
  "PM DOCUMENT · SOURCE OF TRUTH": "เอกสาร PM · ข้อมูลอ้างอิงหลัก",
  Contents: "สารบัญ",
  "Table of contents": "สารบัญ",
  Versions: "เวอร์ชัน",
  "Restore this version": "กู้คืนเวอร์ชันนี้",
  "Edit section": "แก้ไขหัวข้อ",
  "Section content": "เนื้อหาหัวข้อ",
  "Proposed change": "การแก้ไขที่เสนอ",
  "Proposed change content": "เนื้อหาการแก้ไขที่เสนอ",
  "Approve all": "อนุมัติทั้งหมด",
  "Markdown supported (#, **bold**, - lists).":
    "รองรับ Markdown (#, **ตัวหนา**, - รายการ)",
  "Loading document…": "กำลังโหลดเอกสาร…",
  "No projects yet.": "ยังไม่มีโปรเจกต์",
  "Select a project to view its living document.":
    "เลือกโปรเจกต์เพื่อดูเอกสารที่อัปเดตต่อเนื่อง",
  "Remove document?": "ต้องการลบเอกสารหรือไม่?",
  "Remove document…": "ลบเอกสาร…",
  "This permanently deletes the PM document and its entire version history. This can't be undone.":
    "การลบนี้จะลบเอกสาร PM และประวัติเวอร์ชันทั้งหมดอย่างถาวร และไม่สามารถย้อนกลับได้",
  "This meeting didn't change the project's state.":
    "การประชุมนี้ไม่ได้ทำให้สถานะของโปรเจกต์เปลี่ยนแปลง",

  // --- Summary view ---
  Decisions: "การตัดสินใจ",
  "Action items": "งานที่ต้องทำ",
  Edit: "แก้ไข",
  "One line per item.": "หนึ่งรายการต่อหนึ่งบรรทัด",
  UNCONFIRMED: "ยังไม่ยืนยัน",
  "Edited by facilitator": "แก้ไขโดยผู้ดำเนินการประชุม",
  "Rewritten by the facilitator — not the AI's wording":
    "เขียนใหม่โดยผู้ดำเนินการประชุม — ไม่ใช่ข้อความที่ AI สร้าง",
  "No summary available.": "ยังไม่มีสรุป",
  "Generating summary from meeting transcript...":
    "กำลังสร้างสรุปจากบทถอดเสียงการประชุม...",

  // --- Settings ---
  "Your profile": "โปรไฟล์ของคุณ",
  Profile: "โปรไฟล์",
  Account: "บัญชี",
  Preferences: "การตั้งค่า",
  Notifications: "การแจ้งเตือน",
  Accessibility: "การช่วยการเข้าถึง",
  Security: "ความปลอดภัย",
  About: "เกี่ยวกับ",
  "Display name": "ชื่อที่แสดง",
  "How your name appears on decisions, summaries, and the meeting room.":
    "ชื่อที่จะแสดงในส่วนการตัดสินใจ สรุป และห้องประชุม",
  "Role or title": "ตำแหน่งหรือบทบาท",
  "Shown next to your name — e.g. Product Lead":
    "แสดงถัดจากชื่อของคุณ เช่น Product Lead",
  "Optional. A line of context for teammates.":
    "ไม่บังคับ ใส่ข้อความสั้น ๆ เพื่อให้ทีมรู้บริบทของคุณ",
  "Avatar image URL": "ลิงก์รูปโปรไฟล์",
  "An https link to an image. There is no file upload in this build yet.":
    "ลิงก์ https ของรูปภาพ ขณะนี้เวอร์ชันนี้ยังไม่รองรับการอัปโหลดไฟล์",
  "Time zone": "เขตเวลา",
  "Used for meeting times and due dates.":
    "ใช้สำหรับเวลาเริ่มประชุมและกำหนดส่งงาน",
  "Transcript language": "ภาษาที่ใช้ถอดเสียง",
  "The primary language Stratis listens for.":
    "ภาษาหลักที่ Stratis ใช้ในการถอดเสียง",
  "English (en-US)": "อังกฤษ (en-US)",
  "Thai (th-TH)": "ไทย (th-TH)",
  "How Stratis behaves while you are running a session.":
    "การทำงานของ Stratis ระหว่างที่คุณกำลังประชุม",
  "Sound on new suggestion": "เสียงแจ้งเตือนเมื่อมีข้อเสนอใหม่",
  "A quiet tone when a card arrives. Off by default — the room can hear you.":
    "เสียงแจ้งเตือนเบา ๆ เมื่อมีการ์ดใหม่เข้ามา ปิดไว้เป็นค่าเริ่มต้น เพราะคนในห้องอาจได้ยิน",
  "In-app notifications": "การแจ้งเตือนในแอป",
  "Email me the post-meeting summary": "ส่งสรุปหลังประชุมให้ฉันทางอีเมล",
  "Email delivery is not connected in this build — the preference is stored and will apply when it is.":
    "เวอร์ชันนี้ยังไม่ได้เชื่อมต่อระบบส่งอีเมล ระบบจะบันทึกการตั้งค่านี้ไว้และนำไปใช้เมื่อระบบพร้อม",
  "Send the summary automatically": "ส่งสรุปโดยอัตโนมัติ",
  "Skip the review step and release the summary to participants when the meeting ends.":
    "ข้ามขั้นตอนตรวจทานและส่งสรุปให้ผู้เข้าร่วมทันทีเมื่อการประชุมจบ",
  "Reduce motion": "ลดการเคลื่อนไหว",
  "Shorter transitions between screens.": "ลดเอฟเฟกต์การเปลี่ยนหน้าจอ",
  "Current password": "รหัสผ่านปัจจุบัน",
  "New password": "รหัสผ่านใหม่",
  "Confirm new password": "ยืนยันรหัสผ่านใหม่",
  "At least 8 characters.": "อย่างน้อย 8 ตัวอักษร",
  "Password changed. Every device signed in as this account has been signed out — including this one. Please sign in again.":
    "เปลี่ยนรหัสผ่านแล้ว อุปกรณ์ทุกเครื่องที่เข้าสู่ระบบด้วยบัญชีนี้ถูกออกจากระบบ รวมถึงเครื่องนี้ กรุณาเข้าสู่ระบบอีกครั้ง",
  "Sign-in method": "วิธีเข้าสู่ระบบ",
  "Member since": "เป็นสมาชิกตั้งแต่",
  "Plan & usage": "แพ็กเกจและการใช้งาน",
  "Meetings this month": "การประชุมเดือนนี้",
  "Sessions this month": "เซสชันเดือนนี้",
  "Change plan": "เปลี่ยนแพ็กเกจ",
  "See plans": "ดูแพ็กเกจ",
  "During beta, upgrades are arranged by the Stratis team rather than charged in-app.":
    "ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป",
  "This workspace is on the beta programme — thank you. Your feedback shapes what ships next.":
    "เวิร์กสเปซนี้อยู่ในโปรแกรมเบต้า ขอบคุณสำหรับความคิดเห็น เพราะความคิดเห็นของคุณช่วยกำหนดสิ่งที่เราจะพัฒนาต่อ",
  Members: "สมาชิก",
  Sessions: "เซสชัน",
  Role: "บทบาท",

  // --- Pricing ---
  Plans: "แพ็กเกจ",
  "Your plan": "แพ็กเกจของคุณ",
  current: "ปัจจุบัน",
  "What happens when you request an upgrade": "เมื่อคุณขออัปเกรดจะเกิดอะไรขึ้น",
  "One price covers the whole workspace — there is no per-seat maths. During the beta, upgrades are arranged by the Stratis team rather than charged in the app.":
    "ราคาเดียวครอบคลุมทั้งเวิร์กสเปซ ไม่คิดตามจำนวนผู้ใช้ ในช่วงเบต้า การอัปเกรดจะดำเนินการโดยทีม Stratis และยังไม่มีการเรียกเก็บเงินผ่านแอป",

  // --- Feedback modal ---
  "How is Stratis going for you so far?":
    "ตอนนี้การใช้งาน Stratis เป็นอย่างไรบ้าง?",
  "What kind of thing is this?": "เรื่องนี้เกี่ยวกับอะไร?",
  "Something is broken": "มีบางอย่างทำงานผิดปกติ",
  "I want something": "อยากได้ฟีเจอร์ใหม่",
  "This worked well": "ฟีเจอร์นี้ใช้งานได้ดี",
  "Something else": "เรื่องอื่น ๆ",
  "Tell us what happened": "เล่าให้เราฟังว่าเกิดอะไรขึ้น",
  "What you were doing, what you expected, what you got.":
    "บอกว่าเมื่อกี้กำลังทำอะไร คาดหวังให้เกิดอะไร และผลที่ได้เป็นอย่างไร",
  "Optional.": "ไม่บังคับ",
  "Thank you": "ขอบคุณ",
  "Sent. Your workspace admins can see it, and we read every one during the beta.":
    "ส่งเรียบร้อยแล้ว ผู้ดูแลเวิร์กสเปซของคุณจะเห็นข้อความนี้ และเราจะอ่านทุกความคิดเห็นในช่วงเบต้า",
  Close: "ปิด",
  Send: "ส่ง",
  "Sent from": "ส่งจาก",
  ". No transcript or meeting content is attached.":
    " ไม่มีการแนบบทถอดเสียงหรือเนื้อหาการประชุม",

  // --- Admin ---
  Team: "ทีม",
  "Members, access, invite links, and how the beta is going.":
    "สมาชิก สิทธิ์การเข้าถึง ลิงก์เชิญ และภาพรวมการใช้งานช่วงเบต้า",
  "This area is for workspace admins. Ask an admin on your team to change your role if you need access.":
    "ส่วนนี้สำหรับผู้ดูแลเวิร์กสเปซ หากต้องการเข้าถึงส่วนนี้ ให้ขอผู้ดูแลในทีมเปลี่ยนบทบาทให้คุณ",
  "Who is using it": "ใครกำลังใช้งาน",
  "Active today": "ใช้งานวันนี้",
  "Active this week": "ใช้งานสัปดาห์นี้",
  "Active this month": "ใช้งานเดือนนี้",
  "Active members, counted from tracked events.":
    "จำนวนสมาชิกที่ใช้งาน โดยนับจากกิจกรรมที่ระบบบันทึกไว้",
  "Daily active members": "สมาชิกที่ใช้งานในแต่ละวัน",
  "What they do most": "สิ่งที่สมาชิกทำบ่อยที่สุด",
  "Top tracked events, last 30 days.":
    "กิจกรรมที่ถูกบันทึกมากที่สุดในช่วง 30 วันที่ผ่านมา",
  "Last 30 days.": "30 วันที่ผ่านมา",
  "Meetings and sessions": "การประชุมและเซสชัน",
  "Avg length": "ระยะเวลาเฉลี่ย",
  "Complete rate": "อัตราการจบการประชุม",
  "Sessions with decisions": "เซสชันที่มีการตัดสินใจ",
  "Decisions captured": "การตัดสินใจที่บันทึกไว้",
  "Decisions with an owner and a date":
    "การตัดสินใจที่มีผู้รับผิดชอบและกำหนดวัน",
  "The number that says whether the product is doing its job.":
    "ตัวเลขที่ช่วยบอกว่าผลิตภัณฑ์กำลังทำหน้าที่ได้ตามที่ควรหรือไม่",
  "Beta usage": "การใช้งานช่วงเบต้า",
  Feedback: "ความคิดเห็น",
  "Feedback status": "สถานะความคิดเห็น",
  New: "ใหม่",
  Triaged: "คัดแยกแล้ว",
  Resolved: "แก้ไขแล้ว",
  "Won't fix": "จะไม่แก้ไข",
  Notes: "บันทึก",
  Name: "ชื่อ",
  Label: "ป้ายกำกับ",
  "Add a member": "เพิ่มสมาชิก",
  "Add member": "เพิ่มสมาชิก",
  "Invite someone to this workspace": "เชิญสมาชิกเข้าสู่เวิร์กสเปซ",
  Invites: "คำเชิญ",
  "Existing links": "ลิงก์ที่มีอยู่",
  "Create link": "สร้างลิงก์",
  "Role they join as": "บทบาทเมื่อเข้าร่วม",
  "Expires in (hours)": "หมดอายุใน (ชั่วโมง)",
  "Leave blank for no expiry.": "เว้นว่างไว้หากไม่ต้องการกำหนดวันหมดอายุ",
  "Maximum uses": "จำนวนครั้งที่ใช้ได้สูงสุด",
  "Blank means unlimited.": "เว้นว่างไว้หากต้องการใช้ได้ไม่จำกัด",
  "For your own reference — e.g. 'Beta team, batch 2'.":
    "ใช้สำหรับอ้างอิงภายใน เช่น 'ทีมเบต้า รอบ 2'",
  "Optional. Shown to admins, not to participants.":
    "ไม่บังคับ แสดงให้ผู้ดูแลเห็นเท่านั้น ไม่แสดงให้ผู้เข้าร่วม",
  "Anyone with the link can join with the role you pick, until it expires or is used up.":
    "ทุกคนที่มีลิงก์สามารถเข้าร่วมด้วยบทบาทที่คุณกำหนดได้ จนกว่าลิงก์จะหมดอายุหรือถูกใช้ครบจำนวน",
  "Copy this now — the link is not shown again.":
    "คัดลอกลิงก์นี้ไว้ตอนนี้ — ลิงก์จะไม่แสดงอีกหลังจากนี้",
  "Changing a role or revoking access takes effect immediately — the member is signed out on their next request.":
    "การเปลี่ยนบทบาทหรือยกเลิกสิทธิ์จะมีผลทันที และสมาชิกจะถูกออกจากระบบเมื่อมีการส่งคำขอครั้งถัดไป",
  "Participants join meetings. Facilitators run them. Admins manage the workspace.":
    "ผู้เข้าร่วมเข้าประชุม ผู้ดำเนินการเป็นคนนำการประชุม และผู้ดูแลจัดการเวิร์กสเปซ",
  Participant: "ผู้เข้าร่วม",
  Facilitator: "ผู้ดำเนินการประชุม",
  "Account created": "สร้างบัญชีเมื่อ",
  Suspend: "ระงับ",
  Restore: "คืนสิทธิ์",
  Revoke: "ยกเลิกสิทธิ์",
  revoked: "ยกเลิกสิทธิ์แล้ว",
  suspended: "ถูกระงับ",
  active: "ใช้งานอยู่",
  Done: "เสร็จสิ้น",
  "Sign everyone out": "ออกจากระบบทุกคน",
  "End every session this member has open": "จบทุกเซสชันที่สมาชิกคนนี้เปิดอยู่",
  "Check no session is active. A forced sign-out cuts a live recording.":
    "ตรวจสอบให้แน่ใจก่อนว่าไม่มีเซสชันที่กำลังใช้งานอยู่ เพราะการบังคับออกจากระบบจะหยุดการบันทึกที่กำลังดำเนินอยู่",
  Release: "รีลีส",
  Version: "เวอร์ชัน",
  "Publish a release": "เผยแพร่รีลีส",
  "Before you publish": "ก่อนเผยแพร่",
  "Whatever you deployed — a tag, a date, or a commit.":
    "ระบุสิ่งที่คุณเพิ่งดีพลอย เช่น tag, วันที่ หรือ commit",
  "Records the version you have just deployed, and optionally ends every session that started before it.":
    "บันทึกเวอร์ชันที่คุณเพิ่งดีพลอย และเลือกได้ว่าจะจบทุกเซสชันที่เริ่มก่อนเวอร์ชันนี้หรือไม่",
  "Run the database migration first if the release adds columns.":
    "หากรีลีสนี้มีการเพิ่มคอลัมน์ ให้รัน database migration ก่อน",
  "Open suggestion cards are held in memory — deploying the backend loses them.":
    "การ์ดข้อเสนอที่ยังเปิดอยู่จะเก็บไว้ในหน่วยความจำ การดีพลอย backend จะทำให้การ์ดเหล่านี้หายไป",
  "Use this when the release changes the API or the login flow. Do not use it while a meeting is being recorded — it will end the facilitator's session.":
    "ใช้เมื่อรีลีสมีการเปลี่ยน API หรือขั้นตอนการเข้าสู่ระบบ ห้ามใช้ระหว่างที่กำลังบันทึกการประชุม เพราะจะทำให้เซสชันของผู้ดำเนินการประชุมจบลง",

  // --- Counted phrases. {n} matches any run of digits, in order. ---
  "{n} PROJECT": "{n} โปรเจกต์",
  "{n} PROJECTS": "{n} โปรเจกต์",
  "{n} meeting": "{n} การประชุม",
  "{n} meetings": "{n} การประชุม",
  "{n} meeting ahead": "อีก {n} การประชุม",
  "{n} meetings ahead": "อีก {n} การประชุม",
  "{n} open question": "{n} คำถามที่ยังค้างอยู่",
  "{n} open questions": "{n} คำถามที่ยังค้างอยู่",
  "{n} open thread carried in": "ยกมา {n} ประเด็นที่ยังค้างอยู่",
  "{n} open threads carried in": "ยกมา {n} ประเด็นที่ยังค้างอยู่",
  "{n} still unowned": "{n} รายการยังไม่มีผู้รับผิดชอบ",
  "{n} min": "{n} นาที",
  "{n} of {n} min": "{n} จาก {n} นาที",
  "planned {n} min": "วางแผนไว้ {n} นาที",
  "TARGET: {n}m": "เป้าหมาย: {n} นาที",
  "Low priority · {n}": "ความสำคัญต่ำ · {n}",

  // --- Meeting room status ---
  "Live meeting": "การประชุมสด",
  STANDBY: "รอเริ่ม",
  "Mic off": "ปิดไมค์",
  "AI listening": "AI กำลังฟัง",
  "Hearing you": "ได้ยินคุณ",
  "Thinking…": "กำลังคิด…",
  "Suggestion ready": "มีข้อเสนอพร้อมแล้ว",
  "On track": "เป็นไปตามแผน",
  Overtime: "เกินเวลา",
  "(OVERTIME)": "(เกินเวลา)",
  "Wrap-up window": "ช่วงสรุปก่อนจบ",
  left: "เหลือ",
  over: "เกิน",
  high: "สูง",
  medium: "ปานกลาง",
  low: "ต่ำ",
  answered: "ตอบแล้ว",
  open: "ยังค้างอยู่",
  Start: "เริ่ม",

  // --- Docket / projects list chrome ---
  // JSX renders `{count} meeting{s}` as separate text nodes; Thai has no plural
  // marker, so the lone suffix node is blanked.
  s: "",
  S: "",
  meeting: "การประชุม",
  meetings: "การประชุม",
  Session: "เซสชัน",
  PROJECT: "โปรเจกต์",
  PROJECTS: "โปรเจกต์",
  "· last:": "· ล่าสุด:",
  "This week": "สัปดาห์นี้",
  Later: "ภายหลัง",
  Unscheduled: "ยังไม่ได้กำหนดเวลา",
  "carried in": "ยกมา",
  "open thread": "ประเด็นที่ยังค้างอยู่",
  "open threads": "ประเด็นที่ยังค้างอยู่",
  "still unowned": "ยังไม่มีผู้รับผิดชอบ",
  "open question": "คำถามที่ยังค้างอยู่",
  "open questions": "คำถามที่ยังค้างอยู่",
  "Unresolved from your checkpoints, oldest first. Scheduling one carries its wording into the new meeting's goal.":
    "ประเด็นที่ยังไม่จบจากจุดตรวจสอบ เรียงจากเก่าสุดไปใหม่สุด เมื่อจัดตารางประชุม ประเด็นนี้จะถูกนำไปใช้เป็นเป้าหมายของการประชุมใหม่",

  // --- Error / empty states ---
  "Loading...": "กำลังโหลด...",
  "Something broke on this screen": "หน้านี้เกิดข้อผิดพลาด",
  "Technical details": "รายละเอียดทางเทคนิค",
  "Try again": "ลองอีกครั้ง",
  Reload: "โหลดใหม่",
  "Your meeting data is safe — the transcript is saved as it happens. Reloading this screen will pick up where you left off.":
    "ข้อมูลการประชุมของคุณยังปลอดภัย บทถอดเสียงจะถูกบันทึกระหว่างการประชุม การโหลดหน้านี้ใหม่จะกลับมาทำงานต่อจากเดิม",
  "No blocks yet": "ยังไม่มีบล็อก",
  "(empty)": "(ว่าง)",

  // --- Demo / seeded content shown in the product tour ---
  "Q2 revenue miss": "รายได้ไตรมาส 2 พลาดเป้า",
  "Restructure pricing tier...": "ปรับโครงสร้างแพ็กเกจราคา...",
  "Seat-based + overages": "คิดตามจำนวนผู้ใช้ + ค่าบริการส่วนเกิน",
  "Pure usage-based": "คิดตามการใช้งานล้วน",
  "Value-based pricing": "ตั้งราคาตามคุณค่า",
  "SMB accepts metered bill...": "SMB ยอมรับการคิดค่าบริการตามการใช้...",
  "Engineering ships in 6 w...": "ทีมวิศวกรรมส่งงานใน 6 สัป...",
  "Engineering capacity con...": "ข้อจำกัดด้านกำลังของทีมวิศวกรรม...",
  triggers: "กระตุ้นให้เกิด",
  "depends on": "ขึ้นอยู่กับ",
  "blocked by": "ติดอยู่ที่",
  Safe: "ปลอดภัย",
  "High effort": "ใช้ความพยายามสูง",
  "AI recommended": "AI แนะนำ",
  Validated: "ตรวจสอบแล้ว",
  "Pricing v2": "ราคาเวอร์ชัน 2",
  "Mobile launch": "เปิดตัวโมบาย",
  "Enterprise GTM": "แผนบุกตลาดองค์กร",
  "Q3 OKRs": "OKR ไตรมาส 3",
  "In progress": "กำลังดำเนินการ",
  Explore: "สำรวจ",
  Align: "หาข้อสรุปร่วมกัน",
  Draft: "ร่าง",
  Blocked: "ติดขัด",
  "Needs input": "ต้องการข้อมูลเพิ่มเติม",
  "Strategy map": "แผนกลยุทธ์",
};
