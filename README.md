# Maestro — Plugin Claude Code

Orquestrador universal multiagente para Claude Code. Transforma qualquer objetivo em tarefas verificáveis, roteia para departamentos especializados e valida tudo via QA.

## Instalação

```bash
claude plugin install /caminho/para/maestro
```

## Uso Rápido

```bash
# 1. Inicialize no seu projeto
/maestro-init

# 2. Gere um plano
/maestro-plan "Implementar autenticação JWT com refresh tokens"

# 3. Execute o ciclo completo
/maestro-run

# 4. Validação end-to-end (primeira vez)
/maestro-dry-run
```

## CLI (sem AI)

```bash
maestro init              # Inicializa .maestro/
maestro status            # Estado atual
maestro verify            # lint + test + build
maestro dispatch DRY-001  # Context capsule de um ticket
```

## Departamentos

| Departamento | Escopo |
|---|---|
| `backend` | APIs, serviços, DB, migrations |
| `frontend` | UI, componentes, build, E2E |
| `infra-devops` | Docker, CI/CD, deploy |
| `security` | Secrets, CVEs, authn/authz |
| `qa-verifier` | Testes, aprovação/reprovação |
| `redes` | DNS, TLS, proxy, conectividade |
| `agentops` | Prompts, guardrails, métricas |

## Estado Persistente

```
.maestro/
├── state.json       # Estado do ciclo atual
├── plan.yaml        # Plano gerado
├── decisions.log    # Log de decisões
├── tasks/*.yaml     # Tickets individuais
└── reports/         # Relatórios de execução
```

## Políticas

- Nenhum bugfix sem teste que falha antes e passa depois
- Nenhuma mudança "done" sem lint/test/build executados
- Nunca expor secrets — hook `state-guard.sh` bloqueia automaticamente
- QA tem poder de veto — reprovação gera ticket de correção automático
- Cada agente recebe apenas o contexto mínimo necessário

## Dry-Run

Valida o pipeline completo com 5 tickets obrigatórios:

| Ticket | Departamento | O que faz |
|---|---|---|
| DRY-001 | backend | GET /health + teste |
| DRY-002 | frontend | HTML view + teste |
| DRY-003 | infra-devops | ci.sh + GitHub Actions |
| DRY-004 | security | script de secret scan |
| DRY-005 | qa-verifier | Verifica DoD de todos |

## Arquitetura

```
maestro/
├── .claude-plugin/plugin.json   # Manifesto Claude Code
├── commands/                    # Slash commands (Markdown)
├── agents/                      # Subagentes por departamento (Markdown)
├── skills/                      # Knowledge base (Markdown)
├── hooks/                       # Proteção de secrets
├── scripts/                     # Motor Node.js (zero deps)
└── bin/maestro                  # CLI wrapper
```
