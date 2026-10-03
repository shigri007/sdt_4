FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/steritrack.sqlite
WORKDIR /app
COPY --from=build /app ./
RUN apk add --no-cache su-exec && mkdir -p /app/data && chown -R node:node /app
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
