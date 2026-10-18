from flask import Blueprint, request, jsonify, send_file
from api.session_guard import require_session, get_current_service

export_bp = Blueprint("export_bp", __name__)


@export_bp.route("/api/build-preview", methods=["POST"])
@require_session
def build_preview():
    svc = get_current_service()
    data = request.json or {}
    allocations = data.get("allocations", [])
    price_mode = data.get("price_mode", "price")
    manual_price = data.get("manual_price")
    custom_date = data.get("custom_date")
    output_mode = data.get("output_mode", "batched")

    try:
        preview_data = svc.build_preview(
            allocations_data=allocations,
            price_mode=price_mode,
            global_manual_price=manual_price,
            custom_date=custom_date,
            output_mode=output_mode
        )
        return jsonify(preview_data)
    except FileNotFoundError:
        raise
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@export_bp.route("/api/export-excel", methods=["POST"])
@require_session
def export_excel():
    svc = get_current_service()
    data = request.json or {}
    rows = data.get("rows", [])
    filename = data.get("filename", "Trade_Transfer.xlsx")

    try:
        temp_path = svc.export_excel(raw_rows=rows, filename=filename)
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=filename if filename.endswith(".xlsx") else f"{filename}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except FileNotFoundError:
        raise
    except Exception as e:
        return jsonify({"error": str(e)}), 400
