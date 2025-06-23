FROM node:18-slim

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libdrm2 \
    libdrm-common \
    libxshmfence1 \
    libgbm1 \
    xdg-utils \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

RUN npm install
RUN npx puppeteer@22 install

EXPOSE 3000
CMD ["npm", "start"]
