"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { sendCustomNoticeAction } from "@/lib/actions/notifications";
import type { FormState } from "@/lib/format";

const initial: FormState = null;

export function NoticeForm({
  counties,
  lockedCountyName,
}: {
  counties: Array<{ id: number; name: string }>;
  lockedCountyName: string | null;
}) {
  const [state, formAction, pending] = useActionState(sendCustomNoticeAction, initial);
  const [message, setMessage] = useState("");

  return (
    <form action={formAction} className="card sticky top-20 space-y-4 p-6">
      <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
          <Megaphone size={16} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Custom notice</h2>
          <p className="text-[11.5px] text-stone-500">Broadcast to registered households.</p>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      {state?.success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-forest-200 bg-forest-50 px-3.5 py-3 text-[13px] leading-relaxed text-forest-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <p>{state.success}</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="countyId">Audience</label>
        {lockedCountyName ? (
          <input type="text" value={`${lockedCountyName} County (assigned)`} disabled className="input bg-stone-50 text-stone-500" />
        ) : (
          <select id="countyId" name="countyId" className="input" defaultValue="0">
            <option value={0}>All counties (national broadcast)</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>{c.name} County</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="message">Message</label>
          <span className={`num text-[10.5px] ${message.length > 420 ? "font-semibold text-red-600" : "text-stone-400"}`}>
            {message.length}/420
          </span>
        </div>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          maxLength={440}
          className="input resize-none"
          placeholder="e.g. Sorghum distribution at Wajir County Store moves to Saturday 7am due to truck delays. Bring your National ID."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-stone-400">
          Sent to all active beneficiaries with a phone number in the selected audience. Signed
          automatically as KNFRMS.
        </p>
      </div>

      <button type="submit" disabled={pending || message.trim().length < 10} className="btn-primary w-full">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} />}
        {pending ? "Queueing…" : "Queue notice for dispatch"}
      </button>
    </form>
  );
}
