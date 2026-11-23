# WEPAY Backend

Backend REST do WEPAY usando Python, Flask e MySQL.

## Arquitetura

`routes -> controllers -> services -> models -> database`

A regra financeira usa como fonte de verdade:

`despesas + despesa_divisoes + pagamentos`

A tabela `saldos` mantém deltas desses eventos dentro das mesmas transações.
A rotina de recálculo permanece disponível para reconciliação, mas não é
executada em cada leitura ou operação financeira.

Clientes que registram pagamentos devem enviar um UUID no cabeçalho
`Idempotency-Key` e reutilizar a mesma chave ao repetir a mesma solicitação.
Uma repetição com dados iguais retorna o pagamento original; reutilizar a chave
com dados diferentes retorna HTTP 409. O cabeçalho é opcional para manter
compatibilidade com clientes antigos; requisições sem ele não têm essa proteção.

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
   Para testar em celular ou abrir o frontend por outro dispositivo da rede,
   configure `HOST=0.0.0.0`, use o IP atual do computador em
   `EXPO_PUBLIC_API_URL` e inclua a origem do frontend em `CORS_ORIGINS`.
   Restrinja o acesso pela rede local e pelo firewall; não exponha o servidor
   de desenvolvimento à internet.
5. O entrypoint WSGI aceita somente `APP_ENV=production`. Em produção, defina
   explicitamente uma `SECRET_KEY` exclusiva e aleatória com pelo menos 32 caracteres,
   configure um usuário MySQL dedicado (não `root`) com senha e privilégios mínimos,
   configure `DB_SSL_CA` para o certificado CA do MySQL (o `DB_HOST` deve corresponder
   ao nome coberto pelo certificado; certificado e identidade são verificados),
   configure explicitamente `RATE_LIMIT_STORAGE_URI` para storage compartilhado
   (por exemplo, `redis://host:6379/0`) e use URLs HTTPS. A aplicação falha na
   inicialização se a configuração estiver ausente ou usar `memory://`.
   O cliente Redis necessário já é instalado por `requirements.txt`.
6. Configure SMTP se quiser enviar convites de grupo e links de recuperação de senha por e-mail. Para produção, gere e mantenha estável `EMAIL_OUTBOX_ENCRYPTION_KEY`; API e worker devem usar o mesmo valor. Cadastro e login não exigem confirmação de e-mail.

### Privilégios MySQL

A conta configurada em `DB_USER` para a API precisa de `SELECT`, `INSERT`,
`UPDATE` e `DELETE` nas tabelas `grupo_icones_capa_opcoes` e
`grupo_icones_capa_ocultos`. A listagem consulta essas tabelas; salvar ou
restaurar a seleção altera seus registros. Conceda somente nessas tabelas,
usando o nome do banco, usuário e host efetivamente configurados:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON `SEU_BANCO`.`grupo_icones_capa_opcoes`
TO 'USUARIO_DA_API'@'HOST_DA_API';

