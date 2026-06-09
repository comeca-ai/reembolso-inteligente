# Guardrails do Projeto

Condutas que **sempre** precisam ser verificadas antes de considerar uma tarefa concluída.
Lista viva — novos itens são adicionados conforme combinamos.

## 1. Empresas

- **Toda empresa nova nasce sem dados mock.** Ao criar uma empresa (signup, convite, provisionamento), nenhum dado de demonstração deve ser inserido — sem despesas, reembolsos, notas ou usuários fictícios. A empresa começa 100% vazia e só passa a ter dados a partir das ações reais do cliente.
- **Convite por e-mail restringido ao domínio da empresa.** Ao convidar um novo usuário por e-mail, o sistema deve bloquear endereços de domínio diverso do domínio da empresa. Exceção: domínios de serviço de e-mail pessoal (gmail.com, hotmail.com, outlook.com, yahoo.com etc.) devem ser rejeitados independentemente.
