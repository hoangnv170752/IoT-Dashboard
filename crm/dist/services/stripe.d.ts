import Stripe from 'stripe';
declare const stripe: Stripe;
export { stripe };
export declare function createStripeCustomer(tenantId: string, email: string, name: string): Promise<Stripe.Response<Stripe.Customer>>;
export declare function createCheckoutSession(tenantId: string, priceId: string, successUrl: string, cancelUrl: string): Promise<Stripe.Response<Stripe.Checkout.Session>>;
export declare function createPortalSession(tenantId: string, returnUrl: string): Promise<Stripe.Response<Stripe.BillingPortal.Session>>;
export declare function handleWebhookEvent(event: Stripe.Event): Promise<void>;
export declare function getSubscriptionUsage(tenantId: string): Promise<{
    users: number;
    devices: number;
    assets: number;
}>;
export declare function checkPlanLimits(tenantId: string): Promise<{
    allowed: boolean;
    reason: string;
    issues?: undefined;
    usage?: undefined;
    limits?: undefined;
} | {
    allowed: boolean;
    issues: string[];
    usage: {
        users: number;
        devices: number;
        assets: number;
    };
    limits: {
        users: number | null;
        devices: number | null;
        assets: number | null;
    };
    reason?: undefined;
}>;
//# sourceMappingURL=stripe.d.ts.map