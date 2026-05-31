import Stripe from 'stripe';
import { prisma } from './prisma.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
export { stripe };
// Create Stripe Customer for a tenant
export async function createStripeCustomer(tenantId, email, name) {
    const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
            tenantId,
        },
    });
    // Update tenant with Stripe customer ID
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customer.id },
    });
    return customer;
}
// Create Checkout Session for subscription
export async function createCheckoutSession(tenantId, priceId, successUrl, cancelUrl) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            users: {
                where: { role: 'tenant_admin' },
                take: 1,
            },
        },
    });
    if (!tenant) {
        throw new Error('Tenant not found');
    }
    let customerId = tenant.stripeCustomerId;
    // Create customer if not exists
    if (!customerId) {
        const adminEmail = tenant.users[0]?.email || `${tenant.slug}@tenant.local`;
        const customer = await createStripeCustomer(tenantId, adminEmail, tenant.name);
        customerId = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
            metadata: {
                tenantId,
            },
        },
        metadata: {
            tenantId,
        },
    });
    return session;
}
// Create Customer Portal Session
export async function createPortalSession(tenantId, returnUrl) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
    });
    if (!tenant?.stripeCustomerId) {
        throw new Error('No Stripe customer found for tenant');
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: returnUrl,
    });
    return session;
}
// Map Stripe subscription status to our status
function mapSubscriptionStatus(stripeStatus) {
    const statusMap = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'cancelled',
        unpaid: 'unpaid',
        paused: 'paused',
    };
    return statusMap[stripeStatus] || 'active';
}
// Handle Stripe webhook events
export async function handleWebhookEvent(event) {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            await handleCheckoutComplete(session);
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            await handleSubscriptionUpdate(subscription);
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            await handleSubscriptionCancelled(subscription);
            break;
        }
        case 'invoice.paid': {
            const invoice = event.data.object;
            await handleInvoicePaid(invoice);
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            await handleInvoicePaymentFailed(invoice);
            break;
        }
        default:
            console.log(`Unhandled webhook event: ${event.type}`);
    }
}
async function handleCheckoutComplete(session) {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId)
        return;
    // Update tenant status
    await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'active' },
    });
}
async function handleSubscriptionUpdate(stripeSubscription) {
    const tenantId = stripeSubscription.metadata?.tenantId;
    if (!tenantId)
        return;
    // Find plan by Stripe price ID
    const priceId = stripeSubscription.items.data[0]?.price.id;
    const plan = await prisma.plan.findFirst({
        where: {
            OR: [
                { stripePriceIdMonthly: priceId },
                { stripePriceIdYearly: priceId },
            ],
        },
    });
    if (!plan) {
        console.error(`Plan not found for price ID: ${priceId}`);
        return;
    }
    const billingCycle = stripeSubscription.items.data[0]?.price.recurring?.interval === 'year'
        ? 'yearly'
        : 'monthly';
    // Access subscription properties with type assertions
    const sub = stripeSubscription;
    const currentPeriodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000)
        : new Date();
    const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;
    // Upsert subscription
    await prisma.subscription.upsert({
        where: { tenantId },
        create: {
            tenantId,
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: stripeSubscription.customer,
            billingCycle,
            status: mapSubscriptionStatus(stripeSubscription.status),
            startDate: new Date(stripeSubscription.start_date * 1000),
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialEndDate: stripeSubscription.trial_end
                ? new Date(stripeSubscription.trial_end * 1000)
                : null,
        },
        update: {
            planId: plan.id,
            stripeSubscriptionId: stripeSubscription.id,
            billingCycle,
            status: mapSubscriptionStatus(stripeSubscription.status),
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
    });
}
async function handleSubscriptionCancelled(stripeSubscription) {
    const tenantId = stripeSubscription.metadata?.tenantId;
    if (!tenantId)
        return;
    await prisma.subscription.update({
        where: { tenantId },
        data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            endDate: new Date(stripeSubscription.ended_at || Date.now()),
        },
    });
}
async function handleInvoicePaid(invoice) {
    // Access subscription with type assertion
    const inv = invoice;
    if (!inv.subscription)
        return;
    const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: inv.subscription },
    });
    if (!subscription)
        return;
    // Generate invoice number
    const count = await prisma.invoice.count({
        where: { subscriptionId: subscription.id },
    });
    const invoiceNumber = `INV-${subscription.tenantId.substring(0, 8).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
    await prisma.invoice.create({
        data: {
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
            invoiceNumber,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
            amount: (invoice.subtotal || 0) / 100,
            tax: (inv.tax || 0) / 100,
            total: (invoice.total || 0) / 100,
            currency: invoice.currency?.toUpperCase() || 'USD',
            periodStart: new Date((inv.period_start || 0) * 1000),
            periodEnd: new Date((inv.period_end || 0) * 1000),
            status: 'paid',
            paidAt: new Date(),
        },
    });
}
async function handleInvoicePaymentFailed(invoice) {
    const inv = invoice;
    if (!inv.subscription)
        return;
    const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: inv.subscription },
    });
    if (!subscription)
        return;
    // Update subscription status
    await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
    });
    // TODO: Send notification to tenant admin
}
// Get subscription usage
export async function getSubscriptionUsage(tenantId) {
    const [usersCount, devicesCount, assetsCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.deviceAssignment.count({ where: { tenantId } }),
        prisma.assetAssignment.count({ where: { tenantId } }),
    ]);
    return {
        users: usersCount,
        devices: devicesCount,
        assets: assetsCount,
    };
}
// Check if tenant is within plan limits
export async function checkPlanLimits(tenantId) {
    const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
    });
    if (!subscription) {
        return { allowed: false, reason: 'No subscription' };
    }
    const usage = await getSubscriptionUsage(tenantId);
    const plan = subscription.plan;
    const issues = [];
    if (plan.maxUsers && usage.users >= plan.maxUsers) {
        issues.push(`User limit reached (${usage.users}/${plan.maxUsers})`);
    }
    if (plan.maxDevices && usage.devices >= plan.maxDevices) {
        issues.push(`Device limit reached (${usage.devices}/${plan.maxDevices})`);
    }
    if (plan.maxAssets && usage.assets >= plan.maxAssets) {
        issues.push(`Asset limit reached (${usage.assets}/${plan.maxAssets})`);
    }
    return {
        allowed: issues.length === 0,
        issues,
        usage,
        limits: {
            users: plan.maxUsers,
            devices: plan.maxDevices,
            assets: plan.maxAssets,
        },
    };
}
//# sourceMappingURL=stripe.js.map