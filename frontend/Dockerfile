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

# NAO adicione `RUN nginx -t` aqui. Ja foi tentado e quebra o build: o nginx
# resolve o hostname de `proxy_pass http://api:3001` ao ler a configuracao, e
# durante o build nao existe a rede do compose onde o host `api` vive --
# "host not found in upstream". A configuracao esta certa; ela so nao e
# validavel fora do compose.

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
