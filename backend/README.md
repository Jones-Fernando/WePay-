# WEPAY Backend

Backend REST do WEPAY usando Python, Flask e MySQL.

## Arquitetura

`routes -> controllers -> services -> models -> database`

A regra financeira usa como fonte de verdade:

`despesas + despesa_divisoes + pagamentos`

A tabela `saldos` mantém deltas desses eventos dentro das mesmas transações.
A rotina de recálculo permanece disponível para reconciliação, mas não é
executada em cada leitura ou operação financeira.

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha as credenciais do MySQL.
3. Ajuste `DB_POOL_SIZE` ao número de threads da API e aos limites de conexões
   do MySQL (padrão: 5; máximo: 32 por processo).
4. Use `APP_ENV=development`, `testing` ou `production`. Valores desconhecidos
   interrompem a inicialização.
5. Em produção, defina uma `SECRET_KEY` aleatória com pelo menos 32 caracteres,
   configure explicitamente `RATE_LIMIT_STORAGE_URI` para storage compartilhado
   (por exemplo, `redis://host:6379/0`) e use URLs HTTPS. A aplicação falha na
   inicialização se a configuração estiver ausente ou usar `memory://`.
   O cliente Redis necessário já é instalado por `requirements.txt`.
6. Configure SMTP se quiser enviar convites de grupo e links de recuperação de senha por e-mail. Cadastro e login não exigem confirmação de e-mail.

Senhas novas devem ter pelo menos 12 caracteres e no máximo 72 bytes UTF-8
(limite do bcrypt). Senhas existentes continuam válidas para login; a regra é
aplicada ao cadastro, à alteração e à redefinição.

Para Gmail, habilite a verificação em duas etapas e use uma senha de app em `EMAIL_SENHA_APP` (não use a senha normal da conta). Defina `EMAIL_REMETENTE`, `EMAIL_SERVER` e `EMAIL_PORT`. O SMTP é usado para instruções de recuperação de senha e convites de grupo; não é necessário para cadastrar ou entrar. O link de recuperação expira em 30 minutos e só pode ser usado uma vez. A migração libera contas anteriormente pendentes e novos cadastros ficam disponíveis para login imediatamente.
Ao alterar ou redefinir a senha, todas as sessões existentes são invalidadas e o usuário precisa entrar novamente.
Ao excluir uma conta, a senha atual é exigida, dados pessoais e despesas pessoais são removidos e a identidade é anonimizada nos grupos compartilhados. Grupos sem outros participantes são removidos; nos grupos com outros participantes, o histórico é preservado e a administração é transferida para um membro ativo quando disponível. Descrições e observações livres dos registros compartilhados permanecem como foram lançadas.

No cliente web, o refresh token é armazenado em cookie `HttpOnly` com caminho
restrito a `/api/auth`; o access token fica apenas em memória no navegador.
Requisições de refresh e logout que usam o cookie exigem uma origem presente em
`CORS_ORIGINS`. Mantenha `AUTH_REFRESH_COOKIE_SAMESITE=Lax` quando frontend e API
forem same-site. Para origens cross-site, configure `SameSite=None` e
`AUTH_REFRESH_COOKIE_SECURE=true` somente com HTTPS e uma lista CORS restrita.
Clientes nativos continuam usando SecureStore e o fluxo JSON de refresh.

Os links dos e-mails de convite e recuperação apontam para as rotas web `convite` e `redefinir-senha` na `FRONTEND_URL`. Em desenvolvimento na rede local, use o IP do computador acessível pelo celular em vez de `localhost`. Em produção, configure uma URL pública HTTPS. Convites expiram em sete dias.

O app não conecta ao banco nem aplica migrações durante a importação. Em
desenvolvimento, `python app.py` inicializa o schema para conveniência. Em
produção, execute as migrações uma vez com uma conta de banco autorizada antes
de subir a API:

```bash
flask --app app init-db
```

Para verificar saldos materializados sem alterá-los, execute
`flask --app app reconcile-balances --check-only`. Para corrigir divergências,
execute `flask --app app reconcile-balances`; use `--group-id <id>` para limitar
a operação a um grupo. A correção bloqueia o livro do grupo e atualiza os
saldos em uma transação. O modo `--check-only` retorna erro se encontrar
divergências, facilitando o uso em monitoramento.

