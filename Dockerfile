# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

LABEL stage="builder"

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
# npm run build = vite build + esbuild server.ts -> dist/server.cjs
COPY . .
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

# Environment
ENV NODE_ENV=production
ENV PORT=10000

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from Stage 1
# dist/ contains:
#   - index.html + assets (React frontend built by Vite)
#   - server.cjs (backend built by esbuild)
COPY --from=builder /app/dist ./dist

# Expose Render's default port
EXPOSE 10000

# Health check (Render uses this to verify the container is alive)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:10000/api/ping || exit 1

# Start the compiled server
CMD ["node", "dist/server.cjs"]