# Nexia — Autodisparador de Mensagens

Plataforma de disparo em massa de mensagens WhatsApp via múltiplas APIs (UnoAPI, Evolution, Evolution Go, WuzAPI, Chatwoot).

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                              │
│                          │                               │
│                    [Traefik] (proxy reverso + SSL)        │
│                     ╱        ╲                          │
│                    /          \                          │
│    disparador.seu-dominio.com   pgadmin-disparador.seu-  │
│           │                      dominio.com             │
│      ┌────┴─────┐              ┌────┴─────┐             │
│      │  frontend │              │  pgadmin  │             │
│      │ (nginx:80)│              │  (:80)    │             │
│      └────┬─────┘              └────┬─────┘             │
│           │                         │                    │
│           └──────────┬──────────────┘                    │
│                      │  rede interna: app-network         │
│                 ┌────┴────┐                               │
│                 │ backend  │                               │
│                 │ (:3000)  │                               │
│                 └────┬────┘                               │
│                      │                                    │
│                 ┌────┴────┐                               │
│                 │   db    │                                │
│                 │(:5432)  │                               │
│                 └─────────┘                               │
└─────────────────────────────────────────────────────────┘
```

## Stack

| Serviço | Tecnologia | Função |
|---------|-----------|--------|
| **frontend** | React + Vite + Nginx | Interface do usuário (SPA) |
| **backend** | Fastify + Prisma + TypeScript | API REST + proxy para APIs de WhatsApp |
| **db** | PostgreSQL 16 | Banco de dados |
| **pgadmin** | pgAdmin 4 | Gerenciamento visual do banco |

## Pré-requisitos

- Docker e Docker Compose na VPS
- Traefik configurado como proxy reverso com rede `traefik-public`
- Domínios apontando para a VPS:
  - `disparador.seu-dominio.com` (aplicação)
  - `pgadmin-disparador.seu-dominio.com` (pgAdmin)

## Deploy na VPS

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/autodisparadormensagem.git /opt/stacks/autodisparadormensagem
cd /opt/stacks/autodisparadormensagem

# 2. Configure as variáveis de ambiente
cp .env.example .env
nano .env
# Preencha: POSTGRES_PASSWORD, JWT_SECRET, PGADMIN_EMAIL, PGADMIN_PASSWORD

# 3. Suba a stack
docker compose pull
docker compose up -d

# 4. Execute as migrations do banco
docker compose exec backend npx prisma migrate deploy

# 5. Verifique os logs
docker compose logs -f
```

## Desenvolvimento Local

```bash
# Terminal 1: Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Terminal 2: Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## CI/CD

O workflow do GitHub Actions (`.github/workflows/deploy.yml`):

1. **Build**: Nos runners do GitHub, faz o build das imagens Docker do frontend e backend
2. **Push**: Publica as imagens no GitHub Container Registry (ghcr.io) com tags `latest` e `sha-<commit>`
3. **Deploy**: Via SSH na VPS, faz pull das novas imagens e executa `docker compose up -d`

### Secrets necessários no GitHub

| Secret | Descrição |
|--------|-----------|
| `VPS_HOST` | IP ou domínio da VPS |
| `VPS_USER` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada SSH |

## Configuração Inicial

Após o deploy, acesse `https://disparador.seu-dominio.com` e vá em **Configurações**:

1. **UnoAPI** — URL + Token da sua instância UnoAPI
2. **Evolution API** — URL + API Key da Evolution
3. **Evolution Go** — URL + API Key do Evolution Go
4. **Chatwoot** — URL + Token + Account ID
5. **WuzAPI** — URL base + Admin Token + crie instâncias
6. **AI Gateway** — API Key do provedor de IA

## Variáveis de Ambiente

### `.env` (raiz — usado pelo docker-compose)

| Variável | Descrição |
|----------|-----------|
| `POSTGRES_USER` | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `POSTGRES_DB` | Nome do banco |
| `JWT_SECRET` | Chave secreta para JWT (mín. 32 caracteres) |
| `PGADMIN_EMAIL` | Email de login do pgAdmin |
| `PGADMIN_PASSWORD` | Senha do pgAdmin |

### `backend/.env`

| Variável | Descrição | Default |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | — |
| `JWT_SECRET` | Chave secreta JWT | — |
| `JWT_EXPIRES_IN` | Expiração do token | `7d` |
| `PORT` | Porta do servidor | `3000` |

### `frontend/.env`

| Variável | Descrição | Default |
|----------|-----------|---------|
| `VITE_API_URL` | URL base da API (usa proxy nginx em produção) | `/api` |

## Tecnologias

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Fastify + Prisma + TypeScript + PostgreSQL
- **Infra**: Docker Compose + Traefik + GitHub Container Registry
