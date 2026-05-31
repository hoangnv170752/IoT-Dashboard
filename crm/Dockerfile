# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client (outputs to src/generated/prisma)
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# Copy generated prisma to dist folder (since imports are relative)
RUN cp -r src/generated dist/

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for bcrypt
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 crm

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy prisma schema (needed for migrations)
COPY prisma ./prisma/

# Copy built files from builder (includes generated prisma client)
COPY --from=builder /app/dist ./dist/

# Set ownership
RUN chown -R crm:nodejs /app

# Switch to non-root user
USER crm

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