GRANT SELECT, INSERT, UPDATE, DELETE
ON `SEU_BANCO`.`grupo_icones_capa_ocultos`
TO 'USUARIO_DA_API'@'HOST_DA_API';
```

O campo `icone` da tabela de ícones ocultos usa collation binária porque cada
emoji precisa ser comparado pela sequência exata de caracteres. A migração
corrige essa collation em bancos existentes; sem isso, a collation linguística
pode considerar ícones diferentes iguais e causar erro MySQL 1062 ao salvar.

Execute os `GRANT` em uma sessão MySQL administrativa, não no PowerShell. A
conta usada por `scripts/run_db_migrations.ps1` é separada da conta da API e
precisa das permissões de DDL e de dados exigidas pelas migrações. Um erro
`DELETE command denied` durante a migração indica uma permissão ausente nessa
conta; não resolva ampliando os privilégios da conta de runtime.

Senhas novas devem ter pelo menos 12 caracteres e no máximo 72 bytes UTF-8
(limite do bcrypt). A regra é aplicada ao cadastro, à alteração e à redefinição.
Hashes SHA-256 legados não são aceitos no login. Antes de ativar esta versão,
comunique a redefinição obrigatória aos usuários e faça backup do banco. Com a
API parada, execute primeiro a simulação e depois a migração:

```bash
APP_ENV=production flask --app app invalidate-legacy-passwords
APP_ENV=production flask --app app invalidate-legacy-passwords --apply
```

O comando substitui cada hash SHA-256 por um hash bcrypt de um segredo aleatório
descartado, revoga as sessões e invalida os tokens de acesso dessas contas.
Os usuários afetados precisam usar “Esqueci minha senha” para definir uma nova
senha. Configure e teste o envio de e-mail antes da migração; contas sem acesso
ao e-mail cadastrado precisam de um processo assistido de recuperação.

Para Gmail, habilite a verificação em duas etapas e use uma senha de app em `EMAIL_SENHA_APP` (não use a senha normal da conta). Defina `EMAIL_REMETENTE`, `EMAIL_SERVER` e `EMAIL_PORT`. O SMTP é usado para instruções de recuperação de senha e convites de grupo; não é necessário para cadastrar ou entrar. A recuperação usa uma outbox MySQL transacional: a criação do token e do e-mail pendente ocorre na mesma transação, e o token de envio fica criptografado com Fernet, nunca em texto claro. Em produção, gere a chave uma vez e armazene-a como segredo:

```bash
.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Mantenha `EMAIL_OUTBOX_ENCRYPTION_KEY` estável e igual na API e no worker; alterar ou perder a chave impede o envio dos itens pendentes já criptografados. O worker repete falhas SMTP com espera progressiva (30, 60, 120, 240 e até 300 segundos), por no máximo oito tentativas. Falhas finais ficam em estado `failed`, aparecem no health check e geram eventos críticos no journal. Cada link expira em 30 minutos e só pode ser usado uma vez. Solicitações adicionais não invalidam links já enviados; ao redefinir a senha, todos os outros tokens ativos são invalidados. As solicitações de recuperação também têm limites por IP e por endereço de e-mail normalizado. A migração libera contas anteriormente pendentes e novos cadastros ficam disponíveis para login imediatamente.
Ao alterar ou redefinir a senha, todas as sessões existentes são invalidadas e o usuário precisa entrar novamente.
Ao excluir uma conta, a senha atual é exigida, dados pessoais e despesas pessoais são removidos e a identidade é anonimizada nos grupos compartilhados. Grupos sem outros participantes são removidos; nos grupos com outros participantes, o histórico é preservado e a administração é transferida para um membro ativo quando disponível. Descrições e observações livres dos registros compartilhados permanecem como foram lançadas.
A foto de perfil pode ser atualizada por `PUT /api/auth/avatar` com uma imagem JPEG, PNG ou WEBP de até 1,5 MB. A foto é removida ao anonimizar a conta.
Cada usuário pode salvar uma chave Pix no perfil. Ela só é retornada em
`GET /api/saldos/grupo/<id>` ao participante que deve ao dono da chave. O app
permite copiar a chave; a transferência e o registro do pagamento continuam
manuais. A chave é removida ao anonimizar a conta.

No cliente web, o refresh token é armazenado em cookie `HttpOnly` com caminho
restrito a `/api/auth`; o access token fica apenas em memória no navegador.
Requisições de refresh e logout que usam o cookie exigem uma origem presente em
`CORS_ORIGINS`. Mantenha `AUTH_REFRESH_COOKIE_SAMESITE=Lax` quando frontend e API
forem same-site. Para origens cross-site, configure `SameSite=None` e
`AUTH_REFRESH_COOKIE_SECURE=true` somente com HTTPS e uma lista CORS restrita.
Clientes nativos continuam usando SecureStore e o fluxo JSON de refresh.

Os links dos e-mails de convite apontam para a rota web `convite` na
`FRONTEND_URL`. Por padrão, os links de recuperação também abrem a rota web
`redefinir-senha`. Para abrir a recuperação no app, configure
`PASSWORD_RESET_URL`: no Expo Go use
`exp://IP_DO_COMPUTADOR:8081/--/redefinir-senha`; em um app instalado, use
`wepay://redefinir-senha` (o esquema `wepay` está configurado em
`frontend/app.json`). Em produção, esse valor aceita somente uma URL HTTPS ou
`wepay://redefinir-senha`; o esquema `exp://` é exclusivo para desenvolvimento.
O Expo Go e o servidor de desenvolvimento precisam estar ativos e acessíveis na
mesma rede. Convites expiram em sete dias.

O app não aplica migrações durante a importação nem ao iniciar. Antes de subir
a API, inicialize o schema com uma conta de migração autorizada:

```bash
flask --app app init-db
```

