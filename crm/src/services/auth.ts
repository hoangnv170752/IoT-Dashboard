import bcrypt from 'bcrypt';
import { prisma } from './prisma.js';
import { User, UserRole, Tenant } from '../generated/prisma';

const SALT_ROUNDS = 12;
const THINGSBOARD_URL = process.env.THINGSBOARD_URL || 'https://iot.eaut.edu.vn/api';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ThingsBoard token validation
interface ThingsBoardUser {
  id: { entityType: string; id: string };
  email: string;
  firstName: string;
  lastName: string;
  authority: string;
  tenantId?: { entityType: string; id: string };
  customerId?: { entityType: string; id: string };
}

export async function validateThingsBoardToken(token: string): Promise<ThingsBoardUser | null> {
  try {
    const response = await fetch(`${THINGSBOARD_URL}/auth/user`, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('ThingsBoard token validation error:', error);
    return null;
  }
}

// Sync ThingsBoard user to CRM
export interface SyncUserResult {
  user: User;
  tenant: Tenant | null;
  isNewUser: boolean;
  isNewTenant: boolean;
}

export async function syncThingsBoardUser(tbUser: ThingsBoardUser): Promise<SyncUserResult> {
  let isNewUser = false;
  let isNewTenant = false;
  let tenant: Tenant | null = null;

  // Check if tenant exists
  if (tbUser.tenantId?.id) {
    tenant = await prisma.tenant.findUnique({
      where: { thingsboardTenantId: tbUser.tenantId.id },
    });

    // Create tenant if not exists
    if (!tenant) {
      isNewTenant = true;
      const slug = `tenant-${tbUser.tenantId.id.substring(0, 8)}`;
      tenant = await prisma.tenant.create({
        data: {
          name: `Tenant ${tbUser.tenantId.id.substring(0, 8)}`,
          slug,
          thingsboardTenantId: tbUser.tenantId.id,
          status: 'active',
        },
      });
    }
  }

  // Determine user role based on ThingsBoard authority
  let role: UserRole = 'tenant_user';
  if (tbUser.authority === 'TENANT_ADMIN') {
    role = 'tenant_admin';
  } else if (tbUser.authority === 'CUSTOMER_USER') {
    role = 'customer_user';
  }

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { thingsboardUserId: tbUser.id.id },
  });

  if (user) {
    // Update existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: tbUser.email,
        firstName: tbUser.firstName,
        lastName: tbUser.lastName,
        role,
        lastLoginAt: new Date(),
      },
    });
  } else {
    // Create new user
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        email: tbUser.email,
        firstName: tbUser.firstName,
        lastName: tbUser.lastName,
        thingsboardUserId: tbUser.id.id,
        role,
        tenantId: tenant?.id,
        status: 'active',
        emailVerified: true,
        lastLoginAt: new Date(),
      },
    });
  }

  return { user, tenant, isNewUser, isNewTenant };
}

// JWT payload interface
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  companyId: string | null;
}

// Create JWT payload from user
export function createJwtPayload(user: User): JwtPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    companyId: user.companyId,
  };
}

// Validate SysAdmin login
export async function validateSysAdminLogin(
  email: string,
  password: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.role !== 'sys_admin' || !user.passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

// Create SysAdmin user (for initial setup)
export async function createSysAdmin(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<User> {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'sys_admin',
      status: 'active',
      emailVerified: true,
    },
  });
}

// Get user by ID with relations
export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      company: true,
      permissions: true,
    },
  });
}

// Check if user has permission
export async function hasPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { permissions: true },
  });

  if (!user) return false;

  // SysAdmin has all permissions
  if (user.role === 'sys_admin') return true;

  // Tenant Admin has all permissions within tenant
  if (user.role === 'tenant_admin') {
    return ['read', 'write', 'delete', 'admin'].includes(action);
  }

  // Check specific permissions
  const permission = user.permissions.find(
    (p) => p.resource === resource && p.action === action
  );

  if (permission) return true;

  // Default permissions based on role
  if (user.role === 'tenant_user') {
    return ['read', 'write'].includes(action);
  }

  if (user.role === 'customer_user') {
    return action === 'read';
  }

  return false;
}
