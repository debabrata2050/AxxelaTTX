"""
kgi_bp.py
Flask Blueprint for KGI Netting API endpoints.
Provides upload, preview, and Excel export for KGI institutional positions.
"""

import os
import uuid
import tempfile
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from core.kgi_netting_engine import KGINettingEngine, DEFAULT_KGI_TO_ACCOUNT

logger = logging.getLogger(__name__)

kgi_bp = Blueprint("kgi_bp", __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@kgi_bp.route("/api/kgi/upload", methods=["POST"])
def upload_kgi_file():
    """
    Accepts multipart file upload or JSON body with filepath.
    Parses KGI positions and returns summary KPIs, products, and contracts.
    """
    file_path = None

    if "file" in request.files:
        uploaded_file = request.files["file"]
        if uploaded_file.filename == "":
            return jsonify({"success": False, "error": "No file selected."}), 400

        safe_name = secure_filename(uploaded_file.filename) or f"kgi_{uuid.uuid4().hex[:8]}.csv"
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex[:6]}_{safe_name}")
        uploaded_file.save(file_path)
    else:
        data = request.json or {}
        file_path = data.get("filepath")
        if not file_path or not os.path.exists(file_path):
            return jsonify({"success": False, "error": f"File not found: {file_path}"}), 400

    try:
        engine = KGINettingEngine(file_path)
        summary = engine.parse_summary_and_contracts()
        summary["filepath"] = file_path
        return jsonify({"success": True, "data": summary})
    except Exception as e:
        logger.exception("Error processing KGI file")
        return jsonify({"success": False, "error": str(e)}), 400


@kgi_bp.route("/api/kgi/preview", methods=["POST"])
def get_kgi_preview():
    """
    Returns mapped preview rows matching the output schema.
    """
    data = request.json or {}
    file_path = data.get("filepath")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"success": False, "error": "Invalid or missing filepath."}), 400

    contracts = data.get("contracts")
    contract_ids = data.get("contract_ids")
    destination_account = data.get("destination_account") or DEFAULT_KGI_TO_ACCOUNT
    eligible_only = data.get("eligible_only", True)
    custom_comments = data.get("custom_comments")

    try:
        engine = KGINettingEngine(file_path)
        rows = engine.get_preview_rows(
            contracts=contracts,
            contract_ids=contract_ids,
            destination_account=destination_account,
            eligible_only=eligible_only,
            custom_comments=custom_comments,
        )
        return jsonify({"success": True, "rows": rows, "count": len(rows)})
    except Exception as e:
        logger.exception("Error fetching KGI preview")
        return jsonify({"success": False, "error": str(e)}), 400


@kgi_bp.route("/api/kgi/export", methods=["POST"])
def export_kgi_excel():
    """
    Generates and streams consolidated single-worksheet Excel file for KGI Trade Transfer.
    """
    data = request.json or {}
    file_path = data.get("filepath")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"success": False, "error": "Invalid or missing filepath."}), 400

    contracts = data.get("contracts")
    contract_ids = data.get("contract_ids")
    destination_account = data.get("destination_account") or DEFAULT_KGI_TO_ACCOUNT
    eligible_only = data.get("eligible_only", True)
    custom_comments = data.get("custom_comments")
    today_str = datetime.now().strftime("%d.%m.%Y")
    default_filename = f"KGI_Netting_Instructions_{today_str}.xlsx"
    filename = data.get("filename") or default_filename
    if not filename.endswith(".xlsx"):
        filename += ".xlsx"

    try:
        engine = KGINettingEngine(file_path)
        temp_dir = tempfile.gettempdir()
        out_path = os.path.join(temp_dir, f"kgi_export_{uuid.uuid4().hex[:8]}.xlsx")

        engine.export_consolidated_excel(
            output_xlsx_path=out_path,
            contracts=contracts,
            contract_ids=contract_ids,
            destination_account=destination_account,
            eligible_only=eligible_only,
            custom_comments=custom_comments,
        )

        return send_file(
            out_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        logger.exception("Error exporting KGI Excel")
        return jsonify({"success": False, "error": str(e)}), 400
