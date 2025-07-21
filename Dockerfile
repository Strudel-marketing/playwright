# Use Node.js 18 base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies with verbose logging to see what's failing
RUN npm install --verbose

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Create necessary directories
RUN mkdir -p downloads tmp logs screenshots && \
    chmod 777 downloads tmp logs screenshots

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
