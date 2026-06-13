# ─── Étape 1 : compilation du frontend React (Vite) ───────────────
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Étape 2 : image finale (backend Express + frontend compilé) ──
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Frontend compilé, là où server.js le cherche (../frontend/dist)
COPY --from=frontend /app/frontend/dist /app/frontend/dist

EXPOSE 8080
CMD ["node", "server.js"]
