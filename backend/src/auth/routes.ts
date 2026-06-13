// Auth routes (S1-T00-B): POST /api/auth/signup, /login, GET /api/auth/me.
import { Router } from "express";
import bcrypt from "bcryptjs";
import type { AuthResponse, Role, SignupRequest, LoginRequest, User } from "@shared/types";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { signToken } from "./jwt";
import { requireAuth } from "./middleware";

export const authRouter = Router();

interface UserRow {
  id: string; org_id: string; email: string; name: string;
  password_hash: string; role: Role; created_at: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id, orgId: r.org_id, email: r.email, name: r.name,
  role: r.role, createdAt: r.created_at,
});

const VALID_ROLES: Role[] = ["facilitator", "participant", "admin"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number";
  }

  return null;
}

authRouter.post("/signup", (req, res) => {
  const body = (req.body ?? {}) as SignupRequest;

  const email = cleanEmail(body.email);
  const name = cleanString(body.name);
  const password = body.password;
  const role = body.role;
  const orgName = cleanString(body.orgName);

  if (!name) {
    return res.status(400).json({ ok: false, error: "Name is required" });
  }

  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: "Name must be at least 2 characters" });
  }

  if (name.length > 80) {
    return res.status(400).json({ ok: false, error: "Name must be 80 characters or fewer" });
  }

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email is required" });
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Enter a valid email address" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ ok: false, error: passwordError });
  }

  const chosenRole: Role = role && VALID_ROLES.includes(role) ? role : "facilitator";

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) return res.status(409).json({ ok: false, error: "Email already registered" });

  const ts = now();
  const orgId = newId("org");
  db.prepare(`INSERT INTO organizations (id,name,created_at) VALUES (?,?,?)`)
    .run(orgId, orgName || `${name}'s workspace`, ts);

  const id = newId("usr");
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (id,org_id,email,name,password_hash,role,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(id, orgId, email, name, hash, chosenRole, ts);

  const user = toUser({
    id, org_id: orgId, email, name, password_hash: hash, role: chosenRole, created_at: ts,
  });
  const token = signToken({ sub: id, orgId, role: chosenRole });
  const out: AuthResponse = { token, user };
  res.status(201).json({ ok: true, data: out });
});

authRouter.post("/login", (req, res) => {
  const body = (req.body ?? {}) as LoginRequest;

  const email = cleanEmail(body.email);
  const password = body.password;

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email is required" });
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Enter a valid email address" });
  }

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ ok: false, error: "Password is required" });
  }
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ ok: false, error: "Invalid email or password" });
  }
  const token = signToken({ sub: row.id, orgId: row.org_id, role: row.role });
  const out: AuthResponse = { token, user: toUser(row) };
  res.json({ ok: true, data: out });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.auth!.sub) as UserRow | undefined;
  if (!row) return res.status(404).json({ ok: false, error: "User not found" });
  res.json({ ok: true, data: toUser(row) });
});
