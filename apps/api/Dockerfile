FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ripgrep ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

RUN uv tool install mistral-vibe --python 3.12
ENV PATH="/root/.local/share/uv/tools/mistral-vibe/bin:/root/.local/bin:$PATH"

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
