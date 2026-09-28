import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "sky";
}) {
  const tones: Record<string, string> = {
    default: "bg-stone-100 text-stone-600",
    green: "bg-forest-100 text-forest-700",
    amber: "bg-ochre-100 text-ochre-700",
    red: "bg-red-100 text-red-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">
          {label}
        </p>
        <p className="num mt-1 text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
        {sub && <p className="mt-1.5 text-xs leading-snug text-stone-500">{sub}</p>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-display text-[11px] font-semibold",
        className ?? "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-300",
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "green",
  className,
}: {
  value: number;
  max: number;
  tone?: "green" | "amber" | "red" | "sky";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = {
    green: "bg-forest-500",
    amber: "bg-ochre-400",
    red: "bg-red-500",
    sky: "bg-sky-500",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-stone-200/70", className)}>
      <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        {icon}
      </div>
      <p className="font-display text-sm font-semibold text-stone-700">{title}</p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-stone-500">{body}</p>}
      {action}
    </div>
  );
}

export function NoticeBanner({
  tone = "green",
  children,
}: {
  tone?: "green" | "amber" | "red" | "sky";
  children: ReactNode;
}) {
  const tones = {
    green: "border-forest-300 bg-forest-50 text-forest-800",
    amber: "border-ochre-300 bg-ochre-50 text-ochre-800",
    red: "border-red-300 bg-red-50 text-red-800",
    sky: "border-sky-300 bg-sky-50 text-sky-900",
  };
  return (
    <div className={cn("mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {children}
    </div>
  );
}
