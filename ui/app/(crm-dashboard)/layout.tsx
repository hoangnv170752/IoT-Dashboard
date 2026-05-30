"use client";

import { CrmAuthProvider } from "@/contexts/crm-auth-context";
import { CrmAuthGuard } from "@/components/crm-auth-guard";
import { CrmDashboardLayout } from "@/components/crm-dashboard-layout";

export default function CrmDashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CrmAuthProvider>
      <CrmAuthGuard>
        <CrmDashboardLayout>{children}</CrmDashboardLayout>
      </CrmAuthGuard>
    </CrmAuthProvider>
  );
}
