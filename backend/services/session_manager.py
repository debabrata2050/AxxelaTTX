import time
import uuid
import logging
import threading
from typing import Dict, Any, Optional, Tuple, List

from services.trade_service import TradeService

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Thread-safe multi-session manager for Trade Transfer Platform.
    Isolates each client browser tab into its own independent TradeService instance.
    Prevents cross-tab session clobbering, race conditions, and memory leaks.
    """

    def __init__(self, ttl_seconds: int = 7200):
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def get_service(self, session_id: Optional[str]) -> Optional[TradeService]:
        if not session_id:
            return None
        with self._lock:
            entry = self._sessions.get(session_id)
            if entry:
                entry["last_accessed"] = time.time()
                return entry["service"]
            return None

    def create_session(self, file_path: str, session_id: Optional[str] = None) -> Tuple[TradeService, str]:
        with self._lock:
            s_id = session_id or uuid.uuid4().hex[:12]

            # If existing session exists, close previous resources cleanly
            if s_id in self._sessions:
                try:
                    self._sessions[s_id]["service"].close()
                except Exception:
                    pass

            service = TradeService(session_id=s_id)
            service.load_file(file_path)

            self._sessions[s_id] = {
                "service": service,
                "created_at": time.time(),
                "last_accessed": time.time(),
            }

            self._cleanup_stale_locked()
            return service, s_id

    def remove_session(self, session_id: str) -> bool:
        if not session_id:
            return False
        with self._lock:
            entry = self._sessions.pop(session_id, None)
            if entry:
                try:
                    entry["service"].close()
                except Exception:
                    pass
                return True
            return False

    def get_active_session_ids(self) -> List[str]:
        with self._lock:
            return list(self._sessions.keys())

    def _cleanup_stale_locked(self):
        now = time.time()
        stale_ids = [
            sid for sid, d in self._sessions.items()
            if now - d["last_accessed"] > self._ttl
        ]
        for sid in stale_ids:
            entry = self._sessions.pop(sid, None)
            if entry:
                try:
                    entry["service"].close()
                except Exception:
                    pass


# Singleton session manager instance
session_manager = SessionManager(ttl_seconds=7200)
