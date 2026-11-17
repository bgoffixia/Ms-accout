FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY . .

# Vite embeds VITE_* values into the browser bundle at build time.
# Declare the Railway variable as a build ARG and expose it during the build.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

RUN pnpm install --frozen-lockfile \
    && pnpm --filter @workspace/enrollment-portal build \
    && pnpm --filter @workspace/api-server build

EXPOSE 3000

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
