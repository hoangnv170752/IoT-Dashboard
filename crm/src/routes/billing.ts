import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma.js';
import {
  stripe,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getSubscriptionUsage,
  checkPlanLimits,
} from '../services/stripe.js';
import { authenticate, requireTenantAdmin } from '../middleware/auth.js';

interface CheckoutBody {
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

interface PortalBody {
  returnUrl: string;
}

export async function billingRoutes(fastify: FastifyInstance) {
  // GET /billing/plans - List available plans
  fastify.get(
    '/billing/plans',
    {
      schema: {
        tags: ['Billing'],
        summary: 'List plans',
        description: 'Get all available subscription plans',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                code: { type: 'string' },
                description: { type: 'string', nullable: true },
                monthlyPrice: { type: 'number' },
                yearlyPrice: { type: 'number' },
                currency: { type: 'string' },
                maxUsers: { type: 'integer', nullable: true },
                maxDevices: { type: 'integer', nullable: true },
                maxAssets: { type: 'integer', nullable: true },
                features: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const plans = await prisma.plan.findMany({
        where: { isActive: true, isPublic: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          monthlyPrice: true,
          yearlyPrice: true,
          currency: true,
          maxUsers: true,
          maxDevices: true,
          maxAssets: true,
          maxStorageGb: true,
          features: true,
        },
      });

      return reply.send(plans);
    }
  );

  // GET /billing/subscription - Get current subscription
  fastify.get(
    '/billing/subscription',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get subscription',
        description: 'Get current tenant subscription details',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: request.user.tenantId },
        include: {
          plan: true,
          invoices: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!subscription) {
        return reply.send({
          subscription: null,
          usage: await getSubscriptionUsage(request.user.tenantId),
        });
      }

      const usage = await getSubscriptionUsage(request.user.tenantId);
      const limits = await checkPlanLimits(request.user.tenantId);

      return reply.send({
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          startDate: subscription.startDate,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          trialEndDate: subscription.trialEndDate,
        },
        usage,
        limits,
        recentInvoices: subscription.invoices,
      });
    }
  );

  // POST /billing/subscription/checkout - Create checkout session
  fastify.post<{ Body: CheckoutBody }>(
    '/billing/subscription/checkout',
    {
      preHandler: [authenticate, requireTenantAdmin],
      schema: {
        tags: ['Billing'],
        summary: 'Create checkout',
        description: 'Create a Stripe Checkout session for subscription',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['planCode', 'billingCycle', 'successUrl', 'cancelUrl'],
          properties: {
            planCode: { type: 'string', description: 'Plan code (starter, professional, enterprise)' },
            billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
            successUrl: { type: 'string', format: 'uri' },
            cancelUrl: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      const { planCode, billingCycle, successUrl, cancelUrl } = request.body;

      // Find plan
      const plan = await prisma.plan.findUnique({
        where: { code: planCode },
      });

      if (!plan) {
        return reply.status(404).send({ error: 'Plan not found' });
      }

      // Get price ID based on billing cycle
      const priceId =
        billingCycle === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

      if (!priceId) {
        return reply.status(400).send({ error: 'Stripe price not configured for this plan' });
      }

      try {
        const session = await createCheckoutSession(
          request.user.tenantId,
          priceId,
          successUrl,
          cancelUrl
        );

        return reply.send({
          sessionId: session.id,
          url: session.url,
        });
      } catch (error) {
        console.error('Checkout error:', error);
        return reply.status(500).send({
          error: 'Failed to create checkout session',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /billing/subscription/portal - Create customer portal session
  fastify.post<{ Body: PortalBody }>(
    '/billing/subscription/portal',
    {
      preHandler: [authenticate, requireTenantAdmin],
      schema: {
        tags: ['Billing'],
        summary: 'Customer portal',
        description: 'Create a Stripe Customer Portal session for self-service billing management',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['returnUrl'],
          properties: {
            returnUrl: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      try {
        const session = await createPortalSession(
          request.user.tenantId,
          request.body.returnUrl
        );

        return reply.send({
          url: session.url,
        });
      } catch (error) {
        console.error('Portal error:', error);
        return reply.status(500).send({
          error: 'Failed to create portal session',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /billing/invoices - List invoices
  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/billing/invoices',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'List invoices',
        description: 'Get paginated list of invoices',
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
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 20;
      const skip = (page - 1) * limit;

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: request.user.tenantId },
      });

      if (!subscription) {
        return reply.send({
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }

      const [data, total] = await Promise.all([
        prisma.invoice.findMany({
          where: { subscriptionId: subscription.id },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.invoice.count({ where: { subscriptionId: subscription.id } }),
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

  // POST /billing/webhook - Stripe webhook handler
  fastify.post(
    '/billing/webhook',
    {
      config: {
        rawBody: true,
      },
      schema: {
        tags: ['Billing'],
        summary: 'Stripe webhook',
        description: 'Handle Stripe webhook events',
        hide: true, // Hide from public documentation
      },
    },
    async (request, reply) => {
      const sig = request.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        return reply.status(400).send({ error: 'Missing signature or webhook secret' });
      }

      try {
        // Get raw body - Fastify needs rawBody plugin
        const rawBody = (request as any).rawBody || request.body;
        const event = stripe.webhooks.constructEvent(
          typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
          sig,
          webhookSecret
        );

        await handleWebhookEvent(event);

        return reply.send({ received: true });
      } catch (error) {
        console.error('Webhook error:', error);
        return reply.status(400).send({
          error: 'Webhook signature verification failed',
        });
      }
    }
  );

  // GET /billing/usage - Get current usage
  fastify.get(
    '/billing/usage',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Billing'],
        summary: 'Get usage',
        description: 'Get current resource usage against plan limits',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.user?.tenantId) {
        return reply.status(400).send({ error: 'Tenant required' });
      }

      const usage = await getSubscriptionUsage(request.user.tenantId);
      const limits = await checkPlanLimits(request.user.tenantId);

      return reply.send({
        usage,
        ...limits,
      });
    }
  );
}
