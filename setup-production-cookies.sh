#!/bin/bash

# Production Cookie Setup for YouTube API Docker Container
# This script uploads your cookies to production and restarts the container

set -e

echo "================================================"
echo "  YouTube API - Production Cookie Setup"
echo "================================================"
echo ""

# Configuration
SERVERS=("95.217.119.125" "65.109.16.126")
USER="forge"
APP_DIR="/home/forge/app.tubeonai.com"  # Adjust this to your actual path
COOKIE_FILE="youtube_cookies.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if cookie file exists locally
if [ ! -f "$COOKIE_FILE" ]; then
    echo -e "${RED}✗ Error: $COOKIE_FILE not found in current directory${NC}"
    echo ""
    echo "Please create youtube_cookies.txt first:"
    echo "1. Install browser extension: 'Get cookies.txt LOCALLY'"
    echo "2. Visit youtube.com (make sure you're logged in)"
    echo "3. Click extension and export cookies"
    echo "4. Save as youtube_cookies.txt in this directory"
    exit 1
fi

echo -e "${GREEN}✓ Found local $COOKIE_FILE${NC}"
echo "  Size: $(du -h "$COOKIE_FILE" | cut -f1)"
echo ""

# Verify cookie file format
if ! grep -q "youtube.com" "$COOKIE_FILE"; then
    echo -e "${RED}✗ Error: Cookie file doesn't contain youtube.com cookies${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Cookie file format looks valid${NC}"
echo ""

# Function to setup on one server
setup_server() {
    local server=$1
    
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}  Setting up: $server${NC}"
    echo -e "${YELLOW}================================================${NC}"
    echo ""
    
    # 1. Upload cookie file
    echo "1. Uploading cookies to server..."
    if scp -o ConnectTimeout=10 "$COOKIE_FILE" "${USER}@${server}:${APP_DIR}/"; then
        echo -e "${GREEN}✓ Cookie file uploaded${NC}"
    else
        echo -e "${RED}✗ Failed to upload cookies${NC}"
        return 1
    fi
    
    # 2. Set proper permissions and restart container
    echo ""
    echo "2. Setting permissions and restarting container..."
    
    ssh -o ConnectTimeout=10 "${USER}@${server}" << EOF
        cd ${APP_DIR}
        
        # Set proper permissions
        chmod 644 youtube_cookies.txt
        
        # Backup old cookies
        if [ -f youtube_cookies_backup.txt ]; then
            mv youtube_cookies_backup.txt youtube_cookies_backup_old.txt
        fi
        cp youtube_cookies.txt youtube_cookies_backup.txt
        
        echo "✓ Permissions set"
        
        # Check if Docker is running
        if ! docker ps &> /dev/null; then
            echo "✗ Docker not accessible"
            exit 1
        fi
        
        # Find the container
        CONTAINER_NAME=\$(docker ps --format '{{.Names}}' | grep -i youtube | head -1)
        
        if [ -z "\$CONTAINER_NAME" ]; then
            echo "✗ YouTube API container not found"
            echo "Running containers:"
            docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
            exit 1
        fi
        
        echo "Found container: \$CONTAINER_NAME"
        
        # Restart using docker-compose if available, otherwise docker restart
        if [ -f docker-compose.yml ]; then
            echo "Restarting via docker-compose..."
            docker-compose restart
        else
            echo "Restarting container directly..."
            docker restart \$CONTAINER_NAME
        fi
        
        echo "✓ Container restarted"
        
        # Wait for container to be healthy
        echo ""
        echo "Waiting for container to be healthy..."
        sleep 5
        
        # Check container status
        STATUS=\$(docker inspect --format='{{.State.Health.Status}}' \$CONTAINER_NAME 2>/dev/null || echo "unknown")
        echo "Container health: \$STATUS"
        
        # Test the API
        echo ""
        echo "3. Testing API with new cookies..."
        
        # Give it a moment to start
        sleep 3
        
        # Test hello endpoint
        if curl -s http://localhost:3000/api/hello | grep -q "cookies_enabled"; then
            echo "✓ API is responding"
            
            # Check if cookies are enabled
            COOKIES_STATUS=\$(curl -s http://localhost:3000/api/hello | grep -o '"cookies_enabled":[^,}]*' | cut -d: -f2)
            if [ "\$COOKIES_STATUS" = "true" ]; then
                echo "✓ Cookies are enabled in API"
            else
                echo "⚠ Cookies not detected by API"
            fi
        else
            echo "⚠ API not responding yet (may need more time to start)"
        fi
        
        echo ""
        echo "4. Checking container logs for cookie detection..."
        docker logs \$CONTAINER_NAME --tail 10 | grep -i cookie || echo "No cookie logs yet"
        
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Setup completed for $server${NC}"
        return 0
    else
        echo -e "${RED}✗ Setup failed for $server${NC}"
        return 1
    fi
}

# Main execution
echo "This script will:"
echo "  1. Upload your youtube_cookies.txt to production servers"
echo "  2. Restart the Docker containers"
echo "  3. Verify cookies are working"
echo ""
echo "Servers to update:"
for server in "${SERVERS[@]}"; do
    echo "  - ${USER}@${server}"
done
echo ""
echo -e "${YELLOW}⚠ Make sure you have SSH access to the servers${NC}"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

echo ""

# Setup each server
SUCCESS_COUNT=0
for server in "${SERVERS[@]}"; do
    if setup_server "$server"; then
        ((SUCCESS_COUNT++))
    fi
    echo ""
done

echo "================================================"
echo "           Setup Complete!"
echo "================================================"
echo ""
echo "Results: $SUCCESS_COUNT/${#SERVERS[@]} servers updated successfully"
echo ""

if [ $SUCCESS_COUNT -eq ${#SERVERS[@]} ]; then
    echo -e "${GREEN}✓ All servers updated successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test your API endpoints"
    echo "2. Monitor logs: ssh ${USER}@SERVER 'docker logs -f CONTAINER_NAME'"
    echo "3. If you still see bot detection, cookies may need to be refreshed"
else
    echo -e "${YELLOW}⚠ Some servers failed to update${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check SSH access: ssh ${USER}@SERVER"
    echo "2. Verify Docker is running: ssh ${USER}@SERVER 'docker ps'"
    echo "3. Check app directory exists: ssh ${USER}@SERVER 'ls -la ${APP_DIR}'"
fi

echo ""
echo "To manually check cookie status on a server:"
echo "  ssh ${USER}@SERVER"
echo "  cd ${APP_DIR}"
echo "  docker logs CONTAINER_NAME | grep cookie"
echo ""

