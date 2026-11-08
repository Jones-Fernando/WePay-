# WePay

Aplicativo para registrar despesas pessoais e compartilhar gastos em grupos.
O projeto contém uma API Flask/MySQL e um aplicativo Expo Router.

## Componentes

- [Backend](./backend/README.md): configuração, execução, migrações e testes da API.
- [Frontend](./frontend/README.md): configuração, execução e verificações do app.

## Segurança e privacidade

Não versionar arquivos `.env` nem colocar segredos em variáveis `EXPO_PUBLIC_*`.
Em produção, usar HTTPS, uma chave JWT exclusiva e forte e um storage
compartilhado para rate limits. A API recebe imagens de recibo e as encaminha
ao Google Gemini para extração; detalhes de conta e histórico após exclusão
estão descritos na documentação dos componentes.
