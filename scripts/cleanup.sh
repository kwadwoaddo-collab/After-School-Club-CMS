#!/bin/bash

# Quick Clean - Removes build cache and logs
echo "🧹 Cleaning local environment..."

cd "$(dirname "$0")"

# Clean build cache
if [ -d ".next" ]; then
    echo "  Removing .next build cache..."
    rm -rf .next
    echo "  ✅ .next removed"
fi

# Clean log files
if ls *.log 1> /dev/null 2>&1; then
    echo "  Removing log files..."
    rm -f *.log
    echo "  ✅ Logs removed"
fi

# Clean macOS files
if ls .DS_Store 1> /dev/null 2>&1; then
    echo "  Removing .DS_Store files..."
    find . -name ".DS_Store" -delete
    echo "  ✅ .DS_Store files removed"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  - Run 'npm run dev' to start development"
echo "  - Run 'npm run build' for production build"
