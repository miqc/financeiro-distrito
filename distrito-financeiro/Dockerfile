FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATABASE_PATH=/app/data/distrito.sqlite
ENV COOKIE_SECURE=true

VOLUME ["/app/data"]
EXPOSE 8787

CMD ["node", "server/index.mjs"]
