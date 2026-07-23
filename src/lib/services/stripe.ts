import { logger } from '@/lib/logger';
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
      logger.warn('[StripeService] Stripe not configured. Skipping customer creation.');
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

      logger.info(`[StripeService] Created customer ${customer.id} for org ${input.organisationId}`);
      return customer.id;
    } catch (error) {
      logger.error('[StripeService] Failed to create customer:', error);
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
      logger.warn('[StripeService] Stripe not configured.');
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
      logger.error('[StripeService] Failed to create checkout session:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create a free subscription directly (no checkout required for free tier)
   */
  async createFreeSubscription(customerId: string): Promise<string | null> {
    if (!stripe) {
      logger.warn('[StripeService] Stripe not configured. Assuming free tier active.');
      return 'free_no_stripe';
    }

    const freePriceId = process.env.STRIPE_FREE_PRICE_ID;
    if (!freePriceId || freePriceId.startsWith('price_xxx')) {
      logger.warn('[StripeService] Free price ID not configured. Assuming free tier active.');
      return 'free_no_price';
    }

    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: freePriceId }],
        payment_behavior: 'default_incomplete',
      });

      logger.info(`[StripeService] Created free subscription ${subscription.id}`);
      return subscription.id;
    } catch (error) {
      logger.error('[StripeService] Failed to create free subscription:', error);
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
      logger.error('[StripeService] Failed to get subscription:', error);
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
      logger.error('[StripeService] Failed to cancel subscription:', error);
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
        logger.info(`[StripeService] Checkout completed for customer ${session.customer}`);
        // Update organisation subscription status in DB
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        logger.info(`[StripeService] Subscription ${subscription.id} updated: ${subscription.status}`);
        break;

      case 'customer.subscription.deleted':
        const deletedSub = event.data.object as Stripe.Subscription;
        logger.info(`[StripeService] Subscription ${deletedSub.id} cancelled`);
        break;

      default:
        logger.info(`[StripeService] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Create a one-time payment checkout session for a parent invoice.
   * Used in the parent portal so parents can pay by card online.
   */
  async createInvoicePaymentSession(input: {
    invoiceId: string;
    invoiceNumber: string;
    amountPence: number;           // in pence, e.g. 15000 = £150.00
    parentEmail: string;
    description: string;           // e.g. "Invoice #INV-ABC123 — Sydenham Centre"
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: input.parentEmail,
        line_items: [
          {
            price_data: {
              currency: 'gbp',
              unit_amount: input.amountPence,
              product_data: {
                name: input.description,
              },
            },
            quantity: 1,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          source: 'portal_invoice_payment',
        },
      });

      return { success: true, sessionUrl: session.url || undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[StripeService] Failed to create invoice payment session:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Construct and verify an incoming Stripe webhook event for invoice payments.
   * Uses STRIPE_INVOICE_WEBHOOK_SECRET (separate from subscription webhook secret).
   */
  constructInvoiceWebhookEvent(payload: string, signature: string): Stripe.Event | null {
    if (!stripe) return null;

    const webhookSecret = process.env.STRIPE_INVOICE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('[StripeService] Invoice webhook secret not configured');
      return null;
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('[StripeService] Invoice webhook signature verification failed:', error);
      return null;
    }
  }
}


// Export singleton
export const stripeService = new StripeService();
