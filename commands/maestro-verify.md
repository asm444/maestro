---
name: maestro-verify
description: QA completo — lint, test, build, security scan + DoD check usando verificador v2 com metricas.
---

# /maestro-verify

Execute verificacao completa de qualidade no projeto atual.

## Passos

1. Verifique que `.maestro/` existe. Se nao, execute `/maestro-init` primeiro.

2. Execute o verificador v2:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js verify .
   ```

3. O verificador v2 executa:
   - **Security scan**: regex patterns em todos os arquivos touched
   - **Lint**: comando detectado na stack
   - **Test**: comando de testes da stack
   - **Build**: comando de build da stack
   - **DoD check**: verifica criterios de aceite dos tickets pendentes

4. Para cada estagio:
   - PASSED: informe comando e resultado
   - FAILED: exiba output de erro + analise
   - SKIPPED: nenhum comando detectado
   - SECURITY: findings criticos bloqueiam

5. Determine veredicto geral:
   - **PASSED**: todos passaram (ou skipped)
   - **FAILED**: qualquer estagio falhou
   - **BLOCKED**: security findings criticos

6. Se FAILED ou BLOCKED:
   - Identifique causa raiz pelo output
   - Classifique tipo de erro
   - Sugira proximos passos
   - Ofereca criar ticket de correcao automaticamente

## Saida Esperada

```
=== Maestro v2 Verify ===

security: OK — 0 findings
lint:     PASSED — npm run lint
test:     PASSED — npm test (23 passing)
build:    PASSED — npm run build
dod:      3/3 tickets verified

Metricas: 4.2s total | 0 warnings | 0 criticos

Veredicto: PASSED
```
