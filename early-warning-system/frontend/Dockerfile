# Build static Next.js export for FastAPI to serve.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_BASE=
RUN npm run build

FROM alpine:3.21 AS export
COPY --from=builder /app/out /out
