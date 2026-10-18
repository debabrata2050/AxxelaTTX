import os
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from services.trade_service import TradeService, trade_service
from services.session_manager import session_manager
from api.session_guard import get_current_service

file_bp = Blueprint("file_bp", __name__)


@file_bp.route("/api/status", methods=["GET"])
def get_status():
    svc = get_current_service()
    return jsonify(svc.get_status())


@file_bp.route("/api/unload-file", methods=["POST"])
def unload_file():
    req_session_id = request.headers.get("X-Session-Id")
    if req_session_id:
        session_manager.remove_session(req_session_id)
    trade_service.reset()
    return jsonify({"success": True})


@file_bp.route("/api/files", methods=["GET"])
def list_files():
    files = TradeService.scan_workspace_csvs()
    return jsonify({"files": files})


@file_bp.route("/api/select-file", methods=["POST"])
def select_file():
    data = request.json or {}
    file_path = data.get("file_path")
    if not file_path:
        return jsonify({"success": False, "error": "file_path is required"}), 400

    req_session_id = request.headers.get("X-Session-Id")

    try:
        service, sid = session_manager.create_session(file_path=file_path, session_id=req_session_id)
        # Also sync fallback singleton
        try:
            trade_service.load_file(file_path)
            trade_service.session_id = sid
        except Exception:
            pass

        meta = service.metadata
        return jsonify({
            "success": True,
            "session_id": sid,
            "filename": meta.get("filename"),
            "filepath": file_path,
            "total_rows": meta.get("total_rows", 0),
            "total_records": meta.get("total_rows", 0),
            "total_accounts": len(meta.get("accounts_summary", [])),
            "client_group": meta.get("client_group", "SYM"),
            "default_date": meta.get("default_date"),
            "products": meta.get("products", []),
            "accounts": meta.get("accounts_summary", []),
            "backend": "duckdb",
        })
    except FileNotFoundError as fnf:
        return jsonify({"success": False, "error": str(fnf)}), 410
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@file_bp.route("/api/delete-file", methods=["POST"])
def delete_file():
    data = request.json or {}
    file_path = data.get("file_path")
    if not file_path:
        return jsonify({"success": False, "error": "file_path is required"}), 400

    svc = get_current_service()
    try:
        svc.delete_file(file_path)
        return jsonify({"success": True, "message": "File deleted successfully"})
    except FileNotFoundError:
        return jsonify({"success": False, "error": "File not found."}), 404
    except PermissionError as pe:
        return jsonify({"success": False, "error": str(pe)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@file_bp.route("/api/upload-file", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded."}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"success": False, "error": "Filename is empty."}), 400

    raw_filename = secure_filename(uploaded.filename)
    if not raw_filename.lower().endswith(".csv"):
        return jsonify({"success": False, "error": "Only CSV files are supported."}), 400

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(base_dir, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_filename = f"{timestamp}_{raw_filename}"
    target_path = os.path.join(upload_dir, target_filename)

    req_session_id = request.headers.get("X-Session-Id")

    try:
        uploaded.save(target_path)
        service, sid = session_manager.create_session(file_path=target_path, session_id=req_session_id)
        # Also sync fallback singleton
        try:
            trade_service.load_file(target_path)
            trade_service.session_id = sid
        except Exception:
            pass

        meta = service.metadata
        return jsonify({
            "success": True,
            "session_id": sid,
            "filename": raw_filename,
            "filepath": target_path,
            "total_rows": meta.get("total_rows", 0),
            "total_records": meta.get("total_rows", 0),
            "total_accounts": len(meta.get("accounts_summary", [])),
            "client_group": meta.get("client_group", "SYM"),
            "default_date": meta.get("default_date"),
            "products": meta.get("products", []),
            "accounts": meta.get("accounts_summary", []),
            "backend": "duckdb",
        })
    except PermissionError as pe:
        return jsonify({
            "success": False,
            "error": f"Permission denied while saving upload: {pe}. Try selecting the file from 'Available CSV Files In Workspace' below."
        }), 400
    except Exception as e:
        if os.path.exists(target_path):
            try:
                os.remove(target_path)
            except OSError:
                pass
        return jsonify({"success": False, "error": str(e)}), 400
