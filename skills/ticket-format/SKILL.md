---
name: ticket-format
description: Schema canonico do formato de ticket YAML v2 do Maestro. Inclui campos de skills, MCPs, retry e escalacao. Use ao criar, validar ou interpretar tickets.
---

# Formato de Ticket Maestro v2

## Schema Completo

```yaml
id: string                    # Identificador unico (ex: FEAT-001, DRY-003)
title: string                 # Titulo descritivo (max 80 chars)
priority: high|medium|low     # Prioridade (padrao: medium)
mode: sequential|parallel     # Modo de execucao (padrao: sequential)
department: string            # Departamento responsavel
repo_paths:                   # Arquivos/diretorios que o agente pode tocar
  - path/to/file.js
constraints:                  # Restricoes obrigatorias
  - "Sem dependencias externas"
definition_of_done:           # Criterios verificaveis de conclusao
  - "GET /health retorna 200"
skills_required:              # Skills injetadas automaticamente pelo departamento
  - implementacao-inteligente
  - tdd
  - seguranca-cia
tools_allowed:                # (Opcional) ferramentas permitidas
  - Read
  - Write
  - Bash
validation_commands:          # Comandos para validar DoD
  - node --test test/foo.test.js
outputs:                      # Artefatos esperados
  - src/foo.js
  - test/foo.test.js
depends_on:                   # (Opcional) IDs de tickets que devem completar antes
  - FEAT-001
status: pending|in_progress|completed|failed|retrying|escalated
retries: 0                    # Contador de retries (gerenciado pelo orchestrator)
error_history: []             # Historico de erros (gerenciado pelo retry-engine)
created_at: ISO8601           # Preenchido automaticamente
```

## Campos Obrigatorios

- `id` — unico no plano
- `title` — maximo 80 caracteres
- `definition_of_done` — pelo menos 1 criterio verificavel
- `validation_commands` — pelo menos 1 comando que valida o DoD

## Campos Auto-Injetados

- `skills_required` — preenchido pelo router baseado no departamento (DEPARTMENT_SKILLS)
- `status` — gerenciado pelo orchestrator
- `retries` — incrementado pelo retry-engine
- `error_history` — populado pelo retry-engine em cada falha

## Context Capsule v2

O context capsule montado pelo dispatcher inclui:

```
## Ticket
<ticket YAML completo>

## Arquivos Existentes
<conteudo dos repo_paths que existem>

## Skills Obrigatorias
<prompt de skills baseado em skills_required>

## MCPs Disponiveis
<lista de MCPs detectados no ambiente>

## Retry Context (se aplicavel)
Tentativa: N de M
Erro anterior: <mensagem>
Analise: <classificacao do erro>
Sugestao: <abordagem alternativa>
```

## Resposta do Subagente (JSON v2)

```json
{
  "touched_files": ["src/foo.js", "test/foo.test.js"],
  "patch_summary": "Descricao concisa do que foi implementado",
  "commands_run": ["node --test test/foo.test.js"],
  "command_results": [
    {
      "command": "node --test test/foo.test.js",
      "exit_code": 0,
      "stdout": "1 passing",
      "stderr": ""
    }
  ],
  "risks": ["Servidor usa porta 3000 hardcoded"],
  "next_steps": []
}
```

## Tipos de Template

| Tipo | Tickets Gerados |
|---|---|
| feature | backend + frontend + security review + QA |
| bugfix | reproducao (QA) + fix (dept) + verificacao (QA) |
| refactor | analise + implementacao + regressao (QA) |
| migration | backup (infra) + migracao (backend) + verificacao (QA) + rollback (infra) |
| dry-run | 5 tickets padrao (backend, frontend, infra, security, QA) |
