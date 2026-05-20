FROM node:22-alpine

# Pour Prisma sur Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copier d'abord package.json pour profiter du cache
COPY package*.json ./
RUN npm install

# Copier le schéma Prisma et générer le client
COPY prisma ./prisma
RUN npx prisma generate

# Copier le reste du code
COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]