Use uma conta de banco com privilégios de migração para esse comando e uma conta
com privilégios mínimos para o processo da API. As migrações validam referências
e valores antes de converter schemas legados de participantes, saldos e despesas;
inconsistências interrompem a execução com erro.

## Instalação

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

## Execução

```bash
python app.py
```

API base local: `http://127.0.0.1:5000`

## Execução em produção

Instale as dependências em um ambiente virtual e configure as variáveis de
produção descritas acima. Aplique o schema uma vez com `flask --app app init-db`
usando uma conta com privilégios de migração. Em seguida, inicie o servidor
WSGI:

```bash
waitress-serve --host=0.0.0.0 --port=5000 wsgi:app
```

Configure o proxy reverso para usar HTTPS e encaminhar requisições para o
Waitress. Não execute `python app.py` em produção; esse comando é restrito ao
servidor de desenvolvimento.

O envio de notificações push é processado por uma outbox MySQL transacional.
Depois de aplicar o schema, execute o worker como um processo separado e
supervisionado, usando as mesmas variáveis de ambiente da API:

```bash
python -m services.push_outbox_worker
```

Mantenha uma única instância de worker inicialmente; o bloqueio MySQL permite
escalar com múltiplas instâncias. O worker repete falhas transitórias com
backoff exponencial até oito tentativas, então marca o evento como falho para
inspeção operacional. Se o Expo aceitar a mensagem e o worker cair antes de
confirmar no banco, o push poderá ser reenviado.

## Testes

Os testes usam exclusivamente MySQL em um banco separado (`wepay_test`). A suíte interrompe a inicialização se `APP_ENV` não for `testing` ou se `DB_NAME` apontar para outro banco. Nunca altere essa proteção para executar os testes no banco de desenvolvimento.

1. Copie `.env.test.example` para `.env.test`. Não substitua seu `.env` de desenvolvimento; com `APP_ENV=testing`, o backend carrega `.env.test` quando esse arquivo existir.
2. Para MySQL local, crie o banco isolado com `python scripts/setup_test_database.py`; alternativamente, ajuste `DB_PORT=3307` em `.env.test` e inicie o MySQL de teste com `docker compose -f docker-compose.test.yml up -d --wait` (o comando aguarda o healthcheck).
3. Crie e ative o ambiente Python, então instale as dependências: `python -m venv .venv`, `.venv\\Scripts\\activate`, `pip install -r requirements.txt`.
4. Execute os testes:

```bash
pytest --cov=controllers --cov=models --cov=services --cov=utils --cov=middlewares --cov-report=term-missing --cov-fail-under=90
```

O CI publica a cobertura linha a linha no log e exige pelo menos 90% nas
camadas de controllers, models, services, utils e middlewares. Mantenha essa
meta e priorize os fluxos financeiros e de autenticação quando a cobertura cair.

O CI e o ambiente de testes local usam MySQL 8.0, a versão suportada pelo
projeto. Para executar as verificações de `check.py`, informe explicitamente
`--mysql` e/ou `--gemini`; a verificação Gemini faz uma chamada externa e pode
consumir cota.

Para encerrar o MySQL de teste e remover também seu volume de dados: `docker compose -f docker-compose.test.yml down -v`.

O leitor de recibos aceita JPEG, PNG e WEBP, com arquivo de até 8 MiB. O corpo
multipart da requisição é limitado a 9 MiB; configure proxies e gateways para
aceitarem pelo menos esse tamanho. A assinatura do arquivo é comparada ao MIME
declarado antes de enviar a imagem ao Gemini.

## Notificações push

As notificações internas existentes continuam sendo salvas no banco. Quando uma
nova despesa de grupo é criada, o backend também envia um alerta pelo Expo Push
Service aos dispositivos registrados dos participantes que ativaram
notificações. O envio acontece depois do commit da despesa; falhas no serviço
push são registradas no log e não desfazem a operação financeira.

O app precisa ser configurado com `EXPO_PUBLIC_EAS_PROJECT_ID` para registrar
dispositivos. `EXPO_ACCESS_TOKEN` é opcional e deve ser usado quando o projeto
Expo exigir autenticação no serviço de push. As notificações são desativadas por
padrão; preferências de notificações e som são armazenadas na conta.
