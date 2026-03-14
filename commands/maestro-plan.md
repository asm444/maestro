---
name: maestro-plan
description: Gera plano de execucao com tickets tipados a partir de um objetivo. Usa templates (feature, bugfix, refactor, migration) + personalizacao por contexto.
---

# /maestro-plan $ARGUMENTS

Crie um plano de execucao para o objetivo: **$ARGUMENTS**

## Passos

1. Verifique que `.maestro/` existe. Se nao, execute init:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js init .
   ```

2. Execute discovery para contexto atualizado:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js discover .
   ```

3. Analise o objetivo: **$ARGUMENTS**
   - Classifique o tipo: feature | bugfix | refactor | migration
   - Se ambiguo, pergunte ao usuario

4. O planner v2 usa templates hibridos:
   - Template base define estrutura de tickets por tipo
   - Contexto do codebase personaliza repo_paths, constraints, validation_commands
   - Skills sao injetadas automaticamente por departamento

5. Para cada ticket gerado:
   - Roteamento automatico por file patterns + keywords
   - Skills obrigatorias injetadas (DEPARTMENT_SKILLS)
   - MCPs disponiveis incluidos no context capsule
   - DoD verificavel com comandos concretos

6. Escreva tickets em `.maestro/tasks/<ID>.yaml`

7. Escreva plano consolidado em `.maestro/plan.yaml` com fases:
   ```yaml
   objective: "$ARGUMENTS"
   created_at: "2026-03-14T..."
   phases:
     - name: "Fase 1: Preparacao"
       mode: sequential
       ticket_ids: [TICKET-001]
     - name: "Fase 2: Implementacao"
       mode: parallel
       ticket_ids: [TICKET-002, TICKET-003]
     - name: "Fase 3: Verificacao"
       mode: sequential
       ticket_ids: [TICKET-004]
   ```

8. Apresente ao usuario:
   - Objetivo e tipo detectado
   - Lista de tickets (ID, titulo, departamento, modo, skills)
   - Grafo de execucao (fases sequenciais/paralelas)
   - MCPs que serao utilizados
   - Pergunte se deseja executar com `/maestro-run`

## Templates Disponiveis

| Tipo | Tickets Gerados |
|---|---|
| feature | backend + frontend + security review + QA |
| bugfix | reproducao (QA) + fix (dept) + verificacao (QA) |
| refactor | analise + implementacao + regressao (QA) |
| migration | backup (infra) + migracao (backend) + verificacao (QA) + rollback (infra) |

## Principios

- **Granularidade**: cada ticket executavel em uma sessao de agente
- **Testabilidade**: todo ticket tem DoD com comandos verificaveis
- **Isolamento**: repo_paths de tickets paralelos NAO se sobrepoem
- **Skills**: cada departamento recebe skills automaticas (TDD, seguranca, etc.)
