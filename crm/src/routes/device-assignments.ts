import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma.js';
import { authenticate, withTenantScope, requireRole } from '../middleware/auth.js';

interface DeviceAssignmentBody {
  thingsboardDeviceId: string;
  deviceName: string;
  deviceType?: string;
  companyId: string;
  notes?: string;
}

interface DeviceAssignmentParams {
  id: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
}

export async function deviceAssignmentRoutes(fastify: FastifyInstance) {
  // GET /device-assignments
  fastify.get<{ Querystring: PaginationQuery }>(
    '/device-assignments',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Device Assignments'],
        summary: 'List device assignments',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const { search, companyId } = request.query;
      const skip = (page - 1) * limit;

      const baseFilter: Record<string, unknown> = {};

      if (companyId) {
        baseFilter.companyId = companyId;
      }

      if (search) {
        baseFilter.OR = [
          { deviceName: { contains: search, mode: 'insensitive' } },
          { deviceType: { contains: search, mode: 'insensitive' } },
        ];
      }

      const where = withTenantScope(request, baseFilter);

      const [data, total] = await Promise.all([
        prisma.deviceAssignment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { assignedAt: 'desc' },
          include: {
            company: true,
            serviceContracts: true,
            serviceTickets: { where: { status: { not: 'closed' } } },
          },
        }),
        prisma.deviceAssignment.count({ where }),
      ]);

      return reply.send({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  );

  // GET /device-assignments/:id
  fastify.get<{ Params: DeviceAssignmentParams }>(
    '/device-assignments/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Device Assignments'],
        summary: 'Get device assignment by ID',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where = withTenantScope(request, { id: request.params.id });

      const assignment = await prisma.deviceAssignment.findFirst({
        where,
        include: {
          company: true,
          serviceContracts: true,
          serviceTickets: true,
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: 'Device assignment not found' });
      }
      return reply.send(assignment);
    }
  );

  // GET /device-assignments/by-device/:thingsboardDeviceId
  fastify.get<{ Params: { thingsboardDeviceId: string } }>(
    '/device-assignments/by-device/:thingsboardDeviceId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Device Assignments'],
        summary: 'Get device assignment by ThingsBoard device ID',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where = withTenantScope(request, {
        thingsboardDeviceId: request.params.thingsboardDeviceId,
      });

      const assignment = await prisma.deviceAssignment.findFirst({
        where,
        include: {
          company: true,
          serviceContracts: true,
          serviceTickets: true,
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: 'Device assignment not found' });
      }
      return reply.send(assignment);
    }
  );

  // POST /device-assignments
  fastify.post<{ Body: DeviceAssignmentBody }>(
    '/device-assignments',
    {
      preHandler: [authenticate, requireRole('tenant_admin', 'tenant_user')],
      schema: {
        tags: ['Device Assignments'],
        summary: 'Create device assignment',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { thingsboardDeviceId, deviceName, deviceType, companyId, notes } =
        request.body;

      if (!thingsboardDeviceId || !deviceName || !companyId) {
        return reply
          .status(400)
          .send({ error: 'thingsboardDeviceId, deviceName, and companyId are required' });
      }

      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant context required' });
      }

      // Verify company belongs to tenant
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId: request.user.tenantId },
      });
      if (!company) {
        return reply.status(400).send({ error: 'Invalid company' });
      }

      const assignment = await prisma.deviceAssignment.create({
        data: {
          thingsboardDeviceId,
          deviceName,
          deviceType,
          companyId,
          notes,
          tenantId: request.user.tenantId,
        },
        include: { company: true },
      });

      return reply.status(201).send(assignment);
    }
  );

  // PUT /device-assignments/:id
  fastify.put<{ Params: DeviceAssignmentParams; Body: Partial<DeviceAssignmentBody> }>(
    '/device-assignments/:id',
    {
      preHandler: [authenticate, requireRole('tenant_admin', 'tenant_user')],
      schema: {
        tags: ['Device Assignments'],
        summary: 'Update device assignment',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where = withTenantScope(request, { id: request.params.id });

      const existing = await prisma.deviceAssignment.findFirst({ where });

      if (!existing) {
        return reply.status(404).send({ error: 'Device assignment not found' });
      }

      const updated = await prisma.deviceAssignment.update({
        where: { id: request.params.id },
        data: request.body,
        include: { company: true },
      });

      return reply.send(updated);
    }
  );

  // DELETE /device-assignments/:id
  fastify.delete<{ Params: DeviceAssignmentParams }>(
    '/device-assignments/:id',
    {
      preHandler: [authenticate, requireRole('tenant_admin')],
      schema: {
        tags: ['Device Assignments'],
        summary: 'Delete device assignment',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const where = withTenantScope(request, { id: request.params.id });

      const existing = await prisma.deviceAssignment.findFirst({ where });

      if (!existing) {
        return reply.status(404).send({ error: 'Device assignment not found' });
      }

      try {
        await prisma.deviceAssignment.delete({
          where: { id: request.params.id },
        });
        return reply.status(204).send();
      } catch {
        return reply.status(404).send({ error: 'Device assignment not found' });
      }
    }
  );
}
