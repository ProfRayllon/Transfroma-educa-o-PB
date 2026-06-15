# Transforma Educacao PB 2026 - Sistema Administrativo

Sistema web administrativo do Programa Transforma Educacao PB 2026.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Banco de dados | MySQL (opcional na v1) |
| Autenticacao | JWT + bcrypt |

## Inicio rapido

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Antes de iniciar, configure no `backend/.env`:

```bash
JWT_SECRET=sua_chave_jwt_forte
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
SEED_ADMIN_PASSWORD=sua_senha_inicial_admin
SEED_SUPERVISOR_PASSWORD=sua_senha_inicial_supervisor
SEED_DEFAULT_PASSWORD=sua_senha_inicial_demais_perfis
```

Depois rode:

```bash
npm run dev
```

O servidor inicia em `http://localhost:3001`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O sistema abre em `http://localhost:5173`.

## Acesso inicial

As credenciais de bootstrap nao ficam mais versionadas no repositorio.

Use os usuarios mock ja cadastrados no backend, por exemplo:

- `admin@transforma.pb.gov.br`
- `marcos.lima@transforma.pb.gov.br`
- `ana.moura@transforma.pb.gov.br`

As senhas desses perfis sao definidas apenas no seu `backend/.env`.

## Telas do sistema

| Tela | Rota | Descricao |
|------|------|-----------|
| Login | `/login` | Autenticacao administrativa |
| Painel | `/painel` | Indicadores |
| Producao | `/producao` | Gestao de materiais didaticos |
| Gestao de Pessoas | `/gestao-pessoas` | Frequencia, atividades e ocorrencias |
| Acessos | `/acessos` | Gestao de usuarios e permissoes |
| Notificacoes | `/notificacoes` | Central de avisos |
| Perfil | `/perfil` | Dados do usuario logado |

## Banco de dados MySQL (producao)

```bash
mysql -u root -p < database/schema.sql
```

Exemplo de configuracao:

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=transforma_db
DATA_MODE=mysql
```

## Seguranca antes do deploy

- Nao publique `backend/.env`.
- Configure `JWT_SECRET` e senhas seed com valores fortes.
- Ajuste `CORS_ORIGINS` para a URL real do frontend.
- Valide em staging/preview antes de ativar deploy automatico em producao.

## Deploy inicial no Render

O repositorio ja inclui um arquivo [render.yaml](/c:/Users/rayll/Desktop/Transforma%20Educação%20PB/transforma/render.yaml) para subir:

- `transforma-api` como Web Service Node
- `transforma-web` como Static Site Vite

O `autoDeployTrigger` foi deixado como `off` nos dois servicos para o primeiro deploy ser manual.

### Passos

1. No Render, escolha **New > Blueprint** e conecte este repositorio.
2. Confirme a leitura do `render.yaml`.
3. Informe os valores pedidos para:
   `SEED_ADMIN_PASSWORD`, `SEED_SUPERVISOR_PASSWORD` e `SEED_DEFAULT_PASSWORD`.
4. Execute o primeiro deploy manual.
5. Teste o login e as telas principais usando as URLs `onrender.com`.

### Observacoes

- O frontend recebe `VITE_API_BASE_URL` apontando para a URL publica do backend.
- O backend recebe `CORS_ORIGINS` apontando para a URL publica do frontend.
- Se voce trocar para dominio proprio depois, atualize `CORS_ORIGINS` no backend para incluir o novo dominio do frontend.
- Quando estiver estavel, voce pode mudar `autoDeployTrigger` para `checksPass` ou `commit`.

## Estrutura do projeto

```text
transforma/
|-- backend/
|   |-- server.js
|   |-- .env.example
|   `-- src/
|       `-- data/
|           `-- mockData.js
|-- frontend/
|   |-- index.html
|   |-- vite.config.js
|   |-- tailwind.config.js
|   `-- src/
|       |-- App.jsx
|       |-- context/
|       |-- data/
|       |-- components/
|       `-- pages/
`-- database/
    `-- schema.sql
```
