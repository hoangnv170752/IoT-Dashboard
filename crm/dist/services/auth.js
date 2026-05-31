import bcrypt from 'bcrypt';
import { prisma } from './prisma.js';
const SALT_ROUNDS = 12;
const THINGSBOARD_URL = process.env.THINGSBOARD_URL || 'https://iot.eaut.edu.vn/api';
// Password hashing
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
export async function validateThingsBoardToken(token) {
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
    }
    catch (error) {
        console.error('ThingsBoard token validation error:', error);
        return null;
    }
}
export async function syncThingsBoardUser(tbUser) {
    let isNewUser = false;
    let isNewTenant = false;
    let tenant = null;
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
    let role = 'tenant_user';
    if (tbUser.authority === 'TENANT_ADMIN') {
        role = 'tenant_admin';
    }
    else if (tbUser.authority === 'CUSTOMER_USER') {
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
    }
    else {
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
// Create JWT payload from user
export function createJwtPayload(user) {
    return {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        companyId: user.companyId,
    };
}
// Validate SysAdmin login
export async function validateSysAdminLogin(email, password) {
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
export async function validateUserLogin(email, password) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true },
    });
    if (!user || !user.passwordHash) {
        return { user: null, error: 'invalid_credentials' };
    }
    if (user.status !== 'active') {
        return { user: null, error: 'user_inactive' };
    }
    // Check tenant status (skip for sys_admin who has no tenant)
    if (user.tenant) {
        if (user.tenant.status === 'suspended') {
            return { user: null, error: 'tenant_suspended' };
        }
        if (user.tenant.status === 'cancelled') {
            return { user: null, error: 'tenant_cancelled' };
        }
    }
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return { user: null, error: 'invalid_credentials' };
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    return { user };
}
// Create SysAdmin user (for initial setup)
export async function createSysAdmin(email, password, firstName, lastName) {
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
export async function getUserById(userId) {
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
export async function hasPermission(userId, resource, action) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { permissions: true },
    });
    if (!user)
        return false;
    // SysAdmin has all permissions
    if (user.role === 'sys_admin')
        return true;
    // Tenant Admin has all permissions within tenant
    if (user.role === 'tenant_admin') {
        return ['read', 'write', 'delete', 'admin'].includes(action);
    }
    // Check specific permissions
    const permission = user.permissions.find((p) => p.resource === resource && p.action === action);
    if (permission)
        return true;
    // Default permissions based on role
    if (user.role === 'tenant_user') {
        return ['read', 'write'].includes(action);
    }
    if (user.role === 'customer_user') {
        return action === 'read';
    }
    return false;
}
//# sourceMappingURL=auth.js.map