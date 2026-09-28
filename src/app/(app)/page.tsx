import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  FilePlus2,
  History,
  MapPin,
  PackagePlus,
  Truck,
  UserPlus,
  Users,
  Wheat,
} from "lucide-react";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  beneficiaries,
  counties,
  distributions,
  foodItems,
  inventory,
  users,
  warehouses,
} from "@/db/schema";
import { requireUser, can, scopeCountyId } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtInt, toTonnes, DIST_STATUS_META } from "@/lib/format";
import { Badge, NoticeBanner, ProgressBar, StatCard } from "@/components/ui";

export const metadata = { title: "Dashboard" };

type CountyBar = { county: string; kg: number };
type LowStockRow = {
  warehouse: string;
  county: string;
  item: string;
  unit: string;
  quantity: number;
  threshold: number;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = scopeCountyId(user);
  const scopeCond = scope ? eq(warehouses.countyId, scope) : undefined;
  const benScope = scope ? eq(beneficiaries.countyId, scope) : undefined;
  const distScope = scope ? eq(distributions.countyId, scope) : undefined;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);

  const [
    stockKgRes,
    benCountRes,
    reachedRes,
    schedCountRes,
    lowRows,
    countyBarsRes,
    upcoming,
    recentAudit,
    warehouseCountRes,
  ] = await Promise.all([
    db.execute(sql`
      SELECT coalesce(sum(i.quantity * f.kg_per_unit), 0)::float AS kg
      FROM inventory i
      JOIN food_items f ON f.id = i.food_item_id
      JOIN warehouses w ON w.id = i.warehouse_id
      ${scope ? sql`WHERE w.county_id = ${scope}` : sql``}
    `),
    db
      .select({ c: sql<number>`count(*)` })
      .from(beneficiaries)
      .where(and(eq(beneficiaries.active, true), benScope)),
    db.execute(sql`
      SELECT coalesce(sum(b.household_size), 0)::int AS people, count(*)::int AS households
      FROM (
        SELECT DISTINCT ir.beneficiary_id
        FROM issue_records ir
        JOIN distributions d ON d.id = ir.distribution_id
        WHERE ir.issued_at >= ${thirtyDaysAgo}
        ${scope ? sql`AND d.county_id = ${scope}` : sql``}
      ) t
      JOIN beneficiaries b ON b.id = t.beneficiary_id
    `),
    db
      .select({ c: sql<number>`count(*)` })
      .from(distributions)
      .where(and(inArray(distributions.status, ["SCHEDULED", "ACTIVE"]), distScope)),
    db
      .select({
        warehouse: warehouses.name,
        county: counties.name,
        item: foodItems.name,
        unit: foodItems.unit,
        quantity: inventory.quantity,
        threshold: foodItems.lowStockThreshold,
      })
      .from(inventory)
      .innerJoin(foodItems, eq(foodItems.id, inventory.foodItemId))
      .innerJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
      .innerJoin(counties, eq(counties.id, warehouses.countyId))
      .where(and(sql`${inventory.quantity} < ${foodItems.lowStockThreshold}`, scopeCond))
      .orderBy(inventory.quantity)
      .limit(6),
    db.execute(sql`
      SELECT c.name AS county, coalesce(sum(i.quantity * f.kg_per_unit), 0)::float AS kg
      FROM inventory i
      JOIN food_items f ON f.id = i.food_item_id
      JOIN warehouses w ON w.id = i.warehouse_id
      JOIN counties c ON c.id = w.county_id
      ${scope ? sql`WHERE w.county_id = ${scope}` : sql``}
      GROUP BY c.name
      ORDER BY kg DESC
      LIMIT 8
    `),
    db
      .select({
        id: distributions.id,
        ref: distributions.ref,
        title: distributions.title,
        venue: distributions.venue,
        scheduledFor: distributions.scheduledFor,
        status: distributions.status,
        county: counties.name,
      })
      .from(distributions)
      .innerJoin(counties, eq(counties.id, distributions.countyId))
      .where(and(inArray(distributions.status, ["SCHEDULED", "ACTIVE"]), gte(distributions.scheduledFor, new Date(Date.now() - 2 * 864e5)), distScope))
      .orderBy(distributions.scheduledFor)
      .limit(5),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        detail: auditLogs.detail,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(7),
    db
      .select({ c: sql<number>`count(*)` })
      .from(warehouses)
      .where(scopeCond),
  ]);

  const stockKg = Number((stockKgRes.rows[0] as { kg: number })?.kg ?? 0);
  const benCount = Number(benCountRes[0]?.c ?? 0);
  const reached = (reachedRes.rows[0] as { people: number; households: number } | undefined) ?? {
    people: 0,
    households: 0,
  };
  const schedCount = Number(schedCountRes[0]?.c ?? 0);
  const countyBars = countyBarsRes.rows as unknown as CountyBar[];
  const maxBar = Math.max(...countyBars.map((b) => b.kg), 1);
  const warehouseCount = Number(warehouseCountRes[0]?.c ?? 0);

  const firstName = user.name.split(" ")[0];

  return (
    <div>
      {/* Greeting */}
      <div className="card relative mb-6 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-ochre-400 to-forest-600" />
        <div className="flex flex-wrap items-center justify-between gap-5 p-6 sm:p-7">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">
              Relief operations centre{user.countyName ? ` — ${user.countyName} County` : " — National"}
            </p>
            <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-ink sm:text-3xl">
              Karibu, {firstName}.
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-stone-500">
              {scope
                ? `Live view of the ${user.countyName} county relief pipeline — stock, beneficiaries, distributions and notices.`
                : `Live national picture across ${fmtInt(warehouseCount)} depots and 47 counties. Every movement is recorded and auditable.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {can.manageDistributions(user) && (
              <Link href="/distributions/new" className="btn-primary">
                <Truck size={15} />
                New distribution
              </Link>
            )}
            {can.registerBeneficiaries(user) && (
              <Link href="/beneficiaries" className="btn-secondary">
                <UserPlus size={15} />
                Register beneficiary
              </Link>
            )}
            {can.manageStock(user) && (
              <Link href="/inventory" className="btn-secondary">
                <PackagePlus size={15} />
                Register stock intake
              </Link>
            )}
          </div>
        </div>
      </div>

      {lowRows.length > 0 && (
        <NoticeBanner tone="amber">
          <span className="inline-flex items-center gap-2 font-display font-semibold">
            <AlertTriangle size={15} />
            {lowRows.length} commodit{lowRows.length === 1 ? "y is" : "ies are"} below minimum reserve levels.
          </span>{" "}
          Plan replenishment with the National Food Reserve before the next distribution.{" "}
          <Link href="/inventory" className="font-display font-semibold underline underline-offset-2">
            Review inventory
          </Link>
        </NoticeBanner>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Food on hand"
          value={`${toTonnes(stockKg)} t`}
          sub="Across all depots in scope"
          icon={<Boxes size={20} strokeWidth={1.9} />}
          tone="green"
        />
        <StatCard
          label="Active beneficiaries"
          value={fmtInt(benCount)}
          sub={`Representing ${fmtInt(benCount > 0 ? benCount : 0)} registered households`}
          icon={<Users size={20} strokeWidth={1.9} />}
        />
        <StatCard
          label="People reached · 30 days"
          value={fmtInt(reached.people)}
          sub={`${fmtInt(reached.households)} households served`}
          icon={<Wheat size={20} strokeWidth={1.9} />}
          tone="amber"
        />
        <StatCard
          label="Distributions in motion"
          value={fmtInt(schedCount)}
          sub="Scheduled or currently issuing"
          icon={<Truck size={20} strokeWidth={1.9} />}
          tone="sky"
        />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Stock by county */}
        <section className="card p-6 xl:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">Food on hand by county</h2>
              <p className="mt-0.5 text-xs text-stone-500">Live warehouse balances, all commodities, in tonnes.</p>
            </div>
            <Link href="/reports?report=stock" className="inline-flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-forest-700 hover:text-forest-900">
              Full report <ArrowRight size={13} />
            </Link>
          </div>
          {countyBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">No stock recorded yet in this scope.</p>
          ) : (
            <div className="space-y-3.5">
              {countyBars.map((bar) => (
                <div key={bar.county} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 sm:grid-cols-[140px_1fr_auto]">
                  <span className="truncate font-display text-[12.5px] font-medium text-stone-600">{bar.county}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-stone-200/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-forest-600 to-forest-400"
                      style={{ width: `${Math.max(3, Math.round((bar.kg / maxBar) * 100))}%` }}
                    />
                  </div>
                  <span className="num text-[12.5px] font-semibold text-ink">{toTonnes(bar.kg)} t</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming distributions */}
        <section className="card xl:col-span-5">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
            <h2 className="font-display text-[15px] font-semibold text-ink">Distributions in motion</h2>
            <Link href="/distributions" className="inline-flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-forest-700 hover:text-forest-900">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {upcoming.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-stone-400">
                No scheduled distributions in this scope.
              </p>
            )}
            {upcoming.map((d) => {
              const meta = DIST_STATUS_META[d.status];
              return (
                <Link
                  key={d.id}
                  href={`/distributions/${d.id}`}
                  className="block px-6 py-4 transition-colors hover:bg-forest-50/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="num text-[11px] font-medium text-stone-400">{d.ref}</span>
                    <Badge className={meta.badge}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-1.5 font-display text-[13.5px] font-semibold leading-snug text-ink">{d.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {d.venue}, {d.county}
                    </span>
                    <span className="num">{fmtDateTime(d.scheduledFor)}</span>
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Low stock */}
        <section className="card xl:col-span-5">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
            <h2 className="font-display text-[15px] font-semibold text-ink">Low stock alerts</h2>
            <Link href="/inventory" className="inline-flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-forest-700 hover:text-forest-900">
              Inventory <ArrowRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {lowRows.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-stone-400">
                All commodities are above minimum reserve levels.
              </p>
            )}
            {lowRows.map((r: LowStockRow, i) => (
              <div key={i} className="px-6 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-[13px] font-semibold text-ink">{r.item}</p>
                  <p className="num text-[13px] font-semibold text-red-700">
                    {fmtInt(r.quantity)} <span className="text-[10.5px] font-medium text-stone-400">{r.unit}</span>
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={r.quantity} max={r.threshold} tone={r.quantity < r.threshold / 2 ? "red" : "amber"} className="flex-1" />
                  <span className="num text-[10.5px] text-stone-400">min {fmtInt(r.threshold)}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  {r.warehouse} · {r.county}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Audit trail */}
        <section className="card xl:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
            <h2 className="font-display text-[15px] font-semibold text-ink">Recent activity — audit trail</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-400">
              <History size={12} /> Immutable log
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {recentAudit.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-stone-400">No activity recorded yet.</p>
            )}
            {recentAudit.map((row) => (
              <div key={row.id} className="flex items-start gap-3.5 px-6 py-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-600 ring-1 ring-inset ring-forest-100">
                  {row.action.startsWith("DISTRIBUTION") ? (
                    <Truck size={14} />
                  ) : row.action.startsWith("STOCK") ? (
                    <PackagePlus size={14} />
                  ) : row.action.startsWith("BENEFICIARY") ? (
                    <UserPlus size={14} />
                  ) : row.action.includes("SMS") ? (
                    <ClipboardList size={14} />
                  ) : (
                    <FilePlus2 size={14} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-stone-700">
                    <span className="font-display font-semibold text-ink">{row.userName ?? "System"}</span>{" "}
                    {row.detail ?? row.action.toLowerCase().replace(/_/g, " ")}
                  </p>
                  <p className="num mt-1 text-[10.5px] uppercase tracking-wide text-stone-400">
                    {row.action.replace(/_/g, " ")} · {fmtDateTime(row.createdAt)} · {fmtDate(row.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
