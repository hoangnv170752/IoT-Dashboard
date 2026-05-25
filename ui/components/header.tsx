"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  FileText,
  Sparkles,
  CreditCard,
  Bell,
  User,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface HeaderProps {
  title?: string;
  breadcrumb?: React.ReactNode;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({
  title,
  breadcrumb,
  sidebarOpen,
  onToggleSidebar,
}: HeaderProps) {
  const t = useTranslations();
  const { user, logout } = useAuth();

  const showComingSoon = () => {
    toast.info(t("common.comingSoon"));
  };

  // Get initials from email or name
  const getInitials = () => {
    if (!user) return "";
    const name = user.firstName || user.lastName
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
      : user.email;
    return name
      .split("@")[0]
      .split(/[._-]/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  };

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      {/* Left side - Breadcrumb or Title */}
      <div className="flex items-center gap-2">
        {/* Sidebar toggle - hidden on mobile */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 text-muted-foreground md:flex"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>
        )}
        {breadcrumb || (
          <h1 className="text-sm font-medium text-foreground">{title}</h1>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1">
        {/* Desktop-only buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={showComingSoon}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden lg:inline">{t("nav.feedback")}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={showComingSoon}
        >
          <FileText className="h-4 w-4" />
          <span className="hidden lg:inline">{t("nav.docs")}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={showComingSoon}
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden lg:inline">{t("nav.ask")}</span>
        </Button>

        <div className="mx-2 hidden h-6 w-px bg-border sm:block" />

        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-muted-foreground sm:flex"
          onClick={showComingSoon}
        >
          <CreditCard className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={showComingSoon}
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* User info */}
        {user && (
          <>
            <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/avatar.png" alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground lg:inline max-w-32 truncate">
                {displayName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={logout}
              title={t("nav.signOut")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Mobile avatar only */}
        {user && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8 rounded-full sm:hidden"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src="/avatar.png" alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        )}

        {/* Show default avatar if not logged in */}
        {!user && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8 rounded-full"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        )}
      </div>
    </header>
  );
}
