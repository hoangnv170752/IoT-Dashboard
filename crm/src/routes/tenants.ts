import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma.js';
import { authenticate, requireSysAdmin } from '../middleware/auth.js';
import { TenantStatus, Prisma } from '../generated/prisma';

interface TenantBody {
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  settings?: Prisma.InputJsonValue;
}

interface TenantParams {
  id: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantStatus;
}

export async function tenantRoutes(fastify: FastifyInstance) {
  // All routes require SysAdmin
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireSysAdmin);

  // GET /tenants - List all tenants
  fastify.get<{ Querystring: PaginationQuery }>(
    '/tenants',
    {
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
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const { search, status } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};

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
          usersCount: tenant._count.users,
          companiesCount: tenant._count.companies,
          devicesCount: tenant._count.deviceAssignments,
          _count: undefined,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  );

  // GET /tenants/:id - Get tenant by ID
  fastify.get<{ Params: TenantParams }>(
    '/tenants/:id',
    {
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
    },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        include: {
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
        _count: undefined,
      });
    }
  );

  // POST /tenants - Create tenant
  fastify.post<{ Body: TenantBody }>(
    '/tenants',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Create tenant',
        description: 'Create a new tenant manually (SysAdmin only)',
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
          },
        },
      },
    },
    async (request, reply) => {
      const { name, slug, domain, logo, primaryColor, settings } = request.body;

      // Check if slug is unique
      const existing = await prisma.tenant.findUnique({
        where: { slug },
      });

      if (existing) {
        return reply.status(400).send({ error: 'Slug already exists' });
      }

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

      return reply.status(201).send(tenant);
    }
  );

  // PUT /tenants/:id - Update tenant
  fastify.put<{ Params: TenantParams; Body: Partial<TenantBody> & { status?: TenantStatus } }>(
    '/tenants/:id',
    {
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
    },
    async (request, reply) => {
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
    }
  );

  // DELETE /tenants/:id - Soft delete tenant
  fastify.delete<{ Params: TenantParams }>(
    '/tenants/:id',
    {
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
    },
    async (request, reply) => {
      const existing = await prisma.tenant.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }

      // Soft delete by setting status to cancelled
      await prisma.tenant.update({
        where: { id: request.params.id },
        data: { status: 'cancelled' },
      });

      return reply.status(204).send();
    }
  );

  // GET /tenants/:id/stats - Get tenant usage stats
  fastify.get<{ Params: TenantParams }>(
    '/tenants/:id/stats',
    {
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
    },
    async (request, reply) => {
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

      // Get counts
      const [
        usersCount,
        companiesCount,
        vendorsCount,
        itemsCount,
        contractsCount,
        devicesCount,
        assetsCount,
        activeDeals,
        openTickets,
      ] = await Promise.all([
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
        plan: plan
          ? {
              name: plan.name,
              code: plan.code,
            }
          : null,
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
    }
  );
}
