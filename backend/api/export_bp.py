from flask import Blueprint, request, jsonify, send_file
from services.trade_service import trade_service

export_bp = Blueprint("export_bp", __name__)


@export_bp.route("/api/build-preview", methods=["POST"])
def build_preview():
    data = request.json or {}
    allocations = data.get("allocations", [])
    price_mode = data.get("price_mode", "price")
    manual_price = data.get("manual_price")
    custom_date = data.get("custom_date")

    try:
        preview_data = trade_service.build_preview(
            allocations_data=allocations,
            price_mode=price_mode,
            global_manual_price=manual_price,
            custom_date=custom_date
        )
        return jsonify(preview_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@export_bp.route("/api/export-excel", methods=["POST"])
def export_excel():
    data = request.json or {}
    rows = data.get("rows", [])
    filename = data.get("filename", "Trade_Transfer.xlsx")

    try:
        temp_path = trade_service.export_excel(raw_rows=rows, filename=filename)
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=filename if filename.endswith(".xlsx") else f"{filename}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400
