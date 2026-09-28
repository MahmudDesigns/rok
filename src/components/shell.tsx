"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
  Wheat,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import { logoutAction } from "@/lib/actions/auth";

export type ShellUser = {
  name: string;
  email: string;
  roleLabel: string;
  countyName: string | null;
};

export type ShellPerms = {
  beneficiaries: boolean;
  stock: boolean;
  distributions: boolean;
  notices: boolean;
  users: boolean;
};

type NavItem = { href: string; label: string; icon: ReactNode };

export function AppShell({ user, perms, children }: { user: ShellUser; perms: ShellPerms; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("en-KE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const operations: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard size={17} strokeWidth={1.9} /> },
    ...(perms.beneficiaries || perms.distributions
      ? [{ href: "/beneficiaries", label: "Beneficiaries", icon: <Users size={17} strokeWidth={1.9} /> }]
      : []),
    { href: "/distributions", label: "Distributions", icon: <Truck size={17} strokeWidth={1.9} /> },
    { href: "/inventory", label: "Food inventory", icon: <Warehouse size={17} strokeWidth={1.9} /> },
    { href: "/notifications", label: "Notifications", icon: <Bell size={17} strokeWidth={1.9} /> },
  ];

  const administration: NavItem[] = [
    { href: "/reports", label: "Reports", icon: <ClipboardList size={17} strokeWidth={1.9} /> },
    ...(perms.users
      ? [{ href: "/users", label: "Officers & access", icon: <ShieldCheck size={17} strokeWidth={1.9} /> }]
      : []),
  ];

  const renderNav = (items: NavItem[]) =>
    items.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 font-display text-[13px] font-medium transition-colors",
            active
              ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
              : "text-forest-200/80 hover:bg-white/5 hover:text-white",
          )}
        >
          <span className={cn("transition-colors", active ? "text-ochre-300" : "text-forest-300/70 group-hover:text-ochre-300")}>
            {item.icon}
          </span>
          {item.label}
        </Link>
      );
    });

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ochre-300 to-ochre-500 text-forest-950 shadow-lg shadow-black/20">
            <Wheat size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ochre-300">
              Republic of Kenya
            </p>
            <p className="font-display text-[14.5px] font-semibold leading-tight text-white">
              National Food Relief
              <br />
              Management System
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-medium text-forest-200 ring-1 ring-inset ring-white/10">
          <MapPin size={12} className="shrink-0 text-ochre-300" />
          <span className="truncate">{user.countyName ? `${user.countyName} County office` : "National Command — all counties"}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-400">
          Operations
        </p>
        {renderNav(operations)}
        <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-400">
          Accountability
        </p>
        {renderNav(administration)}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate font-display text-[13px] font-semibold text-white">{user.name}</p>
          <p className="truncate text-[11px] text-forest-300/80">{user.roleLabel}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 font-display text-[12.5px] font-semibold text-forest-100 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="flag-band fixed inset-x-0 top-0 z-50 h-[3px]" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] bg-forest-950 lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-forest-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-forest-950 shadow-2xl">
            <button
              className="absolute right-3 top-4 rounded-lg p-1.5 text-forest-200 hover:bg-white/10"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-paper/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <button
              className="btn-secondary -ml-1 !px-2.5 !py-2 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={17} />
            </button>
            <div className="hidden items-center gap-2 font-display text-[12.5px] font-semibold text-forest-800 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-forest-700 text-white">
                <Wheat size={13} />
              </span>
              KNFRMS
              <span className="num rounded-md bg-forest-100 px-1.5 py-0.5 text-[10px] text-forest-700">v1.0</span>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden text-[12px] text-stone-500 md:block">{today}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-2.5 py-1 font-display text-[11px] font-semibold text-forest-800 ring-1 ring-inset ring-forest-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest-600" />
                </span>
                Network live
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1380px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">{children}</main>

        <footer className="border-t border-stone-200/70 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
            <p>
              A service of the <span className="font-semibold text-stone-500">Government of Kenya</span> · State
              Department for Social Protection · National Drought Management Authority
            </p>
            <p className="num">KNFRMS 1.0 · Built on the Government Cloud</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
