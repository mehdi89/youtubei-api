#!/bin/bash

# echo "🚀 Starting Docker deployment..."

# # Pull the latest changes
# echo "📥 Pulling latest changes..."
# git pull

# Build the new production image (no cache to ensure fresh build)
echo "🔨 Building new production image..."
docker compose build --no-cache prod

# Check if the container is running
if [ "$(docker ps -q -f name=youtubei-api-prod)" ]; then
    echo "🛑 Stopping existing container..."
    docker compose stop prod
    
    echo "🗑️ Removing old container..."
    docker compose rm -f prod
fi

# Start the new container
echo "▶️ Starting new container..."
docker compose up -d prod

# Follow the logs for 10 seconds to check for startup issues
echo "📋 Checking logs for startup issues..."
timeout 10 docker compose logs -f prod || true

# Check container health
echo "🏥 Checking container health..."
CONTAINER_ID=$(docker ps -q -f name=youtubei-api-prod)
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_ID)

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo "✅ Deployment completed successfully! Container is healthy."
else
    echo "⚠️ Container is in $HEALTH_STATUS state. You may want to check the logs:"
    echo "    docker compose logs prod"
fi

# Print container information
echo -e "\n📊 Container Information:"
docker ps -f name=youtubei-api-prod 