## Objetivo

Trocar o fluxo de convite por **e-mail + senha temporária**. Ao convidar, o sistema já cria o login da pessoa e envia as credenciais por e-mail. No **primeiro acesso**, abre um modal obrigatório (não fechável) forçando a troca da senha temporária antes de usar o painel. Vale para aprovadores e colaboradores de campo.

## Mudanças

### 1. Banco de dados (migração)
- Adicionar a coluna `must_change_password` (verdadeiro/falso, padrão falso) na tabela de perfis. Ela indica que a senha ainda é a temporária e precisa ser trocada.

### 2. Convite de aprovador (`src/lib/invites.functions.ts`)
- Em vez de gerar link de ativação, criar o usuário já com **senha temporária** (e-mail confirmado), papel "aprovador", vinculado à empresa do admin.
- Marcar o perfil com `must_change_password = verdadeiro`.
- E-mail passa a conter: e-mail de acesso, a senha temporária, o link de login do painel e o aviso de que a senha deve ser trocada no primeiro acesso.

### 3. Convite de colaborador de campo (`src/lib/employee-invite.functions.ts`)
- Passar a criar login com **senha temporária**, papel "membro", vinculado à empresa.
- Marcar `must_change_password = verdadeiro`.
- E-mail mantém as instruções de envio por WhatsApp/e-mail e ganha o bloco de credenciais (e-mail + senha temporária + link de login) para quem quiser acompanhar pelo painel.

### 4. Camada de auth (`src/lib/auth.ts`)
- Carregar `must_change_password` na sessão e expor no usuário (`mustChangePassword`).
- Helper para concluir a troca: atualiza a senha, zera a flag no perfil e recarrega a sessão.

### 5. Modal de troca obrigatória (novo componente + `AppShell`)
- Novo `ForcePasswordChangeDialog`: aparece automaticamente quando `mustChangePassword` é verdadeiro, **não pode ser fechado** e exige nova senha + confirmação (mínimo 8 caracteres).
- Renderizado dentro do `AppShell`, então cobre todas as telas internas até a senha ser trocada.

## Detalhes técnicos
- Geração da senha temporária no servidor (aleatória, forte, ~12 caracteres) usando `crypto`.
- Criação via `supabaseAdmin.auth.admin.createUser({ email_confirm: true, password, user_metadata })`; o gatilho `handle_new_user` cria perfil/papel a partir do metadata (`invited_company_id`, `invite_role`).
- Logo após, `supabaseAdmin` atualiza `profiles.must_change_password = true` pelo id retornado.
- A flag é limpa pelo próprio usuário (RLS já permite update do próprio perfil; o trigger só bloqueia mudança de `company_id`).
- E-mails continuam pelo SMTP2GO.

## Observação
Isso passa a dar acesso ao painel para colaboradores de campo (antes sem login). Se preferir manter colaboradores sem login e aplicar a senha temporária só a aprovadores, me avise antes de eu implementar.