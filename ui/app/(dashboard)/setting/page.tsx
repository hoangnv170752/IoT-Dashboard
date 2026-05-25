"use client";

import { User, Bell, Shield, Palette, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export default function SettingPage() {
  const { user } = useAuth();
  const t = useTranslations();

  const settingSections = [
    {
      key: "profile",
      title: t("settings.profile.title"),
      description: t("settings.profile.description"),
      icon: User,
    },
    {
      key: "notifications",
      title: t("settings.notifications.title"),
      description: t("settings.notifications.description"),
      icon: Bell,
    },
    {
      key: "security",
      title: t("settings.security.title"),
      description: t("settings.security.description"),
      icon: Shield,
    },
    {
      key: "appearance",
      title: t("settings.appearance.title"),
      description: t("settings.appearance.description"),
      icon: Palette,
    },
  ];

  // Get initials from email or name
  const getInitials = () => {
    if (!user) return "";
    const name =
      user.firstName || user.lastName
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
        : user.email;
    return name
      .split("@")[0]
      .split(/[._-]/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  };

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email || "Guest";

  const handleComingSoon = () => {
    toast.info(t("common.comingSoon"));
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("settings.description")}
          </p>
        </div>

        {/* Profile Card */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src="/avatar.png" alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleComingSoon}>
            {t("settings.editProfile")}
          </Button>
        </div>

        {/* Language Selection Card */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t("settings.language.title")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("settings.language.description")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Setting Sections - Grid Layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                onClick={handleComingSoon}
                className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center transition-colors hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{section.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
