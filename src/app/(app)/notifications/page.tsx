import { Bell, CheckCheck, Clock3, MessageSquareText, Send, XOctagon } from "lucide-react";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, counties, distributions, notifications } from "@/db/schema";
import { requireUser, can, isNational, scopeCountyId } from "@/lib/auth";
import { fmtDateTime, fmtInt, NOTIF_STATUS_META } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { NoticeForm } from "@/components/forms/notice-form";
import { dispatchQueuedAction } from "@/lib/actions/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const scope = scopeCountyId(user);
  const scopeCond: SQL | undefined = scope ? eq(beneficiaries.countyId, scope) : undefined;
  const weekAgo = new Date(Date.now() - 7 * 864e5);

  const [queuedRes, sentRes, failedRes, rows, countyRows] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)` })
      .from(notifications)
      .leftJoin(beneficiaries, eq(beneficiaries.id, notifications.beneficiaryId))
      .where(and(eq(notifications.status, "QUEUED"), scopeCond)),
    db
      .select({ c: sql<number>`count(*)` })
      .from(notifications)
      .leftJoin(beneficiaries, eq(beneficiaries.id, notifications.beneficiaryId))
      .where(and(eq(notifications.status, "SENT"), gte(notifications.sentAt, weekAgo), scopeCond)),
    db
      .select({ c: sql<number>`count(*)` })
      .from(notifications)
      .leftJoin(beneficiaries, eq(beneficiaries.id, notifications.beneficiaryId))
      .where(and(eq(notifications.status, "FAILED"), scopeCond)),
    db
      .select({
        n: notifications,
        benName: beneficiaries.fullName,
        distTitle: distributions.title,
      })
      .from(notifications)
      .leftJoin(beneficiaries, eq(beneficiaries.id, notifications.beneficiaryId))
      .leftJoin(distributions, eq(distributions.id, notifications.distributionId))
      .where(scopeCond)
      .orderBy(desc(notifications.queuedAt))
      .limit(60),
    db.select().from(counties).orderBy(counties.name),
  ]);

  const queued = Number(queuedRes[0]?.c ?? 0);
  const sent7d = Number(sentRes[0]?.c ?? 0);
  const failed = Number(failedRes[0]?.c ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Beneficiary communication"
        title="Notification centre"
        description="SMS notices for distribution schedules and collection points. Messages queue automatically when a distribution is created, then dispatch through the SMS gateway."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="In queue"
          value={fmtInt(queued)}
          sub="Awaiting gateway dispatch"
          icon={<Clock3 size={20} strokeWidth={1.9} />}
          tone="amber"
        />
        <StatCard
          label="Delivered · 7 days"
          value={fmtInt(sent7d)}
          sub="Handed to mobile networks"
          icon={<CheckCheck size={20} strokeWidth={1.9} />}
          tone="green"
        />
        <StatCard
          label="Failed"
          value={fmtInt(failed)}
          sub="Unreachable numbers"
          icon={<XOctagon size={20} strokeWidth={1.9} />}
          tone={failed > 0 ? "red" : "default"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink">Message log</h2>
              <p className="mt-0.5 text-[11.5px] text-stone-500">Most recent 60 notices in your scope.</p>
            </div>
            {can.sendNotices(user) && (
              <form action={dispatchQueuedAction}>
                <button type="submit" disabled={queued === 0} className="btn-primary !py-2">
                  <Send size={14} />
                  Dispatch {queued > 0 ? `${fmtInt(queued)} queued` : "queue"}
                </button>
              </form>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<MessageSquareText size={22} />}
              title="No notices yet"
              body="Notices are queued automatically when a distribution is created — or compose a custom broadcast on the right."
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {rows.map(({ n, benName, distTitle }) => (
                <div key={n.id} className="flex items-start gap-4 px-5 py-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
                    <Bell size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="font-display text-[13px] font-semibold text-ink">
                        {benName ?? "Household"}
                      </p>
                      <span className="num text-[11.5px] text-stone-500">{n.phone ?? "no number"}</span>
                      <Badge className={NOTIF_STATUS_META[n.status]?.badge}>
                        {NOTIF_STATUS_META[n.status]?.label ?? n.status}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-stone-600">{n.message}</p>
                    <p className="num mt-1.5 text-[10.5px] uppercase tracking-wide text-stone-400">
                      {distTitle ? `${distTitle} · ` : ""}
                      queued {fmtDateTime(n.queuedAt)}
                      {n.sentAt ? ` · sent ${fmtDateTime(n.sentAt)}` : ""}
                      {n.providerRef ? ` · ref ${n.providerRef}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {can.sendNotices(user) ? (
            <NoticeForm
              counties={countyRows.map((c) => ({ id: c.id, name: c.name }))}
              lockedCountyName={isNational(user) ? null : user.countyName}
            />
          ) : (
            <div className="card p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <Send size={16} />
                </span>
                <h2 className="font-display text-[15px] font-semibold text-ink">Read-only</h2>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-stone-500">
                Only national and county officers may dispatch or broadcast notices.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white/60 p-5 text-[12px] leading-relaxed text-stone-500">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Gateway status
            </p>
            <p className="mt-2">
              SMS dispatch runs in <span className="font-semibold text-stone-700">simulation mode</span> until
              the production gateway (Africa's Talking / Safaricom SDP) credentials are configured via
              environment variables. Message flow, queuing and audit are production-live.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
