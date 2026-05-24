"use client";

import { User, Bell, Shield, Palette, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const settingSections = [
  {
    title: "Profile",
    description: "Manage your account settings",
    icon: User,
    href: "/setting/profile",
  },
  {
    title: "Notifications",
    description: "Configure notification preferences",
    icon: Bell,
    href: "/setting/notifications",
  },
  {
    title: "Security",
    description: "Password and authentication",
    icon: Shield,
    href: "/setting/security",
  },
  {
    title: "Appearance",
    description: "Customize the dashboard look",
    icon: Palette,
    href: "/setting/appearance",
  },
  {
    title: "Language & Region",
    description: "Set your language and timezone",
    icon: Globe,
    href: "/setting/language",
  },
];

export default function SettingPage() {
  const { user } = useAuth();

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
    toast.info("Coming soon!");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and preferences
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
            Edit Profile
          </Button>
        </div>

        {/* Setting Sections - Grid Layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.title}
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
