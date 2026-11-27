# WePay

Aplicativo para registrar despesas pessoais e compartilhar gastos em grupos.
O repositório reúne uma API Flask/MySQL e um aplicativo Expo Router em um
monorepo.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `backend/` | API Flask, persistência MySQL, serviços, migrações e testes |
| `frontend/` | Aplicativo Expo Router, telas, serviços de API e testes |
| `.github/workflows/` | Verificações automatizadas de frontend e backend |

O backend segue o fluxo `routes -> controllers -> services -> models -> database`.
O frontend organiza as telas em `src/app/` e concentra integrações e lógica
compartilhada em `src/services/`, `src/contexts/` e `src/utils/`.

## Começar

Consulte os guias de cada componente para requisitos, configuração e comandos:

- [Backend: instalação, configuração, execução e testes](./backend/README.md)
- [Frontend: instalação, execução e verificações](./frontend/README.md)

O CI executa lint, verificação de tipos e testes do frontend; no backend,
executa Ruff, testes com MySQL e os limites de cobertura definidos pelo projeto.

## Release e staging

O [workflow de CI](./.github/workflows/ci.yml) valida testes, lint, auditorias
de dependências e export dos bundles; ele não publica nem configura staging.
Antes de produção, faça o ensaio em um staging com banco e segredos próprios,
usando dados sintéticos ou anonimizados. A sequência de deploy, smoke tests e
rollback está documentada no [runbook do backend](./backend/README.md#staging-release-e-rollback).

## Segurança e privacidade

- Não versione arquivos `.env`, credenciais ou chaves.
- Não coloque segredos em variáveis `EXPO_PUBLIC_*`; elas são públicas no app.
- Em produção, use HTTPS, uma chave JWT exclusiva e forte e armazenamento
  compartilhado para rate limits.
- A API encaminha imagens de recibo ao Google Gemini para extração. Consulte a
  documentação do backend para detalhes sobre retenção e privacidade.

## Contribuir

Branches, mensagens de commit e revisão estão descritas em
[CONTRIBUTING.md](./CONTRIBUTING.md). Use pull requests para integrar mudanças
à branch principal.
