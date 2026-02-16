#!/bin/bash

# Alternative approach: Use vercel exec to run the diagnostic script
# This runs the script in Vercel's environment with access to all env vars

echo "🔍 Running OAuth diagnostic on production database via Vercel..."
echo ""
echo "This will use Vercel's runtime environment to access the production database safely."
echo ""

# Run the diagnostic using vercel exec
vercel env exec -- npx tsx fix-oauth-accounts.ts

echo ""
echo "📝 To apply the fixes, run:"
echo "   vercel exec -- npx tsx fix-oauth-accounts.ts --apply"
echo ""
