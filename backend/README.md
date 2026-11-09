# WEPAY Backend

Backend REST do WEPAY usando Python, Flask e MySQL.

## Arquitetura

`routes -> controllers -> services -> models -> database`

A regra financeira usa como fonte de verdade:

`despesas + despesa_divisoes + pagamentos`

A tabela `saldos` mantém deltas desses eventos dentro das mesmas transações.
A rotina de recálculo permanece disponível para reconciliação, mas não é
executada em cada leitura ou operação financeira.

Em despesas de grupo, somente quem criou a despesa ou um administrador ativo
do grupo pode editá-la ou excluí-la. Despesas anteriores à migração não têm
autoria confiável e, por isso, só podem ser alteradas ou removidas por um
administrador ativo.

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
Hashes SHA-256 legados são atualizados para bcrypt no primeiro login válido
quando a senha tem até 72 bytes. Senhas legadas mais longas continuam aceitas,
mas exigem redefinição antes de poderem ser migradas para bcrypt.

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

O rate limiter usa `REMOTE_ADDR` e não confia em `X-Forwarded-For` por padrão.
Se a implantação estiver atrás de um proxy, configure `TRUSTED_PROXY_HOPS` com
o número exato de proxies que acrescentam endereços ao cabeçalho, e
`TRUSTED_PROXY_CIDRS` com a rede/IP do peer que conecta diretamente ao Waitress.
Restrinja também a rede do servidor para que somente esse proxy alcance a API.
O proxy de borda deve remover qualquer `X-Forwarded-For` recebido do cliente e
criar um cabeçalho confiável; não use `0.0.0.0/0` nem confie apenas no número de
hops. A aplicação só aplica o IP encaminhado quando o peer imediato pertence
a uma das redes configuradas; protocolo e host encaminhados continuam sem
confiança. Com `TRUSTED_PROXY_HOPS=0`, cabeçalhos encaminhados são ignorados.

O envio de notificações push é processado por uma outbox MySQL transacional.
Em produção Linux com systemd, instale e habilite o worker supervisionado e
seu timer de health check (ajuste usuário, diretório e ambiente nos arquivos
para o caminho da implantação):

```bash
sudo cp deploy/systemd/wepay-push-worker.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-health.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-health.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-alert@.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention-alert@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wepay-push-worker.service
sudo systemctl enable --now wepay-push-outbox-health.timer
sudo systemctl enable --now wepay-data-retention.timer
```

O serviço reinicia automaticamente após falha e atualiza um heartbeat em
`/run/wepay/push-worker.heartbeat`. O timer verifica esse heartbeat a cada
minuto, a disponibilidade do banco, fila pendente, idade do item mais antigo,
eventos `failed` e reservas `processing` expiradas. Se degradado, o comando
retorna código diferente de zero e gera uma mensagem crítica no journal.
Configure seu monitor de host para alertar sobre falhas de
`wepay-push-outbox-health.service` e eventos `wepay-push-outbox` no journal;
os limites do health check podem ser ajustados na unidade systemd. Verifique
com `systemctl status wepay-push-worker` e
`journalctl -u wepay-push-outbox-health.service`.

### Retenção de dados

O timer `wepay-data-retention.timer` executa a limpeza diariamente, com atraso
aleatório de até 15 minutos. A rotina exclui em lotes de até 500 registros:

- refresh tokens e tokens revogados expirados há mais de 30 dias;
- tokens de recuperação e convites cuja expiração e eventual uso ocorreram há
  mais de 30 e 90 dias, respectivamente;
- eventos `sent` da outbox enviados há mais de 90 dias (destinatários são
  removidos pela chave estrangeira em cascata).

Eventos `failed` são preservados sem expiração automática para permitir
investigação e reprocessamento. Eventos `pending` e `processing`, notificações,
e tokens Expo de dispositivos ativos não são removidos por essa rotina.
Cada lote concluído e o resumo final JSON são registrados no journal; uma falha
gera um evento crítico no journal por meio da unidade `OnFailure`.

Antes de habilitar o timer, revise o escopo sem apagar dados:

