from functools import wraps
from flask import request, jsonify
from services.trade_service import trade_service


def require_session(f):
    """
    Decorator validating X-Session-Id header against backend singleton session_id.
    Returns 409 if session is missing or mismatched.
    Returns 410 if active file was deleted/moved from disk.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        req_session_id = request.headers.get("X-Session-Id")
        current_session_id = trade_service.session_id

        if not current_session_id or not req_session_id or req_session_id != current_session_id:
            return jsonify({
                "error": "session_mismatch",
                "message": "File session has changed or expired. Please reload your file."
            }), 409

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
