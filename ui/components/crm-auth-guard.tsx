"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useCrmAuth } from "@/contexts/crm-auth-context";
import { Loader2 } from "lucide-react";

const emptySubscribe = () => () => {};
function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  
    () => false  
  );
}

interface CrmAuthGuardProps {
  children: React.ReactNode;
}

export function CrmAuthGuard({ children }: CrmAuthGuardProps) {
  const { isLoggedIn } = useCrmAuth();
  const router = useRouter();
  const hasMounted = useHasMounted();

  useEffect(() => {
    if (hasMounted && !isLoggedIn) {
      router.push("/crm-signin");
    }
  }, [hasMounted, isLoggedIn, router]);

  // Before mount or if not logged in, show spinner
  if (!hasMounted || !isLoggedIn) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
