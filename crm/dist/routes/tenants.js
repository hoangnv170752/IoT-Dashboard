import { prisma } from '../services/prisma.js';
import { authenticate, requireSysAdmin } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;
export async function tenantRoutes(fastify) {
    // =====================
    // PUBLIC ROUTES (No auth required)
    // =====================
    // POST /tenants/register - Self-registration for new tenants
    fastify.post('/tenants/register', {
        schema: {
            tags: ['Tenants'],
            summary: 'Register new tenant',
            description: 'Self-registration for new tenants. Creates tenant with pending status awaiting approval.',
            body: {
                type: 'object',
                required: ['tenantName', 'slug', 'adminEmail', 'adminPassword', 'adminFirstName', 'adminLastName'],
                properties: {
                    tenantName: { type: 'string', minLength: 2, maxLength: 100 },
                    slug: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 2, maxLength: 50 },
                    domain: { type: 'string' },
                    adminEmail: { type: 'string', format: 'email' },
                    adminPassword: { type: 'string', minLength: 8 },
                    adminFirstName: { type: 'string', minLength: 1 },
                    adminLastName: { type: 'string', minLength: 1 },
                    adminPhone: { type: 'string' },
                    companyName: { type: 'string' },
                    companyIndustry: { type: 'string' },
                    companyWebsite: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const { tenantName, slug, domain, adminEmail, adminPassword, adminFirstName, adminLastName, adminPhone, companyName, companyIndustry, companyWebsite, } = request.body;
        // Check if slug is unique
        const existingTenant = await prisma.tenant.findUnique({
            where: { slug },
        });
        if (existingTenant) {
            return reply.status(400).send({ error: 'This organization slug is already taken' });
        }
        // Check if email is unique
        const existingUser = await prisma.user.findUnique({
            where: { email: adminEmail },
        });
        if (existingUser) {
            return reply.status(400).send({ error: 'This email is already registered' });
        }
        // Hash password
        const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
        // Create tenant with pending status
        const tenant = await prisma.tenant.create({
            data: {
                name: tenantName,
                slug,
                domain,
                status: 'pending',
            },
        });
        // Create tenant admin user (pending_verification until tenant approved)
        await prisma.user.create({
            data: {
                email: adminEmail,
                passwordHash,
                firstName: adminFirstName,
                lastName: adminLastName,
                phone: adminPhone,
                role: 'tenant_admin',
                status: 'pending_verification',
                tenantId: tenant.id,
            },
        });
        // Create company if provided
        if (companyName) {
            await prisma.company.create({
                data: {
                    name: companyName,
                    industry: companyIndustry,
                    website: companyWebsite,
                    tenantId: tenant.id,
                },
            });
        }
        return reply.status(201).send({
            message: 'Registration submitted successfully. Please wait for admin approval.',
            tenantId: tenant.id,
            tenantName: tenant.name,
            status: tenant.status,
        });
    });
    // GET /tenants/check-slug/:slug - Check if slug is available
    fastify.get('/tenants/check-slug/:slug', {
        schema: {
            tags: ['Tenants'],
            summary: 'Check slug availability',
            description: 'Check if a tenant slug is available for registration',
            params: {
                type: 'object',
                properties: {
                    slug: { type: 'string' },
                },
                required: ['slug'],
            },
        },
    }, async (request, reply) => {
        const { slug } = request.params;
        const existing = await prisma.tenant.findUnique({
            where: { slug },
        });
        return reply.send({
            slug,
            available: !existing,
        });
    });
    // =====================
    // PROTECTED ROUTES (SysAdmin only)
    // =====================
    // GET /tenants - List all tenants
    fastify.get('/tenants', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'List all tenants',
            description: 'Get a paginated list of all tenants (SysAdmin only)',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                    search: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'active', 'suspended', 'cancelled'] },
                },
            },
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, status } = request.query;
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status) {
            where.status = status;
        }
        const [data, total] = await Promise.all([
            prisma.tenant.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    users: {
                        where: { role: 'tenant_admin' },
                        take: 1,
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    _count: {
                        select: {
                            users: true,
                            companies: true,
                            deviceAssignments: true,
                        },
                    },
                    subscription: {
                        include: {
                            plan: true,
                        },
                    },
                },
            }),
            prisma.tenant.count({ where }),
        ]);
        return reply.send({
            data: data.map((tenant) => ({
                ...tenant,
                adminUser: tenant.users[0] || null,
                usersCount: tenant._count.users,
                companiesCount: tenant._count.companies,
                devicesCount: tenant._count.deviceAssignments,
                users: undefined,
                _count: undefined,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /tenants/pending - List pending tenants
    fastify.get('/tenants/pending', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'List pending tenants',
            description: 'Get a list of tenants waiting for approval',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        const where = { status: 'pending' };
        const [data, total] = await Promise.all([
            prisma.tenant.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'asc' },
                include: {
                    users: {
                        where: { role: 'tenant_admin' },
                        take: 1,
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    companies: {
                        take: 1,
                        select: {
                            id: true,
                            name: true,
                            industry: true,
                            website: true,
                        },
                    },
                },
            }),
            prisma.tenant.count({ where }),
        ]);
        return reply.send({
            data: data.map((tenant) => ({
                ...tenant,
                adminUser: tenant.users[0] || null,
                company: tenant.companies[0] || null,
                users: undefined,
                companies: undefined,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // POST /tenants/:id/approve - Approve or reject tenant
    fastify.post('/tenants/:id/approve', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Approve or reject tenant',
            description: 'Approve or reject a pending tenant registration',
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
                required: ['action'],
                properties: {
                    action: { type: 'string', enum: ['approve', 'reject'] },
                    reason: { type: 'string' },
                    planCode: { type: 'string', description: 'Plan code to assign (default: free)' },
                },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { action, reason, planCode = 'free' } = request.body;
        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: {
                users: { where: { role: 'tenant_admin' } },
            },
        });
        if (!tenant) {
            return reply.status(404).send({ error: 'Tenant not found' });
        }
        if (tenant.status !== 'pending') {
            return reply.status(400).send({ error: 'Tenant is not pending approval' });
        }
        if (action === 'approve') {
            // Get plan
            const plan = await prisma.plan.findUnique({
                where: { code: planCode },
            });
            if (!plan) {
                return reply.status(400).send({ error: 'Invalid plan code' });
            }
            // Update tenant status
            await prisma.tenant.update({
                where: { id },
                data: { status: 'active' },
            });
            // Activate all tenant users
            await prisma.user.updateMany({
                where: { tenantId: id },
                data: { status: 'active' },
            });
            // Create subscription
            await prisma.subscription.create({
                data: {
                    tenantId: id,
                    planId: plan.id,
                    billingCycle: 'monthly',
                    status: 'active',
                    startDate: new Date(),
                },
            });
            return reply.send({
                message: 'Tenant approved successfully',
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    status: 'active',
                    plan: plan.name,
                },
            });
        }
        else {
            // Reject - set status to cancelled
            await prisma.tenant.update({
                where: { id },
                data: {
                    status: 'cancelled',
                    settings: { rejectionReason: reason },
                },
            });
            // Deactivate all tenant users
            await prisma.user.updateMany({
                where: { tenantId: id },
                data: { status: 'inactive' },
            });
            return reply.send({
                message: 'Tenant rejected',
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    status: 'cancelled',
                    reason,
                },
            });
        }
    });
    // GET /tenants/:id - Get tenant by ID
    fastify.get('/tenants/:id', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Get tenant by ID',
            description: 'Get detailed tenant information including subscription and usage stats',
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
        const tenant = await prisma.tenant.findUnique({
            where: { id: request.params.id },
            include: {
                users: {
                    where: { role: 'tenant_admin' },
                    take: 1,
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
                subscription: {
                    include: {
                        plan: true,
                        invoices: {
                            take: 5,
                            orderBy: { createdAt: 'desc' },
                        },
                    },
                },
                _count: {
                    select: {
                        users: true,
                        companies: true,
                        vendors: true,
                        items: true,
                        contracts: true,
                        deviceAssignments: true,
                        assetAssignments: true,
                        chatSessions: true,
                    },
                },
            },
        });
        if (!tenant) {
            return reply.status(404).send({ error: 'Tenant not found' });
        }
        return reply.send({
            ...tenant,
            adminUser: tenant.users[0] || null,
            stats: {
                users: tenant._count.users,
                companies: tenant._count.companies,
                vendors: tenant._count.vendors,
                items: tenant._count.items,
                contracts: tenant._count.contracts,
                devices: tenant._count.deviceAssignments,
                assets: tenant._count.assetAssignments,
                chatSessions: tenant._count.chatSessions,
            },
            users: undefined,
            _count: undefined,
        });
    });
    // POST /tenants - Create tenant (by SysAdmin)
    fastify.post('/tenants', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Create tenant',
            description: 'Create a new tenant manually (SysAdmin only). Optionally create admin user.',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                    domain: { type: 'string' },
                    logo: { type: 'string' },
                    primaryColor: { type: 'string' },
                    settings: { type: 'object' },
                    adminEmail: { type: 'string', format: 'email' },
                    adminPassword: { type: 'string', minLength: 8 },
                    adminFirstName: { type: 'string' },
                    adminLastName: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const { name, slug, domain, logo, primaryColor, settings, adminEmail, adminPassword, adminFirstName, adminLastName } = request.body;
        // Check if slug is unique
        const existing = await prisma.tenant.findUnique({
            where: { slug },
        });
        if (existing) {
            return reply.status(400).send({ error: 'Slug already exists' });
        }
        // Check admin email if provided
        if (adminEmail) {
            const existingUser = await prisma.user.findUnique({
                where: { email: adminEmail },
            });
            if (existingUser) {
                return reply.status(400).send({ error: 'Admin email already exists' });
            }
        }
        // Create tenant with active status (created by SysAdmin)
        const tenant = await prisma.tenant.create({
            data: {
                name,
                slug,
                domain,
                logo,
                primaryColor,
                settings,
                status: 'active',
            },
        });
        // Create admin user if credentials provided
        if (adminEmail && adminPassword && adminFirstName && adminLastName) {
            const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
            await prisma.user.create({
                data: {
                    email: adminEmail,
                    passwordHash,
                    firstName: adminFirstName,
                    lastName: adminLastName,
                    role: 'tenant_admin',
                    status: 'active',
                    emailVerified: true,
                    tenantId: tenant.id,
                },
            });
        }
        // Create free subscription
        const freePlan = await prisma.plan.findUnique({
            where: { code: 'free' },
        });
        if (freePlan) {
            await prisma.subscription.create({
                data: {
                    tenantId: tenant.id,
                    planId: freePlan.id,
                    billingCycle: 'monthly',
                    status: 'active',
                    startDate: new Date(),
                },
            });
        }
        return reply.status(201).send(tenant);
    });
    // PUT /tenants/:id - Update tenant
    fastify.put('/tenants/:id', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Update tenant',
            description: 'Update tenant information',
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
                    name: { type: 'string' },
                    slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                    domain: { type: 'string' },
                    logo: { type: 'string' },
                    primaryColor: { type: 'string' },
                    settings: { type: 'object' },
                    status: { type: 'string', enum: ['pending', 'active', 'suspended', 'cancelled'] },
                },
            },
        },
    }, async (request, reply) => {
        const existing = await prisma.tenant.findUnique({
            where: { id: request.params.id },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Tenant not found' });
        }
        // Check slug uniqueness if changing
        if (request.body.slug && request.body.slug !== existing.slug) {
            const slugExists = await prisma.tenant.findUnique({
                where: { slug: request.body.slug },
            });
            if (slugExists) {
                return reply.status(400).send({ error: 'Slug already exists' });
            }
        }
        const tenant = await prisma.tenant.update({
            where: { id: request.params.id },
            data: request.body,
        });
        return reply.send(tenant);
    });
    // DELETE /tenants/:id - Soft delete tenant
    fastify.delete('/tenants/:id', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Delete tenant',
            description: 'Soft delete a tenant by setting status to cancelled',
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
        const existing = await prisma.tenant.findUnique({
            where: { id: request.params.id },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Tenant not found' });
        }
        // Soft delete
        await prisma.tenant.update({
            where: { id: request.params.id },
            data: { status: 'cancelled' },
        });
        // Deactivate all users
        await prisma.user.updateMany({
            where: { tenantId: request.params.id },
            data: { status: 'inactive' },
        });
        return reply.status(204).send();
    });
    // GET /tenants/:id/stats - Get tenant usage stats
    fastify.get('/tenants/:id/stats', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Tenants'],
            summary: 'Get tenant stats',
            description: 'Get detailed usage statistics for a tenant',
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
        const tenant = await prisma.tenant.findUnique({
            where: { id: request.params.id },
            include: {
                subscription: {
                    include: { plan: true },
                },
            },
        });
        if (!tenant) {
            return reply.status(404).send({ error: 'Tenant not found' });
        }
        const [usersCount, companiesCount, vendorsCount, itemsCount, contractsCount, devicesCount, assetsCount, activeDeals, openTickets,] = await Promise.all([
            prisma.user.count({ where: { tenantId: tenant.id } }),
            prisma.company.count({ where: { tenantId: tenant.id } }),
            prisma.vendor.count({ where: { tenantId: tenant.id } }),
            prisma.item.count({ where: { tenantId: tenant.id } }),
            prisma.contract.count({ where: { tenantId: tenant.id } }),
            prisma.deviceAssignment.count({ where: { tenantId: tenant.id } }),
            prisma.assetAssignment.count({ where: { tenantId: tenant.id } }),
            prisma.deal.count({
                where: {
                    company: { tenantId: tenant.id },
                    stage: { notIn: ['closed_won', 'closed_lost'] },
                },
            }),
            prisma.serviceTicket.count({
                where: {
                    deviceAssignment: { tenantId: tenant.id },
                    status: { in: ['open', 'in_progress'] },
                },
            }),
        ]);
        const plan = tenant.subscription?.plan;
        const usage = {
            users: {
                current: usersCount,
                limit: plan?.maxUsers ?? null,
                percentage: plan?.maxUsers ? (usersCount / plan.maxUsers) * 100 : null,
            },
            devices: {
                current: devicesCount,
                limit: plan?.maxDevices ?? null,
                percentage: plan?.maxDevices ? (devicesCount / plan.maxDevices) * 100 : null,
            },
            assets: {
                current: assetsCount,
                limit: plan?.maxAssets ?? null,
                percentage: plan?.maxAssets ? (assetsCount / plan.maxAssets) * 100 : null,
            },
        };
        return reply.send({
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: plan ? { name: plan.name, code: plan.code } : null,
            subscriptionStatus: tenant.subscription?.status ?? null,
            counts: {
                users: usersCount,
                companies: companiesCount,
                vendors: vendorsCount,
                items: itemsCount,
                contracts: contractsCount,
                devices: devicesCount,
                assets: assetsCount,
                activeDeals,
                openTickets,
            },
            usage,
        });
    });
}
//# sourceMappingURL=tenants.js.map