import argparse
import os
import sys
import webbrowser

from core import (
    EXCEL_HEADERS,
    CsvTradeReader,
    SchemaValidator,
    TradeAllocation,
    TradeTransferAllocator,
    InstitutionalExcelExporter,
    get_price_strategy
)


def convert_trade_transfer(
    input_csv_path: str,
    to_account: str,
    from_account: str = None,
    custom_date: str = None,
    price_mode: str = "price",
    manual_price: float = None,
    filter_contract: str = None,
    filter_product: str = None,
    output_xlsx_path: str = None
) -> str:
    # 1. Read & Validate CSV Headers
    df, meta = CsvTradeReader.read_and_validate(input_csv_path)

    existing_accounts = meta["unique_accounts"]
    from_acc_list = [a.strip() for a in from_account.split(",") if a.strip()] if from_account else []
    to_acc_list = [a.strip() for a in to_account.split(",") if a.strip()] if to_account else []

    if not from_acc_list:
        if len(existing_accounts) == 1:
            from_acc_list = [next(iter(existing_accounts))]
        else:
            sample = sorted(list(existing_accounts))[:8]
            raise ValueError(
                f"File contains {len(existing_accounts)} accounts ({', '.join(sample)}...). "
                f"Specify source account via --from <account>."
            )

    # Validate accounts
    acc_map_upper = {a.upper(): a for a in existing_accounts}
    validated_from = []
    for fa in from_acc_list:
        if fa.upper() not in acc_map_upper:
            raise ValueError(f"Source account '{fa}' not found in {os.path.basename(input_csv_path)}")
        validated_from.append(acc_map_upper[fa.upper()])

    # Route matching
    if len(to_acc_list) == 1 and len(validated_from) > 1:
        to_acc_list = [to_acc_list[0]] * len(validated_from)
    elif len(to_acc_list) != len(validated_from):
        raise ValueError(
            f"Account mismatch: {len(validated_from)} source accounts provided, but {len(to_acc_list)} destination accounts."
        )

    # Filter rows & construct allocations
    allocations = []
    row_id_map = {str(r["__row_id__"]): r.to_dict() for _, r in df.iterrows()}

    for src_acc, dst_acc in zip(validated_from, to_acc_list):
        sub_df = df[df["__account__"].str.upper() == src_acc.upper()].copy()

        if filter_product:
            if "sectyp" in sub_df.columns:
                sub_df = sub_df[sub_df["sectyp"].fillna("").str.strip().str.upper() == filter_product.strip().upper()]

        if filter_contract:
            c_term = filter_contract.strip().upper()
            c_mask = sub_df["contractcode"].fillna("").str.strip().str.upper().str.contains(c_term, regex=False)
            if "contractfullname" in sub_df.columns:
                c_mask |= sub_df["contractfullname"].fillna("").str.strip().str.upper().str.contains(c_term, regex=False)
            if "contractdescription" in sub_df.columns:
                c_mask |= sub_df["contractdescription"].fillna("").str.strip().str.upper().str.contains(c_term, regex=False)
            sub_df = sub_df[c_mask]

        for _, row in sub_df.iterrows():
            rid = str(row["__row_id__"])
            try:
                qty_val = float(row.get("qtybalance", 0))
            except ValueError:
                qty_val = 0
            if qty_val > 0:
                allocations.append(TradeAllocation(
                    row_id=rid,
                    from_account=src_acc,
                    to_account=dst_acc,
                    transfer_qty=qty_val
                ))

    if not allocations:
        raise ValueError("No trades found matching transfer criteria.")

    # Price Strategy
    price_strategy = get_price_strategy(mode=price_mode, global_manual_price=manual_price)

    # Build transfer matrix
    all_rows, separator_indices, summary = TradeTransferAllocator.allocate(
        allocations=allocations,
        row_id_map=row_id_map,
        price_strategy=price_strategy,
        custom_date=custom_date
    )

    # Determine filename
    if not output_xlsx_path:
        base_dir = os.path.dirname(os.path.abspath(input_csv_path))
        from_tag = validated_from[0] if len(validated_from) == 1 else "MULTI"
        to_tag = to_acc_list[0] if len(to_acc_list) == 1 else "MULTI"
        date_str = meta.get("default_date") or ""
        date_compact = date_str.replace("-", "") if date_str else "OUTPUT"
        filename = f"{meta['client_group']}.Transfer.{date_compact}_{from_tag}_TO_{to_tag}.xlsx"
        output_xlsx_path = os.path.join(base_dir, filename)

    # Export
    InstitutionalExcelExporter.export(
        rows=all_rows,
        output_xlsx_path=output_xlsx_path,
        separator_row_indices=set(separator_indices)
    )

    print(f"Generated transfer file: {output_xlsx_path} ({summary['total_records']} records)")
    return output_xlsx_path


