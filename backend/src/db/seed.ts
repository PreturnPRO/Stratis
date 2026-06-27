// Seed data: one org, one user per role, a couple of meetings,
// and one ended session with a transcript + summary.
import bcrypt from "bcryptjs";
import { db } from "./database";
import { newId, now } from "../lib/ids";

const PASSWORD = "password123";

async function seed() {
  try {
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const ts = now();

    const tables = [
      "consent_logs", "notifications", "node_relationships", "nodes",
      "document_versions", "documents", "transcripts", "sessions",
      "meetings", "users", "organizations",
    ];

    // Wipe tables. PostgreSQL TRUNCATE CASCADE is fastest here.
    for (const t of tables) {
      await db.query(`TRUNCATE TABLE ${t} CASCADE`);
    }

    const orgId = newId("org");
    await db.query(`INSERT INTO organizations (id,name,created_at) VALUES ($1,$2,$3)`, [orgId, "Stratis Demo Co.", ts]);

    const users = [
      { role: "facilitator", email: "facilitator@stratis.dev", name: "Sarah K." },
      { role: "participant", email: "participant@stratis.dev", name: "Mike R." },
      { role: "admin", email: "admin@stratis.dev", name: "Alex T." },
    ] as const;

    const ids: Record<string, string> = {};
    for (const u of users) {
      const id = newId("usr");
      ids[u.role] = id;
      await db.query(
        `INSERT INTO users (id,org_id,email,name,password_hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, orgId, u.email, u.name, hash, u.role, ts]
      );
    }

    // Two upcoming meetings + one past meeting with an ended session.
    const m1 = newId("mtg");
    const m2 = newId("mtg");
    const mPast = newId("mtg");

    await db.query(
      `INSERT INTO meetings (id,org_id,project_id,title,scheduled_at,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [m1, orgId, "pricing-v2", "Pricing v2 — sprint planning", futureISO(1), ids.facilitator, ts]
    );
    await db.query(
      `INSERT INTO meetings (id,org_id,project_id,title,scheduled_at,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [m2, orgId, "pricing-v2", "Pricing v2 — exec review", futureISO(3), ids.facilitator, ts]
    );
    await db.query(
      `INSERT INTO meetings (id,org_id,project_id,title,scheduled_at,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [mPast, orgId, "pricing-v2", "Pricing v2 — kickoff", pastISO(2), ids.facilitator, ts]
    );

    const pastSession = newId("ses");
    await db.query(
      `INSERT INTO sessions (id,meeting_id,facilitator_id,status,started_at,ended_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [pastSession, mPast, ids.facilitator, "ended", pastISO(2), pastISO(2), ts]
    );

    await db.query(
      `INSERT INTO transcripts (id,session_id,speaker,text,timestamp) VALUES ($1,$2,$3,$4,$5)`,
      [newId("tx"), pastSession, "Speaker 1", "We missed Q2 by 12% — root cause looks like enterprise pricing.", pastISO(2)]
    );
    await db.query(
      `INSERT INTO transcripts (id,session_id,speaker,text,timestamp) VALUES ($1,$2,$3,$4,$5)`,
      [newId("tx"), pastSession, "Speaker 2", "Agreed, but sales cycle length played a part too.", pastISO(2)]
    );

    // Note: read boolean is explicitly false, not 0
    await db.query(
      `INSERT INTO notifications (id,user_id,session_id,kind,title,body,read,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId("ntf"), ids.facilitator, pastSession, "summary", "Summary: Pricing v2 — kickoff", "Decided: investigate usage-based pricing. Open: validate SMB metered billing.", false, ts]
    );

    console.log("[seed] done.");
    console.log("[seed] login with any of:");
    for (const u of users) console.log(`         ${u.email}  /  ${PASSWORD}   (${u.role})`);

  } catch (err) {
    console.error("[seed] failed:", err);
  } finally {
    process.exit(0);
  }
}

function futureISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function pastISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

seed();