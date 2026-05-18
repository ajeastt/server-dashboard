FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

COPY . .
RUN cd client && npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache docker-cli docker-compose
WORKDIR /app
COPY --from=builder /app/server /app/server
COPY --from=builder /app/client/dist /app/client/dist
COPY --from=builder /app/server/node_modules /app/server/node_modules

EXPOSE 3001
CMD ["node", "server/src/index.js"]
