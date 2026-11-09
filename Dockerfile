FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

FROM dependencies AS frontend
RUN npm ci --workspace frontend --no-audit --no-fund
COPY frontend/ frontend/
COPY shared/ shared/
ENV VITE_API_URL=same-origin
RUN npm run build

FROM dependencies AS runtime
RUN npm ci --workspace backend --omit=dev --no-audit --no-fund
COPY backend/ backend/
COPY shared/ shared/
COPY --from=frontend /app/frontend/dist frontend/dist
ENV NODE_ENV=production
USER node
CMD ["node", "backend/src/server.js"]
