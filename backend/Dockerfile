FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# `node server.js` e nao `npm start`: o npm ficava vivo so para hospedar o node,
# custando 54 MB numa VPS de 957 MB. Sem ele o node tambem recebe SIGTERM
# diretamente do Docker -- pelo npm o sinal se perdia no meio e o desligamento
# era abrupto, cortando requisicao em andamento.
CMD ["node", "server.js"]