def launch_web_ui(port=5000, host="127.0.0.1"):
    try:
        from app import create_app
        flask_app = create_app()
        url = f"http://{host}:{port}"
        print(f"\n==========================================")
        print(f" Launching Axxela Trade Desk Web UI at: {url}")
        print(f"==========================================\n")
        webbrowser.open(url)
        flask_app.run(host=host, port=port, debug=False)
    except Exception as e:
        print(f"Failed to launch Web UI: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Institutional OPD/Trade CSV to Trade Transfer Converter."
    )
    parser.add_argument("input_csv", nargs="?", help="Path to input trade CSV file")
    parser.add_argument("--ui", "--web", action="store_true", help="Launch interactive Web UI")
    parser.add_argument("--to", "--to-account", dest="to_account", help="Destination account(s), comma-separated")
    parser.add_argument("--from", "--from-account", dest="from_account", help="Source account(s), comma-separated")
    parser.add_argument("--date", dest="custom_date", help="Custom transfer date (YYYY-MM-DD or DD-MM-YYYY)")
    parser.add_argument("--price-mode", choices=["price", "settle", "manual"], default="price", help="TradePrice source: price, settle, or manual")
    parser.add_argument("--manual-price", type=float, dest="manual_price", help="Fixed TradePrice value when using manual price mode")
    parser.add_argument("--product", dest="filter_product", help="Filter by product type (e.g. FUT, OPT)")
    parser.add_argument("--contract", dest="filter_contract", help="Filter by contract code, description or fullname")
    parser.add_argument("--output", "-o", dest="output_xlsx", help="Custom output Excel file path")
    parser.add_argument("--port", type=int, default=5000, help="Web UI port (default 5000)")

    args = parser.parse_args()

    if args.ui:
        launch_web_ui(port=args.port)
        return

    if len(sys.argv) <= 1:
        choice = input("Select mode: [1] Launch Web UI (Recommended)  [2] CLI Mode: ").strip()
        if choice in ("1", "", "ui", "web"):
            launch_web_ui(port=args.port)
            return

    input_csv = args.input_csv
    if not input_csv:
        input_csv = input("Enter path to input trade CSV file: ").strip().strip('"').strip("'")
        if not input_csv:
            print("Error: Input file path required.")
            sys.exit(1)

    to_account = args.to_account
    if not to_account:
        to_account = input("Enter Destination Account (--to, e.g. EEABC): ").strip()
        if not to_account:
            print("Error: Destination account (--to) required.")
            sys.exit(1)

    from_account = args.from_account
    if not from_account:
        ans = input("Enter Source Account [--from, leave blank for all/auto]: ").strip()
        if ans:
            from_account = ans

    try:
        convert_trade_transfer(
            input_csv_path=input_csv,
            to_account=to_account,
            from_account=from_account,
            custom_date=args.custom_date,
            price_mode=args.price_mode,
            manual_price=args.manual_price,
            filter_product=args.filter_product,
            filter_contract=args.filter_contract,
            output_xlsx_path=args.output_xlsx
        )
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