```bash
sudo -u wepay sh -c 'cd /opt/wepay/backend && APP_ENV=production .venv/bin/flask --app app cleanup-retained-data --dry-run'
```

Para executar manualmente, use `sudo systemctl start
wepay-data-retention.service`. Consulte a última execução com
`journalctl -u wepay-data-retention.service` e alertas com
`journalctl -t wepay-data-retention`.
Os arquivos systemd usam `/opt/wepay/backend` e o usuário/grupo `wepay` como
exemplos; ajuste-os para a implantação antes de instalá-los. A inicialização
do schema adiciona o índice necessário para localizar eventos enviados antigos.

Para consultar a fila manualmente, o health check emite JSON e código de saída:

```bash
sudo -u wepay sh -c 'cd /opt/wepay/backend && APP_ENV=production PUSH_WORKER_HEARTBEAT_FILE=/run/wepay/push-worker.heartbeat .venv/bin/python -m services.push_outbox_worker --health-check'
```

Eventos em estado `failed` podem ser recuperados de forma explícita pelo ID:

```bash
sudo -u wepay sh -c 'cd /opt/wepay/backend && APP_ENV=production .venv/bin/python -m services.push_outbox_worker --retry-failed 123'
```

Para reabrir todos os eventos `failed`, use `--retry-all-failed` somente após
inspecionar as causas no campo de erro e no journal. Ambos zeram a contagem de
tentativas; destinatários já aceitos continuam preservados, e tokens removidos
por `DeviceNotRegistered` não são reativados. `--retry-failed` retorna erro se
o ID não existir em estado `failed`.

Cada dispositivo é rastreado separadamente:
tickets aceitos não são reenviados quando outro lote falha, e os recibos do Expo
são consultados após 15 minutos. Tickets confirmam apenas o aceite pelo Expo;
um recibo `ok` confirma o repasse ao serviço push da plataforma, não o
recebimento ou a exibição no dispositivo. Tokens `DeviceNotRegistered` são
removidos automaticamente. Falhas transitórias são
repetidas com backoff exponencial até oito tentativas; uma queda do worker após
o aceite e antes de persistir o ticket ainda pode ocasionar reenvio. Recibos
indisponíveis após 24 horas são encerrados sem reenviar o dispositivo aceito.
Em desenvolvimento, o worker também pode ser iniciado diretamente com
`python -m services.push_outbox_worker`.

## Paginação de listagens

As rotas `GET /api/grupos`, `GET /api/participantes/grupo/<grupo_id>` e
`GET /api/notificacoes` aceitam `limit` e `offset`. O limite padrão é 50 e o
máximo é 100; respostas mantêm a lista em `data` e incluem `paginacao` com
`limit`, `offset`, `total` e `has_more`. Notificações preservam o filtro
`nao_lidas=true` também ao paginar. O app carrega páginas adicionais ao chegar
ao fim das listas; operações que precisam da lista completa de participantes,
como compor uma despesa, percorrem as páginas até o fim.

## Testes

Os testes usam exclusivamente MySQL em um banco separado (`wepay_test`). A suíte interrompe a inicialização se `APP_ENV` não for `testing` ou se `DB_NAME` apontar para outro banco. Nunca altere essa proteção para executar os testes no banco de desenvolvimento.

1. Copie `.env.test.example` para `.env.test`. Não substitua seu `.env` de desenvolvimento; com `APP_ENV=testing`, o backend carrega `.env.test` quando esse arquivo existir.
2. Para MySQL local, crie o banco isolado com `python scripts/setup_test_database.py`; alternativamente, ajuste `DB_PORT=3307` em `.env.test` e inicie o MySQL de teste com `docker compose -f docker-compose.test.yml up -d --wait` (o comando aguarda o healthcheck).
3. Crie e ative o ambiente Python, então instale as dependências de validação: `python -m venv .venv`, `.venv\\Scripts\\activate`, `pip install -r requirements-dev.txt`.
4. Execute os testes:

```bash
ruff check .
pytest --cov=controllers --cov=models --cov=services --cov=utils --cov=middlewares --cov=routes --cov=database --cov-report=term-missing --cov-report=json:coverage.json
python scripts/check_critical_coverage.py coverage.json
```

