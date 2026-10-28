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
4. Configure SMTP somente se quiser email real.

O banco `wepay_db` e as tabelas podem ser criados automaticamente se o usuário do MySQL tiver permissão para criar bancos.

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
