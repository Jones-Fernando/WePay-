import pytest

from database.sql_identifiers import quote_mysql_identifier


def test_quote_mysql_identifier_escapes_backticks():
    assert quote_mysql_identifier("table`name") == "`table``name`"


@pytest.mark.parametrize("identifier", ["valid_name", "name; DROP TABLE users"])
def test_quote_mysql_identifier_returns_a_single_quoted_identifier(identifier):
    quoted = quote_mysql_identifier(identifier)

    assert quoted.startswith("`")
    assert quoted.endswith("`")
    assert quoted[1:-1].count("``") == identifier.count("`")


@pytest.mark.parametrize("identifier", ["", "invalid\x00identifier"])
def test_quote_mysql_identifier_rejects_empty_or_null_identifiers(identifier):
    with pytest.raises(ValueError, match="Identificador MySQL invalido"):
        quote_mysql_identifier(identifier)
