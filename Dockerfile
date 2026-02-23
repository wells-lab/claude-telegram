FROM node:20-slim

WORKDIR /app

# Install deps first for better caching
COPY package*.json ./
RUN npm ci --production=false

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove dev deps after build
RUN npm prune --production

# Run as non-root
RUN useradd -m botuser
USER botuser

CMD ["node", "dist/index.js"]
