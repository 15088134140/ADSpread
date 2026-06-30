# ========================================
#  ADSpread Admin Web Dockerfile
# ========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/types/package*.json ./packages/types/

RUN npm install --ignore-scripts

# Copy source code
COPY . .

# Build admin
RUN npm run build --workspace=@adspread/admin

# Production stage - Nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY infra/docker/admin/nginx.conf /etc/nginx/nginx.conf
COPY infra/docker/admin/default.conf /etc/nginx/conf.d/default.conf

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx/client_temp

EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
