# ---- frontend build ----
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Vite embeds VITE_* values at build time. These are public Firebase web
# identifiers, not backend secrets; production values are passed by the
# Cloud Build config or local docker build --build-arg flags.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_FIREBASE_API_KEY=demo-key
ARG VITE_FIREBASE_AUTH_DOMAIN=demo-test.firebaseapp.com
ARG VITE_FIREBASE_PROJECT_ID=demo-test
ARG VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
ARG VITE_USE_FIREBASE_EMULATORS=
ARG VITE_FIREBASE_AUTH_EMULATOR_HOST=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_USE_FIREBASE_EMULATORS=$VITE_USE_FIREBASE_EMULATORS
ENV VITE_FIREBASE_AUTH_EMULATOR_HOST=$VITE_FIREBASE_AUTH_EMULATOR_HOST
RUN npm run build

# ---- backend build ----
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package.json ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
USER node
EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
