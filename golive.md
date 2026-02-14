# 🚀 Go-Live Checklist: After-School Club CMS

This document tracks all the critical configurations and environment variables that need to be updated before the application is moved to a production (live) environment.

---

## 📧 Email (Resend)
- [ ] **Verify Domain**: Go to [resend.com/domains](https://resend.com/domains) and verify your business domain.
- [ ] **Update From Address**: In `.env.local`, change `FROM_EMAIL` from `onboarding@resend.dev` to `bookings@yourdomain.com`.
- [ ] **Production API Key**: Ensure `RESEND_API_KEY` is a live key (not a restricted testing key).

## 💬 SMS (Twilio)
- [ ] **Credentials**: Replace `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` with real values from your Twilio Console.
- [ ] **Sender Number**: Update `TWILIO_PHONE_NUMBER` to your verified Twilio number.
- [ ] **Compliance**: Ensure your Twilio account is approved for A2P 10DL (for UK/US messaging compliance).

## 📅 Google Calendar
- [ ] **Credentials File**: Place your production Service Account JSON file at `./credentials/google-service-account.json`.
- [ ] **Calendar ID**: Ensure `GOOGLE_CALENDAR_ID` in `.env.local` points to the correct calendar (or use `primary` if the service account owns it).

## 💳 Payments (Stripe)
- [ ] **Live Keys**: Change `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to those starting with `sk_live_` and `pk_live_`.
- [ ] **Webhooks**: Update `STRIPE_WEBHOOK_SECRET` to the live webhook secret from the Stripe Dashboard.
- [ ] **Price IDs**: Replace `STRIPE_FREE_PRICE_ID` and any others with the IDs of products created in Stripe's **Live Mode**.

## 🔐 Security & Auth
- [ ] **Secrets**: Update `JWT_SECRET`, `NEXTAUTH_SECRET`, and `AUTH_SECRET` to long, random strings.
- [ ] **Base URL**: Set `NEXT_PUBLIC_BASE_URL` and `NEXTAUTH_URL` to the actual public domain (e.g., `https://your-app.com`).
- [ ] **Google OAuth**: Add your production domain to the "Authorized Redirect URIs" in the Google Cloud Console.

## 🗄️ Database
- [ ] **Production URL**: Update `DATABASE_URL` to point to your hosted production database (e.g., Supabase, Neon, or Railway).

---

## 🤖 AI Recall Prompt
Copy and paste this prompt to me (Antigravity) whenever you want to check your readiness level:

> **"Antigravity, please review the golive.md file and check my current environment configuration. Tell me which items are still using test/placeholder values and what I need to do next to get the system ready for production."**

---
*Last Updated: February 12, 2026*
