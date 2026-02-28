FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git curl ripgrep ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/vibe-env \
    && /opt/vibe-env/bin/pip install --no-cache-dir mistral-vibe

ENV PATH="/opt/vibe-env/bin:$PATH"

RUN npm i -g pnpm@9.12.3

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/

RUN pnpm install --filter cfca-api --frozen-lockfile

COPY apps/api/ apps/api/

RUN pnpm --filter cfca-api build

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p ~/.vibe && echo \"MISTRAL_API_KEY=${MISTRAL_API_KEY}\" > ~/.vibe/.env && node dist/main.js"]
