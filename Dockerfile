# ========================================================
# Secret Metrics Hub - Multi-stage Production Dockerfile
# ========================================================

# 1. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependências
COPY backend-api/package*.json ./
RUN npm ci --include=dev

# Copia código-fonte e compila TypeScript
COPY backend-api/tsconfig.json ./
COPY backend-api/src ./src
COPY backend-api/public ./public
RUN npm run build

# Remove dependências de compilação para imagem enxuta
RUN npm prune --production

# 2. Production Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Cria usuário não-root por segurança
USER node

# Copia artefatos da etapa anterior mantendo permissões
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/public ./public

# Health check embutido
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/looker/health || exit 1

EXPOSE 4000

CMD ["node", "dist/server.js"]
