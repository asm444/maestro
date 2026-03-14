---
name: maestro-setup
description: Configuracao interativa do ecossistema Maestro — detecta e configura MCPs, skills, hooks e CLAUDE.md para o projeto atual.
---

# /maestro-setup

Configure o ecossistema completo do Maestro v2 interativamente.

## Objetivo

Detectar o ambiente atual, identificar MCPs/skills/hooks disponiveis, e configurar tudo para maximo aproveitamento do Maestro.

## Passos

### 1. Discovery Completo

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js discover .
```

Apresente ao usuario:
- Stack detectada
- MCPs encontrados (projeto + globais)
- Skills instaladas
- Hooks ativos

### 2. MCPs — Verificacao e Recomendacao

MCPs recomendados para o Maestro:

| MCP | Uso | Prioridade |
|---|---|---|
| github | PRs, issues, code search | Alta |
| docker | Containers, compose, logs | Media |
| sentry | Erros, monitoring, tracing | Media |
| playwright | Testes E2E, screenshots | Media |
| context7 | Documentacao de libs | Baixa |
| serena | Analise semantica de codigo | Baixa |
| figma | Design to code | Baixa |
| semantic-scholar | Papers academicos | Baixa |
| n8n | Workflows de automacao | Baixa |

Para cada MCP:
- **Encontrado**: informe e marque como disponivel
- **Nao encontrado mas recomendado**: ofereca instrucoes de instalacao
- **Nao encontrado e opcional**: mencione como opcional

### 3. Skills — Verificacao

Skills core que o Maestro usa internamente:

| Skill | Departamento | Descricao |
|---|---|---|
| implementacao-inteligente | Todos | Patterns que previnem problemas |
| tdd | Backend, Frontend | Test-driven development |
| seguranca-cia | Backend, Infra, Security, Redes | Triade CIA |
| frontend-design | Frontend | Design de interfaces |
| testagem-inteligente | QA | Framework de testes |
| verification-before-completion | QA | Verificacao antes de "pronto" |
| auditoria-codigo | Security | Dead code, vulnerabilidades |

Informe quais estao instaladas e quais sao built-in.

### 4. Hooks de Seguranca

Verifique se os hooks do Maestro estao ativos:
- `state-guard.sh` — bloqueio de secrets em Write

### 5. Perfil do Usuario (Opcional)

Pergunte se deseja salvar perfil pessoal:
- MCPs preferidos
- Skills extras
- Configuracoes customizadas

Salve em `installer/my-setup.json` para uso futuro.

### 6. Relatorio de Setup

Gere relatorio final:
```
=== Maestro v2 Setup ===

Stack: node, typescript, react
MCPs: 5/9 configurados (github, docker, sentry, playwright, context7)
Skills: 7/7 disponiveis
Hooks: state-guard ativo

Recomendacoes:
- Instalar MCP serena para analise semantica
- Configurar Sentry para monitoring de erros

Setup completo! Use /maestro-plan "<objetivo>" para comecar.
```
