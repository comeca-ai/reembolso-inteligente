# Campos obrigatórios e régua de severidade

Referência dos campos esperados num DANFE (NF-e, modelo 55) ou cupom (NFC-e,
modelo 65) e o peso de cada falha na triagem do app.

## Campos por modelo

| Campo | NF-e (55) | NFC-e (65) | Severidade se ausente/inválido |
|---|---|---|---|
| Chave de acesso (44 díg.) | obrigatório | obrigatório | **BLOQUEANTE** |
| CNPJ do emitente | obrigatório | obrigatório | **BLOQUEANTE** |
| Nome/razão social do emitente | obrigatório | obrigatório | MEDIA |
| Inscrição Estadual do emitente | obrigatório | obrigatório | BAIXA |
| Número da nota (nNF) | obrigatório | obrigatório | MEDIA |
| Série | obrigatório | obrigatório | BAIXA |
| Data de emissão | obrigatório | obrigatório | ALTA |
| Natureza da operação | obrigatório | não se aplica | BAIXA |
| Destinatário (CPF/CNPJ) | obrigatório | opcional¹ | ALTA (55) / BAIXA (65) |
| Itens (descrição, qtd, valor) | ≥ 1 item | ≥ 1 item | MEDIA |
| Valor total da nota (vNF) | obrigatório | obrigatório | **BLOQUEANTE** |
| Protocolo de autorização | obrigatório² | obrigatório² | MEDIA |
| QR Code | não se aplica | obrigatório | MEDIA |

¹ Na NFC-e "CONSUMIDOR NÃO IDENTIFICADO" é válido — registre, não condene.
² Ausência costuma indicar contingência ou recorte da imagem; pede revisão, não
reprovação automática.

## Cruzamentos da chave (44 dígitos)

A chave embute campos que devem bater com o impresso; divergência indica erro de
leitura ou adulteração. `validarChave()` (`src/lib/nfe-chave.ts`) já faz isto.

```
0-1   cUF (UF)      2-5   AAMM        6-19  CNPJ emitente
20-21 modelo        22-24 série       25-33 número
34    tpEmis        35-42 cNF         43    cDV (módulo 11)
```

## Mapeamento severidade → status do app

- **BLOQUEANTE** → `violado` (não prossegue para a SEFAZ).
- **ALTA** ou legibilidade baixa → `alerta`.
- **MEDIA/BAIXA** → reduzem o score sem mudar o status sozinhas.
