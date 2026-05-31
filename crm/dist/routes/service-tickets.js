import { prisma } from '../services/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
// Generate ticket number
function generateTicketNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TKT-${year}${month}-${random}`;
}
export async function serviceTicketRoutes(fastify) {
    // GET /service-tickets
    fastify.get('/service-tickets', {
        preHandler: [authenticate],
        schema: {
            tags: ['Service Tickets'],
            summary: 'List service tickets',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, status, priority, deviceAssignmentId } = request.query;
        const skip = (page - 1) * limit;
        const baseFilter = {};
        if (status) {
            baseFilter.status = status;
        }
        if (priority) {
            baseFilter.priority = priority;
        }
        if (deviceAssignmentId) {
            baseFilter.deviceAssignmentId = deviceAssignmentId;
        }
        if (search) {
            baseFilter.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { ticketNumber: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Service tickets are scoped through deviceAssignment's tenantId
        const tenantFilter = request.user?.tenantId
            ? { deviceAssignment: { tenantId: request.user.tenantId } }
            : {};
        const where = { ...baseFilter, ...tenantFilter };
        const [data, total] = await Promise.all([
            prisma.serviceTicket.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    deviceAssignment: {
                        include: { company: true },
                    },
                },
            }),
            prisma.serviceTicket.count({ where }),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /service-tickets/:id
    fastify.get('/service-tickets/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Service Tickets'],
            summary: 'Get service ticket by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? { deviceAssignment: { tenantId: request.user.tenantId } }
            : {};
        const ticket = await prisma.serviceTicket.findFirst({
            where: { id: request.params.id, ...tenantFilter },
            include: {
                deviceAssignment: {
                    include: { company: true },
                },
            },
        });
        if (!ticket) {
            return reply.status(404).send({ error: 'Service ticket not found' });
        }
        return reply.send(ticket);
    });
    // POST /service-tickets
    fastify.post('/service-tickets', {
        preHandler: [authenticate],
        schema: {
            tags: ['Service Tickets'],
            summary: 'Create service ticket',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { title, description, priority = 'medium', status = 'open', category, deviceAssignmentId, } = request.body;
        if (!title) {
            return reply.status(400).send({ error: 'title is required' });
        }
        // Verify device assignment belongs to tenant
        if (deviceAssignmentId && request.user?.tenantId) {
            const assignment = await prisma.deviceAssignment.findFirst({
                where: { id: deviceAssignmentId, tenantId: request.user.tenantId },
            });
            if (!assignment) {
                return reply.status(400).send({ error: 'Invalid device assignment' });
            }
        }
        const ticket = await prisma.serviceTicket.create({
            data: {
                ticketNumber: generateTicketNumber(),
                title,
                description,
                priority,
                status,
                category,
                deviceAssignmentId,
                reportedById: request.user?.userId,
            },
            include: {
                deviceAssignment: {
                    include: { company: true },
                },
            },
        });
        return reply.status(201).send(ticket);
    });
    // PUT /service-tickets/:id
    fastify.put('/service-tickets/:id', {
        preHandler: [authenticate, requireRole('tenant_admin', 'tenant_user')],
        schema: {
            tags: ['Service Tickets'],
            summary: 'Update service ticket',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? { deviceAssignment: { tenantId: request.user.tenantId } }
            : {};
        const existing = await prisma.serviceTicket.findFirst({
            where: { id: request.params.id, ...tenantFilter },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Service ticket not found' });
        }
        const { status, resolution, ...rest } = request.body;
        // Auto-set resolvedAt when status changes to resolved or closed
        const resolvedAt = (status === 'resolved' || status === 'closed') && existing.status !== 'resolved' && existing.status !== 'closed'
            ? new Date()
            : undefined;
        const updated = await prisma.serviceTicket.update({
            where: { id: request.params.id },
            data: {
                ...rest,
                status,
                resolution,
                ...(resolvedAt && { resolvedAt }),
            },
            include: {
                deviceAssignment: {
                    include: { company: true },
                },
            },
        });
        return reply.send(updated);
    });
    // DELETE /service-tickets/:id
    fastify.delete('/service-tickets/:id', {
        preHandler: [authenticate, requireRole('tenant_admin')],
        schema: {
            tags: ['Service Tickets'],
            summary: 'Delete service ticket',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const tenantFilter = request.user?.tenantId
            ? { deviceAssignment: { tenantId: request.user.tenantId } }
            : {};
        const existing = await prisma.serviceTicket.findFirst({
            where: { id: request.params.id, ...tenantFilter },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Service ticket not found' });
        }
        try {
            await prisma.serviceTicket.delete({
                where: { id: request.params.id },
            });
            return reply.status(204).send();
        }
        catch {
            return reply.status(404).send({ error: 'Service ticket not found' });
        }
    });
}
//# sourceMappingURL=service-tickets.js.map