# Imagem do Integra para Easypanel/Docker. O banco é preparado ao iniciar (MIGRAR_AO_INICIAR=true).
FROM node:22-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# Sem scripts de instalação: o ffmpeg do preparo de vídeo não é necessário no servidor.
RUN npm ci --ignore-scripts

COPY . .
RUN npx next build --no-lint

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
