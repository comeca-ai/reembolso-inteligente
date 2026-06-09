# API — Rotas de servidor

Rotas HTTP públicas para integrações externas. Vivem sob `src/routes/api/` e,
quando precisam ser chamadas por serviços de fora (sem login), sob
`src/routes/api/public/`.

## `public/evolution.ts` — Webhook do WhatsApp (Evolution API)

Recebe as mensagens do WhatsApp via [Evolution API](https://doc.evolution-api.com/),
lê o comprovante com IA e registra a despesa no painel **Despesas**.

### Como configurar no Evolution

1. URL do webhook (método POST):
   ```
   https://reembolso-ia-br.lovable.app/api/public/evolution
   ```
2. Habilite o evento **`MESSAGES_UPSERT`**.
3. Recomendado habilitar **Webhook Base64**, para que a imagem do comprovante
   venha embutida no payload.

> O endpoint é público (prefixo `api/public`) e **não exige token**. A empresa
> é identificada, em ordem de prioridade:
> 1. pelo **nome da instância** do Evolution (campo `instance` do payload —
>    sempre presente). Cadastre em **Reembolsos → Identificação no WhatsApp**
>    (`companies.evolution_instance`);
> 2. como reserva, pelo **número de WhatsApp da linha** quando o Evolution
>    envia `sender`/`owner` (`companies.whatsapp_number`).
>
> Se nenhuma das duas chaves estiver cadastrada, a mensagem é ignorada (e um
> aviso com `instance` e `ownerNumber` é registrado nos logs do servidor).

### Fluxo de processamento

```text
WhatsApp  ──►  Evolution API  ──►  POST /api/public/evolution
                                        │
                  1. Ignora msgs próprias (fromMe) e eventos != messages.upsert
                  2. Extrai a imagem/base64 do payload
                  3. Se vier só a URL .enc (criptografada), pede o base64
                     já descriptografado ao Evolution
                     (POST /chat/getBase64FromMediaMessage/{instance})
                  4. IA (gemini-2.5-flash) lê: valor, categoria e descrição
                  5. Faz upload do comprovante no Storage (bucket "comprovantes")
                  6. Grava a despesa em public.inbound_reimbursements
                                        │
                                        ▼
                       Painel "Despesas" (realtime) atualiza sozinho
```

### Persistência

- **Dados** ficam em `public.inbound_reimbursements` (valor, categoria,
  descrição, remetente, status, payload bruto).
- **Comprovantes** ficam no bucket privado de Storage **`comprovantes`**,
  organizados em `<company_id>/<ano>/<uuid>.<ext>`. A coluna `attachment_url`
  guarda apenas o **caminho** do arquivo — não mais o base64. O painel gera uma
  URL assinada temporária (5 min) ao clicar em "Ver comprovante".
- Registros antigos podem ter `attachment_url` como `data:`/`http` URL; o painel
  abre esses diretamente, mantendo compatibilidade.

### Secrets usados

| Secret | Uso |
| --- | --- |
| `LOVABLE_API_KEY` | IA (Lovable AI Gateway) para ler o comprovante |
| `EVOLUTION_API_URL` | (opcional) descriptografar mídia `.enc` |
| `EVOLUTION_API_KEY` | (opcional) autentica a chamada de descriptografia |

### Resiliência

- Se a IA falhar, a despesa ainda é gravada (sem valor/categoria).
- Se o upload do comprovante falhar, a despesa é gravada sem anexo.
- Aceita 1 evento ou um array de eventos por chamada.
