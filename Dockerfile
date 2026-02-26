# Dockerfile
# Multi-stage build for figma-mcp-write server
# Note: This runs only the MCP + WebSocket server.
# The Figma plugin runs inside Figma (not in Docker).

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency install
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY src/ ./src/

# Build server
RUN npm run build:server

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server from builder
COPY --from=builder /app/dist/ ./dist/

# Copy plugin files (needed for npm package structure, not execution)
COPY plugin/manifest.json ./plugin/
COPY plugin/ui.html ./plugin/

# WebSocket server port
EXPOSE 3846

# Health check: verify the process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3846', () => process.exit(0)).on('error', () => process.exit(1))" || exit 1

# Run the MCP server
CMD ["node", "dist/server/index.js"]
