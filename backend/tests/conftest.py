import os
import sys
import csv
import tempfile
import pytest

# Ensure backend directory is in python import path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


@pytest.fixture
def make_trade_csv():
    """Factory fixture generating valid trade CSVs of arbitrary size."""
    created_files = []

    def _generate(num_rows=100, num_accounts=5, file_prefix="trade_test"):
        fd, path = tempfile.mkstemp(prefix=file_prefix, suffix=".csv")
        os.close(fd)
        created_files.append(path)

        headers = [
            "ContractCode", "ClientAccountNumber", "TransactionType", "QtyBalance",
            "Price", "Settle", "SecTyp", "Strike", "C/P", "ContractExpiry",
            "ExpiryDate", "Currency", "DateStr", "ExchangeCode", "ClientGroup"
        ]

        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(headers)
            for i in range(num_rows):
                acc = f"ACC_{(i % num_accounts) + 1:03d}"
                is_opt = (i % 3 != 0)
                w.writerow([
                    f"NIFTY_FUT_{i % 50}" if not is_opt else f"NIFTY_OPT_{24000 + (i % 20) * 100}",
                    acc,
                    "BUY" if i % 2 == 0 else "SELL",
                    f"{(i % 50) + 1}0",
                    f"{24500.50 + (i % 10)}",
                    f"{24505.00 + (i % 10)}",
                    "OPT" if is_opt else "FUT",
                    str(24000 + (i % 20) * 100) if is_opt else "",
                    "C" if i % 2 == 0 else "P" if is_opt else "",
                    "2026-10-29",
                    "2026-10-29",
                    "USD",
                    "2026-10-18",
                    "NSE",
                    "SYM"
                ])
        return path

    yield _generate

    # Cleanup generated temporary files
    for p in created_files:
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


@pytest.fixture
def make_dirty_csv():
    """Factory fixture generating CSVs with dirty dates, NaN strikes, and noisy data."""
    created_files = []

    def _generate(rows):
        fd, path = tempfile.mkstemp(prefix="dirty_test", suffix=".csv")
        os.close(fd)
        created_files.append(path)

        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            for r in rows:
                w.writerow(r)
        return path

    yield _generate

    for p in created_files:
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
