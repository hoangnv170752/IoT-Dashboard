import { User, Bell, Shield, Palette, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6 max-w-2xl">
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
              <AvatarImage src="/avatar.png" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                JD
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">John Doe</p>
              <p className="text-sm text-muted-foreground">john@example.com</p>
            </div>
          </div>
          <Button variant="outline">Edit Profile</Button>
        </div>

        {/* Setting Sections */}
        <div className="flex flex-col gap-2">
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.title}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{section.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
