import time
from concurrent.futures import ThreadPoolExecutor
from services.session_manager import SessionManager


def test_session_isolation(make_trade_csv):
    path1 = make_trade_csv(num_rows=30, num_accounts=2, file_prefix="sess1")
    path2 = make_trade_csv(num_rows=60, num_accounts=4, file_prefix="sess2")

    sm = SessionManager(ttl_seconds=3600)

    svc1, sid1 = sm.create_session(path1, "sess_alpha")
    svc2, sid2 = sm.create_session(path2, "sess_beta")

    assert sid1 == "sess_alpha"
    assert sid2 == "sess_beta"

    # Verify session 1 sees file 1
    s1_retrieved = sm.get_service("sess_alpha")
    assert s1_retrieved.metadata["total_rows"] == 30
    assert len(s1_retrieved.metadata["unique_accounts"]) == 2

    # Verify session 2 sees file 2
    s2_retrieved = sm.get_service("sess_beta")
    assert s2_retrieved.metadata["total_rows"] == 60
    assert len(s2_retrieved.metadata["unique_accounts"]) == 4

    # Close session 1
    assert sm.remove_session("sess_alpha")
    assert sm.get_service("sess_alpha") is None

    # Session 2 must remain fully intact
    assert sm.get_service("sess_beta") is not None
    sm.remove_session("sess_beta")


def test_concurrent_sessions(make_trade_csv):
    """Stress test: 4 threads simultaneously querying their own session instances."""
    sm = SessionManager(ttl_seconds=3600)
    sessions = []

    for i in range(4):
        rows = 50 * (i + 1)
        path = make_trade_csv(num_rows=rows, num_accounts=3, file_prefix=f"conc_{i}")
        sid = f"thread_sess_{i}"
        svc, _ = sm.create_session(path, sid)
        sessions.append((sid, rows))

    def _query_worker(entry):
        sid, expected_rows = entry
        svc = sm.get_service(sid)
        assert svc is not None
        assert svc.metadata["total_rows"] == expected_rows
        contracts = svc.filter_contracts(accounts=["ACC_001"])
        assert contracts["total_lots"] >= 0
        return True

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(_query_worker, sessions))

    assert all(results)
    for sid, _ in sessions:
        sm.remove_session(sid)


def test_session_ttl_expiration(make_trade_csv):
    path = make_trade_csv(num_rows=10, num_accounts=1)
    sm = SessionManager(ttl_seconds=1)  # 1 second TTL

    svc, sid = sm.create_session(path, "short_lived")
    assert sm.get_service("short_lived") is not None

    time.sleep(1.2)
    # Trigger cleanup
    sm._cleanup_stale_locked()
    assert sm.get_service("short_lived") is None
