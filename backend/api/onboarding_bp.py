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
from core.sheet_service import get_sheet_service

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
        rid = upsert_broker_rule(prefix, distributor, clearer, rule_id=d.get("id"))
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
        rid = upsert_subgroup_suffix(clientgroup, suffix, rule_id=d.get("id"))
        return jsonify({"success": True, "id": rid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/rules/subgroups/<int:rule_id>", methods=["DELETE"])
def del_subgroup_rule(rule_id: int):
    ok = delete_subgroup_suffix(rule_id)
    return jsonify({"success": ok})


# ---------------------------------------------------------------------------
# Google Sheet Integration
# ---------------------------------------------------------------------------

@onboarding_bp.route("/api/onboarding/sheet/status", methods=["GET"])
def get_sheet_status():
    """Returns Google Sheet configuration, connection health, and row count."""
    try:
        svc = get_sheet_service()
        return jsonify(svc.get_sync_status())
    except Exception as e:
        return jsonify({"configured": False, "connected": False, "error": str(e)}), 200


@onboarding_bp.route("/api/onboarding/sheet/config", methods=["POST"])
def configure_sheet():
    """Validates and persists Google Sheet URL/GID in SQLite."""
    data = request.json or {}
    url = (data.get("sheet_url") or "").strip()
    gid = str(data.get("worksheet_gid") or "").strip()

    if not url:
        return jsonify({"success": False, "error": "Sheet URL is required"}), 400

    try:
        svc = get_sheet_service()
        res = svc.test_and_save_sheet(url, gid)
        return jsonify(res)
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/sheet/config", methods=["DELETE"])
@onboarding_bp.route("/api/onboarding/sheet/disconnect", methods=["POST"])
def disconnect_sheet():
    """Removes stored Google Sheet configuration and flushes database/memory cache."""
    try:
        svc = get_sheet_service()
        res = svc.disconnect_sheet()
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/sheet/refresh", methods=["POST"])
def refresh_sheet():
    """Forces cache reload from current Google Sheet."""
    try:
        svc = get_sheet_service()
        svc.load_cache(force=True)
        return jsonify({"success": True, "status": svc.get_sync_status()})
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/sheet/accounts", methods=["GET"])
def get_sheet_accounts():
    """Returns brief list of accounts for autocomplete/search with query support."""
    q = request.args.get("q", "")
    limit = request.args.get("limit", 50)
    try:
        limit_val = int(limit)
    except (ValueError, TypeError):
        limit_val = 50

    try:
        svc = get_sheet_service()
        accounts = svc.list_accounts(query=q, limit=limit_val)
        return jsonify({"success": True, "accounts": accounts})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/sheet/fetch", methods=["GET"])
def fetch_sheet_account():
    """Looks up single account details and derived values."""
    account = (request.args.get("account") or "").strip()
    person = request.args.get("person")  # optional 'p1' | 'p2'

    if not account:
        return jsonify({"success": False, "error": "Account query param is required"}), 400

    try:
        svc = get_sheet_service()
        rec = svc.lookup_account(account, chosen_person=person)
        if not rec:
            return jsonify({"success": False, "error": f"Account '{account}' not found in Google Sheet"}), 404
        return jsonify({"success": True, "record": rec})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@onboarding_bp.route("/api/onboarding/sheet/batch", methods=["POST"])
def batch_fetch_sheet():
    """Looks up multiple accounts in batch with joint account choices."""
    data = request.json or {}
    accounts = data.get("accounts", [])
    joint_choices = data.get("joint_choices", {})

    if not accounts:
        return jsonify({"success": False, "error": "accounts list is required"}), 400

    try:
        svc = get_sheet_service()
        res = svc.batch_lookup_accounts(accounts, joint_choices=joint_choices)
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