Para verificar saldos materializados sem alterá-los, execute
`flask --app app reconcile-balances --check-only`. Para corrigir divergências,
execute `flask --app app reconcile-balances`; use `--group-id <id>` para limitar
a operação a um grupo. A correção bloqueia o livro do grupo e atualiza os
saldos em uma transação. O modo `--check-only` retorna erro se encontrar
divergências, facilitando o uso em monitoramento. Em produção, o timer
`wepay-balance-reconcile.timer` executa essa verificação diariamente, sem
alterar os saldos. Divergências fazem a unidade falhar e geram alerta no
journal. Investigue o grupo e os lançamentos antes de executar qualquer
correção manual; o timer nunca corrige dados automaticamente.

Use uma conta de banco com privilégios de migração para esse comando e uma conta
com privilégios mínimos para o processo da API. As migrações validam referências
e valores antes de converter schemas legados de participantes, saldos e despesas;
inconsistências interrompem a execução com erro. Schemas antigos de categorias
também são atualizados para incluir o tipo, preservar a data de criação e
migrar as categorias para cada usuário. Despesas guardam referências às
categorias; uma categoria vinculada a despesas não pode ser excluída.

Em desenvolvimento local no Windows, mantenha `DB_USER` e `DB_PASSWORD` do
`.env` restritos às operações normais da API. Copie `.env.migrate.example` para
`.env.migrate`, defina uma senha aleatória para a conta com privilégios
limitados a `wepay_db` e rode `.\scripts\run_db_migrations.ps1` somente quando
for aplicar migrações. O script não imprime as credenciais. Para uma instalação
nova, crie o banco com uma conta administrativa antes de configurar o migrador;
a rotina de migração não precisa de privilégio global para criar um banco que
já existe.

## Backup e restauração

Para tabelas InnoDB, gere dumps consistentes com `--single-transaction` e
inclua rotinas, triggers e eventos. Use um arquivo de opções MySQL protegido
ou outro gerenciador de credenciais; não passe senhas na linha de comando:

```bash
mysqldump --defaults-extra-file=/caminho/protegido/mysql-backup.cnf \
  --single-transaction --routines --triggers --events \
  --databases wepay_db > wepay_db-AAAA-MM-DD.sql
```

O uso de `--databases` grava `CREATE DATABASE` e `USE wepay_db` no dump. Portanto,
conectar o cliente a outro schema com `--database` não basta: o `USE` do arquivo
pode redirecionar a restauração para `wepay_db`. Faça o teste em outra instância
MySQL isolada ou, na mesma instância local, crie um schema temporário exclusivo
e remapeie **ambos** os seletores do dump para ele antes de importar. Nunca
importe o arquivo bruto contra o servidor que hospeda o banco ativo.

Após importar, confirme tabelas, índices, rotinas, triggers e eventos; execute
`CHECK TABLE` nas tabelas restauradas e inicie a API apontando `DB_NAME` para o
schema isolado. O teste só está concluído quando `GET /health/ready` retorna
HTTP 200. Ao terminar, remova somente o schema temporário usado no teste.

Armazene os dumps em diretório com acesso restrito, criptografe-os em repouso e
mantenha a chave fora do diretório de backup. Configure um agendador com
frequência e retenção adequadas ao RPO/RTO do ambiente e mantenha uma cópia
protegida fora do host; ACL local, por si só, não é criptografia nem backup
off-site. Repita um teste de restauração periodicamente e após mudanças no
processo de backup. Como ponto de partida para desenvolvimento local, retenha
30 cópias diárias. Em produção, valide a política com o RPO/RTO e os requisitos
de retenção aplicáveis; 30 cópias diárias e 12 mensais criptografadas fora do
host são uma referência inicial, não um substituto dessa validação.

## Staging, release e rollback

CI verde não substitui um ensaio de implantação. Mantenha staging separado de
produção e dos testes (`wepay_test`), com banco, credenciais e serviços próprios.
Use somente dados sintéticos ou anonimizados; não copie dados reais de produção.
Configure os mesmos requisitos de produção no staging, mas com segredos,
certificados, URLs e recursos exclusivos do ambiente.

Execute a sequência nesta ordem:

1. Aprove o commit imutável na [pipeline de CI](../.github/workflows/ci.yml).
   Ela verifica auditoria npm, lint, TypeScript, testes do frontend e export
   Expo para iOS, Android e web; no backend, auditoria Python, Ruff, testes,
   cobertura e limites de cobertura crítica.
2. Com a API parada ou em manutenção e um backup restaurável confirmado, rode
   `flask --app app init-db` usando somente a conta de migração do staging. A
   migração remove as tabelas de parcelamento, despesas associadas e pagamentos
   de grupo vinculados; saldos desses grupos são recalculados. Não inicie a API
   se a migração terminar com erro; MySQL pode confirmar DDL parcialmente.
