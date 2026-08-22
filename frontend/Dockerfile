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

# Valida a configuracao no build, e nao no boot. Sem isso, um erro de sintaxe
# passa pelo deploy inteiro e so aparece com o nginx recusando subir -- ou seja,
# com o site fora do ar. Aqui, o build falha e a versao anterior continua no ar.
RUN nginx -t

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
