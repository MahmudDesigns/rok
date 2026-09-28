import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  FileDown,
  MapPin,
  Play,
  SquareCheckBig,
} from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  beneficiaries,
  counties,
  distributionItems,
  distributions,
  foodItems,
  issueRecords,
  notifications,
  users,
  warehouses,
} from "@/db/schema";
import { requireUser, can, isNational } from "@/lib/auth";
import { fmtDateTime, fmtInt, DIST_STATUS_META, NOTIF_STATUS_META } from "@/lib/format";
import { Badge, NoticeBanner, ProgressBar } from "@/components/ui";
import { IssueForm } from "@/components/forms/issue-form";
import { setDistributionStatusAction } from "@/lib/actions/distributions";

export const metadata = { title: "Distribution detail" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DistributionDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const sp = await searchParams;
  const id = parseInt(rawId, 10);
  if (!Number.isInteger(id)) notFound();

  const [row] = await db
    .select({
      d: distributions,
      countyName: counties.name,
      warehouseName: warehouses.name,
      warehouseLocation: warehouses.location,
      createdBy: users.name,
    })
    .from(distributions)
    .innerJoin(counties, eq(counties.id, distributions.countyId))
    .innerJoin(warehouses, eq(warehouses.id, distributions.warehouseId))
    .leftJoin(users, eq(users.id, distributions.createdById))
    .where(eq(distributions.id, id))
    .limit(1);

  if (!row) notFound();
  const d = row.d;

  // County-scoped officers cannot open other counties' exercises
  if (!isNational(user) && d.countyId !== user.countyId) redirect("/distributions");

  const [items, ledger, servedRes, notifStats, countyBens] = await Promise.all([
    db
      .select({ di: distributionItems, item: foodItems })
      .from(distributionItems)
      .innerJoin(foodItems, eq(foodItems.id, distributionItems.foodItemId))
      .where(eq(distributionItems.distributionId, id))
      .orderBy(foodItems.name),
    db
      .select({
        ir: issueRecords,
        benName: beneficiaries.fullName,
        benNid: beneficiaries.nationalId,
        itemName: foodItems.name,
        unit: foodItems.unit,
        issuedBy: users.name,
      })
      .from(issueRecords)
      .innerJoin(beneficiaries, eq(beneficiaries.id, issueRecords.beneficiaryId))
      .innerJoin(foodItems, eq(foodItems.id, issueRecords.foodItemId))
      .leftJoin(users, eq(users.id, issueRecords.issuedById))
      .where(eq(issueRecords.distributionId, id))
      .orderBy(desc(issueRecords.issuedAt))
      .limit(25),
    db.execute(sql`
      SELECT count(DISTINCT beneficiary_id)::int AS households,
             coalesce((SELECT sum(b.household_size) FROM (
               SELECT DISTINCT beneficiary_id FROM issue_records WHERE distribution_id = ${id}
             ) t JOIN beneficiaries b ON b.id = t.beneficiary_id), 0)::int AS people
      FROM issue_records
      WHERE distribution_id = ${id}
    `),
    db
      .select({ status: notifications.status, c: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.distributionId, id))
      .groupBy(notifications.status),
    db
      .select({
        id: beneficiaries.id,
        name: beneficiaries.fullName,
        nid: beneficiaries.nationalId,
        village: beneficiaries.village,
      })
      .from(beneficiaries)
      .where(and(eq(beneficiaries.countyId, d.countyId), eq(beneficiaries.active, true)))
      .orderBy(beneficiaries.fullName)
      .limit(800),
  ]);

  const served = (servedRes.rows[0] as { households: number; people: number } | undefined) ?? {
    households: 0,
    people: 0,
  };
  const meta = DIST_STATUS_META[d.status];
  const canTransition = can.manageDistributions(user);
  const canIssue = (d.status === "ACTIVE" || d.status === "SCHEDULED") && can.recordIssues(user);
  const notifTotal = notifStats.reduce((a, r) => a + Number(r.c), 0);

  return (
    <div>
      <Link
        href="/distributions"
        className="mb-4 inline-flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-stone-500 hover:text-forest-800"
      >
        <ArrowLeft size={14} />
        All distributions
      </Link>

      {sp.created === "1" && (
        <NoticeBanner tone="green">
          <span className="font-display font-semibold">Distribution created.</span> Stock has been reserved
          from the warehouse and SMS notices are queued for every registered household in{" "}
          {row.countyName} County. Dispatch the queue from the Notifications page.
        </NoticeBanner>
      )}
      {d.status === "CANCELLED" && (
        <NoticeBanner tone="red">
          This exercise was cancelled. All unissued reserved stock was returned to {row.warehouseName}.
        </NoticeBanner>
      )}

      {/* Header */}
      <div className="card relative mb-5 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-ochre-400 to-forest-600" />
        <div className="flex flex-wrap items-start justify-between gap-5 p-6 sm:p-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-[12px] font-semibold text-stone-400">{d.ref}</span>
              <Badge className={meta.badge}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </Badge>
            </div>
            <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">
              {d.title}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-stone-400" />
                {d.venue} · {row.countyName} County
              </span>
              <span className="num">{fmtDateTime(d.scheduledFor)}</span>
            </p>
          </div>
          {canTransition && (
            <div className="flex flex-wrap gap-2.5">
              {d.status === "SCHEDULED" && (
                <form action={setDistributionStatusAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="next" value="ACTIVE" />
                  <button type="submit" className="btn-primary">
                    <Play size={15} />
                    Start issuing
                  </button>
                </form>
              )}
              {d.status === "ACTIVE" && (
                <form action={setDistributionStatusAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="next" value="COMPLETED" />
                  <button type="submit" className="btn-primary">
                    <SquareCheckBig size={15} />
                    Mark completed
                  </button>
                </form>
              )}
              {(d.status === "SCHEDULED" || d.status === "ACTIVE") && (
                <form action={setDistributionStatusAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="next" value="CANCELLED" />
                  <button type="submit" className="btn-danger">
                    <Ban size={15} />
                    Cancel
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-stone-100 bg-stone-100 sm:grid-cols-4">
          {[
            { label: "Source warehouse", value: row.warehouseName },
            { label: "Households served", value: `${fmtInt(served.households)}` },
            { label: "People reached", value: `${fmtInt(served.people)}` },
            { label: "Created by", value: row.createdBy ?? "—" },
          ].map((cell) => (
            <div key={cell.label} className="bg-white px-6 py-4">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                {cell.label}
              </p>
              <p className="mt-1 truncate font-display text-[13.5px] font-semibold text-ink">{cell.value}</p>
            </div>
          ))}
        </div>
      </div>

      {d.notes && (
        <NoticeBanner tone="sky">
          <span className="font-display font-semibold">Field notes:</span> {d.notes}
        </NoticeBanner>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {/* Allocation */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-display text-[14px] font-semibold text-ink">Allocation drawdown</h2>
              <Link href={`/api/reports?type=distribution&id=${d.id}`} className="btn-secondary !px-3 !py-1.5 !text-[12px]">
                <FileDown size={13} />
                Issue ledger (CSV)
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th className="text-right">Reserved</th>
                    <th className="text-right">Issued</th>
                    <th className="text-right">Remaining</th>
                    <th style={{ width: 220 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ di, item }) => {
                    const remaining = di.plannedQty - di.issuedQty;
                    return (
                      <tr key={di.id}>
                        <td>
                          <p className="font-display text-[13px] font-semibold text-ink">{item.name}</p>
                          <p className="text-[10.5px] text-stone-400">{item.unit}</p>
                        </td>
                        <td className="num text-right text-[13px]">{fmtInt(di.plannedQty)}</td>
                        <td className="num text-right text-[13px] font-semibold text-forest-700">
                          {fmtInt(di.issuedQty)}
                        </td>
                        <td className="num text-right text-[13px] text-stone-500">{fmtInt(remaining)}</td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <ProgressBar value={di.issuedQty} max={di.plannedQty} tone="green" className="flex-1" />
                            <span className="num w-9 text-right text-[11px] text-stone-500">
                              {di.plannedQty > 0 ? Math.round((di.issuedQty / di.plannedQty) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ledger */}
          <div className="card overflow-hidden">
            <div className="border-b border-stone-100 px-5 py-3.5">
              <h2 className="font-display text-[14px] font-semibold text-ink">Issue ledger — who received what</h2>
              <p className="mt-0.5 text-[11.5px] text-stone-500">
                Chronological record of every issue made under this exercise.
              </p>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-stone-400">
                No issues recorded yet. Start issuing from the panel on the right.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Beneficiary</th>
                      <th>Commodity</th>
                      <th className="text-right">Qty</th>
                      <th>Issued by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((r) => (
                      <tr key={r.ir.id}>
                        <td className="num whitespace-nowrap text-[11.5px] text-stone-500">
                          {fmtDateTime(r.ir.issuedAt)}
                        </td>
                        <td>
                          <p className="font-display text-[12.5px] font-semibold text-ink">{r.benName}</p>
                          <p className="num text-[10.5px] text-stone-400">ID {r.benNid}</p>
                        </td>
                        <td className="text-[12.5px] text-stone-600">{r.itemName}</td>
                        <td className="num text-right text-[12.5px] font-semibold">{r.ir.quantity}</td>
                        <td className="text-[12px] text-stone-600">{r.issuedBy ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {canIssue ? (
            <IssueForm
              distributionId={d.id}
              beneficiaries={countyBens}
              items={items.map(({ di, item }) => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                remaining: di.plannedQty - di.issuedQty,
              }))}
            />
          ) : (
            <div className="card p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <CheckCircle2 size={17} />
                </span>
                <h2 className="font-display text-[15px] font-semibold text-ink">
                  {d.status === "COMPLETED" ? "Exercise completed" : d.status === "CANCELLED" ? "Exercise cancelled" : "View-only"}
                </h2>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-stone-500">
                {d.status === "COMPLETED"
                  ? "Issuing is closed. The full ledger above forms the permanent accountability record."
                  : d.status === "CANCELLED"
                    ? "No issues were possible after cancellation; reserved stock returned to the warehouse."
                    : "Your role can view this exercise but cannot record issues."}
              </p>
            </div>
          )}

          {/* Notification summary */}
          <div className="card p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <Bell size={16} />
              </span>
              <h2 className="font-display text-[15px] font-semibold text-ink">Household notices</h2>
            </div>
            {notifTotal === 0 ? (
              <p className="mt-3 text-[13px] text-stone-500">No SMS notices are linked to this exercise.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {notifStats.map((s) => (
                  <div key={s.status} className="flex items-center justify-between rounded-lg bg-stone-50 px-3.5 py-2.5 ring-1 ring-inset ring-stone-200/60">
                    <Badge className={NOTIF_STATUS_META[s.status]?.badge}>{NOTIF_STATUS_META[s.status]?.label ?? s.status}</Badge>
                    <span className="num text-[13px] font-semibold text-ink">{fmtInt(Number(s.c))}</span>
                  </div>
                ))}
                <Link href="/notifications" className="mt-3 block text-center font-display text-[12.5px] font-semibold text-forest-700 hover:text-forest-900">
                  Open notification centre
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
