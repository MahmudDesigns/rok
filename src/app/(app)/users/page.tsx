import { ShieldCheck, UserCog, Users } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { counties, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { fmtDateTime, fmtInt, ROLE_LABELS, ROLE_BADGE } from "@/lib/format";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import { UserForm } from "@/components/forms/user-form";
import { setUserActiveAction } from "@/lib/actions/users";

export const metadata = { title: "Officers & access" };

export default async function UsersPage() {
  const user = await requireRole("ADMIN");

  const [rows, countyRows, statRes] = await Promise.all([
    db
      .select({ u: users, countyName: counties.name })
      .from(users)
      .leftJoin(counties, eq(counties.id, users.countyId))
      .orderBy(desc(users.createdAt)),
    db.select().from(counties).orderBy(counties.name),
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${users.active})`,
      })
      .from(users),
  ]);

  const total = Number(statRes[0]?.total ?? 0);
  const active = Number(statRes[0]?.active ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Authorised access only"
        title="Officers & access"
        description="Account provisioning for national and county officers, warehouse staff and partner organisations. Every session and mutation is audited."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Provisioned accounts"
          value={fmtInt(total)}
          sub="Across all levels of government"
          icon={<Users size={20} strokeWidth={1.9} />}
        />
        <StatCard
          label="Active now"
          value={fmtInt(active)}
          sub="Can sign in today"
          icon={<ShieldCheck size={20} strokeWidth={1.9} />}
          tone="green"
        />
        <StatCard
          label="Deactivated"
          value={fmtInt(total - active)}
          sub="Access withdrawn"
          icon={<UserCog size={20} strokeWidth={1.9} />}
          tone={total - active > 0 ? "amber" : "default"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
        <UserForm counties={countyRows.map((c) => ({ id: c.id, name: c.name }))} />

        <div className="card min-w-0 overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-3.5">
            <h2 className="font-display text-[14px] font-semibold text-ink">All accounts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Officer</th>
                  <th>Role</th>
                  <th>Assignment</th>
                  <th>Last sign-in</th>
                  <th className="text-right">Access</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ u, countyName }) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-display text-[13px] font-semibold text-ink">{u.name}</p>
                      <p className="num text-[11.5px] text-stone-400">{u.email}</p>
                    </td>
                    <td>
                      <Badge className={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="text-[12.5px] text-stone-600">
                      {countyName ? `${countyName} County` : "National"}
                    </td>
                    <td className="num text-[11.5px] text-stone-500">
                      {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}
                    </td>
                    <td className="text-right">
                      {u.id === user.id ? (
                        <span className="font-display text-[11px] font-semibold text-stone-400">You</span>
                      ) : (
                        <form action={setUserActiveAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                          <button
                            type="submit"
                            className={`font-display text-[11.5px] font-semibold ${u.active ? "text-forest-700 hover:text-red-700" : "text-red-600 hover:text-forest-700"}`}
                          >
                            {u.active ? "Active — deactivate" : "Inactive — reactivate"}
                          </button>
                        </form>
                      )}
                    </td>
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
