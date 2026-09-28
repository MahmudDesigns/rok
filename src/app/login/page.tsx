import { redirect } from "next/navigation";
import Image from "next/image";
import { Wheat, ShieldCheck, Radio, Landmark } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="grid min-h-screen bg-forest-950 lg:grid-cols-[1.05fr_1fr]">
      <div className="flag-band fixed inset-x-0 top-0 z-50 h-[3px]" />

      {/* Editorial panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/login-hero.jpg"
          alt="National grain reserves in the Kenyan highlands"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/55 to-forest-950/20" />
        <div className="absolute inset-0 dot-grid opacity-40" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ochre-300 to-ochre-500 text-forest-950 shadow-xl">
              <Wheat size={24} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ochre-300">
                Republic of Kenya
              </p>
              <p className="font-display text-base font-semibold text-white">
                National Food Relief Management System
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h1 className="font-display text-[40px] font-semibold leading-[1.08] tracking-tight text-white">
              Every bag of relief food,
              <br />
              <span className="text-ochre-300">accounted for.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-forest-100/85">
              One national register of beneficiaries, real-time warehouse inventory, transparent
              allocation and SMS notification — replacing paper records across all 47 counties.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                { icon: <Landmark size={13} />, label: "47 counties, one register" },
                { icon: <ShieldCheck size={13} />, label: "Deduplication by National ID" },
                { icon: <Radio size={13} />, label: "SMS alerts to households" },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-display text-[12px] font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm"
                >
                  <span className="text-ochre-300">{chip.icon}</span>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-forest-200/60">
            State Department for Social Protection · Special Programmes · National Drought Management
            Authority. Authorised officers only — all activity is audited.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-paper px-5 py-12 sm:px-10">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative w-full max-w-[430px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ochre-300 to-ochre-500 text-forest-950">
                <Wheat size={22} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ochre-600">
                  Republic of Kenya
                </p>
                <p className="font-display text-sm font-semibold text-forest-900">
                  National Food Relief Management System
                </p>
              </div>
            </div>
          </div>

          <div className="card p-7 sm:p-9">
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">
              Officer sign-in
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
              Access is restricted to authorised government officers and registered partners.
            </p>
            <LoginForm />
          </div>

          <details className="group mt-5 rounded-xl border border-stone-200 bg-white/70 text-sm open:bg-white">
            <summary className="cursor-pointer select-none px-4 py-3 font-display text-[12.5px] font-semibold text-stone-600 transition-colors hover:text-forest-800">
              Demonstration access — 5 officer roles
            </summary>
            <div className="space-y-1.5 border-t border-stone-100 px-4 py-3.5 text-[12.5px] text-stone-600">
              <p className="mb-2 text-stone-500">
                Password for all accounts: <span className="num font-semibold text-ink">Relief@123</span>
              </p>
              {[
                ["Administrator (all counties)", "admin@gokrelief.go.ke"],
                ["National officer", "national@gokrelief.go.ke"],
                ["County officer — Turkana", "turkana@gokrelief.go.ke"],
                ["Warehouse manager — Nakuru", "warehouse@gokrelief.go.ke"],
                ["Partner, read-only", "partner@relieforg.or.ke"],
              ].map(([label, email]) => (
                <p key={email} className="flex items-baseline justify-between gap-3">
                  <span>{label}</span>
                  <span className="num text-[11.5px] text-forest-700">{email}</span>
                </p>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
