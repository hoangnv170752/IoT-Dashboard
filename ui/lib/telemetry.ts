import { getToken } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type AttributeScope =
  | "SERVER_SCOPE"
  | "CLIENT_SCOPE"
  | "SHARED_SCOPE";

export type EntityType = "DEVICE" | "ASSET";

export interface AttributeValue {
  lastUpdateTs: number;
  key: string;
  value: string | number | boolean | null;
}

export async function fetchAttributes(
  entityType: EntityType,
  entityId: string,
  scope: AttributeScope = "SERVER_SCOPE"
): Promise<AttributeValue[]> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(
    `${API_BASE_URL}/plugins/telemetry/${entityType}/${entityId}/values/attributes/${scope}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch attributes");
  }

  return response.json();
}

// Render an attribute value as a string. Numeric values for keys ending in
// "Time" or "Ts" are treated as epoch milliseconds and formatted as a date.
export function formatAttributeValue(
  key: string,
  value: AttributeValue["value"]
): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (
    typeof value === "number" &&
    (key.endsWith("Time") || key.endsWith("Ts")) &&
    value > 1_000_000_000_000
  ) {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return String(value);
}
