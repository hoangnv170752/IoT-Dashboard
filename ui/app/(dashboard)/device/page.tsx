import { Cpu, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

const devices = [
  { id: 1, name: "Temperature Sensor", status: "online", type: "Sensor", lastSeen: "2 min ago" },
  { id: 2, name: "Humidity Sensor", status: "online", type: "Sensor", lastSeen: "5 min ago" },
  { id: 3, name: "Smart Light", status: "offline", type: "Actuator", lastSeen: "2 hours ago" },
  { id: 4, name: "Motion Detector", status: "online", type: "Sensor", lastSeen: "1 min ago" },
  { id: 5, name: "Door Lock", status: "online", type: "Actuator", lastSeen: "30 sec ago" },
];

export default function DevicePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              Devices
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage and monitor your IoT devices
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Device
          </Button>
        </div>

        {/* Device List */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{device.name}</p>
                    <p className="text-xs text-muted-foreground">{device.type}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      device.status === "online" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="capitalize text-muted-foreground">
                    {device.status}
                  </span>
                </div>
                <span className="text-muted-foreground">{device.lastSeen}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
