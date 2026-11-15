FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Optional build-time settings for the browser bundle. Unset (production) they
# are empty, which the app treats as "use the defaults". The test site passes
# VITE_POSTHOG_HOST so test clicks never reach the real analytics project.
ARG VITE_POSTHOG_HOST=
ARG VITE_DEMO=
ENV VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST VITE_DEMO=$VITE_DEMO
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/data

EXPOSE 3001
ENV PORT=3001
CMD ["node", "server/index.js"]
