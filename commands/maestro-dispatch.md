---
name: maestro-dispatch
description: Executa um unico ticket por ID com context capsule enriquecido (skills + MCPs + retry context).
---

# /maestro-dispatch $ARGUMENTS

Execute o ticket com ID: **$ARGUMENTS**

## Passos

1. Verifique que `.maestro/` existe. Se nao, peca `/maestro-init` primeiro.

2. Obtenha o context capsule enriquecido:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . $ARGUMENTS
   ```

3. O capsule v2 inclui:
   - Ticket YAML completo
   - Conteudo dos repo_paths existentes
   - Skills obrigatorias do departamento
   - MCPs disponiveis no ambiente
   - Retry context (se ja houve falha anterior)

4. Despache para o agente correto via Task:
   - `backend` -> `maestro-backend`
   - `frontend` -> `maestro-frontend`
   - `infra-devops` -> `maestro-infra-devops`
   - `security` -> `maestro-security`
   - `qa-verifier` -> `maestro-qa-verifier`
   - `redes` -> `maestro-redes`
   - `agentops` -> `maestro-agentops`

5. Aguarde resposta JSON do agente.

6. Execute verificacao automatica:
   - Security scan nos touched_files
   - DoD check
   - Validation commands

7. Se verificacao falhou e retries < 2:
   - Analise erro e enriqueca capsule
   - Re-dispatch automaticamente

8. Atualize estado e informe ao usuario:
   - Ticket ID, departamento, status
   - Arquivos tocados
   - Skills invocadas
   - Resultado da verificacao

## Tratamento de Erros

- Ticket nao encontrado: liste os disponiveis em `.maestro/tasks/`
- JSON invalido do agente: mostre resposta bruta, peca decisao ao usuario
- Timeout: marque como failed, sugira retry com contexto expandido
