import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../services/prisma.js';
import { authenticate } from '../middleware/auth.js';
import type { Prisma } from '../generated/prisma';

interface ConversationParams {
  id: string;
}

interface CreateConversationBody {
  participantIds: string[];
  title?: string;
  type?: 'direct' | 'group' | 'support';
  initialMessage?: string;
}

interface SendMessageBody {
  content: string;
  metadata?: Prisma.InputJsonValue;
}

interface SearchUsersQuery {
  search: string;
  page?: number;
  limit?: number;
}

interface MessagesQuery {
  page?: number;
  limit?: number;
  before?: string;
}

export async function messagingRoutes(fastify: FastifyInstance) {

  // ============================
  // Search Users / Tenants to Chat
  // ============================

  // GET /messaging/users/search - Search users available to chat with
  fastify.get<{ Querystring: SearchUsersQuery }>(
    '/messaging/users/search',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Search users to start a conversation',
        description: 'Search for other users by name or email. Tenant users can find SysAdmins and users from other tenants (limited info). SysAdmins can find all users.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['search'],
          properties: {
            search: { type: 'string', minLength: 2, description: 'Search by name or email (min 2 chars)' },
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { search, page = 1, limit = 20 } = request.query;
      const skip = (page - 1) * limit;
      const currentUserId = request.user.userId;

      const searchFilter: Prisma.UserWhereInput = {
        AND: [
          { id: { not: currentUserId } },
          { status: 'active' },
          {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        ],
      };

      // SysAdmin can see all users
      // Tenant users can see: SysAdmins + users in their own tenant + tenant_admins of other tenants
      if (request.user.role !== 'sys_admin') {
        (searchFilter.AND as Prisma.UserWhereInput[]).push({
          OR: [
            { role: 'sys_admin' },
            { tenantId: request.user.tenantId },
            { role: 'tenant_admin' },
          ],
        });
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: searchFilter,
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: { firstName: 'asc' },
        }),
        prisma.user.count({ where: searchFilter }),
      ]);

      return reply.send({
        data: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  );

  // ============================
  // Conversations
  // ============================

  // GET /messaging/conversations - List user's conversations
  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/messaging/conversations',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'List conversations',
        description: 'Get all conversations the current user is a participant in, ordered by most recent activity',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const skip = (page - 1) * limit;
      const currentUserId = request.user.userId;

      const where: Prisma.ConversationWhereInput = {
        participants: {
          some: { userId: currentUserId },
        },
      };

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                    tenant: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                createdAt: true,
                sender: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      // Add unread count for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const participant = conv.participants.find(
            (p) => p.userId === currentUserId
          );
          const unreadCount = await prisma.directMessage.count({
            where: {
              conversationId: conv.id,
              senderId: { not: currentUserId },
              createdAt: {
                gt: participant?.lastReadAt || new Date(0),
              },
              deletedAt: null,
            },
          });

          return {
            ...conv,
            unreadCount,
            lastMessage: conv.messages[0] || null,
          };
        })
      );

      return reply.send({
        data: conversationsWithUnread,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }
  );

  // POST /messaging/conversations - Create a new conversation
  fastify.post<{ Body: CreateConversationBody }>(
    '/messaging/conversations',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Start a new conversation',
        description: 'Create a direct message, group chat, or support conversation. For "support" type, a SysAdmin will be auto-added if not already included.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['participantIds'],
          properties: {
            participantIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
              description: 'User IDs to invite to the conversation',
            },
            title: { type: 'string', description: 'Optional conversation title' },
            type: {
              type: 'string',
              enum: ['direct', 'group', 'support'],
              default: 'direct',
              description: 'Conversation type',
            },
            initialMessage: { type: 'string', description: 'Optional first message to send' },
          },
        },
      },
    },
    async (request, reply) => {
      const { participantIds, title, type = 'direct', initialMessage } = request.body;
      const currentUserId = request.user.userId;

      // Ensure current user is included
      const allParticipantIds = [...new Set([currentUserId, ...participantIds])];

      // For direct conversations, check if one already exists between these two users
      if (type === 'direct' && allParticipantIds.length === 2) {
        const existing = await prisma.conversation.findFirst({
          where: {
            type: 'direct',
            AND: allParticipantIds.map((uid) => ({
              participants: { some: { userId: uid } },
            })),
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    role: true,
                  },
                },
              },
            },
          },
        });

        if (existing) {
          // If there's an initial message, send it to the existing conversation
          if (initialMessage) {
            await prisma.directMessage.create({
              data: {
                conversationId: existing.id,
                senderId: currentUserId,
                content: initialMessage,
              },
            });
            await prisma.conversation.update({
              where: { id: existing.id },
              data: { updatedAt: new Date() },
            });
          }
          return reply.send(existing);
        }
      }

      // For support type, auto-add a SysAdmin if none in participants
      if (type === 'support') {
        const hasSysAdmin = await prisma.user.findFirst({
          where: {
            id: { in: allParticipantIds },
            role: 'sys_admin',
          },
        });

        if (!hasSysAdmin) {
          const sysAdmin = await prisma.user.findFirst({
            where: { role: 'sys_admin', status: 'active' },
            orderBy: { lastLoginAt: 'desc' },
          });
          if (sysAdmin) {
            allParticipantIds.push(sysAdmin.id);
          }
        }
      }

      // Validate all participants exist
      const validUsers = await prisma.user.findMany({
        where: { id: { in: allParticipantIds }, status: 'active' },
        select: { id: true },
      });

      if (validUsers.length !== allParticipantIds.length) {
        return reply.status(400).send({ error: 'One or more participant IDs are invalid' });
      }

      // Create conversation with participants
      const conversation = await prisma.conversation.create({
        data: {
          title,
          type,
          participants: {
            create: allParticipantIds.map((userId) => ({
              userId,
            })),
          },
          ...(initialMessage
            ? {
                messages: {
                  create: {
                    senderId: currentUserId,
                    content: initialMessage,
                  },
                },
              }
            : {}),
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                  role: true,
                  tenant: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      return reply.status(201).send(conversation);
    }
  );

  // GET /messaging/conversations/:id - Get conversation with messages
  fastify.get<{ Params: ConversationParams; Querystring: MessagesQuery }>(
    '/messaging/conversations/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Get conversation with messages',
        description: 'Get conversation details and paginated messages. Also marks messages as read.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 50 },
            before: { type: 'string', format: 'date-time', description: 'Load messages before this timestamp (for infinite scroll)' },
          },
        },
      },
    },
    async (request, reply) => {
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 50;
      const { before } = request.query;
      const currentUserId = request.user.userId;

      // Verify user is a participant
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: request.params.id,
          participants: { some: { userId: currentUserId } },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                  role: true,
                  tenant: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      // Fetch messages
      const messageWhere: Prisma.DirectMessageWhereInput = {
        conversationId: request.params.id,
        deletedAt: null,
      };

      if (before) {
        messageWhere.createdAt = { lt: new Date(before) };
      }

      const skip = before ? 0 : (page - 1) * limit;

      const [messages, totalMessages] = await Promise.all([
        prisma.directMessage.findMany({
          where: messageWhere,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        }),
        prisma.directMessage.count({ where: messageWhere }),
      ]);

      // Mark as read
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: request.params.id,
          userId: currentUserId,
        },
        data: { lastReadAt: new Date() },
      });

      return reply.send({
        conversation,
        messages: messages.reverse(),
        totalMessages,
        page,
        limit,
        totalPages: Math.ceil(totalMessages / limit),
      });
    }
  );

  // ============================
  // Messages
  // ============================

  // POST /messaging/conversations/:id/messages - Send a message
  fastify.post<{ Params: ConversationParams; Body: SendMessageBody }>(
    '/messaging/conversations/:id/messages',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Send a message',
        description: 'Send a message to a conversation. You must be a participant.',
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
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1 },
            metadata: { type: 'object', description: 'Optional metadata (attachments, etc.)' },
          },
        },
      },
    },
    async (request, reply) => {
      const { content, metadata } = request.body;
      const currentUserId = request.user.userId;

      // Verify user is a participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: request.params.id,
          userId: currentUserId,
        },
      });

      if (!participant) {
        return reply.status(403).send({ error: 'You are not a participant in this conversation' });
      }

      // Create message and update conversation timestamp
      const [message] = await Promise.all([
        prisma.directMessage.create({
          data: {
            conversationId: request.params.id,
            senderId: currentUserId,
            content,
            metadata: metadata ?? undefined,
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        }),
        prisma.conversation.update({
          where: { id: request.params.id },
          data: { updatedAt: new Date() },
        }),
        // Update sender's lastReadAt
        prisma.conversationParticipant.updateMany({
          where: {
            conversationId: request.params.id,
            userId: currentUserId,
          },
          data: { lastReadAt: new Date() },
        }),
      ]);

      return reply.status(201).send(message);
    }
  );

  // PUT /messaging/conversations/:id/read - Mark conversation as read
  fastify.put<{ Params: ConversationParams }>(
    '/messaging/conversations/:id/read',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Mark conversation as read',
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
      const currentUserId = request.user.userId;

      const result = await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: request.params.id,
          userId: currentUserId,
        },
        data: { lastReadAt: new Date() },
      });

      if (result.count === 0) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      return reply.send({ success: true });
    }
  );

  // GET /messaging/unread-count - Get total unread message count
  fastify.get(
    '/messaging/unread-count',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Get unread message count',
        description: 'Get total number of unread messages across all conversations',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply) => {
      const currentUserId = request.user.userId;

      const participants = await prisma.conversationParticipant.findMany({
        where: { userId: currentUserId },
        select: { conversationId: true, lastReadAt: true },
      });

      let totalUnread = 0;
      for (const p of participants) {
        const count = await prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: currentUserId },
            createdAt: { gt: p.lastReadAt || new Date(0) },
            deletedAt: null,
          },
        });
        totalUnread += count;
      }

      return reply.send({ unreadCount: totalUnread });
    }
  );

  // POST /messaging/support - Quick support: start a conversation with SysAdmin
  fastify.post<{ Body: { subject: string; message: string } }>(
    '/messaging/support',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Messaging'],
        summary: 'Start a support conversation with SysAdmin',
        description: 'Quick way to reach SysAdmin. Creates a support-type conversation and sends the first message.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['subject', 'message'],
          properties: {
            subject: { type: 'string', description: 'Support topic / subject' },
            message: { type: 'string', description: 'Your message to SysAdmin' },
          },
        },
      },
    },
    async (request, reply) => {
      const { subject, message } = request.body;
      const currentUserId = request.user.userId;

      // Find an active SysAdmin
      const sysAdmin = await prisma.user.findFirst({
        where: { role: 'sys_admin', status: 'active' },
        orderBy: { lastLoginAt: 'desc' },
      });

      if (!sysAdmin) {
        return reply.status(503).send({ error: 'No SysAdmin available at the moment' });
      }

      // Check if there's already an open support conversation between these users
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'support',
          AND: [
            { participants: { some: { userId: currentUserId } } },
            { participants: { some: { userId: sysAdmin.id } } },
          ],
        },
      });

      if (existing) {
        // Add message to existing support conversation
        const msg = await prisma.directMessage.create({
          data: {
            conversationId: existing.id,
            senderId: currentUserId,
            content: `**${subject}**\n\n${message}`,
          },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        });

        await prisma.conversation.update({
          where: { id: existing.id },
          data: { updatedAt: new Date() },
        });

        return reply.status(201).send({
          conversationId: existing.id,
          message: msg,
          isNew: false,
        });
      }

      // Create new support conversation
      const conversation = await prisma.conversation.create({
        data: {
          title: `Support: ${subject}`,
          type: 'support',
          participants: {
            create: [
              { userId: currentUserId },
              { userId: sysAdmin.id },
            ],
          },
          messages: {
            create: {
              senderId: currentUserId,
              content: `**${subject}**\n\n${message}`,
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                  role: true,
                },
              },
            },
          },
          messages: {
            take: 1,
            include: {
              sender: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      return reply.status(201).send({
        conversationId: conversation.id,
        conversation,
        isNew: true,
      });
    }
  );
}
