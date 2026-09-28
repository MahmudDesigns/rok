import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { counties, foodItems, inventory, warehouses } from "@/db/schema";
import { requireUser, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DistributionForm } from "@/components/forms/distribution-form";

export const metadata = { title: "New distribution" };

export default async function NewDistributionPage() {
  const user = await requireUser();
  if (!can.manageDistributions(user)) redirect("/distributions");

  const scoped = user.role === "COUNTY_OFFICER" ? eq(warehouses.countyId, user.countyId ?? -1) : undefined;

  const [whRows, items, invRows] = await Promise.all([
    db
      .select({ id: warehouses.id, name: warehouses.name, countyName: counties.name })
      .from(warehouses)
      .innerJoin(counties, eq(counties.id, warehouses.countyId))
      .where(scoped)
      .orderBy(warehouses.name),
    db.select().from(foodItems).orderBy(foodItems.name),
    db.select().from(inventory),
  ]);

  if (whRows.length === 0) redirect("/distributions");

  const availability: Record<number, Record<number, number>> = {};
  for (const row of invRows) {
    (availability[row.warehouseId] ??= {})[row.foodItemId] = row.quantity;
  }

  const defaultScheduled = new Date(Date.now() + 2 * 864e5);
  defaultScheduled.setHours(8, 0, 0, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Allocation & dispatch"
        title="New distribution exercise"
        description="Reserve stock from a warehouse, set the collection point, and notify registered households in the county by SMS. Stock is drawn down immediately and tracked to each beneficiary."
      />
      <DistributionForm
        warehouses={whRows}
        items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
        availability={availability}
        defaultScheduled={defaultScheduled}
      />
    </div>
  );
}
