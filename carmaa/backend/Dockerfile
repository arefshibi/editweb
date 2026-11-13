FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY migrations ./migrations
RUN mkdir -p /app/var/media && chown -R node:node /app/var
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
