"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Cpu, Box, Settings } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: "Devices",
    href: "/device",
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    title: "Assets",
    href: "/assets",
    icon: <Box className="h-4 w-4" />,
  },
  {
    title: "Settings",
    href: "/setting",
    icon: <Settings className="h-4 w-4" />,
  },
];

interface NavLinkProps {
  item: NavItem;
  collapsed?: boolean;
}

function NavLink({ item, collapsed }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {item.icon}
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );
}

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-border",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        <Image
          src="/iot-icon.png"
          alt="IoT"
          width={32}
          height={32}
          className="rounded-md"
        />
        {!collapsed && (
          <span className="font-semibold text-foreground">IoT Dashboard</span>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 space-y-1 py-4",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
