"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCrmAuth } from "@/contexts/crm-auth-context";
import { Loader2 } from "lucide-react";

interface CrmAuthGuardProps {
  children: React.ReactNode;
}

export function CrmAuthGuard({ children }: CrmAuthGuardProps) {
  const { isLoggedIn, isLoading } = useCrmAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/crm-signin");
    }
  }, [isLoading, isLoggedIn, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render children if not logged in
  if (!isLoggedIn) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
