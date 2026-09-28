"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { counties, users } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/format";

const VALID_ROLES = ["ADMIN", "NATIONAL_OFFICER", "COUNTY_OFFICER", "WAREHOUSE_MANAGER", "PARTNER"] as const;

export async function createUserAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("ADMIN");

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as (typeof VALID_ROLES)[number];
  const countyIdRaw = String(formData.get("countyId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 3) return { error: "Enter the officer's full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid official email address." };
  if (!VALID_ROLES.includes(role)) return { error: "Select a role." };
  if (password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) {
    return { error: "Password must be at least 8 characters and include letters and numbers." };
  }
  let countyId: number | null = null;
  if (role === "COUNTY_OFFICER" || role === "WAREHOUSE_MANAGER") {
    const cid = parseInt(countyIdRaw, 10);
    if (!Number.isInteger(cid)) return { error: "County officers and warehouse managers must be assigned to a county." };
    const c = await db.select({ id: counties.id }).from(counties).where(eq(counties.id, cid)).limit(1);
    if (!c[0]) return { error: "Unknown county." };
    countyId = cid;
  }

  const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dup[0]) return { error: `An account with ${email} already exists.` };

  const [row] = await db
    .insert(users)
    .values({ name, email, passwordHash: hashPassword(password), role, countyId, phone: phone || null })
    .returning({ id: users.id });

  await audit(user.id, "USER_CREATED", "user", row.id, `${name} registered as ${role}`);
  revalidatePath("/users");
  return { success: `Account created for ${name} (${email}). Share the password securely.` };
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const user = await requireRole("ADMIN");
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  const active = String(formData.get("active") ?? "") === "1";
  if (!Number.isInteger(id) || id === user.id) return; // cannot deactivate self
  await db.update(users).set({ active }).where(eq(users.id, id));
  await audit(user.id, active ? "USER_REACTIVATED" : "USER_DEACTIVATED", "user", id);
  revalidatePath("/users");
}
