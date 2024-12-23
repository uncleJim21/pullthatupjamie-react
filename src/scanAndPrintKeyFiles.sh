#!/bin/bash

FILES=(
    "./components/SearchInterface.tsx"
    "./components/SourceTile.tsx"
    "./components/ModelSettingsBar.tsx"
    "./components/ModeCards.tsx"
    "lib/searxng.ts"
    "types/search.ts"
    "app/page.tsx"
    "app/providers.tsx"
    "components/SignInModal.tsx"
    "app/api/auth-check.ts"
    "app/api/stream-search.ts"
)

echo "=== Pull That Up Jamie! - Key Files Scanner ==="
echo "Scanning for key application files..."
echo ""

for file in "${FILES[@]}"; do
    echo "-----------"
    echo "[$file]"
    echo "-----------"
    if [ -f "$file" ]; then
        cat "$file"
    else
        echo "File not found: $file"
    fi
    echo ""
done

echo "=== Scan Complete ==="