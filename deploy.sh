#!/usr/bin/env bash

# YouTube API Deployment Script
# Usage: 
#   ./deploy.sh           - Full deployment (rebuild everything)
#   ./deploy.sh --cookies - Quick cookie update only

set -e

# Configuration
SERVER_NAMES=("dc2-web" "dc3-web")
SERVER_IPS=("121.200.63.197" "103.204.80.53")
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"
BRANCH="full-yt-dlp-conversion"
COOKIE_FILE="youtube_cookies.txt"

# Parse arguments
COOKIES_ONLY=false
if [ "$1" == "--cookies" ]; then
    COOKIES_ONLY=true
fi

# Cookie-only update
if [ "$COOKIES_ONLY" = true ]; then
    echo "================================================"
    echo "  Quick Cookie Update"
    echo "================================================"
    echo ""
    
    if [ ! -f "$COOKIE_FILE" ]; then
        echo "✗ Error: $COOKIE_FILE not found"
        exit 1
    fi
    
    SUCCESS=0
    for i in "${!SERVER_NAMES[@]}"; do
        name="${SERVER_NAMES[$i]}"
        server="${SERVER_IPS[$i]}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Updating: $name ($server)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Clean up and upload (try without sudo first)
        ssh ${USER}@${server} "rm -f ${APP_DIR}/youtube_cookies.txt 2>/dev/null || true" > /dev/null 2>&1
        scp -q "$COOKIE_FILE" "${USER}@${server}:${APP_DIR}/" && echo "✓ Uploaded"
        
        # Restart container
        CONTAINER=$(ssh ${USER}@${server} "docker ps --format '{{.Names}}' | grep -E 'youtubei-api' | head -1")
        if [ -n "$CONTAINER" ]; then
            ssh ${USER}@${server} "docker restart $CONTAINER > /dev/null 2>&1" && echo "✓ Restarted"
            sleep 3
            
            # Verify
            if ssh ${USER}@${server} "docker logs $CONTAINER --tail 20 2>/dev/null | grep -q 'Found cookies file'"; then
                echo "✓ Cookies loaded!"
                ((SUCCESS++))
            else
                echo "⚠ Check logs"
            fi
        else
            echo "✗ Container not found"
        fi
        echo ""
    done
    
    echo "================================================"
    echo "Updated: $SUCCESS/${#SERVER_NAMES[@]} servers"
    echo "================================================"
    exit 0
fi

# Full deployment
echo "================================================"
echo "  Full Deployment - Python FastAPI"
echo "================================================"
echo ""
echo "Servers:"
for i in "${!SERVER_NAMES[@]}"; do
    echo "  - ${SERVER_NAMES[$i]} (${SERVER_IPS[$i]})"
done
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

SUCCESS_COUNT=0

for i in "${!SERVER_NAMES[@]}"; do
    name="${SERVER_NAMES[$i]}"
    server="${SERVER_IPS[$i]}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Deploying: $name ($server)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check connection
    if ! ssh -o ConnectTimeout=10 ${USER}@${server} "echo ''" > /dev/null 2>&1; then
        echo "✗ Cannot connect"
        continue
    fi
    
    # Git pull
    echo -n "1. Pulling code... "
    ssh ${USER}@${server} "cd ${APP_DIR} && git fetch && git checkout ${BRANCH} && git pull" > /dev/null 2>&1 && echo "✓" || echo "⚠"
    
    # Upload cookies only (not in git)
    if [ -f "$COOKIE_FILE" ]; then
        echo -n "2. Uploading cookies... "
        # Try to remove old file without sudo first, use sudo only if needed
        ssh ${USER}@${server} "rm -f ${APP_DIR}/youtube_cookies.txt 2>/dev/null || sudo rm -rf ${APP_DIR}/youtube_cookies.txt 2>/dev/null || true" > /dev/null 2>&1
        scp -q "$COOKIE_FILE" ${USER}@${server}:${APP_DIR}/ && echo "✓" || echo "✗"
    else
        echo "2. ⚠ No cookies file found"
    fi
    
    # Rebuild
    echo -n "3. Stopping... "
    ssh ${USER}@${server} "cd ${APP_DIR} && (docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true)" > /dev/null 2>&1 && echo "✓"
    
    echo -n "4. Building... "
    ssh ${USER}@${server} "cd ${APP_DIR} && (docker compose build prod 2>&1 || docker-compose build prod 2>&1)" > /dev/null && echo "✓" || { echo "✗"; continue; }
    
    echo -n "5. Starting... "
    ssh ${USER}@${server} "cd ${APP_DIR} && (docker compose up -d prod || docker-compose up -d prod)" > /dev/null 2>&1 && echo "✓"
    
    # Wait and verify
    echo -n "6. Waiting... "
    sleep 15 && echo "✓"
    
    echo -n "7. Verifying... "
    
    if ssh ${USER}@${server} "docker ps | grep -q youtubei-api-prod" && \
       ssh ${USER}@${server} "curl -s http://localhost:3000/api/hello 2>/dev/null | grep -q cookies_enabled"; then
        echo "✓"
        ((SUCCESS_COUNT++))
    else
        echo "✗"
    fi
done

echo ""
echo "================================================"
echo "Deployed: $SUCCESS_COUNT/${#SERVER_NAMES[@]} servers"
echo "================================================"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "✅ Deployment completed!"
    echo ""
    echo "Test your API:"
    for i in "${!SERVER_NAMES[@]}"; do
        echo "  curl http://${SERVER_IPS[$i]}:3000/api/hello"
    done
fi

echo ""

