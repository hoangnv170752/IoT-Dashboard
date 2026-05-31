import { prisma } from '../services/prisma.js';
import { authenticate, requireTenantAdmin, withTenantScope } from '../middleware/auth.js';
export async function itemRoutes(fastify) {
    // All routes require authentication
    fastify.addHook('preHandler', authenticate);
    // GET /items - List items
    fastify.get('/items', {
        schema: {
            tags: ['Items'],
            summary: 'List items',
            description: 'Get a paginated list of items (product catalog)',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                    search: { type: 'string' },
                    category: { type: 'string' },
                    status: { type: 'string', enum: ['draft', 'active', 'discontinued', 'archived'] },
                    vendorId: { type: 'string', format: 'uuid' },
                },
            },
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, category, status, vendorId } = request.query;
        const skip = (page - 1) * limit;
        const where = withTenantScope(request);
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category)
            where.category = category;
        if (status)
            where.status = status;
        if (vendorId)
            where.vendorId = vendorId;
        const [data, total] = await Promise.all([
            prisma.item.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                    vendor: {
                        select: { id: true, name: true, code: true },
                    },
                },
            }),
            prisma.item.count({ where }),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /items/categories - Get distinct categories
    fastify.get('/items/categories', {
        schema: {
            tags: ['Items'],
            summary: 'List categories',
            description: 'Get all distinct item categories',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where = withTenantScope(request);
        const categories = await prisma.item.findMany({
            where: { ...where, category: { not: null } },
            distinct: ['category'],
            select: { category: true },
        });
        return reply.send(categories.map((c) => c.category).filter(Boolean));
    });
    // GET /items/:id - Get item by ID
    fastify.get('/items/:id', {
        schema: {
            tags: ['Items'],
            summary: 'Get item by ID',
            description: 'Get item details',
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
        const item = await prisma.item.findFirst({
            where,
            include: {
                vendor: true,
                contractItems: {
                    take: 10,
                    include: {
                        contract: {
                            select: { id: true, contractNumber: true, title: true, status: true },
                        },
                    },
                },
            },
        });
        if (!item) {
            return reply.status(404).send({ error: 'Item not found' });
        }
        return reply.send(item);
    });
    // POST /items - Create item
    fastify.post('/items', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Items'],
            summary: 'Create item',
            description: 'Create a new item in the catalog',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['sku', 'name'],
                properties: {
                    sku: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    subcategory: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    manufacturerPartNo: { type: 'string' },
                    unitPrice: { type: 'number' },
                    currency: { type: 'string' },
                    specifications: { type: 'object' },
                    weight: { type: 'number' },
                    dimensions: { type: 'string' },
                    trackInventory: { type: 'boolean' },
                    minStockLevel: { type: 'integer' },
                    currentStock: { type: 'integer' },
                    vendorId: { type: 'string', format: 'uuid' },
                },
            },
        },
    }, async (request, reply) => {
        if (!request.user?.tenantId) {
            return reply.status(400).send({ error: 'Tenant required' });
        }
        // Check SKU uniqueness within tenant
        const existing = await prisma.item.findUnique({
            where: {
                tenantId_sku: {
                    tenantId: request.user.tenantId,
                    sku: request.body.sku,
                },
            },
        });
        if (existing) {
            return reply.status(400).send({ error: 'SKU already exists' });
        }
        const item = await prisma.item.create({
            data: {
                ...request.body,
                tenantId: request.user.tenantId,
                status: 'draft',
            },
            include: {
                vendor: true,
            },
        });
        return reply.status(201).send(item);
    });
    // PUT /items/:id - Update item
    fastify.put('/items/:id', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Items'],
            summary: 'Update item',
            description: 'Update item information',
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
                    sku: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    subcategory: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    manufacturerPartNo: { type: 'string' },
                    unitPrice: { type: 'number' },
                    currency: { type: 'string' },
                    specifications: { type: 'object' },
                    weight: { type: 'number' },
                    dimensions: { type: 'string' },
                    trackInventory: { type: 'boolean' },
                    minStockLevel: { type: 'integer' },
                    currentStock: { type: 'integer' },
                    status: { type: 'string', enum: ['draft', 'active', 'discontinued', 'archived'] },
                    vendorId: { type: 'string', format: 'uuid' },
                },
            },
        },
    }, async (request, reply) => {
        const where = withTenantScope(request, { id: request.params.id });
        const existing = await prisma.item.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'Item not found' });
        }
        const item = await prisma.item.update({
            where: { id: request.params.id },
            data: request.body,
            include: {
                vendor: true,
            },
        });
        return reply.send(item);
    });
    // DELETE /items/:id - Delete item
    fastify.delete('/items/:id', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Items'],
            summary: 'Delete item',
            description: 'Delete an item from the catalog',
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
        const existing = await prisma.item.findFirst({ where });
        if (!existing) {
            return reply.status(404).send({ error: 'Item not found' });
        }
        await prisma.item.delete({
            where: { id: request.params.id },
        });
        return reply.status(204).send();
    });
    // POST /items/import - Bulk import items
    fastify.post('/items/import', {
        preHandler: [requireTenantAdmin],
        schema: {
            tags: ['Items'],
            summary: 'Bulk import items',
            description: 'Import multiple items at once',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['items'],
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['sku', 'name'],
                            properties: {
                                sku: { type: 'string' },
                                name: { type: 'string' },
                                description: { type: 'string' },
                                category: { type: 'string' },
                                unitPrice: { type: 'number' },
                                vendorId: { type: 'string', format: 'uuid' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request, reply) => {
        if (!request.user?.tenantId) {
            return reply.status(400).send({ error: 'Tenant required' });
        }
        const { items } = request.body;
        const results = {
            created: 0,
            updated: 0,
            errors: [],
        };
        for (const item of items) {
            try {
                const existing = await prisma.item.findUnique({
                    where: {
                        tenantId_sku: {
                            tenantId: request.user.tenantId,
                            sku: item.sku,
                        },
                    },
                });
                if (existing) {
                    await prisma.item.update({
                        where: { id: existing.id },
                        data: item,
                    });
                    results.updated++;
                }
                else {
                    await prisma.item.create({
                        data: {
                            ...item,
                            tenantId: request.user.tenantId,
                            status: 'draft',
                        },
                    });
                    results.created++;
                }
            }
            catch (error) {
                results.errors.push({
                    sku: item.sku,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return reply.send(results);
    });
}
//# sourceMappingURL=items.js.map