import { prisma } from '../services/prisma.js';
import { authenticate, requireSysAdmin } from '../middleware/auth.js';
export async function feedbackRoutes(fastify) {
    // GET /feedback - SysAdmin can see all, tenants see their own
    fastify.get('/feedback', {
        preHandler: [authenticate],
        schema: {
            tags: ['Feedback'],
            summary: 'List feedback',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { search, type, status } = request.query;
        const skip = (page - 1) * limit;
        const baseFilter = {};
        if (type) {
            baseFilter.type = type;
        }
        if (status) {
            baseFilter.status = status;
        }
        if (search) {
            baseFilter.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Non-sysadmin users can only see feedback they submitted
        const userFilter = request.user?.role !== 'sys_admin'
            ? { submittedById: request.user?.userId }
            : {};
        const where = { ...baseFilter, ...userFilter };
        const [data, total] = await Promise.all([
            prisma.feedback.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.feedback.count({ where }),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    });
    // GET /feedback/:id
    fastify.get('/feedback/:id', {
        preHandler: [authenticate],
        schema: {
            tags: ['Feedback'],
            summary: 'Get feedback by ID',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const userFilter = request.user?.role !== 'sys_admin'
            ? { submittedById: request.user?.userId }
            : {};
        const feedback = await prisma.feedback.findFirst({
            where: { id: request.params.id, ...userFilter },
        });
        if (!feedback) {
            return reply.status(404).send({ error: 'Feedback not found' });
        }
        return reply.send(feedback);
    });
    // POST /feedback - Any authenticated user can submit feedback
    fastify.post('/feedback', {
        preHandler: [authenticate],
        schema: {
            tags: ['Feedback'],
            summary: 'Submit feedback',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const { type, subject, message, userEmail } = request.body;
        if (!type || !subject || !message) {
            return reply
                .status(400)
                .send({ error: 'type, subject, and message are required' });
        }
        const feedback = await prisma.feedback.create({
            data: {
                type,
                subject,
                message,
                userEmail: userEmail || request.user?.email,
                submittedById: request.user?.userId,
            },
        });
        return reply.status(201).send(feedback);
    });
    // PUT /feedback/:id - SysAdmin only to respond/update status
    fastify.put('/feedback/:id', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Feedback'],
            summary: 'Update feedback (SysAdmin)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const existing = await prisma.feedback.findUnique({
            where: { id: request.params.id },
        });
        if (!existing) {
            return reply.status(404).send({ error: 'Feedback not found' });
        }
        const updated = await prisma.feedback.update({
            where: { id: request.params.id },
            data: request.body,
        });
        return reply.send(updated);
    });
    // DELETE /feedback/:id - SysAdmin only
    fastify.delete('/feedback/:id', {
        preHandler: [authenticate, requireSysAdmin],
        schema: {
            tags: ['Feedback'],
            summary: 'Delete feedback (SysAdmin)',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        try {
            await prisma.feedback.delete({
                where: { id: request.params.id },
            });
            return reply.status(204).send();
        }
        catch {
            return reply.status(404).send({ error: 'Feedback not found' });
        }
    });
}
//# sourceMappingURL=feedback.js.map