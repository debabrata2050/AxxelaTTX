from flask import Blueprint, request, jsonify
from services.trade_service import trade_service

trade_bp = Blueprint("trade_bp", __name__)


@trade_bp.route("/api/accounts", methods=["GET"])
def get_accounts():
    q = request.args.get("q", "").strip()
    accounts = trade_service.search_accounts(query=q)
    return jsonify({"accounts": accounts, "total_matches": len(accounts)})


@trade_bp.route("/api/contracts", methods=["GET"])
def get_contracts():
    accounts_param = request.args.get("accounts", "").strip()
    product_param = request.args.get("product", "ALL").strip()
    q = request.args.get("q", "").strip()

    accounts = [a.strip() for a in accounts_param.split(",") if a.strip()] if accounts_param else []
    res = trade_service.filter_contracts(accounts=accounts, product=product_param, query=q)
    return jsonify(res)


@trade_bp.route("/api/trades", methods=["POST"])
def get_trades():
    data = request.json or {}
    accounts = data.get("accounts", [])
    contract_codes = data.get("contract_codes", [])
    product = data.get("product", "ALL")

    trades = trade_service.get_trades(
        accounts=accounts,
        contract_codes=contract_codes,
        product=product
    )
    return jsonify({"trades": trades, "count": len(trades)})
