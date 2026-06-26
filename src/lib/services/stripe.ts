/**
 * Stripe Service
 * 
 * Handles customer creation, subscriptions, and checkout sessions.
 * Free tier is the default - no payment required initially.
 */

import Stripe from 'stripe';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;

if (stripeSecretKey && !stripeSecretKey.startsWith('sk_xxx')) {
  stripe = new Stripe(stripeSecretKey, {
   apiVersion: '2026-02-25.clover',
  });
}

interface CreateCustomerInput {
  email: string;
  name: string;
  organisationId: string;
}

interface CheckoutResult {
  success: boolean;
  sessionUrl?: string;
  error?: string;
}

/**
 * Stripe Service class
 */
export class StripeService {
  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return stripe !== null;
  }

  /**
   * Create a Stripe customer for an organisation
   */
  async createCustomer(input: CreateCustomerInput): Promise<string | null> {
    if (!stripe) {
      console.warn('[StripeService] Stripe not configured. Skipping customer creation.');
      return null;
    }

    try {
      const customer = await stripe.customers.create({
        email: input.email,
        name: input.name,
        metadata: {
          organisationId: input.organisationId,
        },
      });

      console.log(`[StripeService] Created customer ${customer.id} for org ${input.organisationId}`);
      return customer.id;
    } catch (error) {
      console.error('[StripeService] Failed to create customer:', error);
      return null;
    }
  }

  /**
   * Create a checkout session for subscription (Free tier = $0)
   */
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutResult> {
    if (!stripe) {
      console.warn('[StripeService] Stripe not configured.');
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          trial_period_days: 0, // Free tier, no trial needed
        },
      });

      return { success: true, sessionUrl: session.url || undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StripeService] Failed to create checkout session:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create a free subscription directly (no checkout required for free tier)
   */
  async createFreeSubscription(customerId: string): Promise<string | null> {
    if (!stripe) {
      console.warn('[StripeService] Stripe not configured. Assuming free tier active.');
      return 'free_no_stripe';
    }

    const freePriceId = process.env.STRIPE_FREE_PRICE_ID;
    if (!freePriceId || freePriceId.startsWith('price_xxx')) {
      console.warn('[StripeService] Free price ID not configured. Assuming free tier active.');
      return 'free_no_price';
    }

    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: freePriceId }],
        payment_behavior: 'default_incomplete',
      });

      console.log(`[StripeService] Created free subscription ${subscription.id}`);
      return subscription.id;
    } catch (error) {
      console.error('[StripeService] Failed to create free subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<string | null> {
    if (!stripe) return 'active'; // Assume active if not configured

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription.status;
    } catch (error) {
      console.error('[StripeService] Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (!stripe) return true;

    try {
      await stripe.subscriptions.cancel(subscriptionId);
      return true;
    } catch (error) {
      console.error('[StripeService] Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[StripeService] Checkout completed for customer ${session.customer}`);
        // Update organisation subscription status in DB
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[StripeService] Subscription ${subscription.id} updated: ${subscription.status}`);
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        console.log(`[StripeService] Subscription ${deletedSub.id} cancelled`);
        break;

      default:
        console.log(`[StripeService] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(payload: string, signature: string): Stripe.Event | null {
    if (!stripe) return null;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[StripeService] Webhook secret not configured');
      return null;
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('[StripeService] Webhook signature verification failed:', error);
      return null;
    }
  }
}

// Export singleton
export const stripeService = new StripeService();
