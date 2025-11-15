#!/bin/bash

# Simple upload-only script (no sudo needed if permissions are fixed)

SERVERS=("121.200.63.141" "103.204.80.53" "121.200.63.197")
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"
COOKIE_FILE="youtube_cookies.txt"

echo "================================================"
echo "  Uploading Cookies and Restarting Containers"
echo "================================================"
echo ""

if [ ! -f "$COOKIE_FILE" ]; then
    echo "✗ Error: $COOKIE_FILE not found"
    exit 1
fi

SUCCESS=0
TOTAL=${#SERVERS[@]}

for server in "${SERVERS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Server: $server"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Upload cookies
    echo -n "Uploading cookies... "
    if scp -q "$COOKIE_FILE" "${USER}@${server}:${APP_DIR}/"; then
        echo "✓"
    else
        echo "✗ Failed"
        continue
    fi
    
    # Set permissions and restart
    echo -n "Setting permissions... "
    ssh ${USER}@${server} "cd ${APP_DIR} && chmod 644 youtube_cookies.txt" && echo "✓" || echo "✗"
    
    # Find and restart container
    echo -n "Finding container... "
    CONTAINER=$(ssh ${USER}@${server} "docker ps --format '{{.Names}}' | grep -E 'youtube|youtubei|yt-api' | head -1")
    
    if [ -z "$CONTAINER" ]; then
        echo "✗ Not found"
        echo "  Run: ssh ${USER}@${server} 'cd ${APP_DIR} && docker-compose up -d'"
        continue
    fi
    
    echo "✓ Found: $CONTAINER"
    
    # Restart container
    echo -n "Restarting container... "
    if ssh ${USER}@${server} "docker restart $CONTAINER > /dev/null 2>&1"; then
        echo "✓"
        sleep 3
        
        # Verify
        echo -n "Checking cookies... "
        if ssh ${USER}@${server} "docker logs $CONTAINER --tail 20 2>/dev/null | grep -q 'Found cookies file'"; then
            echo "✓ Loaded!"
            ((SUCCESS++))
        else
            echo "⚠ Check logs"
        fi
    else
        echo "✗ Failed"
    fi
    
    echo ""
done

echo "================================================"
echo "Results: $SUCCESS/$TOTAL servers updated"
echo "================================================"

if [ $SUCCESS -eq $TOTAL ]; then
    echo "✅ All done! Your API should now work without bot detection."
else
    echo "⚠ Some servers failed. Check the output above."
fi

