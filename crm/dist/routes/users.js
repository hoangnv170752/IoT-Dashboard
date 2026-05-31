import { prisma } from '../services/prisma.js';
import { hashPassword } from '../services/auth.js';
import { authenticate, requireTenantAdmin, withTenantScope } from '../middleware/auth.js';
export async function userRoutes(fastify) {
    // All routes require authentication
    fastify.addHook('preHandler', authenticate);
    // GET /users - List users
    fastify.get('/users', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Users'],
            summary: 'List users',
            description: 'Get a paginated list of users. SysAdmin sees all, others see their tenant.',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                    search: { type: 'string' },
                    role: { type: 'string', enum: ['sys_admin', 'tenant_admin', 'tenant_user', 'customer_user'] },
                    status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'pending_verification'] },
                },
            },
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, role, status } = request.query;
        const skip = (page - 1) * limit;
        let where = withTenantScope(request);
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (role) {
            where.role = role;
        }
        if (status) {
            where.status = status;
        }
        // Non-SysAdmin cannot see SysAdmin users
        if (request.user?.role !== 'sys_admin') {
            where.role = { not: 'sys_admin' };
        }
        const [data, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    avatar: true,
                    role: true,
                    status: true,
                    lastLoginAt: true,
                    createdAt: true,
                    tenant: {
                        select: { id: true, name: true },
                    },
                    company: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /users/:id - Get user by ID
    fastify.get('/users/:id', {
        schema: {
            tags: ['Users'],
            summary: 'Get user by ID',
            description: 'Get user details with permissions',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
            },
        },
    }, async (request, reply) => {
        const where = { id: request.params.id };
        // Scope to tenant unless SysAdmin
        if (request.user?.role !== 'sys_admin' && request.user?.tenantId) {
            where.tenantId = request.user.tenantId;
        }
        const user = await prisma.user.findFirst({
            where,
            include: {
                tenant: true,
                company: true,
                permissions: true,
            },
        });
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Don't expose password hash
        const { passwordHash, ...userData } = user;
        return reply.send(userData);
    });
    // POST /users - Create/invite user
    fastify.post('/users', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Users'],
            summary: 'Create user',
            description: 'Create a new user or invite to tenant',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['email', 'firstName', 'lastName'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    phone: { type: 'string' },
                    role: { type: 'string', enum: ['tenant_admin', 'tenant_user', 'customer_user'] },
                    companyId: { type: 'string', format: 'uuid' },
                },
            },
        },
    }, async (request, reply) => {
        const { email, password, firstName, lastName, phone, role, companyId } = request.body;
        // Check email uniqueness
        const existing = await prisma.user.findUnique({
            where: { email },
        });
        if (existing) {
            return reply.status(400).send({ error: 'Email already exists' });
        }
        // Validate role assignment
        let userRole = role || 'tenant_user';
        // Only SysAdmin can create other SysAdmins
        if (request.user?.role !== 'sys_admin') {
            if (userRole === 'sys_admin') {
                return reply.status(403).send({ error: 'Cannot create SysAdmin users' });
            }
        }
        // Validate company for customer_user
        if (userRole === 'customer_user' && !companyId) {
            return reply.status(400).send({ error: 'companyId required for customer_user role' });
        }
        const data = {
            email,
            firstName,
            lastName,
            phone,
            role: userRole,
            status: password ? 'active' : 'pending_verification',
            emailVerified: false,
        };
        // Set tenant (unless SysAdmin creating SysAdmin)
        if (userRole !== 'sys_admin') {
            data.tenantId = request.user?.tenantId;
        }
        if (companyId) {
            data.companyId = companyId;
        }
        // Hash password if provided
        if (password) {
            data.passwordHash = await hashPassword(password);
        }
        const user = await prisma.user.create({
            data: data,
            include: {
                tenant: true,
                company: true,
            },
        });
        // Don't expose password hash
        const { passwordHash, ...userData } = user;
        return reply.status(201).send(userData);
    });
    // PUT /users/:id - Update user
    fastify.put('/users/:id', {
        schema: {
            tags: ['Users'],
            summary: 'Update user',
            description: 'Update user information',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    phone: { type: 'string' },
                    role: { type: 'string', enum: ['tenant_admin', 'tenant_user', 'customer_user'] },
                    status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
                    companyId: { type: 'string', format: 'uuid' },
                },
            },
        },
    }, async (request, reply) => {
        const where = { id: request.params.id };
        // Scope to tenant unless SysAdmin
        if (request.user?.role !== 'sys_admin' && request.user?.tenantId) {
            where.tenantId = request.user.tenantId;
        }
        const existing = await prisma.user.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Prevent role escalation
        if (request.body.role && request.user?.role !== 'sys_admin') {
            if (request.body.role === 'sys_admin') {
                return reply.status(403).send({ error: 'Cannot assign SysAdmin role' });
            }
        }
        const data = { ...request.body };
        // Hash password if changing
        if (request.body.password) {
            data.passwordHash = await hashPassword(request.body.password);
            delete data.password;
        }
        const user = await prisma.user.update({
            where: { id: request.params.id },
            data: data,
            include: {
                tenant: true,
                company: true,
            },
        });
        const { passwordHash, ...userData } = user;
        return reply.send(userData);
    });
    // DELETE /users/:id - Deactivate user
    fastify.delete('/users/:id', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Users'],
            summary: 'Deactivate user',
            description: 'Deactivate a user (soft delete)',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
            },
        },
    }, async (request, reply) => {
        const where = { id: request.params.id };
        // Scope to tenant unless SysAdmin
        if (request.user?.role !== 'sys_admin' && request.user?.tenantId) {
            where.tenantId = request.user.tenantId;
        }
        const existing = await prisma.user.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Cannot deactivate yourself
        if (existing.id === request.user?.userId) {
            return reply.status(400).send({ error: 'Cannot deactivate yourself' });
        }
        // Cannot deactivate SysAdmin unless you are SysAdmin
        if (existing.role === 'sys_admin' && request.user?.role !== 'sys_admin') {
            return reply.status(403).send({ error: 'Cannot deactivate SysAdmin' });
        }
        await prisma.user.update({
            where: { id: request.params.id },
            data: { status: 'inactive' },
        });
        return reply.status(204).send();
    });
    // PUT /users/:id/permissions - Manage user permissions
    fastify.put('/users/:id/permissions', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Users'],
            summary: 'Manage permissions',
            description: 'Set granular permissions for a user',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                required: ['permissions'],
                properties: {
                    permissions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['resource', 'action'],
                            properties: {
                                resource: { type: 'string' },
                                action: { type: 'string' },
                                conditions: { type: 'object' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const where = { id: request.params.id };
        // Scope to tenant unless SysAdmin
        if (request.user?.role !== 'sys_admin' && request.user?.tenantId) {
            where.tenantId = request.user.tenantId;
        }
        const existing = await prisma.user.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Delete existing permissions
        await prisma.userPermission.deleteMany({
            where: { userId: request.params.id },
        });
        // Create new permissions
        const permissions = await prisma.userPermission.createMany({
            data: request.body.permissions.map((p) => ({
                userId: request.params.id,
                resource: p.resource,
                action: p.action,
                conditions: p.conditions,
            })),
        });
        // Fetch updated user with permissions
        const user = await prisma.user.findUnique({
            where: { id: request.params.id },
            include: { permissions: true },
        });
        return reply.send({
            userId: request.params.id,
            permissions: user?.permissions ?? [],
            updated: permissions.count,
        });
    });
}
//# sourceMappingURL=users.js.map