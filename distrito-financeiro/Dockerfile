FROM node:24-alpine

WORKDIR /app

# Install OpenSSL for pg crypto (needed by PostgreSQL client)
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
# DATABASE_URL must be set by the deployment environment.
ENV COOKIE_SECURE=true
# Optional: restrict CORS origins in production
# ENV CORS_ORIGIN=https://sua-app.com

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "server/index.mjs"]
