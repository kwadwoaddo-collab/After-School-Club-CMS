#!/bin/bash

# Update Resend API Key in Vercel

echo "🔑 Updating Resend API Key to Production Key..."
echo ""

# Remove old key
echo "Removing old API key..."
vercel env rm RESEND_API_KEY production -y

# Add new production key
echo ""
echo "Adding new production API key..."
vercel env add RESEND_API_KEY production

echo ""
echo "✅ Done! Deploy the app for changes to take effect:"
echo "vercel --prod"
