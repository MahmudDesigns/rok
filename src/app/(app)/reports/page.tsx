import Link from "next/link";
import { BarChart3, Boxes, Download, FileDown, PackagePlus, Truck, Users } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser, scopeCountyId } from "@/lib/auth";
import { fmtDate, fmtInt, toTonnes, DIST_STATUS_META, cn } from "@/lib/format";
import { Badge, PageHeader, ProgressBar, StatCard } from "@/components/ui";

export const metadata = { title: "Reports" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  { key: "stock", label: "Stock on hand", icon: <Boxes size={14} /> },
  { key: "beneficiaries", label: "Beneficiaries served", icon: <Users size={14} /> },
  { key: "distributions", label: "Distribution history", icon: <Truck size={14} /> },
  { key: "intake", label: "Stock received", icon: <PackagePlus size={14} /> },
];

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = scopeCountyId(user);
  const report = typeof sp.report === "string" && TABS.some((t) => t.key === sp.report) ? sp.report : "stock";

  return (
    <div>
      <PageHeader
        eyebrow="Planning & accountability"
        title="Reports"
        description={
          scope
            ? `Reports scoped to ${user.countyName} County. National consolidations are produced by the national office.`
            : "National consolidations for planning, budgeting and audit. Every report downloads as CSV for Parliament, Treasury and partner briefings."
        }
        actions={
          <Link
            href={`/api/reports?type=${report === "distributions" ? "distributions" : report}`}
            className="btn-primary"
          >
            <FileDown size={15} />
            Download CSV
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reports?report=${t.key}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-[12.5px] font-semibold ring-1 ring-inset transition-colors",
              report === t.key
                ? "bg-forest-700 text-white ring-forest-700"
                : "bg-white text-stone-600 ring-stone-200 hover:bg-forest-50 hover:text-forest-800",
            )}
          >
            <span className={report === t.key ? "text-ochre-300" : "text-stone-400"}>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>

      {report === "stock" && <StockReport scope={scope} />}
      {report === "beneficiaries" && <BeneficiaryReport scope={scope} />}
      {report === "distributions" && <DistributionReport scope={scope} />}
      {report === "intake" && <IntakeReport scope={scope} />}
    </div>
  );
}

