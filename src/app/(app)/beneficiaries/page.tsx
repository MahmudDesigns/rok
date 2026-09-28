import Link from "next/link";
import { FileDown, Phone, Search, UserRound, Users, X } from "lucide-react";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, counties } from "@/db/schema";
import { requireUser, can, isNational, scopeCountyId } from "@/lib/auth";
import { fmtDate, fmtInt, VULNERABILITY_LABELS, ROLE_LABELS } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { BeneficiaryForm } from "@/components/forms/beneficiary-form";
import { setBeneficiaryActiveAction } from "@/lib/actions/beneficiaries";

export const metadata = { title: "Beneficiaries" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VULN_TONES: Record<string, string> = {
  NONE: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-300",
  ELDERLY: "bg-ochre-100 text-ochre-800 ring-1 ring-inset ring-ochre-300",
  DISABLED: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300",
  ORPHANED: "bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-300",
  CHRONICALLY_ILL: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-300",
  PREGNANT_LACTATING: "bg-pink-100 text-pink-800 ring-1 ring-inset ring-pink-300",
};

export default async function BeneficiariesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const countyParam = typeof sp.county === "string" ? parseInt(sp.county, 10) : NaN;
  const vul = typeof sp.vul === "string" ? sp.vul : "";
  const page = Math.max(1, typeof sp.p === "string" ? parseInt(sp.p, 10) || 1 : 1);
  const perPage = 15;
  const scope = scopeCountyId(user);

  const conditions: SQL[] = [];
  if (scope) conditions.push(eq(beneficiaries.countyId, scope));
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(beneficiaries.fullName, like),
        ilike(beneficiaries.nationalId, like),
        ilike(beneficiaries.phone, like),
        ilike(beneficiaries.village, like),
      )!,
    );
  }
  if (Number.isInteger(countyParam) && isNational(user)) {
    conditions.push(eq(beneficiaries.countyId, countyParam));
  }
  if (vul) conditions.push(eq(beneficiaries.vulnerability, vul));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRes, countyRows, totalRes, hhRes] = await Promise.all([
    db
      .select({
        b: beneficiaries,
        countyName: counties.name,
      })
      .from(beneficiaries)
      .innerJoin(counties, eq(counties.id, beneficiaries.countyId))
      .where(where)
      .orderBy(desc(beneficiaries.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ c: sql<number>`count(*)` }).from(beneficiaries).where(where),
    db.select().from(counties).orderBy(counties.name),
    db
      .select({ c: sql<number>`count(*)` })
      .from(beneficiaries)
      .where(and(eq(beneficiaries.active, true), scope ? eq(beneficiaries.countyId, scope) : undefined)),
    db
      .select({ s: sql<number>`coalesce(sum(${beneficiaries.householdSize}),0)` })
      .from(beneficiaries)
      .where(and(eq(beneficiaries.active, true), scope ? eq(beneficiaries.countyId, scope) : undefined)),
  ]);

  const filtered = Number(countRes[0]?.c ?? 0);
  const totalActive = Number(totalRes[0]?.c ?? 0);
  const totalPeople = Number(hhRes[0]?.s ?? 0);
  const pageCount = Math.max(1, Math.ceil(filtered / perPage));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q: q || undefined,
      county: Number.isInteger(countyParam) ? String(countyParam) : undefined,
      vul: vul || undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/beneficiaries?${s}` : "/beneficiaries";
  };

  return (
    <div>
      <PageHeader
        eyebrow="National register"
        title="Beneficiaries"
        description={
          scope
            ? `${fmtInt(totalActive)} active households in ${user.countyName} County — ${fmtInt(totalPeople)} people. Shared with all offices; duplicates are blocked by National ID.`
            : `${fmtInt(totalActive)} active households nationwide — ${fmtInt(totalPeople)} people. One central register replaces county paper files.`
        }
        actions={
          <Link href="/api/reports?type=beneficiaries" className="btn-secondary">
            <FileDown size={15} />
            Export CSV
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
        {can.registerBeneficiaries(user) ? (
          <BeneficiaryForm
            counties={countyRows.map((c) => ({ id: c.id, name: c.name }))}
            lockedCountyName={isNational(user) ? null : user.countyName}
          />
        ) : (
          <div className="card sticky top-20 h-fit p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                <Users size={17} />
              </span>
              <h2 className="font-display text-[15px] font-semibold text-ink">Read-only access</h2>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-stone-500">
              Your role ({ROLE_LABELS[user.role]}) can search and view the shared register, but only
              county and national officers may register or amend beneficiaries.
            </p>
          </div>
        )}

        <div className="min-w-0">
          {/* Filters */}
          <form method="GET" className="card mb-5 flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <label className="label" htmlFor="q">Search name, ID, phone or village</label>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input id="q" name="q" defaultValue={q} className="input pl-9" placeholder="e.g. Atieno, 28103456, 0712…" />
              </div>
            </div>
            {isNational(user) && (
              <div className="w-44">
                <label className="label" htmlFor="county">County</label>
                <select id="county" name="county" className="input" defaultValue={Number.isInteger(countyParam) ? String(countyParam) : ""}>
                  <option value="">All counties</option>
                  {countyRows.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-48">
              <label className="label" htmlFor="vul">Vulnerability</label>
              <select id="vul" name="vul" className="input" defaultValue={vul}>
                <option value="">All statuses</option>
                {Object.entries(VULNERABILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              <Search size={15} />
              Search
            </button>
            {(q || vul || Number.isInteger(countyParam)) && (
              <Link href="/beneficiaries" className="btn-secondary !px-3" aria-label="Clear filters">
                <X size={15} />
              </Link>
            )}
          </form>

          {/* Results */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <p className="font-display text-[13px] font-semibold text-ink">
                {fmtInt(filtered)} record{filtered === 1 ? "" : "s"}
                {q && <> matching <span className="text-forest-700">“{q}”</span></>}
              </p>
              <p className="num text-[11px] text-stone-400">
                Page {page} of {pageCount}
              </p>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={<UserRound size={22} />}
                title="No beneficiaries found"
                body="Adjust your search, or register the household using the form — the system will block duplicate National IDs automatically."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Beneficiary</th>
                      <th>National ID</th>
                      <th>Phone</th>
                      <th>Location</th>
                      <th className="text-center">Household</th>
                      <th>Vulnerability</th>
                      <th>Registered</th>
                      <th className="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ b, countyName }) => (
                      <tr key={b.id}>
                        <td>
                          <p className="font-display text-[13px] font-semibold text-ink">{b.fullName}</p>
                          <p className="text-[11px] text-stone-400">
                            {b.gender === "FEMALE" ? "Female" : "Male"}
                            {b.birthYear ? ` · b. ${b.birthYear}` : ""} · {countyName}
                          </p>
                        </td>
                        <td className="num text-[12.5px] font-medium text-ink">{b.nationalId}</td>
                        <td>
                          {b.phone ? (
                            <span className="num inline-flex items-center gap-1.5 text-[12.5px] text-stone-600">
                              <Phone size={11} className="text-stone-400" />
                              {b.phone}
                            </span>
                          ) : (
                            <span className="text-[11.5px] text-stone-400">—</span>
                          )}
                        </td>
                        <td className="text-[12px] text-stone-600">
                          {b.village ?? "—"}
                          <span className="block text-[10.5px] text-stone-400">{b.subCounty ?? ""}</span>
                        </td>
                        <td className="num text-center text-[12.5px] font-medium">{b.householdSize}</td>
                        <td>
                          <Badge className={VULN_TONES[b.vulnerability] ?? VULN_TONES.NONE}>
                            {VULNERABILITY_LABELS[b.vulnerability] ?? b.vulnerability}
                          </Badge>
                        </td>
                        <td className="num text-[11.5px] text-stone-500">{fmtDate(b.createdAt)}</td>
                        <td className="text-right">
                          {can.registerBeneficiaries(user) ? (
                            <form action={setBeneficiaryActiveAction}>
                              <input type="hidden" name="id" value={b.id} />
                              <input type="hidden" name="active" value={b.active ? "0" : "1"} />
                              <button
                                type="submit"
                                className={`font-display text-[11px] font-semibold ${b.active ? "text-forest-700 hover:text-red-700" : "text-red-600 hover:text-forest-700"}`}
                                title={b.active ? "Click to deactivate" : "Click to reactivate"}
                              >
                                {b.active ? "Active" : "Inactive"}
                              </button>
                            </form>
                          ) : (
                            <span className={`font-display text-[11px] font-semibold ${b.active ? "text-forest-700" : "text-red-600"}`}>
                              {b.active ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
                <Link
                  href={qs({ p: page > 1 ? String(page - 1) : "1" })}
                  className={`btn-secondary !px-3.5 !py-1.5 !text-[12px] ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                  Previous
                </Link>
                <Link
                  href={qs({ p: String(Math.min(pageCount, page + 1)) })}
                  className={`btn-secondary !px-3.5 !py-1.5 !text-[12px] ${page >= pageCount ? "pointer-events-none opacity-40" : ""}`}
                >
                  Next
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
