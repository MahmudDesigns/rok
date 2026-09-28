"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  beneficiaries,
  counties,
  distributionItems,
  distributions,
  foodItems,
  inventory,
  issueRecords,
  notifications,
  warehouses,
} from "@/db/schema";
import { requireUser, can, isNational } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmtDate, fmtInt, type FormState } from "@/lib/format";

export async function createDistributionAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.manageDistributions(user)) {
    return { error: "You do not have permission to create distributions." };
  }

  const title = String(formData.get("title") ?? "").trim().replace(/\s+/g, " ");
  const warehouseId = parseInt(String(formData.get("warehouseId") ?? ""), 10);
  const venue = String(formData.get("venue") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduledFor") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const itemIds = formData.getAll("itemId").map((v) => parseInt(String(v), 10));
  const qtys = formData.getAll("qty").map((v) => parseInt(String(v), 10));

  if (title.length < 6) return { error: "Give the distribution a clear title (e.g. “Turkana South — Kalokol drought response”)." };
  if (!Number.isInteger(warehouseId)) return { error: "Select the source warehouse." };
  if (venue.length < 3) return { error: "Enter the venue / collection point." };
  const scheduledFor = new Date(scheduledRaw);
  if (!scheduledRaw || Number.isNaN(scheduledFor.getTime())) return { error: "Pick the distribution date and time." };

  const whRows = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  const wh = whRows[0];
  if (!wh) return { error: "Unknown warehouse." };
  if (!isNational(user) && wh.countyId !== user.countyId) {
    return { error: "You can only distribute from warehouses in your assigned county." };
  }

  const planned = new Map<number, number>();
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i];
    const qty = qtys[i];
    if (!Number.isInteger(itemId)) continue;
    if (!Number.isInteger(qty) || qty <= 0) {
      return { error: "Every commodity line needs a quantity of at least 1." };
    }
    if (qty > 200000) return { error: "Quantities look unreasonably large — please double-check." };
    planned.set(itemId, (planned.get(itemId) ?? 0) + qty);
  }
  if (planned.size === 0) return { error: "Add at least one commodity with a quantity to distribute." };

  const ids = [...planned.keys()];
  const itemRows = await db.select().from(foodItems).where(inArray(foodItems.id, ids));
  const itemName = new Map(itemRows.map((r) => [r.id, r.name]));

  const invRows = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.warehouseId, warehouseId), inArray(inventory.foodItemId, ids)));
  const available = new Map(invRows.map((r) => [r.foodItemId, r.quantity]));
  for (const [itemId, qty] of planned) {
    const have = available.get(itemId) ?? 0;
    if (have < qty) {
      return {
        error: `Insufficient stock at ${wh.name}: ${itemName.get(itemId) ?? "commodity"} has ${fmtInt(have)} available but ${fmtInt(qty)} was requested. Register an intake or reduce the quantity.`,
      };
    }
  }

  let newId = 0;
  try {
    newId = await db.transaction(async (tx) => {
      const [{ c }] = await tx.select({ c: sql<number>`count(*)` }).from(distributions);
      const ref = `KRD/${scheduledFor.getFullYear()}/${String(Number(c) + 120).padStart(4, "0")}`;
      const [row] = await tx
        .insert(distributions)
        .values({
          ref,
          title,
          countyId: wh.countyId,
          warehouseId,
          venue,
          scheduledFor,
          notes: notes || null,
          createdById: user.id,
        })
        .returning({ id: distributions.id });

      for (const [itemId, qty] of planned) {
        const res = await tx
          .update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${qty}`, updatedAt: new Date() })
          .where(
            and(
              eq(inventory.warehouseId, warehouseId),
              eq(inventory.foodItemId, itemId),
              sql`${inventory.quantity} >= ${qty}`,
            ),
          );
        if ((res.rowCount ?? 0) === 0) {
          throw new Error(`INSUFFICIENT:${itemName.get(itemId) ?? itemId}`);
        }
        await tx
          .insert(distributionItems)
          .values({ distributionId: row.id, foodItemId: itemId, plannedQty: qty, issuedQty: 0 })
          .onConflictDoNothing();
      }

      // Queue SMS notifications for registered beneficiaries in this county
      const bens = await tx
        .select({ id: beneficiaries.id, phone: beneficiaries.phone })
        .from(beneficiaries)
        .where(and(eq(beneficiaries.countyId, wh.countyId), eq(beneficiaries.active, true)))
        .limit(600);
      const withPhone = bens.filter((b) => b.phone);
      if (withPhone.length > 0) {
        const message = `GoK Relief: ${title}. Food issue on ${fmtDate(scheduledFor)} at ${venue}. Bring your National ID. — KNFRMS`;
        await tx.insert(notifications).values(
          withPhone.map((b) => ({
            distributionId: row.id,
            beneficiaryId: b.id,
            phone: b.phone!,
            message,
            status: "QUEUED" as const,
          })),
        );
      }
      return row.id;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("INSUFFICIENT:")) {
      return { error: `A competing allocation consumed the stock for ${msg.split(":")[1]}. Refresh and try again.` };
    }
    throw err;
  }

  await audit(user.id, "DISTRIBUTION_CREATED", "distribution", newId, `${title} at ${venue}; stock reserved from ${wh.name}`);
  revalidatePath("/distributions");
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect(`/distributions/${newId}?created=1`);
}

export async function setDistributionStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageDistributions(user)) return;
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  const next = String(formData.get("next") ?? "");
  if (!Number.isInteger(id)) return;

  const rows = await db.select().from(distributions).where(eq(distributions.id, id)).limit(1);
  const dist = rows[0];
  if (!dist) return;
  if (!isNational(user) && dist.countyId !== user.countyId) return;

  const allowed =
    (dist.status === "SCHEDULED" && next === "ACTIVE") ||
    (dist.status === "ACTIVE" && next === "COMPLETED") ||
    ((dist.status === "SCHEDULED" || dist.status === "ACTIVE") && next === "CANCELLED");
  if (!allowed) return;

  await db.transaction(async (tx) => {
    if (next === "CANCELLED") {
      const items = await tx
        .select()
        .from(distributionItems)
        .where(eq(distributionItems.distributionId, id));
      for (const it of items) {
        const remaining = it.plannedQty - it.issuedQty;
        if (remaining > 0) {
          await tx
            .update(inventory)
            .set({ quantity: sql`${inventory.quantity} + ${remaining}`, updatedAt: new Date() })
            .where(and(eq(inventory.warehouseId, dist.warehouseId), eq(inventory.foodItemId, it.foodItemId)));
        }
      }
    }
    await tx
      .update(distributions)
      .set({
        status: next as "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
        completedAt: next === "COMPLETED" ? new Date() : null,
      })
      .where(eq(distributions.id, id));
  });

  await audit(user.id, `DISTRIBUTION_${next}`, "distribution", id, `${dist.ref} — ${dist.title}`);
  revalidatePath(`/distributions/${id}`);
  revalidatePath("/distributions");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function recordIssueAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.recordIssues(user)) return { error: "You do not have permission to record issues." };

  const distributionId = parseInt(String(formData.get("distributionId") ?? ""), 10);
  const beneficiaryId = parseInt(String(formData.get("beneficiaryId") ?? ""), 10);
  if (!Number.isInteger(distributionId) || !Number.isInteger(beneficiaryId)) {
    return { error: "Select a beneficiary to record an issue for." };
  }

  const distRows = await db
    .select({ d: distributions, countyName: counties.name })
    .from(distributions)
    .leftJoin(counties, eq(counties.id, distributions.countyId))
    .where(eq(distributions.id, distributionId))
    .limit(1);
  const dist = distRows[0]?.d;
  if (!dist) return { error: "Unknown distribution." };
  if (dist.status === "COMPLETED" || dist.status === "CANCELLED") {
    return { error: `This distribution is ${dist.status.toLowerCase()} — issues can no longer be recorded.` };
  }
  if (!isNational(user) && user.role !== "WAREHOUSE_MANAGER" && dist.countyId !== user.countyId) {
    return { error: "This distribution is outside your assigned county." };
  }

  const ben = await db.select().from(beneficiaries).where(eq(beneficiaries.id, beneficiaryId)).limit(1);
  if (!ben[0]) return { error: "Unknown beneficiary." };
  if (ben[0].countyId !== dist.countyId) {
    return { error: `${ben[0].fullName} is registered in another county and is not on this distribution's list.` };
  }

  const items = await db
    .select({ di: distributionItems, itemName: foodItems.name, unit: foodItems.unit })
    .from(distributionItems)
    .innerJoin(foodItems, eq(foodItems.id, distributionItems.foodItemId))
    .where(eq(distributionItems.distributionId, distributionId));

  const issues: Array<{ foodItemId: number; quantity: number }> = [];
  for (const it of items) {
    const qty = parseInt(String(formData.get(`item_${it.di.foodItemId}`) ?? "0"), 10) || 0;
    if (qty < 0) return { error: "Quantities cannot be negative." };
    if (qty === 0) continue;
    const remaining = it.di.plannedQty - it.di.issuedQty;
    if (qty > remaining) {
      return { error: `Only ${fmtInt(remaining)} × ${it.unit} of ${it.itemName} remains in this allocation.` };
    }
    issues.push({ foodItemId: it.di.foodItemId, quantity: qty });
  }
  if (issues.length === 0) return { error: "Enter a quantity for at least one commodity." };

  await db.transaction(async (tx) => {
    for (const iss of issues) {
      const res = await tx
        .update(distributionItems)
        .set({ issuedQty: sql`${distributionItems.issuedQty} + ${iss.quantity}` })
        .where(
          and(
            eq(distributionItems.distributionId, distributionId),
            eq(distributionItems.foodItemId, iss.foodItemId),
            sql`${distributionItems.issuedQty} + ${iss.quantity} <= ${distributionItems.plannedQty}`,
          ),
        );
      if ((res.rowCount ?? 0) === 0) throw new Error("OVERISSUE");
      await tx.insert(issueRecords).values({
        distributionId,
        beneficiaryId,
        foodItemId: iss.foodItemId,
        quantity: iss.quantity,
        issuedById: user.id,
      });
    }
  });

  await audit(
    user.id,
    "FOOD_ISSUED",
    "distribution",
    distributionId,
    `Issued to ${ben[0].fullName} (ID ${ben[0].nationalId}) — ${issues.map((i) => `${i.quantity}× ${items.find((t) => t.di.foodItemId === i.foodItemId)?.itemName ?? ""}`).join(", ")}`,
  );
  revalidatePath(`/distributions/${distributionId}`);
  revalidatePath("/distributions");
  revalidatePath("/beneficiaries");
  revalidatePath("/");
  return { success: `Issue recorded for ${ben[0].fullName} (ID ${ben[0].nationalId}).` };
}
