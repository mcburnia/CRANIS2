FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

FROM node:22-alpine

RUN apk add --no-cache unzip xz

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Keep V8 heap below container memory limit to prevent cgroup OOM kills.
CMD ["node", "--max-old-space-size=512", "dist/index.js"]
