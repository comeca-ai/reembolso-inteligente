## Objetivo

Transformar a tela de Política de mock em real: ao publicar o PDF, a IA (Lovable AI / Gemini) lê o documento, extrai os **pontos-chave/regras estruturadas**, salva no banco e exibe na seção **"Regras estruturadas extraídas da política"** que já existe. Em seguida, disponibilizar a **avaliação de reembolsos** contra essas regras.

## Situação atual

- Auth é real (banco), mas dados do app são **mock** (`VITE_SUPABASE_ANON_KEY` não existe → `isSupabaseConfigured = false`).
- `uploadPolicy()` é fake; as regras da tela são fixas no código.
- Não existe tabela de políticas/regras, nem bucket de storage, nem função de IA.

## Fase 1 — Extração da política (foco principal)

**Banco (migração):**
- Tabela `policies` (versão, arquivo, página/tamanho, ativa, `company_id`, quem publicou).
- Tabela `policy_rules` (código, título, categoria, limite, base, texto, `policy_id`, `company_id`).
- RLS por empresa (membros leem; admin grava), GRANTs.
- Bucket de storage **privado** `policies` para guardar o PDF original, com políticas de acesso por empresa.

**Servidor (TanStack `createServerFn`, sem edge function):**
- `uploadPolicy`: recebe o PDF (upload do cliente para o storage), registra a versão e dispara a extração.
- `extractPolicyRules`: baixa o PDF (cliente admin), envia o arquivo direto ao **Gemini** (multimodal lê PDF), recebe JSON estruturado das regras, grava em `policy_rules` e marca a versão como ativa.

**Frontend:**
- Trocar o upload mock por upload real do PDF + chamada da função.
- A seção "Regras estruturadas extraídas da política" passa a ler do banco (regras da versão ativa).
- Estados de carregando/erro (429/402 da IA tratados na UI).

## Fase 2 — Avaliação de reembolsos

- `evaluateExpense`: recebe os dados de uma despesa (valor, categoria, estabelecimento, comprovante) + regras vigentes e retorna veredito (aprovar/revisar/recusar) citando a cláusula.
- **Observação:** hoje as despesas são 100% mock (não há tabela `expenses` no banco). Posso (a) entregar a função de avaliação pronta e aplicá-la sobre os dados mock para já mostrar o veredito na tela de despesas, ou (b) construir antes o backend real de despesas. Sugiro (a) agora e (b) num passo seguinte.

## Detalhes técnicos

- IA via **Lovable AI Gateway** + AI SDK (`google/gemini-3-flash-preview`), helper em `src/lib/ai-gateway.server.ts`. Gemini aceita o PDF como file part — sem precisar de parser de PDF no runtime Worker.
- Saída estruturada com `Output.object` (Zod) para garantir o schema das regras.
- Funções de servidor em `src/lib/policy.functions.ts`; leitura de storage/admin via `await import("@/integrations/supabase/client.server")` dentro do handler.
- A camada de política deixa de usar o mock e passa a chamar as server functions diretamente (não vou virar o app inteiro para dados reais, para não quebrar despesas/usuários que ainda não têm tabela).

## Entregável da Fase 1

PDF publicado → IA extrai e grava as regras → tela mostra as regras reais da política, com o arquivo guardado no storage e versionado.
