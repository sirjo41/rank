FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001
EXPOSE 5173

CMD ["sh", "-c", "npm run server & npm run dev -- --host"]
