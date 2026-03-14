# Maestro Plugin — Claude Code Plugin

## Visão Geral

Plugin Claude Code chamado **"maestro"** — um orquestrador universal multiagente que opera continuamente no terminal para desenvolver projetos de qualquer tipo com máxima eficiência de contexto e mínimo gasto de tokens.

## Papel do Maestro

O Maestro é um **agente orquestrador, não executor principal**. Ele:
- Transforma qualquer objetivo em tarefas pequenas com critério de aceite (DoD)
- Constrói grafo de execução (sequencial e paralelo)
- Roteia cada tarefa para um departamento (subagente) especializado
- Cria "context capsule" mínimo por tarefa
- Coleta entregas, integra alterações, resolve conflitos
- Força validação por QA

## Estado Persistente

Mantido em `.maestro/` dentro do repositório:
- `state.json` — estado atual do ciclo
- `plan.yaml` — plano gerado pelo `maestro plan`
- `decisions.log` — decisões e raciocínio do orquestrador
- `tasks/*.yaml` — tickets individuais
- `reports/` — relatórios de execução e dry-run

## Departamentos (Subagentes)

| Departamento | Escopo |
|---|---|
| Infra/DevOps | Docker, CI/CD, deploy, observabilidade |
| Redes | DNS, TLS, proxy, conectividade, latência |
| Backend | API, serviços, DB, migrations, performance |
| Frontend | UI, componentes, build, state, testes e2e |
| Security | Secrets, CVEs, authn/authz, hardening |
| QA/Verifier | Reprodução de bugs, testes, aprovação/reprovação |
| AgentOps/Prompt | Templates, guardrails, roteamento, métricas |

**Regra**: Nenhum departamento conversa direto com outro. Toda comunicação passa pelo Maestro.

## Políticas Obrigatórias

- Nenhum bugfix sem teste que falha antes e passa depois
- Nenhuma mudança "done" sem build/lint/test executados
- Nunca expor, persistir ou commitar secrets/credenciais
- Cada subagente recebe apenas o contexto mínimo necessário
- QA tem poder de reprovar — reprovação gera novo ticket de correção
- Paralelismo apenas quando fronteiras de arquivos são claras

## CLI

```bash
maestro init              # Cria .maestro/ e detecta stack
maestro plan "<objetivo>" # Gera plan.yaml e tickets
maestro run               # Ciclo completo: dispatch->execute->verify->integrate->report
maestro dispatch <ID>     # Executa somente um ticket
maestro verify            # QA: lint/test/build + security checks
maestro dry-run           # Teste end-to-end com 5 tickets e relatório
```

## Formato de Ticket (YAML)

```yaml
id: string
title: string
priority: high|medium|low
mode: sequential|parallel
repo_paths: [lista de caminhos]
constraints: [lista de restrições]
definition_of_done: [lista de critérios]
tools_allowed: [opcional]
validation_commands: [lista de comandos]
outputs: [lista de artefatos esperados]
```

## Resposta dos Subagentes (JSON)

```json
{
  "touched_files": [],
  "patch_summary": "",
  "commands_run": [],
  "command_results": [],
  "risks": [],
  "next_steps": []
}
```

## Roteamento

| Padrão de Arquivo | Departamento |
|---|---|
| `.github/workflows/*`, `Dockerfile*`, `docker-compose*`, `infra/*` | Infra/DevOps |
| Config TLS/proxy/dns/network | Redes |
| `src/server*`, `api/*`, `backend/*`, `db/*`, migrations | Backend |
| `src/components*`, `frontend/*`, `ui/*` | Frontend |
| Auth, secrets, deps, permissões | Security |
| "teste", "falha", "reprodução", "flaky" | QA |
| Prompts, templates, policy, roteamento | AgentOps |

## Dry-Run (5 Tickets Obrigatórios)

1. **Backend** — Endpoint GET `/health` + teste automatizado
2. **Frontend** — View que chama `/health` e mostra status + teste
3. **Infra** — Pipeline CI local (script) com lint/test/build
4. **Security** — Check para detectar secrets em commits (regex scan)
5. **QA** — Executar pipeline completo, validar DoD, gerar `reports/dry_run.md`

## Implementação

- **Linguagem**: TypeScript/Node.js
- **Estrutura**: Plugin Claude Code com commands, agents, hooks
- **Dependências mínimas**: sem MCP obrigatório — funciona com filesystem local
- **MCPs**: opcionais, utilizados se disponíveis no ambiente

## Arquitetura do Plugin

```
maestro/
├── plugin.json
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/           # Entry points dos comandos
│   ├── core/          # Orquestrador, roteador, state manager
│   ├── agents/        # Adaptadores dos subagentes
│   ├── qa/            # QA verifier
│   └── utils/         # Ticket builder, context capsule
├── commands/          # Slash commands Claude Code
├── agents/            # Agentes Claude Code
└── hooks/             # Hooks Claude Code
```
