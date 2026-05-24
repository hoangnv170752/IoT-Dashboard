import { Cpu, Activity, Wifi, AlertTriangle } from "lucide-react";

const stats = [
  {
    title: "Total Devices",
    value: "24",
    change: "+2 from last week",
    icon: Cpu,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Online",
    value: "18",
    change: "75% of devices",
    icon: Wifi,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Data Points",
    value: "12.5K",
    change: "+15% from yesterday",
    icon: Activity,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Alerts",
    value: "3",
    change: "2 critical",
    icon: AlertTriangle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
];

const recentActivity = [
  { device: "Temperature Sensor", event: "Reading: 24.5°C", time: "2 min ago" },
  { device: "Motion Detector", event: "Motion detected", time: "5 min ago" },
  { device: "Humidity Sensor", event: "Reading: 65%", time: "8 min ago" },
  { device: "Smart Light", event: "Turned off", time: "15 min ago" },
  { device: "Door Lock", event: "Locked", time: "20 min ago" },
];

export default function Home() {
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your IoT devices and activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {activity.device}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.event}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
