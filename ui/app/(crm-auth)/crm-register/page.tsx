"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Building2, CheckCircle2 } from "lucide-react";
import { useCrmAuth } from "@/contexts/crm-auth-context";
import { setCrmToken } from "@/lib/crm";
import { toast } from "sonner";

const CRM_API_BASE_URL =
  process.env.NEXT_PUBLIC_CRM_API_URL || "http://localhost:5001/api";

const benefits = [
  "Full CRM with contacts, deals & pipeline",
  "Vendor & contract management",
  "IoT device assignment & monitoring",
  "Support ticket system",
  "AI-powered analytics assistant",
  "Multi-user team collaboration",
];

export default function CrmRegisterPage() {
  const router = useRouter();
  const { isLoggedIn } = useCrmAuth();
  const t = useTranslations();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (isLoggedIn) {
      router.push("/crm");
    }
  }, [isLoggedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${CRM_API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          firstName,
          lastName,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Registration failed" }));
        throw new Error(error.message || "Registration failed");
      }

      const data = await response.json();

      // Store token and user to log in immediately
      setCrmToken(data.token);
      localStorage.setItem("crm_user", JSON.stringify(data.user));

      toast.success("Organization registered successfully!");
      // Force a full navigation so the auth store picks up the new localStorage values
      window.location.href = "/crm";
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left side - Form */}
      <div className="flex flex-1 flex-col justify-between p-6 md:p-8 lg:p-12">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-foreground">CRM Portal</span>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Register your organization
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create a new organization account to get started with the CRM
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Organization Name */}
              <div className="space-y-1.5">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Acme Corporation"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="h-10"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-10"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 pr-10"
                    disabled={isLoading}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10"
                  disabled={isLoading}
                  required
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full h-10 mt-1" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </form>

            {/* Sign in link */}
            <div className="mt-5 pt-5 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/crm-signin"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-muted-foreground">
          {t("auth.termsText")}{" "}
          <Link href="/terms" className="underline underline-offset-2">
            {t("auth.termsOfService")}
          </Link>{" "}
          {t("auth.and")}{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            {t("auth.privacyPolicy")}
          </Link>
          .
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-100 to-pink-50 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 p-8 rounded-l-3xl m-4 overflow-hidden">
        <div className="relative w-full max-w-sm">
          {/* Benefits card */}
          <div className="animate-float rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                <Building2 className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <span className="font-semibold text-foreground block">What you get</span>
                <span className="text-xs text-muted-foreground">Everything included</span>
              </div>
            </div>
            <ul className="space-y-3.5">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-foreground/80">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Background decorative elements */}
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-200/50 dark:bg-indigo-900/30 blur-3xl animate-float-slow" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-200/50 dark:bg-purple-900/30 blur-3xl animate-float-slower" />
          <div className="absolute top-1/2 -right-10 h-24 w-24 rounded-full bg-pink-200/40 dark:bg-pink-900/20 blur-2xl animate-float" />
        </div>
      </div>
    </div>
  );
}
