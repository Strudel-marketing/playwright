FROM node:18-alpine

WORKDIR /app
COPY . .

RUN npm install
RUN npx puppeteer@22 install

EXPOSE 3000
CMD ["npm", "start"]
