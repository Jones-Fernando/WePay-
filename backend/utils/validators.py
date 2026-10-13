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