async function StockReport({ scope }: { scope: number | null }) {
  const res = await db.execute(sql`
    SELECT c.name AS county, w.name AS warehouse, w.capacity_tonnes,
           count(i.id)::int AS lines,
           ROUND(coalesce(sum(i.quantity * f.kg_per_unit),0)::numeric, 0)::float AS kg,
           count(*) FILTER (WHERE i.quantity < f.low_stock_threshold)::int AS low_lines,
           max(i.updated_at) AS last_updated
    FROM warehouses w
    JOIN counties c ON c.id = w.county_id
    LEFT JOIN inventory i ON i.warehouse_id = w.id
    LEFT JOIN food_items f ON f.id = i.food_item_id
    ${scope ? sql`WHERE c.id = ${scope}` : sql``}
    GROUP BY c.name, w.name, w.capacity_tonnes
    ORDER BY kg DESC
  `);
  const rows = res.rows as {
    county: string; warehouse: string; capacity_tonnes: number; lines: number;
    kg: number; low_lines: number; last_updated: Date | null;
  }[];
  const totalKg = rows.reduce((a, r) => a + r.kg, 0);
  const lowTotal = rows.reduce((a, r) => a + r.low_lines, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total food held" value={`${toTonnes(totalKg)} t`} sub="All warehouses in scope" icon={<Boxes size={20} strokeWidth={1.9} />} tone="green" />
        <StatCard label="Warehouse lines" value={fmtInt(rows.reduce((a, r) => a + r.lines, 0))} sub={`Across ${fmtInt(rows.length)} facilities`} icon={<BarChart3 size={20} strokeWidth={1.9} />} />
        <StatCard label="Below reserve minimum" value={fmtInt(lowTotal)} sub="Needs replenishment" icon={<Download size={20} strokeWidth={1.9} />} tone={lowTotal > 0 ? "amber" : "default"} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>County</th>
                <th className="text-right">Commodity lines</th>
                <th className="text-right">Food held</th>
                <th style={{ width: 200 }}>Utilisation</th>
                <th className="text-center">Low lines</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-display text-[13px] font-semibold text-ink">{r.warehouse}</td>
                  <td className="text-[12.5px] text-stone-600">{r.county}</td>
                  <td className="num text-right text-[12.5px]">{fmtInt(r.lines)}</td>
                  <td className="num text-right text-[13px] font-semibold">{toTonnes(r.kg)} t</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <ProgressBar
                        value={r.kg}
                        max={r.capacity_tonnes * 1000}
                        tone={r.kg / (r.capacity_tonnes * 1000) > 0.85 ? "amber" : "green"}
                        className="flex-1"
                      />
                      <span className="num w-9 text-right text-[11px] text-stone-500">
                        {Math.round((r.kg / (r.capacity_tonnes * 1000)) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-center">
                    {r.low_lines > 0 ? (
                      <Badge className="bg-red-100 text-red-800 ring-1 ring-inset ring-red-300">{r.low_lines}</Badge>
                    ) : (
                      <span className="num text-[11.5px] text-stone-400">0</span>
                    )}
                  </td>
                  <td className="num text-[11.5px] text-stone-500">{r.last_updated ? fmtDate(r.last_updated) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function BeneficiaryReport({ scope }: { scope: number | null }) {
  const res = await db.execute(sql`
    SELECT c.name AS county, c.is_asal,
           count(DISTINCT b.id) FILTER (WHERE b.active)::int AS households,
           coalesce(sum(DISTINCT b.household_size) FILTER (WHERE b.active), 0)::int AS people,
           count(DISTINCT ir.beneficiary_id)::int AS served_households
    FROM counties c
    LEFT JOIN beneficiaries b ON b.county_id = c.id
    LEFT JOIN distributions d ON d.county_id = c.id
    LEFT JOIN issue_records ir ON ir.distribution_id = d.id
    ${scope ? sql`WHERE c.id = ${scope}` : sql``}
    GROUP BY c.name, c.is_asal
    HAVING count(DISTINCT b.id) > 0
    ORDER BY people DESC
    LIMIT 60
  `);
  const rows = res.rows as {
    county: string; is_asal: boolean; households: number; people: number; served_households: number;
  }[];
  const totalHouseholds = rows.reduce((a, r) => a + r.households, 0);
  const totalPeople = rows.reduce((a, r) => a + r.people, 0);
  const totalServed = rows.reduce((a, r) => a + r.served_households, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Registered households" value={fmtInt(totalHouseholds)} sub="Active in scope" icon={<Users size={20} strokeWidth={1.9} />} />
        <StatCard label="Estimated people" value={fmtInt(totalPeople)} sub="Household members" icon={<Users size={20} strokeWidth={1.9} />} tone="amber" />
        <StatCard label="Households served" value={fmtInt(totalServed)} sub={`${totalHouseholds > 0 ? Math.round((totalServed / totalHouseholds) * 100) : 0}% coverage`} icon={<Truck size={20} strokeWidth={1.9} />} tone="green" />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>County</th>
                <th className="text-right">Households</th>
                <th className="text-right">Est. people</th>
                <th className="text-right">Served</th>
                <th style={{ width: 220 }}>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.county}>
                  <td className="font-display text-[13px] font-semibold text-ink">
                    {r.county}
                    {r.is_asal && (
                      <Badge className="ml-2 bg-ochre-100 text-ochre-800 ring-1 ring-inset ring-ochre-300">ASAL</Badge>
                    )}
                  </td>
                  <td className="num text-right text-[12.5px]">{fmtInt(r.households)}</td>
                  <td className="num text-right text-[12.5px]">{fmtInt(r.people)}</td>
                  <td className="num text-right text-[12.5px] font-semibold text-forest-700">{fmtInt(r.served_households)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <ProgressBar value={r.served_households} max={Math.max(r.households, 1)} tone="green" className="flex-1" />
                      <span className="num w-9 text-right text-[11px] text-stone-500">
                        {r.households > 0 ? Math.round((r.served_households / r.households) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function DistributionReport({ scope }: { scope: number | null }) {
  const res = await db.execute(sql`
    SELECT d.id, d.ref, d.title, d.status, d.scheduled_for, c.name AS county, w.name AS warehouse,
           COALESCE(SUM(di.planned_qty * f.kg_per_unit),0)::float AS planned_kg,
           COALESCE(SUM(di.issued_qty * f.kg_per_unit),0)::float AS issued_kg,
           (SELECT count(DISTINCT beneficiary_id) FROM issue_records WHERE distribution_id = d.id)::int AS households
    FROM distributions d
    JOIN counties c ON c.id = d.county_id
    JOIN warehouses w ON w.id = d.warehouse_id
    LEFT JOIN distribution_items di ON di.distribution_id = d.id
    LEFT JOIN food_items f ON f.id = di.food_item_id
    ${scope ? sql`WHERE d.county_id = ${scope}` : sql``}
    GROUP BY d.id, c.name, w.name
    ORDER BY d.scheduled_for DESC
    LIMIT 60
  `);
  const rows = res.rows as {
    id: number; ref: string; title: string; status: keyof typeof DIST_STATUS_META;
    scheduled_for: Date; county: string; warehouse: string;
    planned_kg: number; issued_kg: number; households: number;
  }[];
  const completed = rows.filter((r) => r.status === "COMPLETED");
  const issuedKg = rows.reduce((a, r) => a + r.issued_kg, 0);
  const households = rows.reduce((a, r) => a + r.households, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Exercises on record" value={fmtInt(rows.length)} sub={`${completed.length} completed`} icon={<Truck size={20} strokeWidth={1.9} />} />
        <StatCard label="Food issued" value={`${toTonnes(issuedKg)} t`} sub="Reserved → issued to households" icon={<Boxes size={20} strokeWidth={1.9} />} tone="amber" />
        <StatCard label="Households served" value={fmtInt(households)} sub="Cumulative per exercise" icon={<Users size={20} strokeWidth={1.9} />} tone="green" />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Exercise</th>
                <th>County</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th className="text-right">Planned</th>
                <th className="text-right">Issued</th>
                <th className="text-right">Households</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num text-[11.5px] text-stone-500">
                    <Link href={`/distributions/${r.id}`} className="hover:text-forest-800 hover:underline underline-offset-2">
                      {r.ref}
                    </Link>
                  </td>
                  <td className="max-w-[280px] font-display text-[12.5px] font-semibold text-ink">
                    <span className="line-clamp-1">{r.title}</span>
                  </td>
                  <td className="text-[12px] text-stone-600">{r.county}</td>
                  <td className="num text-[11.5px] text-stone-500">{fmtDate(r.scheduled_for)}</td>
                  <td>
                    <Badge className={DIST_STATUS_META[r.status]?.badge}>
                      {DIST_STATUS_META[r.status]?.label ?? r.status}
                    </Badge>
                  </td>
                  <td className="num text-right text-[12px]">{toTonnes(r.planned_kg)} t</td>
                  <td className="num text-right text-[12px] font-semibold text-forest-700">{toTonnes(r.issued_kg)} t</td>
                  <td className="num text-right text-[12px]">{fmtInt(r.households)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function IntakeReport({ scope }: { scope: number | null }) {
  const bySource = await db.execute(sql`
    SELECT si.source,
           count(*)::int AS consignments,
           ROUND(coalesce(sum(si.quantity * f.kg_per_unit),0)::numeric, 0)::float AS kg
    FROM stock_intakes si
    JOIN food_items f ON f.id = si.food_item_id
    JOIN warehouses w ON w.id = si.warehouse_id
    WHERE si.received_at >= now() - interval '90 days'
    ${scope ? sql`AND w.county_id = ${scope}` : sql``}
    GROUP BY si.source
    ORDER BY kg DESC
  `);
  const recent = await db.execute(sql`
    SELECT si.received_at, c.name AS county, w.name AS warehouse, f.name AS commodity,
           si.quantity, f.unit, si.source, si.reference
    FROM stock_intakes si
    JOIN warehouses w ON w.id = si.warehouse_id
    JOIN counties c ON c.id = w.county_id
    JOIN food_items f ON f.id = si.food_item_id
    ${scope ? sql`WHERE w.county_id = ${scope}` : sql``}
    ORDER BY si.received_at DESC
    LIMIT 25
  `);
  const sources = bySource.rows as { source: string; consignments: number; kg: number }[];
  const recentRows = recent.rows as {
    received_at: Date; county: string; warehouse: string; commodity: string;
    quantity: number; unit: string; source: string; reference: string | null;
  }[];
  const totalKg = sources.reduce((a, r) => a + r.kg, 0);
  const maxKg = Math.max(...sources.map((s) => s.kg), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received · 90 days" value={`${toTonnes(totalKg)} t`} sub="All sources combined" icon={<PackagePlus size={20} strokeWidth={1.9} />} tone="green" />
        <StatCard label="Consignments" value={fmtInt(sources.reduce((a, r) => a + r.consignments, 0))} sub="Documented with references" icon={<FileDown size={20} strokeWidth={1.9} />} />
        <StatCard label="Funding streams" value={fmtInt(sources.length)} sub="Government & partners" icon={<BarChart3 size={20} strokeWidth={1.9} />} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        <div className="card h-fit p-6">
          <h3 className="font-display text-[14px] font-semibold text-ink">By source · last 90 days</h3>
          <p className="mt-0.5 text-[11.5px] text-stone-500">Approximate weight received per funding stream.</p>
          <div className="mt-4 space-y-3.5">
            {sources.map((s) => (
              <div key={s.source}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12px] font-medium text-stone-600">{s.source}</p>
                  <p className="num text-[12px] font-semibold text-ink">{toTonnes(s.kg)} t</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ochre-400 to-ochre-500"
                    style={{ width: `${Math.max(3, Math.round((s.kg / maxKg) * 100))}%` }}
                  />
                </div>
                <p className="num mt-1 text-[10.5px] text-stone-400">{fmtInt(s.consignments)} consignments</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card min-w-0 overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h3 className="font-display text-[14px] font-semibold text-ink">Latest consignments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Warehouse</th>
                  <th>Commodity</th>
                  <th className="text-right">Quantity</th>
                  <th>Source</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((r, i) => (
                  <tr key={i}>
                    <td className="num whitespace-nowrap text-[11.5px] text-stone-500">{fmtDate(r.received_at)}</td>
                    <td className="text-[12px] text-stone-600">
                      {r.warehouse}
                      <span className="block text-[10.5px] text-stone-400">{r.county}</span>
                    </td>
                    <td className="font-display text-[12.5px] font-semibold text-ink">{r.commodity}</td>
                    <td className="num text-right text-[12.5px]">
                      +{fmtInt(r.quantity)} <span className="text-[10.5px] text-stone-400">{r.unit}</span>
                    </td>
                    <td className="text-[11.5px] text-stone-600">{r.source}</td>
                    <td className="num text-[11px] text-stone-400">{r.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
