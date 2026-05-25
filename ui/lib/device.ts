import { getToken } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "";

export interface DeviceId {
  entityType: string;
  id: string;
}

export interface DeviceInfo {
  id: DeviceId;
  createdTime: number;
  name: string;
  type: string;
  label: string;
  active: boolean;
  deviceProfileId: DeviceId;
  deviceProfileName: string;
  tenantId?: DeviceId;
  customerId?: DeviceId;
  firmwareId?: DeviceId | null;
  softwareId?: DeviceId | null;
  externalId?: DeviceId | null;
  version?: number;
  customerTitle?: string | null;
  customerIsPublic?: boolean;
  additionalInfo?: {
    gateway?: boolean;
    overwriteActivityTime?: boolean;
    description?: string;
  };
  deviceData?: {
    configuration?: { type: string };
    transportConfiguration?: { type: string };
  };
}

export interface DeviceCredentials {
  id: { id: string };
  createdTime: number;
  deviceId: DeviceId;
  credentialsType: string;
  credentialsId: string;
  credentialsValue: string | null;
  version: number;
}

export interface DeviceInfoResponse {
  data: DeviceInfo[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

export interface DeviceProfile {
  id: DeviceId;
  createdTime: number;
  name: string;
  description: string;
  type: string;
  transportType: string;
  default: boolean;
}

export interface DeviceProfileResponse {
  data: DeviceProfile[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

// Fetch device infos with optional filters
export async function fetchDeviceInfos(options: {
  pageSize?: number;
  page?: number;
  active?: boolean;
  deviceProfileId?: string;
  textSearch?: string;
}): Promise<DeviceInfoResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const { pageSize = 10, page = 0, active, deviceProfileId, textSearch } = options;

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
  });

  if (active !== undefined) {
    params.append("active", active.toString());
  }

  if (deviceProfileId) {
    params.append("deviceProfileId", deviceProfileId);
  }

  if (textSearch) {
    params.append("textSearch", textSearch);
  }

  const response = await fetch(
    `${API_BASE_URL}/tenant/deviceInfos?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch device infos");
  }

  return response.json();
}

export type DeviceCredentialsType = "ACCESS_TOKEN" | "X509_CERTIFICATE" | "MQTT_BASIC";

export interface CreateDevicePayload {
  device: {
    name: string;
    label?: string;
    deviceProfileId: DeviceId;
    additionalInfo?: {
      gateway?: boolean;
      overwriteActivityTime?: boolean;
      description?: string;
    };
    customerId?: DeviceId | null;
  };
  credentials?: {
    credentialsType: DeviceCredentialsType;
    credentialsId: string | null;
    credentialsValue: string | null;
  };
}

// Create a new device with optional credentials
export async function createDeviceWithCredentials(
  payload: CreateDevicePayload
): Promise<DeviceInfo> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_BASE_URL}/device-with-credentials`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Failed to create device");
  }

  return response.json();
}

// Fetch a single device by ID
export async function fetchDeviceById(deviceId: string): Promise<DeviceInfo> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_BASE_URL}/device/info/${deviceId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch device");
  }

  return response.json();
}

// Fetch device credentials by device ID
export async function fetchDeviceCredentials(
  deviceId: string
): Promise<DeviceCredentials> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(
    `${API_BASE_URL}/device/${deviceId}/credentials`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch device credentials");
  }

  return response.json();
}

// Fetch device profiles
export async function fetchDeviceProfiles(options?: {
  pageSize?: number;
  page?: number;
}): Promise<DeviceProfileResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const { pageSize = 100, page = 0 } = options || {};

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
    sortProperty: "createdTime",
    sortOrder: "DESC",
  });

  const response = await fetch(
    `${API_BASE_URL}/deviceProfiles?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch device profiles");
  }

  return response.json();
}

// Get online device count
export async function getOnlineDeviceCount(): Promise<number> {
  const response = await fetchDeviceInfos({ active: true });
  return response.totalElements;
}

// Get offline device count
export async function getOfflineDeviceCount(): Promise<number> {
  const response = await fetchDeviceInfos({ active: false });
  return response.totalElements;
}

// Get both online and offline counts
export async function getDeviceCounts(): Promise<{
  online: number;
  offline: number;
  total: number;
}> {
  const [onlineResponse, offlineResponse] = await Promise.all([
    fetchDeviceInfos({ active: true }),
    fetchDeviceInfos({ active: false }),
  ]);

  const online = onlineResponse.totalElements;
  const offline = offlineResponse.totalElements;

  return {
    online,
    offline,
    total: online + offline,
  };
}

// Get device count by profile
export interface DeviceCountByProfile {
  profileId: string;
  profileName: string;
  count: number;
}

export async function getDeviceCountsByProfile(): Promise<DeviceCountByProfile[]> {
  // Fetch all profiles first
  const profilesResponse = await fetchDeviceProfiles({ pageSize: 100 });
  const profiles = profilesResponse.data;

  // Fetch device count for each profile in parallel
  const countPromises = profiles.map(async (profile) => {
    const response = await fetchDeviceInfos({
      pageSize: 1,
      deviceProfileId: profile.id.id,
    });
    return {
      profileId: profile.id.id,
      profileName: profile.name,
      count: response.totalElements,
    };
  });

  const counts = await Promise.all(countPromises);

  // Filter out profiles with 0 devices and sort by count descending
  return counts
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}
