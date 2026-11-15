# Contribuindo

## Branches

- `completo` é a branch principal do projeto.
- Crie branches curtas a partir dela, com prefixos como `feat/`, `fix/`,
  `docs/`, `test/` ou `chore/`.
- Não faça desenvolvimento diretamente em `completo`; integre mudanças por
  pull request.
- Evite manter branches permanentes duplicadas para a mesma versão do projeto.

## Commits

Use mensagens curtas no formato:

```text
tipo(escopo): descrição objetiva
```

Tipos recomendados: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` e `ci`.
Escreva a descrição no imperativo e indique o componente quando isso ajudar.
Exemplos:

```text
feat(frontend): adiciona filtro por período
fix(backend/auth): invalida sessão após troca de senha
test(backend): cobre migração de participantes
docs: explica configuração local
```

Mantenha cada commit focado em uma mudança coerente. Evite mensagens genéricas
como `atualizações`, `correções` ou `tudo pronto`.

## Pull requests

Abra um PR para `completo`, descreva o problema e a solução, e informe os
comandos de validação executados. Mantenha o escopo do PR revisável e vincule
issues relacionadas quando existirem.

Antes de solicitar revisão:

- [ ] Execute as verificações relevantes do frontend e/ou backend.
- [ ] Atualize a documentação quando o comportamento ou a configuração mudar.
- [ ] Confirme que não há segredos, arquivos `.env` ou artefatos locais no diff.
- [ ] Informe limitações ou etapas manuais necessárias para implantar a mudança.
