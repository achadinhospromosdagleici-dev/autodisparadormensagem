FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY tsconfig.json prisma/ ./
RUN npx prisma generate
COPY src/ ./src/
RUN npx tsc

FROM node:20-alpine AS run
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY package.json ./

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
