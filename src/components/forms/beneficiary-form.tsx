"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { registerBeneficiaryAction } from "@/lib/actions/beneficiaries";
import { VULNERABILITY_OPTIONS, type FormState } from "@/lib/format";

const initial: FormState = null;

export function BeneficiaryForm({
  counties,
  lockedCountyName,
}: {
  counties: Array<{ id: number; name: string }>;
  lockedCountyName: string | null;
}) {
  const [state, formAction, pending] = useActionState(registerBeneficiaryAction, initial);
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
          <UserPlus size={17} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Register beneficiary</h2>
          <p className="text-[11.5px] text-stone-500">Deduplicated by National ID.</p>
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
        <label className="label" htmlFor="fullName">Full name (as on National ID)</label>
        <input id="fullName" name="fullName" required className="input" placeholder="e.g. Amina Ekiru Lopeyok" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="nationalId">National ID no.</label>
          <input id="nationalId" name="nationalId" required inputMode="numeric" className="input num" placeholder="28103456" />
        </div>
        <div>
          <label className="label" htmlFor="birthYear">Year of birth</label>
          <input id="birthYear" name="birthYear" inputMode="numeric" className="input num" placeholder="1979" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" name="gender" className="input" defaultValue="FEMALE">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="householdSize">Household size</label>
          <input id="householdSize" name="householdSize" type="number" min={1} max={40} defaultValue={5} required className="input num" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="phone">Mobile phone (for SMS notices)</label>
        <input id="phone" name="phone" className="input num" placeholder="0712 345 678" />
      </div>

      <div>
        <label className="label" htmlFor="countyId">County</label>
        {lockedCountyName ? (
          <>
            <input type="text" value={`${lockedCountyName} (assigned)`} disabled className="input bg-stone-50 text-stone-500" />
          </>
        ) : (
          <select id="countyId" name="countyId" className="input" required defaultValue="">
            <option value="" disabled>Select county…</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="subCounty">Sub-county</label>
          <input id="subCounty" name="subCounty" className="input" placeholder="e.g. Turkana South" />
        </div>
        <div>
          <label className="label" htmlFor="village">Village / ward</label>
          <input id="village" name="village" className="input" placeholder="e.g. Kalokol" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="vulnerability">Vulnerability status</label>
        <select id="vulnerability" name="vulnerability" className="input" defaultValue="NONE">
          {VULNERABILITY_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
        {pending ? "Registering…" : "Register to national database"}
      </button>
    </form>
  );
}
