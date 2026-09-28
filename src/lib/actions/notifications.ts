"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, counties, notifications } from "@/db/schema";
import { requireUser, can, isNational } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/format";

/**
 * Simulated SMS gateway dispatch. If a real gateway (e.g. Africa's Talking)
 * is configured via environment variables, this is the seam where the
 * provider call would be made per queued row.
 */
export async function dispatchQueuedAction(): Promise<void> {
  const user = await requireUser();
  if (!can.sendNotices(user)) return;
  await db
    .update(notifications)
    .set({
      status: "SENT",
      sentAt: new Date(),
      providerRef: sql`'KESIM-' || (100000 + floor(random() * 900000))::int`,
    })
    .where(eq(notifications.status, "QUEUED"));
  await audit(user.id, "SMS_BATCH_DISPATCHED", "notification", null, "Queued SMS notices dispatched via gateway");
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function sendCustomNoticeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.sendNotices(user)) return { error: "You do not have permission to send notices." };

  const message = String(formData.get("message") ?? "").trim().replace(/\s+/g, " ");
  let countyId = parseInt(String(formData.get("countyId") ?? "0"), 10) || 0;

  if (message.length < 10) return { error: "Write a clear message (at least 10 characters)." };
  if (message.length > 420) return { error: "Keep the message under 420 characters (3 SMS segments)." };
  if (!isNational(user)) countyId = user.countyId ?? 0;

  let countyName = "all counties";
  if (countyId > 0) {
    const c = await db.select({ name: counties.name }).from(counties).where(eq(counties.id, countyId)).limit(1);
    if (!c[0]) return { error: "Unknown county." };
    countyName = c[0].name;
  }

  const where =
    countyId > 0
      ? and(eq(beneficiaries.countyId, countyId), eq(beneficiaries.active, true), isNotNull(beneficiaries.phone))
      : and(eq(beneficiaries.active, true), isNotNull(beneficiaries.phone));

  const targets = await db
    .select({ id: beneficiaries.id, phone: beneficiaries.phone })
    .from(beneficiaries)
    .where(where)
    .limit(1000);

  if (targets.length === 0) return { error: "No beneficiaries with phone numbers in that audience." };

  await db.insert(notifications).values(
    targets.map((t) => ({
      beneficiaryId: t.id,
      phone: t.phone!,
      message: `${message} — KNFRMS`,
      status: "QUEUED" as const,
    })),
  );

  await audit(user.id, "SMS_CUSTOM_QUEUED", "notification", null, `Custom notice queued for ${targets.length} beneficiaries (${countyName})`);
  revalidatePath("/notifications");
  revalidatePath("/");
  return { success: `Notice queued for ${targets.length} beneficiaries in ${countyName}. Dispatch the queue to send.` };
}
