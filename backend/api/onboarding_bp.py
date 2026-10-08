"""
onboarding_bp.py
Flask blueprint for the People Onboarding feature.

Endpoints
---------
  POST /api/onboarding/export          – accept rows JSON, return .xlsx
  GET  /api/onboarding/preview         – derive fields for a single person (live preview)
  GET  /api/onboarding/rules/clientgroups   – list clientgroup rules
  POST /api/onboarding/rules/clientgroups   – add / update a rule
  DELETE /api/onboarding/rules/clientgroups/<id>

  GET  /api/onboarding/rules/brokers        – list broker rules
  POST /api/onboarding/rules/brokers        – upsert by prefix
  DELETE /api/onboarding/rules/brokers/<id>

  GET  /api/onboarding/rules/subgroups      – list subgroup suffixes
  POST /api/onboarding/rules/subgroups      – upsert
  DELETE /api/onboarding/rules/subgroups/<id>
"""

import os
from flask import Blueprint, request, jsonify, send_file

from core.onboarding_engine import build_onboarding_excel, derive_preview
from core.onboarding_db import (
    list_clientgroup_rules, upsert_clientgroup_rule, delete_clientgroup_rule,
    list_broker_rules,      upsert_broker_rule,      delete_broker_rule,
    list_subgroup_suffixes, upsert_subgroup_suffix,  delete_subgroup_suffix,
)

onboarding_bp = Blueprint("onboarding_bp", __name__)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/export", methods=["POST"])
def export_onboarding():
    data = request.json or {}
    rows = data.get("rows", [])
    filename = data.get("filename", "Onboarding.xlsx")

    if not rows:
        return jsonify({"error": "No rows provided"}), 400

    try:
        path = build_onboarding_excel(rows)
        if not filename.endswith(".xlsx"):
            filename += ".xlsx"
        return send_file(
            path,
            as_attachment=True,
            download_name=filename,
            mimetype=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Live preview (GET with query params or POST with JSON body)
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/preview", methods=["POST"])
def preview_onboarding():
    data = request.json or {}
    try:
        derived = derive_preview(data)
        return jsonify({"success": True, "derived": derived})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# clientgroup_rules CRUD
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/rules/clientgroups", methods=["GET"])
def get_clientgroup_rules():
    return jsonify(list_clientgroup_rules())


@onboarding_bp.route("/api/onboarding/rules/clientgroups", methods=["POST"])
def post_clientgroup_rule():
    d = request.json or {}
    clientgroup = d.get("clientgroup", "").strip()
    if not clientgroup:
        return jsonify({"error": "clientgroup is required"}), 400
    try:
        rid = upsert_clientgroup_rule(
            clientgroup=clientgroup,
            comms_code=d.get("comms_code") or None,
            location=d.get("location") or None,
            sub_branch=d.get("sub_branch") or None,
            is_commodity=d.get("is_commodity"),
            priority=int(d.get("priority", 0)),
            rule_id=d.get("id"),
        )
        return jsonify({"success": True, "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/rules/clientgroups/<int:rule_id>", methods=["DELETE"])
def del_clientgroup_rule(rule_id: int):
    ok = delete_clientgroup_rule(rule_id)
    return jsonify({"success": ok})


# ---------------------------------------------------------------------------
# broker_rules CRUD
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/rules/brokers", methods=["GET"])
def get_broker_rules():
    return jsonify(list_broker_rules())


@onboarding_bp.route("/api/onboarding/rules/brokers", methods=["POST"])
def post_broker_rule():
    d = request.json or {}
    prefix      = (d.get("prefix") or "").strip().upper()
    distributor = (d.get("distributor") or "").strip()
    clearer     = (d.get("clearer_template") or "").strip()
    if not prefix or not distributor or not clearer:
        return jsonify({"error": "prefix, distributor, clearer_template are required"}), 400
    try:
        rid = upsert_broker_rule(prefix, distributor, clearer)
        return jsonify({"success": True, "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/rules/brokers/<int:rule_id>", methods=["DELETE"])
def del_broker_rule(rule_id: int):
    ok = delete_broker_rule(rule_id)
    return jsonify({"success": ok})


# ---------------------------------------------------------------------------
# clientsubgroup_suffixes CRUD
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/rules/subgroups", methods=["GET"])
def get_subgroup_rules():
    return jsonify(list_subgroup_suffixes())


@onboarding_bp.route("/api/onboarding/rules/subgroups", methods=["POST"])
def post_subgroup_rule():
    d = request.json or {}
    clientgroup = (d.get("clientgroup") or "").strip()
    suffix      = (d.get("suffix") or "").strip()
    if not clientgroup or not suffix:
        return jsonify({"error": "clientgroup and suffix are required"}), 400
    try:
        rid = upsert_subgroup_suffix(clientgroup, suffix)
        return jsonify({"success": True, "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/rules/subgroups/<int:rule_id>", methods=["DELETE"])
def del_subgroup_rule(rule_id: int):
    ok = delete_subgroup_suffix(rule_id)
    return jsonify({"success": ok})
