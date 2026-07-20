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

# --- Stage 3: whisper.cpp build (compiled from source, invoked later like
# ffmpeg via child_process - not an npm/native-addon dependency, which avoids
# the exact glibc-prebuilt-on-musl failure mode better-sqlite3 hit above,
# since compiling in this same Alpine stage produces a native musl binary) ---
FROM node:20-alpine AS whisper-build
ARG WHISPER_VERSION=v1.9.1
ARG WHISPER_MODEL=base.en
RUN apk add --no-cache git cmake make g++ curl bash
WORKDIR /opt
RUN git clone --depth 1 --branch ${WHISPER_VERSION} https://github.com/ggerganov/whisper.cpp.git whisper.cpp
WORKDIR /opt/whisper.cpp
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF && \
    cmake --build build -j"$(nproc)" --target whisper-cli --config Release
RUN sh ./models/download-ggml-model.sh ${WHISPER_MODEL}

# --- Stage 4: final runtime image ---
FROM node:20-alpine
ARG WHISPER_MODEL=base.en
# Upgrade first so the base image's own packages (e.g. libssl3/libcrypto3,
# libjxl - the latter reachable via ffmpeg decoding admin-uploaded cover
# images) pick up security patches instead of whatever shipped in the
# upstream node:20-alpine layer. libgomp/libstdc++ are whisper-cli's
# runtime shared library dependencies.
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache ffmpeg tini libgomp libstdc++
WORKDIR /app
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./src/public
COPY --from=whisper-build /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
# Named explicitly (not a *.bin wildcard) - the repo's models/ directory also
# ships small "for-tests" dummy model fixtures for whisper.cpp's own test
# suite, which a wildcard would have copied alongside the real model.
COPY --from=whisper-build /opt/whisper.cpp/models/ggml-${WHISPER_MODEL}.bin /app/whisper-models/ggml-${WHISPER_MODEL}.bin

# Run as the non-root "node" user baked into the base image instead of root.
RUN mkdir -p /data && chown -R node:node /app /data /usr/local/bin/whisper-cli
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODELS_DIR=/app/whisper-models

EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
