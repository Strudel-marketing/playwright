# Use official Playwright image with Node.js
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Clean npm cache and install Node.js dependencies
RUN npm cache clean --force && npm install

# Install Playwright browsers
RUN npx playwright install --with-deps

# Copy application code and all necessary directories
COPY index.js ./
COPY services/ ./services/
COPY utils/ ./utils/
COPY helpers/ ./helpers/

# Create necessary directories with proper permissions
RUN mkdir -p downloads tmp logs screenshots && \
    chmod 777 downloads tmp logs screenshots

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "index.js"]
