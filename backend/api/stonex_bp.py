import os
import uuid
import tempfile
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from core.stonex_netting_engine import StoneXNettingEngine

logger = logging.getLogger(__name__)

stonex_bp = Blueprint("stonex_bp", __name__)

# Temporary upload folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@stonex_bp.route("/api/stonex/upload", methods=["POST"])
def upload_stonex_file():
    """
    Accepts either multipart file upload or JSON body with filepath.
    Parses StoneX positions with DuckDB and returns summary + contracts list.
    """
    file_path = None

    if "file" in request.files:
        uploaded_file = request.files["file"]
        if uploaded_file.filename == "":
            return jsonify({"success": False, "error": "No file selected."}), 400

        safe_name = secure_filename(uploaded_file.filename) or f"stonex_{uuid.uuid4().hex[:8]}.csv"
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex[:6]}_{safe_name}")
        uploaded_file.save(file_path)
    else:
        data = request.json or {}
        file_path = data.get("filepath")
        if not file_path or not os.path.exists(file_path):
            return jsonify({"success": False, "error": f"File not found: {file_path}"}), 400

    try:
        engine = StoneXNettingEngine(file_path)
        summary = engine.parse_summary_and_contracts()
        summary["filepath"] = file_path
        return jsonify({"success": True, "data": summary})
    except Exception as e:
        logger.exception("Error processing StoneX file")
        return jsonify({"success": False, "error": str(e)}), 400


@stonex_bp.route("/api/stonex/preview", methods=["POST"])
def get_stonex_preview():
    """
    Returns mapped preview rows matching the output schema.
    """
    data = request.json or {}
    file_path = data.get("filepath")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"success": False, "error": "Invalid or missing filepath."}), 400

    symbol_filter = data.get("symbol")
    period_filter = data.get("period")
    symbols = data.get("symbols")
    contract_ids = data.get("contract_ids")
    eligible_only = data.get("eligible_only", True)

    try:
        engine = StoneXNettingEngine(file_path)
        rows = engine.get_preview_rows(
            symbol_filter=symbol_filter,
            period_filter=period_filter,
            symbols=symbols,
            contract_ids=contract_ids,
            eligible_only=eligible_only,
        )
        return jsonify({"success": True, "rows": rows, "count": len(rows)})
    except Exception as e:
        logger.exception("Error fetching StoneX preview")
        return jsonify({"success": False, "error": str(e)}), 400


@stonex_bp.route("/api/stonex/export", methods=["POST"])
def export_stonex_excel():
    """
    Generates and streams consolidated single-worksheet Excel file.
    """
    data = request.json or {}
    file_path = data.get("filepath")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"success": False, "error": "Invalid or missing filepath."}), 400

    symbol_filter = data.get("symbol")
    period_filter = data.get("period")
    symbols = data.get("symbols")
    contract_ids = data.get("contract_ids")
    eligible_only = data.get("eligible_only", True)
    custom_comments = data.get("custom_comments")
    filename = data.get("filename") or "StoneX_Netting_Consolidated.xlsx"
    if not filename.endswith(".xlsx"):
        filename += ".xlsx"

    try:
        engine = StoneXNettingEngine(file_path)
        temp_fd, temp_path = tempfile.mkstemp(suffix=".xlsx", prefix="stonex_netting_")
        os.close(temp_fd)

        engine.export_consolidated_excel(
            output_xlsx_path=temp_path,
            symbol_filter=symbol_filter,
            period_filter=period_filter,
            symbols=symbols,
            contract_ids=contract_ids,
            eligible_only=eligible_only,
            custom_comments=custom_comments,
        )

        return send_file(
            temp_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        logger.exception("Error exporting StoneX Excel")
        return jsonify({"success": False, "error": str(e)}), 400
