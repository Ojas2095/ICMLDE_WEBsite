# Production Dockerfile for ICMLDE 2026 Platform
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create persistent storage directories
RUN mkdir -p data uploads/papers uploads/proofs uploads/camera_ready

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start production server
CMD ["node", "server.js"]
