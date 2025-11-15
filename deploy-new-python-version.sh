#!/usr/bin/env bash

# Complete deployment script for new Python FastAPI version
# This replaces the old Node.js version with the new Python version

set -e

# Server configuration (name:ip pairs)
SERVER_NAMES=("dc1-web" "dc2-web" "dc3-web")
SERVER_IPS=("121.200.63.141" "121.200.63.197" "103.204.80.53")
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"
BRANCH="full-yt-dlp-conversion"  # or "master" if you've merged

echo "================================================"
echo "  Deploying NEW Python FastAPI Version"
echo "================================================"
echo ""
echo "This will:"
echo "  1. Pull latest code from git"
echo "  2. Copy new Dockerfile and docker-compose.yml"
echo "  3. Upload youtube_cookies.txt"
echo "  4. Rebuild containers with new Python version"
echo "  5. Verify deployment"
echo ""
echo "Servers:"
for i in "${!SERVER_NAMES[@]}"; do
    echo "  - ${SERVER_NAMES[$i]} (${USER}@${SERVER_IPS[$i]})"
done
echo ""
echo "⚠  This will replace the Node.js version with Python FastAPI"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

SUCCESS_COUNT=0

for i in "${!SERVER_NAMES[@]}"; do
    name="${SERVER_NAMES[$i]}"
    server="${SERVER_IPS[$i]}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Deploying to: $name ($server)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Check connection
    if ! ssh -o ConnectTimeout=10 ${USER}@${server} "echo 'Connected'"; then
        echo "✗ Cannot connect to $name ($server)"
        continue
    fi
    
    # Step 1: Pull latest code
    echo "1. Pulling latest code..."
    ssh ${USER}@${server} "cd ${APP_DIR} && git fetch && git checkout ${BRANCH} && git pull" || {
        echo "⚠ Git pull failed (might not be a git repo)"
    }
    
    # Step 2: Upload new files from local
    echo ""
    echo "2. Uploading new Python files..."
    
    # Upload main files
    scp main.py ${USER}@${server}:${APP_DIR}/ && echo "  ✓ main.py"
    scp requirements.txt ${USER}@${server}:${APP_DIR}/ && echo "  ✓ requirements.txt"
    scp Dockerfile ${USER}@${server}:${APP_DIR}/ && echo "  ✓ Dockerfile"
    scp docker-compose.yml ${USER}@${server}:${APP_DIR}/ && echo "  ✓ docker-compose.yml"
    scp .env ${USER}@${server}:${APP_DIR}/ 2>/dev/null && echo "  ✓ .env" || echo "  ℹ .env not found (using existing)"
    
    # Upload cookies
    if [ -f "youtube_cookies.txt" ]; then
        scp youtube_cookies.txt ${USER}@${server}:${APP_DIR}/ && echo "  ✓ youtube_cookies.txt"
    else
        echo "  ⚠ youtube_cookies.txt not found locally"
    fi
    
    # Step 3: Stop old containers
    echo ""
    echo "3. Stopping old containers..."
    ssh ${USER}@${server} "cd ${APP_DIR} && docker-compose down" || echo "  ℹ No running containers"
    
    # Step 4: Build and start new Python version
    echo ""
    echo "4. Building new Python containers (this may take a few minutes)..."
    ssh ${USER}@${server} "cd ${APP_DIR} && docker-compose build prod" && echo "  ✓ Build complete"
    
    echo ""
    echo "5. Starting new containers..."
    ssh ${USER}@${server} "cd ${APP_DIR} && docker-compose up -d prod" && echo "  ✓ Started"
    
    # Wait for startup
    echo ""
    echo "6. Waiting for container to be healthy (40 seconds)..."
    sleep 40
    
    # Step 5: Verify
    echo ""
    echo "7. Verifying deployment..."
    
    # Check container is running
    if ssh ${USER}@${server} "docker ps | grep -q youtubei-api-prod"; then
        echo "  ✓ Container is running"
    else
        echo "  ✗ Container not found"
        continue
    fi
    
    # Check logs for cookies
    COOKIE_STATUS=$(ssh ${USER}@${server} "docker logs youtubei-api-prod 2>&1 | grep -o 'Found cookies file' | head -1")
    if [ -n "$COOKIE_STATUS" ]; then
        echo "  ✓ Cookies detected in logs"
    else
        echo "  ⚠ Cookies not detected (check logs)"
    fi
    
    # Test API
    API_RESPONSE=$(ssh ${USER}@${server} "curl -s http://localhost:3000/api/hello 2>/dev/null")
    if echo "$API_RESPONSE" | grep -q "cookies_enabled"; then
        echo "  ✓ API is responding"
        
        if echo "$API_RESPONSE" | grep -q '"cookies_enabled":true'; then
            echo "  ✓ Cookies are enabled"
            ((SUCCESS_COUNT++))
        else
            echo "  ⚠ Cookies not enabled"
        fi
    else
        echo "  ✗ API not responding correctly"
    fi
    
    echo ""
    echo "Container logs (last 10 lines):"
    ssh ${USER}@${server} "docker logs youtubei-api-prod --tail 10 2>&1"
done

echo ""
echo "================================================"
echo "  Deployment Summary"
echo "================================================"
echo ""
echo "Successfully deployed to: $SUCCESS_COUNT/${#SERVER_NAMES[@]} servers"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "✅ Deployment completed!"
    echo ""
    echo "Test your API:"
    for i in "${!SERVER_NAMES[@]}"; do
        echo "  ${SERVER_NAMES[$i]}: curl http://${SERVER_IPS[$i]}:3000/api/hello"
    done
else
    echo "⚠ Deployment failed on all servers"
    echo ""
    echo "Check logs manually:"
    echo "  ssh ${USER}@SERVER 'cd ${APP_DIR} && docker logs youtubei-api-prod'"
fi

echo ""

