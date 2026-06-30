# ========================================
#  ADSpread Backend Dockerfile
# ========================================

FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

RUN npm install --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client
RUN npm run prisma:generate --workspace=@adspread/backend

# Build backend
RUN npm run build --workspace=@adspread/backend

# Production stage
FROM node:20-bullseye-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/types/package.json ./packages/types/

RUN npm install --ignore-scripts --omit=dev

# Copy built artifacts
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create uploads directory
RUN mkdir -p /app/apps/backend/uploads

# Set working directory to backend
WORKDIR /app/apps/backend

EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