3. Inicie a versão exata aprovada pela CI e execute smoke tests do frontend e
   da API. Confira `GET /health/live` e `GET /health/ready` pela URL HTTPS
   publicada, incluindo a validade do certificado e o status de MySQL e do
   storage compartilhado de rate limit.
4. Verifique os logs e alertas dos workers e execute
   `flask --app app reconcile-balances --check-only`. Confirme que o timer de
   reconciliação está habilitado e que uma falha gera o alerta esperado.
5. Registre SHA do release, versão do schema, resultado das migrações, dos
   smoke tests e dos alertas. Não faça alterações manuais de configuração
   durante o ensaio sem registrá-las e incorporá-las ao processo.

### Reversão

Mantenha disponível o artefato imutável da versão anterior e um backup
pré-migração verificado. Se houver apenas falha de aplicação e a versão anterior
for compatível com o schema já expandido, reverta o tráfego para aquele
artefato; não reconstrua uma versão antiga a partir de código mutável.

Se uma migração falhar ou deixar o schema incompatível, interrompa API e
workers, preserve o banco que falhou para diagnóstico e não tente corrigir com
uma migração inversa improvisada. Restaure o backup em uma instância ou schema
isolado, valide tabelas, índices, integridade e readiness, e só então planeje a
troca controlada da conexão. Dumps criados com `--databases` contêm seletores
`CREATE DATABASE`/`USE`; nunca os importe diretamente sobre o banco ativo.
Antes de voltar a receber gravações, confirme a versão da aplicação e do schema,
os smoke tests e `reconcile-balances --check-only`. A restauração pode descartar
gravações feitas após o backup; considere esse impacto antes de reabrir tráfego.

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

### Probes de saúde

Configure o balanceador/orquestrador para usar `GET /health/live` como
liveness: retorna HTTP 200 enquanto o processo responde, sem consultar
dependências. Use `GET /health/ready` como readiness: retorna HTTP 200 somente
quando MySQL e o storage do rate limiter respondem; em falha, retorna HTTP 503
e identifica cada dependência no JSON. `/health` permanece como alias de
readiness para compatibilidade. Serviços opcionais como Gemini e SMTP não são
consultados nesses probes, portanto sua indisponibilidade não retira a API do
tráfego quando não estão sendo usados.

O envio de notificações push é processado por uma outbox MySQL transacional.
Em produção Linux com systemd, instale e habilite o worker supervisionado e
seu timer de health check (ajuste usuário, diretório e ambiente nos arquivos
para o caminho da implantação):

