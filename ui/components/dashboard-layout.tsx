"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar collapsed={!sidebarOpen} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        {/* Main content - add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-auto bg-muted/30 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom navigation - only visible on mobile */}
      <BottomNav />
    </div>
  );
}
