const API_BASE_URL = "https://iot.eaut.edu.vn/api";

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface User {
  id: {
    entityType: string;
    id: string;
  };
  email: string;
  authority: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  tenantId: {
    entityType: string;
    id: string;
  };
  customerId: {
    entityType: string;
    id: string;
  };
  additionalInfo?: {
    description?: string;
    lang?: string;
    lastLoginTs?: number;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Token storage keys
const TOKEN_KEY = "tb_token";
const REFRESH_TOKEN_KEY = "tb_refresh_token";
const USER_KEY = "tb_user";

// Save tokens to localStorage
export function saveTokens(tokens: AuthTokens): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, tokens.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

// Get token from localStorage
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

// Get refresh token from localStorage
export function getRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

// Save user to localStorage
export function saveUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

// Get user from localStorage
export function getStoredUser(): User | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Clear all auth data
export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Parse JWT to get user ID
function parseJwt(token: string): { userId?: string } | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Login with username and password
export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Login failed");
  }

  const tokens: AuthTokens = await response.json();
  saveTokens(tokens);
  return tokens;
}

// Fetch user details
export async function fetchUser(userId: string): Promise<User> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token");
  }

  const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const user: User = await response.json();
  saveUser(user);
  return user;
}

// Login and fetch user in one call
export async function loginAndFetchUser(
  credentials: LoginCredentials
): Promise<{ tokens: AuthTokens; user: User }> {
  const tokens = await login(credentials);

  // Parse token to get userId
  const payload = parseJwt(tokens.token);
  if (!payload?.userId) {
    throw new Error("Invalid token: no userId found");
  }

  const user = await fetchUser(payload.userId);
  return { tokens, user };
}

// Logout
export function logout(): void {
  clearAuth();
  if (typeof window !== "undefined") {
    window.location.href = "/signin";
  }
}
