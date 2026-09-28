"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import type { FormState } from "@/lib/format";

const initial: FormState = null;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          Official email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="officer@gokrelief.go.ke"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••••"
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {pending ? "Verifying credentials…" : "Sign in securely"}
      </button>
      <p className="pt-1 text-center text-[11.5px] leading-relaxed text-stone-400">
        Password forgotten or account locked? Contact the National Administrator at the State
        Department for Social Protection.
      </p>
    </form>
  );
}
