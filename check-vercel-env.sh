#!/bin/bash

# Check Vercel Environment Variables for Email Configuration
# This script helps diagnose why staff invitation emails aren't being sent

echo "🔍 Checking Vercel Environment Variables..."
echo ""
echo "This will check if RESEND_API_KEY and FROM_EMAIL are configured in production."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed."
    echo ""
    echo "To install: npm i -g vercel"
    echo ""
    echo "Alternatively, check manually at:"
    echo "https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables"
    echo ""
    echo "Required variables for email:"
    echo "  - RESEND_API_KEY (should start with 're_')"
    echo "  - FROM_EMAIL (e.g., onboarding@resend.dev)"
    echo "  - FROM_NAME (optional, e.g., 'Your Organization')"
    exit 1
fi

echo "Fetching environment variables from Vercel..."
echo ""

# Try to list env vars (requires authentication)
vercel env ls

echo ""
echo "✅ If you see RESEND_API_KEY and FROM_EMAIL listed above, they're configured."
echo "❌ If not, you need to add them in Vercel dashboard."
echo ""
echo "To add them:"
echo "1. Go to: https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables"
echo "2. Add these variables for Production environment:"
echo "   - RESEND_API_KEY = re_eoCHkvxn_PFkiH7q7ANYeYa1UiozMxNR7"
echo "   - FROM_EMAIL = onboarding@resend.dev"
echo "   - FROM_NAME = After School Club (optional)"
echo "3. Redeploy your application"
