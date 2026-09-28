"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, HandCoins, Loader2, Search } from "lucide-react";
import { recordIssueAction } from "@/lib/actions/distributions";
import { fmtInt, type FormState } from "@/lib/format";

const initial: FormState = null;

type Ben = { id: number; name: string; nid: string; village: string | null };
type Line = { id: number; name: string; unit: string; remaining: number };

export function IssueForm({
  distributionId,
  beneficiaries,
  items,
}: {
  distributionId: number;
  beneficiaries: Ben[];
  items: Line[];
}) {
  const [state, formAction, pending] = useActionState(recordIssueAction, initial);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beneficiaries.slice(0, 60);
    return beneficiaries
      .filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.nid.includes(q) ||
          (b.village ?? "").toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [query, beneficiaries]);

  const selectedBen = beneficiaries.find((b) => String(b.id) === selected);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <input type="hidden" name="distributionId" value={distributionId} />
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ochre-100 text-ochre-700">
          <HandCoins size={17} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Record issue to beneficiary</h2>
          <p className="text-[11.5px] text-stone-500">Verify the National ID before issuing.</p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state?.success && !pending && (
        <div className="flex items-start gap-2.5 rounded-lg border border-forest-200 bg-forest-50 px-3.5 py-3 text-[13px] leading-relaxed text-forest-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>{state.success}</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="benSearch">Find beneficiary</label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="benSearch"
            className="input pl-9"
            placeholder="Type a name, ID number or village…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected("");
            }}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="beneficiaryId">Beneficiary (register order)</label>
        <select
          id="beneficiaryId"
          name="beneficiaryId"
          required
          className="input"
          size={Math.min(6, Math.max(3, filtered.length + 1))}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            {filtered.length === 0 ? "No matches — refine the search" : `Select from ${filtered.length} shown…`}
          </option>
          {filtered.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.nid}
              {b.village ? ` (${b.village})` : ""}
            </option>
          ))}
        </select>
        {selectedBen && (
          <p className="mt-1.5 rounded-lg bg-forest-50 px-3 py-2 text-[12px] font-medium text-forest-800 ring-1 ring-inset ring-forest-100">
            Issuing to <span className="font-display font-semibold">{selectedBen.name}</span> · ID{" "}
            <span className="num">{selectedBen.nid}</span>
          </p>
        )}
      </div>

      <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-inset ring-stone-200/70">
        <p className="label !mb-2.5">Quantities to issue</p>
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_110px] items-center gap-3">
              <div>
                <p className="font-display text-[12.5px] font-semibold text-ink">{it.name}</p>
                <p className="num text-[10.5px] text-stone-400">
                  {fmtInt(it.remaining)} × {it.unit} remaining
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={it.remaining}
                name={`item_${it.id}`}
                defaultValue={0}
                disabled={it.remaining === 0}
                className="input num !py-1.5"
                aria-label={`Quantity of ${it.name}`}
              />
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={pending || !selected} className="btn-primary w-full">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />}
        {pending ? "Recording…" : "Record issue"}
      </button>
    </form>
  );
}
