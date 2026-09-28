import type { Role, DistributionStatus } from "@/db/schema";

export const nf = new Intl.NumberFormat("en-KE");

export function fmtInt(n?: number | null): string {
  return nf.format(n ?? 0);
}

const dateFmt = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}

/** "2026-02-14T07:30" for datetime-local inputs */
export function toInputDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toTonnes(kg: number): string {
  const t = kg / 1000;
  return t >= 1000 ? nf.format(Math.round(t)) : t.toFixed(1);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "System Administrator",
  NATIONAL_OFFICER: "National Officer",
  COUNTY_OFFICER: "County Officer",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  PARTNER: "Partner (read-only)",
};

export const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-forest-800 text-white",
  NATIONAL_OFFICER: "bg-forest-100 text-forest-800 ring-1 ring-inset ring-forest-300",
  COUNTY_OFFICER: "bg-ochre-100 text-ochre-800 ring-1 ring-inset ring-ochre-300",
  WAREHOUSE_MANAGER: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300",
  PARTNER: "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-300",
};

export const VULNERABILITY_LABELS: Record<string, string> = {
  NONE: "General",
  ELDERLY: "Elderly (65+)",
  DISABLED: "Person with disability",
  ORPHANED: "Orphaned / child-headed",
  CHRONICALLY_ILL: "Chronically ill",
  PREGNANT_LACTATING: "Pregnant / lactating",
};

export const VULNERABILITY_OPTIONS = Object.entries(VULNERABILITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const DIST_STATUS_META: Record<
  DistributionStatus,
  { label: string; badge: string; dot: string }
> = {
  SCHEDULED: {
    label: "Scheduled",
    badge: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300",
    dot: "bg-sky-500",
  },
  ACTIVE: {
    label: "Active now",
    badge: "bg-ochre-100 text-ochre-800 ring-1 ring-inset ring-ochre-300",
    dot: "bg-ochre-500",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-forest-100 text-forest-800 ring-1 ring-inset ring-forest-300",
    dot: "bg-forest-600",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-300",
    dot: "bg-red-500",
  },
};

export const NOTIF_STATUS_META: Record<
  string,
  { label: string; badge: string }
> = {
  QUEUED: {
    label: "Queued",
    badge: "bg-ochre-100 text-ochre-800 ring-1 ring-inset ring-ochre-300",
  },
  SENT: {
    label: "Sent",
    badge: "bg-forest-100 text-forest-800 ring-1 ring-inset ring-forest-300",
  },
  FAILED: {
    label: "Failed",
    badge: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-300",
  },
};

export const INTAKE_SOURCES = [
  "National Food Reserve (NCPB)",
  "Strategic Food Reserve Trust Fund",
  "World Food Programme (WFP)",
  "Kenya Red Cross Society",
  "County Government Purchase",
  "Other partner",
];

export type FormState = { error?: string; success?: string } | null;
