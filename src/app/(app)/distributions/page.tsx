import Link from "next/link";
import { ArrowRight, CalendarClock, MapPin, Plus, Truck } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser, can, scopeCountyId } from "@/lib/auth";
import { fmtDateTime, fmtInt, toTonnes, DIST_STATUS_META, cn } from "@/lib/format";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import type { DistributionStatus } from "@/db/schema";

export const metadata = { title: "Distributions" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Row = {
  id: number;
  ref: string;
  title: string;
  venue: string;
  scheduled_for: Date;
  status: DistributionStatus;
  county: string;
  warehouse: string;
  planned: number;
  issued: number;
  planned_kg: number;
  issued_kg: number;
};

const TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function DistributionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = scopeCountyId(user);
  const status = typeof sp.status === "string" && TABS.some((t) => t.key === sp.status) ? sp.status : "";

  const res = await db.execute(sql`
    SELECT d.id, d.ref, d.title, d.venue, d.scheduled_for, d.status,
           c.name AS county, w.name AS warehouse,
           COALESCE(SUM(di.planned_qty), 0)::int AS planned,
           COALESCE(SUM(di.issued_qty), 0)::int AS issued,
           COALESCE(SUM(di.planned_qty * f.kg_per_unit), 0)::float AS planned_kg,
           COALESCE(SUM(di.issued_qty * f.kg_per_unit), 0)::float AS issued_kg
    FROM distributions d
    JOIN counties c ON c.id = d.county_id
    JOIN warehouses w ON w.id = d.warehouse_id
    LEFT JOIN distribution_items di ON di.distribution_id = d.id
    LEFT JOIN food_items f ON f.id = di.food_item_id
    WHERE TRUE
      ${scope ? sql`AND d.county_id = ${scope}` : sql``}
      ${status ? sql`AND d.status = ${status}` : sql``}
    GROUP BY d.id, c.name, w.name
    ORDER BY d.scheduled_for DESC
    LIMIT 100
  `);
  const rows = res.rows as unknown as Row[];

  return (
    <div>
      <PageHeader
        eyebrow="Allocation & distribution tracking"
        title="Distribution exercises"
        description="Who received what, when, and from which warehouse. Stock is reserved at creation, drawn down at issue, and returned on cancellation."
        actions={
          can.manageDistributions(user) ? (
            <Link href="/distributions/new" className="btn-primary">
              <Plus size={15} />
              New distribution
            </Link>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/distributions?status=${t.key}` : "/distributions"}
            className={cn(
              "rounded-full px-4 py-1.5 font-display text-[12.5px] font-semibold ring-1 ring-inset transition-colors",
              status === t.key
                ? "bg-forest-700 text-white ring-forest-700"
                : "bg-white text-stone-600 ring-stone-200 hover:bg-forest-50 hover:text-forest-800",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Truck size={22} />}
            title="No distributions found"
            body={
              can.manageDistributions(user)
                ? "Create the first distribution — stock will be reserved from the warehouse and households notified automatically."
                : "No distribution exercises match this filter in your scope."
            }
            action={
              can.manageDistributions(user) ? (
                <Link href="/distributions/new" className="btn-primary mt-2">
                  <Plus size={15} />
                  New distribution
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {rows.map((d) => {
            const meta = DIST_STATUS_META[d.status];
            return (
              <Link
                key={d.id}
                href={`/distributions/${d.id}`}
                className="card group block p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="num text-[11.5px] font-semibold text-stone-400">{d.ref}</span>
                      <Badge className={meta.badge}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 font-display text-[16px] font-semibold tracking-tight text-ink group-hover:text-forest-800">
                      {d.title}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-stone-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} className="text-stone-400" />
                        {d.venue} · {d.county}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={12} className="text-stone-400" />
                        <span className="num">{fmtDateTime(d.scheduled_for)}</span>
                      </span>
                      <span>From {d.warehouse}</span>
                    </p>
                  </div>
                  <div className="w-full sm:w-[240px]">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="font-display font-semibold uppercase tracking-wide text-stone-400">
                        Issued
                      </span>
                      <span className="num text-[12px] text-stone-600">
                        {toTonnes(d.issued_kg)} / {toTonnes(d.planned_kg)} t
                      </span>
                    </div>
                    <ProgressBar
                      value={d.issued_kg}
                      max={d.planned_kg}
                      tone={d.status === "CANCELLED" ? "red" : d.status === "COMPLETED" ? "green" : "amber"}
                      className="mt-1.5"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="num text-[10.5px] text-stone-400">
                        {fmtInt(d.issued)} of {fmtInt(d.planned)} units
                      </span>
                      <span className="inline-flex items-center gap-1 font-display text-[12px] font-semibold text-forest-700 group-hover:text-forest-900">
                        Open <ArrowRight size={12.5} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
