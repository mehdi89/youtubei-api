#!/bin/bash

# Production Cookie Setup for YouTube API Docker Container
# Fixed version with proper error handling and sudo support

set -e

echo "================================================"
echo "  YouTube API - Production Cookie Setup"
echo "================================================"
echo ""

# Configuration
SERVERS=("121.200.63.141" "103.204.80.53" "121.200.63.197")
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"
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
    
    # First, test SSH connection
    echo "Testing SSH connection..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "${USER}@${server}" "echo 'SSH OK'" 2>/dev/null; then
        echo -e "${RED}✗ SSH connection failed${NC}"
        echo "  Please set up SSH key authentication first:"
        echo "    ssh-copy-id ${USER}@${server}"
        echo "  Or ensure password authentication works and run manually"
        return 1
    fi
    echo -e "${GREEN}✓ SSH connection works${NC}"
    echo ""
    
    # Check if directory exists
    echo "1. Checking app directory..."
    if ! ssh "${USER}@${server}" "test -d ${APP_DIR}"; then
        echo -e "${RED}✗ Directory ${APP_DIR} does not exist${NC}"
        echo "  Creating directory..."
        if ! ssh "${USER}@${server}" "sudo mkdir -p ${APP_DIR} && sudo chown ${USER}:${USER} ${APP_DIR}"; then
            echo -e "${RED}✗ Failed to create directory${NC}"
            return 1
        fi
    fi
    
    # Check write permissions
    if ! ssh "${USER}@${server}" "test -w ${APP_DIR}"; then
        echo -e "${YELLOW}⚠ No write permission, attempting to fix with sudo...${NC}"
        if ! ssh "${USER}@${server}" "sudo chown -R ${USER}:${USER} ${APP_DIR}"; then
            echo -e "${RED}✗ Failed to set permissions${NC}"
            return 1
        fi
    fi
    echo -e "${GREEN}✓ Directory accessible${NC}"
    echo ""
    
    # Upload cookie file
    echo "2. Uploading cookies to server..."
    if scp -o ConnectTimeout=10 "$COOKIE_FILE" "${USER}@${server}:${APP_DIR}/"; then
        echo -e "${GREEN}✓ Cookie file uploaded${NC}"
    else
        echo -e "${RED}✗ Failed to upload cookies${NC}"
        return 1
    fi
    
    # Set proper permissions and restart container
    echo ""
    echo "3. Setting permissions and restarting container..."
    
    ssh "${USER}@${server}" bash << EOF
        set -e
        cd ${APP_DIR}
        
        # Set proper permissions
        chmod 644 youtube_cookies.txt 2>/dev/null || sudo chmod 644 youtube_cookies.txt
        
        # Backup old cookies
        if [ -f youtube_cookies_backup.txt ]; then
            mv youtube_cookies_backup.txt youtube_cookies_backup_old.txt 2>/dev/null || true
        fi
        cp youtube_cookies.txt youtube_cookies_backup.txt
        
        echo "✓ Permissions set"
        
        # Check if Docker is running
        if ! docker ps &> /dev/null; then
            if ! sudo docker ps &> /dev/null; then
                echo "✗ Docker not accessible (tried with and without sudo)"
                exit 1
            fi
            DOCKER_CMD="sudo docker"
            COMPOSE_CMD="sudo docker-compose"
        else
            DOCKER_CMD="docker"
            COMPOSE_CMD="docker-compose"
        fi
        
        # Find the container
        CONTAINER_NAME=\$(\$DOCKER_CMD ps --format '{{.Names}}' | grep -E 'youtube|youtubei|yt-api' | head -1)
        
        if [ -z "\$CONTAINER_NAME" ]; then
            echo "✗ YouTube API container not found"
            echo "Running containers:"
            \$DOCKER_CMD ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
            echo ""
            echo "Please start your container first with:"
            echo "  cd ${APP_DIR} && docker-compose up -d"
            exit 1
        fi
        
        echo "✓ Found container: \$CONTAINER_NAME"
        
        # Restart using docker-compose if available, otherwise docker restart
        if [ -f docker-compose.yml ]; then
            echo "Restarting via docker-compose..."
            \$COMPOSE_CMD restart 2>/dev/null || \$DOCKER_CMD restart \$CONTAINER_NAME
        else
            echo "Restarting container directly..."
            \$DOCKER_CMD restart \$CONTAINER_NAME
        fi
        
        echo "✓ Container restarted"
        
        # Wait for container to start
        echo ""
        echo "Waiting for container to start..."
        sleep 5
        
        # Check container status
        if \$DOCKER_CMD ps | grep -q \$CONTAINER_NAME; then
            echo "✓ Container is running"
        else
            echo "⚠ Container may not be running yet"
        fi
        
        # Test the API
        echo ""
        echo "4. Testing API with new cookies..."
        sleep 3
        
        # Test hello endpoint
        if curl -s http://localhost:3000/api/hello 2>/dev/null | grep -q "cookies_enabled"; then
            echo "✓ API is responding"
            
            # Check if cookies are enabled
            COOKIES_STATUS=\$(curl -s http://localhost:3000/api/hello 2>/dev/null | grep -o '"cookies_enabled":[^,}]*' | cut -d: -f2)
            if [ "\$COOKIES_STATUS" = "true" ]; then
                echo "✓ Cookies are enabled in API"
            else
                echo "⚠ Cookies not detected by API"
            fi
        else
            echo "⚠ API not responding (may need more time or check port mapping)"
        fi
        
        echo ""
        echo "5. Checking container logs for cookie detection..."
        \$DOCKER_CMD logs \$CONTAINER_NAME --tail 10 2>/dev/null | grep -i cookie || echo "No cookie-related logs yet"
        
EOF
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Setup completed for $server${NC}"
        return 0
    else
        echo ""
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
echo -e "${YELLOW}⚠ Requirements:${NC}"
echo "  - SSH key authentication set up (run: ssh-copy-id ${USER}@SERVER)"
echo "  - Docker containers already running on servers"
echo "  - User has sudo access (for permission fixes if needed)"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

echo ""

# Setup each server
SUCCESS_COUNT=0
FAILED_SERVERS=()
for server in "${SERVERS[@]}"; do
    if setup_server "$server"; then
        ((SUCCESS_COUNT++))
    else
        FAILED_SERVERS+=("$server")
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
    echo "1. Test your API endpoints from outside"
    echo "2. Monitor logs: ssh ${USER}@SERVER 'docker logs -f CONTAINER_NAME'"
    echo "3. Verify no bot detection errors appear"
else
    echo -e "${YELLOW}⚠ Some servers failed to update${NC}"
    echo ""
    echo "Failed servers:"
    for server in "${FAILED_SERVERS[@]}"; do
        echo "  - ${USER}@${server}"
    done
    echo ""
    echo "Common issues and solutions:"
    echo ""
    echo "1. SSH Key Not Set Up:"
    echo "   ssh-copy-id ${USER}@SERVER"
    echo ""
    echo "2. Permission Denied:"
    echo "   ssh ${USER}@SERVER 'sudo chown -R ${USER}:${USER} ${APP_DIR}'"
    echo ""
    echo "3. Container Not Running:"
    echo "   ssh ${USER}@SERVER 'cd ${APP_DIR} && docker-compose up -d'"
    echo ""
    echo "4. Wrong Directory Path:"
    echo "   ssh ${USER}@SERVER 'find /var/www -name docker-compose.yml'"
    echo ""
fi

echo ""
echo "Manual verification command:"
echo "  ssh ${USER}@SERVER 'docker logs CONTAINER_NAME | grep cookie'"
echo ""

