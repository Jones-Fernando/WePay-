from datetime import date
from decimal import Decimal, InvalidOperation


def parse_money(value):
    if value is None or value == "":
        raise ValueError("Valor eh obrigatorio.")
    try:
        text = str(value).strip().replace("R$", "").replace(" ", "")
        if "," in text and "." in text:
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", ".")
        result = Decimal(text)
    except (InvalidOperation, ValueError):
        raise ValueError("Valor invalido.")
    if result <= 0:
        raise ValueError("Valor deve ser maior que zero.")
    return result.quantize(Decimal("0.01"))


def parse_iso_date(value, field_name="data"):
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError:
        raise ValueError(f"{field_name} deve estar no formato AAAA-MM-DD.")


def parse_positive_int(value, field_name):
    if isinstance(value, bool):
        raise ValueError(f"{field_name} invalido.")
    if isinstance(value, int):
        result = value
    elif isinstance(value, str) and value.isdecimal():
        result = int(value)
    else:
        raise ValueError(f"{field_name} invalido.")
    if result <= 0:
        raise ValueError(f"{field_name} invalido.")
    return result


def parse_pagination(limit_value, offset_value, default_limit=50, max_limit=100):
    limit = default_limit if limit_value in (None, "") else parse_positive_int(
        limit_value, "limit"
    )
    if limit > max_limit:
        raise ValueError(f"limit deve ser no maximo {max_limit}.")

    if offset_value in (None, ""):
        offset = 0
    elif isinstance(offset_value, str) and offset_value.isdecimal():
        offset = int(offset_value)
    elif isinstance(offset_value, int) and not isinstance(offset_value, bool):
        offset = offset_value
    else:
        raise ValueError("offset invalido.")
    if offset < 0:
        raise ValueError("offset invalido.")
    return limit, offset
