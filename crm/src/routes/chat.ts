import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma.js';
import type { Prisma } from '../generated/prisma';
import { authenticate, withTenantScope } from '../middleware/auth.js';

interface ChatSessionBody {
  userEmail?: string;
  title?: string;
}

interface ChatMessageBody {
  role: 'user' | 'assistant';
  content: string;
  metadata?: Prisma.InputJsonValue;
}

interface SessionParams {
  id: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  userEmail?: string;
}

export async function chatRoutes(fastify: FastifyInstance) {
  // GET /chat/sessions - List chat sessions
  fastify.get<{ Querystring: PaginationQuery }>(
    '/chat/sessions',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'List chat sessions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const { userEmail } = request.query;
      const skip = (page - 1) * limit;

      const baseFilter: Record<string, unknown> = {};

      if (userEmail) {
        baseFilter.userEmail = userEmail;
      }

      // Users can only see their own sessions (unless SysAdmin)
      const userFilter = request.user?.role !== 'sys_admin'
        ? { userId: request.user?.userId }
        : {};

      const where = { ...baseFilter, ...userFilter };

      const [data, total] = await Promise.all([
        prisma.chatSession.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1, // Include only the last message for preview
            },
          },
        }),
        prisma.chatSession.count({ where }),
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

  // GET /chat/sessions/:id - Get session with all messages
  fastify.get<{ Params: SessionParams }>(
    '/chat/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Get chat session with messages',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userFilter = request.user?.role !== 'sys_admin'
        ? { userId: request.user?.userId }
        : {};

      const session = await prisma.chatSession.findFirst({
        where: { id: request.params.id, ...userFilter },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Chat session not found' });
      }
      return reply.send(session);
    }
  );

  // POST /chat/sessions - Create new session
  fastify.post<{ Body: ChatSessionBody }>(
    '/chat/sessions',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Create new chat session',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { userEmail, title } = request.body;

      const session = await prisma.chatSession.create({
        data: {
          userEmail: userEmail || request.user?.email,
          title,
          userId: request.user?.userId,
          tenantId: request.user?.tenantId,
        },
      });

      return reply.status(201).send(session);
    }
  );

  // POST /chat/sessions/:id/messages - Add message to session
  fastify.post<{ Params: SessionParams; Body: ChatMessageBody }>(
    '/chat/sessions/:id/messages',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Add message to chat session',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { role, content, metadata } = request.body;

      if (!role || !content) {
        return reply.status(400).send({ error: 'role and content are required' });
      }

      const userFilter = request.user?.role !== 'sys_admin'
        ? { userId: request.user?.userId }
        : {};

      // Check session exists and belongs to user
      const session = await prisma.chatSession.findFirst({
        where: { id: request.params.id, ...userFilter },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Chat session not found' });
      }

      // Create message and update session timestamp
      const [message] = await Promise.all([
        prisma.chatMessage.create({
          data: {
            sessionId: request.params.id,
            role,
            content,
            metadata: metadata ?? undefined,
          },
        }),
        prisma.chatSession.update({
          where: { id: request.params.id },
          data: { updatedAt: new Date() },
        }),
      ]);

      return reply.status(201).send(message);
    }
  );

  // PUT /chat/sessions/:id - Update session (e.g., title)
  fastify.put<{ Params: SessionParams; Body: ChatSessionBody }>(
    '/chat/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Update chat session',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userFilter = request.user?.role !== 'sys_admin'
        ? { userId: request.user?.userId }
        : {};

      const existing = await prisma.chatSession.findFirst({
        where: { id: request.params.id, ...userFilter },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Chat session not found' });
      }

      const updated = await prisma.chatSession.update({
        where: { id: request.params.id },
        data: request.body,
      });

      return reply.send(updated);
    }
  );

  // DELETE /chat/sessions/:id - Delete session and all messages
  fastify.delete<{ Params: SessionParams }>(
    '/chat/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Chat'],
        summary: 'Delete chat session',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userFilter = request.user?.role !== 'sys_admin'
        ? { userId: request.user?.userId }
        : {};

      const existing = await prisma.chatSession.findFirst({
        where: { id: request.params.id, ...userFilter },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Chat session not found' });
      }

      try {
        await prisma.chatSession.delete({
          where: { id: request.params.id },
        });
        return reply.status(204).send();
      } catch {
        return reply.status(404).send({ error: 'Chat session not found' });
      }
    }
  );
}
