#!/usr/bin/env bash
# Roda a verificação completa do reembolso.ia.br: testes unitários + health-check.
# Uso:
#   scripts/run-checks.sh                      # testes + health-check em produção
#   HEALTHCHECK_URL=<url> scripts/run-checks.sh  # aponta para outra URL (ex.: preview)
#
# Requer: bun (vitest), curl. jq é opcional (só embeleza a saída).
set -euo pipefail

URL="${HEALTHCHECK_URL:-https://reembolso-inteligente.lovable.app/api/public/hooks/health-check}"
APIKEY="${SUPABASE_PUBLISHABLE_KEY:-}"

echo "==> 1/2 Testes unitários (vitest)"
bunx vitest run

echo
echo "==> 2/2 Health-check de consistência: $URL"
if [[ -z "$APIKEY" ]]; then
  echo "AVISO: defina SUPABASE_PUBLISHABLE_KEY para autenticar o health-check." >&2
fi

HTTP_CODE=$(curl -s -o /tmp/healthcheck.json -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: ${APIKEY}" \
  "$URL" || true)

if command -v jq >/dev/null 2>&1; then
  jq . /tmp/healthcheck.json || cat /tmp/healthcheck.json
else
  cat /tmp/healthcheck.json
fi
echo

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ Health-check OK (HTTP $HTTP_CODE)."
else
  echo "❌ Health-check reportou problema (HTTP $HTTP_CODE). O admin foi avisado por e-mail." >&2
  exit 1
fi
