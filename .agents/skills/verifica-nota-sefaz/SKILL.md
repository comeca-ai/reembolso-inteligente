---
name: verifica-nota-sefaz
description: >-
  Verifica a autenticidade de NF-e (modelo 55) / NFC-e (modelo 65) em duas camadas,
  adaptada ao app Reembolsaaí (TanStack Start + edge): (1) validação ESTRUTURAL
  offline da chave de 44 dígitos (DV módulo 11, DV do CNPJ, UF, modelo, cruzamento
  com dados impressos) e (2) consulta da SITUAÇÃO REAL na SEFAZ (autorizada /
  cancelada / denegada / inexistente) via nfe.io (SERPRO/SEFAZ), com fallback para
  conferência manual no portal. É a etapa 2 do pipeline de compliance. Use ao
  trabalhar na tela de Verificação de NF-e, no webhook de recebimento de
  comprovantes, ou quando pedirem "essa nota é verdadeira?", "verifica na SEFAZ",
  "a nota foi autorizada/cancelada?", "confere essa chave", "essa nota é fria?".
  NÃO use para triagem estrutural/completude (use triagem-nota-fiscal) nem forense
  de imagem (use recibo-foto-de-foto).
---

# Verifica Nota Fiscal na SEFAZ (Reembolsaaí)

Confirma se uma NF-e/NFC-e é autêntica. Duas camadas, porque uma sozinha engana: a
estrutura prova que a chave é **bem-formada e coerente**; a SEFAZ prova que a nota
**existe e foi autorizada**. Um fraudador gera uma chave estruturalmente perfeita —
então a estrutura sozinha **não basta**. Deixe isso explícito no veredito.

## Onde isto vive no projeto

- Núcleo da consulta: `src/lib/nfe-verify.server.ts` → `checkKey()` e
  `normalizeDanfeKey()` (remove espaços/traços, garante 44 dígitos).
- Validação estrutural offline: `src/lib/nfe-chave.ts` → `validarChave()`.
- Server functions: `src/lib/nfe.functions.ts` (`verifyNfe`, `verifyNfeKey`).
- Verificação AUTOMÁTICA ao receber comprovante: `autoVerifyReimbursementNfe`
  chamada pelos webhooks (`src/routes/api/public/reimbursements.ts` e `evolution.ts`).
- Etapa 2 do compliance: `runSefaz` em `src/lib/compliance.server.ts`.
- Tela: `src/routes/_app.nfe.tsx`.

## Fonte e fallback

- **Principal**: nfe.io (`NFE_IO_API_KEY`), consulta irrestrita pela chave.
  Mapeia `currentStatus` → `autorizada | cancelada | denegada | inexistente`.
- **Sem API key ou erro 401/403/5xx**: status `manual` com `SEFAZ_PORTAL_URL`
  para conferência manual (o portal tem captcha e não permite automação).
- Status do app: `autorizada → ok`; `cancelada/denegada/inexistente → violado`;
  `manual/erro → manual`.

## Sinais de fraude a destacar

- Chave estruturalmente válida + **inexistente** na SEFAZ → forte indício de nota
  inventada (chave forjada nunca autorizada).
- Divergência entre dados impressos e os embutidos na chave (CNPJ/número/série/data).
- Nota **cancelada** usada como comprovante.
- Valor no comprovante diferente do valor na SEFAZ.

## Regras importantes

- A chave **sempre** é normalizada (sem espaços/traços) antes de consultar e gravar.
- Grave para auditoria: `nfe_status`, `nfe_verified_at`, `nfe_raw` (já feito).
- `checkKey` é tolerante a falhas — nunca derruba o fluxo de recebimento.
- A consulta roda no servidor (edge); nunca exponha `NFE_IO_API_KEY` ao cliente.

## Ao estender/depurar

- Para checar uma chave avulsa, use `verifyNfeKey` (não grava nada).
- Logs do servidor mostram falhas de `checkKey`. Um 401/403 da nfe.io significa
  produto de consulta não habilitado na conta → cai no fallback manual.
