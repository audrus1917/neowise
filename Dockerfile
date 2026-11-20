FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node server.mjs mock-ai.mjs index.html ./
COPY --chown=node:node test/ ./test/

ENV HOST=0.0.0.0
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["node", "server.mjs"]
