import pytest
from core.duck_store import DuckStore
from core.allocator import parse_trade_date
from core.strategies import clean_num


def test_empty_file_rejected(make_dirty_csv):
    path = make_dirty_csv([])
    with pytest.raises(ValueError, match="Empty trade file"):
        DuckStore(path)


def test_missing_mandatory_headers_rejected(make_dirty_csv):
    # Missing contractcode
    rows = [
        ["ClientAccountNumber", "TransactionType", "QtyBalance"],
        ["ACC01", "BUY", "100"]
    ]
    path = make_dirty_csv(rows)
    with pytest.raises(ValueError, match="Missing mandatory header"):
        DuckStore(path)


def test_case_insensitive_and_whitespace_headers(make_dirty_csv):
    rows = [
        [" ContractCode ", "CLIENTACCOUNTNUMBER", "TransactionType ", "QtyBalance", "Price"],
        ["NIFTY_FUT", "ACC_WHITE_01", "BUY", "50", "24500.0"]
    ]
    path = make_dirty_csv(rows)
    store = DuckStore(path)
    try:
        assert store.metadata["total_rows"] == 1
        assert "ACC_WHITE_01" in store.metadata["unique_accounts"]
    finally:
        store.close()


def test_clientnumber_fallback(make_dirty_csv):
    """When clientaccountnumber is missing, fallback to clientnumber without error."""
    rows = [
        ["ContractCode", "ClientNumber", "TransactionType", "QtyBalance"],
        ["NIFTY_FUT", "ACC_FALLBACK_99", "SELL", "75"]
    ]
    path = make_dirty_csv(rows)
    store = DuckStore(path)
    try:
        assert "ACC_FALLBACK_99" in store.metadata["unique_accounts"]
    finally:
        store.close()


def test_dirty_dates_normalization():
    assert parse_trade_date("2026-10-29") is not None
    assert parse_trade_date("29-10-2026") is not None
    assert parse_trade_date("29/10/2026") is not None
    assert parse_trade_date("20261029") is not None
    assert parse_trade_date("") is None
    assert parse_trade_date("NA") is None
    assert parse_trade_date(None) is None
    assert parse_trade_date("00/00/0000") is None


def test_dirty_strikes_cleaning():
    assert clean_num("25000") == 25000.0
    assert clean_num("25000.5") == 25000.5
    assert clean_num("") is None
    assert clean_num("NA") is None
    assert clean_num("N/A") is None
    assert clean_num("invalid_strike") is None
