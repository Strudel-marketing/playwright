FROM node:18
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx playwright install chromium
EXPOSE 3000
CMD ["node", "index.js"]
