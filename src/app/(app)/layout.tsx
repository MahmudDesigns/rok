import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, can } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        roleLabel: ROLE_LABELS[user.role],
        countyName: user.countyName,
      }}
      perms={{
        beneficiaries: can.registerBeneficiaries(user),
        stock: can.manageStock(user),
        distributions: can.manageDistributions(user),
        notices: can.sendNotices(user),
        users: can.manageUsers(user),
      }}
    >
      {children}
    </AppShell>
  );
}
