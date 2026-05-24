"use client";

import { Loader2 } from "lucide-react";

import {
  AttributeValue,
  formatAttributeValue,
} from "@/lib/telemetry";

interface AttributesSectionProps {
  title?: string;
  isLoading?: boolean;
  error?: string | null;
  attributes: AttributeValue[] | null;
}

export function AttributesSection({
  title = "Server attributes",
  isLoading = false,
  error = null,
  attributes,
}: AttributesSectionProps) {
  return (
    <div className="border-t border-border pt-3">
      <div className="text-sm font-medium mb-2">{title}</div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : !attributes || attributes.length === 0 ? (
        <div className="text-sm text-muted-foreground">No attributes</div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {attributes.map((attr) => (
            <div
              key={attr.key}
              className="flex items-start justify-between gap-3 py-1.5"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-xs break-all">{attr.key}</span>
                <span className="text-[10px] text-muted-foreground">
                  Updated{" "}
                  {new Date(attr.lastUpdateTs).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="font-mono text-xs text-right break-all">
                {formatAttributeValue(attr.key, attr.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
