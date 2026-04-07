FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD ["node", "--import=tsx", "server.ts"]
