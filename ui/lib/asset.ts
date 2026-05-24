import { getToken } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "";

export interface AssetId {
  entityType: string;
  id: string;
}

export interface AssetInfo {
  id: AssetId;
  createdTime: number;
  name: string;
  type: string;
  label: string | null;
  assetProfileId: AssetId;
  assetProfileName: string;
  additionalInfo?: {
    description?: string;
  } | null;
}

export interface AssetInfoResponse {
  data: AssetInfo[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

export interface AssetProfile {
  id: AssetId;
  tenantId: AssetId;
  name: string;
  image: string | null;
  defaultDashboardId: string | null;
}

export interface AssetProfileResponse {
  data: AssetProfile[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

// Fetch asset infos with optional filters
export async function fetchAssetInfos(options: {
  pageSize?: number;
  page?: number;
  assetProfileId?: string;
  textSearch?: string;
}): Promise<AssetInfoResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const { pageSize = 10, page = 0, assetProfileId, textSearch } = options;

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
    sortProperty: "createdTime",
    sortOrder: "DESC",
  });

  if (assetProfileId) {
    params.append("assetProfileId", assetProfileId);
  }

  if (textSearch) {
    params.append("textSearch", textSearch);
  }

  const response = await fetch(
    `${API_BASE_URL}/tenant/assetInfos?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch asset infos");
  }

  return response.json();
}

// Fetch asset profiles
export async function fetchAssetProfiles(options?: {
  pageSize?: number;
  page?: number;
}): Promise<AssetProfileResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const { pageSize = 100, page = 0 } = options || {};

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
    sortProperty: "name",
    sortOrder: "ASC",
  });

  const response = await fetch(
    `${API_BASE_URL}/assetProfileInfos?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Authorization": `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch asset profiles");
  }

  return response.json();
}

// Get total asset count
export async function getAssetCount(): Promise<number> {
  const response = await fetchAssetInfos({ pageSize: 1 });
  return response.totalElements;
}

// Get asset count by profile
export interface AssetCountByProfile {
  profileId: string;
  profileName: string;
  count: number;
}

export async function getAssetCountsByProfile(): Promise<AssetCountByProfile[]> {
  // Fetch all profiles first
  const profilesResponse = await fetchAssetProfiles({ pageSize: 100 });
  const profiles = profilesResponse.data;

  // Fetch asset count for each profile in parallel
  const countPromises = profiles.map(async (profile) => {
    const response = await fetchAssetInfos({
      pageSize: 1,
      assetProfileId: profile.id.id,
    });
    return {
      profileId: profile.id.id,
      profileName: profile.name,
      count: response.totalElements,
    };
  });

  const counts = await Promise.all(countPromises);

  // Filter out profiles with 0 assets and sort by count descending
  return counts
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}
