from decimal import Decimal, localcontext

import pytest

from utils.validators import MAX_MONEY, parse_money


def test_parse_money_accepts_decimal_12_2_upper_bound():
    assert parse_money("9999999999.99") == MAX_MONEY


@pytest.mark.parametrize(
    "value",
    [
        "10000000000.00",
        "9999999999.995",
        "NaN",
        "Infinity",
    ],
)
def test_parse_money_rejects_values_outside_supported_range(value):
    with pytest.raises(ValueError):
        parse_money(value)


def test_parse_money_preserves_rounding_to_two_decimal_places():
    assert parse_money("1.234") == Decimal("1.23")


def test_parse_money_converts_quantize_failure_to_validation_error():
    with localcontext() as context:
        context.prec = 5
        with pytest.raises(ValueError, match="Precisao"):
            parse_money("123456.78")
