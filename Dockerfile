# syntax=docker/dockerfile:1.6

# ============================================================
# STAGE 1 : base commune
# ============================================================
FROM node:20-alpine AS base
WORKDIR /app
# Prisma a besoin d'openssl + libc6-compat sur Alpine
RUN apk add --no-cache openssl libc6-compat

# ============================================================
# STAGE 2 : install des dépendances
# ============================================================
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
# Génère le client Prisma pour Linux (et pas pour le host)
RUN npx prisma generate

# ============================================================
# STAGE 3 : dev (hot reload)
# ============================================================
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ============================================================
# STAGE 4 : build prod
# ============================================================
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Retire les devDependencies pour alléger
RUN npm prune --production

# ============================================================
# STAGE 5 : image prod finale (légère)
# ============================================================
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]