# Vercel Staging Environment Setup Guide

This document outlines the recommended approach for setting up a safe and robust staging environment for the After School Club CMS on Vercel. The primary goal is to ensure that development and testing activities never inadvertently affect production data, trigger real payments, or send communications to real parents.

## 1. Branch Strategy

To maintain clear separation between production and development states, we employ the following Git branching strategy:

*   **`main` branch:** This is the production branch. It represents the live state of the application. Commits merged into `main` trigger production deployments on Vercel.
*   **`staging` branch:** This branch acts as the primary testing ground before changes go live. It aggregates features that are ready for final Quality Assurance (QA). Pushing to `staging` should trigger a deployment to a persistent staging environment.
*   **Feature Branches (`feature/*`, `fix/*`, etc.):** Individual changes and bug fixes are developed here. Pull Requests (PRs) from feature branches into `staging` or `main` will trigger Vercel Preview Deployments for isolated testing of that specific feature.

## 2. Vercel Staging Setup

Configure Vercel to support the branching strategy and isolate the staging environment.

### Preview Deployments

Vercel automatically creates Preview Deployments for every Pull Request. These deployments get unique, temporary URLs. Ensure this setting is active in the Vercel project dashboard under **Settings > Git**.

### Staging Domain/Subdomain

Assign a fixed custom domain to the `staging` branch (e.g., `staging.yourdomain.com`).
1.  Go to **Settings > Domains** in the Vercel dashboard.
2.  Add the staging domain.
3.  Edit the domain and set the **Git Branch** to `staging`. This ensures that every commit to the `staging` branch updates this specific URL.

### Environment Variables

Environment variables are critical for environment isolation. In Vercel (**Settings > Environment Variables**), ensure variables are strictly scoped:

*   **Production:** Only variables scoped to "Production" should contain live API keys and production database connection strings.
*   **Preview:** Variables scoped to "Preview" will apply to both PR previews and the `staging` branch deployment. These *must* contain test credentials and point to the staging database.
*   **Development:** Used for local development (`vercel env pull`).

## 3. Database Strategy

**Rule: Never connect a staging or preview environment to the production database.**

### Separate Neon Staging Branch/Database

We utilize Neon's branching feature to create an isolated database environment for staging.

1.  **Staging Database Branch:** In the Neon console, create a database branch named `staging` originating from your `main` (production) branch. This provides a snapshot of the schema (and optionally data) without affecting production.
2.  **Preview Database Branches (Optional but recommended):** For complex database migrations in PRs, consider creating ephemeral Neon branches for each PR, or use the `staging` Neon branch for all Vercel Preview deployments.
3.  **Connection Strings:** Set the Vercel "Preview" environment variable `DATABASE_URL` (or equivalent) to the connection string of the Neon `staging` branch. The "Production" environment variable must point to the Neon `main` branch.

### Data Sanitization

If you seed the staging database from production, implement a sanitization script to anonymize sensitive Personally Identifiable Information (PII) like parent names, student names, and contact details before testing begins.

## 4. Email Safety

To prevent accidental emails (e.g., registration confirmations, invoices) from reaching real parents during testing:

*   **Use a Sandbox/Testing Email Service:** For staging and preview environments, configure your email provider (e.g., Resend, SendGrid) to use a test API key or a sandbox environment.
*   **Email Interception (Mailtrap):** Alternatively, use a service like Mailtrap for staging. All emails sent by the staging environment will be caught by Mailtrap's inbox, allowing developers to verify email formatting and delivery without sending actual emails.
*   **Environment Variable Control:** Ensure the `EMAIL_API_KEY` in Vercel "Preview" settings points to the testing service, not the production service.

## 5. Payment Safety (Stripe)

**Rule: Staging and preview environments must strictly use Stripe Test Mode.**

1.  **Test API Keys:** Obtain your Stripe Test Publishable Key (`pk_test_...`) and Test Secret Key (`sk_test_...`) from the Stripe Dashboard.
2.  **Vercel Configuration:** In Vercel, set the "Preview" environment variables (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) to these test keys.
3.  **Verification:** With test keys active, no real charges can be processed. You must use Stripe's provided test credit card numbers to simulate transactions.

## 6. Third-Party Integrations (Google Calendar, Twilio)

Isolate all other third-party services to prevent side effects in the real world.

### Google Calendar Safety

*   **Test Calendars:** Create separate Google Calendars specifically for staging purposes. Do not use the production calendars used by staff or parents.
*   **Test Credentials:** If possible, use a separate Google Cloud Service Account with access only to the test calendars. Update the relevant Google API environment variables in Vercel's "Preview" scope.

### Twilio (SMS) Safety

*   **Test Credentials:** Use Twilio's Test Credentials (Account SID and Auth Token). When using these test credentials, Twilio will simulate message sending but will not actually dispatch SMS messages or charge your account.
*   **Verified Caller IDs:** If you must use a live Twilio account for specific tests, only send messages to verified phone numbers belonging to the development/QA team. Never use production parent phone numbers.

## 7. Deployment Checklist

Before merging any significant feature into `main` (Production), verify the following in the Staging environment:

- [ ] Code is merged into the `staging` branch and deployed successfully to the staging URL.
- [ ] Staging database (`staging` Neon branch) is active; verified no connection to production DB.
- [ ] Email notifications are routed to a test inbox (e.g., Mailtrap) or sandbox mode is active.
- [ ] Stripe is operating in Test Mode; test transactions succeed using test card numbers.
- [ ] Third-party integrations (Google Calendar, Twilio) are interacting with test accounts/sandboxes only.
- [ ] QA team has signed off on the feature functionality on the staging URL.

## 8. Rollback Process

If a critical issue is discovered after deploying to Production (`main`), execute the following rollback procedure:

1.  **Instant Rollback via Vercel:**
    *   Navigate to the Vercel project dashboard > **Deployments**.
    *   Locate the last known stable production deployment (the one prior to the problematic release).
    *   Click the three dots (`...`) next to the deployment and select **Promote to Production** (or **Assign Custom Domains** to instantly route traffic back). This action is near-instantaneous.
2.  **Revert Git State:**
    *   Once the live site is stabilized, revert the problematic commit in the `main` branch: `git revert <commit-hash>`.
    *   Push the reverted commit to `main` to align the Git repository with the rolled-back Vercel state.
3.  **Investigate in Staging:**
    *   Reproduce the issue in the staging environment.
    *   Develop and test a fix on a feature branch.
    *   Push the fix through the standard deployment pipeline (`feature` -> `staging` -> `main`).
