"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { createDistributionAction } from "@/lib/actions/distributions";
import { fmtInt, toInputDateTime, type FormState } from "@/lib/format";

const initial: FormState = null;

type Row = { key: number; itemId: string; qty: string };

export function DistributionForm({
  warehouses,
  items,
  availability,
  defaultScheduled,
}: {
  warehouses: Array<{ id: number; name: string; countyName: string }>;
  items: Array<{ id: number; name: string; unit: string }>;
  availability: Record<number, Record<number, number>>;
  defaultScheduled: Date;
}) {
  const [state, formAction, pending] = useActionState(createDistributionAction, initial);
  const [warehouseId, setWarehouseId] = useState<number | null>(warehouses[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([{ key: 1, itemId: "", qty: "" }]);
  const [nextKey, setNextKey] = useState(2);

  const availableFor = (itemId: string): number | null => {
    if (!warehouseId || !itemId) return null;
    const wh = availability[warehouseId];
    if (!wh) return null;
    return wh[Number(itemId)] ?? 0;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-[13.5px] leading-relaxed text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* Details */}
      <div className="card space-y-4 p-6">
        <h2 className="border-b border-stone-100 pb-3 font-display text-[15px] font-semibold text-ink">
          1 · Exercise details
        </h2>
        <div>
          <label className="label" htmlFor="title">Distribution title</label>
          <input id="title" name="title" required className="input" placeholder="e.g. Wajir East — Buna drought response" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="warehouseId">Source warehouse</label>
            <select
              id="warehouseId"
              name="warehouseId"
              required
              className="input"
              value={warehouseId ?? ""}
              onChange={(e) => setWarehouseId(Number(e.target.value) || null)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.countyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="scheduledFor">Date & start time</label>
            <input
              id="scheduledFor"
              name="scheduledFor"
              type="datetime-local"
              required
              className="input num"
              defaultValue={toInputDateTime(defaultScheduled)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="venue">Venue / collection point</label>
          <input id="venue" name="venue" required className="input" placeholder="e.g. Buna trading centre, chief's camp" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes for field teams</label>
          <textarea id="notes" name="notes" rows={2} className="input resize-none" placeholder="Verification requirements, partner agencies on site, security notes…" />
        </div>
      </div>

      {/* Commodities */}
      <div className="card space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="font-display text-[15px] font-semibold text-ink">2 · Commodities to dispatch</h2>
          <button
            type="button"
            className="btn-secondary !px-3 !py-1.5 !text-[12px]"
            onClick={() => {
              setRows((r) => [...r, { key: nextKey, itemId: "", qty: "" }]);
              setNextKey((k) => k + 1);
            }}
          >
            <Plus size={13} />
            Add commodity
          </button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-stone-500">
          Quantities are reserved from the selected warehouse immediately and move with the convoy.
          If the exercise is cancelled, unissued stock returns automatically.
        </p>
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const avail = availableFor(row.itemId);
            const over = avail !== null && Number(row.qty) > avail;
            return (
              <div key={row.key} className="grid grid-cols-[1fr_120px_40px] items-start gap-3">
                <div>
                  {idx === 0 && <label className="label">Commodity</label>}
                  <select
                    name="itemId"
                    required
                    className="input"
                    value={row.itemId}
                    onChange={(e) =>
                      setRows((r) => r.map((x) => (x.key === row.key ? { ...x, itemId: e.target.value } : x)))
                    }
                  >
                    <option value="" disabled>
                      Select commodity…
                    </option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                  {avail !== null && (
                    <p className={`mt-1 num text-[11px] ${over ? "font-semibold text-red-600" : "text-stone-400"}`}>
                      {fmtInt(avail)} available at this warehouse
                      {over ? " — reduce quantity" : ""}
                    </p>
                  )}
                </div>
                <div>
                  {idx === 0 && <label className="label">Quantity</label>}
                  <input
                    name="qty"
                    type="number"
                    min={1}
                    required
                    className="input num"
                    placeholder="0"
                    value={row.qty}
                    onChange={(e) =>
                      setRows((r) => r.map((x) => (x.key === row.key ? { ...x, qty: e.target.value } : x)))
                    }
                  />
                </div>
                <div className={idx === 0 ? "mt-[26px]" : ""}>
                  <button
                    type="button"
                    className="flex h-[38px] w-full items-center justify-center rounded-lg text-stone-400 ring-1 ring-inset ring-stone-200 transition-colors hover:bg-red-50 hover:text-red-600 hover:ring-red-200"
                    onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== row.key) : r))}
                    aria-label="Remove line"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
          {pending ? "Creating & reserving stock…" : "Create distribution & notify households"}
        </button>
        <p className="text-[12px] text-stone-500">
          Beneficiaries in the county are sent an SMS with the date, venue and ID requirement.
        </p>
      </div>
    </form>
  );
}
