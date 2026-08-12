# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — instala node_modules uma vez e reaproveita nos demais estágios
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# dev — servidor de desenvolvimento com hot reload (código vem por bind mount)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npx", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------------------------------------------------------------------------
# build — static export (output: "export" -> ./out)
# As NEXT_PUBLIC_* são inlinadas no bundle, por isso entram como build args.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GEMINI_API_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_GEMINI_API_KEY=$NEXT_PUBLIC_GEMINI_API_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# prod — serve o export estático (mesmo artefato do GitHub Pages)
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
