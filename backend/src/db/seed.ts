// Seed data: one org, one user per role, a couple of meetings,
// and one ended session with a transcript + summary.
import bcrypt from "bcryptjs";
import { db } from "./database";
import { newId, now } from "../lib/ids";

const PASSWORD = "password123";

function pastISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function futureISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function seed() {
  try {
    console.log("[seed] starting database backfill under Final ER Diagram constraints...");
    
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const ts = now();

    // 1. SEED ORGANIZATIONS
    const orgId = "org_default";
    await db.query(
      `INSERT INTO organizations (id, name, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [orgId, "Stratis Enterprise", ts]
    );
    console.log("[seed] seeded default organization");

    // 2. SEED USERS WITH DUST-FREE ES6 DESTRUCTURING
    let facilitatorId = "";
    let participantId = "";
    let adminId = "";

    // Resolve or create Facilitator safely
    const existingFac = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      ["facilitator@stratis.dev"]
    );
    if (existingFac.rows.length > 0) {
      const [firstFac] = existingFac.rows;
      facilitatorId = firstFac.id;
      console.log(`[seed] resolved existing facilitator with ID: ${facilitatorId}`);
    } else {
      facilitatorId = "usr_facilitator";
      await db.query(
        `INSERT INTO users (id, org_id, email, name, password_hash, role, created_at)
         VALUES ($1, $2, 'facilitator@stratis.dev', 'Sarah K.', $3, 'facilitator', $4)`,
        [facilitatorId, orgId, hash, ts]
      );
      console.log("[seed] inserted default facilitator account");
    }

    // Resolve or create Participant safely
    const existingPart = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      ["participant@stratis.dev"]
    );
    if (existingPart.rows.length > 0) {
      const [firstPart] = existingPart.rows;
      participantId = firstPart.id;
      console.log(`[seed] resolved existing participant with ID: ${participantId}`);
    } else {
      participantId = "usr_participant";
      await db.query(
        `INSERT INTO users (id, org_id, email, name, password_hash, role, created_at)
         VALUES ($1, $2, 'participant@stratis.dev', 'Mike R.', $3, 'participant', $4)`,
        [participantId, orgId, hash, ts]
      );
      console.log("[seed] inserted default participant account");
    }

    // Resolve or create Admin safely
    const existingAdmin = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      ["admin@stratis.dev"]
    );
    if (existingAdmin.rows.length > 0) {
      const [firstAdmin] = existingAdmin.rows;
      adminId = firstAdmin.id;
      console.log(`[seed] resolved existing admin with ID: ${adminId}`);
    } else {
      adminId = "usr_admin";
      await db.query(
        `INSERT INTO users (id, org_id, email, name, password_hash, role, created_at)
         VALUES ($1, $2, 'admin@stratis.dev', 'System Admin', $3, 'admin', $4)`,
        [adminId, orgId, hash, ts]
      );
      console.log("[seed] inserted default admin account");
    }

    // 3. SEED PROJECTS
    const projectId = "pricing-v2";
    await db.query(
      `INSERT INTO projects (id, org_id, name, slug, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, "Pricing v2", "pricing-v2", ts, ts]
    );
    console.log("[seed] seeded project relation rows");

    // 4. SEED MEETINGS
    const pastMeetingId = "mtg_past";
    const upcomingMeetingId = "mtg_upcoming";

    await db.query(
      `INSERT INTO meetings (id, org_id, project_id, title, goal, brief, duration_minutes, scheduled_at, created_by, created_at)
       VALUES 
         ($1, $2, $3, 'Pricing Model Review', 'Choose the core pricing model for next fiscal year.', 'Review options A, B, and C.', 60, $4, $5, $6),
         ($7, $8, $9, 'Weekly Strategic Alignment', 'Align on mobile launch and capacity constraints.', 'Go over current blockers.', 45, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [
        pastMeetingId, orgId, projectId, pastISO(1), facilitatorId, pastISO(1),
        upcomingMeetingId, orgId, projectId, futureISO(2), facilitatorId, ts
      ]
    );
    console.log("[seed] seeded historical and scheduled meetings");

    // 5. SEED SESSIONS (Using dynamic facilitatorId mapping)
    const sessionId = "ses_historical";
    await db.query(
      `INSERT INTO sessions (id, meeting_id, facilitator_id, status, rolling_summary, started_at, ended_at, created_at)
       VALUES ($1, $2, $3, 'ended', 'The team is leaning heavily toward Option B (pure usage-based) pricing based on historical Intercom lift metrics.', $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [sessionId, pastMeetingId, facilitatorId, pastISO(1), pastISO(1), pastISO(1)]
    );
    console.log("[seed] seeded meeting session records");

    // 6. SEED TRANSCRIPTS
    await db.query(
      `INSERT INTO transcripts (id, session_id, speaker, text, chunk_signal, timestamp, source)
       VALUES 
         ($1, $2, 'Sarah K.', 'Okay, let''s look at the Q2 numbers. We missed our target by twelve percent.', 'IMPORTANT', $3, 'audio'),
         ($4, $5, 'Mike R.', 'I agree the miss is real, but I''m not convinced pricing is the only factor here.', 'IMPORTANT', $6, 'audio'),
         ($7, $8, 'Sarah K.', 'Option B—pure usage-based—is what the model flagged as highest confidence.', 'IMPORTANT', $9, 'audio')
       ON CONFLICT (id) DO NOTHING`,
      [
        newId("tx"), sessionId, pastISO(1),
        newId("tx"), sessionId, pastISO(1),
        newId("tx"), sessionId, pastISO(1)
      ]
    );
    console.log("[seed] seeded meeting audio transcript logs");

    // 7. SEED LIVE CARDS
    await db.query(
      `INSERT INTO live_cards (id, session_id, card_type, title, brief_description, suggested_question, urgency, state, confidence, answered, created_at)
       VALUES 
         ($1, $2, 'UNRESOLVED_ASSUMPTION', 'Metered Billing Acceptance', 'A core pricing assumption remains unvalidated.', 'Sarah, have we checked if SMB segment clients accept metered billing?', 'HIGH', 'NEW', 0.88, FALSE, $3),
         ($4, $5, 'QUESTION_SUGGESTION', 'Mobile Capacity Blockers', 'Mobile launch is currently constraining engineer resources.', 'Mike, what are the primary engineering bottlenecks blocking pricing work?', 'MEDIUM', 'NEW', 0.72, FALSE, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        newId("sug"), sessionId, pastISO(1),
        newId("sug"), sessionId, pastISO(1)
      ]
    );
    console.log("[seed] seeded persistent live co-facilitator cards");

    console.log("\n[seed] DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("\n[seed] critical crash during seeding pipeline:", err);
  } finally {
    process.exit(0);
  }
}

seed();