import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma.js';
import { authenticate, requireTenantAdmin, withTenantScope } from '../middleware/auth.js';
import { ContractType, ContractStatusEnum, Prisma } from '../generated/prisma';

interface ContractBody {
  contractNumber: string;
  title: string;
  description?: string;
  type: ContractType;
  startDate: string;
  endDate?: string;
  autoRenew?: boolean;
  renewalTermDays?: number;
  totalValue?: number;
  currency?: string;
  paymentTerms?: string;
  slaLevel?: string;
  slaDetails?: Prisma.InputJsonValue;
  documentUrls?: string[];
  vendorId?: string;
  companyId?: string;
}

interface ContractItemBody {
  itemId?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  notes?: string;
}

interface ContractParams {
  id: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: ContractType;
  status?: ContractStatusEnum;
  vendorId?: string;
  companyId?: string;
}

export async function contractRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /contracts - List contracts
  fastify.get<{ Querystring: PaginationQuery }>(
    '/contracts',
    {
      schema: {
        tags: ['Contracts'],
        summary: 'List contracts',
        description: 'Get a paginated list of contracts',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            search: { type: 'string' },
            type: { type: 'string', enum: ['purchase', 'sales', 'service', 'maintenance', 'subscription', 'nda', 'partnership'] },
            status: { type: 'string', enum: ['draft', 'pending_approval', 'approved', 'active', 'expired', 'cancelled', 'terminated'] },
            vendorId: { type: 'string', format: 'uuid' },
            companyId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const { search, type, status, vendorId, companyId } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = withTenantScope(request);

      if (search) {
        where.OR = [
          { contractNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (type) where.type = type;
      if (status) where.status = status;
      if (vendorId) where.vendorId = vendorId;
      if (companyId) where.companyId = companyId;

      const [data, total] = await Promise.all([
        prisma.contract.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startDate: 'desc' },
          include: {
            vendor: {
              select: { id: true, name: true },
            },
            company: {
              select: { id: true, name: true },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        prisma.contract.count({ where }),
      ]);

      return reply.send({
        data: data.map((c) => ({
          ...c,
          itemsCount: c._count.items,
          _count: undefined,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  );

  // GET /contracts/:id - Get contract by ID
  fastify.get<{ Params: ContractParams }>(
    '/contracts/:id',
    {
      schema: {
        tags: ['Contracts'],
        summary: 'Get contract by ID',
        description: 'Get contract details with line items',
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
      const where: Record<string, unknown> = withTenantScope(request, { id: request.params.id });

      const contract = await prisma.contract.findFirst({
        where,
        include: {
          vendor: true,
          company: true,
          items: {
            include: {
              item: {
                select: { id: true, sku: true, name: true },
              },
            },
          },
        },
      });

      if (!contract) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      return reply.send(contract);
    }
  );

  // POST /contracts - Create contract
  fastify.post<{ Body: ContractBody }>(
    '/contracts',
    {
      preHandler: [requireTenantAdmin],
      schema: {
        tags: ['Contracts'],
        summary: 'Create contract',
        description: 'Create a new contract',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['contractNumber', 'title', 'type', 'startDate'],
          properties: {
            contractNumber: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['purchase', 'sales', 'service', 'maintenance', 'subscription', 'nda', 'partnership'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            autoRenew: { type: 'boolean' },
            renewalTermDays: { type: 'integer' },
            totalValue: { type: 'number' },
            currency: { type: 'string' },
            paymentTerms: { type: 'string' },
            slaLevel: { type: 'string' },
            slaDetails: { type: 'object' },
            documentUrls: { type: 'array', items: { type: 'string' } },
            vendorId: { type: 'string', format: 'uuid' },
            companyId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      // Check contract number uniqueness within tenant
      const existing = await prisma.contract.findUnique({
        where: {
          tenantId_contractNumber: {
            tenantId: request.user.tenantId,
            contractNumber: request.body.contractNumber,
          },
        },
      });

      if (existing) {
        return reply.status(400).send({ error: 'Contract number already exists' });
      }

      const { startDate, endDate, ...rest } = request.body;

      const contract = await prisma.contract.create({
        data: {
          ...rest,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          tenantId: request.user.tenantId,
          status: 'draft',
        },
        include: {
          vendor: true,
          company: true,
        },
      });

      return reply.status(201).send(contract);
    }
  );

  // PUT /contracts/:id - Update contract
  fastify.put<{ Params: ContractParams; Body: Partial<ContractBody> }>(
    '/contracts/:id',
    {
      preHandler: [requireTenantAdmin],
      schema: {
        tags: ['Contracts'],
        summary: 'Update contract',
        description: 'Update contract information',
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
            contractNumber: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['purchase', 'sales', 'service', 'maintenance', 'subscription', 'nda', 'partnership'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            autoRenew: { type: 'boolean' },
            renewalTermDays: { type: 'integer' },
            totalValue: { type: 'number' },
            currency: { type: 'string' },
            paymentTerms: { type: 'string' },
            slaLevel: { type: 'string' },
            slaDetails: { type: 'object' },
            documentUrls: { type: 'array', items: { type: 'string' } },
            vendorId: { type: 'string', format: 'uuid' },
            companyId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const where: Record<string, unknown> = withTenantScope(request, { id: request.params.id });

      const existing = await prisma.contract.findFirst({ where });

      if (!existing) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      const { startDate, endDate, ...rest } = request.body;
      const data: Record<string, unknown> = { ...rest };

      if (startDate) data.startDate = new Date(startDate);
      if (endDate) data.endDate = new Date(endDate);

      const contract = await prisma.contract.update({
        where: { id: request.params.id },
        data,
        include: {
          vendor: true,
          company: true,
        },
      });

      return reply.send(contract);
    }
  );

  // PUT /contracts/:id/status - Change contract status
  fastify.put<{ Params: ContractParams; Body: { status: ContractStatusEnum } }>(
    '/contracts/:id/status',
    {
      preHandler: [requireTenantAdmin],
      schema: {
        tags: ['Contracts'],
        summary: 'Change contract status',
        description: 'Update the status of a contract (approve, activate, etc.)',
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
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['draft', 'pending_approval', 'approved', 'active', 'expired', 'cancelled', 'terminated'] },
          },
        },
      },
    },
    async (request, reply) => {
      const where: Record<string, unknown> = withTenantScope(request, { id: request.params.id });

      const existing = await prisma.contract.findFirst({ where });

      if (!existing) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      const data: Record<string, unknown> = { status: request.body.status };

      // Set signedAt when moving to active
      if (request.body.status === 'active' && !existing.signedAt) {
        data.signedAt = new Date();
      }

      const contract = await prisma.contract.update({
        where: { id: request.params.id },
        data,
      });

      return reply.send(contract);
    }
  );

  // DELETE /contracts/:id - Delete contract
  fastify.delete<{ Params: ContractParams }>(
    '/contracts/:id',
    {
      preHandler: [requireTenantAdmin],
      schema: {
        tags: ['Contracts'],
        summary: 'Delete contract',
        description: 'Delete a contract',
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
      const where: Record<string, unknown> = withTenantScope(request, { id: request.params.id });

      const existing = await prisma.contract.findFirst({ where });

      if (!existing) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      // Only allow deletion of draft contracts
      if (existing.status !== 'draft') {
        return reply.status(400).send({
          error: 'Cannot delete contract',
          message: 'Only draft contracts can be deleted. Use status change to cancel.',
        });
      }

      await prisma.contract.delete({
        where: { id: request.params.id },
      });

      return reply.status(204).send();
    }
  );

  // POST /contracts/:id/items - Add line items to contract
  fastify.post<{ Params: ContractParams; Body: ContractItemBody }>(
    '/contracts/:id/items',
    {
      preHandler: [requireTenantAdmin],
      schema: {
        tags: ['Contracts'],
        summary: 'Add contract item',
        description: 'Add a line item to a contract',
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
          required: ['quantity', 'unitPrice'],
          properties: {
            itemId: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            discount: { type: 'number', default: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const where: Record<string, unknown> = withTenantScope(request, { id: request.params.id });

      const contract = await prisma.contract.findFirst({ where });

      if (!contract) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      const { quantity, unitPrice, discount = 0 } = request.body;
      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discount / 100);
      const total = subtotal - discountAmount;

      const contractItem = await prisma.contractItem.create({
        data: {
          contractId: contract.id,
          itemId: request.body.itemId,
          description: request.body.description,
          quantity,
          unitPrice,
          discount,
          total,
          notes: request.body.notes,
        },
        include: {
          item: {
            select: { id: true, sku: true, name: true },
          },
        },
      });

      // Update contract total value
      const items = await prisma.contractItem.findMany({
        where: { contractId: contract.id },
      });
      const totalValue = items.reduce((sum, item) => sum + item.total, 0);

      await prisma.contract.update({
        where: { id: contract.id },
        data: { totalValue },
      });

      return reply.status(201).send(contractItem);
    }
  );
}
