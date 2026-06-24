# ========================================
#  ADSpread Backend Dockerfile
# ========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY package-lock.json* ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

RUN npm ci --include=dev

# Copy source code
COPY . .

# Generate Prisma client
RUN npm run prisma:generate --workspace=@adspread/backend

# Build backend
RUN npm run build --workspace=@adspread/backend

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/apps/backend/package*.json ./apps/backend/
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/types/package*.json ./packages/types/

RUN npm ci --only=production

# Copy built artifacts
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

# Create uploads directory
RUN mkdir -p /app/apps/backend/uploads

# Set working directory to backend
WORKDIR /app/apps/backend

EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
