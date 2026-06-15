# Transforma Educacao PB 2026

Sistema administrativo com frontend em React/Vite e backend em Node.js/Express.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Autenticacao | JWT + bcrypt |
| Banco | Mock por padrao, MySQL opcional |
| Deploy VPS | Docker Compose + Nginx |

## Estrutura

```text
transforma/
|-- backend/
|   |-- Dockerfile
|   |-- server.js
|   `-- src/
|       |-- app.js
|       `-- data/mockData.js
|-- frontend/
|   |-- Dockerfile
|   |-- deploy/nginx/default.conf
|   `-- src/
|-- deploy/
|   `-- nginx/transforma.conf
|-- database/schema.sql
`-- docker-compose.yml
```

## Desenvolvimento local

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local: `http://localhost:5173`  
Backend local: `http://localhost:3001`

## Variaveis do backend

Use [backend/.env.example](/c:/Users/rayll/Desktop/Transforma%20Educação%20PB/transforma/backend/.env.example) como base.

Campos obrigatorios:

- `JWT_SECRET`
- `SEED_ADMIN_PASSWORD`
- `SEED_SUPERVISOR_PASSWORD`
- `SEED_DEFAULT_PASSWORD`

Usuarios mock iniciais:

- `admin@transforma.pb.gov.br`
- `marcos.lima@transforma.pb.gov.br`
- `ana.moura@transforma.pb.gov.br`

As senhas sao definidas no `backend/.env`.

## Subir localmente com Docker Compose

Na raiz do projeto:

```bash
docker compose up --build -d
```

O container web fica publicado em `127.0.0.1:8080`.

Teste:

```bash
curl http://127.0.0.1:8080
curl http://127.0.0.1:8080/api/health
```

Parar:

```bash
docker compose down
```

## Passo a passo para VPS Locaweb

### 1. Preparar a VPS

Assuma Ubuntu 22.04 ou 24.04.

Atualize o sistema:

```bash
sudo apt update && sudo apt upgrade -y
```

Instale Git, Docker, Compose plugin e Nginx:

```bash
sudo apt install -y git ca-certificates curl gnupg nginx
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Depois saia e entre novamente na sessao SSH.

### 2. Clonar o projeto

```bash
cd /opt
sudo git clone https://github.com/ProfRayllon/Transfroma-educa-o-PB.git transforma
sudo chown -R $USER:$USER /opt/transforma
cd /opt/transforma
```

### 3. Criar o arquivo de ambiente do backend

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Ajuste no minimo:

```env
JWT_SECRET=coloque_um_segredo_forte
SEED_ADMIN_PASSWORD=coloque_uma_senha_forte
SEED_SUPERVISOR_PASSWORD=coloque_uma_senha_forte
SEED_DEFAULT_PASSWORD=coloque_uma_senha_forte
CORS_ORIGINS=https://seudominio.com.br,https://www.seudominio.com.br
DATA_MODE=mock
```

### 4. Subir os containers

```bash
docker compose up --build -d
docker compose ps
```

Ver logs:

```bash
docker compose logs -f
```

### 5. Configurar Nginx do host

Copie [deploy/nginx/transforma.conf](/c:/Users/rayll/Desktop/Transforma%20Educação%20PB/transforma/deploy/nginx/transforma.conf) para o Nginx do servidor:

```bash
sudo cp deploy/nginx/transforma.conf /etc/nginx/sites-available/transforma
```

Edite o dominio:

```bash
sudo nano /etc/nginx/sites-available/transforma
```

Troque:

- `exemplo.com.br`
- `www.exemplo.com.br`

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/transforma /etc/nginx/sites-enabled/transforma
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Apontar o dominio

No painel DNS do dominio, crie registros `A` apontando para o IP publico da VPS:

- `@` -> IP da VPS
- `www` -> IP da VPS

### 7. Ativar HTTPS

Instale o Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Emita o certificado:

```bash
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

### 8. Testar

Abra no navegador:

- `https://seudominio.com.br`

Teste login com:

- `admin@transforma.pb.gov.br`
- a senha definida em `SEED_ADMIN_PASSWORD`

## Atualizar a aplicacao na VPS

```bash
cd /opt/transforma
git pull
docker compose up --build -d
```

## Comandos uteis

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

## Banco MySQL

Se quiser migrar de mock para MySQL depois:

```bash
mysql -u root -p < database/schema.sql
```

Depois ajuste no `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=transforma_db
DATA_MODE=mysql
```

Hoje o projeto continua operando em `mock`, que e o caminho mais simples para a primeira subida na VPS.
