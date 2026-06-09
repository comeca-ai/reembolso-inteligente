---
name: triagem-nota-fiscal
description: >-
  Triagem ESTRUTURAL e de COMPLETUDE de nota fiscal (DANFE de NF-e modelo 55 ou
  cupom NFC-e modelo 65) ANTES da consulta à SEFAZ, adaptada ao app Reembolsaaí
  (TanStack Start + edge, sem Python). Combina validação offline da chave de 44
  dígitos (DV módulo 11, DV do CNPJ, cruzamentos) com leitura do comprovante via
  Lovable AI (campos obrigatórios, nota em branco/ilegível) e devolve score 0–100
  + status ok/alerta/violado. É a etapa 1 do pipeline de compliance. Use ao
  trabalhar na tela de Verificação de NF-e, no pipeline de compliance, ou quando
  pedirem "essa nota está completa?", "tem campo faltando?", "veio em branco?",
  "valida a estrutura", "triagem da nota". NÃO use para situação na SEFAZ (use a
  skill verifica-nota-sefaz) nem forense de imagem (use recibo-foto-de-foto).
---

# Triagem de Nota Fiscal — estrutura e completude (Reembolsaaí)

É o **porteiro** do pipeline de compliance: roda *antes* da SEFAZ e da forense de
imagem. Responde "essa nota está completa e estruturalmente íntegra o suficiente
para confiarmos e seguir?". Não diz se a nota é autêntica na Receita nem se a foto
foi manipulada.

## Onde isto vive no projeto

- Etapa implementada em `src/lib/compliance.server.ts` → função `runTriagem`.
- Validação estrutural offline da chave: `src/lib/nfe-chave.ts` → `validarChave()`
  (DV módulo 11, DV do CNPJ, UF, modelo, cruzamento com dados impressos).
- Leitura do documento: Lovable AI Gateway via `generateObject` (schema `TriagemSchema`).
- Disparada pela server function `evaluateCompliance` (`src/lib/compliance.functions.ts`)
  e exibida na tela `src/routes/_app.nfe.tsx` (diálogo `ComplianceDialog`).

## Regra de ouro

**Percepção é da IA, conta é do código.** Nunca calcule dígito verificador "de
cabeça": a chave passa sempre por `validarChave()`. A IA só lê campos do documento
(o que está preenchido, legível, em branco) — não inventa valor que não consegue
ler. Campo ilegível = `null`, nunca um chute (chutar gera falso "APROVADA").

## Régua de severidade → status

- **BLOQUEANTE** (chave ausente/ DV inválido, valor total ausente, documento em
  branco, "não é nota") → `violado`. Não prossegue para a SEFAZ.
- **ALTA** (CNPJ DV inválido, totais não fecham, data ausente/futura, divergência
  de cruzamento, legibilidade baixa) → `alerta`.
- **MEDIA/BAIXA** (número/itens/protocolo/série/IE ausentes) → abaixa o score.
- Score: começa em 100; estrutura inválida −50; bloqueante −40; alta −20; média
  −10; baixa −3. `violado` se score < 50; `alerta` se < 85; senão `ok`.

Veja `references/campos-obrigatorios.md` para a lista de campos por modelo.

## Edge cases (não confundir com fraude)

- **Contingência** (DANFE em Contingência / EPEC / FS-DA / SCAN): ausência de
  protocolo é esperada — sinalize como observação, não reprove.
- **NFC-e com consumidor não identificado**: válido, severidade baixa.
- **Foto cortada**: se faltam campos por enquadramento, o problema é a foto —
  peça novo registro, não rejeite a despesa.
- **Documento que não é NF-e** (PIX, recibo simples, selfie): marque como não
  aplicável; a triagem fiscal não vale.

## Ao estender/depurar

- Ajuste os pesos do score e os mapeamentos de severidade em `runTriagem`.
- O schema enviado à IA deve ficar ENXUTO (Gemini rejeita schema grande): evite
  enums longos e aninhamento profundo.
- Para testar a server function, use os logs do servidor e a própria tela de NF-e.
