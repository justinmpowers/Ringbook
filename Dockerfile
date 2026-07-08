# --- Stage 1: frontend build ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend deps (native build tools live only here) ---
FROM node:20-alpine AS backend-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
# Alpine uses musl libc; better-sqlite3's prebuilt binaries are linked against
# glibc and fail at runtime with "symbol not found" errors, so force a
# from-source compile against musl using the toolchain above.
RUN npm_config_build_from_source=true npm ci --omit=dev

# --- Stage 3: final runtime image ---
FROM node:20-alpine
RUN apk add --no-cache ffmpeg tini
WORKDIR /app
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./src/public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
