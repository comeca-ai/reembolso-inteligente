---
name: recibo-foto-de-foto
description: >-
  Forense de imagem de comprovante: estima se a foto de um recibo/nota é uma "foto
  de foto" (recaptura de tela ou papel re-fotografado), imagem editada ou suspeita,
  devolvendo um score de 0 (original) a 10 (muito suspeito) com os sinais
  observados. Adaptada ao app Reembolsaaí (TanStack Start + edge, SEM Python): em
  vez dos scripts FFT/ELA/EXIF, usa o Lovable AI (visão) sobre a imagem já recebida.
  É a etapa 3 do pipeline de compliance. Use ao trabalhar na tela de Verificação de
  NF-e, no pipeline de compliance, ou quando pedirem "isso é foto de foto?", "é
  recaptura de tela?", "foi editado?", "é screenshot?", "score de fraude dessa
  foto". NÃO use para validar se a nota existe na SEFAZ (use verifica-nota-sefaz),
  para triagem de campos (use triagem-nota-fiscal), nem como prova jurídica.
---

# Recibo: detector de "foto de foto" (Reembolsaaí)

Recebe a **imagem** de um comprovante e estima o quanto parece ter sido
**recapturada** (foto da tela / papel re-fotografado) ou **editada**. Devolve um
**score de suspeita de 0 a 10** com os sinais observados.

Princípio central: **isto é apoio à decisão, não veredito.** Nenhum sinal isolado
prova fraude. O valor está em mostrar *por que* uma imagem é suspeita, para que um
humano decida com contexto.

## Onde isto vive no projeto

- Etapa implementada em `src/lib/compliance.server.ts` → `runFoto`.
- Usa Lovable AI Gateway via `generateObject` (schema `FotoSchema`) sobre a imagem
  em `attachment_url` do comprovante.
- Disparada por `evaluateCompliance` e exibida em `ComplianceDialog`
  (`src/components/nfe/ComplianceDialog.tsx`).

## Por que IA em vez dos scripts originais

O app roda em runtime edge (Cloudflare Workers): não há Python, numpy, OpenCV nem
acesso a arquivo para rodar FFT/ELA/EXIF. A skill foi adaptada para pedir à IA de
visão um laudo dos mesmos sinais (borda/moldura de tela, padrão de moiré, reflexo,
pixels de tela, recorte, sobreposição de valor) e um score.

## Bandas do score (0 = original · 10 = muito suspeito)

| Score | Status app | Recomendação prática |
|------|-----------|----------------------|
| 0–4  | `ok` | Seguir o fluxo normal. |
| 5–6  | `alerta` | Revisão humana antes de aprovar. |
| 7–10 | `violado` | Reter; pedir reenvio do **arquivo original** (não print) e escalar. |

## Cuidados que mudam a leitura (importante)

- **WhatsApp/Telegram removem EXIF e recomprimem** a imagem — no fluxo do app isso é
  a regra. Por isso "sem metadados" é sinal fraco e a recompressão atenua o moiré.
  Na zona de dúvida (5–6), o caminho certo é **pedir o arquivo original**, não cravar.
- **Falso positivo custa caro**: acusar um funcionário honesto corrói a confiança.
  Na dúvida, prefira "revisar" a "rejeitar". A resposta nunca afirma fraude como
  fato — use "indício", "sugere", "possível".

## Ao estender/depurar

- Ajuste o prompt e os cortes de banda (5 / 7) em `runFoto`.
- Mantenha o schema enviado à IA ENXUTO (Gemini rejeita schema grande).
- Sem `attachment_url` a etapa volta `pendente` (não há imagem para analisar).
