import { logger } from '@/lib/logger';

const GOCARDLESS_ACCESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;
const GOCARDLESS_ENVIRONMENT = process.env.GOCARDLESS_ENVIRONMENT || 'sandbox';

const API_BASE = GOCARDLESS_ENVIRONMENT === 'live' 
  ? 'https://api.gocardless.com' 
  : 'https://api-sandbox.gocardless.com';

interface CreateCustomerInput {
  email: string;
  givenName: string;
  familyName: string;
  organisationId: string;
}

interface GoCardlessCustomer {
  id: string;
  created_at: string;
  email: string;
  given_name: string;
  family_name: string;
}

interface GoCardlessBillingRequest {
  id: string;
  status: string;
  mandate_request: {
    currency: string;
  };
}

interface GoCardlessBillingRequestFlow {
  id: string;
  authorisation_url: string;
}

interface CreatePaymentInput {
  amountPence: number;
  currency: string;
  mandateId: string;
  description: string;
  reference?: string;
}

export class GoCardlessService {
  isConfigured(): boolean {
    return !!GOCARDLESS_ACCESS_TOKEN;
  }

  private async fetchGC<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('GoCardless not configured');
    }

    const res = await fetch(`\${API_BASE}\${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer \${GOCARDLESS_ACCESS_TOKEN}`,
        'GoCardless-Version': '2015-07-06',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      logger.error('[GoCardlessService] API error:', errorData);
      throw new Error(`GoCardless API error: \${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Create a customer in GoCardless.
   * If unconfigured, returns a stub ID.
   */
  async createCustomer(input: CreateCustomerInput): Promise<string> {
    if (!this.isConfigured()) {
      logger.info(`[GoCardlessService] Stub: Created customer for \${input.email}`);
      return `CU\${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }

    try {
      const data = await this.fetchGC<{ customers: GoCardlessCustomer }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          customers: {
            email: input.email,
            given_name: input.givenName,
            family_name: input.familyName,
            metadata: {
              organisationId: input.organisationId,
            }
          }
        }),
      });
      return data.customers.id;
    } catch (err) {
      logger.error('[GoCardlessService] Failed to create customer', err);
      throw err;
    }
  }

  /**
   * Starts a billing request flow for a customer to authorize a Direct Debit mandate.
   * Returns a URL that the user should be redirected to.
   */
  async createMandateCheckout(customerId: string, successUrl: string, cancelUrl: string): Promise<{ id: string, sessionUrl: string }> {
    if (!this.isConfigured()) {
      logger.info(`[GoCardlessService] Stub: Created mandate checkout for \${customerId}`);
      const stubId = `BR\${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      // For stub testing, we just simulate an immediate success redirect
      return { 
        id: stubId, 
        sessionUrl: `\${successUrl}?billing_request=\${stubId}` 
      };
    }

    try {
      // 1. Create a Billing Request
      const brData = await this.fetchGC<{ billing_requests: GoCardlessBillingRequest }>('/billing_requests', {
        method: 'POST',
        body: JSON.stringify({
          billing_requests: {
            mandate_request: {
              currency: 'GBP',
            },
            links: {
              customer: customerId
            }
          }
        })
      });

      // 2. Create a Billing Request Flow to get the URL
      const brfData = await this.fetchGC<{ billing_request_flows: GoCardlessBillingRequestFlow }>('/billing_request_flows', {
        method: 'POST',
        body: JSON.stringify({
          billing_request_flows: {
            redirect_uri: successUrl,
            exit_uri: cancelUrl,
            links: {
              billing_request: brData.billing_requests.id
            }
          }
        })
      });

      return {
        id: brData.billing_requests.id,
        sessionUrl: brfData.billing_request_flows.authorisation_url
      };
    } catch (err) {
      logger.error('[GoCardlessService] Failed to create mandate checkout', err);
      throw err;
    }
  }

  /**
   * Triggers a Direct Debit payment against an active mandate.
   */
  async createPayment(input: CreatePaymentInput): Promise<{ id: string, status: string }> {
    if (!this.isConfigured()) {
      logger.info(`[GoCardlessService] Stub: Processed payment of £\${(input.amountPence / 100).toFixed(2)} against mandate \${input.mandateId}`);
      return {
        id: `PM\${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: 'pending_submission'
      };
    }

    try {
      const data = await this.fetchGC<{ payments: { id: string, status: string } }>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          payments: {
            amount: input.amountPence,
            currency: input.currency,
            description: input.description,
            reference: input.reference,
            links: {
              mandate: input.mandateId
            }
          }
        })
      });

      return {
        id: data.payments.id,
        status: data.payments.status
      };
    } catch (err) {
      logger.error('[GoCardlessService] Failed to create payment', err);
      throw err;
    }
  }
}

export const gocardlessService = new GoCardlessService();
