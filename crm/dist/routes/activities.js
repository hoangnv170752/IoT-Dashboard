import { prisma } from '../services/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
export async function activityRoutes(fastify) {
    // GET /activities
    fastify.get('/activities', {
        preHandler: [authenticate],
        schema: {
            tags: ['Activities'],
            summary: 'List activities',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, type } = request.query;
        const skip = (page - 1) * limit;
        const baseFilter = {};
        if (type) {
            baseFilter.type = type;
        }
        if (search) {
            baseFilter.subject = { contains: search, mode: 'insensitive' };
        }
        // Activities are scoped through company's tenantId or user's tenantId
        const tenantFilter = request.user?.tenantId
            ? {
                OR: [
                    { company: { tenantId: request.user.tenantId } },
                    { userId: request.user.userId },
                ],
            }
            : {};
        const where = { ...baseFilter, ...tenantFilter };
        const [data, total] = await Promise.all([
            prisma.activity.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    contact: true,
                    deal: true,
                    company: true,
                },
            }),
            prisma.activity.count({ where }),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /activities/:id
    fastify.get('/activities/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Activities'],
            summary: 'Get activity by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? {
                OR: [
                    { company: { tenantId: request.user.tenantId } },
                    { userId: request.user.userId },
                ],
            }
            : {};
        const activity = await prisma.activity.findFirst({
            where: { id: request.params.id, ...tenantFilter },
            include: {
                contact: true,
                deal: true,
                company: true,
            },
        });
        if (!activity) {
            return reply.status(404).send({ error: 'Activity not found' });
        }
        return reply.send(activity);
    });
    // POST /activities
    fastify.post('/activities', {
        preHandler: [authenticate],
        schema: {
            tags: ['Activities'],
            summary: 'Create activity',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { type, subject, description, contactId, dealId, companyId, dueDate, completed = false, } = request.body;
        if (!type || !subject) {
            return reply
                .status(400)
                .send({ error: 'type and subject are required' });
        }
        // Verify company belongs to tenant
        if (companyId && request.user?.tenantId) {
            const company = await prisma.company.findFirst({
                where: { id: companyId, tenantId: request.user.tenantId },
            });
            if (!company) {
                return reply.status(400).send({ error: 'Invalid company' });
            }
        }
        const activity = await prisma.activity.create({
            data: {
                type,
                subject,
                description,
                contactId,
                dealId,
                companyId,
                dueDate: dueDate ? new Date(dueDate) : null,
                completed,
                userId: request.user?.userId,
            },
            include: {
                contact: true,
                deal: true,
                company: true,
            },
        });
        return reply.status(201).send(activity);
    });
    // PUT /activities/:id
    fastify.put('/activities/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Activities'],
            summary: 'Update activity',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? {
                OR: [
                    { company: { tenantId: request.user.tenantId } },
                    { userId: request.user.userId },
                ],
            }
            : {};
        const existing = await prisma.activity.findFirst({
            where: { id: request.params.id, ...tenantFilter },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Activity not found' });
        }
        const { dueDate, ...rest } = request.body;
        const updated = await prisma.activity.update({
            where: { id: request.params.id },
            data: {
                ...rest,
                ...(dueDate && { dueDate: new Date(dueDate) }),
            },
            include: {
                contact: true,
                deal: true,
                company: true,
            },
        });
        return reply.send(updated);
    });
    // DELETE /activities/:id
    fastify.delete('/activities/:id', {
        preHandler: [authenticate, requireRole('tenant_admin', 'tenant_user')],
        schema: {
            tags: ['Activities'],
            summary: 'Delete activity',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? {
                OR: [
                    { company: { tenantId: request.user.tenantId } },
                    { userId: request.user.userId },
                ],
            }
            : {};
        const existing = await prisma.activity.findFirst({
            where: { id: request.params.id, ...tenantFilter },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Activity not found' });
        }
        try {
            await prisma.activity.delete({
                where: { id: request.params.id },
            });
            return reply.status(204).send();
        }
        catch {
            return reply.status(404).send({ error: 'Activity not found' });
        }
    });
}
//# sourceMappingURL=activities.js.map