FROM mcr.microsoft.com/playwright:latest

WORKDIR /app
COPY . .

RUN npm install
RUN npx playwright install

EXPOSE 3000
CMD ["npm", "start"]
