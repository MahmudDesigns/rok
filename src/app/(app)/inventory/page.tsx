import Link from "next/link";
import { Boxes, FileDown, Inbox, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { counties, foodItems, inventory, stockIntakes, users, warehouses } from "@/db/schema";
import { requireUser, can, isNational, scopeCountyId } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtInt, toTonnes } from "@/lib/format";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { IntakeForm } from "@/components/forms/intake-form";

export const metadata = { title: "Food inventory" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = scopeCountyId(user);
  const wParam = typeof sp.w === "string" ? parseInt(sp.w, 10) : NaN;

  const scopeCond: SQL | undefined = scope ? eq(warehouses.countyId, scope) : undefined;

  const whRows = await db
    .select({ w: warehouses, countyName: counties.name })
    .from(warehouses)
    .innerJoin(counties, eq(counties.id, warehouses.countyId))
    .where(scopeCond)
    .orderBy(warehouses.name);

  const selected =
    whRows.find((r) => r.w.id === wParam) ?? whRows[0];

  const [items, stockRows, intakeRows] = await Promise.all([
    db.select().from(foodItems).orderBy(foodItems.name),
    selected
      ? db
          .select({
            inv: inventory,
            item: foodItems,
          })
          .from(inventory)
          .innerJoin(foodItems, eq(foodItems.id, inventory.foodItemId))
          .where(eq(inventory.warehouseId, selected.w.id))
          .orderBy(foodItems.name)
      : Promise.resolve([]),
    selected
      ? db
          .select({
            intake: stockIntakes,
            itemName: foodItems.name,
            unit: foodItems.unit,
            warehouseName: warehouses.name,
            receivedBy: users.name,
          })
          .from(stockIntakes)
          .innerJoin(foodItems, eq(foodItems.id, stockIntakes.foodItemId))
          .innerJoin(warehouses, eq(warehouses.id, stockIntakes.warehouseId))
          .leftJoin(users, eq(users.id, stockIntakes.receivedById))
          .where(eq(stockIntakes.warehouseId, selected.w.id))
          .orderBy(desc(stockIntakes.receivedAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  const totalKg = stockRows.reduce((acc, r) => acc + r.inv.quantity * r.item.kgPerUnit, 0);
  const capacityKg = (selected?.w.capacityTonnes ?? 1000) * 1000;
  const lowCount = stockRows.filter((r) => r.inv.quantity < r.item.lowStockThreshold).length;

  return (
    <div>
      <PageHeader
        eyebrow="Government food reserve"
        title="Food inventory"
        description="Live balances at national depots and county stores. Every distribution automatically draws down stock; every intake is posted with its source and reference."
        actions={
          <Link href="/api/reports?type=stock" className="btn-secondary">
            <FileDown size={15} />
            Stock report (CSV)
          </Link>
        }
      />

      {/* Warehouse picker */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1.5">
        {whRows.map((r) => {
          const active = selected?.w.id === r.w.id;
          return (
            <Link
              key={r.w.id}
              href={`/inventory?w=${r.w.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 font-display text-[12.5px] font-semibold ring-1 ring-inset transition-colors ${
                active
                  ? "bg-forest-700 text-white ring-forest-700"
                  : "bg-white text-stone-600 ring-stone-200 hover:bg-forest-50 hover:text-forest-800"
              }`}
            >
              <WarehouseIcon size={14} className={active ? "text-ochre-300" : "text-stone-400"} />
              {r.w.name}
              <span className={`num text-[10px] ${active ? "text-forest-200" : "text-stone-400"}`}>
                {r.countyName}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
        {can.manageStock(user) ? (
          <IntakeForm
            warehouses={whRows.map((r) => ({ id: r.w.id, name: r.w.name }))}
            items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
            defaultWarehouseId={selected?.w.id}
          />
        ) : (
          <div className="card sticky top-20 h-fit p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                <Inbox size={17} />
              </span>
              <h2 className="font-display text-[15px] font-semibold text-ink">View-only</h2>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-stone-500">
              Only warehouse managers and national officers can post stock intakes. Balances below
              update in real time as distributions are issued.
            </p>
            <div className="mt-4 rounded-xl bg-forest-50 px-4 py-3 text-[12px] leading-relaxed text-forest-800 ring-1 ring-inset ring-forest-100">
              Stock moves to allocation the moment a distribution is created, and returns
              automatically if it is cancelled — no manual recounting.
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-5">
          {selected ? (
            <>
              {/* Warehouse summary */}
              <div className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">{selected.w.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-stone-500">
                      <MapPin size={12} className="text-stone-400" />
                      {selected.w.location ?? selected.countyName} · {selected.countyName} County
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[26px] font-semibold leading-none text-ink">{toTonnes(totalKg)} t</p>
                    <p className="mt-1 text-[11.5px] text-stone-500">
                      of {fmtInt(selected.w.capacityTonnes)} t capacity
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar
                    value={totalKg}
                    max={capacityKg}
                    tone={totalKg / capacityKg > 0.85 ? "amber" : "green"}
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-stone-400">
                    <span>{Math.round((totalKg / capacityKg) * 100)}% utilised</span>
                    <span className="num">{fmtInt(Math.round(totalKg))} kg on hand</span>
                  </div>
                </div>
                {lowCount > 0 && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ochre-50 px-3 py-1.5 font-display text-[11.5px] font-semibold text-ochre-800 ring-1 ring-inset ring-ochre-200">
                    {lowCount} commodity line{lowCount === 1 ? "" : "s"} below minimum reserve
                  </p>
                )}
              </div>

              {/* Stock table */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
                  <h3 className="font-display text-[13.5px] font-semibold text-ink">Commodity balances</h3>
                  <Badge className="bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-300">
                    <Boxes size={11} />
                    {stockRows.length} lines
                  </Badge>
                </div>
                {stockRows.length === 0 ? (
                  <EmptyState
                    icon={<Boxes size={22} />}
                    title="No stock recorded"
                    body="Post the first intake for this warehouse using the registration form."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Commodity</th>
                          <th>Category</th>
                          <th className="text-right">Quantity</th>
                          <th className="text-right">Est. weight</th>
                          <th>Reserve level</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockRows.map(({ inv, item }) => {
                          const low = inv.quantity < item.lowStockThreshold;
                          const kg = inv.quantity * item.kgPerUnit;
                          return (
                            <tr key={inv.id}>
                              <td className="font-display text-[13px] font-semibold text-ink">{item.name}</td>
                              <td className="text-[12px] text-stone-500">{item.category}</td>
                              <td className="num text-right text-[13px] font-medium">
                                {fmtInt(inv.quantity)} <span className="text-[10.5px] text-stone-400">{item.unit}</span>
                              </td>
                              <td className="num text-right text-[12.5px] text-stone-600">{fmtInt(Math.round(kg))} kg</td>
                              <td className="w-44">
                                <div className="flex items-center gap-2.5">
                                  <ProgressBar
                                    value={Math.min(inv.quantity, item.lowStockThreshold * 2)}
                                    max={item.lowStockThreshold * 2}
                                    tone={low ? (inv.quantity < item.lowStockThreshold / 2 ? "red" : "amber") : "green"}
                                    className="w-24"
                                  />
                                  {low ? (
                                    <Badge className="bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">Low</Badge>
                                  ) : (
                                    <span className="font-display text-[11px] font-semibold text-forest-700">OK</span>
                                  )}
                                </div>
                              </td>
                              <td className="num text-[11.5px] text-stone-500">{fmtDate(inv.updatedAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent intakes */}
              <div className="card overflow-hidden">
                <div className="border-b border-stone-100 px-5 py-3.5">
                  <h3 className="font-display text-[13.5px] font-semibold text-ink">Recent consignments received</h3>
                </div>
                {intakeRows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-stone-400">No intakes recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Commodity</th>
                          <th className="text-right">Quantity</th>
                          <th>Source</th>
                          <th>Reference</th>
                          <th>Received by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intakeRows.map((r) => (
                          <tr key={r.intake.id}>
                            <td className="num whitespace-nowrap text-[12px] text-stone-600">{fmtDateTime(r.intake.receivedAt)}</td>
                            <td className="font-display text-[12.5px] font-semibold text-ink">{r.itemName}</td>
                            <td className="num text-right text-[12.5px] font-medium">
                              +{fmtInt(r.intake.quantity)} <span className="text-[10.5px] text-stone-400">{r.unit}</span>
                            </td>
                            <td className="text-[12px] text-stone-600">{r.intake.source}</td>
                            <td className="num text-[11.5px] text-stone-500">{r.intake.reference ?? "—"}</td>
                            <td className="text-[12px] text-stone-600">{r.receivedBy ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card">
              <EmptyState
                icon={<WarehouseIcon size={22} />}
                title="No warehouse in your scope"
                body="No depot or store has been assigned to your county yet. Contact the national administrator."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
