FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

# Valida a sintaxe da configuracao no build, e nao no boot.
#
# `nginx -t` direto nao funciona aqui: o nginx resolve o hostname de
# `proxy_pass http://api:3001` ao ler a configuracao, e durante o build nao
# existe a rede do compose onde o host `api` vive -- falha com "host not found
# in upstream" mesmo com a configuracao correta. Por isso o teste roda sobre uma
# copia com o nome trocado por um IP; o que se quer verificar aqui e sintaxe, e
# ela nao depende de para onde o proxy aponta.
#
# Sem isto, erro de sintaxe atravessa o deploy inteiro e so aparece com o nginx
# recusando subir -- ou seja, com o site fora do ar. Assim o build falha e a
# versao anterior continua servindo.
RUN cp /etc/nginx/conf.d/default.conf /tmp/original.conf \
 && sed -i 's|http://api:3001|http://127.0.0.1:3001|g' /etc/nginx/conf.d/default.conf \
 && nginx -t \
 && cp /tmp/original.conf /etc/nginx/conf.d/default.conf \
 && rm /tmp/original.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
