# `src/lib` — camada de lógica

Convenções de nomenclatura de arquivos (importante para o bundler do
TanStack Start):

- `*.functions.ts` — **server functions** (`createServerFn`) chamadas pelo
  frontend. Seguras para importar em componentes; o código sensível roda só
  no servidor.
- `*.server.ts` — helpers **apenas de servidor**. Nunca importar em código de
  cliente (a proteção de import bloqueia pelo nome do arquivo).
- demais `.ts` — utilitários isomórficos (rodam em cliente e servidor).

## Autenticação e acesso

- `auth.ts` — cadastro, login, sessão (cache em memória), troca de senha e
  fluxo de convite. `loadSession()` popula o usuário a partir do Supabase.
- `auth-gates.ts` — `resolveSessionRole`, `canAccess` e o mapa `ROUTE_ACCESS`
  que define quais papéis acessam cada rota.
- `permissions.ts` — regras de permissão por funcionalidade.

## Reembolsos, políticas e NF-e

- `reimbursements.functions.ts` — listagem e atualização de status de
  reembolsos (escopados por `company_id`).
- `policy.functions.ts` / `policy.ts` — políticas e regras da empresa.
- `nfe.functions.ts`, `nfe-chave.ts` — emissão e validação de NF-e.
- `ai-gateway.server.ts` — chamada ao Lovable AI Gateway para leitura de
  comprovantes.

## Webhooks

- `webhook-auth.server.ts` — resolve a empresa a partir do `webhook_token`
  (header `Authorization` ou query param). Usado pelos endpoints em
  `src/routes/api/public/`.

## Convites e e-mail

- `invites.functions.ts`, `employee-invite.functions.ts` — criação de usuário
  + envio de e-mail. Em caso de falha no envio, o usuário recém-criado é
  removido para evitar contas órfãs.
- `email-templates/` — templates de e-mail.

## Utilitários compartilhados

- `server-utils.ts` — funções de servidor deduplicadas:
  - `escapeHtml` — escapa HTML para templates de e-mail.
  - `generateTempPassword` — gera senha temporária de convite.
  - `extractJsonObject` — extrai com segurança o primeiro objeto JSON de uma
    resposta de LLM (tolerante a texto extra / cercas de código).
- `phone-match.ts` — comparação de telefones pelos últimos dígitos.
- `utils.ts` — `cn` (merge de classes) e helpers genéricos.

## Testes

Cada regra crítica tem teste ao lado (`*.test.ts`). Ao alterar lógica de
permissão, parsing de IA ou correspondência de telefone, atualize/adicione o
teste correspondente e rode `bun run test`.
