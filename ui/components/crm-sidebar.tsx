"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Users, HandCoins, Truck, FileText, TicketCheck } from "lucide-react";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
}

const crmNavItems: NavItem[] = [
  {
    titleKey: "nav.crm.dashboard",
    href: "/crm",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.companies",
    href: "/crm/companies",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.contacts",
    href: "/crm/contacts",
    icon: <Users className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.deals",
    href: "/crm/deals",
    icon: <HandCoins className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.vendors",
    href: "/crm/vendors",
    icon: <Truck className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.contracts",
    href: "/crm/contracts",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    titleKey: "nav.crm.tickets",
    href: "/crm/tickets",
    icon: <TicketCheck className="h-4 w-4" />,
  },
];

interface NavLinkProps {
  item: NavItem;
  collapsed?: boolean;
  title: string;
}

function NavLink({ item, collapsed, title }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      title={collapsed ? title : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {item.icon}
      {!collapsed && <span>{title}</span>}
    </Link>
  );
}

interface CrmSidebarProps {
  collapsed?: boolean;
}

export function CrmSidebar({ collapsed = false }: CrmSidebarProps) {
  const t = useTranslations();

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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-foreground">CRM Portal</span>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 space-y-1 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {crmNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            title={t(item.titleKey)}
          />
        ))}
      </nav>

      {/* Link to IoT Dashboard */}
      <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
        <Link
          href="/signin"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "IoT Dashboard" : undefined}
        >
          <LayoutDashboard className="h-4 w-4" />
          {!collapsed && <span>IoT Dashboard</span>}
        </Link>
      </div>
    </aside>
  );
}