O CI publica a cobertura linha a linha no log e exige um gate agregado de pelo
menos 90% nas camadas de controllers, models, services, utils e middlewares,
além de no mínimo 90% individualmente em `models/saldo_model.py` e
`services/financeiro_service.py`. Rotas e módulos de banco também aparecem no
relatório, inicialmente sem um mínimo individual; o gate agregado existente
continua aplicado somente às cinco camadas anteriores para evitar uma queda
artificial ao ampliar a medição. Mantenha essas metas e priorize os fluxos
financeiros e de autenticação quando a cobertura cair. O Ruff começa com regras
de erros de sintaxe e nomes indefinidos; ampliar o conjunto de regras exige
resolver ou documentar o baseline existente.
Os testes de retenção também usam o MySQL de teste para verificar registros
dentro e fora dos prazos, estados da outbox e a cascata dos destinatários.

O CI e o ambiente de testes local usam MySQL 8.0, a versão suportada pelo
projeto. Para executar as verificações de `check.py`, informe explicitamente
`--mysql` e/ou `--gemini`; a verificação Gemini faz uma chamada externa e pode
consumir cota.

Para encerrar o MySQL de teste e remover também seu volume de dados: `docker compose -f docker-compose.test.yml down -v`.

O leitor de recibos aceita JPEG, PNG e WEBP, com arquivo de até 8 MiB. O corpo
multipart da requisição é limitado a 9 MiB; configure proxies e gateways para
aceitarem pelo menos esse tamanho. A assinatura do arquivo é comparada ao MIME
declarado antes de enviar a imagem ao Gemini.

## Limites e métricas do Gemini

Por padrão, cada conta pode solicitar até cinco leituras de recibo por hora e
vinte por dia. `/api/auth/refresh` permite dez renovações por minuto por conta;
tentativas sem token válido são limitadas pelo endereço remoto. Os limites são
compartilhados entre instâncias quando `RATE_LIMIT_STORAGE_URI` aponta para
Redis. Ajuste `RATE_LIMIT_RECEIPT_HOURLY`, `RATE_LIMIT_RECEIPT_DAILY` e
`RATE_LIMIT_REFRESH` conforme o uso esperado.

O backend persiste contagem diária de chamadas e bytes de imagem por modelo e
por usuário, e registra resultado/duração estruturados nos logs sem armazenar
imagem ou conteúdo extraído. Ao atingir `GEMINI_DAILY_ALERT_REQUESTS` chamadas
diárias de um modelo, emite um alerta de nível WARNING uma vez por modelo/dia.
Consulte os totais globais com `flask --app app gemini-usage --days 7`.
Esses dados medem volume, não custo financeiro real; para alertas monetários,
configure também orçamentos e alertas de faturamento no Google Cloud.

## Notificações push

As notificações internas existentes continuam sendo salvas no banco. Ao criar
uma despesa de grupo, a notificação e o evento da outbox são gravados na mesma
transação da operação financeira. Depois do commit, o worker processa a fila
assíncronamente e envia os pushes pelo Expo aos dispositivos registrados dos
participantes que ativaram notificações. Uma falha no Expo não desfaz a despesa:
o evento é reagendado com backoff e, após oito tentativas, fica `failed` para
inspeção e eventual reprocessamento manual.

O envio tem semântica at-least-once enquanto houver tentativas disponíveis, não
exactly-once: se o Expo aceitar um lote e o worker cair antes de persistir os
tickets, aquele lote pode ser enviado novamente. Depois que os tickets são
persistidos, os destinatários aceitos não são reenviados por falha em outro lote.
Tickets representam aceite pelo Expo; recibos posteriores representam o
resultado do repasse ao serviço push da plataforma, não confirmação de que o
usuário recebeu ou visualizou a notificação.

O app precisa ser configurado com `EXPO_PUBLIC_EAS_PROJECT_ID` para registrar
dispositivos. `EXPO_ACCESS_TOKEN` é opcional e deve ser usado quando o projeto
Expo exigir autenticação no serviço de push. As notificações são desativadas por
padrão; preferências de notificações e som são armazenadas na conta.
