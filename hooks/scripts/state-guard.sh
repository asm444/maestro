#!/usr/bin/env bash
# state-guard.sh — Hook Maestro que detecta padrões de secrets em conteúdo de Write
# Retorna exit code 2 (block) se detectar credenciais; 0 (allow) caso contrário

set -euo pipefail

# Lê o input JSON do hook do stdin
INPUT=$(cat)

# Extrai o conteúdo do arquivo sendo escrito (campo 'content' da ferramenta Write)
CONTENT=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tool_input = data.get('tool_input', {})
content = tool_input.get('content', '')
print(content)
" 2>/dev/null || echo "")

# Extrai o caminho do arquivo
FILE_PATH=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tool_input = data.get('tool_input', {})
print(tool_input.get('file_path', ''))
" 2>/dev/null || echo "")

# Não verifica arquivos de relatório e state
if [[ "$FILE_PATH" == *".maestro/reports/"* ]] || \
   [[ "$FILE_PATH" == *"state.json"* ]] || \
   [[ "$FILE_PATH" == *"decisions.log"* ]]; then
  exit 0
fi

# Padrões de secrets a detectar
PATTERNS=(
  'AKIA[A-Z0-9]{16}'
  'password\s*=\s*[^\s$\{][^\s]{3,}'
  'passwd\s*=\s*[^\s$\{][^\s]{3,}'
  'secret\s*=\s*[^\s$\{][^\s]{3,}'
  'token\s*=\s*[^\s$\{][^\s]{8,}'
  'api_key\s*=\s*[^\s$\{][^\s]{8,}'
  'BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY'
  'ghp_[a-zA-Z0-9]{36}'
  'sk-[a-zA-Z0-9]{48}'
  'xoxb-[0-9]+-[a-zA-Z0-9]+'
)

FOUND=0
MATCHED_PATTERN=""

for PATTERN in "${PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qiE "$PATTERN" 2>/dev/null; then
    FOUND=1
    MATCHED_PATTERN="$PATTERN"
    break
  fi
done

if [ "$FOUND" -eq 1 ]; then
  # Retorna JSON de bloqueio para o Claude Code
  # Passa MATCHED_PATTERN via env var para evitar shell injection
  MATCHED_PATTERN="$MATCHED_PATTERN" python3 -c "
import json, os
pattern = os.environ.get('MATCHED_PATTERN', 'unknown')
result = {
  'decision': 'block',
  'reason': f'Maestro Security Guard: Possivel secret detectado. Padrao: {pattern}. Use variaveis de ambiente em vez de credenciais hardcoded.'
}
print(json.dumps(result))
"
  exit 2
fi

exit 0
