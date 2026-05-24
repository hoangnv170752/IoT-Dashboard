import { DashboardLayout } from "@/components/dashboard-layout";
import { AuthGuard } from "@/components/auth-guard";
import { WebSocketProvider } from "@/components/websocket-provider";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <WebSocketProvider>
        <DashboardLayout title="Dashboard">{children}</DashboardLayout>
      </WebSocketProvider>
    </AuthGuard>
  );
}
