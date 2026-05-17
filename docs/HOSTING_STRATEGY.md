# Hosting Strategy: Next.js + Neon + Vercel

This guide outlines a **Modern, Serverless, and Low-Maintenance** hosting strategy for your Next.js application.

## **Overview**
We will separate the **Application Logic (Frontend/API)** from the **Data Storage (Database)** to leverage the best-in-class free tiers and scalability.

| Component | Provider | Why? | Cost (Typical Starter) |
| :--- | :--- | :--- | :--- |
| **Frontend & API** | **Vercel** | Creators of Next.js. Seamless git integration, instant previews, global CDN. | **Free** (Hobby) |
| **Database** | **Neon** | Serverless Postgres. Scales to zero (cost-saving), branches like git, perfect for Vercel. | **Free** (0.5GB) |
| **File Storage** | **Vercel Blob** | (Optional) For user uploads if needed. Simple S3 alternative. | **Free** (250MB) |

---

## **Step 1: Database Setup (Neon)**
Your local database (`postgresql://kwadw@localhost...`) **cannot** be accessed by the internet. We need a cloud database.

1.  **Create Account**: Sign up at [neon.tech](https://neon.tech).
2.  **Create Project**: Name it `after-school-club-cms`.
3.  **Get Connection String**:
    -   Copy the `Postgres Connection String` (it looks like `postgres://user:pass@ep-cool-Project.aws.neon.tech/neondb?sslmode=require`).
    -   **Important**: Save this! You will need it for Vercel.

---

## **Step 2: Prepare Your Code**
Ensure your project is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

1.  **Check `drizzle.config.ts`**: It is already configured to use `process.env.DATABASE_URL`. This is perfect.
2.  **Check Scripts**: Your `package.json` has:
    -   `"build": "next build"` (Standard)
    -   `"start": "next start"` (Standard)
    -   `"db:migrate": "drizzle-kit migrate"` (Crucial for production)

---

## **Step 3: Deploy to Vercel**
1.  **Sign Up/Login**: Go to [vercel.com](https://vercel.com) and login with your GitHub account.
2.  **Import Project**:
    -   Click **"Add New..."** -> **"Project"**.
    -   Select your `after-school-club-cms` repository.
3.  **Configure Project**:
    -   **Framework Preset**: Next.js (Default).
    -   **Root Directory**: `./` (Default).
    -   **Environment Variables**:
        -   Add all variables from your `.env.local` file **EXCEPT** `DATABASE_URL`.
        -   **Update `DATABASE_URL`**: Use the **Neon Connection String** from Step 1.
        -   **Update `NEXTAUTH_URL`**: Set this to your production URL (e.g., `https://your-project.vercel.app`) once generated, or leave it empty (Vercel automatically sets `VERCEL_URL`, but NextAuth sometimes prefers exact). *Initial deploy: you might need to redeploy once to set this.*
        -   **Update `NEXT_PUBLIC_BASE_URL`**: Same as above.

    **Required Env Vars:**
    ```bash
    DATABASE_URL=postgres://... (Neon)
    AUTH_SECRET=...
    AUTH_GOOGLE_ID=...
    AUTH_GOOGLE_SECRET=...
    RESEND_API_KEY=...
    # ... any other keys from .env.local
    ```

4.  **Deploy**: Click **"Deploy"**. Vercel will build your app and assign a domain (e.g., `after-school-club-cms.vercel.app`).

---

## **Step 4: Initialize Production Database**
Your new Neon database is empty. We need to push your schema to it.

**Option A: Run from Local Machine (Easiest)**
1.  Create a strict `.env.production` file locally (DO NOT COMMIT THIS) with your **Neon** `DATABASE_URL`.
2.  Run the migration command pointing to the production DB:
    ```bash
    # If using .env.production, load it explicitly or just paste the URL inline
    DATABASE_URL="postgres://user:pass@neondb..." npx drizzle-kit migrate
    ```

**Option B: Connect via Build Step (Advanced)**
-   Generally better to migrate *outside* the build process to avoid downtime during deploys, but for a small app, Option A is fine.

---

## **Step 5: Post-Deployment**
1.  **Check Auth**: Ensure your Google OAuth settings (in Google Cloud Console) allow the new Vercel domain (`https://your-app.vercel.app`) as an authorized redirect URI.
    -   Add: `https://your-app.vercel.app/api/auth/callback/google`
2.  **Check Stripe**: Add the webhook endpoint to Stripe Dashboard if strictly needed (not critical for "Free" tier yet).
3.  **Custom Domain**: In Vercel Settings -> Domains, add `www.sydenhamasc.co.uk` (or similar) if you own it.

## **Scalability Note**
-   **Vercel** scales automatically. You don't manage servers.
-   **Neon** scales storage and compute automatically.
-   **Cost**: This setup is likely **free** for your current usage volume.
