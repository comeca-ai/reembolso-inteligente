# Revisão geral — relatório + plano de ação

Estado atual: build saudável, **32/32 testes passando**. A base é organizada e bem comentada, mas há falhas de segurança reais nos webhooks públicos, alguns bugs de correção e lacunas de teste/documentação nas áreas mais sensíveis (auth, reembolsos, convites).

## 1. Segurança (prioridade máxima)

| # | Problema | Onde | Gravidade |
|---|----------|------|-----------|
| S1 | Webhook `/api/public/reimbursements` **sem autenticação** — qualquer um na internet injeta reembolsos falsos e consome IA | `src/routes/api/public/reimbursements.ts` | Crítico |
| S2 | `company_id` vem do corpo do request e é gravado direto (IDOR cross-tenant) | mesmo arquivo | Crítico |
| S3 | Webhook Evolution (WhatsApp) **sem token**, aceita qualquer chamada | `src/routes/api/public/evolution.ts` | Crítico |
| S4 | Página de teste `/teste-webhook` exposta sem login (UI pronta p/ abuso) | `src/routes/teste-webhook.tsx` | Médio |
| S5 | Bucket `cartoes-cnpj` sem policies de INSERT/UPDATE/DELETE | storage | Médio |
| S6 | `profiles` sem SELECT por empresa — admins não listam membros (leva a gambiarras) | RLS | Médio |

Correções:
- Exigir Bearer token (`DESPESAS_WEBHOOK_TOKEN` ou novo `REIMBURSEMENTS_WEBHOOK_TOKEN`/`EVOLUTION_WEBHOOK_TOKEN`) no topo de S1 e S3, retornando 401 antes de qualquer parse/IA.
- S2: remover `company_id` do schema público; resolver a empresa no servidor.
- S4: adicionar `beforeLoad` redirecionando p/ login (ou restringir a admin / remover de produção).
- S5/S6: migração com policies de storage e SELECT em `profiles` escopado por `current_company_id()`.

## 2. Bugs / correção

- **B1** `cartao_cnpj_arquivo` declarado em `AuthCompany` mas nunca buscado no SELECT → sempre `undefined`. `src/lib/auth.ts:166`.
- **B2** `updateReimbursementStatus` sem filtro `.eq("company_id", …)` — depende só de RLS. `src/lib/reimbursements.functions.ts:158`.
- **B3** `extractJsonObject` em reimbursements consumido sem try/catch: JSON malformado da IA vira 500 em vez de fallback. `reimbursements.functions.ts:261`.
- **B4** Convites: usuário é criado no Auth **antes** do envio de e-mail; se SMTP2GO falha, conta fica órfã sem credenciais e sem rollback/reenvio. `invites.functions.ts`, `employee-invite.functions.ts`.
- **B5** Retry do signup dispara `new Event("submit")` sintético em vez de chamar a lógica direto. `src/routes/signup.tsx:301`.
- **B6** `reset-password.tsx` chama `updatePassword` sem validar se o token do link foi consumido; link expirado → toast genérico sem recuperação.

## 3. Qualidade do código

- Duplicação: `escapeHtml`, `generateTempPassword` (2x convites), `extractJsonObject` (reimbursements+policy), bloco de verificação de admin inline em 4 lugares → extrair p/ `src/lib/server-utils.ts` e reusar o `assertAdmin` já existente.
- `isSupabaseConfigured = false` hardcoded (`src/lib/supabase.ts:39`) — deveria vir de env var.
- Nomes mock "Carla Menezes" como default em caminho real da API (`api.ts:1440`, `1547`).
- `any` espalhado nos parsers de saída da IA (`policy.functions.ts`, `reimbursements.functions.ts`) e double-cast do client em `db()` (`api.ts:1406`).

## 4. Testes (cobertura nova)

Hoje cobertos bem: `phone-match`, `auth-gates`, `permissions`, e 4 cenários de `signUpCompany`.

Sem cobertura nas áreas mais sensíveis — adicionar testes para:
1. `extractJsonObject` / `parseExtraction` / `parseDraft` (JSON com cerca, JSON puro, malformado → erro tratado).
2. `mapRow` (normalização de verdict) em reimbursements.
3. `loadSession` (caminho de reparo perfil/role ausente, mapeamento `mustChangePassword`) — com Supabase mockado.
4. `signIn` e `completeMandatoryPasswordChange`.
5. `resolveSessionRole` com `approver`; `canAccess` em path fora de `ROUTE_ACCESS` (default permissivo).

## 5. Documentação

- Criar `README.md` na raiz: o que é o app, como rodar, env vars necessárias, bootstrap do schema/trigger de auth.
- `src/lib/README.md`: separação client puro / client+server / `*.functions.ts` (server-only).
- Comentar caminho de migração do `isSupabaseConfigured` e a divergência mock vs real (`api.ts`, `onboarding.tsx` usando caminho mock em vez de `uploadAndExtractPolicy`).
- Documentar que `mustChangePassword` é imposto só por dialog de UI (não por route guard).

## Ordem de execução proposta

1. **Bloco 1 — Segurança** (S1–S6): código dos webhooks + migração de RLS/storage.
2. **Bloco 2 — Bugs** (B1–B6).
3. **Bloco 3 — Qualidade**: extrair helpers compartilhados, remover hardcodes.
4. **Bloco 4 — Testes**: novos testes unitários das funções críticas.
5. **Bloco 5 — Documentação**: READMEs e comentários.

Cada bloco roda `vitest` ao final para garantir verde.

## Notas técnicas

- Webhooks usam comparação de token em tempo constante (`timingSafeEqual`), padrão já presente em `despesas.ts`.
- Migrações SQL incluirão `GRANT` apropriados e policies escopadas por `current_company_id()`.
- Testes de `loadSession`/`signIn` exigem mock do client Supabase (vi.mock), seguindo o padrão de `auth.test.ts`.

Posso executar tudo (Blocos 1–5) ou só os blocos que você priorizar. Diga se aprova ou o que ajustar.