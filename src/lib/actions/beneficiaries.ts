"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, counties } from "@/db/schema";
import { requireUser, can, isNational } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmtDate, type FormState } from "@/lib/format";

export async function registerBeneficiaryAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.registerBeneficiaries(user)) {
    return { error: "You do not have permission to register beneficiaries." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const gender = String(formData.get("gender") ?? "FEMALE");
  const birthYearRaw = String(formData.get("birthYear") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const subCounty = String(formData.get("subCounty") ?? "").trim();
  const village = String(formData.get("village") ?? "").trim();
  const householdSize = parseInt(String(formData.get("householdSize") ?? "1"), 10);
  const vulnerability = String(formData.get("vulnerability") ?? "NONE");
  let countyId = parseInt(String(formData.get("countyId") ?? ""), 10);

  if (!isNational(user)) countyId = user.countyId ?? NaN;

  if (fullName.length < 3) return { error: "Enter the beneficiary's full name (as on the National ID)." };
  if (!/^\d{6,10}$/.test(nationalId)) return { error: "National ID must be 6–10 digits, no spaces." };
  if (!Number.isInteger(countyId)) return { error: "Select the beneficiary's county." };
  if (gender !== "FEMALE" && gender !== "MALE") return { error: "Select a gender." };
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 40) {
    return { error: "Household size must be between 1 and 40." };
  }
  let birthYear: number | null = null;
  if (birthYearRaw) {
    const by = parseInt(birthYearRaw, 10);
    if (!Number.isInteger(by) || by < 1900 || by > new Date().getFullYear()) {
      return { error: "Enter a valid year of birth (e.g. 1975)." };
    }
    birthYear = by;
  }
  if (phone && !/^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) {
    return { error: "Enter a valid Kenyan mobile number (e.g. 0712 345 678)." };
  }

  const dup = await db
    .select({ id: beneficiaries.id, countyId: beneficiaries.countyId, createdAt: beneficiaries.createdAt })
    .from(beneficiaries)
    .where(eq(beneficiaries.nationalId, nationalId))
    .limit(1);
  if (dup[0]) {
    const county = await db
      .select({ name: counties.name })
      .from(counties)
      .where(eq(counties.id, dup[0].countyId))
      .limit(1);
    return {
      error: `Duplicate prevented — National ID ${nationalId} is already registered in ${county[0]?.name ?? "another county"} on ${fmtDate(dup[0].createdAt)}. Search the register instead of re-registering.`,
    };
  }

  const [row] = await db
    .insert(beneficiaries)
    .values({
      nationalId,
      fullName,
      gender,
      birthYear,
      phone: phone || null,
      countyId,
      subCounty: subCounty || null,
      village: village || null,
      householdSize,
      vulnerability,
      registeredById: user.id,
    })
    .returning({ id: beneficiaries.id });

  await audit(user.id, "BENEFICIARY_REGISTERED", "beneficiary", row.id, `${fullName} (${nationalId})`);
  revalidatePath("/beneficiaries");
  revalidatePath("/");
  return { success: `${fullName} registered successfully. National ID ${nationalId} is now in the shared register.` };
}

export async function setBeneficiaryActiveAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.registerBeneficiaries(user)) return;
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  const active = String(formData.get("active") ?? "") === "1";
  if (!Number.isInteger(id)) return;
  await db.update(beneficiaries).set({ active }).where(eq(beneficiaries.id, id));
  await audit(user.id, active ? "BENEFICIARY_REACTIVATED" : "BENEFICIARY_DEACTIVATED", "beneficiary", id);
  revalidatePath("/beneficiaries");
}
