import { authenticate, requireSysAdmin } from '../middleware/auth.js';
import { getAuditLogs } from '../services/audit.js';
import { prisma } from '../services/prisma.js';
export async function auditLogRoutes(fastify) {
    // All audit log routes require authentication
    fastify.addHook('preHandler', authenticate);
    // GET /audit-logs - List audit logs (SysAdmin only)
    fastify.get('/audit-logs', {
        preHandler: [requireSysAdmin],
        schema: {
            tags: ['Audit Logs'],
            summary: 'List audit logs',
            description: 'Get a paginated list of audit logs. SysAdmin only.',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 50, maximum: 100 },
                    userId: { type: 'string', format: 'uuid' },
                    tenantId: { type: 'string', format: 'uuid' },
                    resource: { type: 'string' },
                    action: { type: 'string', enum: ['create', 'update', 'delete', 'login', 'logout'] },
                    resourceId: { type: 'string' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    action: { type: 'string' },
                                    resource: { type: 'string' },
                                    resourceId: { type: 'string', nullable: true },
                                    oldValues: { type: 'object', nullable: true },
                                    newValues: { type: 'object', nullable: true },
                                    metadata: { type: 'object', nullable: true },
                                    createdAt: { type: 'string' },
                                    user: {
                                        type: 'object',
                                        nullable: true,
                                        properties: {
                                            id: { type: 'string' },
                                            email: { type: 'string' },
                                            firstName: { type: 'string' },
                                            lastName: { type: 'string' },
                                            role: { type: 'string' },
                                        },
                                    },
                                    tenant: {
                                        type: 'object',
                                        nullable: true,
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string' },
                                            slug: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { page, limit, userId, tenantId, resource, action, resourceId, startDate, endDate, } = request.query;
        const result = await getAuditLogs({
            page: Number(page) || 1,
            limit: Math.min(Number(limit) || 50, 100),
            userId,
            tenantId,
            resource,
            action,
            resourceId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
        return reply.send(result);
    });
    // GET /audit-logs/resources - Get list of resources (for filter dropdown)
    fastify.get('/audit-logs/resources', {
        preHandler: [requireSysAdmin],
        schema: {
            tags: ['Audit Logs'],
            summary: 'Get resource types',
            description: 'Get unique resource types from audit logs for filtering.',
            security: [{ bearerAuth: [] }],
        },
    }, async (_request, reply) => {
        const resources = await prisma.auditLog.findMany({
            select: { resource: true },
            distinct: ['resource'],
            orderBy: { resource: 'asc' },
        });
        return reply.send(resources.map((r) => r.resource));
    });
    // GET /audit-logs/actions - Get list of actions (for filter dropdown)
    fastify.get('/audit-logs/actions', {
        preHandler: [requireSysAdmin],
        schema: {
            tags: ['Audit Logs'],
            summary: 'Get action types',
            description: 'Get unique action types from audit logs for filtering.',
            security: [{ bearerAuth: [] }],
        },
    }, async (_request, reply) => {
        const actions = await prisma.auditLog.findMany({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' },
        });
        return reply.send(actions.map((a) => a.action));
    });
}
//# sourceMappingURL=audit-logs.js.map