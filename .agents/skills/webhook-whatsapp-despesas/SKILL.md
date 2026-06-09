---
name: webhook-whatsapp-despesas
description: Configurar e diagnosticar o recebimento de despesas/comprovantes via WhatsApp (Evolution API) neste SaaS. Use quando comprovantes pararem de chegar, ao validar o webhook, ao cadastrar o número/instância, ou ao depurar roteamento de empresa pelo remetente.
---

# Webhook de despesas via WhatsApp (Evolution API)

Procedimento para configurar, validar e diagnosticar o fluxo em que um
colaborador manda a foto de um comprovante pelo WhatsApp, a IA lê os dados e a
despesa aparece no painel **Despesas**.

## Arquitetura (resumo)

- Endpoint público: `POST /api/public/evolution`
  (arquivo: `src/routes/api/public/evolution.ts`). Sem token.
- Número de WhatsApp é **único/compartilhado** por todas as empresas. A empresa
  é resolvida pelo **remetente** (colaborador), nesta ordem:
  1. `resolve_company_by_sender_whatsapp` — casa os **últimos 8 dígitos** do
     telefone do remetente com `profiles.whatsapp` → `profiles.company_id`
     (chave principal);
  2. fallback `resolve_company_by_instance` — nome da instância
     (`companies.evolution_instance`);
  3. fallback `resolve_company_by_whatsapp` — número da linha
     (`companies.whatsapp_number`).
- Se nada casar, a mensagem é ignorada e registrada em `public.webhook_debug`.
- Comprovante vai para o bucket privado `comprovantes`; a despesa em
  `public.inbound_reimbursements`. Painel atualiza via realtime.
- Cadastro do WhatsApp do colaborador/aprovador acontece no
  onboarding/convites (`signup.tsx`, `invites.functions.ts`,
  `employee-invite.functions.ts`) e é gravado em `profiles.whatsapp` pelo
  gatilho `handle_new_user`.
- Unicidade: `findWhatsappConflict` (em `webhook-auth.server.ts`) impede o mesmo
  WhatsApp em empresas diferentes, garantindo roteamento determinístico.

## A URL do webhook DEVE bater com o slug publicado

Causa nº 1 de "parou do nada": o Evolution aponta para um slug antigo/errado
que retorna 404 ("Project not found"). A URL do webhook é
`https://<slug>.lovable.app/api/public/evolution` e o `<slug>` precisa ser o
slug atual publicado do projeto. Se o projeto for republicado com outro slug, a
URL antiga morre.

## Diagnóstico rápido (rodar nesta ordem)

1. **Testar o endpoint** (deve responder HTTP 200):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     "https://<slug>.lovable.app/api/public/evolution" \
     -H "Content-Type: application/json" -d '{"event":"ping"}'
   ```
   - `404` / "Project not found" → slug errado no Evolution. Corrigir a URL no
     Evolution ou republicar com o slug que o cliente já configurou.
   - `200` → endpoint vivo; siga.

2. **Conferir os logs do webhook** (cada evento recebido grava aqui):
   ```sql
   SELECT created_at, event_name, instance, owner_number, resolved_company, reason
   FROM public.webhook_debug ORDER BY created_at DESC LIMIT 20;
   ```
   - Vazio após enviar comprovante → mensagem não chega ao endpoint (URL/Evolution).
   - `reason = 'empresa não resolvida'` → o remetente não casa com nenhum
     `profiles.whatsapp`. Cadastrar o colaborador com o WhatsApp certo.
   - `reason = 'evento ...'` ou `'fromMe'` → evento ignorado por design.

3. **Conferir os WhatsApps cadastrados**:
   ```sql
   SELECT nome, whatsapp, company_id FROM public.profiles
   WHERE whatsapp IS NOT NULL ORDER BY created_at DESC;
   ```
   - Mesmo número em empresas diferentes → roteamento ambíguo (a resolução pega
     o perfil mais antigo). Limpar/ajustar.

## Configuração correta no Evolution

1. Webhook URL (POST): `https://<slug>.lovable.app/api/public/evolution`
2. Habilitar evento `MESSAGES_UPSERT`.
3. Habilitar **Webhook Base64** (imagem embutida no payload).
4. Secrets opcionais p/ descriptografar mídia `.enc`: `EVOLUTION_API_URL`,
   `EVOLUTION_API_KEY`. Secret obrigatório p/ IA: `LOVABLE_API_KEY`.

## Regras do projeto

- Nunca dizer "Supabase" ao usuário — usar "Lovable Cloud" / backend / banco.
- Endpoint fica em `/api/public/*` (bypassa auth no site publicado); manter
  validação no handler.
