"use client";

import { useState } from "react";
import { CrmSidebar } from "@/components/crm-sidebar";
import { CrmHeader } from "@/components/crm-header";

interface CrmDashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function CrmDashboardLayout({ children, title }: CrmDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <CrmSidebar collapsed={!sidebarOpen} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <CrmHeader
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
