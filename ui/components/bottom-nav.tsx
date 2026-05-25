"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Cpu, Box, Settings } from "lucide-react";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
}

const bottomNavItems: NavItem[] = [
  {
    titleKey: "nav.dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    titleKey: "nav.devices",
    href: "/device",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    titleKey: "nav.assets",
    href: "/assets",
    icon: <Box className="h-5 w-5" />,
  },
  {
    titleKey: "nav.settings",
    href: "/setting",
    icon: <Settings className="h-5 w-5" />,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex h-16 items-center justify-around px-4">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                {item.icon}
              </span>
              <span>{t(item.titleKey)}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-safe-area-inset-bottom bg-background" />
    </nav>
  );
}
