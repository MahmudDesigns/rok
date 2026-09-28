"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { foodItems, inventory, stockIntakes, warehouses } from "@/db/schema";
import { requireUser, can, isNational } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmtInt, type FormState } from "@/lib/format";

export async function registerIntakeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.manageStock(user)) {
    return { error: "You do not have permission to register food stock." };
  }

  const warehouseId = parseInt(String(formData.get("warehouseId") ?? ""), 10);
  const foodItemId = parseInt(String(formData.get("foodItemId") ?? ""), 10);
  const quantity = parseInt(String(formData.get("quantity") ?? ""), 10);
  const source = String(formData.get("source") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isInteger(warehouseId)) return { error: "Select the receiving warehouse." };
  if (!Number.isInteger(foodItemId)) return { error: "Select the commodity received." };
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 500000) {
    return { error: "Quantity must be a positive whole number." };
  }
  if (!source) return { error: "Enter the source of the consignment (e.g. National Food Reserve)." };

  const wh = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!wh[0]) return { error: "Unknown warehouse." };
  // Warehouse managers may only post stock to warehouses in their county
  if (!isNational(user) && wh[0].countyId !== user.countyId) {
    return { error: "You can only post stock to warehouses in your assigned county." };
  }
  const item = await db.select().from(foodItems).where(eq(foodItems.id, foodItemId)).limit(1);
  if (!item[0]) return { error: "Unknown commodity." };

  await db.transaction(async (tx) => {
    await tx
      .insert(inventory)
      .values({ warehouseId, foodItemId, quantity, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [inventory.warehouseId, inventory.foodItemId],
        set: { quantity: sql`${inventory.quantity} + ${quantity}`, updatedAt: new Date() },
      });
    await tx.insert(stockIntakes).values({
      warehouseId,
      foodItemId,
      quantity,
      source,
      reference: reference || null,
      notes: notes || null,
      receivedById: user.id,
    });
  });

  await audit(
    user.id,
    "STOCK_INTAKE",
    "warehouse",
    warehouseId,
    `Received ${fmtInt(quantity)} × ${item[0].unit} of ${item[0].name} at ${wh[0].name} from ${source}`,
  );
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/reports");
  return {
    success: `${fmtInt(quantity)} × ${item[0].unit} of ${item[0].name} added to ${wh[0].name}. Inventory updated.`,
  };
}
