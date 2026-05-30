"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Users, HandCoins, FileText, TicketCheck, DollarSign, Loader2 } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { getCrmStats, CrmStats } from "@/lib/crm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const STAGE_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  qualified: "#3b82f6",
  proposal: "#f59e0b",
  negotiation: "#8b5cf6",
  closed_won: "#22c55e",
  closed_lost: "#ef4444",
};

export default function CrmDashboard() {
  const t = useTranslations();
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getCrmStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load CRM stats:", err);
        setError("Failed to load CRM statistics");
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, []);

  const statCards = [
    {
      title: t("crm.dashboard.totalCompanies"),
      value: stats?.companies ?? 0,
      icon: Building2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: t("crm.dashboard.totalContacts"),
      value: stats?.contacts ?? 0,
      icon: Users,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: t("crm.dashboard.totalDeals"),
      value: stats?.deals.total ?? 0,
      icon: HandCoins,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: t("crm.dashboard.dealValue"),
      value: `$${((stats?.deals.totalValue ?? 0) / 1000).toFixed(0)}k`,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: t("crm.dashboard.activeContracts"),
      value: stats?.contracts.active ?? 0,
      icon: FileText,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      title: t("crm.dashboard.openTickets"),
      value: stats?.tickets.open ?? 0,
      icon: TicketCheck,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  // Prepare deals by stage chart data
  const dealsByStageData = stats?.deals.byStage
    ? Object.entries(stats.deals.byStage).map(([stage, count]) => ({
        name: t(`crm.deals.stages.${stage}`),
        value: count,
        fill: STAGE_COLORS[stage] || "#6366f1",
      }))
    : [];

  const dealsChartConfig: ChartConfig = dealsByStageData.reduce(
    (acc, item) => ({
      ...acc,
      [item.name]: {
        label: item.name,
        color: item.fill,
      },
    }),
    { value: { label: "Deals" } } as ChartConfig
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
          <p>{error}</p>
          <p className="text-sm mt-2">Make sure the CRM backend is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            {t("crm.dashboard.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("crm.dashboard.description")}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`rounded-md p-1.5 ${stat.bgColor}`}>
                    <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Deals by Stage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("crm.dashboard.dealsByStage")}</CardTitle>
              <CardDescription className="text-xs">
                {t("crm.deals.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealsByStageData.length > 0 ? (
                <ChartContainer
                  config={dealsChartConfig}
                  className="h-[220px] w-full"
                >
                  <BarChart
                    data={dealsByStageData}
                    layout="vertical"
                    margin={{ left: 0, right: 16 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="value" radius={4}>
                      {dealsByStageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-muted-foreground">
                  {t("common.noData")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract & Ticket Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("crm.dashboard.recentActivity")}</CardTitle>
              <CardDescription className="text-xs">
                Contracts and support tickets overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium">{t("crm.contracts.title")}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats?.contracts.expiringSoon ?? 0} expiring soon
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{stats?.contracts.total ?? 0}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <TicketCheck className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{t("crm.tickets.title")}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats?.tickets.resolved ?? 0} resolved
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{stats?.tickets.total ?? 0}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Vendors</p>
                      <p className="text-xs text-muted-foreground">
                        Active suppliers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{stats?.vendors ?? 0}</p>
                    <p className="text-xs text-muted-foreground">total</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
