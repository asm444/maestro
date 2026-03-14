---
name: ecosystem
description: Mapeamento completo do ecossistema Maestro v2 — skills, plugins, MCPs, hooks e como cada um se integra ao fluxo de orquestracao. Use ao configurar ou diagnosticar o ambiente.
---

# Ecossistema Maestro v2

## Skills Integradas por Departamento

| Departamento | Skills Automaticas | Descricao |
|---|---|---|
| Backend | implementacao-inteligente, tdd, seguranca-cia | Patterns, TDD, CIA |
| Frontend | implementacao-inteligente, tdd, frontend-design | Patterns, TDD, Design |
| Infra/DevOps | implementacao-inteligente, seguranca-cia | IaC, CIA |
| Redes | implementacao-inteligente, seguranca-cia | Config, CIA |
| Security | seguranca-cia, auditoria-codigo | CIA, Dead code |
| QA/Verifier | testagem-inteligente, verification-before-completion | Piramide testes, Evidencia |
| AgentOps | implementacao-inteligente | Patterns |

## Skills do Ciclo de Vida

| Fase | Skill | Quando |
|---|---|---|
| Ideacao | brainstorming | Antes de feature/mudanca |
| Planejamento | writing-plans | Tarefa multi-step |
| Execucao | executing-plans | Executar plano salvo |
| Paralelo | subagent-driven-development | Tasks independentes |
| Debug | systematic-debugging | Qualquer bug |
| Verificacao | verification-before-completion | Antes de "pronto" |
| Review | requesting-code-review | Antes de merge |
| Auditoria | auditoria-codigo | Periodicamente |
| Impacto | analise-impacto | Antes de refatoracao |
| Pesquisa | pesquisa-profunda | Escolha de tecnologia |
| Discovery | discovery | Tecnologias emergentes |

## MCPs e Seus Usos

### Core (Alta prioridade)

| MCP | Ferramentas | Uso no Maestro |
|---|---|---|
| **github** | create_pr, create_issue, search_code | PRs automaticos, issues de escalacao, busca de patterns |
| **docker** | create-container, deploy-compose, get-logs | Build de imagens, deploy, diagnostico |
| **sentry** | search_issues, get_issue_details, search_events | Monitorar erros, diagnostico QA |
| **playwright** | browser_navigate, browser_snapshot, browser_click | Testes E2E, screenshots de validacao |
| **context7** | resolve-library-id, query-docs | Documentacao atualizada de libs |

### Complementares (Media/Baixa prioridade)

| MCP | Ferramentas | Uso no Maestro |
|---|---|---|
| **serena** | find_symbol, get_symbols_overview, find_referencing_symbols | Analise semantica para refactoring |
| **figma** | get_design_context, get_screenshot | Design specs para frontend |
| **semantic-scholar** | search_papers, get_paper_details | Fundamentacao tecnica (pesquisa-profunda) |
| **n8n** | n8n_create_workflow, n8n_list_workflows | Automacao de fluxos |
| **memory** | create_entities, search_nodes | Knowledge graph persistente |
| **apidog** | read_project_oas | API specs para backend |
| **excalidraw** | create_view, export_to_excalidraw | Diagramas de arquitetura |

## Hooks

| Hook | Evento | Acao |
|---|---|---|
| state-guard.sh | PreToolUse (Write) | Bloqueia escrita de secrets |

## Deteccao Dinamica

O modulo `discovery` detecta automaticamente:

1. **Stack**: analisa package.json, requirements.txt, go.mod, Cargo.toml, etc.
2. **MCPs**: le .mcp.json (projeto) e ~/.claude/settings.json (global)
3. **Skills**: escaneia ~/.claude/plugins/*/skills/

Resultado injetado no context capsule de cada ticket.

## Integracao com Fluxo

```
Objetivo do usuario
  -> /maestro-plan analisa com discovery
  -> Tickets gerados com skills automaticas
  -> /maestro-run despacha com context capsule
     -> Capsule inclui: ticket + files + skills + MCPs
  -> Subagente executa usando skills + MCPs disponiveis
  -> QA verifica com testagem-inteligente
  -> Reporter coleta metricas
  -> Ciclo completo com rastreabilidade
```