```bash
sudo cp deploy/systemd/wepay-push-worker.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-health.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-health.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-push-outbox-alert@.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-email-outbox-worker.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-email-outbox-health.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-email-outbox-health.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-email-outbox-alert@.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-balance-reconcile.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-balance-reconcile.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-balance-reconcile-alert@.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention.service /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention.timer /etc/systemd/system/
sudo cp deploy/systemd/wepay-data-retention-alert@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wepay-push-worker.service
sudo systemctl enable --now wepay-push-outbox-health.timer
sudo systemctl enable --now wepay-email-outbox-worker.service
sudo systemctl enable --now wepay-email-outbox-health.timer
sudo systemctl enable --now wepay-balance-reconcile.timer
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

O worker de recuperação de senha também é supervisionado pelo systemd. Ele
grava heartbeat em `/run/wepay/email-outbox.heartbeat`; o timer verifica a
fila, a idade dos itens, falhas finais e reservas abandonadas a cada minuto.
Configure alertas para `wepay-email-outbox-health.service` e eventos
`wepay-email-outbox` no journal. Verifique com
`systemctl status wepay-email-outbox-worker` e
`journalctl -u wepay-email-outbox-health.service`.

O envio é pelo menos uma vez: se o SMTP aceitar a mensagem e o processo cair
antes de confirmar o estado no banco, o mesmo e-mail poderá ser enviado
novamente após a reserva expirar. Os dois e-mails usam o mesmo token válido.
Falhas `failed` podem ser reprocessadas somente enquanto o token ainda estiver
válido; depois de 30 minutos, solicite um novo link:

```bash
sudo -u wepay sh -c 'cd /opt/wepay/backend && APP_ENV=production .venv/bin/python -m services.email_outbox_worker --health-check'
sudo -u wepay sh -c 'cd /opt/wepay/backend && APP_ENV=production .venv/bin/python -m services.email_outbox_worker --retry-failed 123'
```

### Retenção de dados

O timer `wepay-data-retention.timer` executa a limpeza diariamente, com atraso
aleatório de até 15 minutos. A rotina exclui em lotes de até 500 registros:

- refresh tokens e tokens revogados expirados há mais de 30 dias;
- tokens de recuperação e convites cuja expiração e eventual uso ocorreram há
  mais de 30 e 90 dias, respectivamente;
- eventos `sent` da outbox enviados há mais de 90 dias (destinatários são
  removidos pela chave estrangeira em cascata);
- métricas individuais e globais de uso do Gemini com mais de 365 dias.

As métricas individuais do Gemini também são apagadas imediatamente quando a
conta correspondente é excluída; os totais globais (usuario_id 0) são mantidos
até o prazo de retenção.

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

O timer `wepay-balance-reconcile.timer` roda a verificação de saldos diariamente
às 02:30, com até 15 minutos de atraso aleatório. Ele executa somente
`reconcile-balances --check-only`: uma divergência retorna erro, preserva os
saldos existentes e aciona `wepay-balance-reconcile-alert@.service`, que envia
um evento crítico ao journal. Consulte os grupos divergentes no log da unidade
e investigue os registros financeiros antes de corrigir:

```bash
journalctl -u wepay-balance-reconcile.service
journalctl -t wepay-balance-reconcile
```

Após investigar, a correção continua manual e pode ser limitada ao grupo:
`flask --app app reconcile-balances --group-id <id>`. Não habilite uma unidade
de correção automática.

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
2. Defina uma senha aleatória para a conta em `.env.test`. Para MySQL local, crie o banco isolado com `DB_ADMIN_USER` e `DB_ADMIN_PASSWORD` definidos apenas no terminal durante `python scripts/setup_test_database.py`; o script usa a conta de teste de `.env.test` e concede privilégios somente em `wepay_test`. Alternativamente, ajuste `DB_PORT=3307` em `.env.test` e inicie o MySQL de teste com `docker compose -f docker-compose.test.yml up -d --wait` (o comando aguarda o healthcheck).
3. Crie e ative o ambiente Python, então instale as dependências de validação: `python -m venv .venv`, `.venv\\Scripts\\activate`, `pip install -r requirements-dev.txt`.
4. Execute os testes:

```bash
ruff check .
python -m pytest --cov=controllers --cov=models --cov=services --cov=utils --cov=middlewares --cov=routes --cov=database --cov-report=term-missing --cov-report=json:coverage.json
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
Configure `GEMINI_MODEL` para o modelo principal e
`GEMINI_FALLBACK_MODEL` para a contingência. Em caso de HTTP 429 ou 503, o
backend tenta o modelo de contingência uma vez; cada tentativa tem timeout de
25 segundos para respeitar o limite de espera do app.

## Notificações push

Ao criar uma despesa de grupo, participantes ativos que mantêm os avisos de
despesas habilitados recebem uma notificação interna; o autor não é notificado.
A despesa e as notificações são gravadas na mesma transação. A notificação leva
à despesa registrada.

Na tela de saldos, quem tem um crédito pode enviar um lembrete privado a um
devedor. O servidor verifica o saldo simplificado atual antes do envio e limita
lembretes a um por devedor e grupo a cada 24 horas. O destinatário pode desativar
lembretes de cobrança nas configurações. A ação cria uma notificação interna e
leva o destinatário aos saldos do grupo. A central permite marcar avisos como
lidos individualmente ou todos de uma vez.

Os avisos de despesas e cobranças são armazenados mesmo sem push. O push é
opcional: após o commit, o worker processa a outbox e envia pelo Expo aos
dispositivos registrados com push habilitado. Uma falha no Expo não desfaz a
operação financeira; o evento é reagendado com backoff e, após oito tentativas,
fica `failed` para inspeção e eventual reprocessamento manual.

O envio tem semântica at-least-once enquanto houver tentativas disponíveis, não
exactly-once: se o Expo aceitar um lote e o worker cair antes de persistir os
tickets, aquele lote pode ser enviado novamente. Depois que os tickets são
persistidos, os destinatários aceitos não são reenviados por falha em outro lote.
Tickets representam aceite pelo Expo; recibos posteriores representam o
resultado do repasse ao serviço push da plataforma, não confirmação de que o
usuário recebeu ou visualizou a notificação.

O app precisa ser configurado com `EXPO_PUBLIC_EAS_PROJECT_ID` para registrar
dispositivos. `EXPO_ACCESS_TOKEN` é opcional e deve ser usado quando o projeto
Expo exigir autenticação no serviço de push. Push fica desativado por padrão;
as preferências para avisos de despesas, cobranças e som são armazenadas na
conta.
