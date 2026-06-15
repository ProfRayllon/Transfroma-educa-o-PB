# Transforma Educação PB 2026 — Sistema Administrativo

Sistema web administrativo do Programa Transforma Educação PB 2026.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Banco de dados | MySQL (opcional na v1) |
| Autenticação | JWT + bcrypt |

## Início rápido

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

O servidor inicia em **http://localhost:3001**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O sistema abre em **http://localhost:5173**

---

## Credenciais de acesso (demonstração)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | admin@transforma.pb.gov.br | admin123 |
| Supervisor | marcos.lima@transforma.pb.gov.br | pass123 |
| Professor/Produtor | ana.moura@transforma.pb.gov.br | pass123 |
| Tutor | camila.nunes@transforma.pb.gov.br | pass123 |
| Técnico | lucas.ferreira@transforma.pb.gov.br | pass123 |

---

## Telas do sistema

| Tela | Rota | Descrição |
|------|------|-----------|
| Login | `/login` | Autenticação administrativa |
| Painel | `/painel` | Indicadores (em desenvolvimento) |
| Produção | `/producao` | Gestão de materiais didáticos |
| Gestão de Pessoas | `/gestao-pessoas` | Frequência, atividades, ocorrências |
| Acessos | `/acessos` | Gestão de usuários e permissões |
| Notificações | `/notificacoes` | Central de avisos |
| Perfil | `/perfil` | Dados do usuário logado |

## Perfis e permissões

| Perfil | Produção | Gestão de Pessoas | Acessos |
|--------|----------|-------------------|---------|
| Administrador | Total | Total | Total |
| Supervisor | Aprova materiais | Edita frequência/ocorrências | Visualiza |
| Professor/Produtor | Cria/edita próprios | — | — |
| Tutor | — | Visualiza | — |
| Técnico | — | Visualiza | — |
| Gestão de Pessoas | — | Registra frequência | — |

## Banco de dados MySQL (produção)

```bash
# Criar banco e tabelas
mysql -u root -p < database/schema.sql

# Configurar .env do backend
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=transforma_db
DATA_MODE=mysql
```

## Estrutura do projeto

```
transforma/
├── backend/
│   ├── server.js          # API Express
│   ├── .env.example
│   └── src/
│       └── data/
│           └── mockData.js
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── context/AuthContext.jsx
│       ├── data/mockData.js
│       ├── components/
│       │   ├── layout/    (Sidebar, Header, Layout)
│       │   └── ui/        (Badge, StatCard, Modal, ConfirmDialog)
│       └── pages/
│           ├── Login.jsx
│           ├── Painel.jsx
│           ├── Producao.jsx
│           ├── GestaoPessoas.jsx
│           ├── Acessos.jsx
│           ├── Notificacoes.jsx
│           └── Perfil.jsx
└── database/
    └── schema.sql
```
