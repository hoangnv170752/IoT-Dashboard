import { CrmAuthProvider } from "@/contexts/crm-auth-context";

export default function CrmAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CrmAuthProvider>{children}</CrmAuthProvider>;
}
