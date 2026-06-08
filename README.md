# reembolso.ia.br

Plataforma de gestão de reembolsos corporativos com leitura automática de
comprovantes por IA, integração com WhatsApp (via webhook) e emissão de NF-e.

## Visão geral

- **Frontend / Backend**: [TanStack Start](https://tanstack.com/start) (React 19 + SSR), Vite 7.
- **Estilo**: Tailwind CSS v4 (tokens em `src/styles.css`).
- **Backend gerenciado**: Lovable Cloud (Postgres, Auth, Storage e funções).
- **IA**: Lovable AI Gateway (leitura de comprovantes e análise de reembolsos).

## Funcionalidades principais

- Cadastro de empresa + administrador (programa piloto).
- Convite de aprovadores e colaboradores por e-mail.
- Recebimento de reembolsos por WhatsApp (webhook Evolution) com leitura do
  comprovante por IA e validação automática contra a política da empresa.
- Painel de reembolsos, despesas, relatórios e emissão de NF-e.
- Controle de acesso por papéis: `admin`, `approver`, `member`.

## Estrutura de pastas

```text
src/
  routes/            Rotas (páginas e endpoints HTTP) — file-based routing
    api/public/      Webhooks públicos (reimbursements, evolution)
    _app.*           Área autenticada (overview, reembolsos, NF-e, etc.)
  lib/               Lógica de negócio, server functions e utilitários
  components/        Componentes de UI reutilizáveis
  integrations/      Clientes Supabase gerados (não editar)
  styles.css         Design tokens (cores, sombras, gradientes)
supabase/migrations/ Migrações de banco (SQL)
```

Veja `src/lib/README.md` para o detalhamento da camada de lógica e
`src/routes/README.md` para as rotas.

## Modelo de dados (resumo)

- `companies` — dados da empresa (razão social, CNPJ, políticas, token de webhook).
- `profiles` — usuário ligado a uma empresa.
- `user_roles` — papéis do usuário (tabela separada, ver segurança abaixo).
- `inbound_reimbursements` — reembolsos recebidos (incl. via WhatsApp).
- `despesas`, `policies`, `policy_rules` — políticas e despesas.

## Segurança

- **RLS** habilitado em todas as tabelas; acesso multi-tenant escopado por
  `current_company_id()`.
- **Papéis** ficam em `user_roles` e são verificados via `has_role()`
  (security definer) — nunca confiar em papel vindo do cliente.
- **Webhooks** (`/api/public/*`) exigem `webhook_token` da empresa; o
  `company_id` é resolvido no servidor, nunca aceito do corpo da requisição.
- **Storage**: buckets privados (`policies`, `comprovantes`, `cartoes-cnpj`)
  com políticas restritas à pasta da própria empresa.

## Desenvolvimento

```bash
bun install      # instala dependências
bun run dev      # ambiente de desenvolvimento
bun run test     # testes unitários (vitest)
bun run lint     # análise estática
bun run build    # build de produção
```

## Testes

Os testes vivem ao lado do código (`*.test.ts`) e cobrem regras críticas:
permissões/papéis (`permissions.test.ts`, `auth-gates.test.ts`), correspondência
de telefone (`phone-match.test.ts`), parsing de IA e utilitários de servidor
(`server-utils.test.ts`) e fluxo de sessão (`auth.test.ts`).
