import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { counties, sessions, users, type User, type Role } from "@/db/schema";

const SESSION_COOKIE = "knfrms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export type SessionUser = User & { countyName: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = await db
      .select({ user: users, countyName: counties.name })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .leftJoin(counties, eq(counties.id, users.countyId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row || !row.user.active) return null;
    return { ...row.user, countyName: row.countyName ?? null };
  } catch {
    return null;
  }
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token)).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export function isNational(user: User): boolean {
  return user.role === "ADMIN" || user.role === "NATIONAL_OFFICER";
}

/** Null means unscoped (national). A number restricts data to that county. */
export function scopeCountyId(user: User): number | null {
  return isNational(user) ? null : user.countyId;
}

export const can = {
  manageUsers: (u: User) => u.role === "ADMIN",
  registerBeneficiaries: (u: User) =>
    isNational(u) || u.role === "COUNTY_OFFICER",
  manageStock: (u: User) => isNational(u) || u.role === "WAREHOUSE_MANAGER",
  manageDistributions: (u: User) => isNational(u) || u.role === "COUNTY_OFFICER",
  recordIssues: (u: User) =>
    isNational(u) || u.role === "COUNTY_OFFICER" || u.role === "WAREHOUSE_MANAGER",
  sendNotices: (u: User) => isNational(u) || u.role === "COUNTY_OFFICER",
};
