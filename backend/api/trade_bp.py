from flask import Blueprint, request, jsonify
from api.session_guard import require_session, get_current_service

trade_bp = Blueprint("trade_bp", __name__)


@trade_bp.route("/api/accounts", methods=["GET"])
@require_session
def get_accounts():
    svc = get_current_service()
    q = request.args.get("q", "").strip()
    accounts = svc.search_accounts(query=q)
    return jsonify({"accounts": accounts, "total_matches": len(accounts)})


@trade_bp.route("/api/contracts", methods=["GET"])
@require_session
def get_contracts():
    svc = get_current_service()
    accounts_param = request.args.get("accounts", "").strip()
    product_param = request.args.get("product", "ALL").strip()
    q = request.args.get("q", "").strip()

    accounts = [a.strip() for a in accounts_param.split(",") if a.strip()] if accounts_param else []
    res = svc.filter_contracts(accounts=accounts, product=product_param, query=q)
    return jsonify(res)


@trade_bp.route("/api/trades", methods=["POST"])
@require_session
def get_trades():
    svc = get_current_service()
    data = request.json or {}
    accounts = data.get("accounts", [])
    contract_ids = data.get("contract_ids", [])
    contract_codes = data.get("contract_codes", [])
    product = data.get("product", "ALL")
    limit = data.get("limit")
    offset = data.get("offset", 0)
    force_refresh = bool(data.get("force_refresh", False))

    trades = svc.get_trades(
        accounts=accounts,
        contract_ids=contract_ids,
        contract_codes=contract_codes,
        product=product,
        limit=limit,
        offset=offset,
        force_refresh=force_refresh
    )
    return jsonify({"trades": trades, "count": len(trades)})
