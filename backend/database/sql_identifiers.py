def quote_mysql_identifier(identifier: str) -> str:
    """Quote a MySQL identifier, escaping embedded backticks."""
    if not identifier or "\x00" in identifier:
        raise ValueError("Identificador MySQL invalido.")
    return f"`{identifier.replace('`', '``')}`"
