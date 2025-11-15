#!/bin/bash

# Simple script to fix permissions FIRST (with password prompts)
# Then you can run the upload script

# Server configuration
declare -A SERVERS=(
    ["dc1-web"]="121.200.63.141"
    ["dc2-web"]="121.200.63.197"
    ["dc3-web"]="103.204.80.53"
)
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"

echo "================================================"
echo "  Fixing Permissions on Production Servers"
echo "================================================"
echo ""
echo "This will prompt for sudo password on each server."
echo ""

for name in "${!SERVERS[@]}"; do
    server="${SERVERS[$name]}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Fixing permissions on: $name ($server)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Use -t to allocate pseudo-terminal for sudo password
    ssh -t ${USER}@${server} "sudo chown -R ${USER}:${USER} ${APP_DIR} && sudo chmod 755 ${APP_DIR} && echo '✓ Permissions fixed'"
    
    if [ $? -eq 0 ]; then
        echo "✓ Done for $name ($server)"
    else
        echo "✗ Failed for $name ($server)"
    fi
    echo ""
done

echo "================================================"
echo "Permissions fixed! Now you can upload cookies:"
echo "  ./upload-cookies-only.sh"
echo "================================================"

