"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import { registerIntakeAction } from "@/lib/actions/inventory";
import { INTAKE_SOURCES, type FormState } from "@/lib/format";

const initial: FormState = null;

export function IntakeForm({
  warehouses,
  items,
  defaultWarehouseId,
}: {
  warehouses: Array<{ id: number; name: string }>;
  items: Array<{ id: number; name: string; unit: string }>;
  defaultWarehouseId?: number;
}) {
  const [state, formAction, pending] = useActionState(registerIntakeAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      setLastSuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card sticky top-20 space-y-4 p-6" key={defaultWarehouseId}>
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
          <PackagePlus size={17} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Register stock intake</h2>
          <p className="text-[11.5px] text-stone-500">Adds to live inventory immediately.</p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {lastSuccess && !state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-forest-200 bg-forest-50 px-3.5 py-3 text-[13px] leading-relaxed text-forest-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>{lastSuccess}</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="warehouseId">Receiving warehouse</label>
        <select id="warehouseId" name="warehouseId" required className="input" defaultValue={defaultWarehouseId ?? ""}>
          <option value="" disabled>Select warehouse…</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="foodItemId">Commodity</label>
        <select id="foodItemId" name="foodItemId" required className="input" defaultValue="">
          <option value="" disabled>Select commodity…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="quantity">Quantity (in the unit shown)</label>
        <input id="quantity" name="quantity" type="number" min={1} required className="input num" placeholder="e.g. 450" />
      </div>

      <div>
        <label className="label" htmlFor="source">Source of consignment</label>
        <select id="source" name="source" required className="input" defaultValue={INTAKE_SOURCES[0]}>
          {INTAKE_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="reference">GRN / waybill reference</label>
        <input id="reference" name="reference" className="input num" placeholder="e.g. NCPB/GRN/20256781" />
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} className="input resize-none" placeholder="Condition on receipt, escort details…" />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
        {pending ? "Posting to inventory…" : "Post to inventory"}
      </button>
    </form>
  );
}
