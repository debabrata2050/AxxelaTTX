import os
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

from services.trade_service import trade_service

file_bp = Blueprint("file_bp", __name__)


@file_bp.route("/api/status", methods=["GET"])
def get_status():
    return jsonify(trade_service.get_status())


@file_bp.route("/api/unload-file", methods=["POST"])
def unload_file():
    trade_service.reset()
    return jsonify({"success": True})


@file_bp.route("/api/files", methods=["GET"])
def list_files():
    files = trade_service.scan_workspace_csvs()
    return jsonify({"files": files})


@file_bp.route("/api/select-file", methods=["POST"])
def select_file():
    data = request.json or {}
    file_path = data.get("file_path")
    if not file_path:
        return jsonify({"success": False, "error": "file_path is required"}), 400

    try:
        res = trade_service.load_file(file_path)
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@file_bp.route("/api/delete-file", methods=["POST"])
def delete_file():
    data = request.json or {}
    file_path = data.get("file_path")
    if not file_path:
        return jsonify({"success": False, "error": "file_path is required"}), 400

    try:
        trade_service.delete_file(file_path)
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

    # Use unique prefix to prevent Windows file locking / overwrite collisions
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_filename = f"{timestamp}_{raw_filename}"
    target_path = os.path.join(upload_dir, target_filename)

    try:
        uploaded.save(target_path)
        res = trade_service.load_file(target_path)
        # Display the friendly original filename
        res["filename"] = raw_filename
        return jsonify(res)
    except PermissionError as pe:
        return jsonify({
            "success": False,
            "error": f"Permission denied while saving upload: {pe}. Try selecting the file from 'Available CSV Files In Workspace' below."
        }), 400
    except Exception as e:
        # Clean up failed upload file if empty/corrupted
        if os.path.exists(target_path):
            try:
                os.remove(target_path)
            except OSError:
                pass
        return jsonify({"success": False, "error": str(e)}), 400
