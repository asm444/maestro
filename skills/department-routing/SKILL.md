---
name: department-routing
description: Regras de roteamento v2 do Maestro — departamento + skills automaticas + MCPs recomendados. Use ao planejar ou despachar tickets.
---

# Regras de Roteamento v2 por Departamento

## Tabela de Roteamento por Arquivo

| Padrao de Arquivo | Departamento |
|---|---|
| `.github/workflows/*`, `Dockerfile*`, `docker-compose*`, `infra/*`, `Makefile` | `infra-devops` |
| `nginx.conf`, `caddy*`, `traefik*`, `*tls.*`, `*ssl.*`, `*proxy*`, `*network*` | `redes` |
| `src/server*`, `api/*`, `backend/*`, `db/*`, `migrations/*`, `routes/*`, `controllers/*`, `services/*` | `backend` |
| `src/components*`, `frontend/*`, `ui/*`, `pages/*`, `views/*`, `*.css`, `*.vue`, `*.svelte` | `frontend` |
| `*auth*`, `.env*`, `secrets/*`, `credentials/*`, `package-lock.json`, `yarn.lock` | `security` |
| `*.test.*`, `*.spec.*`, `test/*`, `__tests__/*`, `cypress/*`, `playwright/*` | `qa-verifier` |
| `prompts/*`, `templates/*`, `*policy*`, `*guardrail*`, `agents/*` | `agentops` |

## Roteamento por Palavras-Chave

| Palavras-chave | Departamento |
|---|---|
| teste, falha, reproducao, flaky, bug, fix, verificar, validar | `qa-verifier` |
| secret, credential, auth, cve, vuln, permission, hardening, scan | `security` |
| docker, ci, cd, deploy, pipeline, workflow, build, infra | `infra-devops` |
| api, endpoint, database, migration, server, backend, service | `backend` |
| ui, component, view, page, frontend, css, html | `frontend` |
| dns, tls, ssl, proxy, nginx, rede, network, latencia | `redes` |
| prompt, template, routing, agentops, guardrail, metric | `agentops` |

## Algoritmo de Roteamento

1. **Por arquivos** (prioridade alta): conta matches de repo_paths
2. **Por palavras-chave** (fallback): analisa title do ticket
3. **Explicito no ticket** (fallback 2): usa department se declarado
4. **Default**: `backend`

## Skills Automaticas por Departamento (NOVO v2)

| Departamento | Skills | MCPs Recomendados |
|---|---|---|
| `backend` | implementacao-inteligente, tdd, seguranca-cia | github, docker, sentry, context7 |
| `frontend` | implementacao-inteligente, tdd, frontend-design | figma, playwright, context7 |
| `infra-devops` | implementacao-inteligente, seguranca-cia | docker, github, sentry |
| `redes` | implementacao-inteligente, seguranca-cia | — |
| `security` | seguranca-cia, auditoria-codigo | sentry, github |
| `qa-verifier` | testagem-inteligente, verification-before-completion | playwright, sentry |
| `agentops` | implementacao-inteligente | — |

O router v2 injeta automaticamente:
- `skills_required` baseado no departamento
- `mcp_available` baseado na deteccao dinamica

## Capacidades por Departamento

### `infra-devops`
- Docker, compose, Kubernetes
- CI/CD: GitHub Actions, GitLab CI, Jenkins
- Deploy scripts, IaC (Terraform, Ansible)
- Observabilidade: logs, metricas, alertas

### `redes`
- DNS (A, AAAA, CNAME, MX, TXT)
- TLS/SSL, Let's Encrypt
- Reverse proxy (nginx, caddy, traefik)
- Diagnostico de conectividade

### `backend`
- APIs REST/GraphQL
- Node.js, Python, Go, Java, Ruby, Rust
- DB: queries, schemas, migrations
- Performance: caching, indices

### `frontend`
- React, Vue, Svelte, Angular, HTML/CSS
- Build: Vite, Webpack, esbuild
- State: Redux, Zustand, Pinia
- Testes E2E: Cypress, Playwright

### `security`
- Deteccao de secrets e credenciais
- CVEs em dependencias
- AuthN/AuthZ (JWT, OAuth, RBAC)
- Hardening, CORS, CSP

### `qa-verifier`
- Reproducao e verificacao de bugs
- Testes unit/integracao/E2E
- Aprovacao/reprovacao de tickets
- Relatorios de QA

### `agentops`
- Templates de prompt
- Guardrails e politicas
- Metricas de agentes
- Otimizacao de roteamento
