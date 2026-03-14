---
name: maestro-run
description: Ciclo completo do Maestro v2 — dispatch -> execute -> verify -> retry/escalate -> report. Com retry inteligente e escalacao QA.
---

# /maestro-run

Execute o ciclo completo do Maestro v2 para o plano atual.

## Pre-requisitos

Verifique que `.maestro/plan.yaml` e `.maestro/tasks/` existem:
```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js status .
```
Se nao houver plano, instrua: `/maestro-plan "<objetivo>"` primeiro.

## Ciclo de Execucao

### Fase 1: Leitura do Plano + Discovery

1. Leia `.maestro/plan.yaml`
2. Execute discovery para MCPs e skills atualizados
3. Emita evento `cycle:started`

### Fase 2: Execucao por Fases

Para cada fase do plano:

**Se mode = sequential:**
- Execute tickets um por vez na ordem

**Se mode = parallel:**
- Verifique que repo_paths nao se sobrepoem
- Despache simultaneamente com multiplas chamadas Task
- Se houver sobreposicao: degrade para sequential

### Fase 3: Dispatch com Context Capsule

Para cada ticket:

1. Monte context capsule:
   - Ticket YAML completo
   - Conteudo dos repo_paths existentes
   - Skills obrigatorias do departamento
   - MCPs disponiveis
   - Retry context (se aplicavel)

2. Despache para o agente correto via Task:
   - `backend` -> `maestro-backend`
   - `frontend` -> `maestro-frontend`
   - `infra-devops` -> `maestro-infra-devops`
   - `security` -> `maestro-security`
   - `qa-verifier` -> `maestro-qa-verifier`
   - `redes` -> `maestro-redes`
   - `agentops` -> `maestro-agentops`

3. Aguarde resposta JSON do agente.

### Fase 4: Verificacao + Retry Inteligente

Apos cada ticket:

1. Execute verificacao:
   - Security scan nos touched_files
   - DoD checker
   - Validation commands

2. Se PASSOU: marque completed, emita `ticket:completed`

3. Se FALHOU (retry < 2):
   - Analise o erro (tipo: syntax, test_failure, build_error, timeout)
   - Enriqueca context capsule com:
     - Erro anterior + stack trace
     - Analise do que deu errado
     - Sugestao de abordagem alternativa
   - Re-dispatch para mesmo agente
   - Emita `ticket:retrying`

4. Se FALHOU (retry >= 2): Escalacao QA
   - Crie ticket de diagnostico para qa-verifier
   - QA analisa e cria sub-ticket de correcao
   - Sub-ticket roteado para departamento correto
   - Emita `ticket:escalated`

### Fase 5: Relatorio Final

Apos todos os tickets:

1. Colete metricas:
   - Duracao por ticket e total
   - Taxa sucesso/falha/retry/escalacao
   - Arquivos tocados, skills invocadas, MCPs usados

2. Gere relatorio:
   - `.maestro/reports/cycle_<id>.md` (Markdown detalhado)
   - `.maestro/reports/cycle_<id>.json` (metricas)
   - Append em `.maestro/metrics.json`

3. Emita `cycle:completed`

4. Apresente ao usuario:
   - Resumo: X aprovados, Y falhos, Z retries, W escalados
   - Arquivos modificados
   - Riscos identificados
   - Proximos passos
