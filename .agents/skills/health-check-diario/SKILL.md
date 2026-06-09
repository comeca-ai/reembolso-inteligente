---
name: health-check-diario
description: Verificação de consistência e testes do reembolso.ia.br. Use ao iniciar o dia/sessão, antes de publicar, ou quando o usuário pedir para checar se "está tudo funcionando", "as coisas não podem parar/sumir", rodar testes unitários, ou conferir a saúde do sistema. Avisa o admin (jhonata.emerick@gmail.com) quando algo crítico falha.
---

# Health-check diário — reembolso.ia.br

Garante consistência: nada de método quebrar e "sumir do nada". Rode **cedo, no
início de cada sessão de trabalho** e **sempre antes de publicar**.

## Quando rodar

- Início do dia / nova sessão de trabalho.
- Antes de qualquer publicação (publish).
- Depois de mexer em: webhooks (`/api/public/*`), RPCs de roteamento, convites,
  reembolsos, auth, ou migrações de banco.
- Quando o usuário relatar que algo "parou", "sumiu" ou está inconsistente.

## Passo a passo

1. **Testes unitários** — rode a suíte e confirme que está 100% verde:
   ```bash
   bunx vitest run
   ```
   Se algo falhar, NÃO publique. Investigue e corrija antes de seguir.

2. **Consistência dos métodos críticos** — dispare o health-check do app
   (banco, RPCs de webhook, Storage, IA, e-mail). Em preview ou produção:
   ```bash
   # produção (estável)
   curl -s -X POST \
     -H "apikey: <SUPABASE_PUBLISHABLE_KEY>" \
     https://reembolso-inteligente.lovable.app/api/public/hooks/health-check | jq .
   ```
   - HTTP 200 + `report.healthy: true` → tudo certo.
   - HTTP 503 ou `report.healthy: false` → há falha; veja `report.checks` para o
     item com `status: "fail"`.
   - Use o atalho `scripts/run-checks.sh` (roda os dois passos de uma vez).

3. **Avisar o admin** — o próprio endpoint envia e-mail para
   `jhonata.emerick@gmail.com` automaticamente quando há falha. Há também um
   agendamento (pg_cron) que roda às **06h (horário de Brasília)** todo dia e
   avisa sozinho. Se você descobrir uma falha fora desse horário e quiser forçar
   o aviso, faça `POST` com corpo `{"force": true}`.

## O que cada check cobre

- **Banco**: `companies`, `profiles`, `inbound_reimbursements`, `despesas`, `policies` respondem.
- **RPCs de roteamento**: `resolve_company_by_sender_whatsapp`, `resolve_company_by_instance`, `resolve_company_by_whatsapp` existem e respondem.
- **Storage**: buckets `policies`, `comprovantes`, `cartoes-cnpj` existem.
- **Integrações**: `LOVABLE_API_KEY` (IA), `SMTP2GO_API_KEY` (e-mail), `DESPESAS_WEBHOOK_TOKEN`.
- **Config**: ao menos uma empresa com WhatsApp/instância (senão despesas não roteiam).

## Regras

- Falha em teste unitário ou check crítico **bloqueia publicação**.
- Não desabilite um check para "passar"; corrija a causa.
- Ao adicionar tabela/RPC/bucket/integração crítica nova, adicione o check
  correspondente em `src/lib/health-check.server.ts`.
