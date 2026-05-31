import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getUnreadCount, markAsRead, markAllAsRead, deleteNotification } from '../services/notifications.js';
export async function notificationRoutes(fastify) {
    // All routes require authentication
    fastify.addHook('preHandler', authenticate);
    // GET /notifications - List notifications
    fastify.get('/notifications', {
        schema: {
            tags: ['Notifications'],
            summary: 'List notifications',
            description: 'Get paginated list of notifications for the current user',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 },
                    unreadOnly: { type: 'boolean', default: false },
                },
            },
        },
    }, async (request, reply) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const page = Number(request.query.page) || 1;
        const limit = Number(request.query.limit) || 20;
        const { unreadOnly = false } = request.query;
        const skip = (page - 1) * limit;
        const where = {
            userId: request.user.userId,
        };
        if (unreadOnly) {
            where.read = false;
        }
        const [data, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.notification.count({ where }),
            getUnreadCount(request.user.userId),
        ]);
        return reply.send({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            unreadCount,
        });
    });
    // GET /notifications/unread-count - Get unread count
    fastify.get('/notifications/unread-count', {
        schema: {
            tags: ['Notifications'],
            summary: 'Get unread count',
            description: 'Get the number of unread notifications',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const count = await getUnreadCount(request.user.userId);
        return reply.send({ unreadCount: count });
    });
    // PUT /notifications/:id/read - Mark as read
    fastify.put('/notifications/:id/read', {
        schema: {
            tags: ['Notifications'],
            summary: 'Mark as read',
            description: 'Mark a notification as read',
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
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        await markAsRead(request.params.id, request.user.userId);
        return reply.send({ success: true });
    });
    // PUT /notifications/read-all - Mark all as read
    fastify.put('/notifications/read-all', {
        schema: {
            tags: ['Notifications'],
            summary: 'Mark all as read',
            description: 'Mark all notifications as read',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        const result = await markAllAsRead(request.user.userId);
        return reply.send({ success: true, updated: result.count });
    });
    // DELETE /notifications/:id - Delete notification
    fastify.delete('/notifications/:id', {
        schema: {
            tags: ['Notifications'],
            summary: 'Delete notification',
            description: 'Delete a notification',
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
        if (!request.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        await deleteNotification(request.params.id, request.user.userId);
        return reply.status(204).send();
    });
}
//# sourceMappingURL=notifications.js.map