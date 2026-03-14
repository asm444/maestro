---
name: maestro-init
description: Inicializa o Maestro v2 no repositorio atual — cria .maestro/, detecta stack, MCPs e skills disponiveis.
---

# /maestro-init

Inicialize o Maestro v2 no repositorio atual.

## Passos

1. Determine o diretorio raiz do repositorio atual (use `pwd` ou verifique `.git/`)

2. Execute o script de inicializacao:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js init .
   ```

3. O init v2 executa:
   - Cria `.maestro/` com subdiretorios (tasks/, reports/)
   - Detecta stack (linguagens, frameworks, build tools)
   - Detecta MCPs disponiveis (projeto + globais)
   - Detecta skills instaladas
   - Salva resultado em `.maestro/state.json`

4. Confirme ao usuario:
   - Stack detectada (linguagens, frameworks)
   - MCPs encontrados (nome, tipo, status)
   - Skills disponiveis
   - Comandos de lint/test/build identificados

5. Se `.maestro/` ja existir, leia o estado atual e ofereca re-detectar (discovery refresh).

## Saida Esperada

```
=== Maestro v2 Init ===

Stack: node, typescript, react
Frameworks: next.js, express
Build: npm run build | Test: npm test | Lint: npm run lint

MCPs Detectados (5):
  - github (stdio) ✓
  - docker (stdio) ✓
  - sentry (stdio) ✓
  - context7 (stdio) ✓
  - playwright (stdio) ✓

Skills Disponiveis: 12
  - tdd, seguranca-cia, implementacao-inteligente, ...

Maestro inicializado em .maestro/
Use /maestro-plan "<objetivo>" para criar um plano.
```
