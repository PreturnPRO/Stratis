// Seed data (S1-T00-A): one org, one user per role, a couple of meetings,
// and one ended session with a transcript + summary so the dashboard has
// something to show. Idempotent — clears app rows before inserting.
import bcrypt from "bcryptjs";
import { db } from "./database";
import { newId, now } from "../lib/ids";

const PASSWORD = "password123";

function seed() {
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const ts = now();

  // Wipe in FK-safe order so re-seeding is clean.
  for (const t of [
    "consent_logs", "notifications", "node_relationships", "nodes",
    "document_versions", "documents", "transcripts", "sessions",
    "meetings", "users", "organizations",
  ]) db.prepare(`DELETE FROM ${t}`).run();

  const orgId = newId("org");
  db.prepare(`INSERT INTO organizations (id,name,created_at) VALUES (?,?,?)`)
    .run(orgId, "Stratis Demo Co.", ts);

  const users = [
    { role: "facilitator", email: "facilitator@stratis.dev", name: "Sarah K." },
    { role: "participant", email: "participant@stratis.dev", name: "Mike R." },
    { role: "admin", email: "admin@stratis.dev", name: "Alex T." },
  ] as const;

  const ids: Record<string, string> = {};
  const insUser = db.prepare(
    `INSERT INTO users (id,org_id,email,name,password_hash,role,created_at)
     VALUES (?,?,?,?,?,?,?)`
  );
  for (const u of users) {
    const id = newId("usr");
    ids[u.role] = id;
    insUser.run(id, orgId, u.email, u.name, hash, u.role, ts);
  }

  // Two upcoming meetings + one past meeting with an ended session.
  const insMeeting = db.prepare(
    `INSERT INTO meetings (id,org_id,project_id,title,scheduled_at,created_by,created_at)
     VALUES (?,?,?,?,?,?,?)`
  );
  const m1 = newId("mtg");
  const m2 = newId("mtg");
  const mPast = newId("mtg");
  insMeeting.run(m1, orgId, "pricing-v2", "Pricing v2 — sprint planning", futureISO(1), ids.facilitator, ts);
  insMeeting.run(m2, orgId, "pricing-v2", "Pricing v2 — exec review", futureISO(3), ids.facilitator, ts);
  insMeeting.run(mPast, orgId, "pricing-v2", "Pricing v2 — kickoff", pastISO(2), ids.facilitator, ts);

  const pastSession = newId("ses");
  db.prepare(
    `INSERT INTO sessions (id,meeting_id,facilitator_id,status,started_at,ended_at,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(pastSession, mPast, ids.facilitator, "ended", pastISO(2), pastISO(2), ts);

  const insTx = db.prepare(
    `INSERT INTO transcripts (id,session_id,speaker,text,timestamp) VALUES (?,?,?,?,?)`
  );
  insTx.run(newId("tx"), pastSession, "Speaker 1", "We missed Q2 by 12% — root cause looks like enterprise pricing.", pastISO(2));
  insTx.run(newId("tx"), pastSession, "Speaker 2", "Agreed, but sales cycle length played a part too.", pastISO(2));

  // A delivered summary notification so 'recent summaries' is non-empty.
  db.prepare(
    `INSERT INTO notifications (id,user_id,session_id,kind,title,body,read,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(newId("ntf"), ids.facilitator, pastSession, "summary",
        "Summary: Pricing v2 — kickoff",
        "Decided: investigate usage-based pricing. Open: validate SMB metered billing.",
        0, ts);

  console.log("[seed] done.");
  console.log("[seed] login with any of:");
  for (const u of users) console.log(`         ${u.email}  /  ${PASSWORD}   (${u.role})`);
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