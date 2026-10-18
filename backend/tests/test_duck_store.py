import os
import time
import pytest
from core.duck_store import DuckStore


def test_duck_store_small(make_trade_csv):
    path = make_trade_csv(num_rows=50, num_accounts=3)
    store = DuckStore(path)
    try:
        assert store.metadata["total_rows"] == 50
        assert len(store.metadata["unique_accounts"]) == 3
        summary = store.get_accounts_summary()
        assert len(summary) == 3
        assert sum(s["trade_count"] for s in summary) == 50
    finally:
        store.close()


def test_duck_store_filter_contracts(make_trade_csv):
    path = make_trade_csv(num_rows=200, num_accounts=5)
    store = DuckStore(path)
    try:
        res = store.filter_contracts(accounts=["ACC_001"], product="ALL")
        assert res["total_contracts"] > 0
        assert res["total_lots"] > 0
        assert len(res["contracts"]) <= 250
        # All returned contracts belong to ACC_001
        for c in res["contracts"]:
            assert c["account"] == "ACC_001"
            assert c["available_lots"] > 0
    finally:
        store.close()


def test_duck_store_pagination(make_trade_csv):
    path = make_trade_csv(num_rows=100, num_accounts=2)
    store = DuckStore(path)
    try:
        page1 = store.get_trades(accounts=["ACC_001"], limit=10, offset=0)
        page2 = store.get_trades(accounts=["ACC_001"], limit=10, offset=10)
        assert len(page1) == 10
        assert len(page2) == 10
        # Check no overlap between page 1 and page 2
        p1_ids = {t["row_id"] for t in page1}
        p2_ids = {t["row_id"] for t in page2}
        assert p1_ids.isdisjoint(p2_ids)
    finally:
        store.close()


def test_duck_store_scale_250k(make_trade_csv):
    """Benchmark: 250,000 records must load and query in < 3.5s with zero disk sidecars."""
    path = make_trade_csv(num_rows=250_000, num_accounts=25, file_prefix="scale_250k")

    t0 = time.time()
    store = DuckStore(path)
    t_load = time.time() - t0

    try:
        assert store.metadata["total_rows"] == 250_000
        assert len(store.metadata["unique_accounts"]) == 25
        assert t_load < 3.5, f"Ingestion too slow: {t_load:.2f}s (expected < 3.5s)"

        # Query aggregation benchmark
        t1 = time.time()
        contracts = store.filter_contracts(accounts=["ACC_001", "ACC_002"])
        t_query = time.time() - t1

        assert contracts["total_contracts"] > 0
        assert contracts["total_lots"] > 0
        assert t_query < 1.0, f"Query too slow: {t_query:.2f}s (expected < 1.0s)"

        # Verify zero sidecar files generated on disk
        dir_name = os.path.dirname(path)
        base_name = os.path.splitext(os.path.basename(path))[0]
        sidecar_path = os.path.join(dir_name, f"{base_name}_cache.db")
        assert not os.path.exists(sidecar_path), "DuckStore must NOT create sidecar .db files on disk"
    finally:
        store.close()
