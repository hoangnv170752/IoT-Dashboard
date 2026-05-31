import { prisma } from '../services/prisma.js';
import { authenticate, requireTenantAdmin, withTenantScope } from '../middleware/auth.js';
export async function vendorRoutes(fastify) {
    // All routes require authentication
    fastify.addHook('preHandler', authenticate);
    // GET /vendors - List vendors
    fastify.get('/vendors', {
        schema: {
            tags: ['Vendors'],
            summary: 'List vendors',
            description: 'Get a paginated list of vendors',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                    search: { type: 'string' },
                    type: { type: 'string', enum: ['supplier', 'manufacturer', 'distributor', 'service_provider', 'partner'] },
                    status: { type: 'string', enum: ['pending', 'active', 'inactive', 'blacklisted'] },
                },
            },
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, type, status } = request.query;
        const skip = (page - 1) * limit;
        const where = withTenantScope(request);
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (type)
            where.type = type;
        if (status)
            where.status = status;
        const [data, total] = await Promise.all([
            prisma.vendor.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { contacts: true, items: true, contracts: true },
                    },
                },
            }),
            prisma.vendor.count({ where }),
        ]);
        return reply.send({
            data: data.map((v) => ({
                ...v,
                contactsCount: v._count.contacts,
                itemsCount: v._count.items,
                contractsCount: v._count.contracts,
                _count: undefined,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /vendors/:id - Get vendor by ID
    fastify.get('/vendors/:id', {
        schema: {
            tags: ['Vendors'],
            summary: 'Get vendor by ID',
            description: 'Get vendor details with contacts',
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
        const where = withTenantScope(request, { id: request.params.id });
        const vendor = await prisma.vendor.findFirst({
            where,
            include: {
                contacts: {
                    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
                },
                items: {
                    take: 10,
                    orderBy: { name: 'asc' },
                },
                contracts: {
                    take: 5,
                    orderBy: { startDate: 'desc' },
                },
            },
        });
        if (!vendor) {
            return reply.status(404).send({ error: 'Vendor not found' });
        }
        return reply.send(vendor);
    });
    // POST /vendors - Create vendor
    fastify.post('/vendors', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Vendors'],
            summary: 'Create vendor',
            description: 'Create a new vendor',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                    name: { type: 'string' },
                    code: { type: 'string' },
                    type: { type: 'string', enum: ['supplier', 'manufacturer', 'distributor', 'service_provider', 'partner'] },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    country: { type: 'string' },
                    taxId: { type: 'string' },
                    paymentTerms: { type: 'string' },
                    currency: { type: 'string' },
                    rating: { type: 'number', minimum: 0, maximum: 5 },
                    notes: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        if (!request.user?.tenantId) {
            return reply.status(400).send({ error: 'Tenant required' });
        }
        // Check code uniqueness within tenant
        const existing = await prisma.vendor.findUnique({
            where: {
                tenantId_code: {
                    tenantId: request.user.tenantId,
                    code: request.body.code,
                },
            },
        });
        if (existing) {
            return reply.status(400).send({ error: 'Vendor code already exists' });
        }
        const vendor = await prisma.vendor.create({
            data: {
                ...request.body,
                tenantId: request.user.tenantId,
                status: 'active',
            },
        });
        return reply.status(201).send(vendor);
    });
    // PUT /vendors/:id - Update vendor
    fastify.put('/vendors/:id', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Vendors'],
            summary: 'Update vendor',
            description: 'Update vendor information',
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
                    code: { type: 'string' },
                    type: { type: 'string', enum: ['supplier', 'manufacturer', 'distributor', 'service_provider', 'partner'] },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    country: { type: 'string' },
                    taxId: { type: 'string' },
                    paymentTerms: { type: 'string' },
                    currency: { type: 'string' },
                    rating: { type: 'number', minimum: 0, maximum: 5 },
                    status: { type: 'string', enum: ['pending', 'active', 'inactive', 'blacklisted'] },
                    notes: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const where = withTenantScope(request, { id: request.params.id });
        const existing = await prisma.vendor.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'Vendor not found' });
        }
        const vendor = await prisma.vendor.update({
            where: { id: request.params.id },
            data: request.body,
        });
        return reply.send(vendor);
    });
    // DELETE /vendors/:id - Delete vendor
    fastify.delete('/vendors/:id', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Vendors'],
            summary: 'Delete vendor',
            description: 'Delete a vendor',
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
        const where = withTenantScope(request, { id: request.params.id });
        const existing = await prisma.vendor.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'Vendor not found' });
        }
        await prisma.vendor.delete({
            where: { id: request.params.id },
        });
        return reply.status(204).send();
    });
    // POST /vendors/:id/contacts - Add vendor contact
    fastify.post('/vendors/:id/contacts', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Vendors'],
            summary: 'Add vendor contact',
            description: 'Add a contact to a vendor',
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
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    position: { type: 'string' },
                    isPrimary: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const where = withTenantScope(request, { id: request.params.id });
        const vendor = await prisma.vendor.findFirst({ where });
        if (!vendor) {
            return reply.status(404).send({ error: 'Vendor not found' });
        }
        // If marking as primary, unset other primaries
        if (request.body.isPrimary) {
            await prisma.vendorContact.updateMany({
                where: { vendorId: vendor.id },
                data: { isPrimary: false },
            });
        }
        const contact = await prisma.vendorContact.create({
            data: {
                ...request.body,
                vendorId: vendor.id,
            },
        });
        return reply.status(201).send(contact);
    });
}
//# sourceMappingURL=vendors.js.map