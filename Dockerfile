# Use official Playwright image with Node.js
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Create necessary directories
RUN mkdir -p downloads tmp logs screenshots

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
