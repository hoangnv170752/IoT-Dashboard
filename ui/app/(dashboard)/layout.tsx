import { DashboardLayout } from "@/components/dashboard-layout";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardLayout title="Dashboard">{children}</DashboardLayout>
    </AuthGuard>
  );
}
