# Base stage for shared configuration
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Test stage
FROM base AS test
RUN npm install
COPY . .
CMD ["npm", "run", "test"]

# Build stage
FROM base AS builder
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM base AS prod
RUN apk add --no-cache wget
RUN npm install --production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"] 