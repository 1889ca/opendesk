FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/modules ./modules
COPY --from=build /app/contracts ./contracts
COPY --from=build /app/migrations ./migrations
COPY package.json server.ts tsconfig.json ./

RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app

USER app
EXPOSE 3000
# tsx is used at runtime because the codebase uses .ts extension imports
# (allowImportingTsExtensions), and tsc does not rewrite import specifiers.
# tsx is a production dependency so the overhead is minimal (startup-only).
CMD ["node", "--import=tsx", "server.ts"]
