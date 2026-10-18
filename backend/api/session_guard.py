from functools import wraps
from flask import request, jsonify, g
from services.trade_service import trade_service
from services.session_manager import session_manager


def get_current_service():
    """
    Returns the session-isolated TradeService for the active request.
    Falls back to global singleton if session_id is not specified.
    """
    if hasattr(g, "trade_service") and g.trade_service:
        return g.trade_service
    req_session_id = request.headers.get("X-Session-Id")
    if req_session_id:
        svc = session_manager.get_service(req_session_id)
        if svc:
            g.trade_service = svc
            return svc
    if trade_service.session_id and req_session_id == trade_service.session_id:
        return trade_service
    return trade_service


def require_session(f):
    """
    Decorator validating X-Session-Id header against SessionManager.
    Guarantees request executes in isolated, thread-safe session context.
    Returns 409 if session is missing or expired.
    Returns 410 if active file was deleted/moved from disk.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        req_session_id = request.headers.get("X-Session-Id")

        # Resolve from session_manager first
        service = session_manager.get_service(req_session_id) if req_session_id else None

        # Fallback to global trade_service if session_ids match
        if not service and trade_service.session_id and req_session_id == trade_service.session_id:
            service = trade_service

        if not service or not service._store:
            return jsonify({
                "error": "session_mismatch",
                "message": "File session has changed or expired. Please reload your file."
            }), 409

        g.trade_service = service

        try:
            return f(*args, **kwargs)
        except FileNotFoundError as fnf:
            return jsonify({
                "error": "file_gone",
                "message": str(fnf)
            }), 410
        except ValueError as ve:
            return jsonify({
                "error": "bad_request",
                "message": str(ve)
            }), 400

    return decorated_function
