import pytest
from core.models import TradeAllocation, EXCEL_HEADERS
from core.allocator import TradeTransferAllocator, flip_side
from core.strategies import get_price_strategy
from core.validator import SchemaValidator


def test_flip_side():
    assert flip_side("BUY") == "S"
    assert flip_side("SELL") == "B"
    assert flip_side("B") == "S"
    assert flip_side("S") == "B"
    assert flip_side("") == ""


def test_self_transfer_route_validation():
    is_valid, err = SchemaValidator.validate_route(
        from_account="ACC01",
        to_account="ACC01",
        existing_accounts={"ACC01", "ACC02"},
        existing_routes=[]
    )
    assert not is_valid
    assert "exact same account" in err.lower()


def test_allocator_two_leg_structure():
    allocations = [
        TradeAllocation(
            row_id="1",
            from_account="SRC_ACC",
            to_account="DST_ACC",
            transfer_qty=150.0,
            custom_price=24500.0
        )
    ]
    row_map = {
        "1": {
            "__row_id__": "1",
            "contractcode": "NIFTY_FUT",
            "transactiontype": "BUY",
            "qtybalance": "200.0",
            "price": "24450.0",
            "sectyp": "FUT",
            "exchangecode": "NSE",
            "currency": "USD",
            "datestr": "2026-10-18"
        }
    }

    price_strategy = get_price_strategy("price")
    rows, separators, summary = TradeTransferAllocator.allocate(
        allocations=allocations,
        row_id_map=row_map,
        price_strategy=price_strategy,
        output_mode="paired"
    )

    # In paired mode:
    # Row 0: Destination leg (Receives trade)
    # Row 1: Blank separator
    # Row 2: Source leg (Surrenders trade)
    assert len(rows) == 3
    assert 2 in separators

    dst_row = rows[0]
    sep_row = rows[1]
    src_row = rows[2]

    # Destination leg checks
    assert dst_row[0] == "INTERNAL"
    assert dst_row[4] == "NIFTY_FUT"
    assert dst_row[6] == "BUY"  # original side
    assert dst_row[7] == 150.0  # transfer qty
    assert dst_row[12] == "DST_ACC"  # destination account

    # Separator check
    assert all(c is None for c in sep_row)

    # Source leg checks
    assert src_row[6] in ("S", "SELL")  # flipped side
    assert src_row[7] == 150.0
    assert src_row[12] == "SRC_ACC"  # source account

    # Summary
    assert summary["total_records"] == 2
    assert summary["total_lots"] == 150.0


def test_fractional_lot_precision():
    """Verify fractional lot sizing maintains exact float representation without precision drift."""
    allocations = [
        TradeAllocation(
            row_id="1",
            from_account="SRC_ACC",
            to_account="DST_ACC",
            transfer_qty=0.1234
        )
    ]
    row_map = {
        "1": {
            "__row_id__": "1",
            "contractcode": "BTC_FUT",
            "transactiontype": "B",
            "qtybalance": "1.0",
            "price": "65000.0",
            "sectyp": "FUT"
        }
    }
    price_strategy = get_price_strategy("price")
    rows, _, summary = TradeTransferAllocator.allocate(
        allocations=allocations,
        row_id_map=row_map,
        price_strategy=price_strategy
    )
    assert rows[0][7] == 0.1234
    assert summary["total_lots"] == 0.1234
