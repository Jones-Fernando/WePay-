# WEPAY Backend

Backend REST do WEPAY usando Python, Flask e MySQL.

## Arquitetura

`routes -> controllers -> services -> models -> database`

A regra financeira usa como fonte de verdade:

`despesas + despesa_divisoes + pagamentos`

A tabela `saldos` é recalculada a partir desses eventos.

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha as credenciais do MySQL.
3. Defina uma `SECRET_KEY` forte.
4. Configure SMTP para que novas contas possam receber o link de confirmação e participantes recebam convites de grupo por e-mail.

Para Gmail, habilite a verificação em duas etapas e use uma senha de app em `EMAIL_SENHA_APP` (não use a senha normal da conta). Defina `EMAIL_REMETENTE`, `EMAIL_SERVER` e `EMAIL_PORT`. Essa mesma configuração SMTP envia confirmações de cadastro, instruções de recuperação de senha e convites de grupo. O link de recuperação expira em 30 minutos e só pode ser usado uma vez. Contas anteriores à confirmação de e-mail podem continuar entrando; a migração confirma contas sem token de verificação. Novas contas começam pendentes e precisam confirmar o endereço. Se o SMTP falhar, o cadastro informa o problema, o erro é registrado nos logs e o estado de entrega fica disponível em `email_verification_tokens.delivery_status`/`delivery_error`. Os endpoints de recuperação/reenvio não revelam se um endereço está cadastrado. A tela de convite informa se o e-mail foi enviado ou se é necessário corrigir a configuração SMTP.

Os links dos e-mails apontam para as rotas web `verificar-email`, `convite` e `redefinir-senha` na `FRONTEND_URL`, para que possam ser clicados em clientes de e-mail que não reconhecem o esquema personalizado `wepay://`. Em desenvolvimento na rede local, use o IP do computador acessível pelo celular em vez de `localhost`. Em produção, configure uma URL pública HTTPS. Convites expiram em sete dias; o token de confirmação tem validade de 24 horas, só pode ser usado uma vez e é armazenado apenas como SHA-256. Ajuste `RATE_LIMIT_EMAIL_CONFIRM` e `RATE_LIMIT_EMAIL_RESEND` se necessário.

O banco `wepay_db` e as tabelas podem ser criados automaticamente se o usuário do MySQL tiver permissão para criar bancos.
Na inicialização, o backend também adapta schemas legados de participantes, saldos e tabelas financeiras de grupos. As migrações validam referências e valores antes de converter os dados. Nas tabelas financeiras de grupos, as colunas antigas são mantidas para facilitar a conferência; inconsistências interrompem a inicialização com erro.

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

## Testes

Os testes usam exclusivamente MySQL em um banco separado. Nunca use o banco de desenvolvimento.

1. Copie `.env.test.example` para `.env` ou exporte as mesmas variáveis no terminal.
2. Para MySQL local, crie o banco isolado com `python scripts/setup_test_database.py`; alternativamente, inicie `docker compose -f docker-compose.test.yml up -d` e defina `DB_PORT=3307`.
3. Crie e ative o ambiente Python, então instale as dependências: `python -m venv .venv`, `.venv\\Scripts\\activate`, `pip install -r requirements.txt`.
4. Execute os testes:

```bash
pytest -q
```

Para encerrar e remover somente os dados de teste: `docker compose -f docker-compose.test.yml down -v`.
