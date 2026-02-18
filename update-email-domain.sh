#!/bin/bash

# Update Vercel environment variables for SprintScale email

echo "📧 Updating Vercel environment variables for SprintScale domain..."
echo ""

# Update FROM_EMAIL
echo "Setting FROM_EMAIL to use sprintscale.co.uk..."
vercel env rm FROM_EMAIL production -y
vercel env add FROM_EMAIL production

# Add FROM_NAME
echo ""
echo "Setting FROM_NAME..."
vercel env add FROM_NAME production

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "Next step: Redeploy the application"
echo "Run: vercel --prod"
