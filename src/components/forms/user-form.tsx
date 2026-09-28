"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldPlus } from "lucide-react";
import { createUserAction } from "@/lib/actions/users";
import { ROLE_LABELS, type FormState } from "@/lib/format";

const initial: FormState = null;

export function UserForm({ counties }: { counties: Array<{ id: number; name: string }> }) {
  const [state, formAction, pending] = useActionState(createUserAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) {
      setLastSuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card sticky top-20 space-y-4 p-6">
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
          <ShieldPlus size={17} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Provision officer account</h2>
          <p className="text-[11.5px] text-stone-500">Role decides scope of access.</p>
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
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required className="input" placeholder="e.g. Josphat Kinyua" />
      </div>
      <div>
        <label className="label" htmlFor="email">Official email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="officer@gokrelief.go.ke" />
      </div>
      <div>
        <label className="label" htmlFor="password">Temporary password</label>
        <input id="password" name="password" type="text" required minLength={8} className="input num" placeholder="Min 8 chars, letters + numbers" />
      </div>
      <div>
        <label className="label" htmlFor="role">Role</label>
        <select id="role" name="role" className="input" required defaultValue="COUNTY_OFFICER">
          <option value="COUNTY_OFFICER">{ROLE_LABELS.COUNTY_OFFICER}</option>
          <option value="WAREHOUSE_MANAGER">{ROLE_LABELS.WAREHOUSE_MANAGER}</option>
          <option value="NATIONAL_OFFICER">{ROLE_LABELS.NATIONAL_OFFICER}</option>
          <option value="PARTNER">{ROLE_LABELS.PARTNER}</option>
          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="countyId">Assigned county</label>
        <select id="countyId" name="countyId" className="input" defaultValue="">
          <option value="">— National / not county-bound —</option>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-stone-400">Required for county officers and warehouse managers.</p>
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" className="input num" placeholder="+254 7XX XXX XXX" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <ShieldPlus size={15} />}
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
