#!/bin/bash

# Simple script to fix permissions FIRST (with password prompts)
# Then you can run the upload script

SERVERS=("121.200.63.141" "103.204.80.53" "121.200.63.197")
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"

echo "================================================"
echo "  Fixing Permissions on Production Servers"
echo "================================================"
echo ""
echo "This will prompt for sudo password on each server."
echo ""

for server in "${SERVERS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Fixing permissions on: $server"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Use -t to allocate pseudo-terminal for sudo password
    ssh -t ${USER}@${server} "sudo chown -R ${USER}:${USER} ${APP_DIR} && sudo chmod 755 ${APP_DIR} && echo '✓ Permissions fixed'"
    
    if [ $? -eq 0 ]; then
        echo "✓ Done for $server"
    else
        echo "✗ Failed for $server"
    fi
    echo ""
done

echo "================================================"
echo "Permissions fixed! Now you can upload cookies:"
echo "  ./upload-cookies-only.sh"
echo "================================================"

