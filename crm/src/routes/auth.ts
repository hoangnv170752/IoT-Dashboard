import { FastifyInstance } from 'fastify';
import {
  validateSysAdminLogin,
  validateThingsBoardToken,
  syncThingsBoardUser,
  createJwtPayload,
  getUserById,
} from '../services/auth.js';
import { authenticate } from '../middleware/auth.js';

interface AdminLoginBody {
  email: string;
  password: string;
}

interface SyncBody {
  thingsboardToken: string;
}

interface RefreshBody {
  refreshToken?: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/admin/login - SysAdmin login with email/password
  fastify.post<{ Body: AdminLoginBody }>(
    '/auth/admin/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'SysAdmin login',
        description: 'Login as SysAdmin with email and password. Returns JWT token.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'SysAdmin email' },
            password: { type: 'string', minLength: 8, description: 'Password' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await validateSysAdminLogin(email, password);

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      const payload = createJwtPayload(user);
      const token = fastify.jwt.sign(payload);

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    }
  );

  // POST /auth/sync - Sync ThingsBoard user to CRM
  fastify.post<{ Body: SyncBody }>(
    '/auth/sync',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Sync ThingsBoard user',
        description: 'Validates ThingsBoard token, syncs user to CRM, and returns CRM JWT token.',
        body: {
          type: 'object',
          required: ['thingsboardToken'],
          properties: {
            thingsboardToken: {
              type: 'string',
              description: 'ThingsBoard JWT token',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'CRM JWT token' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string' },
                  tenantId: { type: 'string', nullable: true },
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
              isNewUser: { type: 'boolean' },
              isNewTenant: { type: 'boolean' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { thingsboardToken } = request.body;

      // Validate ThingsBoard token
      const tbUser = await validateThingsBoardToken(thingsboardToken);

      if (!tbUser) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid ThingsBoard token',
        });
      }

      // Sync user to CRM
      const { user, tenant, isNewUser, isNewTenant } = await syncThingsBoardUser(tbUser);

      // Generate CRM JWT token
      const payload = createJwtPayload(user);
      const token = fastify.jwt.sign(payload);

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
        },
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
            }
          : null,
        isNewUser,
        isNewTenant,
      });
    }
  );

  // POST /auth/refresh - Refresh JWT token
  fastify.post<{ Body: RefreshBody }>(
    '/auth/refresh',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Refresh JWT token',
        description: 'Get a new JWT token using the current valid token.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get fresh user data
      const user = await getUserById(request.user.userId);

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      // Generate new token
      const payload = createJwtPayload(user);
      const token = fastify.jwt.sign(payload);

      return reply.send({ token });
    }
  );

  // GET /auth/me - Get current user profile
  fastify.get(
    '/auth/me',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get current user',
        description: 'Get the current authenticated user profile with tenant and permissions.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string', nullable: true },
              avatar: { type: 'string', nullable: true },
              role: { type: 'string' },
              status: { type: 'string' },
              tenant: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  logo: { type: 'string', nullable: true },
                  primaryColor: { type: 'string', nullable: true },
                },
              },
              company: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
              permissions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    resource: { type: 'string' },
                    action: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const user = await getUserById(request.user.userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              slug: user.tenant.slug,
              logo: user.tenant.logo,
              primaryColor: user.tenant.primaryColor,
            }
          : null,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
            }
          : null,
        permissions: user.permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
        })),
      });
    }
  );
}
