import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";
import type { Role } from "./types";

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  console.warn("[auth] JWT_SECRET unset, using throwaway dev secret. Set JWT_SECRET now.");
  return "dev-only-throwaway-secret-not-for-production";
}

const COOKIE = "yrk_token";

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, getSecret()) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function registerUser(email: string, name: string, password: string, role = "learner") {
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing?.password) throw new Error("Email already registered");
  const hash = await hashPassword(password);
  if (existing) {
    return db.user.update({ where: { id: existing.id }, data: { name, password: hash, role } });
  }
  return db.user.create({ data: { email: email.toLowerCase(), name, password: hash, role } });
}

export async function authenticateUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.password) throw new Error("Invalid credentials");
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new Error("Invalid credentials");
  return user;
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.user.findUnique({ where: { id: payload.id } });
}

// Look up a user by email. NEVER auto-creates: invites to unknown
// emails must 404 so typos can't mint ghost accounts.
export async function getSessionUser(email?: string) {
  if (email) {
    return db.user.findUnique({ where: { email: email.toLowerCase() } });
  }
  try {
    const current = await getCurrentUser();
    if (current) return current;
  } catch { /* no cookies in plain request */ }
  return null;
}

// Cookie-only auth. The old x-user-email header fallback was removed:
// it let anyone impersonate any account without a password.
export async function getAuthUser(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/yrk_token=([^;]+)/);
  if (match) {
    const payload = verifyToken(decodeURIComponent(match[1]));
    if (payload) {
      const user = await db.user.findUnique({ where: { id: payload.id } });
      if (user) return user;
    }
  }
  return null;
}

export async function getMembership(userId: string, workspaceId: string): Promise<Role | undefined> {
  const m = await db.membership.findFirst({ where: { userId, workspaceId } });
  return m?.role as Role | undefined;
}
